import crypto from "crypto";
import { query } from "@/lib/db";

export const SESSION_COOKIE_NAME = "manarey_session";

function getSessionSecret() {
  const secret = (process.env.SESSION_SECRET || "").trim();

  if (!secret) {
    throw new Error("SESSION_SECRET no esta configurada.");
  }

  return secret;
}

function sign(value) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

export function createSessionToken(session) {
  const payload = Buffer.from(
    JSON.stringify({
      ...session,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
    }),
  ).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function parseSessionToken(token) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = sign(payload);
  const isValid =
    expectedSignature.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));

  if (!isValid) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed?.exp || Number(parsed.exp) < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(cookieStore) {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionToken(token);

  if (!session) {
    return { username: "", isAdmin: false, role: "guest" };
  }

  return session;
}

export function useSecureCookies() {
  return process.env.NODE_ENV === "production";
}

export async function authenticateUser({ username, password }) {
  const normalizedUsername = (username || "").trim();
  const normalizedPassword = (password || "").trim();

  if (!normalizedUsername || !normalizedPassword) {
    return null;
  }

  if (
    normalizedUsername.toLowerCase() === (process.env.ADMIN_EMAIL || "").trim().toLowerCase() &&
    normalizedPassword === (process.env.ADMIN_PASSWORD || "").trim()
  ) {
    return {
      username: normalizedUsername,
      role: "admin",
      isAdmin: true,
    };
  }

  const result = await query(
    `
      select username, role
      from public.usuarios
      where username = $1 and password = $2
      limit 1
    `,
    [normalizedUsername, normalizedPassword],
  );

  if (!result.rows[0]) {
    return null;
  }

  return {
    username: result.rows[0].username,
    role: result.rows[0].role || "user",
    isAdmin: false,
  };
}
