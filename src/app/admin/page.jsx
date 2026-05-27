import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import AdminOrdersPanel from "./AdminOrdersPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSessionFromCookies(await cookies());
  if (!session.isAdmin) {
    redirect("/");
  }

  return <AdminOrdersPanel />;
}
