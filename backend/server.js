require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const pinRoutes = require("./routes/pin");
const applicantRoutes = require("./routes/applicant");
const recruiterRoutes = require("./routes/recruiter");
const jobRoutes = require("./routes/job");
const candidateRoutes = require("./routes/candidate");
const adminRoutes = require("./routes/admin");
const authRoutes = require("./routes/auth");
const shareRoutes = require("./routes/share");
const pipelineRoutes = require("./routes/pipeline");

const prisma = new PrismaClient();
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "20mb" }));

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Routes
app.use("/api/pin", pinRoutes);
app.use("/api/applicant", applicantRoutes);
app.use("/api/recruiter", recruiterRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/share", shareRoutes);
app.use("/api/pipeline", pipelineRoutes);

// File serving (local dev fallback when S3 not configured)
const { readFile: readStoredFile } = require("./utils/s3");
app.get("/api/files/:key(*)", async (req, res) => {
  try {
    const file = await readStoredFile(req.params.key);
    if (!file) return res.status(404).json({ error: "File not found" });
    res.setHeader("Content-Type", file.contentType);
    res.send(file.buffer);
  } catch (err) {
    res.status(500).json({ error: "Failed to read file" });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4080;
app.listen(PORT, () => {
  console.log(`RecruitSmart backend running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
