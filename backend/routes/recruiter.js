const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { pinAuth } = require("../middleware/pinAuth");
const { preFilterCandidates } = require("../services/preFilter");
const { runMatchAnalysis } = require("../services/analyzer");

const prisma = new PrismaClient();
const router = express.Router();

// All recruiter routes require RECRUITER PIN
router.use(pinAuth("RECRUITER"));

// GET /api/recruiter/jobs — list open jobs for this org
router.get("/jobs", async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: {
        organisationId: req.pin.organisationId,
        status: "OPEN",
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// GET /api/recruiter/jobs/:id — job detail
router.get("/jobs/:id", async (req, res) => {
  try {
    const job = await prisma.job.findFirst({
      where: {
        id: req.params.id,
        organisationId: req.pin.organisationId,
      },
    });
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

/**
 * POST /api/recruiter/match/:jobId — run a new match against the CV bank
 *
 * Two-stage process:
 * 1. Pre-filter: keyword match all candidates, take top N
 * 2. AI analysis: send anonymised profiles of top N to Claude
 */
router.post("/match/:jobId", async (req, res) => {
  try {
    const job = await prisma.job.findFirst({
      where: {
        id: req.params.jobId,
        organisationId: req.pin.organisationId,
      },
      include: {
        organisation: { include: { scoringConfig: true } },
      },
    });
    if (!job) return res.status(404).json({ error: "Job not found" });

    // Get all candidates in this org's CV bank
    const candidates = await prisma.candidate.findMany({
      where: {
        organisationId: req.pin.organisationId,
        isActive: true,
        profile: { not: null },
      },
    });

    if (candidates.length === 0) {
      return res.status(400).json({
        error: "No candidates in CV bank",
        message: "No CVs have been uploaded yet. Share the applicant PIN with candidates first.",
      });
    }

    const topN = job.organisation.scoringConfig?.preFilterTopN || 50;

    // Stage 1: Pre-filter
    const preFiltered = preFilterCandidates(candidates, job, topN);

    // Create match run
    const matchRun = await prisma.matchRun.create({
      data: {
        organisationId: req.pin.organisationId,
        jobId: job.id,
        pinId: req.pin.id,
        triggeredBy: "pin",
        preFilterCount: topN,
        totalCandidates: candidates.length,
        status: "PRE_FILTERING",
      },
    });

    // Create match results for ALL candidates (with pre-filter scores)
    const resultData = preFiltered.map((pf) => ({
      matchRunId: matchRun.id,
      candidateId: pf.candidateId,
      preFilterScore: pf.preFilterScore,
      passedPreFilter: true,
      analysisStatus: "PENDING",
    }));

    // Also record candidates that didn't pass (for transparency)
    const passedIds = new Set(preFiltered.map((pf) => pf.candidateId));
    const notPassed = candidates
      .filter((c) => !passedIds.has(c.id))
      .map((c) => ({
        matchRunId: matchRun.id,
        candidateId: c.id,
        preFilterScore: 0,
        passedPreFilter: false,
        analysisStatus: "PENDING",
      }));

    await prisma.matchResult.createMany({
      data: [...resultData, ...notPassed],
    });

    // Return immediately — AI analysis runs in background
    res.status(201).json({
      matchRunId: matchRun.id,
      totalCandidates: candidates.length,
      preFilterPassed: preFiltered.length,
      message: `Matched ${preFiltered.length} of ${candidates.length} candidates. AI analysis running...`,
    });

    // Stage 2: Run AI analysis in background
    runMatchAnalysis(matchRun.id).catch((err) =>
      console.error(`[recruiter] Background analysis failed:`, err)
    );
  } catch (err) {
    console.error("[recruiter] Match error:", err);
    res.status(500).json({ error: "Failed to start matching" });
  }
});

// GET /api/recruiter/matches — list match runs
router.get("/matches", async (req, res) => {
  try {
    const runs = await prisma.matchRun.findMany({
      where: { organisationId: req.pin.organisationId },
      orderBy: { createdAt: "desc" },
      include: {
        job: { select: { title: true, department: true } },
        _count: {
          select: { results: { where: { passedPreFilter: true } } },
        },
      },
    });
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

// GET /api/recruiter/matches/:id — match run results (ranked)
router.get("/matches/:id", async (req, res) => {
  try {
    const matchRun = await prisma.matchRun.findFirst({
      where: {
        id: req.params.id,
        organisationId: req.pin.organisationId,
      },
      include: {
        job: true,
        results: {
          where: { passedPreFilter: true },
          orderBy: { aiScore: { sort: "desc", nulls: "last" } },
          include: {
            candidate: {
              select: {
                id: true,
                name: true,
                email: true,
                currentRole: true,
                yearsExp: true,
                skills: true,
              },
            },
          },
        },
      },
    });

    if (!matchRun) return res.status(404).json({ error: "Match run not found" });

    // Re-attach candidate names to results (PII only in response, never in AI)
    const enrichedResults = matchRun.results.map((r) => ({
      id: r.id,
      candidateId: r.candidateId,
      candidateName: r.candidate.name,
      candidateEmail: r.candidate.email,
      currentRole: r.candidate.currentRole,
      yearsExp: r.candidate.yearsExp,
      skills: r.candidate.skills,
      preFilterScore: r.preFilterScore,
      aiScore: r.aiScore,
      analysis: r.analysis,
      analysisStatus: r.analysisStatus,
      status: r.status,
    }));

    res.json({
      ...matchRun,
      results: enrichedResults,
    });
  } catch (err) {
    console.error("[recruiter] Match detail error:", err);
    res.status(500).json({ error: "Failed to fetch match results" });
  }
});

// PATCH /api/recruiter/results/:id — update candidate status in a match
router.patch("/results/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const result = await prisma.matchResult.findUnique({
      where: { id: req.params.id },
      include: { matchRun: true },
    });

    if (!result || result.matchRun.organisationId !== req.pin.organisationId) {
      return res.status(404).json({ error: "Not found" });
    }

    const updated = await prisma.matchResult.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

module.exports = router;
