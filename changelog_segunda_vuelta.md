# Perú Elige 2026 — Segunda Vuelta · Changelog de implementación

## Resumen ejecutivo

Se construyó desde cero un dashboard independiente para la **segunda vuelta presidencial
del 7 de junio de 2026** (Keiko Fujimori vs Roberto Sánchez), reutilizando la infraestructura
y aprendizajes de primera vuelta pero en un repo y Worker nuevos.

- **Repo nuevo:** `github.com/MrSprintALot/Peru_Elecciones_2026_2da`
- **Dashboard live:** `mrsprintalot.github.io/Peru_Elecciones_2026_2da`
- **Worker nuevo:** `onpe-proxy-sv.perudata2026.workers.dev`
- **Dominio ONPE:** `resultadosegundavuelta.onpe.gob.pe/presentacion-backend` (idEleccion=10)

---

## Decisiones de arquitectura

1. **Repo separado** (no fork del de primera vuelta) para mantener la 1ra vuelta como
   archivo histórico limpio y empezar con un codebase simple de 2 candidatos.
2. **Worker nuevo independiente** (`onpe-proxy-sv`), no se reutilizaron los Workers viejos
   (`onpe-proxy`, `onpe-proxy2`) que apuntaban a la API de primera vuelta.
3. **KV namespace nuevo** (`ONPE_KV_SV`), binding `ONPE_KV`. CORS restringido a
   `mrsprintalot.github.io`.

---

## Endpoints ONPE — Segunda Vuelta

```
Base: https://resultadosegundavuelta.onpe.gob.pe/presentacion-backend

Totales nacional:
  /resumen-general/totales?idEleccion=10&tipoFiltro=eleccion

Candidatos nacional (el que SÍ trae datos para el mapa/parsing):
  /eleccion-presidencial/participantes-ubicacion-geografica-nombre?idEleccion=10&tipoFiltro=eleccion

Totales regional:
  /resumen-general/totales?idAmbitoGeografico=1&idEleccion=10&tipoFiltro=ubigeo_nivel_01&idUbigeoDepartamento=XXXXXX

Candidatos regional:
  /eleccion-presidencial/participantes-ubicacion-geografica-nombre?tipoFiltro=ubigeo_nivel_01&idAmbitoGeografico=1&ubigeoNivel1=XXXXXX&listContinentals=&listCountries=&idEleccion=10

Voto exterior — listado de continentes (devuelve ubigeos 91xxxx–95xxxx):
  /ubigeos/departamentos?idEleccion=10&idAmbitoGeografico=2

Voto exterior — candidatos por continente:
  /eleccion-presidencial/participantes-ubicacion-geografica-nombre?tipoFiltro=ubigeo_nivel_01&idAmbitoGeografico=2&ubigeoNivel1=9X0000&listContinentals=&listCountries=&idEleccion=10
  ubigeos: 910000 África · 920000 América · 930000 Asia · 940000 Europa · 950000 Oceanía
```

**⚠️ Trampa del exterior (anti-bot):** en DevTools, ONPE sirve los datos por continente
vía `/resumen-general/participantes?...&tipoFiltro=ubigeo_nivel_01&idUbigeoDepartamento=9X0000`.
Ese endpoint funciona **desde el navegador** pero devuelve el **shell de Angular desde el Worker**
(la misma trampa del bloqueo anti-bot). La solución es NO portar la URL de DevTools: usar el
endpoint probado `participantes-ubicacion-geografica-nombre` con `ubigeoNivel1=9X0000`, que es
el mismo que ya funciona para el Extranjero agregado. Solo cambia el ubigeo.

**Ausentismo — sin endpoint nuevo:** el `/resumen-general/totales` (nacional y regional) ya
incluye el campo `participacionCiudadana`. Ausentismo = `100 − participacionCiudadana`.
El Worker solo lo captura como campo `participacion`; no requiere requests adicionales.

### Rutas del Worker (`onpe-proxy-sv`)

```
GET /api/snapshot?half=1   → nacional + 13 regiones (incluye participacion)
GET /api/snapshot?half=2   → 13 regiones restantes
GET /api/exterior          → 5 continentes + total agregado (1 fetch, 5 subrequests)
GET /api/tracking          → histórico de cortes persistido en KV
GET /health                → estado del Worker + KV
GET /debug?url=...         → dump crudo de un endpoint ONPE (diagnóstico anti-bot)
```

