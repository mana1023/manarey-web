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
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

const BLOB_HOST_RE = /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//i;

function isBlobUrl(src) {
  return typeof src === "string" && BLOB_HOST_RE.test(src);
}

/**
 * Lo que se muestra cuando una foto no carga: el logo de Manarey sobre el
 * fondo de la tarjeta, en vez del cuadro gris roto del navegador.
 *
 * Existe porque el almacenamiento de fotos (Vercel Blob, plan gratis) se
 * bloqueó al pasar 1 GB y todas las URLs empezaron a devolver 403: la tienda
 * entera parecía rota. Sirve igual para cualquier foto que falle en el futuro.
 * Es SVG, así que no depende de ninguna descarga.
 */
function FotoNoDisponible({ fill, width, height }) {
  return (
    <div
      className={`foto-no-disponible${fill ? " foto-no-disponible--fill" : ""}`}
      style={fill ? undefined : { width: width || 400, height: height || 400 }}
      role="img"
      aria-label="Foto no disponible por el momento"
    >
      <div aria-hidden="true">
        <BrandLogo />
      </div>
    </div>
  );
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
  const [fallo, setFallo] = useState(false);
  const imagenRef = useRef(null);

  useEffect(() => {
    setFallo(false);
    // Si la foto falló antes de que React se conectara a la página, onError
    // nunca se entera: se revisa a mano. "complete" con ancho 0 es una imagen
    // rota; una que todavía no empezó a cargar (lazy) no da complete.
    const img = imagenRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFallo(true);
  }, [src]);

  if (!src) return null;
  if (fallo) return <FotoNoDisponible fill={fill} width={width} height={height} />;
  const alFallar = () => setFallo(true);

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
          ref={imagenRef}
          onError={alFallar}
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
        ref={imagenRef}
        onError={alFallar}
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
      ref={imagenRef}
      onError={alFallar}
    />
  );
}
