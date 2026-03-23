const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function seed() {
  console.log("Seeding RecruitSmart database...\n");

  // Create AIOne organisation
  const org = await prisma.organisation.upsert({
    where: { slug: "aione" },
    update: {},
    create: {
      name: "AIOne",
      slug: "aione",
      companyName: "AIOne (Omnia Smart Tech)",
      primaryColor: "#e74c3c",
      website: "https://aione.uk",
    },
  });
  console.log(`Org: ${org.name} (${org.id})`);

  // Scoring config
  await prisma.scoringConfig.upsert({
    where: { organisationId: org.id },
    update: {},
    create: {
      organisationId: org.id,
      weightSkills: 35, weightExperience: 30, weightQualifications: 20, weightCulturalFit: 15, preFilterTopN: 50,
    },
  });

  // PINs
  const pins = [
    { code: "REC001", label: "HR Team - Recruiters", type: "RECRUITER" },
    { code: "REC002", label: "Engineering Lead", type: "RECRUITER" },
    { code: "APP001", label: "General Applicant Portal", type: "APPLICANT" },
    { code: "APP002", label: "Engineering Applicants", type: "APPLICANT" },
  ];
  for (const p of pins) {
    await prisma.pin.upsert({
      where: { code: p.code },
      update: {},
      create: { organisationId: org.id, ...p },
    });
  }
  console.log("PINs: REC001, REC002, APP001, APP002");

  const appPin = await prisma.pin.findUnique({ where: { code: "APP001" } });

  // Jobs
  const jobs = [
    { title: "Senior Software Engineer", department: "Engineering", location: "London, UK", workMode: "HYBRID", experienceLevel: "Senior", description: "Build and scale AI-powered SaaS products. Full-stack role working with React, Node.js, PostgreSQL, and AWS.", requirements: { mustHave: ["5+ years software engineering", "TypeScript/JavaScript", "React", "Node.js", "PostgreSQL"], niceToHave: ["AI/ML integrations", "Docker", "AWS", "Team leadership"] }, salaryRange: { min: 65000, max: 85000, currency: "GBP" }, teamNotes: "Small team of 6, weekly code reviews, pragmatic solutions." },
    { title: "Product Designer", department: "Design", location: "London, UK", workMode: "HYBRID", experienceLevel: "Mid", description: "Design intuitive interfaces for enterprise SaaS products. Work closely with engineering and product teams.", requirements: { mustHave: ["3+ years product design", "Figma proficiency", "Design systems experience", "User research skills"], niceToHave: ["SaaS experience", "Motion design", "Front-end development skills"] }, salaryRange: { min: 50000, max: 65000, currency: "GBP" } },
    { title: "DevOps Engineer", department: "Engineering", location: "Remote", workMode: "REMOTE", experienceLevel: "Senior", description: "Own our AWS infrastructure, CI/CD pipelines, and deployment automation. Docker, Terraform, and monitoring.", requirements: { mustHave: ["AWS (EC2, RDS, S3, ECS)", "Docker and containerisation", "CI/CD pipelines", "Linux administration", "Terraform or CloudFormation"], niceToHave: ["Kubernetes", "Monitoring (Grafana, Prometheus)", "Cost optimisation"] }, salaryRange: { min: 70000, max: 90000, currency: "GBP" } },
    { title: "Data Analyst", department: "Data", location: "London, UK", workMode: "HYBRID", experienceLevel: "Mid", description: "Analyse product usage, customer behaviour, and operational metrics. Build dashboards and deliver insights.", requirements: { mustHave: ["SQL proficiency", "Python or R", "Data visualisation (Tableau/Looker)", "Statistical analysis"], niceToHave: ["Machine learning basics", "dbt", "BigQuery or Snowflake"] }, salaryRange: { min: 45000, max: 60000, currency: "GBP" } },
    { title: "Customer Success Manager", department: "Customer Success", location: "London, UK", workMode: "ONSITE", experienceLevel: "Mid", description: "Manage relationships with enterprise clients. Drive adoption, retention, and upsell opportunities.", requirements: { mustHave: ["3+ years customer success or account management", "Enterprise SaaS experience", "Strong communication skills", "CRM experience (HubSpot/Salesforce)"], niceToHave: ["Technical background", "Logistics/fleet industry knowledge"] }, salaryRange: { min: 40000, max: 55000, currency: "GBP" } },
    { title: "Frontend Developer", department: "Engineering", location: "London, UK", workMode: "HYBRID", experienceLevel: "Mid", description: "Build polished, performant UIs with React and TypeScript. Component library development and design system implementation.", requirements: { mustHave: ["3+ years React", "TypeScript", "CSS/SASS", "REST API integration"], niceToHave: ["Ant Design", "Storybook", "Testing (Jest/Playwright)", "Accessibility"] }, salaryRange: { min: 50000, max: 70000, currency: "GBP" } },
    { title: "Backend Developer", department: "Engineering", location: "Remote", workMode: "REMOTE", experienceLevel: "Senior", description: "Design and build scalable APIs and microservices. Node.js, PostgreSQL, and cloud infrastructure.", requirements: { mustHave: ["5+ years backend development", "Node.js/Express", "PostgreSQL", "API design", "Authentication/authorisation"], niceToHave: ["Prisma ORM", "Redis", "Message queues", "GraphQL"] }, salaryRange: { min: 60000, max: 80000, currency: "GBP" } },
    { title: "QA Engineer", department: "Engineering", location: "London, UK", workMode: "HYBRID", experienceLevel: "Mid", description: "Build and maintain automated test suites. Manual and automated testing across web and mobile platforms.", requirements: { mustHave: ["3+ years QA experience", "Automated testing (Cypress/Playwright)", "API testing", "Test planning"], niceToHave: ["Mobile testing", "Performance testing", "CI/CD integration"] }, salaryRange: { min: 45000, max: 60000, currency: "GBP" } },
    { title: "Marketing Manager", department: "Marketing", location: "London, UK", workMode: "HYBRID", experienceLevel: "Senior", description: "Lead B2B marketing strategy for SaaS products. Content, demand generation, events, and brand management.", requirements: { mustHave: ["5+ years B2B marketing", "Content marketing", "Demand generation", "Marketing automation (HubSpot)"], niceToHave: ["SaaS marketing", "Event management", "SEO/SEM", "Analytics"] }, salaryRange: { min: 55000, max: 75000, currency: "GBP" } },
    { title: "Technical Writer", department: "Product", location: "Remote", workMode: "REMOTE", experienceLevel: "Mid", description: "Create clear, comprehensive documentation for APIs, user guides, and internal knowledge base.", requirements: { mustHave: ["3+ years technical writing", "API documentation", "Markdown/docs-as-code", "Strong English writing"], niceToHave: ["Software development background", "Video tutorials", "Docs tooling (Docusaurus, GitBook)"] }, salaryRange: { min: 40000, max: 55000, currency: "GBP" } },
    { title: "Head of Engineering", department: "Engineering", location: "London, UK", workMode: "HYBRID", experienceLevel: "Director", description: "Lead the engineering organisation. Hiring, architecture decisions, technical strategy, and team growth.", requirements: { mustHave: ["10+ years software engineering", "5+ years engineering leadership", "Hiring and team building", "Architecture and technical strategy"], niceToHave: ["SaaS experience", "AI/ML products", "Multi-product platform experience"] }, salaryRange: { min: 100000, max: 130000, currency: "GBP" } },
    { title: "Sales Development Representative", department: "Sales", location: "London, UK", workMode: "ONSITE", experienceLevel: "Junior", description: "Generate qualified leads through outbound prospecting. Phone, email, and LinkedIn outreach.", requirements: { mustHave: ["Strong communication skills", "Resilience and self-motivation", "CRM experience"], niceToHave: ["B2B sales experience", "SaaS industry knowledge", "Cold calling experience"] }, salaryRange: { min: 25000, max: 35000, currency: "GBP" } },
  ];

  const jobIds = [];
  for (const j of jobs) {
    const job = await prisma.job.create({
      data: { organisationId: org.id, ...j, status: "OPEN" },
    });
    jobIds.push(job.id);
  }
  console.log(`${jobs.length} jobs created`);

  // Candidates
  const candidates = [
    { name: "Alex Thompson", email: "alex.thompson@email.com", currentRole: "Senior Full-Stack Developer", currentCompany: "Fintech Startup", yearsExp: 7, skills: ["React", "Node.js", "TypeScript", "PostgreSQL", "AWS", "Docker", "GraphQL"], noticePeriod: "1 month" },
    { name: "Priya Sharma", email: "priya.s@email.com", currentRole: "Lead Software Engineer", currentCompany: "Enterprise SaaS Co", yearsExp: 9, skills: ["React", "Python", "TypeScript", "AWS", "Kubernetes", "CI/CD", "Team Leadership"], noticePeriod: "3 months" },
    { name: "Marcus Johnson", email: "marcus.j@email.com", currentRole: "Product Designer", currentCompany: "Design Agency", yearsExp: 5, skills: ["Figma", "Design Systems", "User Research", "Prototyping", "CSS", "Accessibility"], noticePeriod: "1 month" },
    { name: "Sophie Chen", email: "sophie.chen@email.com", currentRole: "DevOps Engineer", currentCompany: "Cloud Platform Co", yearsExp: 6, skills: ["AWS", "Docker", "Terraform", "Kubernetes", "Linux", "CI/CD", "Monitoring"], noticePeriod: "2 months" },
    { name: "James Wilson", email: "james.w@email.com", currentRole: "Frontend Developer", currentCompany: "E-commerce Platform", yearsExp: 4, skills: ["React", "TypeScript", "CSS", "Ant Design", "Jest", "Storybook"], noticePeriod: "1 month" },
    { name: "Fatima Al-Hassan", email: "fatima.h@email.com", currentRole: "Data Analyst", currentCompany: "Consulting Firm", yearsExp: 4, skills: ["SQL", "Python", "Tableau", "Statistical Analysis", "dbt", "BigQuery"], noticePeriod: "1 month" },
    { name: "Oliver Brown", email: "oliver.b@email.com", currentRole: "Customer Success Lead", currentCompany: "SaaS Startup", yearsExp: 6, skills: ["Account Management", "Enterprise SaaS", "HubSpot", "Onboarding", "Churn Reduction"], noticePeriod: "2 months" },
    { name: "Emma Davis", email: "emma.d@email.com", currentRole: "QA Engineer", currentCompany: "Fintech Co", yearsExp: 4, skills: ["Cypress", "Playwright", "API Testing", "Test Planning", "CI/CD", "JIRA"], noticePeriod: "1 month" },
    { name: "Raj Patel", email: "raj.p@email.com", currentRole: "Backend Developer", currentCompany: "Logistics Tech", yearsExp: 6, skills: ["Node.js", "Express", "PostgreSQL", "Redis", "Docker", "API Design", "Prisma"], noticePeriod: "1 month" },
    { name: "Chloe Martin", email: "chloe.m@email.com", currentRole: "Marketing Manager", currentCompany: "B2B SaaS Co", yearsExp: 7, skills: ["Content Marketing", "Demand Gen", "HubSpot", "SEO", "Events", "Analytics"], noticePeriod: "1 month" },
    { name: "Daniel Kim", email: "daniel.k@email.com", currentRole: "Full-Stack Developer", currentCompany: "Agency", yearsExp: 3, skills: ["React", "Node.js", "MongoDB", "CSS", "Git"], noticePeriod: "2 weeks" },
    { name: "Sarah O'Brien", email: "sarah.ob@email.com", currentRole: "Technical Writer", currentCompany: "Developer Tools Co", yearsExp: 5, skills: ["API Documentation", "Markdown", "Docusaurus", "Technical Writing", "Video Tutorials"], noticePeriod: "1 month" },
    { name: "Tom Richards", email: "tom.r@email.com", currentRole: "Junior Developer", currentCompany: "Bootcamp Graduate", yearsExp: 1, skills: ["JavaScript", "React", "HTML", "CSS", "Git"], noticePeriod: "Immediate" },
    { name: "Nina Petrova", email: "nina.p@email.com", currentRole: "Senior Backend Engineer", currentCompany: "Scale-up", yearsExp: 8, skills: ["Node.js", "TypeScript", "PostgreSQL", "Redis", "Microservices", "AWS", "Docker"], noticePeriod: "2 months" },
    { name: "Liam Taylor", email: "liam.t@email.com", currentRole: "VP Engineering", currentCompany: "Series B Startup", yearsExp: 14, skills: ["Engineering Leadership", "Hiring", "Architecture", "Node.js", "AWS", "Team Building", "Agile"], noticePeriod: "3 months" },
    { name: "Aisha Mohammed", email: "aisha.m@email.com", currentRole: "UX Researcher", currentCompany: "Product Studio", yearsExp: 4, skills: ["User Research", "Usability Testing", "Figma", "Survey Design", "Data Analysis"], noticePeriod: "1 month" },
    { name: "Ben Cooper", email: "ben.c@email.com", currentRole: "SDR", currentCompany: "SaaS Co", yearsExp: 2, skills: ["Cold Calling", "LinkedIn Outreach", "Salesforce", "Email Campaigns", "Prospecting"], noticePeriod: "2 weeks" },
    { name: "Hannah Wright", email: "hannah.w@email.com", currentRole: "Mid Frontend Developer", currentCompany: "Health Tech", yearsExp: 3, skills: ["React", "TypeScript", "Tailwind CSS", "Testing", "Accessibility"], noticePeriod: "1 month" },
    { name: "Chris Evans", email: "chris.e@email.com", currentRole: "Platform Engineer", currentCompany: "Cloud Native Co", yearsExp: 7, skills: ["AWS", "Terraform", "Docker", "Kubernetes", "Python", "Monitoring", "Linux"], noticePeriod: "1 month" },
    { name: "Jessica Taylor", email: "jessica.t@email.com", currentRole: "Senior Product Designer", currentCompany: "Enterprise Software", yearsExp: 8, skills: ["Figma", "Design Systems", "User Research", "Prototyping", "Design Thinking", "Motion Design"], noticePeriod: "2 months" },
    { name: "Mike Patterson", email: "mike.p@email.com", currentRole: "Data Engineer", currentCompany: "Analytics Co", yearsExp: 5, skills: ["Python", "SQL", "Snowflake", "dbt", "Airflow", "Spark"], noticePeriod: "1 month" },
    { name: "Laura Mitchell", email: "laura.m@email.com", currentRole: "Content Marketer", currentCompany: "Startup", yearsExp: 3, skills: ["Content Writing", "SEO", "Social Media", "HubSpot", "Analytics"], noticePeriod: "2 weeks" },
    { name: "David Nguyen", email: "david.n@email.com", currentRole: "Senior QA Automation", currentCompany: "Banking Platform", yearsExp: 7, skills: ["Selenium", "Cypress", "API Testing", "Performance Testing", "CI/CD", "Test Strategy"], noticePeriod: "1 month" },
    { name: "Rebecca Foster", email: "rebecca.f@email.com", currentRole: "Account Executive", currentCompany: "B2B SaaS", yearsExp: 5, skills: ["Enterprise Sales", "Salesforce", "Negotiation", "Presentations", "Pipeline Management"], noticePeriod: "1 month" },
  ];

  // Build anonymised profiles
  function buildProfile(c) {
    const seniority = c.yearsExp < 2 ? "Junior" : c.yearsExp < 5 ? "Mid" : c.yearsExp < 8 ? "Senior" : c.yearsExp < 12 ? "Lead" : "Director";
    return {
      candidateId: null, // will be set after create
      skills: c.skills,
      yearsExperience: c.yearsExp,
      seniorityLevel: seniority,
      experienceEntries: [{ role: c.currentRole, industry: "Technology", companySize: "SME", duration: `${Math.min(c.yearsExp, 4)} years`, highlights: [] }],
      education: [{ level: "BSc", field: "Related Field", classification: "2:1" }],
      certifications: [],
      workPreference: "HYBRID",
      noticePeriod: c.noticePeriod || "1 month",
      summary: `${seniority}-level professional with ${c.yearsExp} years experience. Currently working as ${c.currentRole}. Key skills include ${c.skills.slice(0, 3).join(", ")}.`,
    };
  }

  for (const c of candidates) {
    const profile = buildProfile(c);
    const candidate = await prisma.candidate.create({
      data: {
        organisationId: org.id,
        pinId: appPin.id,
        name: c.name,
        email: c.email,
        currentRole: c.currentRole,
        currentCompany: c.currentCompany,
        yearsExp: c.yearsExp,
        skills: c.skills,
        noticePeriod: c.noticePeriod,
        profile: { ...profile, candidateId: undefined },
      },
    });
    // Update profile with actual ID
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { profile: { ...profile, candidateId: candidate.id } },
    });
  }
  console.log(`${candidates.length} candidates created`);

  // Talent tags
  const tags = [
    { name: "Strong Technical", color: "#3b82f6" },
    { name: "Leadership Potential", color: "#8b5cf6" },
    { name: "Revisit Later", color: "#f59e0b" },
    { name: "Culture Fit", color: "#10b981" },
    { name: "Senior Hire", color: "#ef4444" },
  ];
  for (const t of tags) {
    await prisma.talentTag.upsert({
      where: { organisationId_name: { organisationId: org.id, name: t.name } },
      update: {},
      create: { organisationId: org.id, ...t },
    });
  }
  console.log(`${tags.length} talent tags created`);

  // Share link
  await prisma.shareLink.upsert({
    where: { code: "DEMO1234" },
    update: {},
    create: { organisationId: org.id, code: "DEMO1234", label: "Demo - Hiring Manager View" },
  });

  console.log("\n=== Seed Complete ===");
  console.log("Recruiter PINs: REC001, REC002");
  console.log("Applicant PINs: APP001, APP002");
  console.log("Share Link: DEMO1234");
  console.log(`Jobs: ${jobs.length}`);
  console.log(`Candidates: ${candidates.length}`);
  console.log(`Talent Tags: ${tags.length}`);
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
