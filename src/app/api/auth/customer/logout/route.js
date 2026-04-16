import { NextResponse } from "next/server";
import { CUSTOMER_SESSION_COOKIE, useSecureCookies } from "@/lib/customer-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CUSTOMER_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies(),
    path: "/",
    maxAge: 0,
  });
  return response;
}
