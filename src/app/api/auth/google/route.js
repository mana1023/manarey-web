import { NextResponse } from "next/server";
import { storeSettings } from "@/lib/store-config";

export async function GET() {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth no esta configurado. Agrega GOOGLE_CLIENT_ID al .env.local" },
      { status: 500 },
    );
  }

  const redirectUri = `${storeSettings.siteUrl}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
