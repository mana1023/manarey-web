import { NextResponse } from "next/server";
import { loginCustomer } from "@/lib/customer-auth";
import { createCustomerToken, CUSTOMER_SESSION_COOKIE, useSecureCookies } from "@/lib/customer-session";

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Correo y contraseña son obligatorios." }, { status: 400 });
    }

    const customer = await loginCustomer({ email, password });
    if (!customer) {
      return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    }

    const token = createCustomerToken({
      id: customer.id,
      email: customer.email,
      nombre: customer.nombre,
      apellido: customer.apellido,
      telefono: customer.telefono,
    });

    const response = NextResponse.json({ customer });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: useSecureCookies(),
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "No se pudo iniciar sesion." }, { status: 500 });
  }
}