**DNIs de candidatos (matching robusto, no por nombre):**
- Keiko Sofía Fujimori Higuchi (Fuerza Popular): `10001088` → key `fuji`
- Roberto Helbert Sánchez Palomino (Juntos por el Perú): `16002918` → key `sanch`

---

## Problema crítico resuelto: bloqueo anti-bot de ONPE

**Síntoma:** el Worker recibía HTML del SPA Angular (`<!doctype html>...ONPE - PRESENTACIÓN
DE RESULTADOS`) en vez de JSON, con status 200. ONPE está detrás de CloudFront + Cloudflare
y bloquea requests que no parezcan navegador real.

**Causa raíz:** los headers `Origin` y `X-Requested-With: XMLHttpRequest` activaban el bloqueo.

**Solución:** replicar exactamente los headers del Worker de primera vuelta (que funcionaba):
- `Accept: */*` (NO `application/json`)
- `Accept-Language`, `Content-Type: application/json`, `Referer` al dominio de 2da vuelta,
  `User-Agent` de Chrome real, `sec-fetch-*`
- **NO** incluir `Origin` ni `X-Requested-With`
- Usar `cf: { cacheTtl: 90, cacheEverything: true }` en el fetch

**Aprendizaje clave:** ante un bloqueo anti-bot de ONPE, el Worker viejo es la fuente de
verdad de qué headers funcionan. No reinventar — replicar.

---

## Diferencias vs primera vuelta (frontend)

| Aspecto | 1ra vuelta | 2da vuelta |
|---|---|---|
| Candidatos | 5 (top) | 2 (Keiko, Sánchez) |
| Lógica de pase | Probabilidad 2da vuelta, brecha 2°vs3° | Margen directo + línea de mayoría 50% |
| Parsing | Por DNI (5 candidatos) | Por DNI (2 candidatos) |
| Diseño | Dashboard oscuro estándar | Editorial / data-journalism (Newsreader serif) |
| Patrón fetch | half=1 / half=2 (2 Workers) | half=1 / half=2 (1 Worker, conservado) |

---

## Diseño visual

- Generado con Claude Design a partir de la estructura funcional.
- Estilo: editorial/broadsheet nocturno. Tipografía serif (Newsreader) para titulares,
  mono (DM Mono) para cifras, sans (DM Sans) para cuerpo.
- Paleta candidatos: Keiko naranja `#E8943A`, Sánchez verde `#2ECDA7`.
- Claude Design respetó todos los `id` y la lógica JS — no rompió el wiring.

### Bugs de diseño corregidos post-rediseño
1. **Móvil — panel head-to-head solapado:** el `.duel-grid` mantenía `1fr auto 1fr`
   en todos los anchos. En ≤620px los dos % gigantes se encimaban. Fix: media query
   que apila en columna única (Keiko arriba, Sánchez abajo, alineados a la izquierda).
2. **Tooltip del gráfico congelado:** al pasar sobre las líneas de proyección (punteadas `→`),
   el tooltip se disparaba vacío y quedaba pegado. Fix: el `title` solo se genera si hay
   un punto de serie real bajo el cursor.
3. **Eje X llegaba a 105%:** corregido a 100% (conteo completo).

---

## Voto en el exterior por continente (junio 2026)

Sección nueva en el scroll, **después del mapa de Perú** (no es una pestaña — el v3 nunca
tuvo pestañas, siempre fue scroll único).

- **Worker:** ruta dedicada `/api/exterior` (Opción A: endpoint dedicado, no un Worker nuevo).
  Itera los 5 continentes en 5 subrequests. Devuelve `{ continents:[...], total:{...} }`.
- **Frontend:** planisferio D3 con `geoNaturalEarth1` + `world-atlas@2/countries-110m.json`
  (CDN jsdelivr, mismo patrón que el mapa de Perú). Los países se colorean por el dato de
  su continente vía tabla `CONT_GROUPS` (ISO 3166-1 numérico → continente).
- **Coloreo:** toggle **Ganador / Margen** (no "% escrutado" — el exterior está al 100%,
  el % de actas no aportaría nada). "Margen" modula la opacidad del color del ganador
  según la diferencia.
- **Lazy-load:** `IntersectionObserver` dispara el único fetch cuando la sección entra
  en viewport; el nacional sigue renderizando inmediato.
