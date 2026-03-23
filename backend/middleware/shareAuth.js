const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Middleware for share link authentication (hiring managers).
 * Validates x-share-code header and attaches org + optional job scope.
 */
async function shareAuth(req, res, next) {
  const code = req.headers["x-share-code"];
  if (!code) {
    return res.status(401).json({ error: "Share code required" });
  }

  try {
    const link = await prisma.shareLink.findUnique({
      where: { code },
      include: { organisation: true },
    });

    if (!link || !link.isActive) {
      return res.status(401).json({ error: "Invalid or inactive share link" });
    }

    if (link.expiresAt && new Date() > link.expiresAt) {
      return res.status(401).json({ error: "Share link has expired" });
    }

    req.share = {
      linkId: link.id,
      organisationId: link.organisationId,
      jobId: link.jobId, // null = access all jobs
      orgName: link.organisation.name,
      label: link.label,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Authentication failed" });
  }
}

module.exports = { shareAuth };
