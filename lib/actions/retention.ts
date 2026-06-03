"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── Types ─────────────────────────────────────────────────────

export type RetentionPreview = {
  emailLogs:         number;
  emailQueue:        number;
  notifications:     number;
  visitorEvents:     number;
  visitorSessions:   number;
  loginAttempts:     number;
  // protected — shown but never deleted
  auditLogs:         number;
  securityEvents:    number;
  suppressions:      number;
};

export type RetentionResult = {
  deleted: Partial<RetentionPreview>;
  error?:  string;
};

// ── Helpers ───────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function getRetentionSettings() {
  const s = await prisma.adminSettings.findUnique({
    where:  { id: "singleton" },
    select: {
      emailLogRetentionDays:     true,
      emailQueueRetentionDays:   true,
      notificationRetentionDays: true,
      visitorEventRetentionDays: true,
    },
  });
  return {
    emailLogDays:     s?.emailLogRetentionDays     ?? 90,
    emailQueueDays:   s?.emailQueueRetentionDays   ?? 30,
    notifDays:        s?.notificationRetentionDays ?? 90,
    visitorEventDays: s?.visitorEventRetentionDays ?? 90,
  };
}

// Login attempts older than 30 days are always safe to prune (per schema comment)
const LOGIN_ATTEMPT_RETENTION_DAYS = 30;

// ── Preview (admin) ───────────────────────────────────────────

export async function previewRetentionCleanup(): Promise<RetentionPreview> {
  await requireAdmin();
  const cfg = await getRetentionSettings();

  const [
    emailLogs,
    emailQueue,
    notifications,
    visitorEvents,
    visitorSessions,
    loginAttempts,
    auditLogs,
    securityEvents,
    suppressions,
  ] = await Promise.all([
    prisma.emailLog.count({
      where: { createdAt: { lt: daysAgo(cfg.emailLogDays) } },
    }),
    prisma.emailQueue.count({
      where: {
        status: { in: ["SENT", "FAILED", "SUPPRESSED", "SKIPPED"] },
        createdAt: { lt: daysAgo(cfg.emailQueueDays) },
      },
    }),
    // Only auto-clear read notifications past retention window
    prisma.notification.count({
      where: {
        read: true,
        createdAt: { lt: daysAgo(cfg.notifDays) },
      },
    }),
    prisma.analyticsEvent.count({
      where: { createdAt: { lt: daysAgo(cfg.visitorEventDays) } },
    }),
    prisma.visitorSession.count({
      where: { createdAt: { lt: daysAgo(cfg.visitorEventDays) } },
    }),
    prisma.loginAttempt.count({
      where: { createdAt: { lt: daysAgo(LOGIN_ATTEMPT_RETENTION_DAYS) } },
    }),
    // Protected — count only, never deleted
    prisma.adminAuditLog.count(),
    prisma.securityEvent.count(),
    prisma.emailSuppression.count(),
  ]);

  return {
    emailLogs,
    emailQueue,
    notifications,
    visitorEvents,
    visitorSessions,
    loginAttempts,
    auditLogs,
    securityEvents,
    suppressions,
  };
}

// ── Run cleanup (superadmin only) ────────────────────────────

export async function runRetentionCleanup(): Promise<RetentionResult> {
  const session = await auth();
  await requireSuperAdmin();
  const cfg = await getRetentionSettings();

  try {
    const [
      emailLogs,
      emailQueue,
      notifications,
      visitorEvents,
      visitorSessions,
      loginAttempts,
    ] = await Promise.all([
      prisma.emailLog.deleteMany({
        where: { createdAt: { lt: daysAgo(cfg.emailLogDays) } },
      }),
      prisma.emailQueue.deleteMany({
        where: {
          status: { in: ["SENT", "FAILED", "SUPPRESSED", "SKIPPED"] },
          createdAt: { lt: daysAgo(cfg.emailQueueDays) },
        },
      }),
      prisma.notification.deleteMany({
        where: {
          read: true,
          createdAt: { lt: daysAgo(cfg.notifDays) },
        },
      }),
      prisma.analyticsEvent.deleteMany({
        where: { createdAt: { lt: daysAgo(cfg.visitorEventDays) } },
      }),
      prisma.visitorSession.deleteMany({
        where: { createdAt: { lt: daysAgo(cfg.visitorEventDays) } },
      }),
      prisma.loginAttempt.deleteMany({
        where: { createdAt: { lt: daysAgo(LOGIN_ATTEMPT_RETENTION_DAYS) } },
      }),
    ]);

    // Audit log this cleanup
    await prisma.adminAuditLog.create({
      data: {
        actorId:    session!.user!.id!,
        actorEmail: session!.user!.email!,
        action:     "RETENTION_CLEANUP",
        detail: [
          `emailLogs:${emailLogs.count}`,
          `emailQueue:${emailQueue.count}`,
          `notifications:${notifications.count}`,
          `analyticsEvents:${visitorEvents.count}`,
          `visitorSessions:${visitorSessions.count}`,
          `loginAttempts:${loginAttempts.count}`,
        ].join(" "),
      },
    });

    revalidatePath("/admin/data");

    return {
      deleted: {
        emailLogs:       emailLogs.count,
        emailQueue:      emailQueue.count,
        notifications:   notifications.count,
        visitorEvents:   visitorEvents.count,
        visitorSessions: visitorSessions.count,
        loginAttempts:   loginAttempts.count,
      },
    };
  } catch (err) {
    return { deleted: {}, error: err instanceof Error ? err.message : "Cleanup failed." };
  }
}

// ── Save retention settings (admin) ──────────────────────────

export async function saveRetentionSettings(formData: FormData): Promise<void> {
  await requireAdmin();

  const parse = (key: string, min: number, max: number, fallback: number) => {
    const v = parseInt(formData.get(key) as string, 10);
    return isNaN(v) ? fallback : Math.min(max, Math.max(min, v));
  };

  await prisma.adminSettings.upsert({
    where:  { id: "singleton" },
    create: {
      id: "singleton",
      emailLogRetentionDays:     parse("emailLogRetentionDays",     1, 3650, 90),
      emailQueueRetentionDays:   parse("emailQueueRetentionDays",   1, 3650, 30),
      notificationRetentionDays: parse("notificationRetentionDays", 1, 3650, 90),
      visitorEventRetentionDays: parse("visitorEventRetentionDays", 1, 3650, 90),
    },
    update: {
      emailLogRetentionDays:     parse("emailLogRetentionDays",     1, 3650, 90),
      emailQueueRetentionDays:   parse("emailQueueRetentionDays",   1, 3650, 30),
      notificationRetentionDays: parse("notificationRetentionDays", 1, 3650, 90),
      visitorEventRetentionDays: parse("visitorEventRetentionDays", 1, 3650, 90),
    },
  });

  revalidatePath("/admin/data");
  revalidatePath("/admin/settings");
}
