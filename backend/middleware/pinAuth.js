const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Middleware for PIN-based authentication.
 * Validates x-pin-code header and attaches org + PIN info to req.pin.
 * Optionally filters by PIN type (RECRUITER or APPLICANT).
 */
function pinAuth(requiredType) {
  return async (req, res, next) => {
    const code = req.headers["x-pin-code"];
    if (!code) {
      return res.status(401).json({ error: "PIN code required" });
    }

    try {
      const pin = await prisma.pin.findUnique({
        where: { code: code.toUpperCase() },
        include: { organisation: true },
      });

      if (!pin || !pin.isActive) {
        return res.status(401).json({ error: "Invalid or inactive PIN" });
      }

      if (requiredType && pin.type !== requiredType) {
        return res.status(403).json({
          error: `This PIN is for ${pin.type.toLowerCase()} access, not ${requiredType.toLowerCase()}`,
        });
      }

      req.pin = {
        id: pin.id,
        code: pin.code,
        type: pin.type,
        label: pin.label,
        jobId: pin.jobId,
        organisationId: pin.organisationId,
        orgName: pin.organisation.companyName || pin.organisation.name,
        orgLogo: pin.organisation.logoUrl,
        orgColor: pin.organisation.primaryColor,
      };

      next();
    } catch (err) {
      return res.status(401).json({ error: "PIN authentication failed" });
    }
  };
}

module.exports = { pinAuth };
