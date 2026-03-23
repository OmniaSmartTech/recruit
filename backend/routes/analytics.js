const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { auth } = require("../middleware/auth");

const prisma = new PrismaClient();
const router = express.Router();

router.use(auth);

// GET /api/analytics/pipeline — pipeline conversion rates and time-in-stage
router.get("/pipeline", async (req, res) => {
  try {
    const orgId = req.user.organisationId;

    // Stage distribution
    const stageDistribution = await prisma.jobCandidate.groupBy({
      by: ["currentStage"],
      where: { organisationId: orgId },
      _count: true,
    });

    // Time to hire (avg days from APPLIED to HIRED)
    const hired = await prisma.jobCandidate.findMany({
      where: { organisationId: orgId, currentStage: "HIRED" },
      select: { createdAt: true, updatedAt: true },
    });
    const avgTimeToHire = hired.length > 0
      ? Math.round(hired.reduce((sum, h) => sum + ((h.updatedAt.getTime() - h.createdAt.getTime()) / (1000 * 60 * 60 * 24)), 0) / hired.length)
      : null;

    // Conversion rates (approximate from current state)
    const total = await prisma.jobCandidate.count({ where: { organisationId: orgId } });
    const shortlisted = await prisma.jobCandidate.count({
      where: { organisationId: orgId, currentStage: { in: ["SHORTLISTED", "PHONE_SCREEN", "INTERVIEW", "ASSESSMENT", "FINAL_INTERVIEW", "OFFER", "HIRED"] } },
    });
    const interviewed = await prisma.jobCandidate.count({
      where: { organisationId: orgId, currentStage: { in: ["INTERVIEW", "ASSESSMENT", "FINAL_INTERVIEW", "OFFER", "HIRED"] } },
    });
    const offered = await prisma.jobCandidate.count({
      where: { organisationId: orgId, currentStage: { in: ["OFFER", "HIRED"] } },
    });
    const hiredCount = await prisma.jobCandidate.count({
      where: { organisationId: orgId, currentStage: "HIRED" },
    });
    const rejectedCount = await prisma.jobCandidate.count({
      where: { organisationId: orgId, currentStage: "REJECTED" },
    });

    // Source effectiveness (which PINs produce best candidates)
    const sourceStats = await prisma.$queryRaw`
      SELECT p.label as "source", p.type,
        COUNT(c.id)::int as "totalCandidates",
        COUNT(CASE WHEN jc."currentStage" IN ('SHORTLISTED','PHONE_SCREEN','INTERVIEW','ASSESSMENT','FINAL_INTERVIEW','OFFER','HIRED') THEN 1 END)::int as "shortlisted",
        COUNT(CASE WHEN jc."currentStage" = 'HIRED' THEN 1 END)::int as "hired"
      FROM "Candidate" c
      LEFT JOIN "Pin" p ON c."pinId" = p.id
      LEFT JOIN "JobCandidate" jc ON c.id = jc."candidateId"
      WHERE c."organisationId" = ${orgId}
      GROUP BY p.label, p.type
      ORDER BY "totalCandidates" DESC
    `;

    // Stale candidates (in a stage for too long)
    const staleThresholdDays = 7;
    const staleDate = new Date(Date.now() - staleThresholdDays * 24 * 60 * 60 * 1000);
    const staleCandidates = await prisma.jobCandidate.findMany({
      where: {
        organisationId: orgId,
        updatedAt: { lt: staleDate },
        currentStage: { notIn: ["HIRED", "REJECTED", "WITHDRAWN"] },
      },
      include: {
        candidate: { select: { name: true } },
        job: { select: { title: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 20,
    });

    res.json({
      stageDistribution: stageDistribution.reduce((acc, s) => { acc[s.currentStage] = s._count; return acc; }, {}),
      avgTimeToHire,
      conversionRates: {
        total,
        shortlisted,
        interviewed,
        offered,
        hired: hiredCount,
        rejected: rejectedCount,
        shortlistRate: total > 0 ? Math.round((shortlisted / total) * 100) : 0,
        interviewRate: shortlisted > 0 ? Math.round((interviewed / shortlisted) * 100) : 0,
        offerRate: interviewed > 0 ? Math.round((offered / interviewed) * 100) : 0,
        acceptRate: offered > 0 ? Math.round((hiredCount / offered) * 100) : 0,
      },
      sourceStats,
      staleCandidates: staleCandidates.map((s) => ({
        id: s.id,
        candidateName: s.candidate?.name,
        jobTitle: s.job?.title,
        currentStage: s.currentStage,
        daysSinceUpdate: Math.round((Date.now() - s.updatedAt.getTime()) / (1000 * 60 * 60 * 24)),
      })),
    });
  } catch (err) {
    console.error("[analytics] Pipeline error:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// GET /api/analytics/comparison — compare candidates side by side
router.post("/comparison", async (req, res) => {
  try {
    const { candidateIds, jobId } = req.body;
    if (!candidateIds?.length) return res.status(400).json({ error: "candidateIds required" });

    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: candidateIds },
        organisationId: req.user.organisationId,
      },
      include: {
        talentTags: { include: { tag: true } },
        notes: { orderBy: { createdAt: "desc" }, take: 3 },
        jobCandidates: jobId ? {
          where: { jobId },
          include: { interviews: { include: { feedback: true } } },
        } : undefined,
        matchResults: jobId ? {
          where: { matchRun: { jobId } },
          include: { matchRun: { select: { job: { select: { title: true } } } } },
        } : undefined,
      },
    });

    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch comparison" });
  }
});

module.exports = router;
