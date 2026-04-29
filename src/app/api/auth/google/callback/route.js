import { NextResponse } from "next/server";
import { findOrCreateGoogleCustomer } from "@/lib/customer-auth";
import { createCustomerToken, CUSTOMER_SESSION_COOKIE, useSecureCookies } from "@/lib/customer-session";
import { storeSettings } from "@/lib/store-config";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${storeSettings.siteUrl}/checkout?auth_error=sin_codigo`);
  }

  try {
    const redirectUri = `${storeSettings.siteUrl}/api/auth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error("No se recibio access_token de Google.");
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    const customer = await findOrCreateGoogleCustomer({
      googleId: String(userData.id),
      email: userData.email || "",
      nombre: userData.given_name || userData.name || "",
      apellido: userData.family_name || "",
    });

    const token = createCustomerToken({
      id: customer.id,
      email: customer.email,
      nombre: customer.nombre,
      apellido: customer.apellido,
      telefono: customer.telefono,
    });

    // Redirigir al catálogo (inicio) en lugar de checkout para no confundir al usuario
    const response = NextResponse.redirect(`${storeSettings.siteUrl}/`);
    response.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: useSecureCookies(),
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch {
    return NextResponse.redirect(`${storeSettings.siteUrl}/?auth_error=fallo_google`);
  }
}
