import { query } from "@/lib/db";

// Persistir en globalThis para sobrevivir entre invocaciones warm (serverless)
const g = globalThis;

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = Number(String(value).replace(",", "."));
  return Number.isFinite(normalized) ? normalized : null;
}

async function ensureMetadataTable() {
  // Si ya corrió en este proceso, saltar directamente
  if (g._manareyMetaDone) return;

  if (!g._manareyMetaPromise) {
    g._manareyMetaPromise = (async () => {
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
      // Correr todas las migraciones EN PARALELO en vez de secuencial
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
      await Promise.all(newCols.map((sql) => query(sql).catch(() => {})));
      // Índices para acelerar la query principal del catálogo
      await query(`create index if not exists idx_productos_nombre on public.productos (lower(trim(nombre)))`).catch(() => {});
      await query(`create index if not exists idx_productos_categoria on public.productos (categoria)`).catch(() => {});

      // ── Migración: renombrar claves antiguas (con precio_venta) a nuevas (sin precio_venta)
      // La fórmula vieja incluía precio_venta → cambiar precio en el escritorio borraba la metadata.
      // La fórmula nueva es: md5(nombre | medida | color)  (sin precio_venta, igual que ya se quitó categoria)
      // Este UPDATE corre una sola vez: toma cada registro de metadata cuyo key coincide con la
      // fórmula VIEJA y lo mueve al key NUEVO, siempre que el nuevo key no exista ya.
      await query(`
        UPDATE public.productos_web_metadata meta
        SET product_key = new_keys.new_key, updated_at = now()
        FROM (
          SELECT DISTINCT
            md5(concat_ws('|',
              lower(trim(nombre)),
              lower(coalesce(trim(medida), '')),
              coalesce(precio_venta::text, ''),
              lower(coalesce(trim(color), ''))
            )) AS old_key,
            md5(concat_ws('|',
              lower(trim(nombre)),
              lower(coalesce(trim(medida), '')),
              lower(coalesce(trim(color), ''))
            )) AS new_key
          FROM public.productos
          WHERE precio_venta IS NOT NULL
        ) new_keys
        WHERE meta.product_key = new_keys.old_key
          AND new_keys.old_key <> new_keys.new_key
          AND NOT EXISTS (
            SELECT 1 FROM public.productos_web_metadata m2
            WHERE m2.product_key = new_keys.new_key
          )
      `).catch(() => {});

      g._manareyMetaDone = true;
    })().catch((err) => {
      g._manareyMetaPromise = undefined;
      throw err;
    });
  }
  await g._manareyMetaPromise;
}

// Cache en memoria: 90 segundos
const CACHE_TTL_MS = 90_000;

export function invalidateProductsCache() {
  g._manareyProductsCache = null;
}

// Palabras que no se capitalizan salvo que abran el nombre.
const CONECTORES = new Set(["de", "del", "la", "el", "y", "con", "sin", "para", "por", "a", "en"]);

/**
 * Capitaliza el nombre para mostrarlo, respetando los códigos de modelo.
 *
 * Antes esto lo hacía `initcap` en SQL, que capitaliza palabra por palabra a
 * ciegas: servía cuando los nombres eran "alacena" o "mesada", pero desde que
 * llevan el modelo del electrodoméstico rompía "CI070" → "Ci070" y
 * "DL-3VA" → "Dl-3va". La regla es simple: si la palabra ya trae una mayúscula
 * o un número, es un código o una marca y se deja como está.
 */
function titularNombre(raw) {
  return (raw || "")
    .trim()
    .split(/\s+/)
    .map((palabra, i) => {
      if (/[A-Z0-9]/.test(palabra)) return palabra;
      if (i > 0 && CONECTORES.has(palabra)) return palabra;
      return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    })
    .join(" ");
}

