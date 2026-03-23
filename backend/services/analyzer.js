const Anthropic = require("@anthropic-ai/sdk").default;
const { PrismaClient } = require("@prisma/client");
const { buildMatchPrompt } = require("./promptBuilder");

const prisma = new PrismaClient();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Stage 2: AI Analysis
 *
 * Analyses anonymised candidate profiles against a job spec.
 * NEVER receives PII — only candidateId + skills/experience/education.
 *
 * Processes candidates in batches for efficiency.
 */

/**
 * Analyse a single candidate (by MatchResult ID) against a job.
 * Uses anonymised profile only.
 */
async function analyzeMatchResult(matchResultId) {
  try {
    await prisma.matchResult.update({
      where: { id: matchResultId },
      data: { analysisStatus: "ANALYZING" },
    });

    const result = await prisma.matchResult.findUnique({
      where: { id: matchResultId },
      include: {
        candidate: true,
        matchRun: {
          include: {
            job: {
              include: {
                organisation: {
                  include: {
                    scoringConfig: true,
                    promptTemplate: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!result?.candidate?.profile) {
      throw new Error("Candidate profile not found");
    }

    const { job } = result.matchRun;
    const org = job.organisation;
    const profile = result.candidate.profile;

    const prompt = buildMatchPrompt(profile, job, org);

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse AI response");

    const analysis = JSON.parse(jsonMatch[0]);
    const aiScore = Math.min(100, Math.max(0, Math.round(analysis.matchScore || 0)));

    await prisma.matchResult.update({
      where: { id: matchResultId },
      data: {
        aiScore,
        analysis,
        analysisStatus: "COMPLETED",
      },
    });

    console.log(`[analyzer] Result ${matchResultId} scored ${aiScore}/100`);
  } catch (err) {
    console.error(`[analyzer] Failed for result ${matchResultId}:`, err);
    await prisma.matchResult.update({
      where: { id: matchResultId },
      data: { analysisStatus: "FAILED" },
    });
  }
}

/**
 * Run a full match: pre-filter then AI analysis.
 */
async function runMatchAnalysis(matchRunId) {
  try {
    const matchRun = await prisma.matchRun.findUnique({
      where: { id: matchRunId },
      include: { results: true },
    });

    if (!matchRun) throw new Error("MatchRun not found");

    await prisma.matchRun.update({
      where: { id: matchRunId },
      data: { status: "ANALYZING", startedAt: new Date() },
    });

    // Get all results that passed pre-filter
    const toAnalyze = matchRun.results.filter((r) => r.passedPreFilter);

    console.log(`[analyzer] Analyzing ${toAnalyze.length} candidates for run ${matchRunId}`);

    // Process in batches of 5 (parallel within batch)
    const batchSize = 5;
    for (let i = 0; i < toAnalyze.length; i += batchSize) {
      const batch = toAnalyze.slice(i, i + batchSize);
      await Promise.all(batch.map((r) => analyzeMatchResult(r.id)));
    }

    await prisma.matchRun.update({
      where: { id: matchRunId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    console.log(`[analyzer] Match run ${matchRunId} complete`);
  } catch (err) {
    console.error(`[analyzer] Match run ${matchRunId} failed:`, err);
    await prisma.matchRun.update({
      where: { id: matchRunId },
      data: { status: "FAILED" },
    });
  }
}

module.exports = { analyzeMatchResult, runMatchAnalysis };
