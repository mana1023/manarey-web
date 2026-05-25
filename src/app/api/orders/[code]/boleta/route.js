import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── Colores (mismos que la app de escritorio) ─────────────────────────────────
const GOLD   = "#C9A040";
const DARK   = "#1F1F22";
const BORDER = "#343A3A";
const BLACK  = "#000000";
const GREEN  = "#4CAF50";
const BLUE   = "#2196F3";
const ORANGE = "#FF9800";
const LIGHT  = "#F5F5F5";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMoney(val) {
  const n = Math.round(Number(val) || 0);
  return "$ " + n.toLocaleString("es-AR");
}

function fmtDate(val) {
  if (!val) return "";
  try {
    const s = String(val).replace("T", " ").split(".")[0];
    const d = new Date(s.includes(" ") ? s.replace(" ", "T") + "Z" : s);
    if (isNaN(d.getTime())) return String(val).split("T")[0];
    return (
      d.toLocaleDateString("es-AR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        timeZone: "America/Argentina/Buenos_Aires",
      }) + "  " +
      d.toLocaleTimeString("es-AR", {
        hour: "2-digit", minute: "2-digit",
        timeZone: "America/Argentina/Buenos_Aires",
      })
    );
  } catch {
    return String(val).split("T")[0];
  }
}

const PAYMENT_LABELS = {
  card:      "Tarjeta / MercadoPago",
  transfer:  "Transferencia bancaria",
  whatsapp:  "Efectivo / A coordinar",
};

// ── Ruta del logo ─────────────────────────────────────────────────────────────
function getLogoPath() {
  // public/logo_boleta.png (copiado desde la app de escritorio)
  const p = path.join(process.cwd(), "public", "logo_boleta.png");
  return fs.existsSync(p) ? p : null;
}

