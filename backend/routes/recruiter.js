const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { pinAuth } = require("../middleware/pinAuth");
const { preFilterCandidates } = require("../services/preFilter");
const { runMatchAnalysis } = require("../services/analyzer");

const prisma = new PrismaClient();
const router = express.Router();

router.use(pinAuth("RECRUITER"));

// GET /api/recruiter/jobs
router.get("/jobs", async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { organisationId: req.pin.organisationId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
    });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// POST /api/recruiter/jobs — create job on the fly
router.post("/jobs", async (req, res) => {
  try {
    const { title, department, description, requirements, salaryRange, location, workMode, experienceLevel, teamNotes } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }

    const job = await prisma.job.create({
      data: {
        organisationId: req.pin.organisationId,
        title,
        department: department || null,
        description,
        requirements: requirements || { mustHave: [], niceToHave: [] },
        salaryRange: salaryRange || null,
        location: location || null,
        workMode: workMode || "HYBRID",
        experienceLevel: experienceLevel || null,
        teamNotes: teamNotes || null,
        status: "OPEN",
      },
    });

    res.status(201).json(job);
  } catch (err) {
    console.error("[recruiter] Create job error:", err);
    res.status(500).json({ error: "Failed to create job" });
  }
});

// GET /api/recruiter/jobs/:id
router.get("/jobs/:id", async (req, res) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, organisationId: req.pin.organisationId },
    });
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

// POST /api/recruiter/match/:jobId
router.post("/match/:jobId", async (req, res) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.jobId, organisationId: req.pin.organisationId },
      include: { organisation: { include: { scoringConfig: true } } },
    });
    if (!job) return res.status(404).json({ error: "Job not found" });

    const candidates = await prisma.candidate.findMany({
      where: { organisationId: req.pin.organisationId, isActive: true, profile: { not: null } },
    });

    if (candidates.length === 0) {
      return res.status(400).json({
        error: "No candidates in CV bank",
        message: "No CVs have been uploaded yet. Share the applicant PIN with candidates first.",
      });
    }

    const topN = job.organisation.scoringConfig?.preFilterTopN || 50;
    const preFiltered = preFilterCandidates(candidates, job, topN);

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

    const passedIds = new Set(preFiltered.map((pf) => pf.candidateId));
    await prisma.matchResult.createMany({
      data: [
        ...preFiltered.map((pf) => ({
          matchRunId: matchRun.id, candidateId: pf.candidateId,
          preFilterScore: pf.preFilterScore, passedPreFilter: true, analysisStatus: "PENDING",
        })),
        ...candidates.filter((c) => !passedIds.has(c.id)).map((c) => ({
          matchRunId: matchRun.id, candidateId: c.id,
          preFilterScore: 0, passedPreFilter: false, analysisStatus: "PENDING",
        })),
      ],
    });

    res.status(201).json({
      matchRunId: matchRun.id,
      totalCandidates: candidates.length,
      preFilterPassed: preFiltered.length,
      message: `Matched ${preFiltered.length} of ${candidates.length} candidates. AI analysis running...`,
    });

    runMatchAnalysis(matchRun.id).catch(console.error);
  } catch (err) {
    console.error("[recruiter] Match error:", err);
    res.status(500).json({ error: "Failed to start matching" });
  }
});

// GET /api/recruiter/matches
router.get("/matches", async (req, res) => {
  try {
    const runs = await prisma.matchRun.findMany({
      where: { organisationId: req.pin.organisationId },
      orderBy: { createdAt: "desc" },
      include: {
        job: { select: { title: true, department: true } },
        _count: { select: { results: { where: { passedPreFilter: true } } } },
      },
    });
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

// GET /api/recruiter/matches/:id
router.get("/matches/:id", async (req, res) => {
  try {
    const matchRun = await prisma.matchRun.findFirst({
      where: { id: req.params.id, organisationId: req.pin.organisationId },
      include: {
        job: true,
        results: {
          where: { passedPreFilter: true },
          orderBy: { aiScore: { sort: "desc", nulls: "last" } },
          include: {
            candidate: {
              select: { id: true, name: true, email: true, currentRole: true, yearsExp: true, skills: true },
            },
          },
        },
      },
    });
    if (!matchRun) return res.status(404).json({ error: "Match run not found" });

    const enrichedResults = matchRun.results.map((r) => ({
      id: r.id, candidateId: r.candidateId,
      candidateName: r.candidate.name, candidateEmail: r.candidate.email,
      currentRole: r.candidate.currentRole, yearsExp: r.candidate.yearsExp,
      skills: r.candidate.skills,
      preFilterScore: r.preFilterScore, aiScore: r.aiScore,
      analysis: r.analysis, analysisStatus: r.analysisStatus, status: r.status,
    }));

    res.json({ ...matchRun, results: enrichedResults });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch match results" });
  }
});

// PATCH /api/recruiter/results/:id
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
