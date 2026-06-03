// Server component — fetches session, unread count, upcoming flag, and registration setting
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Nav from "@/components/nav";
import { getUnreadNotificationCount } from "@/lib/actions/notifications";
import "./nav.css";

export default async function NavWrapper() {
  const session = await auth();

  const [unreadCount, upcomingCount, settings] = await Promise.all([
    session?.user?.id ? getUnreadNotificationCount() : Promise.resolve(0),
    prisma.work.count({
      where: { status: { in: ["UPCOMING", "IN_PRODUCTION"] }, type: { not: "EPISODE" } },
    }),
    prisma.adminSettings.findUnique({
      where: { id: "singleton" },
      select: { allowNewRegistrations: true },
    }),
  ]);

  return (
    <Nav
      user={session?.user ?? null}
      unreadCount={unreadCount}
      hasUpcoming={upcomingCount > 0}
      allowRegistrations={settings?.allowNewRegistrations ?? true}
    />
  );
}
