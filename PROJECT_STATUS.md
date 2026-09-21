# AK Studio — estado y guía de continuidad

Actualizado: 21 de septiembre de 2026 (responsive pass across landing/studio/account/signin)

## Ubicaciones

- Proyecto local: `/Users/josanestrellaflores/Documents/Codex/2026-09-20/sites-plugin-sites-openai-curated-remote`
- Producción: `https://ak-studio.josanager.workers.dev`
- Repositorio: `https://github.com/josanager/AK-Studio.git`
- Rama de producción: `main`
- Último commit de esta entrega: `d6a2d42`

## Qué está implementado

### Producto e interfaz

- Landing pública responsive en `/`, en inglés y con diseño monocromático.
- Landing enriquecida: hero mock de editor más completo, secciones de valor (pegar enlace, separación de voces), showcase tipográfico visual, y motion/blur scoped solo a `.landing` (no afecta `/studio`).
- Editor protegido en `/studio`.
- Canvas vacío al abrir un proyecto nuevo.
- Canvas responsive conectado a la letra seleccionada y al cabezal de reproducción.
- Línea de tiempo con cabezal arrastrable, clips de letra movibles y ajuste magnético.
- Marcadores visuales de BPM, zoom y controles de reproducción.
- Edición de texto, tipografía, tamaño, alineación, color, posición y relación de aspecto.
- Reproducción y mezcla de pistas preparadas cuando el backend entrega audio.
- Páginas de inicio de sesión y cuenta.
- Planes Free y Pro visibles en la cuenta y en la landing.

### Usuarios y datos

- Google OAuth conectado mediante Better Auth.
- D1 preparado para usuarios, sesiones, cuentas OAuth, suscripciones, uso semanal, trabajos y colecciones de tipografías.
- El plan Free está limitado en backend a un karaoke por semana.
- Las cuentas solo conservan colecciones de tipografías; no guardan proyectos, vídeos ni audios permanentemente.

### Análisis de enlaces

- Acepta enlaces públicos de YouTube y YouTube Music.
- Extrae título, artista y miniatura mediante metadatos públicos.
- Busca letras en LRCLIB.
- Convierte letras sincronizadas LRC en clips editables sobre la línea de tiempo.
- Si solo existe letra sin tiempo, crea una sincronización inicial uniforme para edición manual.

### Cloudflare

- Worker de producción desplegado como `ak-studio`.
- D1 enlazado como `DB`.
- R2 enlazado como `TEMP_BUCKET`.
- Queue enlazada como `PROCESSING_QUEUE`.
- R2 está planteado para conservar audio temporal durante 24 horas.
- La web se despliega directamente con Wrangler y también está sincronizada con GitHub.

### Procesador multimedia

- Existe un servicio Python preparado en `processor/server.py`.
- Existe la entrada de Cloudflare Containers en `processor/worker.ts`.
- El flujo contempla descarga autorizada, FLAC, BPM y separación en `lead` y `backing + instrumental`.
- El modelo abierto elegido en la arquitectura es BS-RoFormer.
- La API web puede enviar un trabajo al procesador y copiar sus resultados temporales a R2.

## Qué todavía no está terminado

Estas funciones no deben anunciarse como operativas en producción hasta completar sus dependencias:

1. **Procesamiento real de audio.** El procesador GPU/contenedor todavía debe desplegarse y conectarse mediante `GPU_PROCESSOR_URL` y `PROCESSOR_WEBHOOK_SECRET`. Por esto, pegar un enlace ya detecta metadatos y letra, pero todavía no descarga ni separa la canción en el sitio público.
2. **Exportación de vídeo.** El botón y la interfaz existen, pero falta el render final con FFmpeg, la marca de agua del plan Free y la descarga del archivo terminado.
3. **Stripe en producción.** Checkout está preparado, pero faltan producto, precio, secretos, webhook verificado y actualización automática del plan en D1.
4. **Separación premium.** BS-RoFormer está previsto para Free; Moises.ai o Music.ai siguen pendientes de proveedor y clave para Pro.
5. **Dominio personalizado.** La aplicación continúa usando `workers.dev`.
6. **Operación a escala.** Faltan rate limiting, monitorización de errores, alertas de gasto, reintentos de trabajos y pruebas de carga.
7. **CI/CD de Cloudflare desde GitHub.** El repositorio está actualizado, pero el despliegue actual se hizo con Wrangler. Se puede conectar Workers Builds para desplegar automáticamente cada push a `main`.

## Cómo ejecutar localmente

Requiere Node.js 22.13 o posterior.

```bash
cd /Users/josanestrellaflores/Documents/Codex/2026-09-20/sites-plugin-sites-openai-curated-remote
npm ci
npm run dev
```

La vista local normalmente estará en `http://localhost:5173`.

## Cómo verificar

```bash
npx tsc --noEmit
npm run build:cloudflare
```

Comprobaciones manuales mínimas:

