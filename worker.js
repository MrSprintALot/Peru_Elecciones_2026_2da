/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ONPE PROXY WORKER — Segunda Vuelta 2026                   ║
 * ║  Cloudflare Worker · onpe-proxy-sv                         ║
 * ║  Autor: Rafael Vasquez (MrSprintALot)                      ║
 * ║  Versión: v3 — junio 2026                                  ║
 * ║  (+ voto exterior por continente + participacion/ausentismo)║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const ONPE_BASE = "https://resultadosegundavuelta.onpe.gob.pe/presentacion-backend";
const CACHE_TTL = 90;

const ALLOWED_ORIGINS = [
  "https://mrsprintalot.github.io",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:5500", // Live Server VSCode
];

// Matching por DNI (más robusto que por nombre).
const CANDIDATE_DNI = {
  "10001088": "fuji",  // Keiko Sofía Fujimori Higuchi — Fuerza Popular
  "16002918": "sanch", // Roberto Helbert Sánchez Palomino — Juntos por el Perú
};

const DEPARTAMENTOS = [
  { ubigeo: "010000", nombre: "Amazonas" },
  { ubigeo: "020000", nombre: "Áncash" },
  { ubigeo: "030000", nombre: "Apurímac" },
  { ubigeo: "040000", nombre: "Arequipa" },
  { ubigeo: "050000", nombre: "Ayacucho" },
  { ubigeo: "060000", nombre: "Cajamarca" },
  { ubigeo: "240000", nombre: "Callao" },
  { ubigeo: "070000", nombre: "Cusco" },
  { ubigeo: "080000", nombre: "Huancavelica" },
  { ubigeo: "090000", nombre: "Huánuco" },
  { ubigeo: "100000", nombre: "Ica" },
  { ubigeo: "110000", nombre: "Junín" },
  { ubigeo: "120000", nombre: "La Libertad" },
  { ubigeo: "130000", nombre: "Lambayeque" },
  { ubigeo: "140000", nombre: "Lima" },
  { ubigeo: "150000", nombre: "Loreto" },
  { ubigeo: "160000", nombre: "Madre de Dios" },
  { ubigeo: "170000", nombre: "Moquegua" },
  { ubigeo: "180000", nombre: "Pasco" },
  { ubigeo: "190000", nombre: "Piura" },
  { ubigeo: "200000", nombre: "Puno" },
  { ubigeo: "210000", nombre: "San Martín" },
  { ubigeo: "220000", nombre: "Tacna" },
  { ubigeo: "230000", nombre: "Tumbes" },
  { ubigeo: "250000", nombre: "Ucayali" },
  { ubigeo: "880000", nombre: "Extranjero", esExtranjero: true },
];

const HALF_1 = DEPARTAMENTOS.slice(0, 13);
const HALF_2 = DEPARTAMENTOS.slice(13);

// Continentes del voto exterior. ubigeos confirmados vía endpoint
// /ubigeos/departamentos?idEleccion=10&idAmbitoGeografico=2
const CONTINENTES = [
  { ubigeo: "910000", nombre: "África",  cont: "AFRICA"  },
  { ubigeo: "920000", nombre: "América", cont: "AMERICA" },
  { ubigeo: "930000", nombre: "Asia",    cont: "ASIA"    },
  { ubigeo: "940000", nombre: "Europa",  cont: "EUROPA"  },
  { ubigeo: "950000", nombre: "Oceanía", cont: "OCEANIA" },
];

// ═══════════════════════════════════════════════════════════════
// CORS
// ═══════════════════════════════════════════════════════════════
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

// ═══════════════════════════════════════════════════════════════
// FETCH A ONPE — headers idénticos al Worker de primera vuelta.
// NO usar Origin ni X-Requested-With: activan el bloqueo anti-bot.
// ═══════════════════════════════════════════════════════════════
async function onpeFetch(path) {
  const url = `${ONPE_BASE}${path}`;
  const resp = await fetch(url, {
    headers: {
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9,es-ES;q=0.8,es;q=0.7",
      "Content-Type": "application/json",
      "Referer": "https://resultadosegundavuelta.onpe.gob.pe/main/presidenciales",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    },
    cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
  });
  if (!resp.ok) throw new Error(`ONPE HTTP ${resp.status}`);
  const json = await resp.json();
  if (!json.success) throw new Error(`ONPE: ${json.message || "error"}`);
  return json.data;
}

