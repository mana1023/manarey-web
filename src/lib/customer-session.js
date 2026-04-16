import crypto from "crypto";

export const CUSTOMER_SESSION_COOKIE = "manarey_customer";

function getSecret() {
  return process.env.SESSION_SECRET || "manarey-session-secret-2026";
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function createCustomerToken(customer) {
  const payload = Buffer.from(
    JSON.stringify({ ...customer, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }),
  ).toString("base64url");
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function parseCustomerToken(token) {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (
    expected.length !== sig.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  )
    return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed?.exp || Number(parsed.exp) < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getCustomerFromCookies(cookieStore) {
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  return parseCustomerToken(token) || null;
}

export function useSecureCookies() {
  return process.env.NODE_ENV === "production";
}
