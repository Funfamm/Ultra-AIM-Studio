import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdminRole } from "@/lib/auth-guard";
import AdminSidebar from "@/components/admin-sidebar";
import "./admin-layout.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) redirect("/");

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <main className="admin-main">{children}</main>

    </div>
  );
}
