# Separación GPU en producción — 26 octubre 2026

## Arquitectura

El editor conserva la API `/api/audio/separate`, sus eventos NDJSON, botón de
cancelar, pistas, reproducción y exportación. No se modifica HTML/CSS/React.
La separación se selecciona en el servidor con `SEPARATOR_PROVIDER=modal`.

1. Cloudflare comprueba la sesión y propiedad del audio original en R2.
2. Genera capacidades HMAC de una hora, limitadas a un audio, usuario,
   generación y operación: leer original o escribir lead/backing temporales.
3. Modal recibe la solicitud por API autenticada; devuelve 202 y ejecuta un
   trabajo independiente de la conexión del navegador.
4. Una L4 ejecuta el mismo checkpoint Mel-RoFormer Karaoke, FP32, batch1,
   overlap2. Modelo reutilizado mientras el contenedor esté caliente.
5. Las dos pistas FLAC se suben a R2 mediante las capacidades. Cloudflare
   valida una generación completa y la publica en las URLs de siempre.

Sin credenciales de bucket en Modal, sin volúmenes de audio en Modal y sin
GPU permanente: min0/max1, apagado tras 60 s de inactividad. La API de control
es CPU ligera con max1; el dict de trabajos conserva estado tras reinicios.
Las capacidades y URLs firmadas nunca aparecen en respuestas del editor ni
en logs de la aplicación. Las Dict contienen estado, no archivos de audio;
caducan automáticamente tras siete días sin actividad según Modal.

R2 conserva la política verificada `Delete temporary media`: caducidad de
objetos al día, todos los prefijos. Las lecturas de la app también rechazan
audios de más de 24 horas. Los originales y la descarga YouTube no cambian.

## Configuración

- Modal app: `ak-studio-separator-gpu`, workspace `josanager`.
- URL: `https://josanager--ak-studio-separator-gpu-api.us-east.modal.run`.
- Secret gestionado Modal: `ak-studio-cloudflare`, campo `MODAL_SHARED_SECRET`.
- Mismo campo en los secretos de Cloudflare `ak-studio`; no está en Git.
- Variables públicas CF: `MODAL_SEPARATOR_URL`, `SEPARATOR_PROVIDER=modal`.
- Límite de gasto neto Modal $0, consumo mensual máximo $30 con créditos.
  No se activaron cargos adicionales ni recursos mínimos permanentes.
- El token temporal del SDK solo se usa para desplegar: su caducidad no
  detiene el endpoint desplegado ni los trabajos que este lance.

## Robustez

La API deduplica por audioId. Los reintentos explícitos de trabajos fallidos o
cancelados usan otra generación. Una petición perdida puede recuperar el
resultado persistido sin otra inferencia. La cancelación invoca FunctionCall
cancel con terminate_containers=True; un trabajador viejo no publica sobre
una generación posterior. Actualizaciones tardías de progreso viven en un
dict separado y no pueden convertir cancelled/ready en processing.

La cola se limita a ocho trabajos y no reintenta automáticamente inferencias.
CUDA es obligatorio, sin caída silenciosa a CPU. Duración máxima 20 min y
salida máxima 95 MiB por pista (límite de solicitud Cloudflare). Los errores
conservan el original. Al vencer la espera de 20 min, Cloudflare solicita
cancelación. No afirma un porcentaje ficticio durante el arranque de GPU.

La API rechaza URLs distintas del endpoint de transferencia del dominio
oficial, no sigue redirecciones y verifica autorización en todas las rutas.
Las transferencias validan firma, caducidad, operación, propiedad, tipo y
tamaño. El FLAC nuevo tiene prioridad sobre una mezcla anterior en otro
formato. Una pareja incompleta o de distintas generaciones no se cachea.

## Validación realizada

- Pruebas `scripts/test-modal-service.py`: autenticación, SSRF, cola,
  deduplicación, espera, cancelación real de la llamada simulada, aislamiento
  de generaciones, errores de arranque y progreso tardío.
- `scripts/test-modal-transfer.mjs`: firma, manipulación, caducidad,
  operaciones/propiedad, tamaño, validación R2 y promoción completa.
