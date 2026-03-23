const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function seed() {
  console.log("Seeding RecruitSmart database...");

  // Create default AIOne organisation
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
  console.log(`Organisation: ${org.name} (${org.id})`);

  // Create scoring config
  await prisma.scoringConfig.upsert({
    where: { organisationId: org.id },
    update: {},
    create: {
      organisationId: org.id,
      weightSkills: 35,
      weightExperience: 30,
      weightQualifications: 20,
      weightCulturalFit: 15,
      preFilterTopN: 50,
    },
  });
  console.log("Scoring config created");

  // Create a Recruiter PIN
  await prisma.pin.upsert({
    where: { code: "REC001" },
    update: {},
    create: {
      organisationId: org.id,
      code: "REC001",
      label: "HR Team - Recruiters",
      type: "RECRUITER",
    },
  });
  console.log("Recruiter PIN: REC001");

  // Create an Applicant PIN
  await prisma.pin.upsert({
    where: { code: "APP001" },
    update: {},
    create: {
      organisationId: org.id,
      code: "APP001",
      label: "General Applicant Portal",
      type: "APPLICANT",
    },
  });
  console.log("Applicant PIN: APP001");

  // Create a sample job
  const jobId = "sample-job-1";
  await prisma.job.upsert({
    where: { id: jobId },
    update: {},
    create: {
      id: jobId,
      organisationId: org.id,
      title: "Senior Software Engineer",
      department: "Engineering",
      description: `We're looking for a Senior Software Engineer to join our growing team.
You'll work on building and scaling our AI-powered SaaS products, collaborating with product managers and designers.
The ideal candidate has strong full-stack experience, loves clean architecture, and thrives in a fast-paced startup environment.`,
      requirements: {
        mustHave: [
          "5+ years professional software engineering experience",
          "Strong TypeScript/JavaScript skills",
          "Experience with React and Node.js",
          "Database design (PostgreSQL preferred)",
          "REST API design and implementation",
        ],
        niceToHave: [
          "Experience with AI/ML integrations",
          "Docker and containerisation",
          "AWS cloud services",
          "Team leadership experience",
          "Startup experience",
        ],
      },
      salaryRange: { min: 65000, max: 85000, currency: "GBP" },
      location: "London, UK",
      workMode: "HYBRID",
      experienceLevel: "Senior",
      teamNotes: "Small, tight-knit engineering team of 6. Weekly code reviews, fortnightly sprints, pragmatic solutions.",
      status: "OPEN",
    },
  });
  console.log("Sample job: Senior Software Engineer");

  // Create a share link
  await prisma.shareLink.upsert({
    where: { code: "DEMO1234" },
    update: {},
    create: {
      organisationId: org.id,
      code: "DEMO1234",
      label: "Demo - Hiring Manager View",
    },
  });
  console.log("Share link: DEMO1234");

  console.log("\nSeed complete!");
  console.log("Recruiter PIN: REC001");
  console.log("Applicant PIN: APP001");
  console.log("Share Link: DEMO1234");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
