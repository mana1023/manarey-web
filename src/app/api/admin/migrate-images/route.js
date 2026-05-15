import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const session = await getSessionFromCookies(await cookies());
  if (!session.isAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const migrated = [];
  const errors = [];

  try {
    // Obtener todos los productos con imagen en base64
    const { rows } = await query(
      `SELECT product_key, image_data, images_data
       FROM productos_web_metadata
       WHERE image_data LIKE 'data:%' OR images_data LIKE '%data:%'`
    );

    for (const row of rows) {
      try {
        let newImageUrl = null;
        let newImagesData = null;

        // Migrar image_data principal
        if (row.image_data?.startsWith("data:")) {
          newImageUrl = await uploadBase64(row.image_data, row.product_key, "main");
        }

        // Migrar images_data (array JSON con posibles base64)
        if (row.images_data) {
          let arr;
          try { arr = JSON.parse(row.images_data); } catch { arr = []; }
          if (Array.isArray(arr) && arr.some((s) => typeof s === "string" && s.startsWith("data:"))) {
            const uploaded = await Promise.all(
              arr.map((src, i) =>
                typeof src === "string" && src.startsWith("data:")
                  ? uploadBase64(src, row.product_key, `img${i}`)
                  : Promise.resolve(src)
              )
            );
            newImagesData = JSON.stringify(uploaded);
          }
        }

        if (!newImageUrl && !newImagesData) continue;

        const updates = [];
        const params = [];
        if (newImageUrl) { updates.push(`image_data = $${params.push(newImageUrl)}`); }
        if (newImagesData) { updates.push(`images_data = $${params.push(newImagesData)}`); }
        params.push(row.product_key);
        await query(
          `UPDATE productos_web_metadata SET ${updates.join(", ")} WHERE product_key = $${params.length}`,
          params
        );

        migrated.push(row.product_key);
      } catch (err) {
        errors.push({ product_key: row.product_key, error: err.message });
      }
    }

    return NextResponse.json({ ok: true, total: rows.length, migrated: migrated.length, errors });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function uploadBase64(dataUri, productKey, suffix) {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error("Formato base64 inválido");
  const mimeType = match[1];
  const ext = mimeType.split("/")[1]?.split("+")[0] || "jpg";
  const buffer = Buffer.from(match[2], "base64");
  const blob = await put(`productos/${productKey}-${suffix}.${ext}`, buffer, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: false,
  });
  return blob.url;
}
