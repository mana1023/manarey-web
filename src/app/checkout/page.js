import { cookies } from "next/headers";
import { getCustomerFromCookies } from "@/lib/customer-session";
import { getSessionFromCookies } from "@/lib/session";
import { CheckoutFlow } from "@/components/checkout-flow";

export const metadata = {
  title: "Finalizar compra | Manarey",
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cookieStore = await cookies();
  const customer = await getCustomerFromCookies(cookieStore);
  const adminSession = await getSessionFromCookies(cookieStore);

  // Si es admin, crear un cliente ficticio para saltear el paso de auth
  const effectiveCustomer = customer || (adminSession?.isAdmin ? {
    email: adminSession.username,
    nombre: "Admin",
    apellido: "",
    telefono: "",
  } : null);

  return <CheckoutFlow initialCustomer={effectiveCustomer} />;
}
