"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { BrandLogo } from "@/components/brand-logo";
import { calculateItemsSubtotal } from "@/lib/shipping";
import { storeBranches, storeSettings } from "@/lib/store-config";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const PAGE_SIZE = 24;

function getMeasureMeta(rawMeasure) {
  if (!rawMeasure) return null;
  const medida = rawMeasure.trim();
  if (!medida) return null;
  if (/rodado/i.test(medida)) return { label: "Rodado", value: medida };
  if (/plaza/i.test(medida)) return { label: "Plazas", value: medida };
  if (/kg/i.test(medida)) return { label: "Capacidad", value: medida };
  return { label: "Medida", value: medida };
}

function isSilla(product) {
  return /silla/i.test(`${product.nombre} ${product.categoria || ""}`);
}

// Sillas que se venden en pack de 6 (todas menos las de pino)
function isSillaPack(product) {
  return isSilla(product) && !/pino/i.test(`${product.nombre} ${product.material || ""}`);
}

function supportsAccessory(product) {
  const name = `${product.nombre} ${product.categoria || ""}`.toLowerCase();
  return /(placard|placares|placar|cajonera|comodon|comoda|ropero|biblioteca|modular|despensero|alacena|mesa de luz|vanitory)/i.test(
    name,
  );
}

function useRevealOnScroll(activeView) {
  useEffect(() => {
    if (activeView !== "inicio") return undefined;
    const elements = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!elements.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("revealed");
        });
      },
      { threshold: 0.16 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [activeView]);
}

function ProductPlaceholder({ title, compact = false }) {
  return (
    <div className={compact ? "product-visual compact" : "product-visual"}>
      <div className="visual-topline">
        <div className="visual-badge">Manarey</div>
        <div className="visual-dot" />
      </div>
      <div className="visual-body">
        {title ? <div className="visual-title">{title}</div> : null}
      </div>
    </div>
  );
}

const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov|avi|mkv|m4v|wmv|3gp)(\?|$)/i;
function isVideoSrc(src) {
  return typeof src === "string" && (src.startsWith("data:video") || VIDEO_EXT_RE.test(src));
}

