/**
 * Build the Claude prompt for candidate matching.
 * Uses ANONYMISED profile only — no PII.
 */
function buildMatchPrompt(profile, job, org) {
  const scoring = org.scoringConfig || {
    weightSkills: 35,
    weightExperience: 30,
    weightQualifications: 20,
    weightCulturalFit: 15,
  };

  const promptTemplate = org.promptTemplate || {};
  const lang = promptTemplate.languagePrefs === "american" ? "American" : "British";
  const requirements = job.requirements || { mustHave: [], niceToHave: [] };

  let prompt = `You are an expert recruitment analyst`;
  if (promptTemplate.companyRole) {
    prompt += `. ${promptTemplate.companyRole}`;
  }
  prompt += `. Use ${lang} English.\n\n`;

  prompt += `## TASK
Analyse this ANONYMISED candidate profile against the job specification.
The candidate is identified ONLY by their ID — you have no access to their name or personal details. This is by design for GDPR compliance.

## SCORING WEIGHTS
- Skills Match: ${scoring.weightSkills}%
- Experience Relevance: ${scoring.weightExperience}%
- Qualifications: ${scoring.weightQualifications}%
- Cultural Fit Indicators: ${scoring.weightCulturalFit}%

## JOB SPECIFICATION
Title: ${job.title}
${job.department ? `Department: ${job.department}` : ""}
${job.location ? `Location: ${job.location}` : ""}
${job.workMode ? `Work Mode: ${job.workMode}` : ""}
${job.experienceLevel ? `Experience Level: ${job.experienceLevel}` : ""}

Description:
${job.description}

Must-Have Requirements:
${requirements.mustHave?.map((r) => `- ${r}`).join("\n") || "None specified"}

Nice-to-Have Requirements:
${requirements.niceToHave?.map((r) => `- ${r}`).join("\n") || "None specified"}

${job.salaryRange ? `Salary Range: ${job.salaryRange.currency || "GBP"} ${job.salaryRange.min?.toLocaleString()} - ${job.salaryRange.max?.toLocaleString()}` : ""}
${job.teamNotes ? `Team & Culture Notes:\n${job.teamNotes}` : ""}

## ANONYMISED CANDIDATE PROFILE
${JSON.stringify(profile, null, 2)}

${promptTemplate.assessmentFocus ? `\n## ASSESSMENT FOCUS\n${promptTemplate.assessmentFocus}` : ""}
${promptTemplate.customInstructions ? `\n## ADDITIONAL INSTRUCTIONS\n${promptTemplate.customInstructions}` : ""}

## REQUIRED OUTPUT
Return a JSON object:
{
  "candidateId": "${profile.candidateId}",
  "matchScore": <0-100>,
  "scoreBreakdown": {
    "skills": { "score": <0-100>, "weight": ${scoring.weightSkills}, "reasoning": "..." },
    "experience": { "score": <0-100>, "weight": ${scoring.weightExperience}, "reasoning": "..." },
    "qualifications": { "score": <0-100>, "weight": ${scoring.weightQualifications}, "reasoning": "..." },
    "culturalFit": { "score": <0-100>, "weight": ${scoring.weightCulturalFit}, "reasoning": "..." }
  },
  "summary": "2-3 sentence assessment of this candidate's fit",
  "strengths": [
    { "area": "...", "detail": "..." }
  ],
  "gaps": [
    { "area": "...", "severity": "HIGH|MEDIUM|LOW", "detail": "..." }
  ],
  "mustHaveChecklist": [
    { "requirement": "...", "met": true|false, "evidence": "..." }
  ],
  "niceToHaveChecklist": [
    { "requirement": "...", "met": true|false, "evidence": "..." }
  ],
  "recommendedAction": "STRONG_YES|YES|MAYBE|NO",
  "interviewFocusAreas": ["Area to probe in interview"],
  "salaryAlignment": "Assessment of salary expectations vs range"
}

Return ONLY valid JSON.`;

  return prompt;
}

module.exports = { buildMatchPrompt };
