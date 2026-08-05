"use client";

/**
 * ProductImage — renderiza imágenes de productos de forma optimizada.
 *
 * - URLs de Vercel Blob (https://*.public.blob.vercel-storage.com):
 *   usa next/image con optimización automática (WebP/AVIF, resize, cache CDN).
 * - Data URIs (base64) o cualquier otro src:
 *   usa <img> normal porque next/image no soporta data: URLs.
 */

import NextImage from "next/image";

const BLOB_HOST_RE = /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//i;

function isBlobUrl(src) {
  return typeof src === "string" && BLOB_HOST_RE.test(src);
}

/**
 * @param {Object} props
 * @param {string} props.src          - URL o data URI de la imagen
 * @param {string} props.alt          - Texto alternativo
 * @param {string} [props.className]  - Clase CSS para el elemento imagen
 * @param {"lazy"|"eager"} [props.loading] - Carga lazy/eager (solo para <img>)
 * @param {boolean} [props.priority]  - true = preload (solo para next/image)
 * @param {number} [props.width]      - Ancho en px (para next/image sin fill)
 * @param {number} [props.height]     - Alto en px (para next/image sin fill)
 * @param {boolean} [props.fill]      - next/image fill mode (parent must be relative)
 * @param {string} [props.sizes]      - sizes para next/image responsive
 * @param {"cover"|"contain"} [props.objectFit] - ajuste de la imagen dentro del contenedor (solo fill mode)
 */
export function ProductImage({
  src,
  alt,
  className,
  loading = "lazy",
  priority = false,
  width,
  height,
  fill = false,
  sizes,
  objectFit = "cover",
  ...rest
}) {
  if (!src) return null;

  if (isBlobUrl(src)) {
    if (fill) {
      return (
        <NextImage
          src={src}
          alt={alt || ""}
          fill
          sizes={sizes || "(max-width: 600px) 50vw, (max-width: 1200px) 25vw, 20vw"}
          className={className}
          priority={priority}
          style={{ objectFit }}
          {...rest}
        />
      );
    }
    return (
      <NextImage
        src={src}
        alt={alt || ""}
        width={width || 400}
        height={height || 400}
        className={className}
        priority={priority}
        sizes={sizes || "(max-width: 600px) 50vw, 25vw"}
        {...rest}
      />
    );
  }

  // Fallback: data URI o URL externa no reconocida
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt || ""}
      className={className}
      loading={loading}
      {...rest}
    />
  );
}
