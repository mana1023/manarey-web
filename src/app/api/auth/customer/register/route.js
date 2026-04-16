import { NextResponse } from "next/server";
import { registerCustomer } from "@/lib/customer-auth";
import { createCustomerToken, CUSTOMER_SESSION_COOKIE, useSecureCookies } from "@/lib/customer-session";
import { sendWelcomeMessage } from "@/lib/whatsapp-sender";

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, nombre, apellido, telefono, password } = body;

    if (!email || !nombre || !apellido || !password) {
      return NextResponse.json({ error: "Nombre, apellido, correo y contraseña son obligatorios." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }
    if (!email.includes("@")) {
      return NextResponse.json({ error: "El correo no es valido." }, { status: 400 });
    }

    const customer = await registerCustomer({ email, nombre, apellido, telefono, password });
    const token = createCustomerToken({
      id: customer.id,
      email: customer.email,
      nombre: customer.nombre,
      apellido: customer.apellido,
      telefono: customer.telefono,
    });

    // Mensaje de bienvenida por WhatsApp (si tiene teléfono)
    if (telefono) {
      sendWelcomeMessage(telefono, nombre); // fire-and-forget, ya maneja el catch internamente
    }

    const response = NextResponse.json({ customer });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: useSecureCookies(),
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la cuenta." },
      { status: 400 },
    );
  }
}