// Comprime imágenes en el navegador antes de enviarlas (max 1200px, JPEG 82%)
// Esto reduce fotos de celular de 5-8MB a menos de 300KB
async function compressImageFile(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

async function fileToDataUrl(file) {
  if (file.type.startsWith("image/")) {
    const compressed = await compressImageFile(file);
    if (compressed) return compressed;
  }
  // Fallback para imágenes sin comprimir
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

// Sube una imagen a Vercel Blob via el servidor y devuelve la URL pública.
async function uploadImageFile(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/products/upload-media", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "No se pudo subir la imagen.");
  return data.url;
}

// Sube un video directamente desde el browser a Vercel Blob (sin pasar por
// la función serverless) para evitar el límite de 4.5MB del body de la API.
async function uploadVideoClientSide(file) {
  const ext = file.name.split(".").pop() || "mp4";
  const blob = await upload(`productos/video-${Date.now()}.${ext}`, file, {
    access: "public",
    handleUploadUrl: "/api/products/upload-media",
  });
  return blob.url;
}

async function fileToUrl(file) {
  if (file.type.startsWith("image/")) {
    return uploadImageFile(file);
  }
  if (file.type.startsWith("video/")) {
    return uploadVideoClientSide(file);
  }
  return fileToDataUrl(file);
}

async function filesToDataUrls(files) {
  return Promise.all(Array.from(files).map(fileToUrl));
}


const PAYMENT_METHODS = [
  {
    /* Visa — path real de Simple Icons (wordmark vectorizado) */
    name: "Visa",
    icon: (
      <svg width="56" height="36" viewBox="0 0 56 36" aria-hidden="true">
        <rect width="56" height="36" rx="6" fill="#1A1F71"/>
        <svg x="4" y="4" width="48" height="28" viewBox="0 7 24 10" preserveAspectRatio="xMidYMid meet">
          <path fill="white" d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z"/>
        </svg>
      </svg>
    ),
  },
  {
    /* Mastercard — 3 paths separados del logo real de Simple Icons, coloreados */
    name: "Mastercard",
    icon: (
      <svg width="56" height="36" viewBox="0 0 56 36" aria-hidden="true">
        <rect width="56" height="36" rx="6" fill="#252525"/>
        <svg x="4" y="4" width="48" height="28" viewBox="0 4 24 16" preserveAspectRatio="xMidYMid meet">
          <path fill="#EB001B" d="M11.343 18.031c.058.049.12.098.181.146-1.177.783-2.59 1.238-4.107 1.238C3.32 19.416 0 16.096 0 12c0-4.095 3.32-7.416 7.416-7.416 1.518 0 2.931.456 4.105 1.238-.06.051-.12.098-.165.15C9.6 7.489 8.595 9.688 8.595 12c0 2.311 1.001 4.51 2.748 6.031z"/>
          <path fill="#F79E1B" d="M16.584 4.584c-1.52 0-2.931.456-4.105 1.238.06.051.12.098.165.15C14.4 7.489 15.405 9.688 15.405 12c0 2.31-1.001 4.507-2.748 6.031-.058.049-.12.098-.181.146 1.177.783 2.588 1.238 4.107 1.238C20.68 19.416 24 16.096 24 12c0-4.094-3.32-7.416-7.416-7.416z"/>
          <path fill="#FF5F00" d="M12 6.174c-.096.075-.189.15-.28.231C10.156 7.764 9.169 9.765 9.169 12c0 2.236.987 4.236 2.551 5.595.09.08.185.158.28.232.096-.074.189-.152.28-.232 1.563-1.359 2.551-3.359 2.551-5.595 0-2.235-.987-4.236-2.551-5.595-.09-.08-.184-.156-.28-.231z"/>
        </svg>
      </svg>
    ),
  },
  {
    /* American Express — path real de Simple Icons (diseño de tarjeta vectorizado) */
    name: "Amex",
    icon: (
      <svg width="56" height="36" viewBox="0 0 56 36" aria-hidden="true">
        <rect width="56" height="36" rx="6" fill="#007BC1"/>
        <svg x="2" y="2" width="52" height="32" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">
          <path fill="white" d="M16.015 14.378c0-.32-.135-.496-.344-.622-.21-.12-.464-.135-.81-.135h-1.543v2.82h.675v-1.027h.72c.24 0 .39.024.478.125.12.13.104.38.104.55v.35h.66v-.555c-.002-.25-.017-.376-.108-.516-.06-.08-.18-.18-.33-.234l.02-.008c.18-.072.48-.297.48-.747zm-.87.407l-.028-.002c-.09.053-.195.058-.33.058h-.81v-.63h.824c.12 0 .24 0 .33.05.098.048.156.147.15.255 0 .12-.045.215-.134.27zM20.297 15.837H19v.6h1.304c.676 0 1.05-.278 1.05-.884 0-.28-.066-.448-.187-.582-.153-.133-.392-.193-.73-.207l-.376-.015c-.104 0-.18 0-.255-.03-.09-.03-.15-.105-.15-.21 0-.09.017-.166.09-.21.083-.046.177-.066.272-.06h1.23v-.602h-1.35c-.704 0-.958.437-.958.84 0 .9.776.855 1.407.87.104 0 .18.015.225.06.046.03.082.106.082.18 0 .077-.035.15-.08.18-.06.053-.15.07-.277.07zM0 0v10.096L.81 8.22h1.75l.225.464V8.22h2.043l.45 1.02.437-1.013h6.502c.295 0 .56.057.756.236v-.23h1.787v.23c.307-.17.686-.23 1.12-.23h2.606l.24.466v-.466h1.918l.254.465v-.466h1.858v3.948H20.87l-.36-.6v.585h-2.353l-.256-.63h-.583l-.27.614h-1.213c-.48 0-.84-.104-1.08-.24v.24h-2.89v-.884c0-.12-.03-.12-.105-.135h-.105v1.036H6.067v-.48l-.21.48H4.69l-.202-.48v.465H2.235l-.256-.624H1.4l-.256.624H0V24h23.786v-7.108c-.27.135-.613.18-.973.18H21.09v-.255c-.21.165-.57.255-.914.255H14.71v-.9c0-.12-.018-.12-.12-.12h-.075v1.022h-1.8v-1.066c-.298.136-.643.15-.928.136h-.214v.915h-2.18l-.54-.617-.57.6H4.742v-3.93h3.61l.518.602.554-.6h2.412c.28 0 .74.03.942.225v-.24h2.177c.202 0 .644.045.903.225v-.24h3.265v.24c.163-.164.508-.24.803-.24h1.89v.24c.194-.15.464-.24.84-.24h1.176V0H0zM23.865 15.03v-.005c-.03-.025-.046-.048-.075-.07-.15-.153-.39-.215-.764-.225l-.36-.012c-.12 0-.194-.007-.27-.03-.09-.03-.15-.105-.15-.21 0-.09.03-.16.09-.204.076-.045.15-.05.27-.05h1.223v-.588h-1.283c-.69 0-.96.437-.96.84 0 .9.78.855 1.41.87.104 0 .18.015.224.06.046.03.076.106.076.18 0 .07-.034.138-.09.18-.045.056-.136.07-.27.07h-1.288v.605h1.287c.42 0 .734-.118.9-.36h.03c.09-.134.135-.3.135-.523 0-.24-.045-.39-.135-.526zM18.597 14.208v-.583h-2.235V16.458h2.235v-.585h-1.57v-.57h1.533v-.584h-1.532v-.51zM13.51 8.787h.685V11.6h-.684zM13.126 9.543c0-.314-.13-.5-.34-.624-.217-.125-.47-.135-.81-.135H10.43v2.82h.674v-1.034h.72c.24 0 .39.03.487.12.122.136.107.378.107.548v.354h.677v-.553c0-.25-.016-.375-.11-.516-.09-.107-.202-.19-.33-.237.172-.07.472-.3.472-.75zm-.855.396c-.09.054-.195.056-.33.056H11.1v-.623h.825c.12 0 .24.004.33.05.09.04.15.128.15.25s-.047.22-.134.266zM15.92 9.373h.632v-.6h-.644c-.464 0-.804.105-1.02.33-.286.3-.362.69-.362 1.11 0 .512.123.833.36 1.074.232.238.645.31.97.31h.78l.255-.627h1.39l.262.627h1.36v-2.11l1.272 2.11h.95V8.786h-.684v1.963l-1.18-1.96h-1.02V11.4L18.11 8.744h-1.004l-.943 2.22h-.3c-.177 0-.362-.03-.468-.134-.125-.15-.186-.36-.186-.662 0-.285.08-.51.194-.63.133-.135.272-.165.516-.165zm1.668-.108l.464 1.118h-.93l.466-1.12zM2.38 10.97l.254.628H4V9.393l.972 2.205h.584l.973-2.202.015 2.202h.69v-2.81H6.118l-.807 1.904-.876-1.905H3.343v2.663L2.205 8.787h-.997L.01 11.597h.72l.26-.626h1.39zm-.688-1.705l.46 1.118h-.915l.457-1.12zM11.856 13.62H9.714l-.85.923-.825-.922H5.346v2.82H8l.855-.932.824.93h1.302v-.94h.838c.6 0 1.17-.164 1.17-.945c0-.78-.598-.93-1.128-.93zM7.67 15.853H6.02v-.557h1.47v-.574H6.02v-.51H7.7l.733.82-.764.824zm2.642.33l-1.03-1.147 1.03-1.108v2.253zm1.553-1.258h-.885v-.717h.885c.24 0 .42.098.42.344 0 .243-.15.372-.42.372zM9.967 9.373v-.586H7.73V11.6h2.237v-.58H8.4v-.564h1.527V9.88H8.4v-.507z"/>
        </svg>
      </svg>
    ),
  },
  {
    /* Mercado Pago — path real de Simple Icons (logo oval de la marca) */
    name: "Mercado Pago",
    icon: (
      <svg width="56" height="36" viewBox="0 0 56 36" aria-hidden="true">
        <rect width="56" height="36" rx="6" fill="#009EE3"/>
        <svg x="2" y="2" width="52" height="32" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">
          <path fill="white" d="M11.115 16.479a.93.927 0 0 1-.939-.886c-.002-.042-.006-.155-.103-.155-.04 0-.074.023-.113.059-.112.103-.254.206-.46.206a.816.814 0 0 1-.305-.066c-.535-.214-.542-.578-.521-.725.006-.038.007-.08-.02-.11l-.032-.03h-.034c-.027 0-.055.012-.093.039a.788.786 0 0 1-.454.16.7.699 0 0 1-.253-.05c-.708-.27-.65-.928-.617-1.126.005-.041-.005-.072-.03-.092l-.05-.04-.047.043a.728.726 0 0 1-.505.203.73.728 0 0 1-.732-.725c0-.4.328-.722.732-.722.364 0 .675.27.721.63l.026.195.11-.165c.01-.018.307-.46.852-.46.102 0 .21.016.316.05.434.13.508.52.519.68.008.094.075.1.09.1.037 0 .064-.024.083-.045a.746.744 0 0 1 .54-.225c.128 0 .263.03.402.09.69.293.379 1.158.374 1.167-.058.144-.061.207-.005.244l.027.013h.02c.03 0 .07-.014.134-.035.093-.032.235-.08.367-.08a.944.942 0 0 1 .94.93.936.934 0 0 1-.94.928zm7.302-4.171c-1.138-.98-3.768-3.24-4.481-3.77-.406-.302-.685-.462-.928-.533a1.559 1.554 0 0 0-.456-.07c-.182 0-.376.032-.58.095-.46.145-.918.505-1.362.854l-.023.018c-.414.324-.84.66-1.164.73a1.986 1.98 0 0 1-.43.049c-.362 0-.687-.104-.81-.258-.02-.025-.007-.066.04-.125l.008-.008 1-1.067c.783-.774 1.525-1.506 3.23-1.545h.085c1.062 0 2.12.469 2.24.524a7.03 7.03 0 0 0 3.056.724c1.076 0 2.188-.263 3.354-.795a9.135 9.11 0 0 0-.405-.317c-1.025.44-2.003.66-2.946.66-.962 0-1.925-.229-2.858-.68-.05-.022-1.22-.567-2.44-.57-.032 0-.065 0-.096.002-1.434.033-2.24.536-2.782.976-.528.013-.982.138-1.388.25-.361.1-.673.186-.979.185-.125 0-.35-.01-.37-.012-.35-.01-2.115-.437-3.518-.962-.143.1-.28.203-.415.31 1.466.593 3.25 1.053 3.812 1.089.157.01.323.027.491.027.372 0 .744-.103 1.104-.203.213-.059.446-.123.692-.17l-.196.194-1.017 1.087c-.08.08-.254.294-.14.557a.705.703 0 0 0 .268.292c.243.162.677.27 1.08.271.152 0 .297-.015.43-.044.427-.095.874-.448 1.349-.82.377-.296.913-.672 1.323-.782a1.494 1.49 0 0 1 .37-.05.611.61 0 0 1 .095.005c.27.034.533.125 1.003.472.835.62 4.531 3.815 4.566 3.846.002.002.238.203.22.537-.007.186-.11.352-.294.466a.902.9 0 0 1-.484.15.804.802 0 0 1-.428-.124c-.014-.01-1.28-1.157-1.746-1.543-.074-.06-.146-.115-.22-.115a.122.122 0 0 0-.096.045c-.073.09.01.212.105.294l1.48 1.47c.002 0 .184.17.204.395.012.244-.106.447-.35.606a.957.955 0 0 1-.526.171.766.764 0 0 1-.42-.127l-.214-.206a21.035 20.978 0 0 0-1.08-1.009c-.072-.058-.148-.112-.221-.112a.127.127 0 0 0-.094.038c-.033.037-.056.103.028.212a.698.696 0 0 0 .075.083l1.078 1.198c.01.01.222.26.024.511l-.038.048a1.18 1.178 0 0 1-.1.096c-.184.15-.43.164-.527.164a.8.798 0 0 1-.147-.012c-.106-.018-.178-.048-.212-.089l-.013-.013c-.06-.06-.602-.609-1.054-.98-.059-.05-.133-.11-.21-.11a.128.128 0 0 0-.096.042c-.09.096.044.24.1.293l.92 1.003a.204.204 0 0 1-.033.062c-.033.044-.144.155-.479.196a.91.907 0 0 1-.122.007c-.345 0-.712-.164-.902-.264a1.343 1.34 0 0 0 .13-.576 1.368 1.365 0 0 0-1.42-1.357c.024-.342-.025-.99-.697-1.274a1.455 1.452 0 0 0-.575-.125c-.146 0-.287.025-.42.075a1.153 1.15 0 0 0-.671-.564 1.52 1.515 0 0 0-.494-.085c-.28 0-.537.08-.767.242a1.168 1.165 0 0 0-.903-.43 1.173 1.17 0 0 0-.82.335c-.287-.217-1.425-.93-4.467-1.613a17.39 17.344 0 0 1-.692-.189 4.822 4.82 0 0 0-.077.494l.67.157c3.108.682 4.136 1.391 4.309 1.525a1.145 1.142 0 0 0-.09.442 1.16 1.158 0 0 0 1.378 1.132c.096.467.406.821.879 1.003a1.165 1.162 0 0 0 .415.08c.09 0 .179-.012.266-.034.086.22.282.493.722.668a1.233 1.23 0 0 0 .457.094c.122 0 .241-.022.355-.063a1.373 1.37 0 0 0 1.269.841c.37.002.726-.147.985-.41.221.121.688.341 1.163.341.06 0 .118-.002.175-.01.47-.059.689-.24.789-.382a.571.57 0 0 0 .048-.078c.11.032.234.058.373.058.255 0 .501-.086.75-.265.244-.174.418-.424.444-.637v-.01c.083.017.167.026.251.026.265 0 .527-.082.773-.242.48-.31.562-.715.554-.98a1.28 1.279 0 0 0 .978-.194 1.04 1.04 0 0 0 .502-.808 1.088 1.085 0 0 0-.16-.653c.804-.342 2.636-1.003 4.795-1.483a4.734 4.721 0 0 0-.067-.492 27.742 27.667 0 0 0-5.049 1.62zm5.123-.763c0 4.027-5.166 7.293-11.537 7.293-6.372 0-11.538-3.266-11.538-7.293 0-4.028 5.165-7.293 11.539-7.293 6.371 0 11.537 3.265 11.537 7.293zm.46.004c0-4.272-5.374-7.755-12-7.755S.002 7.277.002 11.55L0 12.004c0 4.533 4.695 8.203 11.999 8.203 7.347 0 12-3.67 12-8.204z"/>
        </svg>
      </svg>
    ),
  },
  {
    /* Naranja X — colores y tipografía de marca */
    name: "Naranja X",
    icon: (
      <svg width="56" height="36" viewBox="0 0 56 36" aria-hidden="true">
        <rect width="56" height="36" rx="6" fill="#FF5A00"/>
        <text x="28" y="17" textAnchor="middle" fill="white" fontFamily="Arial,Helvetica,sans-serif" fontSize="11" fontWeight="700" letterSpacing="0.5">naranja</text>
        <text x="28" y="30" textAnchor="middle" fill="white" fontFamily="Arial,Helvetica,sans-serif" fontSize="13" fontWeight="900" letterSpacing="1">X</text>
      </svg>
    ),
  },
  {
    /* Cabal — azul y rojo, colores reales de la tarjeta */
    name: "Cabal",
    icon: (
      <svg width="56" height="36" viewBox="0 0 56 36" aria-hidden="true">
        <rect width="56" height="36" rx="6" fill="#003087"/>
        <rect x="0" y="22" width="56" height="14" rx="0" fill="#E31837"/>
        <path d="M0 22 L56 22 L56 36 Q56 36 28 36 Q0 36 0 36 Z" fill="#E31837"/>
        <text x="28" y="17" textAnchor="middle" fill="white" fontFamily="Arial,Helvetica,sans-serif" fontSize="12" fontWeight="900" letterSpacing="2">CABAL</text>
        <polyline points="6,26 3,29 6,32" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="50,26 53,29 50,32" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    /* Débito — diseño de tarjeta de débito con los círculos del logo Maestro */
    name: "Débito",
    icon: (
      <svg width="56" height="36" viewBox="0 0 56 36" aria-hidden="true">
        <rect width="56" height="36" rx="6" fill="#1565C0"/>
        <rect x="4" y="10" width="48" height="6" rx="1" fill="rgba(255,255,255,0.22)"/>
        <rect x="4" y="21" width="18" height="5" rx="2" fill="rgba(255,255,255,0.8)"/>
        <circle cx="42" cy="12" r="6" fill="#EB001B" opacity="0.9"/>
        <circle cx="50" cy="12" r="6" fill="#F79E1B" opacity="0.9"/>
        <path d="M46 7.2a6.1 6.1 0 0 1 0 9.6A6.1 6.1 0 0 1 46 7.2z" fill="#FF5F00"/>
        <text x="28" y="33" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontFamily="Arial,sans-serif" fontSize="6" fontWeight="600" letterSpacing="0.5">DÉBITO</text>
      </svg>
    ),
  },
  {
    /* Transferencia bancaria — ícono de banco clásico */
    name: "Transferencia",
    icon: (
      <svg width="56" height="36" viewBox="0 0 56 36" aria-hidden="true">
        <rect width="56" height="36" rx="6" fill="#003087"/>
        <polygon points="10,17 28,6 46,17" fill="rgba(255,255,255,0.95)"/>
        <rect x="12" y="17" width="32" height="13" rx="1" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8"/>
        <rect x="15" y="18" width="5" height="11" rx="0.5" fill="rgba(255,255,255,0.8)"/>
        <rect x="23" y="18" width="5" height="11" rx="0.5" fill="rgba(255,255,255,0.8)"/>
        <rect x="31" y="18" width="5" height="11" rx="0.5" fill="rgba(255,255,255,0.8)"/>
        <rect x="39" y="18" width="5" height="11" rx="0.5" fill="rgba(255,255,255,0.8)"/>
        <rect x="10" y="30" width="36" height="2.5" rx="0.5" fill="rgba(255,255,255,0.9)"/>
      </svg>
    ),
  },
  {
    /* Efectivo — billete estilizado */
    name: "Efectivo",
    icon: (
      <svg width="56" height="36" viewBox="0 0 56 36" aria-hidden="true">
        <rect width="56" height="36" rx="6" fill="#2E7D32"/>
        <rect x="4" y="8" width="48" height="20" rx="3" fill="rgba(0,0,0,0.2)" stroke="rgba(255,255,255,0.28)" strokeWidth="0.8"/>
        <rect x="4" y="8" width="48" height="4" rx="2" fill="rgba(255,255,255,0.1)"/>
        <rect x="4" y="24" width="48" height="4" rx="2" fill="rgba(255,255,255,0.1)"/>
        <circle cx="28" cy="18" r="7.5" fill="rgba(255,255,255,0.13)" stroke="rgba(255,255,255,0.38)" strokeWidth="0.8"/>
        <text x="28" y="22" textAnchor="middle" fill="rgba(255,255,255,0.95)" fontFamily="Arial,sans-serif" fontSize="13" fontWeight="900">$</text>
        <circle cx="10" cy="18" r="4" fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6"/>
        <circle cx="46" cy="18" r="4" fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6"/>
      </svg>
    ),
  },
  {
    /* Cuenta DNI — Banco Provincia: verde con figura humana (logo real) */
    name: "Cuenta DNI",
    icon: (
      <svg width="56" height="36" viewBox="0 0 56 36" aria-hidden="true">
        <rect width="56" height="36" rx="6" fill="#00873E"/>
        <circle cx="28" cy="9" r="4.5" fill="white"/>
        <rect x="24.5" y="14.5" width="7" height="9" rx="2.5" fill="white"/>
        <line x1="24.5" y1="17" x2="16" y2="12" stroke="white" strokeWidth="3" strokeLinecap="round"/>
        <line x1="31.5" y1="17" x2="40" y2="12" stroke="white" strokeWidth="3" strokeLinecap="round"/>
        <line x1="26" y1="23.5" x2="23.5" y2="31" stroke="white" strokeWidth="3" strokeLinecap="round"/>
        <line x1="30" y1="23.5" x2="32.5" y2="31" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export function CatalogClient({ initialProducts, session, catalogError }) {
  const whatsappNumber = storeSettings.whatsappNumber;
  const contactEmail = storeSettings.supportEmail;
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("todas");
  const [sortBy, setSortBy] = useState("relevancia");
  // Admin login (para gestionar productos)
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");

  // Customer auth modal
  const [customerAuthOpen, setCustomerAuthOpen] = useState(false);
  const [customerAuthMode, setCustomerAuthMode] = useState("login"); // login | register
  const [customerAuthData, setCustomerAuthData] = useState({ email: "", password: "", nombre: "", apellido: "", telefono: "" });
  const [customerAuthBusy, setCustomerAuthBusy] = useState(false);
  const [customerAuthError, setCustomerAuthError] = useState("");
  const [catalogCustomer, setCatalogCustomer] = useState(null);
  const [activeEditor, setActiveEditor] = useState(null);
  const [adminEditorOpen, setAdminEditorOpen] = useState(false); // modal del editor admin
  const [adminEditorError, setAdminEditorError] = useState("");
  const [adminPhotoFilter, setAdminPhotoFilter] = useState("todos"); // "todos" | "sin-foto" | "con-foto"
  const [adminBranchFilter, setAdminBranchFilter] = useState(""); // "" | branch name
  const [shippingSettingsOpen, setShippingSettingsOpen] = useState(false);
  const [shippingForm, setShippingForm] = useState({ baseCost: "", perKm: "" });
  const [shippingFormBusy, setShippingFormBusy] = useState(false);
  const [shippingFormMsg, setShippingFormMsg] = useState("");
  const [featuredOpen, setFeaturedOpen] = useState(false);
  const [featuredList, setFeaturedList] = useState([]); // [{productKey, nombre, ...}] en orden
  const [migratingImages, setMigratingImages] = useState(false);
  const [migrateResult, setMigrateResult] = useState(null);
  const [featuredBusy, setFeaturedBusy] = useState(false);
  const [branchStockCache, setBranchStockCache] = useState({}); // { [productKey]: [{ local, stock }] }
  const [stockUpdating, setStockUpdating] = useState({}); // { [productKey+local]: true }
  const [catalogPage, setCatalogPage] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState({}); // { [variantGroupKey]: productKey }
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartButtonPop, setCartButtonPop] = useState(false);
  const [activeView, setActiveView] = useState("inicio");
  const [homeCategory, setHomeCategory] = useState("");
  const [selectedProductKey, setSelectedProductKey] = useState("");
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);
  const carouselTouchStartX = useRef(null);
  const [detailAccessorySelected, setDetailAccessorySelected] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [adminUploadBusy, setAdminUploadBusy] = useState(false);
  const [adminUploadError, setAdminUploadError] = useState("");
  const [pending, startTransition] = useTransition();

  // ── Nombres en pantalla (solo frontend, localStorage, no toca la BD) ──────
  // El admin puede poner un "alias" para mostrar en la tienda sin cambiar el
  // nombre real del sistema.  Se guarda en localStorage y solo afecta lo que
  // ven los clientes en ESTA sesión del navegador admin.
  const [displayNames, setDisplayNames] = useState(() => {
    try {
      const stored = typeof window !== "undefined" && window.localStorage.getItem("manarey-display-names");
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  function setDisplayName(productKey, value) {
    setDisplayNames((prev) => {
      const next = { ...prev };
      if (value.trim()) {
        next[productKey] = value.trim();
      } else {
        delete next[productKey];
      }
      try { window.localStorage.setItem("manarey-display-names", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // Devuelve el nombre a mostrar al cliente (alias si existe, sino el real)
  function getDisplayName(productKey, nombreReal) {
    return displayNames[productKey] || nombreReal;
  }

  useRevealOnScroll(activeView);

  const accessoryProduct = useMemo(
    () =>
      products.find(
        (item) =>
          item.categoria?.toLowerCase() === "accesorios" &&
          item.nombre.toLowerCase().includes("manija"),
      ) || null,
    [products],
  );

  const visibleProducts = useMemo(
    () => {
      const base = products.filter((item) => item.categoria?.toLowerCase() !== "accesorios");
      if (session.isAdmin) return base;
      return base.filter((item) => Boolean(item.imageData) || item.imagesData?.length > 0);
    },
    [products, session.isAdmin],
  );

  const categories = useMemo(
    () => ["todas", ...new Set(visibleProducts.map((item) => item.categoria).filter(Boolean))],
    [visibleProducts],
  );

  const inStockCount = useMemo(
    () => visibleProducts.filter((product) => !product.isSoldOut).length,
    [visibleProducts],
  );

  useEffect(() => {
    if (!homeCategory) {
      setHomeCategory(categories.find((item) => item !== "todas") || "todas");
    }
  }, [categories, homeCategory]);

  useEffect(() => {
    try {
      const storedCart = window.localStorage.getItem("manarey-cart");
      if (storedCart) {
        setCart(JSON.parse(storedCart));
      }
      const storedCheckout = window.localStorage.getItem("manarey-checkout");
      if (storedCheckout) {
        setCustomerData((current) => ({ ...current, ...JSON.parse(storedCheckout) }));
      }
    } catch {
      window.localStorage.removeItem("manarey-cart");
      window.localStorage.removeItem("manarey-checkout");
    }
  }, []);

  // Leer hash de la URL al montar para restaurar vista y categoría tras un refresh
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const [view, cat] = hash.split("/");
    const validViews = ["inicio", "catalogo", "sobre-nosotros", "contacto"];
    if (validViews.includes(view)) {
      setActiveView(view);
      if (view === "catalogo" && cat) setCategory(decodeURIComponent(cat));
    }
  }, []);

  // Sincronizar hash con la vista y categoría activa
  useEffect(() => {
    if (activeView === "inicio") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } else if (activeView === "catalogo" && category && category !== "todas") {
      history.replaceState(null, "", `#catalogo/${encodeURIComponent(category)}`);
    } else {
      history.replaceState(null, "", `#${activeView}`);
    }
  }, [activeView, category]);

  // Resetear scroll del modal de detalle al abrir un producto
  useEffect(() => {
    if (selectedProductKey) {
      const grid = document.querySelector(".detail-grid");
      if (grid) grid.scrollTop = 0;
    }
  }, [selectedProductKey]);

  // Cargar sesión del cliente al montar
  useEffect(() => {
    fetch("/api/auth/customer/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.customer) setCatalogCustomer(data.customer); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    window.localStorage.setItem("manarey-cart", JSON.stringify(cart));
  }, [cart]);

  // Bloquear scroll del body cuando cualquier modal está abierto
  useEffect(() => {
    const anyOpen = adminEditorOpen || loginOpen || featuredOpen || shippingSettingsOpen || cartOpen;
    if (anyOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
    } else {
      const top = document.body.style.top;
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      if (top) window.scrollTo(0, parseInt(top || "0") * -1);
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
    };
  }, [adminEditorOpen, loginOpen, featuredOpen, shippingSettingsOpen, cartOpen]);

  // Carga masiva de stock al entrar al modo admin (una sola consulta para todos los productos)
  useEffect(() => {
    if (!session.isAdmin) return;
    fetch("/api/products/branch-stock-all")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.cache && Object.keys(data.cache).length > 0) {
          setBranchStockCache(data.cache);
        }
      })
      .catch(() => {});
  }, [session.isAdmin]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = visibleProducts.filter((product) => {
      const matchesCategory = category === "todas" || product.categoria?.toLowerCase() === category.toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        product.nombre.toLowerCase().includes(normalizedQuery) ||
        (product.categoria || "").toLowerCase().includes(normalizedQuery) ||
        (product.medida || "").toLowerCase().includes(normalizedQuery) ||
        (product.description || "").toLowerCase().includes(normalizedQuery);
      const matchesPhotoFilter =
        !session.isAdmin ||
        adminPhotoFilter === "todos" ||
        (adminPhotoFilter === "sin-foto" && !product.imageData) ||
        (adminPhotoFilter === "con-foto" && Boolean(product.imageData));
      return matchesCategory && matchesQuery && matchesPhotoFilter;
    });
    return [...filtered].sort((left, right) => {
      switch (sortBy) {
        case "precio-asc": return left.precioVenta - right.precioVenta;
        case "precio-desc": return right.precioVenta - left.precioVenta;
        case "nombre": return left.nombre.localeCompare(right.nombre, "es");
        case "stock": return right.stockTotal - left.stockTotal;
        default:
          if (left.isSoldOut !== right.isSoldOut) return left.isSoldOut ? 1 : -1;
          return left.nombre.localeCompare(right.nombre, "es");
      }
    });
  }, [category, query, sortBy, visibleProducts, session.isAdmin, adminPhotoFilter]);

  const filteredGroups = useMemo(() => {
    const groupMap = new Map();
    for (const product of filteredProducts) {
      const key = product.variantGroupKey;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key).push(product);
    }
    const groups = [...groupMap.entries()].map(([key, variants]) => ({ key, variants }));

    // Si hay filtro de sucursal activo y el caché ya cargó, ordenar: primero los que tienen stock > 0 en ese local
    if (adminBranchFilter && Object.keys(branchStockCache).length > 0) {
      groups.sort((a, b) => {
        const stockA = branchStockCache[a.variants[0]?.productKey]?.find((br) => br.local === adminBranchFilter)?.stock ?? -1;
        const stockB = branchStockCache[b.variants[0]?.productKey]?.find((br) => br.local === adminBranchFilter)?.stock ?? -1;
        // Primero los que tienen stock (desc), luego los sin stock, luego los no cargados aún
        if (stockA > 0 && stockB <= 0) return -1;
        if (stockB > 0 && stockA <= 0) return 1;
        if (stockA > 0 && stockB > 0) return stockB - stockA; // mayor stock primero
        return 0;
      });
    }

    return groups;
  }, [filteredProducts, adminBranchFilter, branchStockCache]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCatalogPage(1);
  }, [filteredProducts, adminBranchFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const pagedGroups = filteredGroups.slice((catalogPage - 1) * PAGE_SIZE, catalogPage * PAGE_SIZE);

  const homeProducts = useMemo(() => {
    // Si hay productos marcados como destacados (y no hay filtro de categoría activo), priorizarlos
    const manualFeatured = visibleProducts
      .filter((p) => p.isFeatured)
      .sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999));

    if (manualFeatured.length > 0 && !homeCategory) {
      return manualFeatured.slice(0, 5);
    }

    // Fallback: primeros productos de la categoría elegida
    const selectedCategory = homeCategory || categories.find((item) => item !== "todas") || "todas";
    return visibleProducts
      .filter((product) =>
        selectedCategory === "todas"
          ? true
          : product.categoria?.toLowerCase() === selectedCategory.toLowerCase(),
      )
      .slice(0, 5);
  }, [categories, homeCategory, visibleProducts]);

  const featuredMainProduct = homeProducts[0] || null;
  const featuredSideProducts = homeProducts.slice(1, 5);
  const heroCategories = categories.filter((item) => item !== "todas").slice(0, 4);

  const selectedProduct = useMemo(
    () => visibleProducts.find((product) => product.productKey === selectedProductKey) || null,
    [selectedProductKey, visibleProducts],
  );

  const relatedProducts = useMemo(() => {
    if (!selectedProduct) return [];
    return visibleProducts
      .filter(
        (product) =>
          product.productKey !== selectedProduct.productKey &&
          product.categoria === selectedProduct.categoria,
      )
      .slice(0, 4);
  }, [selectedProduct, visibleProducts]);

  const detailAccessoryPrice =
    detailAccessorySelected && accessoryProduct ? accessoryProduct.precioVenta : 0;
  const detailTotal = selectedProduct ? selectedProduct.precioVenta + detailAccessoryPrice : 0;

  const cartCount = useMemo(
    () => cart.reduce((accumulator, item) => accumulator + item.quantity, 0),
    [cart],
  );

  const checkoutSummary = useMemo(
    () => ({ subtotal: calculateItemsSubtotal(cart) }),
    [cart],
  );

  function buildContactLink(message, subject = "Consulta Manarey") {
    if (whatsappNumber) {
      return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    }

    return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  }

  function buildWhatsAppLink(product, withAccessory = false) {
    const parts = [
      `Hola, quiero consultar por ${product.nombre}`,
      product.categoria ? `Categoria: ${product.categoria}` : "",
      product.medida ? `Medida: ${product.medida}` : "",
      `Precio web: ${currencyFormatter.format(
        product.precioVenta + (withAccessory && accessoryProduct ? accessoryProduct.precioVenta : 0),
      )}`,
      withAccessory && accessoryProduct ? `Con ${accessoryProduct.nombre}` : "",
    ].filter(Boolean);

    return buildContactLink(parts.join("\n"), `Consulta por ${product.nombre}`);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    // Intentar login de admin primero
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginData),
    });
    if (response.ok) {
      window.location.reload();
      return;
    }
    // Si falla y parece un email, intentar login de cliente
    if (loginData.username.includes("@")) {
      const custRes = await fetch("/api/auth/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginData.username, password: loginData.password }),
      });
      if (custRes.ok) {
        const data = await custRes.json();
        setCatalogCustomer(data.customer);
        setLoginOpen(false);
        setLoginData({ username: "", password: "" });
        return;
      }
    }
    const payload = await response.json().catch(() => ({}));
    setLoginError(payload.error || "Usuario o contraseña incorrectos.");
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  }

  // ── Customer auth ────────────────────────────────────────────────────────

  async function handleCustomerAuth(e) {
    e.preventDefault();
    setCustomerAuthBusy(true);
    setCustomerAuthError("");
    try {
      const endpoint = customerAuthMode === "register"
        ? "/api/auth/customer/register"
        : "/api/auth/customer/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerAuthData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error de autenticación.");
      setCatalogCustomer(data.customer);
      setLoginOpen(false);
      setCustomerAuthData({ email: "", password: "", nombre: "", apellido: "", telefono: "" });
    } catch (err) {
      setCustomerAuthError(err.message);
    } finally {
      setCustomerAuthBusy(false);
    }
  }

  async function handleCustomerLogout() {
    await fetch("/api/auth/customer/logout", { method: "POST" });
    setCatalogCustomer(null);
  }

  function navigateTo(view) {
    setActiveView(view);
    setSelectedProductKey("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openProductDetail(product) {
    setSelectedProductKey(product.productKey);
    setDetailAccessorySelected(false);
    setDetailPhotoIndex(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getActiveVariant(variantGroupKey, variants) {
    const key = selectedVariants[variantGroupKey];
    return (key && variants.find((v) => v.productKey === key)) || variants[0];
  }

  async function loadBranchStock(productKey) {
    if (branchStockCache[productKey]) return;
    try {
      const res = await fetch(`/api/products/branch-stock?productKey=${productKey}&allBranches=true`);
      if (!res.ok) return;
      const data = await res.json();
      setBranchStockCache((prev) => ({ ...prev, [productKey]: data.branches || [] }));
    } catch {}
  }

  async function updateBranchStock(productKey, local, delta) {
    const cacheKey = `${productKey}::${local}`;
    setStockUpdating((prev) => ({ ...prev, [cacheKey]: true }));
    try {
      const res = await fetch(`/api/products/${productKey}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ local, delta }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setBranchStockCache((prev) => ({
        ...prev,
        [productKey]: (prev[productKey] || []).map((b) =>
          b.local === local ? { ...b, stock: data.stock } : b,
        ),
      }));
      // Also update global stockTotal in products list
      setProducts((prev) =>
        prev.map((p) => {
          if (p.productKey !== productKey) return p;
          const newTotal = p.stockTotal + delta;
          return { ...p, stockTotal: Math.max(0, newTotal), isSoldOut: newTotal <= 0 };
        }),
      );
    } finally {
      setStockUpdating((prev) => {
        const n = { ...prev };
        delete n[cacheKey];
        return n;
      });
    }
  }

  function addToCart(product, options = {}) {
    if (product.isSoldOut) return;
    const stock = product.stockTotal || 0;
    if (stock <= 0) return;
    const accessorySelected = Boolean(options.accessorySelected);
    const accessoryPrice = accessorySelected && accessoryProduct ? accessoryProduct.precioVenta : 0;
    const lineKey = accessorySelected ? `${product.productKey}:accessory` : product.productKey;
    const qty = options.quantity || 1;
    setCart((current) => {
      const existing = current.find((item) => item.lineKey === lineKey);
      if (existing) {
        const newQty = Math.min(existing.quantity + qty, stock);
        if (newQty === existing.quantity) return current;
        return current.map((item) =>
          item.lineKey === lineKey ? { ...item, quantity: newQty } : item,
        );
      }
      return [
        ...current,
        {
          lineKey,
          productKey: product.productKey,
          nombre: product.nombre,
          material: product.material || "",
          precioVenta: product.precioVenta,
          accessoryPrice,
          accessoryLabel: accessorySelected ? accessoryProduct?.nombre || "Manijas" : "",
          quantity: Math.min(qty, stock),
        },
      ];
    });
    // Animación pop en el botón del carrito
    setCartButtonPop(true);
    setTimeout(() => setCartButtonPop(false), 400);
    setCartOpen(true);
  }

  function changeCartQuantity(lineKey, delta) {
    setCart((current) =>
      current
        .map((item) => {
          if (item.lineKey !== lineKey) return item;
          const prod = products.find((p) => p.productKey === item.productKey);
          const stock = prod?.stockTotal ?? Infinity;
          const newQty = Math.max(0, Math.min(item.quantity + delta, stock));
          return { ...item, quantity: newQty };
        })
        .filter((item) => item.quantity > 0),
    );
  }

  function handleEditorChange(productKey, field, value) {
    setActiveEditor((current) => ({
      ...(current && current.productKey === productKey ? current : { productKey }),
      [field]: value,
    }));
  }

  function openEditor(product) {
    setActiveEditor({
      productKey: product.productKey,
      nombre: product.nombre || "",
      nombreOriginal: product.nombre || "",
      medidaOriginal: product.medida || "",
      description: product.description || "",
      precioVenta: String(product.precioVenta || ""),
      precioOriginal: product.precioOriginal || product.precioVenta,
      altoCm: product.altoCm != null ? String(product.altoCm) : "",
      anchoCm: product.anchoCm != null ? String(product.anchoCm) : "",
      profundidadCm: product.profundidadCm != null ? String(product.profundidadCm) : "",
      largoCm: product.largoCm != null ? String(product.largoCm) : "",
      litros: product.litros != null ? String(product.litros) : "",
      watts: product.watts != null ? String(product.watts) : "",
      pesoKg: product.pesoKg != null ? String(product.pesoKg) : "",
      voltaje: product.voltaje || "",
      material: product.material || "",
      capacidad: product.capacidad || "",
      imageData: product.imageData || "",
      imagesData: product.imagesData && product.imagesData.length > 0
        ? product.imagesData
        : product.imageData ? [product.imageData] : [],
      removeImage: false,
    });
    loadBranchStock(product.productKey);
    setAdminEditorOpen(true);
  }

  async function handleImageChange(event, productKey) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setAdminUploadError("");
    setAdminUploadBusy(true);
    try {
      const newUrls = await filesToDataUrls(files);
      setActiveEditor((prev) => {
        if (!prev || prev.productKey !== productKey) return prev;
        const existing = prev.imagesData || [];
        const merged = [...existing, ...newUrls];
        return { ...prev, imagesData: merged, imageData: merged[0] || "", removeImage: false };
      });
    } catch (err) {
      setAdminUploadError(err?.message || "No se pudo subir el archivo.");
    } finally {
      setAdminUploadBusy(false);
      event.target.value = "";
    }
  }

  function handleRemoveImage(productKey, index) {
    setActiveEditor((prev) => {
      if (!prev || prev.productKey !== productKey) return prev;
      const updated = (prev.imagesData || []).filter((_, i) => i !== index);
      return { ...prev, imagesData: updated, imageData: updated[0] || "", removeImage: updated.length === 0 };
    });
  }

  function handleMoveImage(productKey, index, direction) {
    setActiveEditor((prev) => {
      if (!prev || prev.productKey !== productKey) return prev;
      const arr = [...(prev.imagesData || [])];
      const target = index + direction;
      if (target < 0 || target >= arr.length) return prev;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return { ...prev, imagesData: arr, imageData: arr[0] || "" };
    });
  }

  async function handleSave(productKey) {
    if (!activeEditor || activeEditor.productKey !== productKey) return;
    setAdminEditorError("");

    const nameChanged =
      (activeEditor.nombre || "").trim() !== (activeEditor.nombreOriginal || "").trim();

    if (nameChanged) {
      const ok = window.confirm(
        `⚠️ ATENCIÓN: Estás por cambiar el nombre del producto directamente en la base de datos.\n\nNombre actual: "${activeEditor.nombreOriginal}"\nNombre nuevo: "${activeEditor.nombre.trim()}"\n\nEsta acción modifica la tabla de productos del sistema. ¿Confirmás el cambio?`,
      );
      if (!ok) return;
    }

    startTransition(async () => {
      const payloadBody = {
        ...activeEditor,
        nombre: nameChanged ? activeEditor.nombre.trim() : undefined,
        imagesData: Array.isArray(activeEditor.imagesData)
          ? activeEditor.imagesData
          : activeEditor.imageData ? [activeEditor.imageData] : [],
      };
      const response = await fetch(`/api/products/${productKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      });
      const payload = await response.json();
      if (!response.ok) {
        setAdminEditorError(payload?.error || "No se pudo guardar el producto.");
        return;
      }
      const newKey = payload.newProductKey;
      setProducts((current) =>
        current.map((product) =>
          product.productKey === productKey ? payload.producto : product,
        ),
      );
      setActiveEditor(null);
      setAdminEditorOpen(false);
      if (newKey) {
        setBranchStockCache((prev) => {
          const updated = { ...prev };
          if (updated[productKey]) {
            updated[newKey] = updated[productKey];
            delete updated[productKey];
          }
          return updated;
        });
      }
    });
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <div className="header-brand">
          <button className="logo-link logo-button" onClick={() => navigateTo("inicio")} type="button">
            <BrandLogo compact />
          </button>
        </div>

        <nav className="main-nav">
          {[
            ["inicio", "Inicio"],
            ["catalogo", "Catálogo"],
            ["sobre-nosotros", "Sobre nosotros"],
            ["contacto", "Contacto"],
          ].map(([view, label]) => (
            <button
              key={view}
              className={activeView === view ? "nav-pill active" : "nav-pill"}
              onClick={() => navigateTo(view)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          {session.isAdmin ? (
            <div className="customer-badge desktop-only">
              <span className="customer-hello">👤 Admin</span>
              <button className="customer-logout-btn" onClick={handleLogout} type="button">Salir</button>
            </div>
          ) : catalogCustomer ? (
            <div className="customer-badge desktop-only">
              <span className="customer-hello">Hola, {catalogCustomer.nombre}</span>
              <button className="customer-logout-btn" onClick={handleCustomerLogout} type="button">Salir</button>
            </div>
          ) : (
            <button
              className="customer-login-btn desktop-only"
              onClick={() => { setLoginOpen(true); setLoginError(""); setLoginData({ username: "", password: "" }); }}
              type="button"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              Iniciar sesión
            </button>
          )}

          <button className={`cart-button${cartButtonPop ? " pop" : ""}`} onClick={() => setCartOpen(true)} type="button">
            🛒 <span>{cartCount > 0 ? cartCount : ""}</span>
          </button>

          {/* Hamburger — solo mobile */}
          <button
            className="mobile-nav-toggle"
            onClick={() => setMobileNavOpen(true)}
            type="button"
            aria-label="Abrir menú"
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* ── Mobile nav overlay ──────────────────────────────────────────────── */}
      {mobileNavOpen && (
        <div className="mobile-nav-overlay" onClick={() => setMobileNavOpen(false)}>
          <nav className="mobile-nav-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-nav-header">
              <BrandLogo compact />
              <button className="mobile-nav-close" onClick={() => setMobileNavOpen(false)} type="button" aria-label="Cerrar menú">✕</button>
            </div>
            <div className="mobile-nav-links">
              {[["inicio","🏠  Inicio"],["catalogo","🛋️  Catálogo"],["sobre-nosotros","📖  Sobre nosotros"],["contacto","💬  Contacto"]].map(([v, l]) => (
                <button
                  key={v}
                  className={`mobile-nav-link${activeView === v ? " active" : ""}`}
                  onClick={() => { navigateTo(v); setMobileNavOpen(false); }}
                  type="button"
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="mobile-nav-footer">
              {!session.isAdmin && !catalogCustomer ? (
                <button
                  className="mobile-nav-login-btn"
                  onClick={() => { setLoginOpen(true); setLoginError(""); setLoginData({ username: "", password: "" }); setMobileNavOpen(false); }}
                  type="button"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  Iniciar sesión
                </button>
              ) : catalogCustomer ? (
                <div className="mobile-nav-user">
                  <span>Hola, {catalogCustomer.nombre}</span>
                  <button onClick={() => { handleCustomerLogout(); setMobileNavOpen(false); }} type="button">Cerrar sesión</button>
                </div>
              ) : session.isAdmin ? (
                <div className="mobile-nav-user mobile-nav-user--admin">
                  <span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5, verticalAlign: "middle" }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    {session.username?.split("@")[0] || "Admin"}
                  </span>
                  <button onClick={() => { setMobileNavOpen(false); handleLogout(); }} type="button">Cerrar sesión</button>
                </div>
              ) : null}
              <a
                className="mobile-nav-wsp"
                href={buildContactLink("Hola, quiero hacer una consulta.", "Consulta Manarey")}
                target="_blank"
                rel="noreferrer"
              >
                💬 Escribir por WhatsApp
              </a>
            </div>
          </nav>
        </div>
      )}

      <section className="service-ribbon">
        <button
          className="service-pill service-pill-branches"
          type="button"
          onClick={() => {
            navigateTo("inicio");
            setTimeout(() => document.getElementById("home-branches")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
          }}
        >
          <strong>🏠 {storeBranches.length} sucursales</strong>
          <span>Retiro en local o envio a domicilio</span>
        </button>
        <div className="service-pill service-pill-desktop">
          <strong>💳 Tarjeta, transferencia y QR</strong>
          <span>Paga como prefieras</span>
        </div>
        <div className="service-pill service-pill-desktop">
          <strong>💬 WhatsApp</strong>
          <span>Atencion y cierre de venta personalizado</span>
        </div>
      </section>

      <div className="view-stack">
        {catalogError ? (
          <section className="warning-banner">
            No se pudo conectar con la base de datos en este momento. La web sigue funcionando, pero
            los productos no estan cargados.
          </section>
        ) : null}

        {activeView === "inicio" ? (
          <>
            {/* ── Hero ────────────────────────────────────────────────────── */}
            <section className="hero-home">
              <div className="hero-home-copy">
                <p className="eyebrow">Empresa familiar desde 2017</p>
                <h1>Tu hogar merece lo mejor.</h1>
                <p className="hero-subtitle">Muebles y artículos del hogar con entrega a domicilio o retiro en nuestros {storeBranches.length} locales del sur del GBA.</p>
                <div className="hero-home-actions">
                  <button className="hero-buy-button" onClick={() => navigateTo("catalogo")} type="button">
                    Ver catálogo
                  </button>
                  <button className="ghost-button" onClick={() => navigateTo("contacto")} type="button">
                    Contactanos
                  </button>
                </div>

                {/* Métricas dinámicas */}
                <div className="hero-metrics">
                  <div className="metric-card">
                    <strong>{inStockCount > 0 ? `+${inStockCount}` : visibleProducts.length}</strong>
                    <span>productos disponibles</span>
                  </div>
                  <div className="metric-card">
                    <strong>{storeBranches.length}</strong>
                    <span>sucursales</span>
                  </div>
                  <div className="metric-card">
                    <strong>+8 años</strong>
                    <span>de trayectoria</span>
                  </div>
                </div>
              </div>

              <div className="hero-home-brand">
                <div className="brand-panel editorial">
                  {featuredMainProduct?.imageData && !isVideoSrc(featuredMainProduct.imageData) ? (
                    <img alt={featuredMainProduct.nombre} className="product-image" loading="lazy" src={featuredMainProduct.imageData} />
                  ) : (
                    <ProductPlaceholder title="Seleccion destacada" />
                  )}
                  <div className="brand-panel-overlay">
                    <p className="eyebrow">Producto destacado</p>
                    <h2>{featuredMainProduct?.nombre || "Colección Manarey"}</h2>
                    {featuredMainProduct && (
                      <>
                        <p style={{ fontSize: "1.3rem", fontWeight: 800 }}>{currencyFormatter.format(featuredMainProduct.precioVenta)}</p>
                        <div className="showcase-overlay-actions" style={{ marginTop: 12 }}>
                          <button className="primary-button" onClick={() => openProductDetail(featuredMainProduct)} type="button">
                            Ver producto
                          </button>
                          <button className="ghost-button" onClick={() => addToCart(featuredMainProduct)} type="button">
                            Al carrito
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>


            {/* ── Destacados ──────────────────────────────────────────────── */}
            {!catalogError && (
              <section className="showcase-section reveal-block" data-reveal>
                <div className="showcase-heading">
                  <div>
                    <p className="eyebrow">Productos destacados</p>
                    <h2>{homeCategory || "Selección Manarey"}</h2>
                  </div>
                  <div className="showcase-top">
                    {homeCategory && (
                      <button
                        className="showcase-tab active"
                        onClick={() => setHomeCategory("")}
                        type="button"
                      >
                        ✕ Limpiar filtro
                      </button>
                    )}
                    {categories.filter((c) => c !== "todas").slice(0, 9).map((item) => (
                      <button
                        key={item}
                        className={homeCategory === item ? "showcase-tab active" : "showcase-tab"}
                        onClick={() => setHomeCategory(homeCategory === item ? "" : item)}
                        type="button"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="showcase-grid">
                  <article className="showcase-main-card">
                    <div className="showcase-main-visual">
                      {featuredMainProduct?.imageData && !isVideoSrc(featuredMainProduct.imageData) ? (
                        <img alt={featuredMainProduct.nombre} className="product-image" src={featuredMainProduct.imageData} />
                      ) : (
                        <ProductPlaceholder title={homeCategory || "Destacado"} />
                      )}
                      <div className="showcase-overlay">
                        <h3>{featuredMainProduct ? getDisplayName(featuredMainProduct.productKey, featuredMainProduct.nombre) : "Destacado"}</h3>
                        {featuredMainProduct && (
                          <p style={{ fontWeight: 700, fontSize: "1.2rem" }}>{currencyFormatter.format(featuredMainProduct.precioVenta)}</p>
                        )}
                        <div className="showcase-overlay-actions">
                          {featuredMainProduct && (
                            <button className="primary-button" onClick={() => openProductDetail(featuredMainProduct)} type="button">
                              Ver producto
                            </button>
                          )}
                          <button className="ghost-button" onClick={() => { setCategory(homeCategory || "todas"); navigateTo("catalogo"); }} type="button">
                            Ver todos
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>

                  <div className="showcase-side-grid">
                    {featuredSideProducts.map((product) => (
                      <button className="showcase-mini-card" key={product.productKey} onClick={() => openProductDetail(product)} type="button">
                        <div className="showcase-mini-visual">
                          {product.imageData && !isVideoSrc(product.imageData) ? (
                            <img alt={product.nombre} className="product-image" loading="lazy" src={product.imageData} />
                          ) : (
                            <ProductPlaceholder compact title={product.nombre} />
                          )}
                        </div>
                        <div className="showcase-mini-copy">
                          <h4>{getDisplayName(product.productKey, product.nombre)}</h4>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <p style={{ fontWeight: 700, color: "var(--gold-strong)" }}>{currencyFormatter.format(product.precioVenta)}</p>
                            {!product.isSoldOut && <span style={{ fontSize: "0.72rem", color: "#16a34a", fontWeight: 600 }}>En stock</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ── Categorías ──────────────────────────────────────────────── */}
            {heroCategories.length > 0 && (
              <section className="home-invite reveal-block" data-reveal>
                <div className="invite-copy">
                  <p className="eyebrow">Categorías</p>
                  <h2>¿Qué estás buscando?</h2>
                </div>
                <div className="category-highlight-grid">
                  {heroCategories.map((item) => (
                    <button
                      key={item}
                      className="category-highlight-card"
                      onClick={() => { setHomeCategory(item); setCategory(item); navigateTo("catalogo"); }}
                      type="button"
                    >
                      <span className="cat-card-name">{item}</span>
                      <strong className="cat-card-cta">Ver productos →</strong>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ── Sucursales ──────────────────────────────────────────────── */}
            <section className="home-branches reveal-block" id="home-branches" data-reveal>
              <div className="home-branches-header">
                <div>
                  <p className="eyebrow">Nuestras sucursales</p>
                  <h2>Vení a conocer los showrooms.</h2>
                  <p className="home-branches-sub">Zona sur del Gran Buenos Aires. También hacemos envíos.</p>
                </div>
                <button className="ghost-button" onClick={() => navigateTo("sobre-nosotros")} type="button">
                  Ver todas →
                </button>
              </div>
              <div className="home-branches-grid">
                {storeBranches.map((branch) => (
                  <div className="home-branch-card" key={branch.id}>
                    <span className="home-branch-icon">📍</span>
                    <div>
                      <strong>{branch.name}</strong>
                      <p>{branch.address}</p>
                      <a className="branch-directions-btn" href={branch.mapsUrl} target="_blank" rel="noreferrer noopener">
                        🗺️ Cómo llegar
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {activeView === "catalogo" ? (
          <>
            <button className="back-btn" onClick={() => navigateTo("inicio")} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Inicio
            </button>
            <section className="catalog-hero">
              <p className="eyebrow">Catalogo</p>
              <h2>Todos nuestros productos</h2>
            </section>

            {!catalogError ? (
              <>
                <section className="catalog-tools">
                  <div className="catalog-toolbar">
                    <div className="search-wrapper">
                      <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      <input
                        className="search-input"
                        placeholder="Buscar producto, categoría, medida..."
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                      {query && (
                        <button className="search-clear" onClick={() => setQuery("")} type="button">✕</button>
                      )}
                    </div>
                    <select
                      className="sort-select"
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                    >
                      <option value="relevancia">Destacados primero</option>
                      <option value="precio-asc">Precio: menor a mayor</option>
                      <option value="precio-desc">Precio: mayor a menor</option>
                      <option value="nombre">Nombre A–Z</option>
                    </select>
                  </div>

                  <div className="category-rail">
                    {categories.map((item) => (
                      <button
                        key={item}
                        className={category === item ? "category-pill active" : "category-pill"}
                        onClick={() => setCategory(item)}
                        type="button"
                      >
                        {item === "todas" ? "Todas" : item}
                      </button>
                    ))}
                  </div>

                  <div className="catalog-summary">
                    <span><strong>{filteredGroups.length}</strong> productos</span>
                    <span><strong>{inStockCount}</strong> disponibles</span>
                    {query && <span className="catalog-summary-filter">Buscando: "{query}"</span>}
                  </div>
                </section>

                {session.isAdmin ? (
                  <div className="admin-filter-bar">
                    <div className="admin-filter-group">
                      <button
                        className="admin-filter-pill"
                        type="button"
                        onClick={async () => {
                          setShippingFormMsg("");
                          try {
                            const res = await fetch("/api/admin/settings");
                            const data = await res.json();
                            setShippingForm({
                              baseCost: String(data.shippingBaseCost ?? ""),
                              perKm: String(data.shippingCostPerKm ?? ""),
                            });
                          } catch {
                            setShippingForm({ baseCost: "", perKm: "" });
                          }
                          setShippingSettingsOpen(true);
                        }}
                      >
                        ⚙️ Precios de envío
                      </button>
                      <button
                        className="admin-filter-pill"
                        type="button"
                        onClick={async () => {
                          const res = await fetch("/api/admin/featured");
                          const data = await res.json();
                          setFeaturedList(data.featured || []);
                          setFeaturedOpen(true);
                        }}
                      >
                        ⭐ Gestionar destacados
                      </button>
                      <button
                        className="admin-filter-pill"
                        type="button"
                        disabled={migratingImages}
                        onClick={async () => {
                          if (!confirm("¿Migrar imágenes de la BD a Vercel Blob? Solo es necesario hacerlo una vez.")) return;
                          setMigratingImages(true);
                          setMigrateResult(null);
                          try {
                            const res = await fetch("/api/admin/migrate-images", { method: "POST" });
                            const data = await res.json();
                            setMigrateResult(data);
                          } catch {
                            setMigrateResult({ error: "Error de red" });
                          } finally {
                            setMigratingImages(false);
                          }
                        }}
                      >
                        {migratingImages ? "Migrando..." : "🖼️ Migrar fotos a Blob"}
                      </button>
                      {migrateResult && (
                        <span style={{ fontSize: "0.8rem", color: migrateResult.error ? "var(--error, red)" : "var(--gold-strong)" }}>
                          {migrateResult.error
                            ? `Error: ${migrateResult.error}`
                            : `✓ ${migrateResult.migrated} de ${migrateResult.total} fotos migradas`}
                        </span>
                      )}
                    </div>
                    <div className="admin-filter-group">
                      <span className="admin-filter-label">Foto:</span>
                      {["todos", "sin-foto", "con-foto"].map((f) => (
                        <button
                          key={f}
                          className={`admin-filter-pill${adminPhotoFilter === f ? " active" : ""}`}
                          onClick={() => setAdminPhotoFilter(f)}
                          type="button"
                        >
                          {f === "todos" ? "Todos" : f === "sin-foto" ? "Sin foto" : "Con foto"}
                        </button>
                      ))}
                    </div>
                    <div className="admin-filter-group">
                      <span className="admin-filter-label">Sucursal:</span>
                      <button
                        className={`admin-filter-pill${adminBranchFilter === "" ? " active" : ""}`}
                        onClick={() => setAdminBranchFilter("")}
                        type="button"
                      >
                        Todas
                      </button>
                      {storeBranches.map((b) => (
                        <button
                          key={b.name}
                          className={`admin-filter-pill${adminBranchFilter === b.name ? " active" : ""}`}
                          onClick={() => setAdminBranchFilter(b.name)}
                          type="button"
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Banner de stock por sucursal */}
                {session.isAdmin && adminBranchFilter && Object.keys(branchStockCache).length > 0 ? (() => {
                  const conStock = filteredGroups.filter((g) =>
                    (branchStockCache[g.variants[0]?.productKey]?.find((b) => b.local === adminBranchFilter)?.stock ?? 0) > 0
                  ).length;
                  const totalUnidades = filteredGroups.reduce((acc, g) =>
                    acc + (branchStockCache[g.variants[0]?.productKey]?.find((b) => b.local === adminBranchFilter)?.stock ?? 0), 0
                  );
                  return (
                    <div className="branch-stock-banner">
                      <span className="branch-stock-banner-local">📦 {adminBranchFilter}</span>
                      <span className="branch-stock-banner-stat"><strong>{conStock}</strong> productos con stock</span>
                      <span className="branch-stock-banner-stat"><strong>{totalUnidades}</strong> unidades en total</span>
                    </div>
                  );
                })() : null}

                <section className="catalog-grid">
                  {filteredGroups.length === 0 ? (
                    <article className="empty-state">
                      <p className="eyebrow">Sin resultados</p>
                      <h3>No encontramos productos con ese filtro.</h3>
                      <p>Prueba otra categoria o un termino mas general.</p>
                    </article>
                  ) : null}

                  {pagedGroups.map((group) => {
                    const product = getActiveVariant(group.key, group.variants);
                    const measureMeta = getMeasureMeta(product.medida);
                    const editing = activeEditor?.productKey === product.productKey;
                    const shortDescription = (product.description || "").trim().slice(0, 110);
                    const hasVariants = group.variants.length > 1 && group.variants.some((v) => v.color);
                    const branchStock = adminBranchFilter ? branchStockCache[product.productKey] : null;
                    const initial = (product.nombre || "M").charAt(0).toUpperCase();

                    return (
                      <article className={`product-card${product.isSoldOut ? " sold-out-card" : ""}`} key={group.key}>
                        {/* Imagen */}
                        <button
                          className="image-frame image-frame-btn"
                          onClick={() => openProductDetail(product)}
                          type="button"
                          aria-label={`Ver detalle de ${product.nombre}`}
                        >
                          {product.imageData && !isVideoSrc(product.imageData) ? (
                            <img alt={product.nombre} className="product-image" loading="lazy" src={product.imageData} />
                          ) : (
                            <div className="image-placeholder card-no-image">
                              <span className="card-initial">{initial}</span>
                            </div>
                          )}

                          {/* Badges sobre la imagen */}
                          <div className="card-image-badges">
                            {product.isFeatured && !product.isSoldOut && (
                              <span className="card-badge card-badge-featured">⭐ Destacado</span>
                            )}
                            {product.isSoldOut && (
                              <span className="card-badge card-badge-soldout">Sin stock</span>
                            )}
                            {session.isAdmin && !product.imageData && (
                              <span className="card-badge card-badge-admin">Sin foto</span>
                            )}
                          </div>
                        </button>

                        {/* Variantes de color */}
                        {hasVariants && (
                          <div className="color-swatches">
                            {group.variants.map((v) => (
                              <button
                                key={v.productKey}
                                className={`color-swatch${product.productKey === v.productKey ? " active" : ""}`}
                                title={v.color || ""}
                                onClick={() => setSelectedVariants((prev) => ({ ...prev, [group.key]: v.productKey }))}
                                type="button"
                              >
                                <span className="color-swatch-dot" />
                                <span className="color-swatch-label">{v.color}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="product-copy">
                          {/* Categoría + nombre */}
                          <div>
                            {product.categoria && (
                              <p className="product-category">{product.categoria}</p>
                            )}
                            <h2 className="product-name" onClick={() => openProductDetail(product)} style={{ cursor: "pointer" }}>
                              {getDisplayName(product.productKey, product.nombre)}
                            </h2>
                          </div>

                          {/* Medida — solo visible para admin */}
                          {session.isAdmin && measureMeta && (
                            <p className="meta-line" style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                              <strong>{measureMeta.label} (DB):</strong> {measureMeta.value}
                            </p>
                          )}

                          {/* Descripción corta */}
                          {shortDescription && (
                            <p className="product-desc-preview">{shortDescription}{product.description.length > 110 ? "…" : ""}</p>
                          )}

                          {/* Precio */}
                          {isSillaPack(product) ? (
                            <div className="pack-notice pack-notice--card">
                              <span className="pack-badge">Pack x6</span>
                              <p className="price-tag" style={{ margin: 0 }}>{currencyFormatter.format(product.precioVenta * 6)}</p>
                            </div>
                          ) : (
                            <>
                              <p className="price-tag">{currencyFormatter.format(product.precioVenta)}</p>
                              {isSilla(product) && (
                                <div className="pack-notice">
                                  <span className="pack-badge">Pack x6</span>
                                  <span className="pack-total">{currencyFormatter.format(product.precioVenta * 6)}</span>
                                </div>
                              )}
                            </>
                          )}

                          {/* Stock por sucursal (admin) */}
                          {session.isAdmin && adminBranchFilter && (
                            <div className="branch-stock-row">
                              <span className="branch-stock-label">{adminBranchFilter}:</span>
                              {branchStockCache[product.productKey] ? (
                                <>
                                  <button className="stock-btn" disabled={stockUpdating[`${product.productKey}::${adminBranchFilter}`]} onClick={() => updateBranchStock(product.productKey, adminBranchFilter, -1)} type="button">−</button>
                                  <span className="branch-stock-count">
                                    {branchStockCache[product.productKey].find((b) => b.local === adminBranchFilter)?.stock ?? 0}
                                  </span>
                                  <button className="stock-btn" disabled={stockUpdating[`${product.productKey}::${adminBranchFilter}`]} onClick={() => updateBranchStock(product.productKey, adminBranchFilter, 1)} type="button">+</button>
                                </>
                              ) : (
                                <span className="branch-stock-loading">···</span>
                              )}
                            </div>
                          )}

                          {/* Acciones */}
                          <div className="card-actions">
                            <button className="ghost-button" onClick={() => openProductDetail(product)} type="button">
                              Ver detalle
                            </button>
                            {product.isSoldOut ? (
                              <a className="primary-button" href={buildWhatsAppLink(product)} target="_blank" rel="noreferrer">
                                💬 Consultar
                              </a>
                            ) : (
                              <button className="primary-button" onClick={() => addToCart(product, { quantity: isSillaPack(product) ? 6 : 1 })} type="button">
                                Agregar al carrito
                              </button>
                            )}
                          </div>

                          {session.isAdmin ? (
                            <div className="admin-panel">
                              <button className="secondary-button" onClick={() => openEditor(product)} type="button">
                                ✏️ Editar
                              </button>
                              <button
                                className={`admin-featured-btn${product.isFeatured ? " active" : ""}`}
                                title={product.isFeatured ? "Quitar de destacados" : "Marcar como destacado"}
                                type="button"
                                onClick={async () => {
                                  const newVal = !product.isFeatured;
                                  await fetch("/api/admin/featured", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ productKey: product.productKey, isFeatured: newVal }),
                                  });
                                  setProducts((prev) =>
                                    prev.map((p) =>
                                      p.productKey === product.productKey
                                        ? { ...p, isFeatured: newVal, featuredOrder: newVal ? 999 : null }
                                        : p,
                                    ),
                                  );
                                }}
                              >
                                {product.isFeatured ? "⭐ Destacado" : "☆ Destacar"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </section>

                {totalPages > 1 && (
                  <nav className="catalog-pagination" aria-label="Paginado del catálogo">
                    <button
                      className="catalog-page-btn catalog-page-prev"
                      onClick={() => { setCatalogPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      disabled={catalogPage === 1}
                      type="button"
                      aria-label="Página anterior"
                    >
                      ‹
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((n) => n === 1 || n === totalPages || Math.abs(n - catalogPage) <= 1)
                      .reduce((acc, n, idx, arr) => {
                        if (idx > 0 && n - arr[idx - 1] > 1) acc.push("...");
                        acc.push(n);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === "..." ? (
                          <span key={`ellipsis-${idx}`} className="catalog-page-ellipsis">…</span>
                        ) : (
                          <button
                            key={item}
                            className={`catalog-page-btn${item === catalogPage ? " active" : ""}`}
                            onClick={() => { setCatalogPage(item); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                            type="button"
                            aria-current={item === catalogPage ? "page" : undefined}
                          >
                            {item}
                          </button>
                        )
                      )}

                    <button
                      className="catalog-page-btn catalog-page-next"
                      onClick={() => { setCatalogPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      disabled={catalogPage === totalPages}
                      type="button"
                      aria-label="Página siguiente"
                    >
                      ›
                    </button>
                  </nav>
                )}
              </>
            ) : null}
          </>
        ) : null}

        {activeView === "sobre-nosotros" ? (
          <>
            <button className="back-btn" onClick={() => navigateTo("inicio")} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Inicio
            </button>
            <section className="content-hero">
              <p className="eyebrow">Nuestra historia</p>
              <h2>Una empresa familiar con mas de 8 años de trayectoria.</h2>
            </section>

            <section className="about-story">
              <article className="about-story-text">
                <p>
                  Manarey nacio en 2017 como una empresa familiar con un solo objetivo: ofrecer muebles
                  y articulos del hogar de calidad al alcance de todos. Abrimos nuestra primera muebleria
                  en <strong>Miguel Cane 508</strong>, una direccion que sigue siendo parte de nosotros hasta el dia de hoy.
                </p>
                <p>
                  Con mucho esfuerzo y dedicacion, fuimos creciendo año a año. Hoy somos{" "}
                  <strong>5 mublerias</strong> distribuidas en la zona sur del Gran Buenos Aires,
                  y nuestra sucursal central se encuentra en{" "}
                  <strong>Av. Hipolito Yrigoyen 19.051, Longchamps</strong>.
                </p>
                <p>
                  Cada local es atendido por personas comprometidas con dar la mejor atencion,
                  porque seguimos siendo lo que siempre fuimos: una familia que ama lo que hace.
                </p>
                <div className="about-social-links">
                  <a
                    className="about-social-btn about-social-ig"
                    href={storeSettings.instagramUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    @manareymuebleria
                  </a>
                  <a
                    className="about-social-btn about-social-fb"
                    href={storeSettings.facebookUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Manarey Glew
                  </a>
                </div>
              </article>

              <aside className="about-story-branches">
                <p className="eyebrow">Nuestras sucursales</p>
                {storeBranches.map((branch) => (
                  <div className="about-branch-row" key={branch.id}>
                    <span className="about-branch-dot" />
                    <div>
                      <strong>{branch.name}</strong>
                      <p>{branch.address}</p>
                      <a className="branch-directions-btn" href={branch.mapsUrl} target="_blank" rel="noreferrer noopener">
                        🗺️ Cómo llegar
                      </a>
                    </div>
                  </div>
                ))}
              </aside>
            </section>
          </>
        ) : null}

        {activeView === "contacto" ? (
          <>
            <button className="back-btn" onClick={() => navigateTo("inicio")} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Inicio
            </button>
            {/* Hero */}
            <section className="contact-hero">
              <div className="contact-hero-text">
                <p className="eyebrow">Contacto</p>
                <h2>Hablemos.</h2>
                <p>Consultanos por precio, disponibilidad, medidas o lo que necesites. Respondemos rápido.</p>
              </div>
              {whatsappNumber && (
                <a
                  className="contact-hero-wsp"
                  href={buildContactLink("Hola, quiero hacer una consulta sobre un producto de Manarey.", "Consulta Manarey")}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Escribir por WhatsApp
                </a>
              )}
            </section>

            {/* Canales de contacto */}
            <section className="contact-channels">
              {whatsappNumber && (
                <a
                  className="contact-channel contact-channel-wsp"
                  href={buildContactLink("Hola, quiero hacer una consulta sobre Manarey.", "Consulta Manarey")}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <div className="contact-channel-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <div className="contact-channel-body">
                    <strong>WhatsApp</strong>
                    <span>+54 9 11 6428-2270</span>
                    <em>Respuesta inmediata · Ventas y consultas</em>
                  </div>
                  <span className="contact-channel-arrow">›</span>
                </a>
              )}

              <a
                className="contact-channel contact-channel-ig"
                href={storeSettings.instagramUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                <div className="contact-channel-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
                <div className="contact-channel-body">
                  <strong>Instagram</strong>
                  <span>@manareymuebleria</span>
                  <em>Productos, novedades y promociones</em>
                </div>
                <span className="contact-channel-arrow">›</span>
              </a>

              <a
                className="contact-channel contact-channel-fb"
                href={storeSettings.facebookUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                <div className="contact-channel-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                <div className="contact-channel-body">
                  <strong>Facebook</strong>
                  <span>Manarey Glew</span>
                  <em>Seguinos y mandanos un mensaje</em>
                </div>
                <span className="contact-channel-arrow">›</span>
              </a>

              <a
                className="contact-channel contact-channel-mail"
                href={`mailto:${contactEmail}`}
              >
                <div className="contact-channel-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="26" height="26">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </div>
                <div className="contact-channel-body">
                  <strong>Correo electrónico</strong>
                  <span>{contactEmail}</span>
                  <em>Presupuestos y pedidos especiales</em>
                </div>
                <span className="contact-channel-arrow">›</span>
              </a>
            </section>

            {/* Sucursales */}
            <section className="contact-branches">
              <p className="eyebrow">Dónde encontrarnos</p>
              <h3>Nuestras sucursales</h3>
              <div className="contact-branches-grid">
                {storeBranches.map((branch) => (
                  <div className="contact-branch-card" key={branch.id}>
                    <span className="contact-branch-icon">📍</span>
                    <div>
                      <strong>{branch.name === "Longchamps" ? "Central — Longchamps" : branch.name}</strong>
                      <p>{branch.address}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>

      <section className="help-strip">
        <h2>Necesitas ayuda para elegir?</h2>
        <div className="help-grid">
          <article className="help-card">
            <h3>{whatsappNumber ? "WhatsApp" : "Correo"}</h3>
            <p>Atencion rapida para ventas y consultas.</p>
            <a
              className="contact-link"
              href={buildContactLink(
                "Hola, necesito ayuda para elegir un producto de Manarey.",
                "Ayuda para elegir producto",
              )}
              target="_blank"
              rel="noreferrer"
            >
              {whatsappNumber ? "Escribir ahora" : "Escribir por correo"}
            </a>
          </article>
          <article className="help-card">
            <h3>Consulta personalizada</h3>
            <p>Te ayudamos a encontrar el producto ideal segun tu espacio.</p>
            <button className="ghost-button" onClick={() => navigateTo("contacto")} type="button">
              Ir a contacto
            </button>
          </article>
          <article className="help-card">
            <h3>Correo</h3>
            <p>Envianos tu consulta y te respondemos.</p>
            <a className="contact-link" href="mailto:leandromanavella2016@gmail.com">
              Enviar correo
            </a>
          </article>
        </div>
      </section>

      {selectedProduct ? (
        <div className="modal-backdrop" onClick={() => setSelectedProductKey("")}>
          <div className="detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="detail-modal-header">
              <span className="detail-modal-handle" aria-hidden="true" />
              <button
                className="detail-modal-close"
                onClick={() => setSelectedProductKey("")}
                type="button"
                aria-label="Cerrar"
              >✕</button>
            </div>
            <div className="detail-grid">
              <div className="detail-media">
                {(() => {
                  const photos = selectedProduct.imagesData && selectedProduct.imagesData.length > 0
                    ? selectedProduct.imagesData
                    : selectedProduct.imageData
                      ? [selectedProduct.imageData]
                      : [];
                  const totalPhotos = photos.length;
                  const safeIndex = totalPhotos > 0 ? Math.min(detailPhotoIndex, totalPhotos - 1) : 0;
                  const currentPhoto = photos[safeIndex] || null;

                  if (totalPhotos === 0) {
                    return (
                      <div className="image-placeholder detail-placeholder">
                        <BrandLogo />
                      </div>
                    );
                  }

                  const isVideo = isVideoSrc;

                  return (
                    <div className="detail-carousel">
                      <div
                        className="detail-carousel-track"
                        onTouchStart={(e) => {
                          carouselTouchStartX.current = e.touches[0].clientX;
                        }}
                        onTouchEnd={(e) => {
                          const startX = carouselTouchStartX.current;
                          if (startX === null) return;
                          const dx = e.changedTouches[0].clientX - startX;
                          carouselTouchStartX.current = null;
                          if (dx < -40 && safeIndex < totalPhotos - 1) setDetailPhotoIndex(safeIndex + 1);
                          else if (dx > 40 && safeIndex > 0) setDetailPhotoIndex(safeIndex - 1);
                        }}
                      >
                        {isVideo(currentPhoto) ? (
                          <video
                            className="product-image detail-carousel-img"
                            controls
                            key={safeIndex}
                            src={currentPhoto}
                            style={{ objectFit: "contain" }}
                          />
                        ) : (
                          <img
                            alt={`${selectedProduct.nombre} foto ${safeIndex + 1}`}
                            className="product-image detail-carousel-img"
                            key={safeIndex}
                            loading="lazy"
                            src={currentPhoto}
                          />
                        )}
                      </div>

                      {totalPhotos > 1 && (
                        <>
                          <button
                            aria-label="Foto anterior"
                            className="detail-carousel-arrow detail-carousel-prev"
                            disabled={safeIndex === 0}
                            onClick={() => setDetailPhotoIndex(safeIndex - 1)}
                            type="button"
                          >
                            &#8249;
                          </button>
                          <button
                            aria-label="Foto siguiente"
                            className="detail-carousel-arrow detail-carousel-next"
                            disabled={safeIndex === totalPhotos - 1}
                            onClick={() => setDetailPhotoIndex(safeIndex + 1)}
                            type="button"
                          >
                            &#8250;
                          </button>
                          <div className="detail-carousel-dots">
                            {photos.map((_, i) => (
                              <button
                                aria-label={`Ir a foto ${i + 1}`}
                                className={`detail-carousel-dot${i === safeIndex ? " active" : ""}`}
                                key={i}
                                onClick={() => setDetailPhotoIndex(i)}
                                type="button"
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="detail-copy">
                <p className="eyebrow">{selectedProduct.categoria || "Producto"}</p>
                <h2>{getDisplayName(selectedProduct.productKey, selectedProduct.nombre)}</h2>
                <div className="detail-topline">
                  <p className="detail-price">
                    {isSillaPack(selectedProduct)
                      ? currencyFormatter.format(selectedProduct.precioVenta * 6)
                      : currencyFormatter.format(detailTotal)}
                  </p>
                  <span className={selectedProduct.isSoldOut ? "stock-pill sold-out" : "stock-pill in-stock"}>
                    {selectedProduct.isSoldOut ? "Sin stock" : "Listo para consultar"}
                  </span>
                </div>
                {isSillaPack(selectedProduct) && (
                  <div className="pack-notice pack-notice--detail">
                    <span className="pack-badge">Venta por pack de 6 · precio unitario {currencyFormatter.format(selectedProduct.precioVenta)}</span>
                  </div>
                )}
                {isSilla(selectedProduct) && !isSillaPack(selectedProduct) && (
                  <div className="pack-notice pack-notice--detail">
                    <span className="pack-badge">Pack x6: {currencyFormatter.format(selectedProduct.precioVenta * 6)}</span>
                  </div>
                )}

                {selectedProduct.description ? (
                  <p className="description">{selectedProduct.description}</p>
                ) : session.isAdmin ? (
                  <p className="description">Este producto todavia no tiene una descripcion cargada.</p>
                ) : null}

                <div className="detail-specs">
                  {session.isAdmin && getMeasureMeta(selectedProduct.medida) ? (
                    <p className="meta-line" style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                      <strong>{getMeasureMeta(selectedProduct.medida).label} (DB):</strong>{" "}
                      {getMeasureMeta(selectedProduct.medida).value}
                    </p>
                  ) : null}
                  {selectedProduct.color ? (
                    <p className="meta-line">
                      <strong>Color:</strong> {selectedProduct.color}
                    </p>
                  ) : null}
                  {selectedProduct.altoCm || selectedProduct.anchoCm || selectedProduct.profundidadCm ? (
                    <p className="meta-line">
                      <strong>Alto / Ancho / Prof.:</strong>{" "}
                      {[selectedProduct.altoCm, selectedProduct.anchoCm, selectedProduct.profundidadCm]
                        .filter((v) => v != null)
                        .join(" x ")}{" "}
                      cm
                    </p>
                  ) : null}
                  {selectedProduct.largoCm != null ? (
                    <p className="meta-line"><strong>Largo:</strong> {selectedProduct.largoCm} cm</p>
                  ) : null}
                  {selectedProduct.litros != null ? (
                    <p className="meta-line"><strong>Litros:</strong> {selectedProduct.litros} L</p>
                  ) : null}
                  {selectedProduct.watts != null ? (
                    <p className="meta-line"><strong>Watts:</strong> {selectedProduct.watts} W</p>
                  ) : null}
                  {selectedProduct.pesoKg != null ? (
                    <p className="meta-line"><strong>Peso:</strong> {selectedProduct.pesoKg} kg</p>
                  ) : null}
                  {selectedProduct.voltaje ? (
                    <p className="meta-line"><strong>Voltaje:</strong> {selectedProduct.voltaje}</p>
                  ) : null}
                  {selectedProduct.material ? (
                    <p className="meta-line"><strong>Material:</strong> {selectedProduct.material}</p>
                  ) : null}
                  {selectedProduct.capacidad ? (
                    <p className="meta-line"><strong>Capacidad:</strong> {selectedProduct.capacidad}</p>
                  ) : null}
                </div>

                {(() => {
                  const group = filteredGroups.find((g) =>
                    g.variants.some((v) => v.productKey === selectedProduct.productKey),
                  );
                  const hasModalVariants = group && group.variants.length > 1 && group.variants.some((v) => v.color);
                  if (!hasModalVariants) return null;
                  return (
                    <div className="modal-color-swatches">
                      <p className="meta-line" style={{ marginBottom: 6 }}><strong>Color:</strong></p>
                      <div className="color-swatches">
                        {group.variants.map((v) => (
                          <button
                            key={v.productKey}
                            className={`color-swatch${selectedProduct.productKey === v.productKey ? " active" : ""}`}
                            title={v.color || ""}
                            onClick={() => setSelectedProductKey(v.productKey)}
                            type="button"
                          >
                            <span className="color-swatch-dot" />
                            <span className="color-swatch-label">{v.color}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {supportsAccessory(selectedProduct) && accessoryProduct ? (
                  <label className="accessory-box">
                    <input
                      checked={detailAccessorySelected}
                      onChange={(event) => setDetailAccessorySelected(event.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      Quieres agregar {accessoryProduct.nombre}?
                      <strong> + {currencyFormatter.format(accessoryProduct.precioVenta)}</strong>
                    </span>
                  </label>
                ) : null}

                <div className="detail-actions">
                  <a
                    className="ghost-button"
                    href={buildWhatsAppLink(selectedProduct, detailAccessorySelected)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {whatsappNumber ? "Consultar por WhatsApp" : "Consultar por correo"}
                  </a>
                  {!selectedProduct.isSoldOut ? (
                    <button
                      className="primary-button"
                      onClick={() => {
                        addToCart(selectedProduct, {
                          accessorySelected: detailAccessorySelected,
                          quantity: isSillaPack(selectedProduct) ? 6 : 1,
                        });
                        setSelectedProductKey("");
                      }}
                      type="button"
                    >
                      Agregar al carrito
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {relatedProducts.length ? (
              <div className="related-section">
                <p className="eyebrow">Productos relacionados</p>
                <div className="related-grid">
                  {relatedProducts.map((product) => (
                    <button
                      className="related-card"
                      key={product.productKey}
                      onClick={() => openProductDetail(product)}
                      type="button"
                    >
                      <div className="related-visual">
                        {product.imageData && !isVideoSrc(product.imageData) ? (
                          <img alt={product.nombre} className="product-image" loading="lazy" src={product.imageData} />
                        ) : (
                          <ProductPlaceholder compact title={product.nombre} />
                        )}
                      </div>
                      <div className="related-copy">
                        <p>{getDisplayName(product.productKey, product.nombre)}</p>
                        <strong>{currencyFormatter.format(product.precioVenta)}</strong>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Modal editor admin — full screen en mobile */}
      {adminEditorOpen && activeEditor ? (
        <div className="modal-backdrop">
          <div className="admin-editor-modal">
            <div className="admin-editor-header">
              <h3 className="admin-editor-title">
                ✏️ Editar producto
                {activeEditor && products.find(p => p.productKey === activeEditor.productKey)?.nombre
                  ? ` — ${products.find(p => p.productKey === activeEditor.productKey).nombre}`
                  : ""}
              </h3>
              <button
                className="admin-editor-close"
                onClick={() => { setAdminEditorOpen(false); setActiveEditor(null); setAdminEditorError(""); }}
                type="button"
                title="Cerrar sin guardar"
              >✕</button>
            </div>

            <div className="admin-editor-body">
              {/* Nombre en pantalla — alias solo frontend, no toca la BD — va primero */}
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">🏪 Nombre en pantalla</p>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 6 }}>
                  Lo que ven los clientes en la tienda. <strong>No cambia la base de datos.</strong> Dejá vacío para usar el nombre del sistema.
                </p>
                <input
                  className="editor-input"
                  type="text"
                  placeholder={activeEditor.nombreOriginal || activeEditor.nombre || "Nombre en pantalla…"}
                  value={displayNames[activeEditor.productKey] || ""}
                  onChange={(e) => setDisplayName(activeEditor.productKey, e.target.value)}
                  style={{ width: "100%" }}
                />
                {displayNames[activeEditor.productKey] && (
                  <div style={{
                    marginTop: 6,
                    padding: "6px 12px",
                    background: "rgba(69,103,79,0.1)",
                    border: "1px solid rgba(69,103,79,0.22)",
                    borderRadius: 6,
                    fontSize: "0.82rem",
                    color: "#45674f",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <span>✅ Activo: <strong>"{displayNames[activeEditor.productKey]}"</strong></span>
                    <button
                      type="button"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: "0.8rem" }}
                      onClick={() => setDisplayName(activeEditor.productKey, "")}
                    >Quitar</button>
                  </div>
                )}
              </div>

              {/* Nombre en la BD — campo peligroso, va después */}
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">🏷️ Nombre en el sistema (base de datos)</p>
                {activeEditor.medidaOriginal ? (
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 6 }}>
                    Medida en sistema (DB): <strong>{activeEditor.medidaOriginal}</strong>
                  </p>
                ) : null}
                <input
                  className="editor-input"
                  type="text"
                  value={activeEditor.nombre}
                  onChange={(e) => handleEditorChange(activeEditor.productKey, "nombre", e.target.value)}
                  style={{ width: "100%" }}
                />
                {(activeEditor.nombre || "").trim() !== (activeEditor.nombreOriginal || "").trim() && (
                  <div style={{
                    marginTop: 8,
                    padding: "8px 12px",
                    background: "#fff3cd",
                    border: "1px solid #ffc107",
                    borderRadius: 6,
                    fontSize: "0.82rem",
                    color: "#856404",
                  }}>
                    ⚠️ <strong>Atención:</strong> Este cambio se guardará directamente en la base de datos del sistema y afectará a todos los registros con este nombre. Se te pedirá confirmación al guardar.
                  </div>
                )}
              </div>

              {/* Fotos */}
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">📷 Fotos / Video del producto</p>
                {(activeEditor.imagesData || []).length > 0 && (
                  <div className="admin-images-grid">
                    {(activeEditor.imagesData || []).map((src, i) => (
                      <div key={i} className="admin-image-thumb">
                        {isVideoSrc(src) ? (
                          <video src={src} className="admin-editor-img" muted playsInline />
                        ) : (
                          <img src={src} alt={`Foto ${i + 1}`} className="admin-editor-img" />
                        )}
                        <div className="admin-image-thumb-actions">
                          {i > 0 && (
                            <button type="button" className="admin-img-move" onClick={() => handleMoveImage(activeEditor.productKey, i, -1)} title="Mover izquierda">◀</button>
                          )}
                          {i < (activeEditor.imagesData.length - 1) && (
                            <button type="button" className="admin-img-move" onClick={() => handleMoveImage(activeEditor.productKey, i, 1)} title="Mover derecha">▶</button>
                          )}
                          <button type="button" className="admin-img-remove" onClick={() => handleRemoveImage(activeEditor.productKey, i)} title="Quitar">✕</button>
                        </div>
                        {i === 0 && <span className="admin-img-main-badge">Principal</span>}
                      </div>
                    ))}
                  </div>
                )}
                <label className={`upload-button admin-upload-btn${adminUploadBusy ? " admin-upload-busy" : ""}`} style={{ marginTop: 8 }}>
                  {adminUploadBusy ? "⏳ Subiendo..." : "📷 Agregar fotos o video"}
                  <input accept="image/*,video/*" multiple hidden type="file" disabled={adminUploadBusy}
                    onChange={(event) => handleImageChange(event, activeEditor.productKey)} />
                </label>
                {adminUploadError && (
                  <p style={{ color: "var(--danger, #e53e3e)", fontSize: "0.8rem", marginTop: 4 }}>{adminUploadError}</p>
                )}
              </div>

              {/* Precio */}
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">💲 Precio de venta</p>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 6 }}>
                  Precio del sistema: <strong>{currencyFormatter.format(activeEditor.precioOriginal || 0)}</strong>.
                  Dejá en blanco para usar ese precio, o ingresá uno distinto.
                </p>
                <input
                  className="editor-input"
                  type="number"
                  min="0"
                  step="100"
                  placeholder={String(activeEditor.precioOriginal || "")}
                  value={activeEditor.precioVenta}
                  onChange={(e) => handleEditorChange(activeEditor.productKey, "precioVenta", e.target.value)}
                  style={{ maxWidth: 180 }}
                />
              </div>

              {/* Descripcion */}
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">📝 Descripcion</p>
                <textarea
                  className="editor-textarea admin-editor-textarea"
                  placeholder="Describe el producto: materiales, características, usos..."
                  value={activeEditor.description}
                  rows={5}
                  onChange={(e) => handleEditorChange(activeEditor.productKey, "description", e.target.value)}
                />
              </div>

              {/* Medidas */}
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">📐 Medidas</p>
                <div className="admin-editor-fields">
                  {[
                    ["altoCm",       "Alto (cm)"],
                    ["anchoCm",      "Ancho (cm)"],
                    ["profundidadCm","Profundidad (cm)"],
                    ["largoCm",      "Largo (cm)"],
                  ].map(([field, label]) => (
                    <label key={field} className="admin-field-label">
                      <span>{label}</span>
                      <input className="editor-input" type="number" placeholder="—"
                        value={activeEditor[field]}
                        onChange={(e) => handleEditorChange(activeEditor.productKey, field, e.target.value)} />
                    </label>
                  ))}
                </div>
              </div>

              {/* Especificaciones técnicas */}
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">⚡ Especificaciones técnicas</p>
                <div className="admin-editor-fields">
                  {[
                    ["litros",   "Litros"],
                    ["watts",    "Watts"],
                    ["pesoKg",   "Peso (kg)"],
                    ["voltaje",  "Voltaje"],
                    ["material", "Material"],
                    ["capacidad","Capacidad"],
                  ].map(([field, label]) => (
                    <label key={field} className="admin-field-label">
                      <span>{label}</span>
                      <input className="editor-input" placeholder="—"
                        value={activeEditor[field]}
                        onChange={(e) => handleEditorChange(activeEditor.productKey, field, e.target.value)} />
                    </label>
                  ))}
                </div>
              </div>

              {/* Stock por sucursal */}
              {branchStockCache[activeEditor.productKey] ? (
                <div className="admin-editor-section">
                  <p className="admin-editor-section-title">📦 Stock por sucursal</p>
                  <div className="editor-branch-stock">
                    {branchStockCache[activeEditor.productKey].map((b) => (
                      <div key={b.local} className="editor-branch-row">
                        <span className="editor-branch-name">{b.local}</span>
                        <button className="stock-btn" disabled={stockUpdating[`${activeEditor.productKey}::${b.local}`]}
                          onClick={() => updateBranchStock(activeEditor.productKey, b.local, -1)} type="button">−</button>
                        <span className="branch-stock-count">{b.stock}</span>
                        <button className="stock-btn" disabled={stockUpdating[`${activeEditor.productKey}::${b.local}`]}
                          onClick={() => updateBranchStock(activeEditor.productKey, b.local, 1)} type="button">+</button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="admin-editor-section">
                  <p className="admin-editor-section-title">📦 Stock por sucursal</p>
                  <button className="ghost-button" onClick={() => loadBranchStock(activeEditor.productKey)} type="button">
                    Cargar stock
                  </button>
                </div>
              )}
            </div>

            {adminEditorError ? (
              <div className="admin-editor-error">{adminEditorError}</div>
            ) : null}
            <div className="admin-editor-footer">
              <button className="primary-button" disabled={pending}
                onClick={() => handleSave(activeEditor.productKey)} type="button">
                {pending ? "Guardando..." : "Aplicar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal unificado: Iniciar sesión / Registrarse */}
      {loginOpen ? (
        <div className="modal-backdrop" onClick={() => setLoginOpen(false)}>
          <div className="cauth-modal" onClick={(event) => event.stopPropagation()}>
            <button className="cauth-close" onClick={() => setLoginOpen(false)} type="button" aria-label="Cerrar">✕</button>

            <p className="eyebrow" style={{ marginBottom: 4 }}>Manarey</p>
            <h3 className="cauth-title">
              {customerAuthMode === "login" ? "Ingresá a tu cuenta" : "Crear cuenta"}
            </h3>

            {/* Google */}
            <a href="/api/auth/google" className="cauth-google-btn">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M19.6 10.23c0-.68-.06-1.36-.17-2H10v3.79h5.39a4.61 4.61 0 01-2 3.03v2.52h3.24c1.9-1.75 3-4.32 3-7.34z" fill="#4285F4"/>
                <path d="M10 20c2.7 0 4.96-.9 6.62-2.43l-3.24-2.52c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H1.07v2.6A10 10 0 0010 20z" fill="#34A853"/>
                <path d="M4.41 11.89A6.01 6.01 0 014.1 10c0-.66.11-1.3.31-1.89V5.51H1.07A10 10 0 000 10c0 1.61.39 3.13 1.07 4.49l3.34-2.6z" fill="#FBBC05"/>
                <path d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87C14.95.99 12.69 0 10 0A10 10 0 001.07 5.51l3.34 2.6C5.2 5.72 7.4 3.96 10 3.96z" fill="#EA4335"/>
              </svg>
              Continuar con Google
            </a>

            <div className="cauth-divider"><span>o con email</span></div>

            {/* Tabs */}
            <div className="cauth-tabs">
              <button
                className={`cauth-tab${customerAuthMode === "login" ? " active" : ""}`}
                onClick={() => { setCustomerAuthMode("login"); setCustomerAuthError(""); setLoginError(""); }}
                type="button"
              >
                Iniciar sesión
              </button>
              <button
                className={`cauth-tab${customerAuthMode === "register" ? " active" : ""}`}
                onClick={() => { setCustomerAuthMode("register"); setCustomerAuthError(""); setLoginError(""); }}
                type="button"
              >
                Registrarse
              </button>
            </div>

            {/* Formulario según tab */}
            {customerAuthMode === "login" ? (
              <form className="cauth-form" onSubmit={handleLogin}>
                <input
                  className="cauth-input"
                  placeholder="Usuario o correo electrónico"
                  type="text"
                  autoComplete="username"
                  value={loginData.username}
                  onChange={(e) => setLoginData((d) => ({ ...d, username: e.target.value }))}
                  required
                />
                <input
                  className="cauth-input"
                  placeholder="Contraseña"
                  type="password"
                  autoComplete="current-password"
                  value={loginData.password}
                  onChange={(e) => setLoginData((d) => ({ ...d, password: e.target.value }))}
                  required
                />
                {loginError ? <p className="cauth-error">{loginError}</p> : null}
                <button className="cauth-submit" type="submit">
                  Ingresar
                </button>
              </form>
            ) : (
              <form className="cauth-form" onSubmit={handleCustomerAuth}>
                <div className="cauth-row">
                  <input
                    className="cauth-input"
                    placeholder="Nombre"
                    value={customerAuthData.nombre}
                    onChange={(e) => setCustomerAuthData((d) => ({ ...d, nombre: e.target.value }))}
                    required
                  />
                  <input
                    className="cauth-input"
                    placeholder="Apellido"
                    value={customerAuthData.apellido}
                    onChange={(e) => setCustomerAuthData((d) => ({ ...d, apellido: e.target.value }))}
                    required
                  />
                </div>
                <input
                  className="cauth-input"
                  type="tel"
                  placeholder="Teléfono (para recibir novedades por WhatsApp)"
                  value={customerAuthData.telefono}
                  onChange={(e) => setCustomerAuthData((d) => ({ ...d, telefono: e.target.value }))}
                />
                <input
                  className="cauth-input"
                  type="email"
                  placeholder="Correo electrónico"
                  value={customerAuthData.email}
                  onChange={(e) => setCustomerAuthData((d) => ({ ...d, email: e.target.value }))}
                  required
                />
                <input
                  className="cauth-input"
                  type="password"
                  placeholder="Contraseña (mínimo 6 caracteres)"
                  value={customerAuthData.password}
                  onChange={(e) => setCustomerAuthData((d) => ({ ...d, password: e.target.value }))}
                  required
                />
                {customerAuthError && <p className="cauth-error">{customerAuthError}</p>}
                <button className="cauth-submit" type="submit" disabled={customerAuthBusy}>
                  {customerAuthBusy ? "Procesando..." : "Crear cuenta"}
                </button>
                <p className="cauth-legal">
                  Al registrarte podés recibir novedades y ofertas de Manarey por WhatsApp.
                </p>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {cartOpen ? (
        <div className="cart-drawer-backdrop" onClick={() => setCartOpen(false)}>
          <aside className="cart-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="cart-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1.4rem" }}>🛒</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Tu carrito</h3>
                  {cart.length > 0 && (
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
                      {cart.reduce((s, i) => s + i.quantity, 0)} producto{cart.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
              <button className="cart-close-btn" onClick={() => setCartOpen(false)} type="button" aria-label="Cerrar carrito">✕</button>
            </div>

            {cart.length === 0 ? (
              <div className="cart-empty">
                <span className="cart-empty-icon">🛋️</span>
                <p>Tu carrito está vacío.</p>
                <button className="ghost-button" onClick={() => { navigateTo("catalogo"); setCartOpen(false); }} type="button">
                  Ver catálogo →
                </button>
              </div>
            ) : (
              <>
                <div className="cart-list">
                  {cart.map((item) => {
                    const product = products.find((p) => p.productKey === item.productKey);
                    return (
                      <div className="cart-item" key={item.lineKey}>
                        <div className="cart-item-thumb">
                          {product?.imageData && !isVideoSrc(product.imageData)
                            ? <img src={product.imageData} alt={item.nombre} />
                            : <span>{item.nombre[0]}</span>}
                        </div>
                        <div className="cart-item-body">
                          <p className="cart-name">{item.nombre}</p>
                          {item.accessoryLabel ? <p className="cart-extra">+ {item.accessoryLabel}</p> : null}
                          <p className="cart-line-total">
                            {currencyFormatter.format((item.precioVenta + (item.accessoryPrice || 0)) * item.quantity)}
                          </p>
                        </div>
                        <div className="cart-quantity">
                          {(() => {
                            const step = /silla/i.test(item.nombre) && !/pino/i.test(`${item.nombre} ${item.material || ""}`) ? 6 : 1;
                            const stock = product?.stockTotal ?? Infinity;
                            const atMax = item.quantity >= stock;
                            return (
                              <>
                                <button onClick={() => changeCartQuantity(item.lineKey, -step)} type="button">−</button>
                                <span>{item.quantity}{atMax && stock !== Infinity ? <span className="cart-qty-max" title={`Stock disponible: ${stock}`}> /{stock}</span> : null}</span>
                                <button onClick={() => changeCartQuantity(item.lineKey, step)} type="button" disabled={atMax} title={atMax ? `Stock máximo: ${stock}` : undefined}>+</button>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="cart-footer">
                  <div className="cart-total-row">
                    <span>Subtotal</span>
                    <strong>{currencyFormatter.format(checkoutSummary.subtotal)}</strong>
                  </div>
                  <p className="cart-footer-note">Envío y forma de pago se eligen en el siguiente paso.</p>
                  <a className="primary-button cart-checkout-btn" href="/checkout">
                    Finalizar compra →
                  </a>
                  <button className="ghost-button" style={{ width: "100%", marginTop: 8, textAlign: "center" }} onClick={() => setCartOpen(false)} type="button">
                    Seguir comprando
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      ) : null}

      {/* Modal gestión de destacados */}
      {featuredOpen && (
        <div className="modal-backdrop" onClick={() => setFeaturedOpen(false)}>
          <div className="admin-editor-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-editor-header">
              <h3 className="admin-editor-title">⭐ Productos destacados</h3>
              <button className="admin-editor-close" onClick={() => setFeaturedOpen(false)} type="button">✕</button>
            </div>
            <div className="admin-editor-body">
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 12 }}>
                Estos productos aparecen primero en la sección "Productos destacados" de la página de inicio.
                Usá las flechas para cambiar el orden. Máximo 5 recomendado.
              </p>

              {featuredList.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                  No hay productos destacados. Usá el botón ☆ en cada tarjeta para agregar.
                </p>
              ) : (
                <div className="featured-list">
                  {featuredList.map((p, idx) => (
                    <div className="featured-list-item" key={p.productKey}>
                      <div className="featured-list-order">#{idx + 1}</div>
                      {p.imageData && !isVideoSrc(p.imageData)
                        ? <img src={p.imageData} alt={p.nombre} className="featured-list-img" />
                        : <div className="featured-list-img featured-list-img-placeholder">M</div>
                      }
                      <div className="featured-list-info">
                        <strong>{p.nombre}</strong>
                        <span>{p.categoria}</span>
                      </div>
                      <div className="featured-list-actions">
                        <button
                          className="featured-arrow-btn"
                          disabled={idx === 0}
                          type="button"
                          title="Subir"
                          onClick={async () => {
                            const next = [...featuredList];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            setFeaturedList(next);
                            await fetch("/api/admin/featured", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ orderedKeys: next.map((x) => x.productKey) }),
                            });
                          }}
                        >▲</button>
                        <button
                          className="featured-arrow-btn"
                          disabled={idx === featuredList.length - 1}
                          type="button"
                          title="Bajar"
                          onClick={async () => {
                            const next = [...featuredList];
                            [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                            setFeaturedList(next);
                            await fetch("/api/admin/featured", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ orderedKeys: next.map((x) => x.productKey) }),
                            });
                          }}
                        >▼</button>
                        <button
                          className="featured-remove-btn"
                          type="button"
                          title="Quitar de destacados"
                          onClick={async () => {
                            await fetch("/api/admin/featured", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ productKey: p.productKey, isFeatured: false }),
                            });
                            const next = featuredList.filter((x) => x.productKey !== p.productKey);
                            setFeaturedList(next);
                            setProducts((prev) =>
                              prev.map((x) =>
                                x.productKey === p.productKey ? { ...x, isFeatured: false, featuredOrder: null } : x,
                              ),
                            );
                          }}
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 14 }}>
                Para agregar productos, cerrá este panel y usá el botón <strong>☆ Destacar</strong> en las tarjetas del catálogo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal configuración de envío */}
      {shippingSettingsOpen && (
        <div className="modal-backdrop" onClick={() => setShippingSettingsOpen(false)}>
          <div className="admin-editor-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-editor-header">
              <h3 className="admin-editor-title">⚙️ Precios de envío</h3>
              <button className="admin-editor-close" onClick={() => setShippingSettingsOpen(false)} type="button">✕</button>
            </div>
            <div className="admin-editor-body">
              <p style={{ marginBottom: 4, color: "var(--text-muted)", fontSize: "0.88rem" }}>
                El envío se calcula desde Longchamps o Glew (la más cercana al cliente).
              </p>
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">Costo base ($)</p>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 6 }}>
                  Se cobra siempre, independientemente de la distancia.
                </p>
                <input
                  className="cf-input"
                  type="number"
                  min="0"
                  step="500"
                  placeholder="Ej: 10000"
                  value={shippingForm.baseCost}
                  onChange={(e) => setShippingForm((f) => ({ ...f, baseCost: e.target.value }))}
                />
              </div>
              <div className="admin-editor-section">
                <p className="admin-editor-section-title">Costo por km ($)</p>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 6 }}>
                  Se multiplica por los km desde la sucursal hasta el domicilio.
                </p>
                <input
                  className="cf-input"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="Ej: 1500"
                  value={shippingForm.perKm}
                  onChange={(e) => setShippingForm((f) => ({ ...f, perKm: e.target.value }))}
                />
              </div>
              {shippingForm.baseCost && shippingForm.perKm && (
                <p style={{ fontSize: "0.85rem", color: "var(--gold)", margin: "8px 0" }}>
                  Ejemplo: 20 km → ${(Number(shippingForm.baseCost) + 20 * Number(shippingForm.perKm)).toLocaleString("es-AR")}
                </p>
              )}
              {shippingFormMsg && (
                <p style={{ color: shippingFormMsg.startsWith("✅") ? "var(--gold)" : "#c0392b", fontSize: "0.88rem" }}>
                  {shippingFormMsg}
                </p>
              )}
              <button
                className="cf-btn-primary"
                style={{ marginTop: 8 }}
                disabled={shippingFormBusy}
                type="button"
                onClick={async () => {
                  setShippingFormBusy(true);
                  setShippingFormMsg("");
                  try {
                    const res = await fetch("/api/admin/settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        shippingBaseCost: Number(shippingForm.baseCost),
                        shippingCostPerKm: Number(shippingForm.perKm),
                      }),
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data.error || "Error al guardar.");
                    }
                    setShippingFormMsg("✅ Precios actualizados correctamente.");
                  } catch (err) {
                    setShippingFormMsg(err.message || "Error al guardar.");
                  } finally {
                    setShippingFormBusy(false);
                  }
                }}
              >
                {shippingFormBusy ? "Guardando..." : "Guardar precios"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Sticky cart bar — solo mobile, cuando hay items ───────────────── */}
      {cart.length > 0 && !cartOpen && (
        <div className="sticky-cart-bar">
          <div className="sticky-cart-bar-total">
            <small>{cartCount} producto{cartCount !== 1 ? "s" : ""}</small>
            <strong>{currencyFormatter.format(checkoutSummary.subtotal)}</strong>
          </div>
          <a className="sticky-cart-bar-btn" href="/checkout">
            Finalizar compra →
          </a>
        </div>
      )}

      {/* ── Botón flotante WhatsApp ─────────────────────────────────────────── */}
      {whatsappNumber && (        <a
          className="wsp-fab"
          href={buildContactLink("Hola, quiero consultar sobre un producto de Manarey.", "Consulta Manarey")}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Consultar por WhatsApp"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span>Consultar</span>
        </a>
      )}

      <footer className="site-footer">
        <div className="footer-top">
          <div>
            <p className="eyebrow">Manarey</p>
            <h3>Muebles y articulos del hogar.</h3>
            <p className="footer-tagline">Empresa familiar desde 2017 · 5 sucursales en el sur del GBA</p>
          </div>
          {whatsappNumber && (
            <a
              className="footer-wsp-btn"
              href={buildContactLink("Hola, quiero hacer una consulta sobre Manarey.", "Consulta Manarey")}
              target="_blank"
              rel="noreferrer noopener"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Escribinos por WhatsApp
            </a>
          )}
        </div>
        <div className="footer-grid">
          <div>
            <strong>Catálogo</strong>
            <p>Compra por carrito, tarjeta, transferencia o WhatsApp.</p>
          </div>
          <div>
            <strong>Sucursales</strong>
            <p>5 locales en la zona sur del Gran Buenos Aires. Central en Longchamps.</p>
          </div>
          <div>
            <strong>Contacto</strong>
            <p>+54 9 11 6428-2270</p>
            <p style={{ fontSize: "0.82rem", opacity: 0.7 }}>{contactEmail}</p>
            <a
              href="/politica-de-privacidad"
              style={{ fontSize: "0.78rem", opacity: 0.55, color: "inherit", textDecoration: "underline", display: "block", marginTop: 6 }}
            >
              Política de privacidad
            </a>
          </div>
          <div>
            <strong>Seguinos</strong>
            <div className="footer-social">
              <a href={storeSettings.instagramUrl} target="_blank" rel="noreferrer noopener" className="footer-social-link">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                @manareymuebleria
              </a>
              <a href={storeSettings.facebookUrl} target="_blank" rel="noreferrer noopener" className="footer-social-link">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Manarey Glew
              </a>
            </div>
          </div>
        </div>

        <div className="payment-strip">
          <p className="payment-strip-label">Medios de pago aceptados</p>
          <div className="payment-marquee-outer">
            <div className="payment-marquee-track">
              {[...PAYMENT_METHODS, ...PAYMENT_METHODS].map((p, i) => (
                <div className="payment-badge" key={i}>
                  {p.icon}
                  <span>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
