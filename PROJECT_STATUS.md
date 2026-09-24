# AK Studio — estado y guía de continuidad

Actualizado: 22 de septiembre de 2026 (handoff para la siguiente IA)

## Handoff para la siguiente IA (léeme primero)

Este documento es la hoja de ruta y el contexto operativo. Léelo antes de tocar código. El producto es **AK Studio**: editor web de karaoke desde enlaces de YouTube / YouTube Music. UI del producto en **inglés**; el usuario (Josan) habla en **español**.

### Objetivo del producto
1. Pegar enlace de YouTube Music → obtener letras sincronizadas + descargar audio.
2. Editar tipografía / aspecto / timeline.
3. (Opcional) Separar lead vocal vs backing con modelo open-source (BS-RoFormer / `audio-separator`).
4. Exportar vídeo karaoke **MP4** desde el navegador (calidad 4K/2K/1080, FPS 30/60).
5. Free: 1 karaoke/semana + 1 draft autosaved ~24h. Pro vía Stripe.

### Ubicaciones y deploy
| Qué | Valor |
|-----|--------|
| Repo | `https://github.com/josanager/AK-Studio.git` (`main`) |
| Prod | `https://ak-studio.josanager.workers.dev` |
| Mac local | `/Users/josanestrellaflores/Documents/Codex/2026-09-20/sites-plugin-sites-openai-curated-remote` |
| Box checkout (agentes) | `/workspace/AK-Studio` |
| Node | **≥ 22.13** (Mac: `PATH="/opt/homebrew/opt/node@22/bin:$PATH"`) |
| Deploy | En el Mac: `git pull github main && npm run deploy:cloudflare` (remote GitHub suele llamarse `github`) |
| Migraciones D1 | `npm run db:migrate:cloudflare` |
| Último commit handoff | `01f7c87` |

**Cloud Agents de Cursor no están en el plan** → trabajo en box + push + deploy Mac. No inventar menús de la app Grok Bot.

### Stack
Next/Vite (vinext) en Cloudflare Workers, D1, R2 (`TEMP_BUCKET`), Queue, Better Auth (Google), Stripe test, client export con **mediabunny** (WebCodecs) + MediaRecorder fallback.

### Secretos Cloudflare (Worker `ak-studio`)
Presentes (no están en Git): `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_*`, `STRIPE_*`, y a veces `GPU_PROCESSOR_URL` + `PROCESSOR_WEBHOOK_SECRET` (túnel temporal / processor).

Opcionales / recomendados para audio fiable:
- `GPU_PROCESSOR_URL` — base URL del processor (`/download`, `/process`, `/file/...`)
- `PROCESSOR_WEBHOOK_SECRET` — Bearer
- `COBALT_API_URL` (+ `COBALT_API_KEY` si aplica) — alternativa de descarga

Sin processor GPU real, **Create karaoke** puede bajar full-mix vía yt-dlp en un processor/túnel, pero **Separate lead vocal** falla con mensaje claro en inglés. YouTube bloquea Innertube desde IPs de Cloudflare Workers (no confundir con login de Google del usuario).

### Qué YA funciona (producción reciente)
- Auth Google; `/` redirige a `/studio` si hay sesión; logout → landing.
- Analyze: metadatos + LRCLIB lyrics.
- Create karaoke: descarga full-mix (progreso inline en la source bar), audio en timeline, Play.
- Timeline: playhead solo mientras se arrastra; Space play/pause; lyrics en `position:absolute` alineadas al playhead; waveforms a duración real del audio.
- Saved tab: autosave ~24h (Free = 1 draft); delete funciona.
- Separate lead vocal UI: menú sólido (sin click-through), timeline bloqueada con menú abierto, barra fill en waveform; API `POST /api/audio/separate`.
- Export: menú **Export video** (principal) + **Download audio**; chip canvas **4K|2K|1080** + **30|60**; progreso; descarga **solo si es MP4 real** (`ftyp`); retry 1080/30 si 4K falla.

### Qué NO está terminado / bloqueado (priorizar)
1. **Processor GPU permanente** con `audio-separator` / BS-RoFormer — sin esto Separate no produce stems. El túnel `trycloudflare` es frágil.
2. **Export vídeo pulido** — validar en Chrome/Safari/Firefox que el `.mp4` abre en QuickTime/VLC; mejorar fidelidad visual del stage; watermark Free opcional; 4K60 puede OOM.
3. **Stripe Live** — hoy es test mode.
4. Dominio custom, CI/CD Workers Builds, rate limits, observabilidad.
5. Separación Pro vía Moises/Music.ai (previsto, no cableado).

