import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const domains = [
  {
    name: "Troop 42",
    color: "#16a34a",
    description: "BSA Troop 42 parent/leader communications",
    sortOrder: 0,
  },
  {
    name: "Heart of Dallas District",
    color: "#2563eb",
    description: "BSA district-level coordination",
    sortOrder: 1,
  },
  {
    name: "EducatOrr",
    color: "#9333ea",
    description: "EducatOrr nonprofit operations",
    sortOrder: 2,
  },
  {
    name: "Lake Highlands Church",
    color: "#dc2626",
    description: "Church volunteer and staff communications",
    sortOrder: 3,
  },
  {
    name: "SJES",
    color: "#ea580c",
    description: "St. John Episcopal School liaison",
    sortOrder: 4,
  },
  {
    name: "Personal",
    color: "#64748b",
    description: "Family and personal life",
    sortOrder: 5,
  },
];

async function main() {
  console.log("Seeding domains...");
  for (const domain of domains) {
    await prisma.domain.upsert({
      where: { name: domain.name },
      update: {},
      create: domain,
    });
  }
  console.log(`Seeded ${domains.length} domains.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
