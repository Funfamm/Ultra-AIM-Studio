import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import "./email-admin.css";

import TabOverview    from "./tab-overview";
import TabSuppression from "./tab-suppression";
import TabLogs        from "./tab-logs";
import TabQueue       from "./tab-queue";
import TabTemplates   from "./tab-templates";
import TabImport      from "./tab-import";
import TabSettings    from "./tab-settings";

export const metadata: Metadata = { title: "Email — Admin" };

type Tab = "overview" | "suppression" | "logs" | "queue" | "templates" | "import" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",    label: "Overview"    },
  { id: "suppression", label: "Suppression" },
  { id: "logs",        label: "Logs"        },
  { id: "queue",       label: "Queue"       },
  { id: "templates",   label: "Templates"   },
  { id: "import",      label: "Import"      },
  { id: "settings",    label: "Settings"    },
];

type Props = {
  searchParams: Promise<{
    tab?:      string;
    status?:   string;
    type?:     string;
    imported?: string;
    skipped?:  string;
    error?:    string;
  }>;
};

export default async function AdminEmailPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) notFound();

  const params  = await searchParams;
  const rawTab  = (params.tab ?? "overview") as Tab;
  const tab: Tab = TABS.some((t) => t.id === rawTab) ? rawTab : "overview";

  // Logs tab filters
  const rawStatus    = (params.status ?? "ALL").toUpperCase();
  const statusFilter = (["ALL","SENT","FAILED","SUPPRESSED","QUEUED","SKIPPED"].includes(rawStatus) ? rawStatus : "ALL") as any;
  const typeFilter   = params.type ?? "";

  // Import tab result
  const imported = params.imported !== undefined ? parseInt(params.imported, 10) : undefined;
  const skipped  = params.skipped  !== undefined ? parseInt(params.skipped,  10) : undefined;
  const error    = params.error;

  return (
    <div className="email-page">
      <h1 className="admin-page-title">Email Command Center</h1>

      {/* ── Tab navigation ────────────────────────── */}
      <nav className="etab-nav" aria-label="Email admin tabs">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/email?tab=${t.id}`}
            className={`etab-link${tab === t.id ? " etab-link--active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* ── Tab content ───────────────────────────── */}
      {tab === "overview"    && <TabOverview />}
      {tab === "suppression" && <TabSuppression error={error} />}
      {tab === "logs"        && <TabLogs statusFilter={statusFilter} typeFilter={typeFilter} />}
      {tab === "queue"       && <TabQueue />}
      {tab === "templates"   && <TabTemplates />}
      {tab === "import"      && <TabImport imported={imported} skipped={skipped} error={error} />}
      {tab === "settings"    && <TabSettings />}
    </div>
  );
}
