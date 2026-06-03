import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { GalleryThumbnails } from "lucide-react";
import MediaClient from "./media-client";
import "./admin-media.css";

export const metadata: Metadata = { title: "Admin — Media Manager" };

export default async function MediaManagerPage() {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) redirect("/login");

  const items = await prisma.pageMedia.findMany({
    orderBy: [{ page: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="mm-page">
      <div className="mm-head">
        <div className="mm-head-title">
          <GalleryThumbnails size={18} />
          <h1>Media Manager</h1>
        </div>
        <p className="mm-desc">Manage page backgrounds and hero assets.</p>
      </div>

      {/* JSON.parse/stringify converts Prisma Date objects to plain strings for client */}
      <MediaClient initialItems={JSON.parse(JSON.stringify(items))} />
    </div>
  );
}