- Transcontinentales (Rusia, Turquía, Indonesia, Chipre) = decisión editorial en la tabla,
  editable.

---

## Toggle de ausentismo (junio 2026)

Toggle **Ganador / Ausentismo** sobre el **mismo mapa de Perú** (no es sección nueva).

- **Dato:** `participacionCiudadana` del `/totales` (capturado por el Worker como `participacion`,
  nacional y por región). Ausentismo = `100 − participacion`. Distinto de blancos+nulos:
  esos votaron, el ausentismo es quien no fue a votar.
- **Coloreo:** en modo ausentismo las regiones usan una escala secuencial violeta
  (`#A78BFA`, opacidad escalada sobre el rango real del corte) — violeta a propósito
  para no competir con el naranja de Keiko ni el verde de Sánchez.
- El kicker cambia a "Ausentismo por departamento", muestra el ausentismo nacional, y la
  leyenda pasa a un gradiente con mín/máx. El tooltip muestra ausentismo + participación.
- **Refactor:** la lógica de fill se centralizó en `peruFill()` / `peruTooltip()` / `paintPeru()`,
  reutilizadas por `renderMap` y `updateMapColors` (antes estaba duplicada).

---

## Mapa de features por repo / archivo

Para no volver a construir sobre supuestos: cada evento electoral tiene su propio repo, y las
features NO se comparten entre ellos. Estado real:

| Feature | 1ra vuelta (`Peru_Elecciones_2026_v2`) | 2da vuelta (`Peru_Elecciones_2026_2da`) |
|---|---|---|
| Layout | 3 pestañas (`switchTab`) | 2 pestañas: Nacional / Voto en el extranjero (`switchTab`) |
| Pestaña ONPE en vivo | ✅ | ✅ (pestaña "Resultados nacionales") |
| Pestaña Datum CR 100% | ✅ | — |
| Pestaña Irregularidades (mesas API nacional sin respaldo regional) | ✅ | — |
| Mapa de Perú por departamento | ✅ | ✅ |
| Toggle Ganador / Ausentismo | — | ✅ |
| Voto exterior (planisferio por continente) | — | ✅ (pestaña dedicada) |
| Panel "Matemática del desenlace" (estimador JEE) | — | ✅ |
| Gráfico: toggle Carrera / Margen | — | ✅ |
| Modelo de proyección | damping dinámico (5 candidatos) | margen directo + línea 50% |

> **Corrección histórica (junio 2026):** una versión anterior de este changelog afirmaba
> que la 2da vuelta era "scroll único, sin pestañas". **Eso ya no es cierto.** Producción
> (`origin/main`) incorporó navegación por pestañas (Nacional / Voto en el extranjero)
> y el exterior pasó a cargar al hacer clic en su pestaña (antes era `IntersectionObserver`).
> Lección reforzada: el changelog debe vivir **dentro del repo** y commitearse junto al
> código que describe, para no volver a divergir de la realidad.

**Las "pestañas de mesas 900" viven en 1ra vuelta** (pestaña Irregularidades), no en 2da.
Si en el futuro se quieren en 2da, es trabajo nuevo, no una restauración.

---

## Matemática del desenlace (junio 2026)

Con el conteo "rápido" terminado (~98.3% de actas) y un margen de ~0.02pp / ~4,290 votos,
la elección dejó de definirse por "quién va ganando" y pasó a depender de las ~1,550 actas
observadas/en JEE. Se construyó el paquete F1–F4 para responder, con matemática auditable,
si el resultado puede revertirse. Implementado en Claude Code, validado en vivo contra el
Worker real (`127.0.0.1:5500`).

### F1 — Votos reales, no derivados de porcentajes
`renderDuel()` ahora usa `candidates.fujiVotos` / `sanchVotos` del Worker en vez de
`vv × porcentaje/100`. Motivo: con ~18M VV, el redondeo a 3 decimales de ONPE introduce
un error de hasta ±300 votos — mayor que el margen real. El cálculo derivado daba ~3,600
votos de margen; el real era 4,290. Fallback al derivado solo si los votos vienen en 0.