### Flujo mental del código
- `app/studio.tsx` — editor monolítico (UI + estado).
- `app/api/analyze/route.ts` — letras/metadatos.
- `app/api/audio/route.ts` — descarga full-mix / stems orquestación → R2.
- `app/api/audio/separate/route.ts` — separación bajo demanda.
- `app/api/audio/[id]/route.ts` — servir stems.
- `app/api/projects/*` — autosave D1.
- `lib/export-video.ts` — export cliente MP4.
- `lib/youtube-download.ts` / Cobalt / processor helpers.
- `processor/server.py` — yt-dlp + (si hay deps) separación.
- `lib/plans.ts` — Free 1 karaoke/semana (solo **Create**, no Export).

### Decisiones de producto (no revertir sin preguntar)
- UI inglés; sin checkbox “I have permission”.
- Lead vocal track **oculto** hasta separar.
- Export **no** es paywall.
- Canvas aspectos solo 16:9 / 9:16 / 1:1.
- Timeline headers = solo iconos.

### Cómo continuar (checklist)
1. `git pull` en Mac + box; Node 22.
2. Si Separate sigue fallando: desplegar processor GPU real y `wrangler secret put GPU_PROCESSOR_URL` / `PROCESSOR_WEBHOOK_SECRET`.
3. Probar Export video en Chrome: debe bajar `.mp4` con `ftyp`, no HTML.
4. No reintroducir stub “Video export is the next production step”.
5. Actualizar este archivo al cerrar cada entrega.

### Historial reciente (sep 2026) — commits útiles
- `4a8f5a3` — MP4 real (ftyp), no HTML
- `eea0829` — export progreso 0→100%, labels de estado
- `0be800d` — Export video + calidad/FPS
- `9f6d0a1` / `f764640` — Separate lead vocal + menú click-through
- `9045ac3` — lyrics timeline absolute
- `14ede06` — waveform full length, Space, delete Saved

---

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





## Fix: export downloaded HTML instead of MP4 (22 Sep 2026)

**Root cause:** Export “succeeded” and triggered a download without validating container bytes. Weak `<a download>` (raw Blob, no forced `.mp4` File/MIME) let browsers save error/HTML payloads or miss-extension files as `.html`. 4K WebCodecs failures fell straight to MediaRecorder without a 1080 retry.

**Fix:** After finalize, require MP4 `ftyp` within ~32 bytes (reject `<!DOCTYPE`/`<html`); `downloadBlob` uses `File` + `video/mp4` + forced `.mp4` (or `.webm` only when sniff says WebM); WebCodecs→retry 1080/30 once; success copy says `.mp4`.

Files: `lib/export-video.ts`, `app/studio.tsx`, `PROJECT_STATUS.md`.

## Fix: video export stuck at 0% + wrong status text (22 Sep 2026)

**Root cause (0%):** `lib/export-video.ts` encoded *all* mixed audio via mediabunny `AudioBufferSource` **before** any video frames, and only called `onProgress` inside the frame loop. Decode + full-song AAC encode could take a long time (or hang) with the UI frozen near 1%/“0%”. WebCodecs errors were also swallowed before MediaRecorder fallback, and there were no timeouts on encoder start / audio decode.

**Root cause (wrong label):** Export, Separate, and Create karaoke all shared `downloadProgress` / `progressLabel`. When Separate ran (or cleared state) while export was still `exporting`, the source-bar fallback showed **“Fetching lyrics…”** because `progressLabel` was null and `downloadProgress < 2`.

**Fix:** Interleaved A/V chunks with continuous progress (decode → frames 0→100%), timeouts + clearer fallback errors, distinct English status strings (`Exporting video… N%` / `Separating lead vocal… N%` / `Downloading song… N%` / lyrics only during analyze), and mutual exclusion (disable Separate while exporting and Export while separating).

Files: `lib/export-video.ts`, `app/studio.tsx`, `PROJECT_STATUS.md`.

## Lead vocal separate + Export audio (22 Sep 2026)

### A) Separate lead vocal
- Full-mix / backing waveform: hover hint + **right-click → “Separate lead vocal”**.
- API: `POST /api/audio/separate` body `{ audioId, url? }` → NDJSON progress (same shape as create karaoke). Prefer signed R2 `audioUrl` to the GPU `/process` (no YouTube re-download when the processor can fetch it); falls back to YouTube `url`.
- Lead vocal track (head + waveform) stays **hidden** until `vocalSrc` exists; full mix plays on backing before separation.
- Friendly 503 copy when GPU/separator missing: “Stem separation needs the GPU processor. Full mix still plays.”
- **Menu UX (22 Sep):** solid hit surface (`pointer-events:auto`, opaque bg, `stopPropagation` on menu/button); transparent full-viewport backdrop while open; timeline scrub / playhead / lyric drag gated by `!stemMenuOpen && !separating` (dismiss via outside click / Escape).
- **Separate progress:** NDJSON % also drives a left→right `.wave-fill` overlay on the backing `WaveformTrack` (same style as the source-bar fill), until stems finish or error.

