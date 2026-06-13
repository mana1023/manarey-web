import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CatalogClient } from "@/components/catalog-client";
import { getCatalogProducts } from "@/lib/products";
import { getSessionFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  let session = await getSessionFromCookies(cookieStore);

  // Si hay una cookie vieja de "Administrador" (BI), redirigir a la ruta
  // que la limpia. No se puede borrar cookies en un Server Component (Next.js 15).
  if (session?.destination === "bi") {
    redirect("/api/clear-bi-session");
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
