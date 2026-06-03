// Audit log helper — fire-and-forget.
// Never throws; audit failures must never block the primary admin action.

import { prisma } from "@/lib/prisma";

export interface AuditEntry {
  actorId: string;
  actorEmail: string;
  targetId?: string;
  targetEmail?: string;
  action: string;
  detail?: string;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.adminAuditLog.create({ data: entry });
  } catch {
    // Intentionally swallowed — audit must never break the main action
  }
}
