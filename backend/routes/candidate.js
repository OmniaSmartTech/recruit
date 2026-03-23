const express = require("express");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const { auth } = require("../middleware/auth");
const { parseCv } = require("../services/cvParser");
const { analyzeCandidate, generateInterviewQuestions } = require("../services/analyzer");
const { generateCandidateReport } = require("../services/pdfReport");
const { uploadFile } = require("../utils/s3");
const { v4: uuidv4 } = require("uuid");

const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, DOC, and TXT files are accepted"));
    }
  },
});

router.use(auth);

// POST /api/candidates/upload/:jobId — upload one or more CVs
router.post("/upload/:jobId", upload.array("cvs", 50), async (req, res) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.jobId, organisationId: req.user.organisationId },
    });
    if (!job) return res.status(404).json({ error: "Job not found" });

    if (!req.files?.length) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const candidates = [];

    for (const file of req.files) {
      try {
        // Parse CV text
        const cvText = await parseCv(file.buffer, file.originalname);

        // Extract name from filename (fallback)
        const nameFromFile = file.originalname
          .replace(/\.(pdf|docx?|txt)$/i, "")
          .replace(/[-_]/g, " ")
          .replace(/cv|resume|curriculum.vitae/gi, "")
          .trim() || "Unknown Candidate";

        // Upload to S3
        const s3Key = `recruitsmart/${req.user.organisationId}/${job.id}/${uuidv4()}-${file.originalname}`;
        await uploadFile(s3Key, file.buffer, file.mimetype);

        // Create candidate record
        const candidate = await prisma.candidate.create({
          data: {
            organisationId: req.user.organisationId,
            jobId: job.id,
            name: nameFromFile,
            cvFileKey: s3Key,
            cvFileName: file.originalname,
            cvText,
            status: "NEW",
            analyisStatus: "PENDING",
          },
        });

        candidates.push(candidate);

        // Kick off analysis in background
        analyzeCandidate(candidate.id).catch((err) =>
          console.error(`[upload] Background analysis failed for ${candidate.id}:`, err)
        );
      } catch (parseErr) {
        console.error(`[upload] Failed to process ${file.originalname}:`, parseErr);
        candidates.push({
          error: true,
          filename: file.originalname,
          message: parseErr.message,
        });
      }
    }

    res.status(201).json({
      uploaded: candidates.filter((c) => !c.error).length,
      failed: candidates.filter((c) => c.error).length,
      candidates,
    });
  } catch (err) {
    console.error("[candidates] Upload error:", err);
    res.status(500).json({ error: "Failed to upload CVs" });
  }
});

// GET /api/candidates/:id — get candidate detail with full analysis
router.get("/:id", async (req, res) => {
  try {
    const candidate = await prisma.candidate.findFirst({
      where: {
        id: req.params.id,
        organisationId: req.user.organisationId,
      },
      include: { job: true },
    });

    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    res.json(candidate);
  } catch (err) {
    console.error("[candidates] Detail error:", err);
    res.status(500).json({ error: "Failed to fetch candidate" });
  }
});

// PATCH /api/candidates/:id — update candidate status
router.patch("/:id", async (req, res) => {
  try {
    const existing = await prisma.candidate.findFirst({
      where: { id: req.params.id, organisationId: req.user.organisationId },
    });
    if (!existing) return res.status(404).json({ error: "Candidate not found" });

    const { status, name, email, phone } = req.body;
    const data = {};
    if (status) data.status = status;
    if (name) data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;

    const updated = await prisma.candidate.update({
      where: { id: req.params.id },
      data,
    });

    res.json(updated);
  } catch (err) {
    console.error("[candidates] Update error:", err);
    res.status(500).json({ error: "Failed to update candidate" });
  }
});

// POST /api/candidates/:id/reanalyze — re-run AI analysis
router.post("/:id/reanalyze", async (req, res) => {
  try {
    const existing = await prisma.candidate.findFirst({
      where: { id: req.params.id, organisationId: req.user.organisationId },
    });
    if (!existing) return res.status(404).json({ error: "Candidate not found" });

    await prisma.candidate.update({
      where: { id: req.params.id },
      data: { analyisStatus: "PENDING", analysis: null, matchScore: null },
    });

    analyzeCandidate(req.params.id).catch(console.error);

    res.json({ success: true, message: "Re-analysis started" });
  } catch (err) {
    res.status(500).json({ error: "Failed to start re-analysis" });
  }
});

// GET /api/candidates/:id/interview-questions — generate interview questions
router.get("/:id/interview-questions", async (req, res) => {
  try {
    const candidate = await prisma.candidate.findFirst({
      where: { id: req.params.id, organisationId: req.user.organisationId },
    });
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    if (!candidate.analysis) return res.status(400).json({ error: "Analysis not complete yet" });

    const questions = await generateInterviewQuestions(req.params.id);
    res.json(questions);
  } catch (err) {
    console.error("[candidates] Interview questions error:", err);
    res.status(500).json({ error: "Failed to generate interview questions" });
  }
});

// GET /api/candidates/:id/pdf — download candidate report PDF
router.get("/:id/pdf", async (req, res) => {
  try {
    const candidate = await prisma.candidate.findFirst({
      where: { id: req.params.id, organisationId: req.user.organisationId },
      include: {
        job: { include: { organisation: true } },
      },
    });

    if (!candidate) return res.status(404).json({ error: "Candidate not found" });

    const external = req.query.type === "external";
    const pdfBuffer = await generateCandidateReport(
      candidate, candidate.job, candidate.job.organisation, { external }
    );

    const safeName = candidate.name.replace(/[^a-zA-Z0-9]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_report.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("[candidates] PDF error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// DELETE /api/candidates/:id
router.delete("/:id", async (req, res) => {
  try {
    const existing = await prisma.candidate.findFirst({
      where: { id: req.params.id, organisationId: req.user.organisationId },
    });
    if (!existing) return res.status(404).json({ error: "Candidate not found" });

    await prisma.candidate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete candidate" });
  }
});

// POST /api/candidates/compare — compare multiple candidates
router.post("/compare", async (req, res) => {
  try {
    const { candidateIds } = req.body;
    if (!candidateIds?.length || candidateIds.length < 2) {
      return res.status(400).json({ error: "At least 2 candidate IDs required" });
    }

    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: candidateIds },
        organisationId: req.user.organisationId,
      },
      include: { job: true },
      orderBy: { matchScore: { sort: "desc", nulls: "last" } },
    });

    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: "Failed to compare candidates" });
  }
});

module.exports = router;
