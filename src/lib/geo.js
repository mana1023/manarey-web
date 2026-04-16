const LONGCHAMPS_ORIGIN = {
  label: "Sucursal Longchamps",
  lat: -34.8589,
  lon: -58.3946,
};

/**
 * Distancias máximas preconfiguradas por localidad del GBA/CABA (desde Longchamps).
 * Se usan como último recurso cuando ni la dirección ni la ciudad se pueden geocodificar.
 * El valor representa el punto MÁS LEJANO razonable dentro de esa localidad.
 */
const CITY_MAX_DISTANCES = {
  // Zona sur cercana
  "longchamps": 5,
  "glew": 8,
  "monte grande": 12,
  "ezeiza": 14,
  "canning": 14,
  "tristán suárez": 18,
  "tristan suarez": 18,
  "calera": 10,
  "malvinas argentinas": 10, // zona sur
  "claypole": 12,
  "burzaco": 14,
  "temperley": 18,
  "lomas de zamora": 22,
  "banfield": 20,
  "remedios de escalada": 22,
  "lanús": 26,
  "lanus": 26,
  "avellaneda": 30,
  // Zona sur lejana
  "guernica": 22,
  "domselaar": 20,
  "san vicente": 28,
  "alejandro korn": 18,
  "cañuelas": 35,
  "canuelas": 35,
  "florencio varela": 20,
  "quilmes": 28,
  "bernal": 25,
  "berazategui": 32,
  "hudson": 36,
  "villa gesell": 400,
  // Zona oeste
  "la matanza": 38,
  "san justo": 38,
  "ciudad evita": 35,
  "tapiales": 35,
  "ramos mejía": 34,
  "ramos mejia": 34,
  "haedo": 38,
  "morón": 40,
  "moron": 40,
  "ituzaingó": 44,
  "ituzaingo": 44,
  "merlo": 48,
  "moreno": 55,
  "general rodríguez": 65,
  "general rodriguez": 65,
  "luján": 75,
  "lujan": 75,
  // Zona norte
  "palermo": 36,
  "villa urquiza": 38,
  "belgrano": 38,
  "san isidro": 42,
  "tigre": 55,
  "escobar": 70,
  "pilar": 80,
  "zárate": 110,
  "zarate": 110,
  // CABA
  "buenos aires": 40,
  "capital federal": 40,
  "caba": 40,
  "ciudad de buenos aires": 40,
  // La Plata
  "la plata": 52,
  "city bell": 55,
  "gonnet": 54,
  "villa elisa": 53,
  "berisso": 58,
  "ensenada": 58,
};

/**
 * Buffer en km que se suma cuando se cotiza desde el CENTRO de la ciudad
 * (porque el cliente puede estar en cualquier punto, queremos cobrar el más lejano).
 */
const CITY_CENTER_BUFFER_KM = 5;

function buildAddressQuery(address, city) {
  return [address, city, "Buenos Aires", "Argentina"].filter(Boolean).join(", ");
}

async function geocodeQuery(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Manarey/1.0 (shipping quote)",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const results = await response.json();
  const first = results?.[0];
  if (!first?.lat || !first?.lon) return null;
  return {
    lat: Number(first.lat),
    lon: Number(first.lon),
    label: first.display_name,
  };
}

async function getDrivingDistanceKm(destination) {
  const coordinates = `${LONGCHAMPS_ORIGIN.lon},${LONGCHAMPS_ORIGIN.lat};${destination.lon},${destination.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) throw new Error("No se pudo calcular la ruta del envio.");

  const payload = await response.json();
  const distanceMeters = payload?.routes?.[0]?.distance;

  if (!Number.isFinite(distanceMeters)) {
    throw new Error("No se pudo obtener la distancia por ruta.");
  }

  return Math.round((distanceMeters / 1000) * 10) / 10;
}

/**
 * Busca la distancia máxima preconfigurada para una ciudad.
 * Normaliza el nombre para hacer la búsqueda tolerante a acentos/mayúsculas.
 */
function getCityMaxDistance(city) {
  const normalized = city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .trim();

  // Búsqueda exacta
  if (CITY_MAX_DISTANCES[normalized] !== undefined) {
    return CITY_MAX_DISTANCES[normalized];
  }

  // Búsqueda parcial (si el input contiene el nombre de la ciudad conocida)
  for (const [key, km] of Object.entries(CITY_MAX_DISTANCES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return km;
    }
  }

  // Fallback final: 60 km (estimación conservadora para cualquier punto del GBA)
  return 60;
}

/**
 * Resuelve la distancia de envío desde Longchamps a una dirección.
 *
 * Estrategia de fallback en cascada:
 *  1. Geocodifica la dirección completa → distancia exacta por ruta
 *  2. Si falla, geocodifica solo la ciudad → distancia al centro + buffer
 *  3. Si también falla, usa tabla de máximos preconfigurada por localidad
 *
 * @returns {{ origin, destination, distanceKm, isFallback, fallbackReason }}
 */
export async function resolveShippingDistance(address, city) {
  // ─ Intento 1: dirección exacta ──────────────────────────────────────────
  try {
    const destination = await geocodeQuery(buildAddressQuery(address, city));
    if (destination) {
      const distanceKm = await getDrivingDistanceKm(destination);
      return {
        origin: LONGCHAMPS_ORIGIN,
        destination,
        distanceKm,
        isFallback: false,
        fallbackReason: null,
      };
    }
  } catch {
    // continuar al fallback
  }

  // ─ Intento 2: solo la ciudad ────────────────────────────────────────────
  try {
    const cityQuery = [city, "Buenos Aires", "Argentina"].join(", ");
    const cityCoords = await geocodeQuery(cityQuery);
    if (cityCoords) {
      const centerKm = await getDrivingDistanceKm(cityCoords);
      // Sumar buffer para cubrir el punto más lejano de la localidad
      const distanceKm = Math.round((centerKm + CITY_CENTER_BUFFER_KM) * 10) / 10;
      return {
        origin: LONGCHAMPS_ORIGIN,
        destination: { ...cityCoords, label: city },
        distanceKm,
        isFallback: true,
        fallbackReason: "address", // no encontró la dirección específica
      };
    }
  } catch {
    // continuar al fallback
  }

  // ─ Intento 3: tabla de máximos por localidad ────────────────────────────
  const distanceKm = getCityMaxDistance(city);
  return {
    origin: LONGCHAMPS_ORIGIN,
    destination: { label: city },
    distanceKm,
    isFallback: true,
    fallbackReason: "city", // tampoco encontró la ciudad
  };
}
