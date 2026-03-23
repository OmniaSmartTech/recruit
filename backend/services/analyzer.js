const Anthropic = require("@anthropic-ai/sdk").default;
const { PrismaClient } = require("@prisma/client");
const { buildPrompt } = require("./promptBuilder");

const prisma = new PrismaClient();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Analyse a candidate's CV against a job spec using Claude.
 * Runs in background — updates candidate record when done.
 */
async function analyzeCandidate(candidateId) {
  try {
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { analyisStatus: "ANALYZING" },
    });

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
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
    });

    if (!candidate || !candidate.cvText) {
      throw new Error("Candidate or CV text not found");
    }

    const { job } = candidate;
    const org = job.organisation;
    const prompt = buildPrompt(candidate, job, org);

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].text;

    // Extract JSON from response
    let analysis;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Failed to parse AI response as JSON");
    }

    const matchScore = Math.min(100, Math.max(0, Math.round(analysis.matchScore || 0)));

    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        analysis,
        matchScore,
        analyisStatus: "COMPLETED",
      },
    });

    console.log(`[analyzer] Candidate ${candidateId} scored ${matchScore}/100`);
  } catch (err) {
    console.error(`[analyzer] Failed for candidate ${candidateId}:`, err);
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { analyisStatus: "FAILED" },
    });
  }
}

/**
 * Generate interview questions tailored to a candidate's gaps.
 */
async function generateInterviewQuestions(candidateId) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { job: true },
  });

  if (!candidate?.analysis) return null;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `You are an expert interviewer. Based on the following candidate analysis for the role "${candidate.job.title}", generate targeted interview questions.

CANDIDATE ANALYSIS:
${JSON.stringify(candidate.analysis, null, 2)}

JOB REQUIREMENTS:
${JSON.stringify(candidate.job.requirements, null, 2)}

Generate a JSON object with this structure:
{
  "technicalQuestions": [
    { "question": "...", "purpose": "What this probes", "lookFor": "Good answer indicators" }
  ],
  "behaviouralQuestions": [
    { "question": "...", "purpose": "...", "lookFor": "..." }
  ],
  "gapProbing": [
    { "question": "...", "gap": "Which gap this addresses", "lookFor": "..." }
  ],
  "culturalFit": [
    { "question": "...", "purpose": "...", "lookFor": "..." }
  ]
}

Generate 3-4 questions per category. Return ONLY valid JSON.`,
    }],
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
}

module.exports = { analyzeCandidate, generateInterviewQuestions };