// ═══════════════════════════════════════════════════════════════
// PARSING DE CANDIDATOS — por DNI
// ═══════════════════════════════════════════════════════════════
function parseCandidatos(data) {
  const result = { fuji: 0, sanch: 0, fujiVotos: 0, sanchVotos: 0 };
  if (!Array.isArray(data)) return result;
  data.forEach((d) => {
    const key = CANDIDATE_DNI[d.dniCandidato];
    if (key) {
      result[key] = d.porcentajeVotosValidos || 0;
      result[key + "Votos"] = d.totalVotosValidos || 0;
    }
  });
  return result;
}

// ═══════════════════════════════════════════════════════════════
// FETCH NACIONAL
// ═══════════════════════════════════════════════════════════════
async function fetchNacional() {
  const [totales, candidatosData] = await Promise.all([
    onpeFetch("/resumen-general/totales?idEleccion=10&tipoFiltro=eleccion"),
    onpeFetch("/eleccion-presidencial/participantes-ubicacion-geografica-nombre?idEleccion=10&tipoFiltro=eleccion"),
  ]);

  const contabilizadas = totales.contabilizadas || 0;
  const totalActas = totales.totalActas || 92766;
  const pct = totalActas > 0 ? +((contabilizadas / totalActas) * 100).toFixed(3) : 0;

  return {
    pct,
    contabilizadas,
    totalActas,
    enviadasJee: totales.enviadasJee || 0,
    votosEmitidos: totales.totalVotosEmitidos || 0,
    votosValidos: totales.totalVotosValidos || 0,
    participacion: totales.participacionCiudadana || 0,
    fechaActualizacion: totales.fechaActualizacion || Date.now(),
    candidates: parseCandidatos(candidatosData),
  };
}

