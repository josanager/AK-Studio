# AK Studio — estado y guía de continuidad

Actualizado: 21 de septiembre de 2026

## Ubicaciones

- Proyecto local: `/Users/josanestrellaflores/Documents/Codex/2026-09-20/sites-plugin-sites-openai-curated-remote`
- Producción: `https://ak-studio.josanager.workers.dev`
- Repositorio: `https://github.com/josanager/AK-Studio.git`
- Rama de producción: `main`
- Último commit de esta entrega: `d6a2d42`

## Qué está implementado

### Producto e interfaz

- Landing pública responsive en `/`, en inglés y con diseño monocromático.
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
