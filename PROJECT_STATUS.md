# AK Studio — estado y guía de continuidad

Actualizado: 22 de septiembre de 2026 (sticky playhead + D1 project autosave 24h)

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


### Editor UX (sep 2026)

- Preview canvas locked to true **16:9 / 9:16 / 1:1** via `aspect-ratio` + container-query contain math (centered in `.stage-wrap`; no stretched full-bleed 16:9).
- Timeline track headers are **icons only** (Captions / Music / Mic) with `title` + `aria-label`; left gutter tightened (~52px).
- Waveform tracks set explicit `width`/`minWidth` to match lyric track zoom span so peaks fill the full clip.
- Studio shell: `html/body:has(.ak-shell)` + `.ak-shell` use `100dvh` + `overflow:hidden` (no page scrollbars); inner lyrics/inspector/track-canvas scroll without chrome.


### Timeline playhead scrub (22 sep 2026)

- **Sticky scrub fixed** in `app/studio.tsx`: playhead/timeline/transport scrub starts only on `pointerdown` (not hover).
- While dragging: `setPointerCapture` on the scrub surface; move tracked via window `pointermove`.
- Drag ends immediately on window `pointerup` / `pointercancel` / `mouseup`, element `lostpointercapture`, window `blur`, or unmount — `endScrub()` clears listeners and releases capture (safe if already released).
- Nested `time-ruler` duplicate handler removed so one drag session cannot leave orphan move listeners.
- Click-to-seek on the timeline remains one-shot (seek on down, stop on up).



### Project persistence (22 sep 2026)

- D1 `projects` stores studio drafts in `timeline_json` with `expires_at` (~24h, aligned with R2 temp audio).
- API: `GET/PUT /api/projects`, `GET/DELETE /api/projects/[id]`.
- Free plan: **one** autosaved draft — each save overwrites that slot; shown under **Saved** in the studio sidebar.
- Pro: upsert/create drafts with the same 24h TTL.
- On `/studio` load, the latest non-expired draft is restored and audio is rehydrated via `/api/audio/{id}` + client cache.
- Migration: `drizzle/0005_project_expires.sql` (adds `expires_at`, drops unique name index).


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

### Pagos y suscripciones

- Stripe Checkout abre correctamente el plan AK Studio Pro de USD 13 al mes.
- El producto, precio y webhook de Stripe están configurados en el entorno de prueba.
- Los secretos de Stripe están guardados como secretos cifrados del Worker; no están en Git.
- El webhook verifica la firma de Stripe y sincroniza altas, cambios y cancelaciones con D1.
- Checkout adjunta el ID interno del usuario tanto a la sesión como a la suscripción.
- Falta verificar la empresa en Stripe y repetir producto, precio, webhook y claves en modo Live antes de aceptar dinero real.

### Procesador multimedia

- Existe un servicio Python preparado en `processor/server.py`.
- Existe la entrada de Cloudflare Containers en `processor/worker.ts`.
- El flujo contempla descarga autorizada, FLAC, BPM y separación en `lead` y `backing + instrumental`.
- El modelo abierto elegido en la arquitectura es BS-RoFormer.
- La API web puede enviar un trabajo al procesador y copiar sus resultados temporales a R2.

## Qué todavía no está terminado

Estas funciones no deben anunciarse como operativas en producción hasta completar sus dependencias:

1. **Separación de stems (GPU).** Create karaoke ya descarga el **full mix** a R2 y lo pone en la timeline para Play sin GPU. La separación lead/backing con BS-RoFormer sigue pendiente de `GPU_PROCESSOR_URL` + `PROCESSOR_WEBHOOK_SECRET`.
2. **Exportación de vídeo.** El botón y la interfaz existen, pero falta el render final con FFmpeg, la marca de agua del plan Free y la descarga del archivo terminado.
3. **Stripe Live.** El flujo completo funciona en modo prueba. Para aceptar dinero real falta verificar la empresa y configurar las credenciales, producto/precio y webhook equivalentes en modo Live.
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
4. Completar la verificación de Stripe y promover la integración probada a modo Live.
5. Añadir dominio personalizado, rate limiting, observabilidad y alertas.
6. Activar despliegues automáticos desde GitHub y añadir una prueba end-to-end del flujo principal.

