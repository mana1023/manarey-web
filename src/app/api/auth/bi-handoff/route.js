import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { query } from "@/lib/db";
import crypto from "crypto";

export async function POST() {
  try {
    const session = await getSessionFromCookies(await cookies());
    if (!session?.isAdmin || session?.destination !== "bi") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    await query(
      `INSERT INTO public.handoff_tokens (token, username, role)
       VALUES ($1, $2, $3)`,
      [token, "Administrador", "admin"]
    );

    return NextResponse.json({ token });
  } catch (err) {
    console.error("[bi-handoff] error:", err?.message ?? err);
    return NextResponse.json({ error: "Error generando token" }, { status: 500 });
  }
}