### F2 — Panel "La matemática del desenlace"
Sección entre el hero y la franja de actas. Función pura `computeDesenlace(national, regions)`:
- `pool` = Σ (actas pendientes por región × VV promedio por acta) → cota superior de votos en juego
- `shareReq` = `0.5 + |M| / (2 × pool)` → share de pendientes que el 2.º necesita para revertir
- `irreversible` = `|M| > pool`
- Escenario base: pendientes votan como su región (`Σ pool_r × lean_r`)

La bolsa es **cota superior deliberada**: las actas observadas suelen terminar con votos
anulados, así que la irreversibilidad declarada nunca sobreestima. El número estrella es
el share requerido (auditable, una fórmula y dos insumos públicos), no la proyección.
Validado en vivo: 1,557 actas pendientes, bolsa ~295K, Sánchez necesita 50.73% de los
pendientes; escenario base Fujimori +42,209 (878 de las actas pendientes están en Lima).

### F3 — Banner de irreversibilidad, no umbral de 99%
Se reemplazó la lógica `pct >= 99 → "Presidenta electa"` por tres estados basados en
`computeDesenlace`: irreversible (color del líder), no definido (ámbar `--c-amber: #D9A441`),
o conteo al 100%. **Nunca usa "electa/electo"** — ONPE cuenta, el JNE proclama; los tres
estados cierran con esa referencia. Decisión de gestión de riesgo reputacional: declarar
ganador al 99% con ~1,000 votos de margen, en un clima de impugnaciones y pedido de
reconteo, era insostenible.

### F4 — Gráfico modo Margen + corte fino del Worker
- **Frontend:** toggle Carrera/Margen (selector scoped a `.chart-toggle` para no repetir
  el bug de scoping de toggles). Modo Margen: serie única `keiko − sanch` centrada en 0,
  área teñida por quien domina, marcas en los cambios de líder (detectó 2 en 94 cortes),
  eje Y autoescalado al rango real.
- **Worker (`saveTrackingCut`):** antes solo guardaba cortes con avance > +0.35pct, dejando
  el KV ciego en la fase final (el conteo avanza en centésimas). Ahora guarda también por
  flip de signo del margen o cada 30 min con avance; cada corte nuevo lleva votos absolutos
  (`kv`/`sv`). **Pendiente de deploy** por dashboard de Cloudflare — hasta entonces el KV
  usa la lógica vieja y los votos absolutos solo aparecerán en cortes post-deploy.

---

## Pestaña Proyección — modelo de actas JEE (junio 2026)

Tercera pestaña ("Proyección", entre "Resultados nacionales" y "Voto en el extranjero").
Modelo **propio**, no cifras de ONPE — rotulado como estimación independiente. Proyecta el
resultado final estimando cómo se resolverán las ~1,550 actas pendientes/observadas. Corre
con los `REGIONS`/`NATIONAL` ya cargados; **no agrega requests** al Worker.

### Método (funciones puras)
- `projectFinal(regions, national, anulRate)`: por región con pendientes,
  `votosNetos_r = pend_r × vpa_r × (1 − anulRate)`, repartidos por el `% regional actual`
  (`addFuji_r`, `addSanch_r`). Suma a los votos reales nacionales → `pctFuji/pctSanch`,
  `marginFinal` (con signo). Guardas: sin división por cero (`finalVV=0`, `pend=0`);
  `contabilizadas_r=0` usa `vpaNacional` de fallback.
- `projectBand(...)`: corre `projectFinal` con anulación 0% (optimista), slider (base),
  20% (pesimista). La incertidumbre es el mensaje: el resultado se presenta como **banda**,
  no como punto. `cruzaCero` = un escenario invierte el ganador.
- `computeSensitivity()`: margen final para cada tasa 0–20%; detecta el **punto de vuelco**
  (tasa interpolada a la que el margen cruza 0).

### Supuesto clave — tasa de anulación
Las actas observadas no se cuentan tal cual: el JEE valida, corrige o anula votos. No hay
tasa oficial publicada → va como **slider** (`min=0 max=20 step=1`, default 8%). Ref. histórica
rotulada: 1ra vuelta 2026, ~5,000 actas en JEE ≈ ~120 votos netos por acta (las observadas
rinden menos que el VV promedio). El slider recalcula panel, banda, tabla, gráfico e insights
en vivo (`onAnulSlider`).

### UI
- Disclaimer ámbar visible sin scroll: "No son cifras oficiales de ONPE… el JNE proclama;
  este modelo no declara ganadores".
