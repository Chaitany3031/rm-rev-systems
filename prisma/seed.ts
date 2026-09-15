import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RM_SOLUTION_SERVICES = [
  {
    name: "Website Development",
    description: "Professional & Responsive Websites",
    order: 1,
    isActive: true,
  },
  {
    name: "CRM Software",
    description: "Manage Leads, Customers & Sales",
    order: 2,
    isActive: true,
  },
  {
    name: "AI Chatbots",
    description: "Smart Chatbots for Your Business",
    order: 3,
    isActive: true,
  },
  {
    name: "WhatsApp Automation",
    description: "Automate & Grow Your Business",
    order: 4,
    isActive: true,
  },
  {
    name: "AI Voice Agents",
    description: "Smart Voice Solutions",
    order: 5,
    isActive: true,
  },
  {
    name: "Business Automation",
    description: "Save Time, Increase Productivity",
    order: 6,
    isActive: true,
  },
  {
    name: "Google Business Profile Setup & Optimization",
    description: "Setup, verification & local search optimization",
    order: 7,
    isActive: true,
  },
  {
    name: "Google Ads Management",
    description: "Targeted PPC campaigns & performance tracking",
    order: 8,
    isActive: true,
  },
  {
    name: "Meta Ads (Facebook & Instagram Ads)",
    description: "Paid social campaigns across Facebook & Instagram",
    order: 9,
    isActive: true,
  },
];

async function main() {
  console.log("Seeding development tenant: RM Solution...");

  const tenant = await prisma.tenant.upsert({
    where: { slug: "rm-solution" },
    update: {
      name: "RM Solution",
      description: "Digital systems, automation & AI solutions for modern businesses",
      publicToken: "rm-solution-dev",
    },
    create: {
      name: "RM Solution",
      slug: "rm-solution",
      publicToken: "rm-solution-dev",
      description: "Digital systems, automation & AI solutions for modern businesses",
    },
  });

  console.log(`Tenant created/updated: ${tenant.name} (${tenant.id}) with publicToken: ${tenant.publicToken}`);

  for (const service of RM_SOLUTION_SERVICES) {
    const existing = await prisma.service.findFirst({
      where: {
        tenantId: tenant.id,
        name: service.name,
      },
    });

    if (existing) {
      await prisma.service.update({
        where: { id: existing.id },
        data: {
          description: service.description,
          order: service.order,
          isActive: service.isActive,
        },
      });
    } else {
      await prisma.service.create({
        data: {
          tenantId: tenant.id,
          name: service.name,
          description: service.description,
          order: service.order,
          isActive: service.isActive,
        },
      });
    }
  }

  console.log(`Seeded ${RM_SOLUTION_SERVICES.length} services for RM Solution.`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
