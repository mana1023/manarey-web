import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import AdminOrdersPanel from "./AdminOrdersPanel";

export const dynamic = "force-dynamic";

// El manifest va sólo en el panel: en iPhone los avisos push necesitan la web
// agregada a la pantalla de inicio como app, y eso no tiene que cambiar cómo
// se comporta la tienda para los clientes.
export const metadata = {
  title: "Pedidos · Manarey",
  manifest: "/admin.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Pedidos Manarey", statusBarStyle: "default" },
};

export default async function AdminPage() {
  const session = await getSessionFromCookies(await cookies());
  if (!session.isAdmin) {
    redirect("/");
  }

  return <AdminOrdersPanel />;
}