1. Abrir `/` sin sesión y confirmar que la landing es pública.
2. Pulsar `Start free` y comprobar Google OAuth.
3. Confirmar que `/studio` exige sesión.
4. Pegar un enlace autorizado y comprobar título, artista y letras.
5. Revisar `/account`, el contador semanal y las colecciones de tipografías.
6. Probar escritorio y móvil antes de desplegar.

## Cómo desplegar la web

```bash
npm run deploy:cloudflare
```

Para aplicar migraciones nuevas a producción:

```bash
npm run db:migrate:cloudflare
```

No guardar secretos en Git. Se añaden mediante Wrangler o el panel de Cloudflare.

## Próxima fase recomendada

El orden más seguro para convertir el prototipo funcional en producto vendible es:

1. Desplegar el procesador multimedia y comprobar descarga, BPM y stems con un archivo autorizado.
2. Conectar el procesador a Worker/R2 y verificar borrado efectivo a las 24 horas.
3. Implementar render de vídeo y exportación Free con marca de agua.
4. Configurar Stripe y su webhook; después habilitar el plan Pro.
5. Añadir dominio personalizado, rate limiting, observabilidad y alertas.
6. Activar despliegues automáticos desde GitHub y añadir una prueba end-to-end del flujo principal.

## Archivos clave

- `app/page.tsx`: landing pública.
- `app/studio.tsx`: editor principal.
- `app/studio/page.tsx`: protección y carga del editor.
- `app/api/analyze/route.ts`: metadatos y letras.
- `app/api/audio/route.ts`: orquestación del procesador y guardado en R2.
- `app/api/billing/checkout/route.ts`: creación del checkout de Stripe.
- `lib/auth.ts`: Better Auth y Google OAuth.
- `lib/plans.ts`: planes y límite semanal.
- `db/schema.ts`: esquema persistente de D1.
- `processor/server.py`: descarga, BPM y separación.
- `wrangler.jsonc`: recursos y configuración Cloudflare.
- `CLOUDFLARE.md`: arquitectura y despliegue de infraestructura.
- `PRODUCT.md`: alcance y reglas del producto.
- `DESIGN.md`: dirección visual.


## Editor UX pass (21 Sep 2026)

Completed in this pass (client + audio API path only):

1. **Timeline hit targets** — playhead, lyric clips, time ruler, track canvas, and transport scrub use larger pointer/touch targets and shared scrub handlers (`scrubToClientX` / `scrubFromPointer`).
2. **Responsive shell** — timeline stays taller on mid/small widths; track labels collapse on narrow screens without removing lyrics editing.
3. **Audio cache ~24h** — `lib/audio-cache.ts` stores stems in Cache Storage and plays via `blob:` URLs; R2 object + GET responses use `max-age=86400`; GET rejects/deletes stems older than 24h via `createdAt` metadata.
4. **Playback hardening** — play/pause syncs lead+backing stems, keeps drift under ~350ms, surfaces play failures in the notice banner.

### Still blocked / not done here

1. **GPU processor deploy** — `/api/audio` still needs `GPU_PROCESSOR_URL` + `PROCESSOR_WEBHOOK_SECRET`. Without them, analyze can return lyrics but stems stay unavailable (503).
2. **Video export / FFmpeg render** — export button remains a stub.
3. **Stripe production secrets** — checkout path not live.
4. **Mac local sync** — changes are in the GitHub checkout of `josanager/AK-Studio` on the agent box (`/workspace/AK-Studio`). The Mac path `/Users/josanestrellaflores/Documents/Codex/2026-09-20/sites-plugin-sites-openai-curated-remote` could not be edited: this subagent is box-scoped and `machineId` on Shell/Read is ignored. On the Mac, `git pull` (or copy these files) before verifying the UI.

## Responsive pass (21 Sep 2026)

Product-wide layout pass on existing breakpoints (no parallel system):

- **Breakpoints:** landing stack/nav at `1100` / `640` / `430`; studio at existing `1050` / `720` plus `480` stack; account/sign-in at `900` / `650` (plan grid single column earlier).
- **Landing:** softer hero columns (no `600px` mock min), fluid headlines, mid-width (`~1100–1280`) mock simplification, phone stage-only mock (timeline/inspector hidden), compact `details` nav menu.
- **Studio:** source bar wraps on phone; lyrics+preview stack under `480`; touch targets ~44px; timeline playhead hit areas from prior pass preserved.
- **Account / sign-in:** plan cards stack by `900`; sign-in brand column stacks above form; fluid titles and 44px controls.

Files: `app/globals.css`, `app/page.tsx`, `PROJECT_STATUS.md`. No commit/push in this pass.

**Verify:** resize `/` at 1280 → 1024 → 768 → 430; `/studio` (or mock shell) at same widths for topbar/source/timeline scrub; `/account` and `/signin` for single-column stack. Ignore known `tsc` processor/worker noise.