// ── Dibujar la boleta (COPIA CLIENTE, página completa) ────────────────────────
function drawBoleta(doc, order, items, rawCustomer) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const M = 42;           // margen lateral
  const W = pageW - M * 2;
  let y = pageH - 28;     // PDFKit: y = 0 está abajo, pero usamos coordenadas desde arriba

  // ─ Convertimos a sistema "top = 0" ─────────────────────────────────────────
  // PDFKit text usa x, y donde y crece hacia abajo desde el top. Usamos eso.
  y = 28; // reiniciamos: y crece hacia abajo

  // ── Línea dorada superior ──────────────────────────────────────────────────
  doc.strokeColor(GOLD).lineWidth(2)
    .moveTo(M, y).lineTo(M + W, y).stroke();
  y += 10;

  // ── Logo + número de boleta + fecha ───────────────────────────────────────
  const logoPath = getLogoPath();
  let logoEndX = M;
  if (logoPath) {
    try {
      const LOGO_H = 42;
      const LOGO_W = 160;
      doc.image(logoPath, M, y, { height: LOGO_H, width: LOGO_W, fit: [LOGO_W, LOGO_H] });
      logoEndX = M + LOGO_W + 14;
    } catch { /* sin logo */ }
  }

  // Número de boleta
  doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(14)
    .text(`BOLETA Nº ${order.order_code}`, logoEndX, y + 6, { lineBreak: false });

  // Fecha (derecha)
  doc.fillColor(BLACK).font("Helvetica").fontSize(9)
    .text(`Fecha: ${fmtDate(order.created_at)}`, M, y + 6, {
      width: W, align: "right", lineBreak: false,
    });

  // COPIA CLIENTE (verde, como en la app)
  doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(10)
    .text("COPIA CLIENTE", logoEndX, y + 26, { lineBreak: false });

  y += 58;

  // ── Separador ─────────────────────────────────────────────────────────────
  doc.strokeColor(BORDER).lineWidth(1)
    .moveTo(M, y).lineTo(M + W, y).stroke();
  y += 10;

  // ── Bloque cliente (izquierda, ~52% del ancho) ────────────────────────────
  const clientBoxW = W * 0.52;
  const clientBoxH = 68;
  doc.strokeColor(BORDER).lineWidth(1)
    .roundedRect(M, y, clientBoxW, clientBoxH, 4).stroke();

  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(9)
    .text("DATOS DEL CLIENTE:", M + 6, y + 8, { lineBreak: false });

  const isPickup = order.shipping_zone_id === "pickup";
  const addr = isPickup
    ? (order.shipping_zone_label || order.customer_address || "Retiro en sucursal")
    : [order.customer_address, order.customer_city].filter(Boolean).join(", ");
  const notes = (() => {
    const raw = order.customer_notes || rawCustomer?.notes || "";
    if (raw.startsWith("WEB | Cliente:")) {
      return raw.split("|")
        .filter(p => { const t = p.trim(); return t && !t.startsWith("WEB") && !t.startsWith("Cliente:") && !t.startsWith("Tel:"); })
        .join(" | ").trim();
    }
    return raw;
  })();

  let cy = y + 22;
  const lineH = 11;
  function clientLine(text) {
    doc.fillColor(DARK).font("Helvetica").fontSize(8)
      .text(`• ${text}`, M + 6, cy, { width: clientBoxW - 12, lineBreak: false });
    cy += lineH;
  }
  if (order.customer_name)  clientLine(order.customer_name);
  if (order.customer_phone) clientLine(`Tel: ${order.customer_phone}`);
  if (addr)                 clientLine(addr);
  if (rawCustomer?.betweenStreets) clientLine(`Entre calles: ${rawCustomer.betweenStreets}`);
  if (notes)                clientLine(`Notas: ${notes}`);

  // ── Bloque estado de pago (derecha, ~44% del ancho) ───────────────────────
  const payBoxX = M + W * 0.54;
  const payBoxW = W * 0.44;
  const payBoxH = clientBoxH;

  // Determinar color y texto según método de pago
  let payColor = GREEN;
  let payLabel = "PAGO CONFIRMADO";
  let payDetail = "";
  const pm = order.payment_method || "";
  if (pm === "transfer")       { payColor = BLUE;   payLabel = "TRANSFERENCIA";        payDetail = "Pago bancario confirmado"; }
  else if (pm === "whatsapp")  { payColor = ORANGE;  payLabel = "EFECTIVO";             payDetail = "A coordinar al recibir"; }
  else if (pm === "card")      { payColor = GREEN;   payLabel = "TARJETA / MP";         payDetail = "Pago electrónico"; }

  doc.strokeColor(payColor).lineWidth(2)
    .roundedRect(payBoxX, y, payBoxW, payBoxH, 6).stroke();

  doc.fillColor(payColor).font("Helvetica-Bold").fontSize(11)
    .text(payLabel, payBoxX + 8, y + 14, { width: payBoxW - 16, lineBreak: false });
  doc.fillColor(BLACK).font("Helvetica").fontSize(8)
    .text(payDetail || (PAYMENT_LABELS[pm] || pm), payBoxX + 8, y + 32, { width: payBoxW - 16, lineBreak: false });
  doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(11)
    .text(`Total: ${fmtMoney(order.total)}`, payBoxX + 8, y + 46, { width: payBoxW - 16, lineBreak: false });

  y += clientBoxH + 14;

  // ── Tabla de productos ─────────────────────────────────────────────────────
  doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(8)
    .text("DETALLE DEL PEDIDO", M, y, { lineBreak: false });
  y += 13;

  // Columnas
  const cQtyW = 30;
  const cSubW = 72;
  const cUnitW = 72;
  const cLocW  = 80;
  const cNameW = W - cQtyW - cLocW - cUnitW - cSubW - 12;
  const cQtyX  = M;
  const cNameX = cQtyX + cQtyW + 4;
  const cLocX  = cNameX + cNameW + 4;
  const cUnitX = cLocX + cLocW + 4;
  const cSubX  = cUnitX + cUnitW + 4;

  // Header
  doc.rect(M, y, W, 14).fillColor(LIGHT).fill();
  doc.strokeColor(BORDER).lineWidth(0.5)
    .rect(M, y, W, 14).stroke();
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(7.5);
  doc.text("Cant.", cQtyX,  y + 3, { width: cQtyW,  align: "center", lineBreak: false });
  doc.text("Producto / Descripción", cNameX, y + 3, { width: cNameW, lineBreak: false });
  doc.text("Sucursal/Retiro", cLocX, y + 3, { width: cLocW, align: "center", lineBreak: false });
  doc.text("P. Unit.", cUnitX, y + 3, { width: cUnitW, align: "right", lineBreak: false });
  doc.text("Subtotal", cSubX,  y + 3, { width: cSubW,  align: "right", lineBreak: false });
  y += 15;

  // Filas
  let rowAlt = false;
  for (const item of items) {
    const rowH = 14;
    if (rowAlt) doc.rect(M, y, W, rowH).fillColor("#F9F9F9").fill();
    rowAlt = !rowAlt;
    doc.strokeColor(BORDER).lineWidth(0.3).rect(M, y, W, rowH).stroke();

    const unitPrice = Number(item.unit_price || 0) + Number(item.accessory_price || 0);
    const lineTotal = Number(item.line_total || unitPrice * item.quantity || 0);
    const productName = item.name + (item.accessory_label ? ` + ${item.accessory_label}` : "");
    const branchLabel = isPickup
      ? (order.shipping_zone_label || order.customer_address || "Local")
      : "Envío a domicilio";

    doc.fillColor(DARK).font("Helvetica").fontSize(8);
    doc.text(String(item.quantity), cQtyX,  y + 3, { width: cQtyW,  align: "center", lineBreak: false });
    doc.text(productName,           cNameX, y + 3, { width: cNameW, lineBreak: false });
    doc.text(branchLabel,           cLocX,  y + 3, { width: cLocW,  align: "center", lineBreak: false });
    doc.text(fmtMoney(unitPrice),   cUnitX, y + 3, { width: cUnitW, align: "right",  lineBreak: false });
    doc.text(fmtMoney(lineTotal),   cSubX,  y + 3, { width: cSubW,  align: "right",  lineBreak: false });
    y += rowH;
  }

  y += 6;
  doc.strokeColor(BORDER).lineWidth(1)
    .moveTo(M, y).lineTo(M + W, y).stroke();
  y += 10;

  // ── Totales ────────────────────────────────────────────────────────────────
  const tLabelX = M + W - 210;
  const tLabelW = 135;
  const tValX   = tLabelX + tLabelW + 4;
  const tValW   = 71;

  function totalRow(label, value, bold, highlight) {
    if (highlight) {
      doc.rect(tLabelX - 8, y - 2, 219, bold ? 18 : 14).fillColor(LIGHT).fill();
    }
    doc.fillColor("#555555").font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 9 : 8)
      .text(label, tLabelX, y, { width: tLabelW, align: "right", lineBreak: false });
    doc.fillColor(DARK).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 10 : 8)
      .text(value, tValX, y, { width: tValW, align: "right", lineBreak: false });
    y += bold ? 15 : 12;
  }

  totalRow("Subtotal productos:", fmtMoney(order.subtotal));
  if (Number(order.shipping_cost) > 0) totalRow("Envío:", fmtMoney(order.shipping_cost));
  totalRow("TOTAL:", fmtMoney(order.total), true, true);

  y += 4;
  const payMethodLabel = PAYMENT_LABELS[pm] || pm || "";
  doc.fillColor("#666666").font("Helvetica").fontSize(8)
    .text(`Forma de pago: ${payMethodLabel}`, M, y, { lineBreak: false });

  // ── Footer: info del local + línea dorada inferior ─────────────────────────
  const footerY = pageH - 48;

  // Línea separadora footer
  doc.strokeColor(BORDER).lineWidth(0.5)
    .moveTo(M, footerY - 8).lineTo(M + W, footerY - 8).stroke();

  // Datos de contacto del local (si disponibles)
  const storePhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
  const storeName  = "Manarey Mueblería";
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
    .text(storeName, M, footerY, { lineBreak: false });
  if (storePhone) {
    doc.fillColor("#444444").font("Helvetica").fontSize(8)
      .text(`Tel: ${storePhone}`, M, footerY + 12, { lineBreak: false });
  }
  doc.fillColor("#888888").font("Helvetica").fontSize(7.5)
    .text("www.manarey.com.ar", M, footerY + (storePhone ? 24 : 12), { lineBreak: false });

  // Logo en footer derecha (semitransparente, como en la app)
  if (logoPath) {
    try {
      doc.opacity(0.12);
      doc.image(logoPath, M + W - 170, footerY - 20, { height: 55, width: 170 });
      doc.opacity(1);
    } catch { /* sin logo */ }
  }

  // Línea dorada inferior
  doc.strokeColor(GOLD).lineWidth(2)
    .moveTo(M, pageH - 22).lineTo(M + W, pageH - 22).stroke();
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(_request, { params }) {
  const { code } = await params;
  if (!code) {
    return new NextResponse("Falta el código de orden", { status: 400 });
  }

  try {
    const orderRes = await query(
      `SELECT * FROM public.web_orders WHERE order_code = $1 LIMIT 1`,
      [code],
    );
    if (!orderRes.rows.length) {
      return new NextResponse("Orden no encontrada", { status: 404 });
    }
    const order = orderRes.rows[0];

    // Solo órdenes pagadas
    const isPaid = order.status === "paid" || order.payment_status === "approved";
    if (!isPaid) {
      return new NextResponse(
        "La boleta solo está disponible una vez confirmado el pago",
        { status: 403 },
      );
    }

    const itemsRes = await query(
      `SELECT * FROM public.web_order_items WHERE order_id = $1 ORDER BY id`,
      [order.id],
    );
    const items = itemsRes.rows;

    let rawCustomer = {};
    try {
      const rp = typeof order.raw_payload === "string"
        ? JSON.parse(order.raw_payload || "{}")
        : (order.raw_payload || {});
      rawCustomer = rp.customer || {};
    } catch { /* ignorar */ }

    // Generar PDF — página completa A4, una sola copia (CLIENTE)
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });

    const buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end",  () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      drawBoleta(doc, order, items, rawCustomer);
      doc.end();
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="boleta-${code}.pdf"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err) {
    console.error("[boleta] Error generando PDF:", err?.message || err);
    return new NextResponse("Error generando la boleta", { status: 500 });
  }
}
