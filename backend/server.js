require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const jobRoutes = require("./routes/job");
const candidateRoutes = require("./routes/candidate");
const adminRoutes = require("./routes/admin");
const authRoutes = require("./routes/auth");
const shareRoutes = require("./routes/share");

const prisma = new PrismaClient();
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "20mb" }));

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Routes
app.use("/api/jobs", jobRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/share", shareRoutes);

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
