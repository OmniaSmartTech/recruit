const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

/**
 * Public application status portal.
 * Applicants check their status by email — no login required.
 */

// POST /api/status/check — look up applications by email
router.post("/check", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const candidates = await prisma.candidate.findMany({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        name: true,
        createdAt: true,
        organisation: { select: { companyName: true, name: true, logoUrl: true } },
        jobCandidates: {
          select: {
            currentStage: true,
            createdAt: true,
            updatedAt: true,
            job: { select: { title: true, department: true, location: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (candidates.length === 0) {
      return res.status(404).json({ error: "No applications found for this email" });
    }

    // Build a simplified status view — no internal details
    const applications = candidates.flatMap((c) => {
      if (c.jobCandidates.length === 0) {
        return [{
          companyName: c.organisation?.companyName || c.organisation?.name,
          logoUrl: c.organisation?.logoUrl,
          jobTitle: "General Application",
          appliedAt: c.createdAt,
          lastUpdated: c.createdAt,
          status: "UNDER_REVIEW",
          stages: [
            { name: "Applied", completed: true, date: c.createdAt },
            { name: "Under Review", completed: false },
          ],
        }];
      }

      return c.jobCandidates.map((jc) => {
        const stageOrder = [
          "APPLIED", "SCREENING", "SHORTLISTED", "PHONE_SCREEN",
          "INTERVIEW", "ASSESSMENT", "FINAL_INTERVIEW", "OFFER", "HIRED",
        ];
        const currentIdx = stageOrder.indexOf(jc.currentStage);
        const isTerminal = ["REJECTED", "WITHDRAWN"].includes(jc.currentStage);

        // Only show simplified stages to applicant
        const publicStages = [
          { name: "Applied", key: "APPLIED" },
          { name: "Screening", key: "SCREENING" },
          { name: "Shortlisted", key: "SHORTLISTED" },
          { name: "Interview", key: "INTERVIEW" },
          { name: "Decision", key: "OFFER" },
        ];

        return {
          companyName: c.organisation?.companyName || c.organisation?.name,
          logoUrl: c.organisation?.logoUrl,
          jobTitle: jc.job?.title || "Position",
          department: jc.job?.department,
          location: jc.job?.location,
          appliedAt: jc.createdAt,
          lastUpdated: jc.updatedAt,
          status: isTerminal ? jc.currentStage : (currentIdx >= 7 ? "OFFER_STAGE" : "IN_PROGRESS"),
          stages: publicStages.map((ps) => {
            const psIdx = stageOrder.indexOf(ps.key);
            return {
              name: ps.name,
              completed: !isTerminal && currentIdx >= psIdx,
              current: !isTerminal && jc.currentStage === ps.key,
            };
          }),
          isRejected: jc.currentStage === "REJECTED",
          isHired: jc.currentStage === "HIRED",
        };
      });
    });

    res.json({ applications });
  } catch (err) {
    console.error("[status] Check error:", err);
    res.status(500).json({ error: "Failed to check status" });
  }
});

module.exports = router;
