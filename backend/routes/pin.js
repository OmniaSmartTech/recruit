const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

// POST /api/pin/validate — validate a PIN code and return its type + org info
router.post("/validate", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "PIN code required" });

  try {
    const pin = await prisma.pin.findUnique({
      where: { code: code.toUpperCase() },
      include: { organisation: true },
    });

    if (!pin || !pin.isActive) {
      return res.status(404).json({ error: "Invalid PIN code" });
    }

    res.json({
      valid: true,
      type: pin.type, // RECRUITER or APPLICANT
      orgName: pin.organisation.companyName || pin.organisation.name,
      logoUrl: pin.organisation.logoUrl,
      primaryColor: pin.organisation.primaryColor,
      jobId: pin.jobId, // null for recruiter PINs or org-wide applicant PINs
    });
  } catch (err) {
    res.status(500).json({ error: "Validation failed" });
  }
});

module.exports = router;