function mapProduct(row) {
  const nombre = titularNombre(row.nombre || "");
  const categoria = row.categoria || "";
  const medida = row.medida || "";
  const precioOriginal = Number(row.precio_venta || 0);
  // Si hay un precio override configurado por el admin, se usa ese
  const precioVenta = row.precio_override !== null && row.precio_override !== undefined
    ? Number(row.precio_override)
    : precioOriginal;
  // El tipo de gas de una cocina vive en la columna `material`, pero no es un
  // material: es una variante del mismo producto. Si se lo dejara en la clave
  // de grupo, la Candor de gas natural y la de envasado serían dos tarjetas
  // sueltas y el cliente no podría elegir. Se saca del agrupamiento para que
  // queden como dos opciones de una misma tarjeta. La medida y el color sí
  // siguen distinguiendo el productKey, así que el stock y el pedido registran
  // cuál eligió.
  const materialSistema = (row.material_sistema || "").toLowerCase().trim();
  const materialDeGrupo = materialSistema.startsWith("gas ") ? "" : materialSistema;

  return {
    productKey: row.product_key,
    // Clave de agrupación de variantes. Antes incluía medida y precio, así que
    // cada ancho de una alacena era una tarjeta suelta y sin relación con las
    // demás: el cliente no tenía forma de pasar de la de 80cm a la de 1,20m.
    // Ahora agrupa por producto real y las medidas son variantes, igual que
    // los colores. Se incluye el material porque hay nombres repetidos entre
    // líneas distintas ("alacena" de pino y de melamina). Verificado contra la
    // base: con esta clave no queda ninguna medida duplicada dentro de un
    // grupo, o sea que no fusiona productos que no van juntos.
    // OJO: productKey NO cambia — de él cuelgan las fotos, los precios
    // override y las órdenes ya hechas.
    variantGroupKey: [
      nombre.toLowerCase().trim(),
      categoria.toLowerCase().trim(),
      materialDeGrupo,
    ].join("|"),
    nombre,
    categoria: row.categoria,
    medida: row.medida,
    materialSistema: row.material_sistema || "",
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
  // Devolver del cache si está fresco
  const now = Date.now();
  const cached = g._manareyProductsCache;
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  await ensureMetadataTable();

  const sql = `
    with grouped as (
      select
        -- SIN categoria en el key: cambiar categoría en el sistema desktop
        -- ya no rompe el vínculo con la metadata (imágenes, precios, descripciones)
        md5(concat_ws('|', lower(trim(nombre)), lower(coalesce(trim(medida), '')), lower(coalesce(trim(color), '')))) as product_key,
        min(trim(nombre)) as nombre,
        nullif(min(initcap(trim(categoria))), '') as categoria,
        nullif(min(trim(medida)), '') as medida,
        nullif(min(trim(color)), '') as color,
        max(precio_venta) as precio_venta,
        sum(greatest(coalesce(cantidad, 0), 0))::integer as stock_total,
        -- Material del sistema (no el de la metadata web): es lo que separa
        -- dos productos que se llaman igual — "alacena" de pino y "alacena"
        -- de melamina son muebles distintos, con escaleras de precio propias.
        nullif(min(lower(trim(material))), '') as material_sistema,
        (array_remove(array_agg(nullif(trim(descripcion), '') order by length(nullif(trim(descripcion), '')) desc), null))[1] as raw_description
      from public.productos
      group by 1
    )
    select
      grouped.product_key,
      grouped.nombre,
      grouped.categoria,
      grouped.medida,
      grouped.color,
      grouped.precio_venta,
      grouped.stock_total,
      grouped.material_sistema,
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
  const data = result.rows.map(mapProduct);

  // Guardar en cache
  g._manareyProductsCache = { data, ts: Date.now() };

  return data;
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

  invalidateProductsCache();
  return getCatalogProductByKey(productKey);
}

export async function renameProduct(productKey, newName) {
  await ensureMetadataTable();

  // Buscar el producto por el key sin categoría
  const existing = await query(
    `SELECT min(medida) as medida, min(color) as color
     FROM public.productos
     WHERE md5(concat_ws('|', lower(trim(nombre)), lower(coalesce(trim(medida), '')), lower(coalesce(trim(color), '')))) = $1
     LIMIT 1`,
    [productKey],
  );
  if (!existing.rows.length) throw new Error("Producto no encontrado.");

  const { medida, color } = existing.rows[0];

  // Actualizar el nombre en todos los registros que coincidan
  await query(
    `UPDATE public.productos SET nombre = $1
     WHERE md5(concat_ws('|', lower(trim(nombre)), lower(coalesce(trim(medida), '')), lower(coalesce(trim(color), '')))) = $2`,
    [newName, productKey],
  );

  // Calcular el nuevo product_key desde las filas ya actualizadas
  const newKeyResult = await query(
    `SELECT md5(concat_ws('|', lower(trim(nombre)), lower(coalesce(trim(medida), '')), lower(coalesce(trim(color), '')))) as new_key
     FROM public.productos
     WHERE lower(trim(nombre)) = lower(trim($1))
       AND lower(coalesce(trim(medida), '')) = lower(trim(coalesce($2, '')))
       AND lower(coalesce(trim(color), '')) = lower(trim(coalesce($3, '')))
     LIMIT 1`,
    [newName, medida, color],
  );

  const newProductKey = newKeyResult.rows[0]?.new_key;

  // Migrar la metadata al nuevo product_key si cambió (solo pasa cuando se renombra)
  if (newProductKey && newProductKey !== productKey) {
    await query(
      `UPDATE public.productos_web_metadata SET product_key = $1, updated_at = now()
       WHERE product_key = $2`,
      [newProductKey, productKey],
    );
  }

  invalidateProductsCache();
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
  invalidateProductsCache();
}

/**
 * Actualiza el orden de los destacados.
 * Recibe un array de productKeys en el orden deseado.
 */
export async function reorderFeaturedProducts(orderedKeys) {
  await ensureMetadataTable();
  // Correr en paralelo en vez de secuencial
  await Promise.all(
    orderedKeys.map((key, i) =>
      query(
        `UPDATE public.productos_web_metadata SET featured_order = $1, updated_at = now() WHERE product_key = $2`,
        [i + 1, key],
      ),
    ),
  );
  invalidateProductsCache();
}
