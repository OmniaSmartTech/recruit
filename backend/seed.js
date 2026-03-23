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

  // Create default scoring config
  await prisma.scoringConfig.upsert({
    where: { organisationId: org.id },
    update: {},
    create: {
      organisationId: org.id,
      weightSkills: 35,
      weightExperience: 30,
      weightQualifications: 20,
      weightCulturalFit: 15,
    },
  });

  console.log("Scoring config created");

  // Create a sample job
  const job = await prisma.job.upsert({
    where: { id: "sample-job-1" },
    update: {},
    create: {
      id: "sample-job-1",
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
      teamNotes: "Small, tight-knit engineering team of 6. We do weekly code reviews, fortnightly sprints, and value pragmatic solutions over perfect ones.",
      status: "OPEN",
    },
  });

  console.log(`Sample job: ${job.title}`);

  // Create a sample share link
  await prisma.shareLink.upsert({
    where: { code: "DEMO1234" },
    update: {},
    create: {
      organisationId: org.id,
      code: "DEMO1234",
      label: "Demo - Hiring Manager View",
      isActive: true,
    },
  });

  console.log("Sample share link: DEMO1234");
  console.log("\nSeed complete!");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
