import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST() {
  try {
    const session = await getSessionFromCookies(await cookies());
    if (!session?.isAdmin || session?.destination !== "bi") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const token = crypto.randomBytes(32).toString("hex");
    await supabase.from("handoff_tokens").insert({
      token,
      username: "Administrador",
      role: "admin",
    });

    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "Error generando token" }, { status: 500 });
  }
}
