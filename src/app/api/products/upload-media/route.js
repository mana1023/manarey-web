import { NextResponse } from "next/server";
import { handleUpload } from "@vercel/blob/client";
import { put } from "@vercel/blob";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  const session = await getSessionFromCookies(await cookies());
  if (!session.isAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") || "";

  // Client-side upload: el browser sube el video directo a Vercel Blob.
  // Aquí solo se genera/valida el token; el archivo nunca pasa por esta función.
  if (contentType.includes("application/json")) {
    try {
      const body = await request.json();
      const jsonResponse = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async (pathname) => {
          return {
            allowedContentTypes: ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/*"],
            maximumSizeInBytes: 500 * 1024 * 1024, // 500MB
            addRandomSuffix: true,
          };
        },
        onUploadCompleted: async () => {},
      });
      return NextResponse.json(jsonResponse);
    } catch (err) {
      console.error("[upload-media] Error generando token:", err?.message || err);
      return NextResponse.json({ error: err?.message || "No se pudo iniciar la subida." }, { status: 400 });
    }
  }

  // Upload directo vía FormData para imágenes (tamaño menor al límite de Vercel)
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }

    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      return NextResponse.json({ error: "Solo se aceptan imágenes por este método." }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "La imagen no puede superar 20MB." }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `productos/foto-${Date.now()}.${ext}`;

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
