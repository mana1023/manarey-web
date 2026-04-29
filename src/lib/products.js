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
        "alter table public.productos_web_metadata add column if not exists precio_override numeric",
        "alter table public.productos_web_metadata add column if not exists is_featured boolean default false",
        "alter table public.productos_web_metadata add column if not exists featured_order integer",
        "alter table public.productos_web_metadata add column if not exists images_data text",
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
  const precioOriginal = Number(row.precio_venta || 0);
  // Si hay un precio override configurado por el admin, se usa ese
  const precioVenta = row.precio_override !== null && row.precio_override !== undefined
    ? Number(row.precio_override)
    : precioOriginal;
  return {
    productKey: row.product_key,
    variantGroupKey: [
      nombre.toLowerCase().trim(),
      categoria.toLowerCase().trim(),
      medida.toLowerCase().trim(),
      String(precioOriginal), // clave basada en precio original para no romper el sistema
    ].join("|"),
    nombre,
    categoria: row.categoria,
    medida: row.medida,
    color: row.color,
    precioVenta,
    precioOriginal,
    stockTotal: Number(row.stock_total || 0),
    isSoldOut: Number(row.stock_total || 0) <= 0,
    description: row.description || "",
    imagesData: (() => {
      try { return row.images_data ? JSON.parse(row.images_data) : []; }
      catch { return []; }
    })(),
    imageData: (() => {
      if (row.image_data) return row.image_data;
      try {
        const images = row.images_data ? JSON.parse(row.images_data) : [];
        return Array.isArray(images) && images.length > 0 ? images[0] : "";
      } catch {
        return "";
      }
    })(),
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
    isFeatured: row.is_featured === true || row.is_featured === "true",
    featuredOrder: row.featured_order !== null && row.featured_order !== undefined ? Number(row.featured_order) : null,
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
      meta.capacidad,
      meta.precio_override,
      meta.is_featured,
      meta.featured_order,
      meta.images_data
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
  if (!productKey) throw new Error("productKey requerido para guardar el producto.");
  await ensureMetadataTable();

  const description = (payload.description || "").trim();
  const imagesArr = (() => {
    if (Array.isArray(payload.imagesData)) return payload.imagesData.filter(Boolean);
    if (typeof payload.imagesData === "string") {
      try {
        const parsed = JSON.parse(payload.imagesData);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {
        return [payload.imagesData].filter(Boolean);
      }
    }
    return [];
  })();

  const fallbackImage = typeof payload.imageData === "string" && payload.imageData ? payload.imageData : null;
  const imageData = payload.removeImage ? null : (imagesArr[0] || fallbackImage);
  const imagesDataJson = imageData ? JSON.stringify(imagesArr.length > 0 ? imagesArr : [imageData]) : null;
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
  // precio_override: null = usar precio del sistema, número = precio personalizado
  const precioOverride = toNullableNumber(payload.precioVenta);

  await query(
    `
      insert into public.productos_web_metadata (product_key, description, image_data, images_data, alto_cm, ancho_cm, profundidad_cm, largo_cm, litros, watts, peso_kg, voltaje, material, capacidad, precio_override, updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())
      on conflict (product_key) do update set
        description = excluded.description,
        image_data = excluded.image_data,
        images_data = excluded.images_data,
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
        precio_override = excluded.precio_override,
        updated_at = now()
    `,
    [productKey, description || null, imageData, imagesDataJson, altoCm, anchoCm, profundidadCm, largoCm, litros, watts, pesoKg, voltaje, material, capacidad, precioOverride],
  );

  return getCatalogProductByKey(productKey);
}

export async function renameProduct(productKey, newName) {
  await ensureMetadataTable();

  // Obtener los atributos actuales del producto para recalcular la clave
  const existing = await query(
    `SELECT min(categoria) as categoria, min(medida) as medida, precio_venta, min(color) as color
     FROM public.productos
     WHERE md5(concat_ws('|', lower(trim(nombre)), lower(coalesce(trim(categoria), '')), lower(coalesce(trim(medida), '')), coalesce(precio_venta::text, ''), lower(coalesce(trim(color), '')))) = $1
     GROUP BY precio_venta LIMIT 1`,
    [productKey],
  );
  if (!existing.rows.length) throw new Error("Producto no encontrado.");

  const { categoria, medida, precio_venta, color } = existing.rows[0];

  // Actualizar el nombre en todos los registros que coincidan
  await query(
    `UPDATE public.productos SET nombre = $1
     WHERE md5(concat_ws('|', lower(trim(nombre)), lower(coalesce(trim(categoria), '')), lower(coalesce(trim(medida), '')), coalesce(precio_venta::text, ''), lower(coalesce(trim(color), '')))) = $2`,
    [newName, productKey],
  );

  // Calcular el nuevo product_key desde las filas ya actualizadas
  const newKeyResult = await query(
    `SELECT md5(concat_ws('|', lower(trim(nombre)), lower(coalesce(trim(categoria), '')), lower(coalesce(trim(medida), '')), coalesce(precio_venta::text, ''), lower(coalesce(trim(color), '')))) as new_key
     FROM public.productos
     WHERE lower(trim(nombre)) = lower(trim($1))
       AND lower(coalesce(trim(categoria), '')) = lower(trim(coalesce($2, '')))
       AND lower(coalesce(trim(medida), '')) = lower(trim(coalesce($3, '')))
       AND coalesce(precio_venta::text, '') = coalesce($4::text, '')
       AND lower(coalesce(trim(color), '')) = lower(trim(coalesce($5, '')))
     LIMIT 1`,
    [newName, categoria, medida, precio_venta, color],
  );

  const newProductKey = newKeyResult.rows[0]?.new_key;

  // Migrar la metadata al nuevo product_key si cambió
  if (newProductKey && newProductKey !== productKey) {
    await query(
      `UPDATE public.productos_web_metadata SET product_key = $1, updated_at = now()
       WHERE product_key = $2`,
      [newProductKey, productKey],
    );
  }

  return newProductKey || productKey;
}

/**
 * Marca o desmarca un producto como destacado.
 * Si se marca, se asigna el siguiente número de orden disponible.
 * Si se desmarca, se pone is_featured=false y featured_order=null.
 */
export async function setProductFeatured(productKey, isFeatured) {
  await ensureMetadataTable();

  if (!isFeatured) {
    await query(
      `INSERT INTO public.productos_web_metadata (product_key, is_featured, featured_order, updated_at)
       VALUES ($1, false, null, now())
       ON CONFLICT (product_key) DO UPDATE SET is_featured = false, featured_order = null, updated_at = now()`,
      [productKey],
    );
    return;
  }

  // Calcular el próximo orden
  const res = await query(
    `SELECT COALESCE(MAX(featured_order), 0) + 1 AS next_order
     FROM public.productos_web_metadata WHERE is_featured = true`,
  );
  const nextOrder = res.rows[0]?.next_order || 1;

  await query(
    `INSERT INTO public.productos_web_metadata (product_key, is_featured, featured_order, updated_at)
     VALUES ($1, true, $2, now())
     ON CONFLICT (product_key) DO UPDATE SET is_featured = true, featured_order = $2, updated_at = now()`,
    [productKey, nextOrder],
  );
}

/**
 * Actualiza el orden de los destacados.
 * Recibe un array de productKeys en el orden deseado.
 */
export async function reorderFeaturedProducts(orderedKeys) {
  await ensureMetadataTable();
  for (let i = 0; i < orderedKeys.length; i++) {
    await query(
      `UPDATE public.productos_web_metadata SET featured_order = $1, updated_at = now() WHERE product_key = $2`,
      [i + 1, orderedKeys[i]],
    );
  }
}
