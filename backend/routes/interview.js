const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { auth } = require("../middleware/auth");
const { pinAuth } = require("../middleware/pinAuth");
const { v4: uuidv4 } = require("uuid");

const prisma = new PrismaClient();
const router = express.Router();

// Flex auth: SSO or recruiter/interviewer PIN
function flexAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const pinCode = req.headers["x-pin-code"];
  if (authHeader?.startsWith("Bearer ")) return auth(req, res, next);
  if (pinCode) return pinAuth()(req, res, next); // any PIN type
  return res.status(401).json({ error: "Authentication required" });
}

// ─── Schedule interview (admin/recruiter) ────────────────────────────────────

router.post("/", flexAuth, async (req, res) => {
  try {
    const orgId = req.user?.organisationId || req.pin?.organisationId;
    const {
      jobCandidateId, type, title, scheduledAt, durationMinutes,
      location, meetingLink, interviewerName, interviewerEmail, notes,
    } = req.body;

    if (!jobCandidateId || !title) {
      return res.status(400).json({ error: "jobCandidateId and title required" });
    }

    // Create interviewer PIN if email provided
    let interviewerPinId = null;
    if (interviewerEmail) {
      const code = uuidv4().replace(/-/g, "").substring(0, 6).toUpperCase();
      const pin = await prisma.pin.create({
        data: {
          organisationId: orgId,
          code,
          label: `Interviewer: ${interviewerName || interviewerEmail}`,
          type: "INTERVIEWER",
        },
      });
      interviewerPinId = pin.id;
    }

    const interview = await prisma.interview.create({
      data: {
        organisationId: orgId,
        jobCandidateId,
        type: type || "VIDEO",
        title,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        durationMinutes: durationMinutes || 60,
        location: location || null,
        meetingLink: meetingLink || null,
        interviewerName: interviewerName || null,
        interviewerEmail: interviewerEmail || null,
        interviewerPinId,
        notes: notes || null,
      },
      include: { feedback: true },
    });

    res.status(201).json(interview);
  } catch (err) {
    console.error("[interview] Create error:", err);
    res.status(500).json({ error: "Failed to schedule interview" });
  }
});

// ─── List interviews for a pipeline candidate ────────────────────────────────

router.get("/candidate/:jobCandidateId", flexAuth, async (req, res) => {
  try {
    const interviews = await prisma.interview.findMany({
      where: { jobCandidateId: req.params.jobCandidateId },
      include: { feedback: true },
      orderBy: { scheduledAt: { sort: "desc", nulls: "last" } },
    });
    res.json(interviews);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch interviews" });
  }
});

// ─── Update interview ────────────────────────────────────────────────────────

router.patch("/:id", flexAuth, async (req, res) => {
  try {
    const { status, scheduledAt, meetingLink, location, notes } = req.body;
    const data = {};
    if (status) data.status = status;
    if (scheduledAt) data.scheduledAt = new Date(scheduledAt);
    if (meetingLink !== undefined) data.meetingLink = meetingLink;
    if (location !== undefined) data.location = location;
    if (notes !== undefined) data.notes = notes;

    const updated = await prisma.interview.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update interview" });
  }
});

// ─── Interviewer PIN flow ────────────────────────────────────────────────────

// GET /api/interviews/my — get interviews assigned to this interviewer PIN
router.get("/my", pinAuth("INTERVIEWER"), async (req, res) => {
  try {
    const interviews = await prisma.interview.findMany({
      where: { interviewerPinId: req.pin.id },
      include: {
        jobCandidate: {
          include: {
            candidate: { select: { name: true, currentRole: true, skills: true, yearsExp: true } },
            job: { select: { title: true, department: true, description: true, requirements: true } },
          },
        },
        feedback: { where: { submittedBy: req.pin.label } },
      },
      orderBy: { scheduledAt: { sort: "asc", nulls: "last" } },
    });
    res.json(interviews);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch interviews" });
  }
});

// POST /api/interviews/:id/feedback — submit scorecard
router.post("/:id/feedback", flexAuth, async (req, res) => {
  try {
    const submittedBy = req.user?.email || req.pin?.label || "Anonymous";
    const {
      technicalSkills, problemSolving, communication,
      culturalFit, leadership, overallRating,
      strengths, concerns, notes, recommendation,
    } = req.body;

    const feedback = await prisma.interviewFeedback.create({
      data: {
        interviewId: req.params.id,
        technicalSkills: technicalSkills || null,
        problemSolving: problemSolving || null,
        communication: communication || null,
        culturalFit: culturalFit || null,
        leadership: leadership || null,
        overallRating: overallRating || null,
        strengths: strengths || null,
        concerns: concerns || null,
        notes: notes || null,
        recommendation: recommendation || null,
        submittedBy,
      },
    });

    // Mark interview as completed if not already
    await prisma.interview.update({
      where: { id: req.params.id },
      data: { status: "COMPLETED" },
    });

    res.status(201).json(feedback);
  } catch (err) {
    console.error("[interview] Feedback error:", err);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

// GET /api/interviews/:id/feedback — get all feedback for an interview
router.get("/:id/feedback", flexAuth, async (req, res) => {
  try {
    const feedback = await prisma.interviewFeedback.findMany({
      where: { interviewId: req.params.id },
      orderBy: { submittedAt: "desc" },
    });
    res.json(feedback);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

module.exports = router;
