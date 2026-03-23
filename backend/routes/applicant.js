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
