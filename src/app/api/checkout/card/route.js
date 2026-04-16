import { NextResponse } from "next/server";
import { createOrder } from "@/lib/orders";
import { createMercadoPagoPreference } from "@/lib/payments";

export async function POST(request) {
  try {
    const payload = await request.json();
    const order = await createOrder({ paymentMethod: "card", payload });
    const preference = await createMercadoPagoPreference({
      order,
      customer: order.customer,
    });

    return NextResponse.json({
      orderCode: order.orderCode,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar el checkout con tarjeta." },
      { status: 400 },
    );
  }
}