- Panel de dos cifras grandes (escenario base) + banda de margen (en ámbar si cruza 0).
- Tabla por región con pendientes (reusa lenguaje de `region-grid`): actas pendientes,
  VV est. en juego, tendencia, mini-barra bicolor de aporte neto. Lima resaltada (domina la bolsa).
- **Gráfico de sensibilidad** (Chart.js line): margen final (votos, con signo) vs % anulación;
  línea de cero, marcador del punto de vuelco si cruza. Cuidado del canvas oculto: se recrea
  vía `requestAnimationFrame` cuando la pestaña se hace visible (mismo patrón que el planisferio).
- **Insights automáticos** calculados en vivo: concentración geográfica, sensibilidad
  (estable vs invierte), aritmética (`shareReq` de F2) vs geografía, aporte del exterior.

### Decisiones (no reabrir)
- NO usa ausentismo: las actas pendientes solo contienen votos ya emitidos; la variable
  correcta es VV por acta (`vpa`).
- NO titula "ganador proyectado" ni "electo"; siempre banda, nunca punto único.
- La tasa de anulación es supuesto editable, nunca presentada como dato oficial.

### Verificación
- Smoke test (Node, funciones extraídas): `marginFinal@0 ≥ marginFinal@20` (más anulación =
  menos votos netos = margen se encoge); sin NaN con `pend=0`/`contabilizadas=0`/`finalVV=0`;
  banda calibrada con cruce → `cruzaCero=true`.
- Live contra el Worker real (12 jun, 98.3%): base 8% → Fujimori 50.11% / Sánchez 49.89%,
  banda +34,661…+42,197 a favor de Fujimori (no cruza), 25 regiones en tabla, gráfico 21
  puntos, 3 insights vivos (Lima concentra 62% de las pendientes, +27pp pro-Keiko).
  Responsive ≤620px: panel y tabla apilan, disclaimer visible sin scroll. Toggles existentes
  (mapa Perú, planisferio, Carrera/Margen) intactos.

---

## Estado final

Dashboard funcional de punta a punta: GitHub Pages → Worker → ONPE.
- Datos en vivo cada 3 min (al momento de esta actualización: ~98.3% de actas contabilizadas,
  margen ~4,290 votos / ~0.02pp, ~1,550 actas en JEE). Ver dashboard live para cifras actuales.
- 3 pestañas: "Resultados nacionales", "Proyección" y "Voto en el extranjero" (`switchTab`)
- Mapa coroplético por departamento (TopoJSON CDN datamaps, objeto `per`) con toggle Ganador/Ausentismo
- Panel "La matemática del desenlace": estimador de actas JEE y share requerido para revertir
- Pestaña "Proyección": modelo propio de actas JEE con slider de anulación, banda, tabla,
  gráfico de sensibilidad e insights (estimación independiente, no oficial)
- Planisferio del voto exterior por continente (world-atlas, geoNaturalEarth1) con toggle Ganador/Margen
- Gráfico de evolución con toggle Carrera/Margen y proyección
- Lista de 26 regiones
- Responsive desktop + móvil

**Versión vigente del frontend:** `index.html` del repo `Peru_Elecciones_2026_2da`
(3 pestañas + mapa Perú con ausentismo + matemática del desenlace + proyección + voto exterior).

**CSS durmiente:** el commit `1e54102` agregó estilos de un overlay a pantalla completa
del planisferio (`.map-overlay`, sin Fullscreen API nativo — lección de iOS Safari aplicada),
pero el detonante (botón "ampliar") quedó sin cablear. No estorba; terminar es trabajo nuevo.

---

## Pendientes / On the horizon

- **Full screen del planisferio:** el CSS existe (`1e54102`) pero falta cablear el botón
  que abre el overlay y reproyectar el SVG al tamaño del overlay. CSS durmiente.
- **Drill-down por país** en el exterior: on-demand al hacer clic en un continente
  (evita el límite de 50 subrequests del free-tier; requiere capturar el endpoint de país
  en DevTools y mapear país → ubigeo ONPE).
- **Verificador de consistencia** nacional-vs-regional adaptado a 2 candidatos.
- **Deploy del Worker F4:** subir `worker.js` (cortes por flip de signo + votos absolutos)
  por el dashboard de Cloudflare; hasta entonces el KV usa la lógica vieja.
- Cada uno en conversaciones separadas dentro del Project.
