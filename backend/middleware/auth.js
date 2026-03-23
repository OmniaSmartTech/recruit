const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    let decoded;
    const secrets = [
      process.env.AIONE_AUTH_JWT_SECRET,
    ].filter(Boolean);

    for (const secret of secrets) {
      try {
        decoded = jwt.verify(token, secret);
        break;
      } catch (_) {
        continue;
      }
    }
    if (!decoded) throw new Error("No valid secret");

    if (decoded.userId && decoded.organisationId) {
      const role = decoded.products?.recruitsmart?.role || "user";

      const orgOverride = req.headers["x-recruitsmart-org"];
      let org;

      if (orgOverride) {
        org = await prisma.organisation.findUnique({
          where: { id: orgOverride },
        });
      }

      if (!org) {
        org = await prisma.organisation.findUnique({
          where: { aioneOrgId: decoded.organisationId },
        });
      }

      if (!org) {
        const slug = `org-${decoded.organisationId}`;
        org = await prisma.organisation.create({
          data: {
            aioneOrgId: decoded.organisationId,
            name: `Organisation ${decoded.organisationId}`,
            slug,
          },
        });
      }

      req.user = {
        aioneUserId: decoded.userId,
        email: decoded.email,
        organisationId: org.id,
        orgName: org.name,
        role,
      };
    } else {
      return res.status(401).json({ error: "Invalid token format" });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!["admin", "owner", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports = { auth, requireAdmin };
