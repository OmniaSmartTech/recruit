const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { auth } = require("../middleware/auth");

const prisma = new PrismaClient();
const router = express.Router();

// All job routes require auth
router.use(auth);

// GET /api/jobs — list jobs for current org
router.get("/", async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { organisationId: req.user.organisationId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { candidates: true } },
      },
    });

    // Enrich with stats
    const enriched = await Promise.all(
      jobs.map(async (job) => {
        const avgScore = await prisma.candidate.aggregate({
          where: { jobId: job.id, matchScore: { not: null } },
          _avg: { matchScore: true },
        });
        return {
          ...job,
          candidateCount: job._count.candidates,
          avgMatchScore: Math.round(avgScore._avg.matchScore || 0),
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error("[jobs] List error:", err);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// GET /api/jobs/:id — get job detail with candidates
router.get("/:id", async (req, res) => {
  try {
    const job = await prisma.job.findFirst({
      where: {
        id: req.params.id,
        organisationId: req.user.organisationId,
      },
      include: {
        candidates: {
          orderBy: { matchScore: { sort: "desc", nulls: "last" } },
          select: {
            id: true,
            name: true,
            email: true,
            cvFileName: true,
            status: true,
            matchScore: true,
            analyisStatus: true,
            createdAt: true,
            analysis: true,
          },
        },
      },
    });

    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (err) {
    console.error("[jobs] Detail error:", err);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

// POST /api/jobs — create job
router.post("/", async (req, res) => {
  try {
    const {
      title, department, description, requirements,
      salaryRange, location, workMode, experienceLevel, teamNotes, status,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }

    const job = await prisma.job.create({
      data: {
        organisationId: req.user.organisationId,
        title,
        department: department || null,
        description,
        requirements: requirements || { mustHave: [], niceToHave: [] },
        salaryRange: salaryRange || null,
        location: location || null,
        workMode: workMode || "HYBRID",
        experienceLevel: experienceLevel || null,
        teamNotes: teamNotes || null,
        status: status || "OPEN",
      },
    });

    res.status(201).json(job);
  } catch (err) {
    console.error("[jobs] Create error:", err);
    res.status(500).json({ error: "Failed to create job" });
  }
});

// PATCH /api/jobs/:id — update job
router.patch("/:id", async (req, res) => {
  try {
    const existing = await prisma.job.findFirst({
      where: { id: req.params.id, organisationId: req.user.organisationId },
    });
    if (!existing) return res.status(404).json({ error: "Job not found" });

    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json(updated);
  } catch (err) {
    console.error("[jobs] Update error:", err);
    res.status(500).json({ error: "Failed to update job" });
  }
});

// DELETE /api/jobs/:id — delete job (cascades candidates)
router.delete("/:id", async (req, res) => {
  try {
    const existing = await prisma.job.findFirst({
      where: { id: req.params.id, organisationId: req.user.organisationId },
    });
    if (!existing) return res.status(404).json({ error: "Job not found" });

    await prisma.job.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error("[jobs] Delete error:", err);
    res.status(500).json({ error: "Failed to delete job" });
  }
});

module.exports = router;
