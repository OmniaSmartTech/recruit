const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { auth } = require("../middleware/auth");
const { pinAuth } = require("../middleware/pinAuth");

const prisma = new PrismaClient();
const router = express.Router();

const PIPELINE_STAGES = [
  "APPLIED", "SCREENING", "SHORTLISTED", "PHONE_SCREEN",
  "INTERVIEW", "ASSESSMENT", "FINAL_INTERVIEW", "OFFER", "HIRED",
  "REJECTED", "WITHDRAWN",
];

const DEFAULT_TEMPLATES = {
  APPLIED: {
    name: "Applied",
    emailSubject: "Thank you for applying — {{jobTitle}}",
    emailBody: `Dear {{candidateName}},

Thank you for submitting your application for the {{jobTitle}} position at {{companyName}}.

We have received your CV and our team will review it shortly. We aim to get back to all applicants within 5 working days.

If you have any questions in the meantime, please don't hesitate to reach out.

Best regards,
{{companyName}} Recruitment Team`,
  },
  SHORTLISTED: {
    name: "Shortlisted",
    emailSubject: "Great news — your application for {{jobTitle}}",
    emailBody: `Dear {{candidateName}},

We're pleased to let you know that your application for {{jobTitle}} has been shortlisted.

We were impressed by your background and would like to progress your application to the next stage.

We'll be in touch shortly to arrange the next steps.

Best regards,
{{companyName}} Recruitment Team`,
  },
  PHONE_SCREEN: {
    name: "Phone Screen",
    emailSubject: "Phone screen invitation — {{jobTitle}}",
    emailBody: `Dear {{candidateName}},

We'd like to arrange a brief phone call to discuss your application for {{jobTitle}} and learn more about your experience.

The call will last approximately 20-30 minutes. Please let us know your availability over the next few days.

Best regards,
{{companyName}} Recruitment Team`,
  },
  INTERVIEW: {
    name: "Interview",
    emailSubject: "Interview invitation — {{jobTitle}}",
    emailBody: `Dear {{candidateName}},

We'd like to invite you for an interview for the {{jobTitle}} position.

Please let us know your availability and we'll confirm the details.

Best regards,
{{companyName}} Recruitment Team`,
  },
  ASSESSMENT: {
    name: "Assessment",
    emailSubject: "Assessment task — {{jobTitle}}",
    emailBody: `Dear {{candidateName}},

As part of the recruitment process for {{jobTitle}}, we'd like you to complete a short assessment task.

Please find the details below and submit your work within the timeframe specified.

Best regards,
{{companyName}} Recruitment Team`,
  },
  FINAL_INTERVIEW: {
    name: "Final Interview",
    emailSubject: "Final interview — {{jobTitle}}",
    emailBody: `Dear {{candidateName}},

Congratulations on reaching the final stage of the interview process for {{jobTitle}}.

We'd like to invite you for a final interview. Please let us know your availability.

Best regards,
{{companyName}} Recruitment Team`,
  },
  OFFER: {
    name: "Offer",
    emailSubject: "Job offer — {{jobTitle}}",
    emailBody: `Dear {{candidateName}},

We are delighted to offer you the position of {{jobTitle}} at {{companyName}}.

We believe you'll be a fantastic addition to our team. Please find the offer details below and let us know if you have any questions.

We look forward to hearing from you.

Best regards,
{{companyName}} Recruitment Team`,
  },
  HIRED: {
    name: "Hired",
    emailSubject: "Welcome aboard — {{jobTitle}}",
    emailBody: `Dear {{candidateName}},

Welcome to {{companyName}}! We're thrilled you've accepted the {{jobTitle}} position.

We'll be in touch shortly with onboarding details and your start date information.

Best regards,
{{companyName}} Recruitment Team`,
  },
  REJECTED: {
    name: "Rejected",
    emailSubject: "Your application for {{jobTitle}}",
    emailBody: `Dear {{candidateName}},

Thank you for your interest in the {{jobTitle}} position at {{companyName}} and for the time you invested in the application process.

After careful consideration, we've decided to move forward with other candidates whose experience more closely matches our current requirements.

We encourage you to apply for future openings that match your skills and experience. We wish you every success in your career.

Best regards,
{{companyName}} Recruitment Team`,
  },
};

/**
 * Render a template with variable substitution.
 */
function renderTemplate(template, variables) {
  if (!template) return "";
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
}

// ─── Auth-protected routes (admin + recruiter PIN) ───────────────────────────

