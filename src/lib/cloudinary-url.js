/**
 * Ayudas para las URLs de Cloudinary. Va aparte de cloudinary.js porque este
 * archivo también se usa en el navegador y no puede importar nada de Node.
 *
 * Cloudinary transforma la foto al pedirla, sin guardar copias: `f_auto` manda
 * WebP o AVIF según el navegador, `q_auto` ajusta la calidad y `w_` el ancho.
 * El resultado queda en su CDN, así que se cobra una sola transformación por
 * cada medida.
 */

const RE_CLOUDINARY = /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i;

/** Anchos que se ofrecen al navegador; elige el que necesita según la pantalla. */
export const ANCHOS_DE_FOTO = [320, 480, 640, 960, 1280];

export function esUrlDeCloudinary(src) {
  return typeof src === "string" && RE_CLOUDINARY.test(src);
}

export function urlDeCloudinary(src, ancho) {
  return src.replace("/image/upload/", `/image/upload/f_auto,q_auto,w_${ancho}/`);
}

export function srcSetDeCloudinary(src) {
  return ANCHOS_DE_FOTO.map((ancho) => `${urlDeCloudinary(src, ancho)} ${ancho}w`).join(", ");
}
