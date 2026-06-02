import { NextResponse } from "next/server";
import { authenticateUser, createSessionToken, SESSION_COOKIE_NAME, useSecureCookies } from "@/lib/session";
import { query } from "@/lib/db";
import crypto from "crypto";

const attemptsByIp = globalThis.manareyLoginAttempts || new Map();
if (!globalThis.manareyLoginAttempts) globalThis.manareyLoginAttempts = attemptsByIp;

function getClientIp(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
function isRateLimited(ip) {
  const entry = attemptsByIp.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) { attemptsByIp.delete(ip); return false; }
  return entry.count >= 5;
}
function registerFailedAttempt(ip) {
  const current = attemptsByIp.get(ip);
  if (!current || Date.now() > current.resetAt) {
    attemptsByIp.set(ip, { count: 1, resetAt: Date.now() + 1000 * 60 * 10 });
    return;
  }
  attemptsByIp.set(ip, { ...current, count: current.count + 1 });
}
function clearAttempts(ip) { attemptsByIp.delete(ip); }

// Usa la conexión PostgreSQL directa (DATABASE_URL) que ya tiene la web
async function createHandoffToken() {
  try {
    const token = crypto.randomBytes(32).toString("hex");
    await query(
      `INSERT INTO public.handoff_tokens (token, username, role)
       VALUES ($1, $2, $3)`,
      [token, "Administrador", "admin"]
    );
    return token;
  } catch (err) {
    console.error("[handoff] error creando token:", err?.message ?? err);
    return null;
  }
}

export async function POST(request) {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const session = await authenticateUser(body);

    if (!session) {
      registerFailedAttempt(ip);
      return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
    }

    clearAttempts(ip);

    // Si es admin de BI → crear handoff token para auto-login en el panel
    let handoffToken = null;
    if (session.destination === "bi") {
      handoffToken = await createHandoffToken();
    }

    const response = NextResponse.json({ session, handoffToken });

    // Solo guardar sesión en la web si es el admin del editor (email)
    if (session.destination !== "bi") {
      response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(session), {
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookies(),
        path: "/",
        maxAge: 60 * 60 * 24 * 14,
      });
    }

    return response;
  } catch (err) {
    console.error("[login] error:", err?.message ?? err);
    return NextResponse.json({ error: "No se pudo iniciar sesion." }, { status: 500 });
  }
}
