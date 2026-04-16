import { cookies } from "next/headers";
import { getCustomerFromCookies } from "@/lib/customer-session";
import { CheckoutFlow } from "@/components/checkout-flow";

export const metadata = {
  title: "Finalizar compra | Manarey",
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const customer = await getCustomerFromCookies(await cookies());

  return <CheckoutFlow initialCustomer={customer} />;
}
