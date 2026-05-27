import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = await getSessionFromCookies(await cookies());
  if (!session.isAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = 30;
  const offset = (page - 1) * limit;
  const search = (searchParams.get("q") || "").trim();

  let whereClause = "WHERE 1=1";
  const params = [];

  if (status !== "all") {
    params.push(status);
    whereClause += ` AND o.status = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND (
      o.order_code ILIKE $${params.length} OR
      o.customer_name ILIKE $${params.length} OR
      o.customer_phone ILIKE $${params.length}
    )`;
  }

  const dataParams = [...params, limit, offset];
  const countParams = [...params];

  const [ordersResult, countResult] = await Promise.all([
    query(
      `SELECT
        o.id, o.order_code, o.status, o.payment_method, o.payment_status,
        o.customer_name, o.customer_email, o.customer_phone,
        o.customer_address, o.customer_city, o.customer_notes,
        o.shipping_zone_label, o.shipping_cost,
        o.subtotal, o.total,
        COALESCE(o.surcharge_amount, 0) AS surcharge_amount,
        COALESCE(o.installments, 1) AS installments,
        o.created_at, o.updated_at,
        o.payment_reference,
        (SELECT json_agg(json_build_object(
          'name', i.name,
          'quantity', i.quantity,
          'unit_price', i.unit_price,
          'accessory_label', i.accessory_label,
          'line_total', i.line_total
        )) FROM public.web_order_items i WHERE i.order_id = o.id) AS items
       FROM public.web_orders o
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    ),
    query(
      `SELECT count(*) AS total FROM public.web_orders o ${whereClause}`,
      countParams,
    ),
  ]);

  return NextResponse.json({
    orders: ordersResult.rows,
    total: parseInt(countResult.rows[0]?.total || "0", 10),
    page,
    pages: Math.ceil(parseInt(countResult.rows[0]?.total || "0", 10) / limit),
  });
}

export async function PATCH(request) {
  const session = await getSessionFromCookies(await cookies());
  if (!session.isAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { orderCode, status } = await request.json();
  const allowed = ["pending", "paid", "shipped", "delivered", "cancelled"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  }

  await query(
    `UPDATE public.web_orders SET status = $1, updated_at = now() WHERE order_code = $2`,
    [status, orderCode],
  );

  return NextResponse.json({ ok: true });
}
