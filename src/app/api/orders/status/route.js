import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request) {
  const url = new URL(request.url);
  const orderCode = (url.searchParams.get("code") || "").trim();

  if (!orderCode) {
    return NextResponse.json({ error: "Falta el codigo de orden." }, { status: 400 });
  }

  try {
    const result = await query(
      `select order_code, status, payment_status, payment_method, total, customer_name, shipping_zone_id
       from public.web_orders
       where order_code = $1
       limit 1`,
      [orderCode],
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
    }

    const order = result.rows[0];
    return NextResponse.json({
      orderCode: order.order_code,
      status: order.status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      total: Number(order.total),
      customerName: order.customer_name,
      shippingZone: order.shipping_zone_id,
      isPaid: order.status === "paid" || order.payment_status === "approved",
    });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar la orden." }, { status: 500 });
  }
}