## Archivos clave

- `app/page.tsx`: landing pública.
- `app/studio.tsx`: editor principal.
- `app/studio/page.tsx`: protección y carga del editor.
- `app/api/analyze/route.ts`: metadatos y letras.
- `app/api/audio/route.ts`: orquestación del procesador y guardado en R2.
- `app/api/billing/checkout/route.ts`: creación del checkout de Stripe.
- `app/api/billing/webhook/route.ts`: verificación de firma y sincronización de suscripciones con D1.
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

## Mobile + landing + auth navigation (21 Sep 2026)

1. **Studio mobile edge-to-edge** — `.ak-shell` drops horizontal gutters under 720px (safe-area only on topbar/source/timeline). Stage wrap is full-bleed black (`padding:0`); 16:9 uses available width. Source bar stacks full-width (link → permission → Create). Under ~640px, Export / Split / Delete / Create / aspect / Add line are **icon-only** via `.btn-label` + `aria-label`/`title`. Keeps `100dvh` + no page scroll.
2. **Landing** — Signed-in users hitting `/` **server-redirect to `/studio`**. Copy tightened (shorter hero/story/features/plans). Typography showcase is **3 faces only** (`Bebas Neue`, `Playfair Display`, `Space Mono`) cycling one-at-a-time in `components/type-cycle.tsx` (~3.2s, respects reduced motion). Process strip is icon-led.
3. **Auth nav** — Studio wordmark → `/studio`; account back link → `/studio` (label “Studio”); sign-out still → `/`. Landing remains the signed-out home.

Files: `app/page.tsx`, `app/studio.tsx`, `app/globals.css`, `app/account/panel.tsx`, `components/type-cycle.tsx`, `PROJECT_STATUS.md`.

**Verify:** phone Safari `/studio` — no side page margins, stage uses width, icon toolbar; `/` while logged in → `/studio`; account Back → studio. Ignore known `tsc` processor noise.

## Responsive pass (21 Sep 2026)

Product-wide layout pass on existing breakpoints (no parallel system):

- **Breakpoints:** landing stack/nav at `1100` / `640` / `430`; studio at existing `1050` / `720` plus `480` stack; account/sign-in at `900` / `650` (plan grid single column earlier).
- **Landing:** softer hero columns (no `600px` mock min), fluid headlines, mid-width (`~1100–1280`) mock simplification, phone stage-only mock (timeline/inspector hidden), compact `details` nav menu.
- **Studio:** source bar wraps on phone; lyrics+preview stack under `480`; touch targets ~44px; timeline playhead hit areas from prior pass preserved.
- **Account / sign-in:** plan cards stack by `900`; sign-in brand column stacks above form; fluid titles and 44px controls.

Files: `app/globals.css`, `app/page.tsx`, `PROJECT_STATUS.md`.

**Verify:** resize `/` at 1280 → 1024 → 768 → 430; `/studio` (or mock shell) at same widths for topbar/source/timeline scrub; `/account` and `/signin` for single-column stack. Ignore known `tsc` processor/worker noise.


## Timeline waveforms (21 Sep 2026)

Replaced the decorative 124-bar stub in `app/studio.tsx` with real peaks:

1. **`lib/audio-peaks.ts`** — `fetch` + `AudioContext.decodeAudioData` → `getChannelData` max-abs peaks, normalized 0–1; `resamplePeaks` for display density.
2. **`components/waveform-track.tsx`** — ResizeObserver bar count so width tracks clip/timeline scale (same `minWidth` zoom formula as lyric track); empty skeleton when peaks missing (no fake song pattern).
3. **Backing + lead vocal** both decode from their stem `blob:`/`audio` URLs after `/api/audio` succeeds.
4. **CSS** — `.wave-track` bars flex across full track width; `.wave-empty` thin baseline only.

**Note:** If `/api/audio` returns 503 (GPU processor down), peaks cannot be computed — tracks stay empty/skeleton for the full clip length. When stems load, waveforms fill 0→duration.

**Verify:** create karaoke with working audio → backing/vocal waveforms span full timeline (match lyric span); zoom changes density/width; mute still dims tracks. Ignore known `tsc` processor/worker noise.

