import { cookies } from "next/headers";
import { CatalogClient } from "@/components/catalog-client";
import { getCatalogProducts } from "@/lib/products";
import { getSessionFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sessionPromise = getSessionFromCookies(await cookies());
  let productos = [];
  let catalogError = false;

  try {
    productos = await getCatalogProducts();
  } catch {
    catalogError = true;
  }

  const session = await sessionPromise;

  return <CatalogClient initialProducts={productos} session={session} catalogError={catalogError} />;
}
