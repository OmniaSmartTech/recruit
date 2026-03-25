# RecruitSmart — Product Overview

**AI-Powered Recruitment Platform**

RecruitSmart is a GDPR-compliant recruitment platform that uses AI to screen, score, and rank candidates against job specifications. It streamlines the entire hiring process — from CV collection through to offer — while ensuring candidate personal data never reaches the AI engine.

---

## How It Works

### The Core Flow

```
Applicants upload CVs via PIN → AI builds anonymised profiles →
Recruiters create jobs → Run 2-stage matching (instant pre-filter + AI deep analysis) →
Ranked shortlist with scores, strengths, gaps →
Pipeline management with kanban board →
Email communications at each stage →
Hire the best candidate
```

### GDPR by Design

Candidate CVs are parsed into structured, anonymised profiles. The AI **never** sees names, email addresses, phone numbers, or any personally identifiable information. It works with anonymised IDs, skills, experience descriptions, and qualifications only. Names are re-attached in the UI after analysis — never during.

---

## User Journeys

### 1. Applicant Journey

Candidates receive a link with a PIN code from the recruiter.

1. **Enter PIN** — lands on the application page
2. **Upload CV** (PDF, DOCX, DOC, or TXT)
3. **Optional: RecruitWizard** — opt-in AI feature that reads the CV and pre-fills the application form automatically, including suggesting common skills in their field
4. **Review and complete the form:**
   - Personal details (name, email, phone)
   - Current role and company
   - Key skills (with AI-suggested skills they can click to add)
   - Years of experience, work preference (on-site/remote/hybrid), notice period
   - Right to work status
   - Salary expectations
   - LinkedIn and portfolio URLs
   - Certifications
   - Up to 10 supporting documents (certificates, references, portfolio pieces)
5. **Submit** — application confirmed
6. **Check status later** — enter email on the status page to see where they are in the pipeline

### 2. Recruiter Journey

Internal recruitment staff use a Recruiter PIN to access the platform.

1. **Enter PIN** — lands on the Recruiter Dashboard
2. **Jobs tab** — view all open positions with department, location, level, and salary range
3. **Create a job** — tabbed form covering job details, requirements (must-have and nice-to-have), and compensation
4. **Run Match** against any job:
   - **Stage 1 — Pre-filter:** Instantly scans the entire CV bank using keyword and skill matching. Free, runs in milliseconds, even with thousands of candidates.
   - **Stage 2 — AI Analysis:** The top candidates (configurable, default 50) have their anonymised profiles sent to Claude AI for deep scoring across four weighted dimensions.
5. **View ranked results:**
   - Candidates ranked by AI match score (0–100)
   - Recommendation tag: Strong Yes / Yes / Maybe / No
   - Expand any candidate for full analysis:
     - Score breakdown across 4 dimensions with reasoning
     - Strengths and gaps (with severity ratings)
     - Requirements checklist (met/not met with evidence)
   - Change candidate status: New → Shortlisted → Interviewing → Offered → Hired
   - Search, sort, filter, and export to CSV or Excel
6. **Match History tab** — re-visit any previous match run

### 3. Interviewer Journey

Interviewers (who may not be part of the recruitment team) receive a unique PIN to submit structured feedback.

1. **Recruiter schedules an interview** — system auto-generates an Interviewer PIN
2. **Interviewer enters PIN** — sees their assigned interviews with:
   - Candidate name, current role, and key skills
   - Job title and description
   - Interview type (phone, video, in-person, assessment), date/time, and meeting link
   - Pre-interview notes from the recruiter
3. **After the interview, submits a structured scorecard:**
   - Six dimensions rated 1–5 stars: Technical Skills, Problem Solving, Communication, Cultural Fit, Leadership, Overall
   - Free-text fields: Strengths observed, Concerns, Additional notes
   - Final recommendation: Strong Yes / Yes / Maybe / No
4. **Feedback is aggregated** — recruiter and admin see all interviewer scorecards per candidate

### 4. Admin Journey

Admins log in via SSO (Google or Microsoft) and have full platform control.

**Dashboard:**
- At-a-glance stats: open jobs, CV bank size, new candidates this week, match runs
- Recent match activity

**Jobs Management:**
- Full searchable, sortable, filterable table with export
- Per-job actions: Run Match, Pipeline (kanban), Edit, Clone (for similar roles), Delete
- Tabbed create/edit form: Job Details | Requirements | Compensation & Culture

**Pipeline Board (per job):**
- Visual kanban board with drag-and-drop across 9 stages:
  Applied → Screening → Shortlisted → Phone Screen → Interview → Assessment → Final Interview → Offer → Hired
- Drag a candidate to a new stage:
  - Confirmation modal with optional notes
  - Auto-opens email compose with pre-filled template for that stage
- Click any candidate card for a detail drawer:
  - Current stage, match score, contact details, skills
  - Quick actions: move stage, compose email
  - Full stage history timeline (who moved them, when, with notes)
  - Communications log
- Rejected and Withdrawn candidates shown separately below the board

