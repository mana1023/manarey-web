import { query } from "@/lib/db";

let metadataReadyPromise;

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = Number(String(value).replace(",", "."));
  return Number.isFinite(normalized) ? normalized : null;
}

async function ensureMetadataTable() {
  if (!metadataReadyPromise) {
    metadataReadyPromise = (async () => {
      await query(`
        create table if not exists public.productos_web_metadata (
          product_key text primary key,
          description text,
          image_data text,
          alto_cm numeric,
          ancho_cm numeric,
          profundidad_cm numeric,
          created_at timestamp without time zone default now(),
          updated_at timestamp without time zone default now()
        )
      `);
      // Add new columns if missing
      const newCols = [
        "alter table public.productos_web_metadata add column if not exists largo_cm numeric",
        "alter table public.productos_web_metadata add column if not exists litros numeric",
        "alter table public.productos_web_metadata add column if not exists watts numeric",
        "alter table public.productos_web_metadata add column if not exists peso_kg numeric",
        "alter table public.productos_web_metadata add column if not exists voltaje text",
        "alter table public.productos_web_metadata add column if not exists material text",
        "alter table public.productos_web_metadata add column if not exists capacidad text",
      ];
      for (const sql of newCols) {
        await query(sql).catch(() => {});
      }
    })().catch((err) => {
      metadataReadyPromise = undefined;
      throw err;
    });
  }
  await metadataReadyPromise;
}

function mapProduct(row) {
  const nombre = row.nombre || "";
  const categoria = row.categoria || "";
  const medida = row.medida || "";
  const precioVenta = Number(row.precio_venta || 0);
  return {
    productKey: row.product_key,
    variantGroupKey: [
      nombre.toLowerCase().trim(),
      categoria.toLowerCase().trim(),
      medida.toLowerCase().trim(),
      String(precioVenta),
    ].join("|"),
    nombre,
    categoria: row.categoria,
    medida: row.medida,
    color: row.color,
    precioVenta,
    stockTotal: Number(row.stock_total || 0),
    isSoldOut: Number(row.stock_total || 0) <= 0,
    description: row.description || "",
    imageData: row.image_data || "",
    altoCm: row.alto_cm === null ? null : Number(row.alto_cm),
    anchoCm: row.ancho_cm === null ? null : Number(row.ancho_cm),
    profundidadCm: row.profundidad_cm === null ? null : Number(row.profundidad_cm),
    largoCm: row.largo_cm === null ? null : Number(row.largo_cm),
    litros: row.litros === null ? null : Number(row.litros),
    watts: row.watts === null ? null : Number(row.watts),
    pesoKg: row.peso_kg === null ? null : Number(row.peso_kg),
    voltaje: row.voltaje || null,
    material: row.material || null,
    capacidad: row.capacidad || null,
  };
}

export async function getCatalogProducts() {
  await ensureMetadataTable();

  const sql = `
    with grouped as (
      select
        md5(concat_ws('|', lower(trim(nombre)), lower(coalesce(trim(categoria), '')), lower(coalesce(trim(medida), '')), coalesce(precio_venta::text, ''), lower(coalesce(trim(color), '')))) as product_key,
        min(initcap(trim(nombre))) as nombre,
        nullif(min(trim(categoria)), '') as categoria,
        nullif(min(trim(medida)), '') as medida,
        nullif(min(trim(color)), '') as color,
        precio_venta,
        sum(greatest(coalesce(cantidad, 0), 0))::integer as stock_total,
        (array_remove(array_agg(nullif(trim(descripcion), '') order by length(nullif(trim(descripcion), '')) desc), null))[1] as raw_description
      from public.productos
      group by 1, precio_venta
    )
    select
      grouped.product_key,
      grouped.nombre,
      grouped.categoria,
      grouped.medida,
      grouped.color,
      grouped.precio_venta,
      grouped.stock_total,
      coalesce(meta.description, grouped.raw_description, '') as description,
      meta.image_data,
      meta.alto_cm,
      meta.ancho_cm,
      meta.profundidad_cm,
      meta.largo_cm,
      meta.litros,
      meta.watts,
      meta.peso_kg,
      meta.voltaje,
      meta.material,
      meta.capacidad
    from grouped
    left join public.productos_web_metadata meta on meta.product_key = grouped.product_key
    order by
      case when grouped.stock_total > 0 then 0 else 1 end,
      grouped.categoria nulls last,
      grouped.nombre
  `;

  const result = await query(sql);
  return result.rows.map(mapProduct);
}

export async function getCatalogProductByKey(productKey) {
  const products = await getCatalogProducts();
  return products.find((item) => item.productKey === productKey) || null;
}

export async function updateProductMetadata(productKey, payload) {
  await ensureMetadataTable();

  const description = (payload.description || "").trim();
  const imageData = payload.removeImage ? null : payload.imageData || null;
  if (imageData && imageData.length > 3_500_000) throw new Error("La imagen es demasiado pesada para guardarla.");
  const altoCm = toNullableNumber(payload.altoCm);
  const anchoCm = toNullableNumber(payload.anchoCm);
  const profundidadCm = toNullableNumber(payload.profundidadCm);
  const largoCm = toNullableNumber(payload.largoCm);
  const litros = toNullableNumber(payload.litros);
  const watts = toNullableNumber(payload.watts);
  const pesoKg = toNullableNumber(payload.pesoKg);
  const voltaje = (payload.voltaje || "").trim() || null;
  const material = (payload.material || "").trim() || null;
  const capacidad = (payload.capacidad || "").trim() || null;

  await query(
    `
      insert into public.productos_web_metadata (product_key, description, image_data, alto_cm, ancho_cm, profundidad_cm, largo_cm, litros, watts, peso_kg, voltaje, material, capacidad, updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
      on conflict (product_key) do update set
        description = excluded.description,
        image_data = excluded.image_data,
        alto_cm = excluded.alto_cm,
        ancho_cm = excluded.ancho_cm,
        profundidad_cm = excluded.profundidad_cm,
        largo_cm = excluded.largo_cm,
        litros = excluded.litros,
        watts = excluded.watts,
        peso_kg = excluded.peso_kg,
        voltaje = excluded.voltaje,
        material = excluded.material,
        capacidad = excluded.capacidad,
        updated_at = now()
    `,
    [productKey, description || null, imageData, altoCm, anchoCm, profundidadCm, largoCm, litros, watts, pesoKg, voltaje, material, capacidad],
  );

  return getCatalogProductByKey(productKey);
}