// ═══════════════════════════════════════════════════════════════
// FETCH REGIONAL
// ═══════════════════════════════════════════════════════════════
async function fetchRegion(dept) {
  const { ubigeo, nombre, esExtranjero } = dept;
  let totalesPath, candidatosPath;

  if (esExtranjero) {
    totalesPath = `/resumen-general/totales?idEleccion=10&tipoFiltro=eleccion&idAmbitoGeografico=2`;
    candidatosPath = `/eleccion-presidencial/participantes-ubicacion-geografica-nombre?tipoFiltro=ubigeo_nivel_01&idAmbitoGeografico=2&ubigeoNivel1=${ubigeo}&listContinentals=&listCountries=&idEleccion=10`;
  } else {
    totalesPath = `/resumen-general/totales?idAmbitoGeografico=1&idEleccion=10&tipoFiltro=ubigeo_nivel_01&idUbigeoDepartamento=${ubigeo}`;
    candidatosPath = `/eleccion-presidencial/participantes-ubicacion-geografica-nombre?tipoFiltro=ubigeo_nivel_01&idAmbitoGeografico=1&ubigeoNivel1=${ubigeo}&listContinentals=&listCountries=&idEleccion=10`;
  }

  const [totales, candidatosData] = await Promise.all([
    onpeFetch(totalesPath),
    onpeFetch(candidatosPath),
  ]);

  const contabilizadas = totales.contabilizadas || 0;
  const totalActas = totales.totalActas || 0;
  const pct = totalActas > 0 ? +((contabilizadas / totalActas) * 100).toFixed(1) : 0;
  const vv = totales.totalVotosValidos || 0;
  const cands = parseCandidatos(candidatosData);

  return {
    name: nombre,
    ubigeo,
    pct,
    vv,
    fuji: cands.fuji,
    sanch: cands.sanch,
    fujiVotos: cands.fujiVotos,
    sanchVotos: cands.sanchVotos,
    contabilizadas,
    totalActas,
    enviadasJee: totales.enviadasJee || 0,
    participacion: totales.participacionCiudadana || 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// FETCH POR CONTINENTE (voto exterior)
// Usa el endpoint PROBADO (participantes-ubicacion-geografica-nombre),
// NO /resumen-general/participantes — ese devuelve el shell de Angular
// cuando se llama desde el Worker. Solo cambia ubigeoNivel1 al continente.
// ═══════════════════════════════════════════════════════════════
async function fetchContinente(c) {
  const candidatosPath =
    `/eleccion-presidencial/participantes-ubicacion-geografica-nombre` +
    `?tipoFiltro=ubigeo_nivel_01&idAmbitoGeografico=2&ubigeoNivel1=${c.ubigeo}` +
    `&listContinentals=&listCountries=&idEleccion=10`;
  const data = await onpeFetch(candidatosPath);
  const cands = parseCandidatos(data);
  return {
    cont: c.cont,
    name: c.nombre,
    ubigeo: c.ubigeo,
    fuji: cands.fuji,
    sanch: cands.sanch,
    fujiVotos: cands.fujiVotos,
    sanchVotos: cands.sanchVotos,
  };
}

async function buildExterior() {
  const continents = await Promise.all(
    CONTINENTES.map((c) =>
      fetchContinente(c).catch((e) => ({
        cont: c.cont, name: c.nombre, ubigeo: c.ubigeo,
        fuji: 0, sanch: 0, fujiVotos: 0, sanchVotos: 0, error: e.message,
      }))
    )
  );

  // Resumen agregado del exterior (suma de los 5 continentes)
  const totalFuji = continents.reduce((s, c) => s + (c.fujiVotos || 0), 0);
  const totalSanch = continents.reduce((s, c) => s + (c.sanchVotos || 0), 0);
  const vv = totalFuji + totalSanch;

  return {
    continents,
    total: {
      fujiVotos: totalFuji,
      sanchVotos: totalSanch,
      vv,
      fuji: vv ? +((totalFuji / vv) * 100).toFixed(3) : 0,
      sanch: vv ? +((totalSanch / vv) * 100).toFixed(3) : 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// SNAPSHOT (patrón half=1 / half=2, igual que primera vuelta)
// ═══════════════════════════════════════════════════════════════
async function buildSnapshot(half) {
  const depts = half === 1 ? HALF_1 : HALF_2;
  let national = null;

  if (half === 1) {
    try {
      national = await fetchNacional();
    } catch (e) {
      national = {
        pct: 0, contabilizadas: 0, totalActas: 92766, enviadasJee: 0,
        votosEmitidos: 0, votosValidos: 0, participacion: 0,
        candidates: { fuji: 0, sanch: 0, fujiVotos: 0, sanchVotos: 0 },
        error: e.message,
      };
    }
  }

  const regions = await Promise.all(
    depts.map((dept) =>
      fetchRegion(dept).catch((e) => ({
        name: dept.nombre, ubigeo: dept.ubigeo,
        pct: 0, vv: 0, fuji: 0, sanch: 0, fujiVotos: 0, sanchVotos: 0,
        participacion: 0,
        error: e.message,
      }))
    )
  );

  const snapshot = { regions };
  if (national !== null) snapshot.national = national;
  return snapshot;
}

// ═══════════════════════════════════════════════════════════════
// TRACKING en KV
// ═══════════════════════════════════════════════════════════════
async function getTracking(env) {
  if (!env.ONPE_KV) return { cuts: [], error: "KV not configured" };
  try {
    const raw = await env.ONPE_KV.get("tracking-sv");
    return raw ? JSON.parse(raw) : { cuts: [] };
  } catch (e) {
    return { cuts: [], error: e.message };
  }
}

async function saveTrackingCut(env, nat) {
  if (!env.ONPE_KV || !nat || nat.error) return;
  try {
    const raw = await env.ONPE_KV.get("tracking-sv");
    const tracking = raw ? JSON.parse(raw) : { cuts: [] };
    const last = tracking.cuts[tracking.cuts.length - 1];
    const cut = {
      pct: nat.pct,
      keiko: nat.candidates.fuji,
      sanch: nat.candidates.sanch,
      // Votos absolutos: en fase final el margen en pp redondea a ~0 y los
      // votos son la única resolución útil. Cortes viejos no los tienen;
      // el frontend los tolera ausentes.
      kv: nat.candidates.fujiVotos,
      sv: nat.candidates.sanchVotos,
      ts: new Date().toISOString(),
    };
    // En fase final el conteo avanza en centésimas: el umbral de +0.35pct
    // dejaba de registrar justo cuando importa. También guardamos si el
    // margen cambió de signo (cambio de líder) o si pasaron 30 min con
    // algo de avance.
    const marginNow  = cut.keiko - cut.sanch;
    const marginLast = last ? last.keiko - last.sanch : null;
    const signFlip   = !!last && Math.sign(marginNow) !== Math.sign(marginLast);
    const staleTime  = !!last && (Date.now() - Date.parse(last.ts)) > 30 * 60 * 1000;
    const progressed = !last || nat.pct > last.pct + 0.35;
    if (progressed || signFlip || (staleTime && nat.pct > last.pct)) {
      tracking.cuts.push(cut);
      if (tracking.cuts.length > 300) tracking.cuts = tracking.cuts.slice(-300);
      await env.ONPE_KV.put("tracking-sv", JSON.stringify(tracking));
    }
  } catch (e) {
    console.error("KV save:", e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const CORS = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });
    }

    if (path === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        worker: "onpe-proxy-sv",
        ts: new Date().toISOString(),
        kv: env.ONPE_KV ? "configured" : "not configured",
      }), { headers: CORS });
    }

    // /debug?url=... — diagnostica la respuesta cruda de ONPE
    if (path === "/debug") {
      const target = url.searchParams.get("url") ||
        `${ONPE_BASE}/resumen-general/totales?idEleccion=10&tipoFiltro=eleccion`;
      const resp = await fetch(target, {
        headers: {
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9,es-ES;q=0.8,es;q=0.7",
          "Content-Type": "application/json",
          "Referer": "https://resultadosegundavuelta.onpe.gob.pe/main/presidenciales",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
        },
        cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
      });
      const text = await resp.text();
      return new Response(JSON.stringify({
        target, status: resp.status,
        contentType: resp.headers.get("content-type"),
        bodyPreview: text.slice(0, 400),
      }), { headers: CORS });
    }

    if (path === "/api/tracking") {
      const tracking = await getTracking(env);
      return new Response(JSON.stringify(tracking), {
        headers: { ...CORS, "Cache-Control": "no-store" },
      });
    }

    // ── Voto exterior por continente (Opción A: endpoint dedicado) ──
    if (path === "/api/exterior") {
      try {
        const data = await buildExterior();
        return new Response(JSON.stringify(data), {
          headers: { ...CORS, "Cache-Control": `public, max-age=${CACHE_TTL}`, "X-Worker": "onpe-proxy-sv" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 502, headers: CORS });
      }
    }

    if (path === "/api/snapshot") {
      const half = parseInt(url.searchParams.get("half") || "1");
      if (half !== 1 && half !== 2) {
        return new Response(JSON.stringify({ error: "half must be 1 or 2" }), { status: 400, headers: CORS });
      }
      try {
        const snapshot = await buildSnapshot(half);
        if (half === 1 && snapshot.national && !snapshot.national.error) {
          ctx.waitUntil(saveTrackingCut(env, snapshot.national));
        }
        return new Response(JSON.stringify(snapshot), {
          headers: { ...CORS, "Cache-Control": `public, max-age=${CACHE_TTL}`, "X-Worker": "onpe-proxy-sv" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 502, headers: CORS });
      }
    }

    return new Response(JSON.stringify({ error: "Not found", path }), { status: 404, headers: CORS });
  },
};
