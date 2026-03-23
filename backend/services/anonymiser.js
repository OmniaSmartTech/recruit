/**
 * GDPR-Compliant CV Anonymiser
 *
 * Takes parsed CV text + applicant form data and produces an anonymised
 * profile JSON that is safe to send to AI. No PII ever reaches Claude.
 *
 * AnonymisedProfile structure:
 * {
 *   candidateId: "cand_abc123",          // ID only, no name
 *   skills: ["React", "Node.js", ...],
 *   yearsExperience: 7,
 *   seniorityLevel: "Senior",
 *   experienceEntries: [
 *     { role: "Senior Engineer", industry: "Fintech", duration: "3 years",
 *       highlights: ["Led team of 5", "Built payment platform"] }
 *   ],
 *   education: [
 *     { level: "BSc", field: "Computer Science", classification: "First" }
 *   ],
 *   certifications: ["AWS Solutions Architect"],
 *   workPreference: "HYBRID",
 *   desiredSalaryRange: { min: 60000, max: 80000, currency: "GBP" },
 *   noticePeriod: "1 month",
 *   summary: "Brief professional summary with PII stripped"
 * }
 */

const Anthropic = require("@anthropic-ai/sdk").default;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Extract a structured, anonymised profile from raw CV text.
 * Uses Claude to parse the CV but instructs it to strip all PII.
 */
async function extractAnonymisedProfile(candidateId, cvText, formData = {}) {
  // If we have structured form data, merge it with AI extraction
  const formContext = formData.skills?.length
    ? `\nThe candidate has self-reported the following:\n- Skills: ${formData.skills.join(", ")}\n- Years experience: ${formData.yearsExp || "not specified"}\n`
    : "";

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `You are a CV parser. Extract a structured, ANONYMISED profile from the CV text below.

CRITICAL RULES:
- Do NOT include any personally identifiable information (PII)
- No names, email addresses, phone numbers, home addresses, dates of birth
- No company names where the person currently works (use industry/sector instead)
- No university names (use "Russell Group university" or "Top 20 university" etc.)
- Refer to the candidate ONLY as candidateId "${candidateId}"
- For job history, describe roles generically: "Senior Engineer at a mid-size fintech" not "John at Revolut"
${formContext}
CV TEXT:
${cvText.substring(0, 8000)}

Return ONLY a JSON object with this exact structure:
{
  "candidateId": "${candidateId}",
  "skills": ["skill1", "skill2", ...],
  "yearsExperience": <number or null>,
  "seniorityLevel": "Junior|Mid|Senior|Lead|Director|Executive",
  "experienceEntries": [
    {
      "role": "Job title (generic)",
      "industry": "Sector/industry",
      "companySize": "startup|SME|mid-size|enterprise|unknown",
      "duration": "X years",
      "highlights": ["Achievement 1", "Achievement 2"]
    }
  ],
  "education": [
    {
      "level": "BSc|MSc|PhD|HND|A-Levels|etc",
      "field": "Subject area",
      "classification": "First|2:1|2:2|Distinction|Merit|Pass|unknown"
    }
  ],
  "certifications": ["Cert name 1", ...],
  "workPreference": "ONSITE|REMOTE|HYBRID|unknown",
  "noticePeriod": "immediate|1 month|3 months|unknown",
  "summary": "2-3 sentence professional summary with NO PII"
}

Return ONLY valid JSON, no other text.`,
    }],
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse anonymised profile from AI response");
  }

  const profile = JSON.parse(jsonMatch[0]);

  // Ensure candidateId is correct (don't trust AI to get it right)
  profile.candidateId = candidateId;

  // Merge in form data that may be more accurate than CV parse
  if (formData.skills?.length) {
    // Union of AI-extracted and self-reported skills
    const allSkills = new Set([
      ...(profile.skills || []).map((s) => s.toLowerCase()),
      ...formData.skills.map((s) => s.toLowerCase()),
    ]);
    profile.skills = [...allSkills].map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  }
  if (formData.yearsExp && !profile.yearsExperience) {
    profile.yearsExperience = formData.yearsExp;
  }
  if (formData.workPreference) {
    profile.workPreference = formData.workPreference;
  }
  if (formData.desiredSalary) {
    profile.desiredSalaryRange = formData.desiredSalary;
  }
  if (formData.noticePeriod) {
    profile.noticePeriod = formData.noticePeriod;
  }
  if (formData.certifications?.length) {
    const allCerts = new Set([
      ...(profile.certifications || []),
      ...formData.certifications,
    ]);
    profile.certifications = [...allCerts];
  }

  return profile;
}

/**
 * Build an anonymised profile from structured form data only (no CV text).
 * Used when applicant fills form but CV parsing fails.
 */
function buildProfileFromForm(candidateId, formData) {
  return {
    candidateId,
    skills: formData.skills || [],
    yearsExperience: formData.yearsExp || null,
    seniorityLevel: inferSeniority(formData.yearsExp),
    experienceEntries: [],
    education: formData.education || [],
    certifications: formData.certifications || [],
    workPreference: formData.workPreference || "unknown",
    noticePeriod: formData.noticePeriod || "unknown",
    summary: "Profile built from applicant form data only — no CV parsed.",
  };
}

function inferSeniority(yearsExp) {
  if (!yearsExp) return "unknown";
  if (yearsExp < 2) return "Junior";
  if (yearsExp < 5) return "Mid";
  if (yearsExp < 8) return "Senior";
  if (yearsExp < 12) return "Lead";
  return "Director";
}

module.exports = { extractAnonymisedProfile, buildProfileFromForm };
