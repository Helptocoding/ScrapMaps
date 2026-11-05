import { prisma } from "@/lib/prisma";

export async function ensureWorkspace() {
  return prisma.workspace.upsert({
    where: { name: "Personal Workspace" },
    update: {},
    create: { name: "Personal Workspace" },
  });
}
