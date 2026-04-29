import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";
// Vercel Blob no usa el body de la request — recibe el stream directamente
export const maxDuration = 60;

export async function POST(request) {
  // Solo admins pueden subir archivos
  const session = await getSessionFromCookies(await cookies());
  if (!session.isAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }

    // Validar tipo — imágenes y videos
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: "Solo se aceptan imágenes o videos." }, { status: 400 });
    }

    // Validar tamaño — 20MB para imágenes, 200MB para videos
    const maxSize = isVideo ? 200 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: isVideo ? "El video no puede superar 200MB." : "La imagen no puede superar 20MB." },
        { status: 400 },
      );
    }

    // Nombre de archivo seguro con timestamp
    const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
    const folder = isVideo ? "productos/video" : "productos/foto";
    const filename = `${folder}-${Date.now()}.${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      contentType: file.type,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("[upload-media] Error:", err?.message || err);
    return NextResponse.json(
      { error: "No se pudo subir el archivo. Verificá que Vercel Blob esté configurado." },
      { status: 500 },
    );
  }
}
