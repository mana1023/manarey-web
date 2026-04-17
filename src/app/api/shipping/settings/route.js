import { NextResponse } from "next/server";
import { getShippingSettings } from "@/lib/settings-db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getShippingSettings();
    return NextResponse.json(settings);
  } catch {
    // Fallback a los valores de env si la DB falla
    const { storeSettings } = await import("@/lib/store-config");
    return NextResponse.json({
      shippingBaseCost: storeSettings.shippingBaseCost,
      shippingCostPerKm: storeSettings.shippingCostPerKm,
    });
  }
}