- Pruebas existentes de orquestación, caché y timeline, TypeScript y build.
- Prueba real de canción CC-BY Let's Go Fishin' (Karissa Hobbs, 132.989 s):
  R2 → L4 → R2 → respuesta de editor lista; primera ejecución 128.373 s.
- Solicitud repetida deduplicada y cancelación real: HTTP200, estado
  cancelled, 7.752 s incluyendo preparación de fixture. Reintento del mismo
  audio tras cancelar terminó correctamente (162.456 s con arranque).
- Detectado bloqueo de inferencia por escrituras síncronas de progreso:
  movidas a un hilo y dict separado, fuera del camino de cálculo CUDA.
- Repetición final con esa corrección: 77.888 s completos, separación
  28.044 s, resultados de ambas pistas con la misma generación.
- Las cifras incluyen variabilidad de arranque; no son un SLA ni garantizan
  un tiempo fijo. No son una evaluación auditiva de separación.

Las fixtures y el worker temporal de comprobación se eliminan al finalizar.
Resultados técnicos de prueba en `outputs/modal-e2e/` (ignorados por Git),
sin credenciales ni URLs firmadas en los informes.

## Desplegar y revertir

```sh
modal deploy --profile ak-studio-benchmark processor/modal_service.py
npm run build:cloudflare
node node_modules/wrangler/bin/wrangler.js deploy --config dist/server/wrangler.cloudflare.json
```

Usar Node24 y Wrangler4.92 del proyecto para el frontend. El endpoint Modal
aplica su propia autenticación Bearer aunque Modal lo describa como
"unauthenticated" a nivel de su proxy: una llamada sin clave devuelve 401.

Rollback: retirar `SEPARATOR_PROVIDER=modal` de wrangler.jsonc y volver a
desplegar. Las variables/secretos `SEPARATOR_PROCESSOR_URL` y
`SEPARATOR_WEBHOOK_SECRET` del procesador CPU anterior no se han borrado.
No hay fallback automático que lance otra separación lenta sin avisar.

Alcance: solo migración de separación. El navegador sigue mostrando el
editor, reproduciendo audio y ejecutando la exportación/análisis que ya
tenía; no se promete cero RAM local ni se ha migrado el renderizador de vídeo.

## 2026-10-27 — Background completion and GPU scheduling

Standalone separation now uses POST to spawn an independent Modal job (202) and authenticated short GET status requests to recover/promote a complete R2 generation. Closing/suspending the browser does not cancel inference. A per-account/audio pending marker restores polling after reopening; visibility restoration wakes polling. Network interruptions retry status checks without starting new inference. The UI says “Please wait while your audio is processed.”, stays below 100 until ready, and preloads both output waveforms before committing the pair. Restored/downloaded song metadata, lyrics and prepared audio are committed together.

GPU allocation accepts L4, A10 or T4 in preference order, with the SAME FP32 checkpoint and parameters, max one container and min zero. This follows Modal's GPU fallback support; availability and per-second price vary by GPU. No workspace budget, spending limit or subscription was changed. Removed two synchronous remote Dict reads per downloaded MiB; cancellation still terminates the native function and generation checks remain before compute/output publication. Manifests now record downloadSeconds.

Real production UI test (187.28-second song): first single-L4 request waited over five minutes in scheduling and was explicitly cancelled. A subsequent completed job took 184.604 server seconds, including 25.126 inference seconds; logs showed ~154 seconds in input preparation/transfer. After removing per-block RPCs, final job took **81.803 server seconds**, **3.629 download seconds**, **56.632 inference seconds**. Different GPU availability/startup makes this a full-path observation, not a controlled inference speed comparison. The browser tab was closed 30 seconds after the final start, and the job reached ready in Modal/R2 while no editor tab was open. Physical Safari/iOS was not used.

Tests: TypeScript and Cloudflare build; test-separation-job.mjs, test-separation-resume.mjs, test-modal-transfer.mjs, test-modal-service.py and existing playback regression checks. Production web version: 4315b4f8-1bd6-4260-8550-4f42cf2dc982; Modal app redeployed with compatible GPU fallbacks and bounded transfer checks.
