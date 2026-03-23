const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

const AIONE_AUTH_BASE = process.env.AIONE_AUTH_BASE || "https://auth.aione.uk";

router.post("/resolve", async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) {
    return res.status(400).json({ error: "accessToken required" });
  }

  try {
    const meRes = await fetch(`${AIONE_AUTH_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!meRes.ok) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const profile = await meRes.json();
    const userOrgs = profile.organisations || [];

    const recruitsmartOrgs = [];
    for (const uo of userOrgs) {
      const org = uo.organisation || uo;
      if (!org.hasRecruitSmartAccess || !org.recruitsmartOrgId) continue;

      const localOrg = await prisma.organisation.findUnique({
        where: { id: org.recruitsmartOrgId },
      });
      if (!localOrg || !localOrg.isActive) continue;

      recruitsmartOrgs.push({
        aioneOrgId: org.id,
        recruitsmartOrgId: localOrg.id,
        name: localOrg.companyName || localOrg.name,
        slug: localOrg.slug,
        logoUrl: localOrg.logoUrl,
        primaryColor: localOrg.primaryColor,
        role: uo.role || "user",
      });
    }

    const isSuperadmin = profile.role === "superadmin" ||
      userOrgs.some((uo) => (uo.role || "").toLowerCase() === "superadmin");

    if (isSuperadmin && recruitsmartOrgs.length === 0) {
      const allOrgs = await prisma.organisation.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      });
      for (const org of allOrgs) {
        recruitsmartOrgs.push({
          aioneOrgId: org.aioneOrgId,
          recruitsmartOrgId: org.id,
          name: org.companyName || org.name,
          slug: org.slug,
          logoUrl: org.logoUrl,
          primaryColor: org.primaryColor,
          role: "superadmin",
        });
      }
    }

    if (recruitsmartOrgs.length === 0) {
      return res.status(403).json({
        error: "No RecruitSmart access",
        message: "Your account does not have access to any RecruitSmart organisations.",
      });
    }

    if (recruitsmartOrgs.length === 1) {
      return res.json({
        requiresOrgSelection: false,
        organisation: recruitsmartOrgs[0],
        user: {
          name: profile.name,
          email: profile.email,
          role: recruitsmartOrgs[0].role,
        },
      });
    }

    return res.json({
      requiresOrgSelection: true,
      organisations: recruitsmartOrgs,
      user: {
        name: profile.name,
        email: profile.email,
      },
    });
  } catch (err) {
    console.error("[auth/resolve] Error:", err);
    return res.status(500).json({ error: "Failed to resolve organisations" });
  }
});

module.exports = router;
