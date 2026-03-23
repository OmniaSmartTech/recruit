const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { auth } = require("../middleware/auth");

const prisma = new PrismaClient();
const router = express.Router();

router.use(auth);

// POST /api/bulk/move-stage — move multiple candidates to a stage
router.post("/move-stage", async (req, res) => {
  try {
    const { jobCandidateIds, stage, notes } = req.body;
    if (!jobCandidateIds?.length || !stage) {
      return res.status(400).json({ error: "jobCandidateIds and stage required" });
    }

    const userName = req.user.email || "admin";
    let moved = 0;

    for (const id of jobCandidateIds) {
      const jc = await prisma.jobCandidate.findFirst({
        where: { id, organisationId: req.user.organisationId },
      });
      if (!jc) continue;

      const history = Array.isArray(jc.stageHistory) ? jc.stageHistory : [];
      history.push({
        stage,
        movedBy: userName,
        movedAt: new Date().toISOString(),
        notes: notes || "Bulk action",
        previousStage: jc.currentStage,
      });

      await prisma.jobCandidate.update({
        where: { id },
        data: { currentStage: stage, stageHistory: history, assignedBy: userName },
      });
      moved++;
    }

    res.json({ moved });
  } catch (err) {
    console.error("[bulk] Move stage error:", err);
    res.status(500).json({ error: "Failed to move candidates" });
  }
});

// POST /api/bulk/assign-to-job — assign multiple candidates to a job pipeline
router.post("/assign-to-job", async (req, res) => {
  try {
    const { candidateIds, jobId } = req.body;
    if (!candidateIds?.length || !jobId) {
      return res.status(400).json({ error: "candidateIds and jobId required" });
    }

    const userName = req.user.email || "admin";
    let assigned = 0;

    for (const candidateId of candidateIds) {
      try {
        await prisma.jobCandidate.create({
          data: {
            organisationId: req.user.organisationId,
            jobId,
            candidateId,
            currentStage: "APPLIED",
            assignedBy: userName,
            stageHistory: [{ stage: "APPLIED", movedBy: userName, movedAt: new Date().toISOString(), notes: "Bulk assigned" }],
          },
        });
        assigned++;
      } catch (err) {
        // Duplicate — skip
      }
    }

    res.json({ assigned });
  } catch (err) {
    console.error("[bulk] Assign error:", err);
    res.status(500).json({ error: "Failed to assign candidates" });
  }
});

// POST /api/bulk/tag — tag multiple candidates
router.post("/tag", async (req, res) => {
  try {
    const { candidateIds, tagId } = req.body;
    if (!candidateIds?.length || !tagId) {
      return res.status(400).json({ error: "candidateIds and tagId required" });
    }

    let tagged = 0;
    for (const candidateId of candidateIds) {
      try {
        await prisma.candidateTalentTag.create({
          data: { candidateId, tagId, addedBy: req.user.email || "admin" },
        });
        tagged++;
      } catch { /* duplicate */ }
    }

    res.json({ tagged });
  } catch (err) {
    res.status(500).json({ error: "Failed to tag candidates" });
  }
});

module.exports = router;
