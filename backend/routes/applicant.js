const express = require("express");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const { pinAuth } = require("../middleware/pinAuth");
const { parseCv } = require("../services/cvParser");
const { extractAnonymisedProfile, buildProfileFromForm } = require("../services/anonymiser");
const { uploadFile } = require("../utils/s3");
const { v4: uuidv4 } = require("uuid");

const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF, DOCX, DOC, and TXT files are accepted"));
  },
});

// All applicant routes require APPLICANT PIN
router.use(pinAuth("APPLICANT"));

/**
 * POST /api/applicant/parse-cv
 *
 * Parse a CV and return extracted fields for form pre-population.
 * Does NOT save anything — just extracts and returns.
 */
router.post("/parse-cv", upload.single("cv"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const cvText = await parseCv(req.file.buffer, req.file.originalname);

    // Use Claude to extract structured fields from the CV
    const Anthropic = require("@anthropic-ai/sdk").default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Extract structured information from this CV. Return ONLY a JSON object.

CV TEXT:
${cvText.substring(0, 6000)}

Return this exact JSON structure (use null for fields you can't find):
{
  "name": "Full name",
  "email": "Email address",
  "phone": "Phone number",
  "currentRole": "Current or most recent job title",
  "currentCompany": "Current or most recent employer",
  "yearsExp": <number of years experience or null>,
  "skills": ["skill1", "skill2", ...],
  "suggestedSkills": ["additional common skills in this field that the candidate likely has based on their experience"],
  "certifications": ["cert1", "cert2"],
  "education": [{"level": "BSc/MSc/etc", "field": "Subject", "classification": "Grade or null"}],
  "linkedinUrl": "LinkedIn URL if found or null",
  "portfolioUrl": "Portfolio/GitHub URL if found or null"
}

Return ONLY valid JSON.`,
      }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Failed to parse CV" });
    }

    const extracted = JSON.parse(jsonMatch[0]);
    res.json(extracted);
  } catch (err) {
    console.error("[applicant] CV parse error:", err);
    res.status(500).json({ error: "Failed to parse CV. You can fill in the form manually." });
  }
});

/**
 * POST /api/applicant/upload
 *
 * Applicant uploads CV + fills form.
 * CV is parsed → anonymised profile created → stored in CV bank.
 */
router.post("/upload", upload.single("cv"), async (req, res) => {
  try {
    const candidateId = uuidv4();

    // Parse form data
    const {
      name, email, phone, currentRole, currentCompany,
      noticePeriod, rightToWork, linkedinUrl, portfolioUrl,
      desiredSalaryMin, desiredSalaryMax, desiredSalaryCurrency,
      workPreference, yearsExp,
    } = req.body;

    // Parse JSON fields that come as strings
    let skills = [];
    let education = [];
    let certifications = [];
    try { skills = JSON.parse(req.body.skills || "[]"); } catch { skills = []; }
    try { education = JSON.parse(req.body.education || "[]"); } catch { education = []; }
    try { certifications = JSON.parse(req.body.certifications || "[]"); } catch { certifications = []; }

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    // Upload CV to S3 if provided
    let cvFileKey = null;
    let cvFileName = null;
    let cvText = null;

    if (req.file) {
      cvFileName = req.file.originalname;
      cvText = await parseCv(req.file.buffer, cvFileName);

      const s3Key = `recruitsmart/${req.pin.organisationId}/cvs/${candidateId}-${cvFileName}`;
      await uploadFile(s3Key, req.file.buffer, req.file.mimetype);
      cvFileKey = s3Key;
    }

    // Build form data for profile extraction
    const formData = {
      skills,
      yearsExp: yearsExp ? parseInt(yearsExp) : null,
      education,
      certifications,
      workPreference: workPreference || null,
      noticePeriod: noticePeriod || null,
      desiredSalary: desiredSalaryMin ? {
        min: parseInt(desiredSalaryMin),
        max: parseInt(desiredSalaryMax) || parseInt(desiredSalaryMin),
        currency: desiredSalaryCurrency || "GBP",
      } : null,
    };

    // Extract anonymised profile (AI-powered if CV text available)
    let profile;
    try {
      if (cvText) {
        profile = await extractAnonymisedProfile(candidateId, cvText, formData);
      } else {
        profile = buildProfileFromForm(candidateId, formData);
      }
    } catch (err) {
      console.error("[applicant] Profile extraction failed, using form data:", err);
      profile = buildProfileFromForm(candidateId, formData);
    }

    // Create candidate record — PII in candidate, anonymised profile separate
    const candidate = await prisma.candidate.create({
      data: {
        id: candidateId,
        organisationId: req.pin.organisationId,
        pinId: req.pin.id,
        name,
        email: email || null,
        phone: phone || null,
        currentRole: currentRole || null,
        currentCompany: currentCompany || null,
        noticePeriod: noticePeriod || null,
        rightToWork: rightToWork || null,
        linkedinUrl: linkedinUrl || null,
        portfolioUrl: portfolioUrl || null,
        desiredSalary: formData.desiredSalary,
        workPreference: workPreference || null,
        cvFileKey,
        cvFileName,
        profile, // anonymised — safe for AI
        skills,
        yearsExp: formData.yearsExp,
        education,
        certifications,
      },
    });

    res.status(201).json({
      success: true,
      message: "Your application has been submitted successfully",
      candidateId: candidate.id,
    });
  } catch (err) {
    console.error("[applicant] Upload error:", err);
    res.status(500).json({ error: "Failed to submit application" });
  }
});

module.exports = router;
