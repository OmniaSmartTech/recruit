const express = require("express");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const { auth } = require("../middleware/auth");
const { uploadFile, getDownloadUrl } = require("../utils/s3");
const { preFilterCandidates } = require("../services/preFilter");
const { runMatchAnalysis } = require("../services/analyzer");
const { v4: uuidv4 } = require("uuid");

const prisma = new PrismaClient();
const router = express.Router();
const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(auth);

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

router.get("/stats", async (req, res) => {
  try {
    const orgId = req.user.organisationId;

    const [totalJobs, openJobs, totalCandidates, totalMatchRuns, recentCandidates] =
      await Promise.all([
        prisma.job.count({ where: { organisationId: orgId } }),
        prisma.job.count({ where: { organisationId: orgId, status: "OPEN" } }),
        prisma.candidate.count({ where: { organisationId: orgId } }),
        prisma.matchRun.count({ where: { organisationId: orgId } }),
        prisma.candidate.count({
          where: {
            organisationId: orgId,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

    const recentMatches = await prisma.matchRun.findMany({
      where: { organisationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        job: { select: { title: true } },
        _count: { select: { results: { where: { passedPreFilter: true } } } },
      },
    });

    res.json({
      totalJobs, openJobs, totalCandidates, totalMatchRuns, recentCandidates,
      recentMatches,
    });
  } catch (err) {
    console.error("[admin] Stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ─── PIN Management ──────────────────────────────────────────────────────────

router.get("/pins", async (req, res) => {
  try {
    const pins = await prisma.pin.findMany({
      where: { organisationId: req.user.organisationId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { candidates: true, matchRuns: true } },
      },
    });
    res.json(pins);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch PINs" });
  }
});

router.post("/pins", async (req, res) => {
  try {
    const { label, type, jobId } = req.body;
    if (!label || !type) {
      return res.status(400).json({ error: "Label and type are required" });
    }
    if (!["RECRUITER", "APPLICANT"].includes(type)) {
      return res.status(400).json({ error: "Type must be RECRUITER or APPLICANT" });
    }

    const code = uuidv4().replace(/-/g, "").substring(0, 6).toUpperCase();

    const pin = await prisma.pin.create({
      data: {
        organisationId: req.user.organisationId,
        code,
        label,
        type,
        jobId: jobId || null,
      },
    });

    res.status(201).json(pin);
  } catch (err) {
    res.status(500).json({ error: "Failed to create PIN" });
  }
});

router.patch("/pins/:id", async (req, res) => {
  try {
    const existing = await prisma.pin.findFirst({
      where: { id: req.params.id, organisationId: req.user.organisationId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const { label, isActive } = req.body;
    const data = {};
    if (label !== undefined) data.label = label;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.pin.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update PIN" });
  }
});

router.delete("/pins/:id", async (req, res) => {
  try {
    await prisma.pin.deleteMany({
      where: { id: req.params.id, organisationId: req.user.organisationId },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete PIN" });
  }
});

// ─── CV Bank ─────────────────────────────────────────────────────────────────

router.get("/candidates", async (req, res) => {
  try {
    const candidates = await prisma.candidate.findMany({
      where: { organisationId: req.user.organisationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        currentRole: true,
        skills: true,
        yearsExp: true,
        cvFileName: true,
        cvFileKey: true,
        isActive: true,
        createdAt: true,
        pin: { select: { label: true, type: true } },
      },
    });

    // Generate download URLs for CVs
    const enriched = await Promise.all(candidates.map(async (c) => {
      let cvDownloadUrl = null;
      if (c.cvFileKey) {
        cvDownloadUrl = await getDownloadUrl(c.cvFileKey);
      }
      return { ...c, cvDownloadUrl };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch candidates" });
  }
});

router.get("/candidates/:id", async (req, res) => {
  try {
    const candidate = await prisma.candidate.findFirst({
      where: { id: req.params.id, organisationId: req.user.organisationId },
      include: {
        pin: { select: { label: true, type: true } },
        matchResults: {
          orderBy: { createdAt: "desc" },
          include: {
            matchRun: { include: { job: { select: { title: true } } } },
          },
        },
      },
    });
    if (!candidate) return res.status(404).json({ error: "Not found" });
    res.json(candidate);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch candidate" });
  }
});

// ─── Match Runs (admin-triggered) ────────────────────────────────────────────

router.post("/match/:jobId", async (req, res) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.jobId, organisationId: req.user.organisationId },
      include: { organisation: { include: { scoringConfig: true } } },
    });
    if (!job) return res.status(404).json({ error: "Job not found" });

    const candidates = await prisma.candidate.findMany({
      where: {
        organisationId: req.user.organisationId,
        isActive: true,
        profile: { not: null },
      },
    });

    if (candidates.length === 0) {
      return res.status(400).json({ error: "No candidates in CV bank" });
    }

    const topN = job.organisation.scoringConfig?.preFilterTopN || 50;
    const preFiltered = preFilterCandidates(candidates, job, topN);

    const matchRun = await prisma.matchRun.create({
      data: {
        organisationId: req.user.organisationId,
        jobId: job.id,
        triggeredBy: "admin",
        preFilterCount: topN,
        totalCandidates: candidates.length,
        status: "PRE_FILTERING",
      },
    });

    const passedIds = new Set(preFiltered.map((pf) => pf.candidateId));
    const allResults = [
      ...preFiltered.map((pf) => ({
        matchRunId: matchRun.id,
        candidateId: pf.candidateId,
        preFilterScore: pf.preFilterScore,
        passedPreFilter: true,
        analysisStatus: "PENDING",
      })),
      ...candidates.filter((c) => !passedIds.has(c.id)).map((c) => ({
        matchRunId: matchRun.id,
        candidateId: c.id,
        preFilterScore: 0,
        passedPreFilter: false,
        analysisStatus: "PENDING",
      })),
    ];

    await prisma.matchResult.createMany({ data: allResults });

    res.status(201).json({
      matchRunId: matchRun.id,
      totalCandidates: candidates.length,
      preFilterPassed: preFiltered.length,
    });

    runMatchAnalysis(matchRun.id).catch(console.error);
  } catch (err) {
    console.error("[admin] Match error:", err);
    res.status(500).json({ error: "Failed to start match" });
  }
});

router.get("/matches", async (req, res) => {
  try {
    const runs = await prisma.matchRun.findMany({
      where: { organisationId: req.user.organisationId },
      orderBy: { createdAt: "desc" },
      include: {
        job: { select: { title: true, department: true } },
        pin: { select: { label: true } },
        _count: { select: { results: { where: { passedPreFilter: true } } } },
      },
    });
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

router.get("/matches/:id", async (req, res) => {
  try {
    const matchRun = await prisma.matchRun.findFirst({
      where: { id: req.params.id, organisationId: req.user.organisationId },
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
    if (!matchRun) return res.status(404).json({ error: "Not found" });
    res.json(matchRun);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch match" });
  }
});

// ─── Scoring, Prompt, Branding (same as before) ─────────────────────────────

router.get("/scoring", async (req, res) => {
  try {
    let config = await prisma.scoringConfig.findUnique({
      where: { organisationId: req.user.organisationId },
    });
    if (!config) {
      config = { weightSkills: 35, weightExperience: 30, weightQualifications: 20, weightCulturalFit: 15, preFilterTopN: 50 };
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scoring config" });
  }
});

router.put("/scoring", async (req, res) => {
  try {
    const { weightSkills, weightExperience, weightQualifications, weightCulturalFit, preFilterTopN } = req.body;
    const total = (weightSkills || 0) + (weightExperience || 0) + (weightQualifications || 0) + (weightCulturalFit || 0);
    if (total !== 100) return res.status(400).json({ error: "Weights must sum to 100" });

    const config = await prisma.scoringConfig.upsert({
      where: { organisationId: req.user.organisationId },
      create: {
        organisationId: req.user.organisationId,
        weightSkills, weightExperience, weightQualifications, weightCulturalFit,
        preFilterTopN: preFilterTopN || 50,
      },
      update: {
        weightSkills, weightExperience, weightQualifications, weightCulturalFit,
        preFilterTopN: preFilterTopN || 50,
      },
    });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: "Failed to update scoring config" });
  }
});

router.get("/prompt", async (req, res) => {
  try {
    const template = await prisma.promptTemplate.findUnique({
      where: { organisationId: req.user.organisationId },
    });
    res.json(template || {});
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch prompt template" });
  }
});

router.put("/prompt", async (req, res) => {
  try {
    const { companyRole, assessmentFocus, languagePrefs, customInstructions } = req.body;
    const template = await prisma.promptTemplate.upsert({
      where: { organisationId: req.user.organisationId },
      create: { organisationId: req.user.organisationId, companyRole, assessmentFocus, languagePrefs, customInstructions },
      update: { companyRole, assessmentFocus, languagePrefs, customInstructions },
    });
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: "Failed to update prompt template" });
  }
});

router.get("/branding", async (req, res) => {
  try {
    const org = await prisma.organisation.findUnique({ where: { id: req.user.organisationId } });
    res.json({ name: org.name, companyName: org.companyName, logoUrl: org.logoUrl, primaryColor: org.primaryColor, website: org.website });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch branding" });
  }
});

router.put("/branding", logoUpload.single("logo"), async (req, res) => {
  try {
    const data = {};
    if (req.body.name) data.name = req.body.name;
    if (req.body.companyName !== undefined) data.companyName = req.body.companyName;
    if (req.body.primaryColor) data.primaryColor = req.body.primaryColor;
    if (req.body.website !== undefined) data.website = req.body.website;

    if (req.file) {
      const s3Key = `recruitsmart/${req.user.organisationId}/logo-${uuidv4()}.${req.file.originalname.split(".").pop()}`;
      await uploadFile(s3Key, req.file.buffer, req.file.mimetype);
      data.logoS3Key = s3Key;
      data.logoUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    }

    const updated = await prisma.organisation.update({ where: { id: req.user.organisationId }, data });
    res.json({ name: updated.name, companyName: updated.companyName, logoUrl: updated.logoUrl, primaryColor: updated.primaryColor, website: updated.website });
  } catch (err) {
    res.status(500).json({ error: "Failed to update branding" });
  }
});

// ─── Share Links ─────────────────────────────────────────────────────────────

router.get("/share-links", async (req, res) => {
  try {
    const links = await prisma.shareLink.findMany({
      where: { organisationId: req.user.organisationId },
      orderBy: { createdAt: "desc" },
    });
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch share links" });
  }
});

router.post("/share-links", async (req, res) => {
  try {
    const { label, jobId, matchRunId, expiresAt } = req.body;
    const code = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
    const link = await prisma.shareLink.create({
      data: {
        organisationId: req.user.organisationId,
        code, label: label || "Share Link",
        jobId: jobId || null, matchRunId: matchRunId || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    res.status(201).json(link);
  } catch (err) {
    res.status(500).json({ error: "Failed to create share link" });
  }
});

router.delete("/share-links/:id", async (req, res) => {
  try {
    await prisma.shareLink.deleteMany({
      where: { id: req.params.id, organisationId: req.user.organisationId },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete share link" });
  }
});

module.exports = router;