### B) Export (not a paywall)
- Export menu: **Export video** is the primary invite (Free/Pro); **Download audio** still works.
- Video pipeline (`lib/export-video.ts`): **WebCodecs** via `mediabunny` (`CanvasSource` + `AudioBufferSource` → MP4 AVC/AAC); fallback `canvas.captureStream` + `MediaRecorder` (VP9/WebM or H.264).
- Canvas tools chip: **4K / 2K / 1080** + **30 / 60** FPS (persisted in project autosave). Resolutions respect aspect (16:9 / 9:16 / 1:1).
- Progress on the source bar; downloads `Artist - Title.mp4` (or `.webm` on fallback). Timeline duration respected.

Files: `lib/export-video.ts`, `lib/studio-project.ts`, `app/studio.tsx`, `app/globals.css`, `lib/audio-stems.ts`, `app/api/audio/separate/route.ts`, `components/waveform-track.tsx`.

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

1. **Separación de stems (GPU).** UI + `POST /api/audio/separate` listos (right-click en full-mix). Create karaoke sigue descargando full mix sin GPU. La separación real sigue necesitando un procesador con `audio-separator` (`GPU_PROCESSOR_URL` + `PROCESSOR_WEBHOOK_SECRET`); un tunnel solo-download responde con error claro en inglés.
2. **Exportación de vídeo (mejoras).** Ya exporta MP4 cliente-side; falta pulir fidelidad del stage, watermark Free, y estabilidad 4K60.
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
3. Pulir export MP4 (fidelidad del stage) y watermark Free opcional.
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
2. **Video export polish** — MP4 client export existe (`lib/export-video.ts`); validar browsers y fidelidad visual.
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


## Studio bugs: delete / Space / waveform span (22 Sep 2026)

1. **Saved delete** — Trash on Saved cards calls `DELETE /api/projects/[id]` with `stopPropagation`, optimistic list remove, auth/error handling, and refetch. Deleting the open draft clears editor state and sets `skipSaveRef` so autosave cannot immediately recreate the free slot. API returns 404 when no row was removed.
2. **Spacebar** — Global `keydown` toggles play/pause when `backingSrc` exists and focus is not in `input` / `textarea` / `select` / `contenteditable`; `preventDefault` blocks page scroll.
3. **Waveform span** — Root cause: `WaveformTrack` pinned `width` to the zoom `minWidth` px (~410px) while `.lyric-track` stretched to the full canvas as 0→duration, so the grey clip ended around ~1:02. Fix: stretch like lyrics (`width:100%` + `minWidth`), track `audioDuration` from `loadedmetadata` + decoded `AudioBuffer`, timeline = `max(lyrics end, audio duration)`, clip `widthPercent = audio/timeline`.

Files: `app/studio.tsx`, `components/waveform-track.tsx`, `lib/audio-peaks.ts`, `app/globals.css`, `app/api/projects/[id]/route.ts`, `PROJECT_STATUS.md`.

**Verify:** Saved trash empties the list (Free slot free again); Space toggles Play with audio loaded and does nothing while typing in the link/lyric fields; waveform grey box spans to the song end with lyrics. Do not commit/push from this pass.


## Timeline lyric clip positions (22 Sep 2026)

**Bug:** Canvas karaoke matched audio, but timeline lyric blocks were shifted/stretched (e.g. playhead ~1:10 while active “Oh” sat under ~2:04).

**Root cause:**
1. Hit-target CSS overrode `.lyric-track button` to `position: relative`, breaking absolute `left`/`width` % layout — clips flowed and accumulated horizontal offset.
2. Clip `width` was applied as the stored `%` of an older duration, and scrub/active time used `duration` while playhead display used `timelineDuration`.

**Fix:** Restore `position: absolute`; stretch `.lyric-track` like waveforms (`width:100%` + zoom `minWidth`); position every clip as `left = start/timelineDuration*100%`, `width = spanSec/timelineDuration*100%` with the same `timelineDuration` as the playhead (`max(lyricsEnd, audioDuration, …)`); unify scrub / drag / `onTimeUpdate` / active highlight on that time base. New analyzes store true width % (no 2–20 clamp); CSS `min-width` keeps hit targets.

**Verify:** Play to a short word — black clip sits under the playhead; ruler time matches transport; drag clips, scrub, Space, waveforms, autosave still work. Do not commit/push from this pass.

Files: `app/studio.tsx`, `app/globals.css`, `PROJECT_STATUS.md`.


## Editor spacing and link paste (24 Sep 2026)

- Link input remains editable after the free weekly creation limit is reached; only the Create action remains gated. Explicit plain-text paste handling trims clipboard whitespace and accepts YouTube / YouTube Music URLs.
- Consolidated the editor's final spacing layer around a 4/8/12/16px rhythm: source bar, panel headers, tabs, action groups, inspector fields, transport, and timeline toolbar now have distinct, consistent separation.
- Narrow layouts use a single-column editor (lyrics above preview) instead of squeezing the lyrics panel beside canvas controls. At ≤640px, the upgrade action receives its own row and touch controls retain 40–44px targets.

Files: `app/studio.tsx`, `app/globals.css`, `PROJECT_STATUS.md`.
