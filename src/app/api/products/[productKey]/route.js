import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { updateProductMetadata } from "@/lib/products";

export async function PATCH(request, context) {
  const session = await getSessionFromCookies(await cookies());

  if (!session.isAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const producto = await updateProductMetadata(context.params.productKey, body);
    return NextResponse.json({ producto });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el producto." },
      { status: 400 },
    );
  }
}
