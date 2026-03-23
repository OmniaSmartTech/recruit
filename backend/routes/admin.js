const express = require("express");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const { auth, requireAdmin } = require("../middleware/auth");
const { uploadFile } = require("../utils/s3");
const { v4: uuidv4 } = require("uuid");

const prisma = new PrismaClient();
const router = express.Router();
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(auth);

// GET /api/admin/stats — dashboard stats
router.get("/stats", async (req, res) => {
  try {
    const orgId = req.user.organisationId;

    const [totalJobs, openJobs, totalCandidates, avgScore, recentCandidates, statusBreakdown] =
      await Promise.all([
        prisma.job.count({ where: { organisationId: orgId } }),
        prisma.job.count({ where: { organisationId: orgId, status: "OPEN" } }),
        prisma.candidate.count({ where: { organisationId: orgId } }),
        prisma.candidate.aggregate({
          where: { organisationId: orgId, matchScore: { not: null } },
          _avg: { matchScore: true },
        }),
        prisma.candidate.count({
          where: {
            organisationId: orgId,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.candidate.groupBy({
          by: ["status"],
          where: { organisationId: orgId },
          _count: true,
        }),
      ]);

    // Top scoring candidates
    const topCandidates = await prisma.candidate.findMany({
      where: { organisationId: orgId, matchScore: { not: null } },
      orderBy: { matchScore: "desc" },
      take: 10,
      include: { job: { select: { title: true } } },
    });

    res.json({
      totalJobs,
      openJobs,
      totalCandidates,
      avgMatchScore: Math.round(avgScore._avg.matchScore || 0),
      recentCandidates,
      statusBreakdown: statusBreakdown.reduce((acc, s) => {
        acc[s.status] = s._count;
        return acc;
      }, {}),
      topCandidates,
    });
  } catch (err) {
    console.error("[admin] Stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// --- Share Links ---

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
    const { label, jobId, expiresAt } = req.body;
    const code = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();

    const link = await prisma.shareLink.create({
      data: {
        organisationId: req.user.organisationId,
        code,
        label: label || "Share Link",
        jobId: jobId || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    res.status(201).json(link);
  } catch (err) {
    res.status(500).json({ error: "Failed to create share link" });
  }
});

router.patch("/share-links/:id", async (req, res) => {
  try {
    const existing = await prisma.shareLink.findFirst({
      where: { id: req.params.id, organisationId: req.user.organisationId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const updated = await prisma.shareLink.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update share link" });
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

// --- Scoring Config ---

router.get("/scoring", async (req, res) => {
  try {
    let config = await prisma.scoringConfig.findUnique({
      where: { organisationId: req.user.organisationId },
    });
    if (!config) {
      config = { weightSkills: 35, weightExperience: 30, weightQualifications: 20, weightCulturalFit: 15 };
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scoring config" });
  }
});

router.put("/scoring", async (req, res) => {
  try {
    const { weightSkills, weightExperience, weightQualifications, weightCulturalFit, customCriteria } = req.body;
    const total = (weightSkills || 0) + (weightExperience || 0) + (weightQualifications || 0) + (weightCulturalFit || 0);
    if (total !== 100) {
      return res.status(400).json({ error: "Weights must sum to 100" });
    }

    const config = await prisma.scoringConfig.upsert({
      where: { organisationId: req.user.organisationId },
      create: {
        organisationId: req.user.organisationId,
        weightSkills, weightExperience, weightQualifications, weightCulturalFit,
        customCriteria: customCriteria || null,
      },
      update: {
        weightSkills, weightExperience, weightQualifications, weightCulturalFit,
        customCriteria: customCriteria || null,
      },
    });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: "Failed to update scoring config" });
  }
});

// --- Prompt Template ---

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
      create: {
        organisationId: req.user.organisationId,
        companyRole, assessmentFocus, languagePrefs, customInstructions,
      },
      update: { companyRole, assessmentFocus, languagePrefs, customInstructions },
    });
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: "Failed to update prompt template" });
  }
});

// --- Branding ---

router.get("/branding", async (req, res) => {
  try {
    const org = await prisma.organisation.findUnique({
      where: { id: req.user.organisationId },
    });
    res.json({
      name: org.name,
      companyName: org.companyName,
      logoUrl: org.logoUrl,
      primaryColor: org.primaryColor,
      website: org.website,
    });
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

    const updated = await prisma.organisation.update({
      where: { id: req.user.organisationId },
      data,
    });

    res.json({
      name: updated.name,
      companyName: updated.companyName,
      logoUrl: updated.logoUrl,
      primaryColor: updated.primaryColor,
      website: updated.website,
    });
  } catch (err) {
    console.error("[admin] Branding error:", err);
    res.status(500).json({ error: "Failed to update branding" });
  }
});

module.exports = router;