// Helper middleware: accept either SSO auth or recruiter PIN
function flexAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const pinCode = req.headers["x-pin-code"];

  if (authHeader?.startsWith("Bearer ")) {
    return auth(req, res, next);
  } else if (pinCode) {
    return pinAuth("RECRUITER")(req, res, next);
  }
  return res.status(401).json({ error: "Authentication required" });
}

// GET /api/pipeline/board/:jobId — kanban board data
router.get("/board/:jobId", flexAuth, async (req, res) => {
  try {
    const orgId = req.user?.organisationId || req.pin?.organisationId;

    const jobCandidates = await prisma.jobCandidate.findMany({
      where: { jobId: req.params.jobId, organisationId: orgId },
      include: {
        candidate: {
          select: { id: true, name: true, email: true, currentRole: true, skills: true, yearsExp: true, cvFileName: true },
        },
        communications: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Group by stage
    const board = {};
    for (const stage of PIPELINE_STAGES) {
      board[stage] = [];
    }
    for (const jc of jobCandidates) {
      if (board[jc.currentStage]) {
        board[jc.currentStage].push(jc);
      }
    }

    res.json({ board, total: jobCandidates.length });
  } catch (err) {
    console.error("[pipeline] Board error:", err);
    res.status(500).json({ error: "Failed to fetch board" });
  }
});

// POST /api/pipeline/assign — assign candidate(s) to job pipeline
router.post("/assign", flexAuth, async (req, res) => {
  try {
    const orgId = req.user?.organisationId || req.pin?.organisationId;
    const userName = req.user?.email || req.pin?.label || "System";
    const { jobId, candidateIds, matchResultId, matchScore } = req.body;

    if (!jobId || !candidateIds?.length) {
      return res.status(400).json({ error: "jobId and candidateIds required" });
    }

    const results = [];
    for (const candidateId of candidateIds) {
      try {
        const jc = await prisma.jobCandidate.upsert({
          where: { jobId_candidateId: { jobId, candidateId } },
          create: {
            organisationId: orgId,
            jobId,
            candidateId,
            matchResultId: matchResultId || null,
            matchScore: matchScore || null,
            currentStage: "APPLIED",
            assignedBy: userName,
            stageHistory: [{ stage: "APPLIED", movedBy: userName, movedAt: new Date().toISOString(), notes: "Assigned to pipeline" }],
          },
          update: {}, // don't overwrite if already exists
        });
        results.push(jc);
      } catch (err) {
        // Likely duplicate — skip
      }
    }

    res.status(201).json({ assigned: results.length });
  } catch (err) {
    console.error("[pipeline] Assign error:", err);
    res.status(500).json({ error: "Failed to assign candidates" });
  }
});

// PATCH /api/pipeline/:id/stage — move candidate to new stage
router.patch("/:id/stage", flexAuth, async (req, res) => {
  try {
    const orgId = req.user?.organisationId || req.pin?.organisationId;
    const userName = req.user?.email || req.pin?.label || "System";
    const { stage, notes, rejectionReason, withdrawnReason, offerDetails } = req.body;

    if (!stage || !PIPELINE_STAGES.includes(stage)) {
      return res.status(400).json({ error: "Invalid stage" });
    }

    const jc = await prisma.jobCandidate.findFirst({
      where: { id: req.params.id, organisationId: orgId },
    });
    if (!jc) return res.status(404).json({ error: "Not found" });

    const history = Array.isArray(jc.stageHistory) ? jc.stageHistory : [];
    history.push({
      stage,
      movedBy: userName,
      movedAt: new Date().toISOString(),
      notes: notes || null,
      previousStage: jc.currentStage,
    });

    const data = {
      currentStage: stage,
      stageHistory: history,
      assignedBy: userName,
    };
    if (notes) data.notes = notes;
    if (rejectionReason) data.rejectionReason = rejectionReason;
    if (withdrawnReason) data.withdrawnReason = withdrawnReason;
    if (offerDetails) data.offerDetails = offerDetails;

    const updated = await prisma.jobCandidate.update({
      where: { id: req.params.id },
      data,
      include: {
        candidate: { select: { id: true, name: true, email: true, currentRole: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("[pipeline] Stage update error:", err);
    res.status(500).json({ error: "Failed to update stage" });
  }
});

// POST /api/pipeline/:id/communicate — compose email for candidate
router.post("/:id/communicate", flexAuth, async (req, res) => {
  try {
    const orgId = req.user?.organisationId || req.pin?.organisationId;
    const userName = req.user?.email || req.pin?.label || "System";
    const { subject, body, status } = req.body;

    const jc = await prisma.jobCandidate.findFirst({
      where: { id: req.params.id, organisationId: orgId },
      include: {
        candidate: { select: { name: true, email: true } },
      },
    });
    if (!jc) return res.status(404).json({ error: "Not found" });

    const comm = await prisma.communication.create({
      data: {
        jobCandidateId: jc.id,
        channel: "EMAIL",
        templateKey: req.body.templateKey || null,
        subject,
        body,
        sentTo: jc.candidate.email || null,
        sentBy: userName,
        status: status || "DRAFT",
      },
    });

    res.status(201).json(comm);
  } catch (err) {
    console.error("[pipeline] Communicate error:", err);
    res.status(500).json({ error: "Failed to save communication" });
  }
});

// GET /api/pipeline/:id/communications — get comms history
router.get("/:id/communications", flexAuth, async (req, res) => {
  try {
    const orgId = req.user?.organisationId || req.pin?.organisationId;
    const jc = await prisma.jobCandidate.findFirst({
      where: { id: req.params.id, organisationId: orgId },
    });
    if (!jc) return res.status(404).json({ error: "Not found" });

    const comms = await prisma.communication.findMany({
      where: { jobCandidateId: jc.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(comms);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch communications" });
  }
});

// GET /api/pipeline/template/:stage — get email template for a stage
router.get("/template/:stage", flexAuth, async (req, res) => {
  try {
    const orgId = req.user?.organisationId || req.pin?.organisationId;
    const stage = req.params.stage;

    // Try org-specific template first
    let template = await prisma.stageTemplate.findUnique({
      where: { organisationId_stage: { organisationId: orgId, stage } },
    });

    if (!template) {
      // Fall back to defaults
      const def = DEFAULT_TEMPLATES[stage];
      if (def) {
        template = { stage, ...def };
      }
    }

    if (!template) return res.status(404).json({ error: "No template for this stage" });

    // Get variables for rendering preview
    const { jobCandidateId, jobTitle } = req.query;
    const org = await prisma.organisation.findUnique({ where: { id: orgId } });

    let variables = {
      companyName: org?.companyName || org?.name || "Company",
      jobTitle: jobTitle || "the position",
      candidateName: "Candidate",
    };

    if (jobCandidateId) {
      const jc = await prisma.jobCandidate.findFirst({
        where: { id: jobCandidateId, organisationId: orgId },
        include: {
          candidate: { select: { name: true, email: true } },
          job: { select: { title: true } },
        },
      });
      if (jc) {
        variables.candidateName = jc.candidate.name;
        variables.jobTitle = jc.job?.title || jobTitle || "the position";
      }
    }

    res.json({
      stage: template.stage,
      name: template.name,
      subject: renderTemplate(template.emailSubject, variables),
      body: renderTemplate(template.emailBody, variables),
      rawSubject: template.emailSubject,
      rawBody: template.emailBody,
    });
  } catch (err) {
    console.error("[pipeline] Template error:", err);
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

// ─── Admin: stage template management ────────────────────────────────────────

router.get("/templates", auth, async (req, res) => {
  try {
    const orgId = req.user.organisationId;
    const templates = await prisma.stageTemplate.findMany({
      where: { organisationId: orgId },
      orderBy: { sortOrder: "asc" },
    });

    // Merge with defaults for stages that don't have custom templates
    const result = PIPELINE_STAGES.filter((s) => s !== "WITHDRAWN").map((stage, i) => {
      const custom = templates.find((t) => t.stage === stage);
      const def = DEFAULT_TEMPLATES[stage];
      return custom || {
        id: null,
        stage,
        name: def?.name || stage.charAt(0) + stage.slice(1).toLowerCase().replace(/_/g, " "),
        emailSubject: def?.emailSubject || null,
        emailBody: def?.emailBody || null,
        isActive: true,
        sortOrder: i,
        isDefault: true,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.put("/templates/:stage", auth, async (req, res) => {
  try {
    const orgId = req.user.organisationId;
    const { name, emailSubject, emailBody, isActive, sortOrder } = req.body;

    const template = await prisma.stageTemplate.upsert({
      where: { organisationId_stage: { organisationId: orgId, stage: req.params.stage } },
      create: {
        organisationId: orgId,
        stage: req.params.stage,
        name: name || req.params.stage,
        emailSubject, emailBody,
        isActive: isActive !== false,
        sortOrder: sortOrder || 0,
      },
      update: { name, emailSubject, emailBody, isActive, sortOrder },
    });

    res.json(template);
  } catch (err) {
    res.status(500).json({ error: "Failed to update template" });
  }
});

module.exports = router;
