import crypto from "crypto";
import { query } from "@/lib/db";

let tableReady = null;

export async function ensureCustomerTable() {
  if (!tableReady) {
    tableReady = query(`
      create table if not exists public.web_customers (
        id bigserial primary key,
        email text not null unique,
        nombre text not null default '',
        apellido text not null default '',
        telefono text not null default '',
        password_hash text,
        google_id text unique,
        created_at timestamp default now(),
        updated_at timestamp default now()
      )
    `).catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  await tableReady;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(":");
    const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    return hash === computed;
  } catch {
    return false;
  }
}

export async function registerCustomer({ email, nombre, apellido, telefono, password }) {
  await ensureCustomerTable();
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const result = await query(
      `insert into public.web_customers (email, nombre, apellido, telefono, password_hash)
       values ($1, $2, $3, $4, $5)
       returning id, email, nombre, apellido, telefono`,
      [normalizedEmail, nombre.trim(), apellido.trim(), (telefono || "").trim(), hashPassword(password)],
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === "23505") throw new Error("Ya existe una cuenta con ese correo.");
    throw err;
  }
}

export async function loginCustomer({ email, password }) {
  await ensureCustomerTable();
  const normalizedEmail = email.trim().toLowerCase();

  const result = await query(
    `select id, email, nombre, apellido, telefono, password_hash from public.web_customers
     where email = $1 limit 1`,
    [normalizedEmail],
  );

  const customer = result.rows[0];
  if (!customer || !customer.password_hash) return null;
  if (!verifyPassword(password, customer.password_hash)) return null;

  return {
    id: customer.id,
    email: customer.email,
    nombre: customer.nombre,
    apellido: customer.apellido,
    telefono: customer.telefono,
  };
}

export async function findOrCreateGoogleCustomer({ googleId, email, nombre, apellido }) {
  await ensureCustomerTable();
  const normalizedEmail = (email || "").trim().toLowerCase();

  const byGoogle = await query(
    `select id, email, nombre, apellido, telefono from public.web_customers where google_id = $1 limit 1`,
    [googleId],
  );
  if (byGoogle.rows[0]) return byGoogle.rows[0];

  if (normalizedEmail) {
    const byEmail = await query(
      `select id, email, nombre, apellido, telefono from public.web_customers where email = $1 limit 1`,
      [normalizedEmail],
    );
    if (byEmail.rows[0]) {
      await query(
        `update public.web_customers set google_id = $1, updated_at = now() where id = $2`,
        [googleId, byEmail.rows[0].id],
      );
      return byEmail.rows[0];
    }
  }

  const result = await query(
    `insert into public.web_customers (email, nombre, apellido, google_id)
     values ($1, $2, $3, $4)
     returning id, email, nombre, apellido, telefono`,
    [normalizedEmail, nombre || "", apellido || "", googleId],
  );
  return result.rows[0];
}

export async function getCustomerById(id) {
  await ensureCustomerTable();
  const result = await query(
    `select id, email, nombre, apellido, telefono from public.web_customers where id = $1 limit 1`,
    [id],
  );
  return result.rows[0] || null;
}

export async function updateCustomerProfile(id, { nombre, apellido, telefono }) {
  await ensureCustomerTable();
  const result = await query(
    `update public.web_customers set nombre = $2, apellido = $3, telefono = $4, updated_at = now()
     where id = $1 returning id, email, nombre, apellido, telefono`,
    [id, nombre.trim(), apellido.trim(), (telefono || "").trim()],
  );
  return result.rows[0] || null;
}
