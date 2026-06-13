# CLAUDE.md

## Proyecto

Dashboard electoral de la segunda vuelta — Perú 2026. Vanilla JS/HTML, sin frameworks. Se publica en GitHub Pages.

## Arquitectura

- `index.html` es el único frontend. Todo el dashboard vive ahí.
- `worker.js` es un Cloudflare Worker (`onpe-proxy-sv`) que se despliega **manualmente por dashboard de Cloudflare** — nunca intentes desplegarlo.
- `changelog_segunda_vuelta.md` es la **fuente de verdad del estado técnico**: léelo antes de asumir qué features existen.

## Features actuales

- **Dos pestañas** (`switchTab`): "Resultados nacionales" y "Voto en el extranjero".
- **Mapa de Perú** con toggle Ganador / Ausentismo (`setPeruMode`, `peruFill`).
- **Panel "La matemática del desenlace"** (`computeDesenlace`): estima si el resultado puede voltearse — bolsa de votos pendientes, share requerido del 2.º, irreversibilidad.
- **Planisferio del exterior** con toggle Ganador / Margen (`loadExterior`, `renderWorldMap`).
- **Gráfico de evolución** con toggle Carrera / Margen.

## Diseño

- Paleta: Keiko `#E8943A`, Sánchez `#2ECDA7`.
- Tipografías: Newsreader / DM Mono / DM Sans.

## Convenciones

- Commits atómicos por feature, mensajes en español.
- Diffs quirúrgicos: tocar solo lo necesario.

## Validación local

- Live Server en `127.0.0.1:5500` (origen ya permitido en el CORS del Worker).