Files: `lib/audio-peaks.ts`, `components/waveform-track.tsx`, `app/studio.tsx`, `app/globals.css`, `PROJECT_STATUS.md`.

## Create karaoke audio download (22 Sep 2026)

Bypasses the GPU processor for basic playback:

1. **Permission checkbox removed** — Create karaoke enables when a valid YouTube / YouTube Music link is present (Free weekly limit unchanged).
2. **`POST /api/audio`** — If GPU secrets are set → existing stem path. Otherwise **full-mix download** via YouTube VISIONOS Innertube (+ optional `COBALT_API_URL` fallback), streamed as **NDJSON** progress events, stored once in R2 (`audio/{id}-original.{ext}`, `mode=full`).
3. **`GET /api/audio/[id]`** — Multi-format (`m4a`/`mp4`/`webm`/`mp3`/`ogg`/`flac`); `stem=backing|lead` falls back to original when `mode=full`.
4. **Client** — After lyrics, shows English **"Downloading song"** with **0–100%** bar (progress from download bytes / Content-Length, mapped through store). Sets `backingSrc` from `/api/audio/{id}?stem=backing` (cached blob URL); Play enabled when ready. Vocal track left empty in full-mix mode.

**Progress %:** handshake ~0–8, body bytes → 8–100 (`received/contentLength`), then brief store finish at 100 in the NDJSON `ready` event.

**Blockers / risks:** YouTube may bot-block some Cloudflare egress IPs (error surfaces in UI). Optional `COBALT_API_URL` / `COBALT_API_KEY` or GPU processor remain fallthrough. Stem separation still not live without GPU.

Files: `lib/youtube-download.ts`, `app/api/audio/route.ts`, `app/api/audio/[id]/route.ts`, `app/studio.tsx`, `app/globals.css`, `lib/audio-cache.ts`, `app/api/analyze/route.ts`, `cloudflare-env.d.ts`, `.dev.vars.example`, `PROJECT_STATUS.md`.


## Create karaoke audio download reliability (22 Sep 2026)

### Progress UI
- Removed the fleeting full-screen processing modal.
- **Create karaoke** progress is an **inline fill** on the source bar (background grows 0→100% under the link + button).
- Status text: “Downloading song” + optional %.
- Fill stays until success (brief complete) or a clear error.

### Download strategy (Worker → R2 full mix)
Order for full-mix playback (no stem separation required):
1. **Cobalt** — if `COBALT_API_URL` (optional `COBALT_API_KEY`) is set
2. **Processor yt-dlp** — `POST {GPU_PROCESSOR_URL}/download` (yt-dlp only, no GPU separation)
3. **YouTube Innertube** — last resort from the Worker (often bot-blocked on Cloudflare egress)

If `GPU_PROCESSOR_URL` + `PROCESSOR_WEBHOOK_SECRET` are set, Create karaoke still *tries* full stem separation first; on failure it **falls back** to the full-mix chain above so Play is not blocked.

User-facing errors never say “Sign in to confirm you’re not a robot” (that is YouTube bot-check copy, not AK Studio auth).

### Secrets Josan must set (Wrangler / Cloudflare dashboard)

```bash
# Recommended for production audio download (self-hosted Cobalt):
npx wrangler secret put COBALT_API_URL
npx wrangler secret put COBALT_API_KEY   # if your Cobalt instance requires it

# Recommended: processor with yt-dlp (full mix without stem GPU):
npx wrangler secret put GPU_PROCESSOR_URL      # e.g. https://ak-studio-audio-processor.<account>.workers.dev
npx wrangler secret put PROCESSOR_WEBHOOK_SECRET
```

Self-hosted Cobalt is preferred over random public instances (ToS / reliability). Public Cobalt hosts often require JWT and are not hardcoded.

### Play button
- Enabled only when `backingSrc` is set (blob URL from `/api/audio/{id}?stem=backing` after R2 store).
- Full-mix mode stores `original` once; GET serves it for `stem=backing`.

### Files
`lib/youtube-download.ts`, `app/api/audio/route.ts`, `app/api/audio/[id]/route.ts`, `app/studio.tsx`, `app/globals.css`, `processor/server.py`, `processor/worker.ts`, `.dev.vars.example`, `PROJECT_STATUS.md`
