// Permanent redirect — route moved to /admin/outreach (Phase 12)
import { permanentRedirect } from "next/navigation";

export default function AdminNotificationsRedirect() {
  permanentRedirect("/admin/outreach");
}
