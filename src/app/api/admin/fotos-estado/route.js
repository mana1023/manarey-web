import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { usoDeCloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

/**
 * Estado del almacenamiento de fotos: si Cloudinary quedó bien configurado y
 * cuánto de su plan gratis se está usando, y si Vercel Blob sigue bloqueado.
 * Sirve para no tener que subir una foto de prueba para saber si anda.
 */
export async function GET() {
  const session = await getSessionFromCookies(await cookies());
  if (!session.isAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const cloudinary = await usoDeCloudinary().catch((err) => ({
    configurado: true,
    ok: false,
    error: err?.message || String(err),
  }));

  // Vercel Blob: se pide una foto conocida. 403 = el store sigue bloqueado.
  let vercelBlob = { revisado: false };
  const urlDePrueba = "https://dk1a48ivah8qjiky.public.blob.vercel-storage.com/productos/foto-1780083717336.jpeg";
  try {
    const res = await fetch(urlDePrueba, { method: "HEAD", cache: "no-store" });
    vercelBlob = { revisado: true, http: res.status, bloqueado: res.status === 403, fotosVisibles: res.ok };
  } catch (err) {
    vercelBlob = { revisado: true, error: err?.message || String(err) };
  }

  return NextResponse.json({
    dondeVanLasFotosNuevas: cloudinary.ok ? "Cloudinary" : "Vercel Blob",
    cloudinary,
    vercelBlob,
  });
}
