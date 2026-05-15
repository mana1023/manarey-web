import { NextResponse } from "next/server";
import { storeSettings } from "@/lib/store-config";

export async function GET(request) {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth no esta configurado. Agrega GOOGLE_CLIENT_ID al .env.local" },
      { status: 500 },
    );
  }

  // Tomar el returnTo de la query (ej. /checkout) y codificarlo en el state de OAuth.
  // Google devuelve el state sin modificar en el callback, lo que permite redirigir
  // al usuario al lugar correcto después del login.
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || "/";
  // Solo permitir rutas relativas para evitar open-redirect
  const safeReturn = returnTo.startsWith("/") ? returnTo : "/";

  const redirectUri = `${storeSettings.siteUrl}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state: safeReturn,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
