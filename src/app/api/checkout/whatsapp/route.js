import { NextResponse } from "next/server";
import { createOrder, syncOrderToVentas } from "@/lib/orders";
import { storeSettings } from "@/lib/store-config";

function buildWhatsAppUrl(message) {
  if (!storeSettings.whatsappNumber) {
    return null;
  }

  return `https://wa.me/${storeSettings.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export async function POST(request) {
  try {
    if (!storeSettings.whatsappNumber) {
      throw new Error("Falta configurar NEXT_PUBLIC_WHATSAPP_NUMBER.");
    }

    const payload = await request.json();
    const order = await createOrder({ paymentMethod: "whatsapp", payload });
    const message = [
      `Hola ${storeSettings.brandName}, quiero cerrar la compra ${order.orderCode}.`,
      `Cliente: ${order.customer.fullName}`,
      `Telefono: ${order.customer.phone}`,
      `Email: ${order.customer.email}`,
      `Direccion: ${order.customer.address}, ${order.customer.city}`,
      `Envio: ${order.summary.shipping.label}${order.summary.shipping.distanceKm ? ` (${order.summary.shipping.distanceKm} km desde Longchamps)` : ""} - $${order.summary.shipping.cost.toLocaleString("es-AR")}`,
      "Productos:",
      ...order.summary.items.map(
        (item) =>
          `- ${item.nombre} x${item.quantity}${item.accessoryLabel ? ` (${item.accessoryLabel})` : ""} - $${(
            item.quantity *
            (item.precioVenta + item.accessoryPrice)
          ).toLocaleString("es-AR")}`,
      ),
      `Total: $${order.summary.total.toLocaleString("es-AR")}`,
      order.customer.notes ? `Notas: ${order.customer.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Sincronizar a ventas (envio pendiente) inmediatamente
    try {
      await syncOrderToVentas({
        order_code: order.orderCode,
        payment_method: "whatsapp",
        customer_name: order.customer.fullName,
        customer_phone: order.customer.phone,
        customer_address: order.customer.address,
        customer_city: order.customer.city,
        customer_notes: order.customer.notes,
        shipping_zone_id: order.summary.shipping.id,
        shipping_cost: order.summary.shipping.cost,
        subtotal: order.summary.subtotal,
        total: order.summary.total,
        raw_payload: JSON.stringify({ customer: order.customer, summary: order.summary }),
      });
    } catch {
      // No bloquear el checkout
    }

    return NextResponse.json({
      orderCode: order.orderCode,
      whatsappUrl: buildWhatsAppUrl(message),
      message,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la compra por WhatsApp." },
      { status: 400 },
    );
  }
}
