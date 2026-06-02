import { cookies } from "next/headers";
import { CatalogClient } from "@/components/catalog-client";
import { getCatalogProducts } from "@/lib/products";
import { getSessionFromCookies, SESSION_COOKIE_NAME } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  let session = await getSessionFromCookies(cookieStore);

  // Si hay una cookie vieja de "Administrador" (BI), borrarla automáticamente.
  // El login de BI no debe guardar sesión en la web.
  if (session?.destination === "bi") {
    cookieStore.delete(SESSION_COOKIE_NAME);
    session = { username: "", isAdmin: false, role: "guest" };
  }

  let productos = [];
  let catalogError = false;
  try {
    productos = await getCatalogProducts();
  } catch {
    catalogError = true;
  }

  return <CatalogClient initialProducts={productos} session={session} catalogError={catalogError} />;
}
