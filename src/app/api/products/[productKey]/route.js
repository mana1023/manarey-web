import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { updateProductMetadata, renameProduct } from "@/lib/products";

// App Router: configuración de segmento de ruta
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function PATCH(request, context) {
  const session = await getSessionFromCookies(await cookies());

  if (!session.isAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    // Next.js 15+: context.params es una Promise
    const params = await context.params;
    const productKey = params?.productKey ?? null;
    if (!productKey) {
      return NextResponse.json({ error: "productKey requerido." }, { status: 400 });
    }
    const body = await request.json();
    const originalKey = productKey;
    let activeKey = originalKey;

    if (body.nombre && body.nombre.trim()) {
      activeKey = await renameProduct(originalKey, body.nombre.trim());
    }

    const producto = await updateProductMetadata(activeKey, body);
    return NextResponse.json({ producto, newProductKey: activeKey !== originalKey ? activeKey : null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el producto." },
      { status: 400 },
    );
  }
}
