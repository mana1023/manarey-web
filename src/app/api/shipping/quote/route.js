import { NextResponse } from "next/server";
import { resolveShippingDistance } from "@/lib/geo";
import { calculateShippingCost } from "@/lib/shipping";

export async function POST(request) {
  try {
    const body = await request.json();
    const address = String(body.address || "").trim();
    const city = String(body.city || "").trim();

    if (!address || !city) {
      return NextResponse.json(
        { error: "Ingresa direccion y ciudad para calcular el envio." },
        { status: 400 },
      );
    }

    const resolved = await resolveShippingDistance(address, city);
    const shipping = calculateShippingCost("delivery", resolved.distanceKm);

    return NextResponse.json({
      distanceKm: resolved.distanceKm,
      shipping,
      destinationLabel: resolved.destination?.label || city,
      originLabel: resolved.origin.label,
      isFallback: resolved.isFallback,
      fallbackReason: resolved.fallbackReason,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cotizar el envio." },
      { status: 400 },
    );
  }
}
