/**
 * Build the Claude prompt for candidate analysis.
 */
function buildPrompt(candidate, job, org) {
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
  prompt += `. Use ${lang} English spelling and conventions.\n\n`;

  prompt += `## YOUR TASK
Analyse the candidate's CV against the job specification below. Produce a detailed, objective assessment with a match score from 0-100.

## SCORING WEIGHTS
- Skills Match: ${scoring.weightSkills}% — How well the candidate's technical and professional skills align with requirements
- Experience Relevance: ${scoring.weightExperience}% — Years of experience, domain relevance, seniority fit
- Qualifications: ${scoring.weightQualifications}% — Education, certifications, formal training
- Cultural Fit Indicators: ${scoring.weightCulturalFit}% — Team size experience, company types, leadership signals, work style

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

## CANDIDATE CV
Name: ${candidate.name}
${candidate.email ? `Email: ${candidate.email}` : ""}

CV Content:
${candidate.cvText}

${promptTemplate.assessmentFocus ? `\n## ASSESSMENT FOCUS\n${promptTemplate.assessmentFocus}` : ""}
${promptTemplate.customInstructions ? `\n## ADDITIONAL INSTRUCTIONS\n${promptTemplate.customInstructions}` : ""}

## REQUIRED OUTPUT FORMAT
Return a JSON object with this exact structure:
{
  "matchScore": <0-100>,
  "scoreBreakdown": {
    "skills": { "score": <0-100>, "weight": ${scoring.weightSkills}, "reasoning": "..." },
    "experience": { "score": <0-100>, "weight": ${scoring.weightExperience}, "reasoning": "..." },
    "qualifications": { "score": <0-100>, "weight": ${scoring.weightQualifications}, "reasoning": "..." },
    "culturalFit": { "score": <0-100>, "weight": ${scoring.weightCulturalFit}, "reasoning": "..." }
  },
  "candidateSummary": "2-3 sentence overview of the candidate",
  "currentRole": "Their current/most recent role and company",
  "yearsExperience": <number or null>,
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
  "keySkills": ["skill1", "skill2", ...],
  "educationSummary": "...",
  "careerProgression": "Brief assessment of career trajectory",
  "salaryEstimate": "Estimated salary expectation based on experience level",
  "redFlags": ["Any concerns worth noting"],
  "recommendedNextSteps": "Recommendation: STRONG_YES | YES | MAYBE | NO",
  "interviewFocusAreas": ["Areas to probe in interview"]
}

Return ONLY the JSON object, no other text.`;

  return prompt;
}

module.exports = { buildPrompt };
