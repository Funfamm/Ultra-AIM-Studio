import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Mail } from "lucide-react";
import { getTemplate } from "@/lib/actions/email-templates";
import TemplateForm from "./template-form";
import type { Metadata } from "next";
import "../templates.css";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: id === "new" ? "New Template — Admin" : "Edit Template — Admin" };
}

export default async function TemplateEditPage({ params }: Props) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) notFound();

  const { id } = await params;
  const isNew = id === "new";

  const existing = isNew ? null : await getTemplate(id);
  if (!isNew && !existing) notFound();

  return (
    <div className="tmpl-edit-page">
      <Link href="/admin/email/templates" className="tmpl-back">
        <ChevronLeft size={14} /> All Templates
      </Link>

      <div className="tmpl-edit-head">
        <Mail size={16} />
        <h1>{isNew ? "New Email Template" : "Edit Template"}</h1>
      </div>

      {isNew ? (
        <p className="tmpl-edit-sub">
          Create a reusable email template. Use <strong>{"{{variableName}}"}</strong> placeholders
          in the subject and body — they are substituted at send time.
        </p>
      ) : (
        <p className="tmpl-edit-sub">
          Editing <strong>{existing!.label ?? existing!.name}</strong>
          {existing!.isSystem && " — system template, protected from deletion"}
        </p>
      )}

      <TemplateForm existing={existing} redirectOnCreate={isNew} />
    </div>
  );
}
