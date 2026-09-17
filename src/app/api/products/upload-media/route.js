import { NextResponse } from "next/server";
import { handleUpload } from "@vercel/blob/client";
import { put } from "@vercel/blob";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { cloudinaryConfigurado, subirImagenACloudinary } from "@/lib/cloudinary";
import { supabaseStorageConfigurado, subirImagenASupabase } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cuando se pasa el límite del plan gratis, Vercel bloquea el almacenamiento y
// las subidas fallan con un error de "store suspended/blocked". Antes eso se
// mostraba como "Verificá que Vercel Blob esté configurado", que no le dice
// nada a quien está cargando fotos.
function mensajeDeError(err, porDefecto) {
  // Vercel tira BlobStoreSuspendedError: "Vercel Blob: This store has been suspended."
  const texto = `${err?.name || ""} ${err?.constructor?.name || ""} ${err?.message || err || ""}`;
  if (/suspended|blocked/i.test(texto)) {
    return "El espacio para fotos de la web está lleno y Vercel lo bloqueó. Avisale a Lautaro: hay que liberar espacio antes de subir más.";
  }
  return porDefecto;
}

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
            // 50 MB: el plan gratis tiene 1 GB para todas las fotos y videos,
            // y un solo video grande puede bloquear las fotos de toda la web.
            maximumSizeInBytes: 50 * 1024 * 1024,
            addRandomSuffix: true,
          };
        },
        onUploadCompleted: async () => {},
      });
      return NextResponse.json(jsonResponse);
    } catch (err) {
      console.error("[upload-media] Error generando token:", err?.message || err);
      return NextResponse.json(
        { error: mensajeDeError(err, err?.message || "No se pudo iniciar la subida.") },
        { status: 400 },
      );
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

    // Dónde va la foto nueva, en orden: Cloudinary, Supabase Storage y, si no
    // hay ninguno configurado, Vercel Blob como siempre. El plan gratis de
    // Vercel Blob es de 1 GB y al pasarlo bloqueó las fotos de toda la web.
    if (cloudinaryConfigurado()) {
      const url = await subirImagenACloudinary(file);
      return NextResponse.json({ url });
    }

    if (supabaseStorageConfigurado()) {
      const url = await subirImagenASupabase(file);
      return NextResponse.json({ url });
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
      { error: mensajeDeError(err, "No se pudo subir la foto. Probá de nuevo en un rato.") },
      { status: 500 },
    );
  }
}
