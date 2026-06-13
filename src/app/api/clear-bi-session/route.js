import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, useSecureCookies } from "@/lib/session";

export async function GET() {
  const response = NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_BASE_URL || "https://www.manarey.com.ar"));
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies(),
    path: "/",
    maxAge: 0,
  });
  return response;
}