**PIN Management:**
- Create three types of PINs:
  - **Recruiter PINs** — for staff to run CV matching
  - **Applicant PINs** — for candidates to upload CVs
  - **Interviewer PINs** — auto-generated when scheduling interviews
- Copy shareable links, toggle active/inactive, view usage stats

**CV Bank:**
- All candidates who have uploaded CVs, across all applicant PINs
- Searchable, sortable, filterable table with export
- CV file names are clickable download links
- **Documents:** badge showing count — click to open document modal (upload, download, delete — no limit for admin)
- **Notes:** badge showing count — click to open notes drawer (add recruiter observations, view full history with author and timestamp)

**Match Runs:**
- History of all match runs across all jobs
- Run a new match directly from the dropdown
- Click any run for full ranked results with expandable AI analysis

**Email Templates:**
- Customisable email template per pipeline stage
- Default templates provided for: Applied, Shortlisted, Phone Screen, Interview, Assessment, Final Interview, Offer, Hired, Rejected
- Template variables: `{{candidateName}}`, `{{jobTitle}}`, `{{companyName}}`
- Compose-and-copy flow: edit the template, click "Copy & Open Email" — text copied to clipboard and mailto link opened

**Share Links:**
- Generate codes for hiring managers to view shortlisted candidates (read-only)
- Optionally scope to a specific job or set an expiry date

**Configuration:**
- **Scoring Weights:** adjust how Skills Match, Experience Relevance, Qualifications, and Cultural Fit contribute to the overall score (must sum to 100%)
- **Pre-filter threshold:** how many candidates pass from the instant pre-filter to the AI analysis stage
- **Branding:** organisation name, logo, brand colour (applied to reports and shared views)
- **AI Prompt:** company context, assessment focus, language preference (British/American English), custom instructions

### 5. Hiring Manager Journey (Share Link)

Hiring managers receive a share link from the recruiter — no login required.

1. Enter the share code
2. See shortlisted candidates per job
3. Click to expand: summary, strengths, gaps
4. Read-only — no editing capabilities

### 6. Application Status Check (Public)

Applicants can check their status at any time without logging in.

1. Click "Check Application Status" on the home page
2. Enter the email address used when applying
3. See all applications with a visual pipeline:
   - Applied ✓ → Screening ✓ → Shortlisted ● → Interview ○ → Decision ○
   - Applied date and last updated date
   - Congratulations message if hired
   - Polite "not progressed" message if rejected (no internal details exposed)

---

## Key Features

### AI-Powered Matching
- Two-stage process: instant keyword pre-filter + deep AI analysis
- Configurable scoring weights across 4 dimensions
- Anonymised profiles ensure GDPR compliance
- Customisable AI prompts per organisation

### Recruitment Pipeline
- 9-stage kanban board with drag-and-drop
- Automated email prompts at each stage transition
- Full audit trail (who moved whom, when, with notes)
- Rejected and withdrawn tracking

### Interview Management
- Schedule phone, video, in-person, or assessment interviews
- Auto-generated interviewer PINs for external interviewers
- Structured scorecards (6 dimensions, 1–5 stars)
- Aggregated feedback across multiple interviewers

### Talent Pool
- Tag candidates with custom labels (e.g., "Strong React", "Revisit Q3", "Leadership Potential")
- Search the talent pool by tags, skills, or minimum experience
- Reuse rejected candidates for future roles

### Communications
- Email templates per stage with variable substitution
- Compose-and-copy workflow (clipboard + mailto)
- Full communication log per candidate per job

### CV Bank & Documents
- Centralised CV storage with download links
- Up to 10 supporting documents per application (applicant-uploaded)
- Unlimited document uploads by admin/recruiter
- Recruiter notes per candidate with full history

### Analytics
- Pipeline conversion rates (shortlist rate, interview rate, offer rate, acceptance rate)
- Average time-to-hire
- Source effectiveness (which PINs produce the best candidates)
- Stale candidate alerts (stuck in a stage too long)
- Candidate comparison (side-by-side view)

### Bulk Actions
- Bulk move candidates to a pipeline stage
- Bulk assign candidates from CV bank to a job pipeline
- Bulk tag candidates with talent pool labels

### Data & Export
- Every table supports search, sort, column-level filtering
- Column visibility toggle, resize, and reorder
- CSV and Excel export on all data views
- Persistent table preferences per user

### Multi-Tenant
- Organisation-scoped data (complete isolation)
- SSO via Google and Microsoft (aione-auth)
- Custom branding per organisation (logo, colours)
- Configurable scoring weights, AI prompts, and email templates per org

---

## Technology

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite, Ant Design |
| Backend | Node.js, Express, Prisma ORM |
| Database | PostgreSQL |
| AI | Anthropic Claude (Sonnet) |
| Storage | AWS S3 |
| Auth | aione-auth SSO (Google, Microsoft) |

---

## Brand

- **Colour:** Coral Red `#E74C3C`
- **Font:** Inter
- **Product URL:** recruitsmart.aione.uk

---

*RecruitSmart is part of the AIOne product suite by Omnia Smart Tech.*
