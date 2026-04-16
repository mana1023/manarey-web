import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCustomerFromCookies } from "@/lib/customer-session";

export async function GET() {
  try {
    const customer = await getCustomerFromCookies(await cookies());
    if (!customer) {
      return NextResponse.json({ customer: null });
    }
    return NextResponse.json({ customer });
  } catch {
    return NextResponse.json({ customer: null });
  }
}
