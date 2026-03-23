/**
 * Stage 1: Pre-Filter
 *
 * Fast, no-AI keyword/skill matching to narrow down candidates
 * before sending to expensive Claude analysis.
 *
 * Scoring:
 * - Must-have skill match:    +10 per skill
 * - Nice-to-have skill match: +5 per skill
 * - Experience level match:   +15
 * - Work mode compatibility:  +10
 * - Seniority alignment:      +10
 */

/**
 * Score a single candidate's profile against a job spec.
 * Returns 0-100 pre-filter score.
 */
function scoreCandidate(profile, job) {
  if (!profile) return 0;

  let score = 0;
  let maxScore = 0;

  const requirements = job.requirements || { mustHave: [], niceToHave: [] };
  const candidateSkills = (profile.skills || []).map((s) => s.toLowerCase());

  // Must-have skill matching
  const mustHave = requirements.mustHave || [];
  maxScore += mustHave.length * 10;
  for (const req of mustHave) {
    const reqWords = req.toLowerCase().split(/\s+/);
    // Check if any candidate skill contains the requirement keywords
    const matched = candidateSkills.some((skill) =>
      reqWords.some((word) => word.length > 2 && skill.includes(word))
    );
    if (matched) score += 10;
  }

  // Nice-to-have skill matching
  const niceToHave = requirements.niceToHave || [];
  maxScore += niceToHave.length * 5;
  for (const req of niceToHave) {
    const reqWords = req.toLowerCase().split(/\s+/);
    const matched = candidateSkills.some((skill) =>
      reqWords.some((word) => word.length > 2 && skill.includes(word))
    );
    if (matched) score += 5;
  }

  // Experience level alignment
  maxScore += 15;
  if (job.experienceLevel && profile.seniorityLevel) {
    const levels = ["Junior", "Mid", "Senior", "Lead", "Director", "Executive"];
    const jobIdx = levels.findIndex((l) => l.toLowerCase() === job.experienceLevel?.toLowerCase());
    const candIdx = levels.findIndex((l) => l.toLowerCase() === profile.seniorityLevel?.toLowerCase());
    if (jobIdx >= 0 && candIdx >= 0) {
      const diff = Math.abs(jobIdx - candIdx);
      if (diff === 0) score += 15;
      else if (diff === 1) score += 10;
      else if (diff === 2) score += 5;
    }
  }

  // Work mode compatibility
  maxScore += 10;
  if (job.workMode && profile.workPreference) {
    const pref = profile.workPreference.toUpperCase();
    if (pref === job.workMode || pref === "HYBRID" || pref === "UNKNOWN") {
      score += 10;
    } else if (job.workMode === "HYBRID") {
      score += 7; // hybrid job accepts both
    }
  }

  // Years experience bonus
  maxScore += 10;
  if (profile.yearsExperience) {
    const years = profile.yearsExperience;
    if (job.experienceLevel) {
      const expected = {
        junior: 1, mid: 3, senior: 5, lead: 8, director: 12, executive: 15,
      };
      const exp = expected[job.experienceLevel.toLowerCase()] || 3;
      if (years >= exp) score += 10;
      else if (years >= exp * 0.7) score += 7;
      else if (years >= exp * 0.5) score += 4;
    } else {
      score += Math.min(10, years); // raw years, capped at 10
    }
  }

  // Normalise to 0-100
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

/**
 * Pre-filter a list of candidates against a job.
 * Returns candidates sorted by pre-filter score, top N only.
 */
function preFilterCandidates(candidates, job, topN = 50) {
  const scored = candidates
    .filter((c) => c.profile) // must have an anonymised profile
    .map((c) => ({
      candidateId: c.id,
      preFilterScore: scoreCandidate(c.profile, job),
    }))
    .sort((a, b) => b.preFilterScore - a.preFilterScore);

  // Take top N
  return scored.slice(0, topN);
}

module.exports = { scoreCandidate, preFilterCandidates };
