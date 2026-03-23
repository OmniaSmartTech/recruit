const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { auth } = require("../middleware/auth");

const prisma = new PrismaClient();
const router = express.Router();

router.use(auth);

// ─── Tags CRUD ───────────────────────────────────────────────────────────────

router.get("/tags", async (req, res) => {
  try {
    const tags = await prisma.talentTag.findMany({
      where: { organisationId: req.user.organisationId },
      include: { _count: { select: { candidates: true } } },
      orderBy: { name: "asc" },
    });
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

router.post("/tags", async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });

    const tag = await prisma.talentTag.create({
      data: {
        organisationId: req.user.organisationId,
        name,
        color: color || "#3b82f6",
      },
    });
    res.status(201).json(tag);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Tag already exists" });
    res.status(500).json({ error: "Failed to create tag" });
  }
});

router.delete("/tags/:id", async (req, res) => {
  try {
    await prisma.talentTag.deleteMany({
      where: { id: req.params.id, organisationId: req.user.organisationId },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

// ─── Tag candidates ──────────────────────────────────────────────────────────

router.post("/candidates/:candidateId/tag/:tagId", async (req, res) => {
  try {
    await prisma.candidateTalentTag.create({
      data: {
        candidateId: req.params.candidateId,
        tagId: req.params.tagId,
        addedBy: req.user.email || "admin",
      },
    });
    res.status(201).json({ success: true });
  } catch (err) {
    if (err.code === "P2002") return res.json({ success: true }); // already tagged
    res.status(500).json({ error: "Failed to tag candidate" });
  }
});

router.delete("/candidates/:candidateId/tag/:tagId", async (req, res) => {
  try {
    await prisma.candidateTalentTag.deleteMany({
      where: { candidateId: req.params.candidateId, tagId: req.params.tagId },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to untag candidate" });
  }
});

// ─── Search talent pool by tags ──────────────────────────────────────────────

router.get("/search", async (req, res) => {
  try {
    const { tags, skills, minYearsExp } = req.query;
    const where = { organisationId: req.user.organisationId, isActive: true };

    if (tags) {
      const tagIds = String(tags).split(",");
      where.talentTags = { some: { tagId: { in: tagIds } } };
    }

    if (skills) {
      const skillList = String(skills).split(",");
      where.skills = { hasSome: skillList };
    }

    if (minYearsExp) {
      where.yearsExp = { gte: parseInt(minYearsExp) };
    }

    const candidates = await prisma.candidate.findMany({
      where,
      include: {
        talentTags: { include: { tag: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: "Failed to search talent pool" });
  }
});

// ─── Get candidate tags ──────────────────────────────────────────────────────

router.get("/candidates/:candidateId/tags", async (req, res) => {
  try {
    const tags = await prisma.candidateTalentTag.findMany({
      where: { candidateId: req.params.candidateId },
      include: { tag: true },
    });
    res.json(tags.map((t) => t.tag));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch candidate tags" });
  }
});

module.exports = router;
