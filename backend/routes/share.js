const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { shareAuth } = require("../middleware/shareAuth");

const prisma = new PrismaClient();
const router = express.Router();

// POST /api/share/validate — validate a share code
router.post("/validate", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Code required" });

  try {
    const link = await prisma.shareLink.findUnique({
      where: { code: code.toUpperCase() },
      include: { organisation: true },
    });

    if (!link || !link.isActive) {
      return res.status(404).json({ error: "Invalid share code" });
    }

    if (link.expiresAt && new Date() > link.expiresAt) {
      return res.status(410).json({ error: "This share link has expired" });
    }

    res.json({
      valid: true,
      orgName: link.organisation.companyName || link.organisation.name,
      logoUrl: link.organisation.logoUrl,
      primaryColor: link.organisation.primaryColor,
    });
  } catch (err) {
    res.status(500).json({ error: "Validation failed" });
  }
});

// GET /api/share/jobs — list jobs visible via share link
router.get("/jobs", shareAuth, async (req, res) => {
  try {
    const where = {
      organisationId: req.share.organisationId,
      status: "OPEN",
    };
    if (req.share.jobId) {
      where.id = req.share.jobId;
    }

    const jobs = await prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        candidates: {
          where: {
            analyisStatus: "COMPLETED",
            status: { in: ["SHORTLISTED", "INTERVIEWING", "OFFERED"] },
          },
          orderBy: { matchScore: "desc" },
          select: {
            id: true,
            name: true,
            matchScore: true,
            status: true,
            analysis: true,
            createdAt: true,
          },
        },
      },
    });

    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// GET /api/share/candidates/:id — candidate detail via share link
router.get("/candidates/:id", shareAuth, async (req, res) => {
  try {
    const candidate = await prisma.candidate.findFirst({
      where: {
        id: req.params.id,
        organisationId: req.share.organisationId,
        status: { in: ["SHORTLISTED", "INTERVIEWING", "OFFERED"] },
      },
      include: { job: true },
    });

    if (!candidate) return res.status(404).json({ error: "Candidate not found" });

    // Filter out internal-only fields for hiring manager view
    const { cvText, cvFileKey, ...safe } = candidate;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch candidate" });
  }
});

module.exports = router;
