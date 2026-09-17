"use client";

import { useEffect, useState } from "react";

/**
 * Activa los avisos push de pedidos en el celular desde el que se abre el
 * panel. Pensado para que lo use cualquiera: un botón, y las instrucciones
 * justas para el caso en que esté (Android, iPhone, permiso bloqueado).
 */

function claveABytes(base64url) {
  const relleno = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function nombreDelDispositivo() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Celular Android";
  if (/Windows/.test(ua)) return "Computadora Windows";
  if (/Macintosh/.test(ua)) return "Mac";
  return "Navegador";
}

const esIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const abiertaDesdeInicio = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

/** El worker recién registrado tarda un instante en quedar activo. */
async function registrarWorker() {
  const registro = await navigator.serviceWorker.register("/sw-avisos.js", { scope: "/admin" });
  if (registro.active) return registro;
  const worker = registro.installing || registro.waiting;
  if (worker && worker.state !== "activated") {
    // Si la instalación falla, el worker queda "redundant": sin esto la espera
    // quedaba colgada y el botón no respondía más.
    await new Promise((listo, fallo) => {
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") listo();
        else if (worker.state === "redundant") fallo(new Error("No se pudo instalar el servicio de avisos."));
      });
    });
  }
  return registro;
}

export default function AvisosCelular() {
  // cargando · no-soportado · iphone · bloqueado · apagado · activado
  const [estado, setEstado] = useState("cargando");
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [celulares, setCelulares] = useState(null);

  useEffect(() => {
    (async () => {
      const soporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!soporta) {
        // En iPhone el push sólo existe con la web agregada a la pantalla de inicio.
        setEstado(esIphone() && !abiertaDesdeInicio() ? "iphone" : "no-soportado");
        return;
      }
      if (Notification.permission === "denied") {
        setEstado("bloqueado");
        return;
      }
      try {
        const registro = await registrarWorker();
        const suscripcion = await registro.pushManager.getSubscription();
        setEstado(suscripcion ? "activado" : "apagado");
        const datos = await fetch("/api/admin/avisos-push").then((r) => r.json());
        if (typeof datos.celulares === "number") setCelulares(datos.celulares);
      } catch {
        setEstado("apagado");
      }
    })();
  }, []);

  async function probar(endpoint) {
    const res = await fetch("/api/admin/avisos-push/prueba", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(endpoint ? { endpoint } : {}),
    });
    const datos = await res.json();
    if (!res.ok) throw new Error(datos.error || datos.resultados?.[0]?.error || "No se pudo mandar la prueba.");
  }

  async function activar() {
    setOcupado(true);
    setAviso(null);
    try {
      // El permiso se pide antes que nada: iPhone sólo lo acepta si viene
      // directo del toque en el botón.
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "apagado");
        if (permiso !== "denied") setAviso({ tipo: "error", texto: "Hay que tocar «Permitir» para recibir los avisos." });
        return;
      }

      const registro = await registrarWorker();
      const { publicKey, error } = await fetch("/api/admin/avisos-push").then((r) => r.json());
      if (!publicKey) throw new Error(error || "No se pudo preparar los avisos.");

      // Una suscripción vieja con otra clave hace fallar la nueva.
      const vieja = await registro.pushManager.getSubscription();
      if (vieja) await vieja.unsubscribe();

      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveABytes(publicKey),
      });

      const res = await fetch("/api/admin/avisos-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: suscripcion.toJSON(), etiqueta: nombreDelDispositivo() }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error || "No se pudo activar los avisos.");

      setEstado("activado");
      setCelulares(datos.celulares);
      await probar(suscripcion.endpoint);
      setAviso({ tipo: "ok", texto: "¡Listo! Te mandamos un aviso de prueba: tendría que sonarte ahora." });
    } catch (err) {
      setAviso({ tipo: "error", texto: err?.message || "No se pudo activar los avisos." });
    } finally {
      setOcupado(false);
    }
  }

  async function probarEsteCelular() {
    setOcupado(true);
    setAviso(null);
    try {
      const registro = await registrarWorker();
      const suscripcion = await registro.pushManager.getSubscription();
      await probar(suscripcion?.endpoint);
      setAviso({ tipo: "ok", texto: "Aviso de prueba enviado: tendría que sonarte en unos segundos." });
    } catch (err) {
      setAviso({ tipo: "error", texto: err?.message || "No se pudo mandar la prueba." });
    } finally {
      setOcupado(false);
    }
  }

  async function desactivar() {
    setOcupado(true);
    setAviso(null);
    try {
      const registro = await registrarWorker();
      const suscripcion = await registro.pushManager.getSubscription();
      if (suscripcion) {
        await fetch("/api/admin/avisos-push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: suscripcion.endpoint }),
        });
        await suscripcion.unsubscribe();
      }
      setEstado("apagado");
      setCelulares((n) => (typeof n === "number" ? Math.max(0, n - 1) : n));
    } catch (err) {
      setAviso({ tipo: "error", texto: err?.message || "No se pudo desactivar." });
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "cargando") return null;

  return (
    <section className={`aop-avisos aop-avisos--${estado}`} aria-live="polite">
      {estado === "activado" && (
        <>
          <p className="aop-avisos-titulo">✅ Este celular recibe los avisos de pedidos</p>
          <p className="aop-avisos-texto">
            Cada vez que alguien compra en la web te suena con todos los datos.
            {typeof celulares === "number" && celulares > 1 ? ` Hay ${celulares} dispositivos con avisos.` : ""}
          </p>
          <div className="aop-avisos-botones">
            <button type="button" className="aop-avisos-btn" onClick={probarEsteCelular} disabled={ocupado}>
              Mandar aviso de prueba
            </button>
            <button type="button" className="aop-avisos-btn aop-avisos-btn--suave" onClick={desactivar} disabled={ocupado}>
              Desactivar
            </button>
          </div>
        </>
      )}

      {estado === "apagado" && (
        <>
          <p className="aop-avisos-titulo">🔔 Avisos de pedidos en este celular</p>
          <p className="aop-avisos-texto">
            Activalos y te va a sonar cada vez que alguien compre en la web: cliente, teléfono, dirección,
            productos y total. Con un toque le escribís por WhatsApp.
          </p>
          <div className="aop-avisos-botones">
            <button type="button" className="aop-avisos-btn aop-avisos-btn--principal" onClick={activar} disabled={ocupado}>
              {ocupado ? "Activando…" : "Activar avisos en este celular"}
            </button>
          </div>
        </>
      )}

      {estado === "iphone" && (
        <>
          <p className="aop-avisos-titulo">🔔 Avisos de pedidos en iPhone</p>
          <p className="aop-avisos-texto">
            En iPhone hay un paso antes: tocá <strong>Compartir</strong> (el cuadrado con la flecha) →{" "}
            <strong>Agregar a inicio</strong>. Después abrí la web desde ese ícono nuevo, entrá a este panel y
            activá los avisos. Necesita iOS 16.4 o más nuevo.
          </p>
        </>
      )}

      {estado === "bloqueado" && (
        <>
          <p className="aop-avisos-titulo">🔕 Los avisos están bloqueados en este navegador</p>
          <p className="aop-avisos-texto">
            Tocá el candado o los tres puntos al lado de la dirección → <strong>Configuración del sitio</strong> →{" "}
            <strong>Notificaciones</strong> → <strong>Permitir</strong>. Después volvé a entrar a este panel.
          </p>
        </>
      )}

      {estado === "no-soportado" && (
        <>
          <p className="aop-avisos-titulo">🔔 Avisos de pedidos</p>
          <p className="aop-avisos-texto">
            Este navegador no puede recibir avisos. En Android usá <strong>Chrome</strong>.
          </p>
        </>
      )}

      {aviso && <p className={`aop-avisos-resultado is-${aviso.tipo}`}>{aviso.texto}</p>}
    </section>
  );
}
