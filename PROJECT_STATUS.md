# AK Studio — estado y guía de continuidad

## Actualización 26 octubre: separación migrada a GPU Modal en producción

- Modal app `ak-studio-separator-gpu` desplegada, endpoint autenticado `https://josanager--ak-studio-separator-gpu-api.us-east.modal.run`. Min0/max1 L4, FP32/mismo checkpoint/audio-separator 0.47.0/batch1/overlap2, modelo reutilizado hasta 60 s de inactividad. API CPU ligera y Dicts persistentes; no audio en volúmenes Modal.
- Cloudflare publicado en versión **1f8999c1-2c1a-4e92-b360-f41265bc262d**. Verificados por API los bindings activos `SEPARATOR_PROVIDER=modal` y URL, y presencia del secreto cifrado `MODAL_SHARED_SECRET`. Web/endpoints/dominio/Google-Patreon/planes permanecen; no cambió ningún componente UI.
- R2 original → capacidades HMAC por archivo/generación/usuario/operación de una hora → Modal → dos FLAC staged en R2 → promoción solo de pareja completa. GET/PUT sin firma devuelven401; solicitud de separación sin sesión401. Original se conserva. Prioridad FLAC evita reutilizar mezcla vieja en otro formato.
- Cola acotada8, solicitudes idempotentes, reintentos explícitos por generación, cancelación nativa que termina contenedor, recuperación tras reinicio/desconexión. Progreso real asíncrono fuera de la inferencia; actualizaciones tardías no pisan estados terminales. Sin fallback CPU automático.
- Pruebas reales sobre canción CC-BY de132.989 s: flujo completo inicial128.373 s; cancelación+dedup real7.752 s; reintento del cancelado162.456 s; pasada final tras desacoplar progreso77.888 s completos, inferencia28.044 s. No son garantías ni evaluación auditiva.
- Pasan tests nuevos de API/seguridad/cancel/retry/capacidades/promoción, tests existentes de orquestación/caché/timeline, TypeScript/build. Worker temporal `ak-studio-migration-check` eliminado y sus15 objetos de prueba borrados; proyecto del usuario solo inspeccionado, sin recarga ni cambios.
- Modal: gasto neto máximo$0 conservado; límite de uso$30 para créditos mensuales, sin cobros adicionales ni GPU permanente. R2 caduca todos los objetos al día, regla verificada. Viejo separadorCPU queda desplegado para rollback y duerme sin peticiones; descargadorCloudflare sigue en uso.
- Detalles operativos/rollback en `processor/MODAL_DEPLOYMENT.md`. Alcance: separaciónGPU; exportación de vídeo, reproducción y otras tareas existentes del editor aún son del navegador. No afirmar que todo el proyecto usa cero recursos locales.

## Actualización 25 octubre: canción real y espera de arranque GPU

- Probada canción CC-BY 3.0 `Let's Go Fishin'` de Karissa Hobbs, ejemplo librosa fishin HQ estéreo 44.1k, duración 132.989 s, descargada solo en Modal. Mismo checkpoint/FP32/batch1/overlap2.
- Separación completa: 25.648 s primera pasada / 25.034 s caliente. Fragmentos reales: 30 s → 5.719 s; 60 s → 10.957 s. App `ap-bt8fkkNgxUnO3RalFyxDwt` completada.
- Dos trabajos únicos en apps nuevas: 128.625 s y 150.962 s de extremo a extremo del benchmark; dentro de la función 40.570/40.048 s. Espera fuera de la función 88.055/110.914 s. No atribuir causa exacta sin trazas; no prometer 25 s totales para AK Studio.
- Apps `ap-I4pyOVkhdbzWMWF55ylRjk` y `ap-PFw6li8jYkR6sr2lO4q8gB` completadas/detenidas. Sin GPU permanente. Cero cargos adicionales permitido, cap consumo créditos $2 conservado. No cambios de producción ni R2.
- Dos FLAC estéreo no silenciosos/finitos y de duración correcta en cada caso. No evaluación auditiva subjetiva. Detalles en `processor/MODAL_MUSIC_RESULTS.md`, JSON brutos ignorados bajo outputs.

## Actualización 25 octubre: Modal L4 probada con éxito

- Tras el usuario verificar la tarjeta, confirmados $30 de créditos. Guardados y verificados spend limit $0 y usage limit $2 de créditos. No habilitar cargos ni aumentar límites sin petición.
- Sonda GPU real L4 exitosa. Benchmark final app `ap-leuRRd8jvnzf3ecfrc9lHm` completada y detenida: 30 s sintéticos estéreo, mismo checkpoint/FP32/batch1/overlap2, separaciones 6.436 / 5.657 / 5.666 s, mediana caliente 5.662 s, carga 5.088 s, llamada remota completa con tres pasadas 43.643 s. Pico VRAM 1.666 GiB.
- No son tiempos de una canción real ni un factor comparado con CPU Cloudflare. No se migró producción ni R2. Toda inferencia remota; SDK local solo envía código y recibe métricas.
- Primer intento completó inferencia pero devolvió TorchVersion no serializable sin torch local; convertido a str y repetido con éxito. Resultados detallados en `processor/MODAL_RESULTS.md`, JSON bruto en `outputs/modal-benchmark.json` ignorado.
- Apps efímeras, ninguna GPU permanente, sin volúmenes públicos ni endpoints. Credencial SDK temporal existente caduca una hora tras autorización inicial.

## Actualización 25 octubre: prueba Modal L4 preparada, pendiente de habilitación

- Usuario pidió medir GPU sin gastar ni cambiar aún el procesamiento de producción.
- Cuenta Modal `josanager@gmail.com` iniciada por el usuario, onboarding AK Studio Vocal completado. Starter tiene $1 desbloqueado y límite $1; el resto de los $30/mes requiere método de pago. No se añadió tarjeta ni contrató plan.
- SDK 1.6.2 instalado solo en `/tmp/ak-modal-benchmark-venv`. Permiso explícito del usuario para un token temporal de una hora en perfil `ak-studio-benchmark`; credenciales fuera del repositorio.
- Sonda mínima L4 rechazada por Modal: `Please add a payment method to use L4 GPU functions.` App efímera detenida. No inferencia ni medición real de velocidad; no afirmar aceleración ni coste por canción.
- `processor/modal_benchmark.py` prepara mismo checkpoint/audio-separator 0.47.0/FP32/batch1/overlap2 en CUDA L4, una instancia efímera, tres pasadas, hashes y métricas, entrada sintética remota. Compila e importa localmente sin inferencia. No endpoint público, R2 secrets ni conexión a producción.
- Detalles y próximos pasos en `processor/MODAL_BENCHMARK.md`. Tras añadir método de pago, verificar créditos y fijar spend limit $0 antes de correr. No gastar por autorización implícita.
- El aviso de añadir método de pago exige una verificación de $0.50 reembolsable. No satisface cero desembolso inicial: no se avanzó al formulario ni se aceptaron cargos. Se dejó el aviso visible al usuario.

## Actualización 21 octubre: etiqueta de tonalidad

- Retirado únicamente el prefijo visible `Est.` de la tonalidad en el canvas. Tonalidad, separador y BPM permanecen iguales. Tooltip conserva la aclaración de que el análisis es estimado. Sin cambios al motor de análisis, descarga, separación o exportación. TypeScript y build Cloudflare pasan.

## Actualización 20 octubre: excepción privada de propietario

- Por petición explícita posterior, únicamente `josanager@gmail.com` obtiene Pro ilimitado sin Patreon. `lib/plans.ts` verifica el correo exacto y el ID de la identidad autenticada contra `auth_user`, con `email_verified=1`. No usa listas configurables, coincidencias parciales ni alias Gmail; no concede privilegios por un correo enviado por el cliente.
- La excepción devuelve `ownerAccess:true`, plan Pro, weeklyLimit null y canCreate true, sin depender de disponibilidad o membresía Patreon. Plans identifica este beneficio como Owner access, no como una suscripción Patreon activa.
- Las demás cuentas conservan la política Patreon anterior. scripts/test-owner-plan.mjs prueba propietario verificado, alias y otros correos/IDs rechazados, correo no verificado rechazado y miembros Patreon intactos. También pasan scripts/test-patreon.mjs y TypeScript.
- Publicado en versión e7019f4c-6fd4-406f-9ac9-04da47625eba. Verificado en producción tras iniciar sesión con el Patreon ya vinculado: misma cuenta josanager@gmail.com, Plans muestra Owner access y `/api/plan` devuelve plan pro, weeklyLimit null, canCreate true, ownerAccess true. Esto también confirma login Patreon desde una sesión sin autenticar, conservando la cuenta local. No se modificó ni recargó el proyecto del editor que el usuario tenía abierto.

## Actualización 20 octubre: anuncio Patreon y acceso mínimo

- Publicación pública en inglés creada y publicada por petición explícita: https://www.patreon.com/acapellakaraoke/posts/your-patreon-now-172928840 . Explica Pro incluido con membresía activa >=US$15/mes, acceso Patreon, vinculación desde Google/Plans, límites de niveles inferiores y uso autorizado de música.
- Nivel publicado de US$15, ID 9833574, descripción actualizada en inglés con AK Studio Pro, exportación sin marca y pasos de vinculación. Precio, título, portada y siete beneficios existentes conservados. No se editaron precio, cobros, niveles inferiores ni el nivel de US$25 no publicado.
- `/signin` reducido a marca AK Studio y los dos botones Patreon/Google; retiradas lista de beneficios y explicaciones del acceso. Instrucciones para cuentas Google existentes siguen en Plans y error de acceso. Composición compacta centrada, estados de carga/error y foco de teclado conservados.
- Símbolo actual Patreon obtenido del SVG de su propia navegación oficial (viewBox 436x476), no la antigua P circular. Mismas dimensiones ópticas que Google. Las skills Uncodixfy e Impeccable guiaron la eliminación de texto y el uso de la identidad monocroma existente, sin rediseñar otras rutas.
- Pasan TypeScript, build Cloudflare y prueba de política Patreon. No cambios al audio, proyectos ni permisos de membresía en esta ronda.
- Publicado en Cloudflare versión 94e9a552-0691-4419-a2d6-c3ca8dbf38df. Producción verificada: exactamente dos botones accesibles, ambos con SVG; 360×50 px en desktop y 342×50 px en viewport móvil emulado de 390 px, sin desbordamiento horizontal. Se restauró la emulación al terminar.

## Actualización 20 octubre: Patreon sustituye nuevas altas de Stripe

- OAuth Patreon API v2 registrado para AK Studio Vocal, callback oficial `/api/auth/callback/patreon`. Client ID/secret y webhook secret configurados como secretos de Cloudflare, nunca en Git. Campaña verificada `9673516`, Acapella Karaoke, moneda USD.
- Pro depende exclusivamente de Patreon: `active_patron`, entitlement mensual >=1500 centavos USD y sin último cargo rechazado/reembolsado/fraudulento. No se consulta Stripe ni la antigua excepción por correo. El creador sin membresía calificadora sigue Free según esta regla.
- Google se conserva para cuentas existentes. Patreon se vincula explícitamente desde Plans; no hay asociación implícita por correo. Nuevo acceso Continue with Patreon. Solo scopes identity e identity[email]: Patreon permite consultar la membresía a la propia campaña sin pedir las membresías a otros creadores.
- Migración aditiva 0006 aplicada en D1. Verificación server-side mediante access token de la identidad vinculada; Better Auth renueva tokens. Caché máxima 5 minutos, refresh manual y notificaciones firmadas que invalidan caché sin conceder permisos desde payloads. Fallos de verificación no conceden Pro. Editor refresca plan por minuto visible y al recuperar foco, sin recargar proyectos.
- Webhook v2 creado, ID 801689, destino `/api/patreon/webhook`, seis eventos members/pledges create/update/delete. Firma HMAC-MD5 de Patreon, comparación constante; replays solo invalidan caché.
- Checkout de compatibilidad devuelve Patreon, no crea nuevas suscripciones Stripe. Webhook histórico Stripe y registros conservados, pero no otorgan Pro. **No se cancelaron suscripciones Stripe existentes ni se garantiza que dejen de renovarse**: requiere decisión explícita del propietario.
- Pasan TypeScript/build y scripts/test-patreon.mjs: límite 1499/1500, estado, moneda/campaña equivocadas, identidad y enlace explícito. Prueba con 100 miembros reales de Patreon: 2 califican y 98 no; sin registrar datos personales. Endpoint producción rechaza firma falsa (401), acepta firma correcta (200) sin cambiar miembros reales.
- Publicación final Patreon: f6e2599f-95d0-40bf-a137-955055dcf314; código 1319d65 en github/main. `/api/plan` autenticado comprobado en producción, cuenta actual Free/no vinculada. Vinculación real del propietario llega al consentimiento oficial Permitir; pendiente confirmación específica de identidad/email para completarla. No afirmar todavía login OAuth completo ni Pro real en la sesión. Copia temporal de credenciales eliminada después de guardarlas como secretos de Cloudflare.
- Audio, letras, modelo y proyecto actual no fueron regenerados ni modificados por esta integración. PRODUCT.md/DESIGN.md contienen decisiones históricas de Stripe/precio; esta sección prevalece.
- Confirmación posterior: el propietario autorizó el permiso OAuth de identidad/correo. El intento anterior había caducado; un intento nuevo completó el callback y vinculó Patreon a la cuenta Google existente, conservando su identidad local. Plans muestra Patreon connected; Refresh membership funciona. Patreon no devuelve membresía calificadora para la cuenta creadora, por lo que queda Free bajo la regla estricta solicitada. No se concedió una excepción administrativa ni se efectuó ningún pago. Esta prueba sí confirma callback y vinculación reales, pero no un inicio de sesión desde una sesión cerrada.

## Actualización 20 octubre por la noche: letras de mashups y recuperación

- Caso reproducido del usuario: La La Latch (Sam Smith/Disclosure/Naughty Boy Mashup), Pentatonix, enlace KeXGgoixuT4. Las búsquedas usaban los créditos entre paréntesis como título y rechazaban la coincidencia del catálogo.
- Se normalizan esos créditos para consulta y comparación, conservando etiquetas de versión significativas como Live. Se mantiene validación de artista y se prioriza duración compatible.
- LRCLIB devolvió 503 reales por sobrecarga durante la prueba. Se añadieron reintentos breves y fuentes alternativas: NetEase con LRC sincronizado validado por título/artista/duración y lyrics.ovh como último recurso de texto sin tiempos exactos. La API informa la fuente real.
- Al restaurar un proyecto con audio pero sin letras, el editor consulta automáticamente /api/analyze usando su audioId. No llama a /api/audio ni a /api/audio/separate. No sobreescribe letras existentes ni repone texto que el usuario acaba de eliminar; aborta al cambiar de proyecto o iniciar otra operación.
- Verificado en el proyecto real del usuario: 45 líneas sincronizadas recuperadas automáticamente; audio existente conservado. Tras otra recarga permanecieron las 45 líneas y no se repitió POST /api/analyze. Red observada mediante CDP, sin leer ni exponer credenciales.
- Pasan scripts/test-lyrics.mjs y scripts/test-lyrics-recovery.mjs, TypeScript y build Cloudflare. No se cambió ni ejecutó el modelo de separación.

## Actualización 20 octubre 2026: reparación del flujo de audio

Esta sección prevalece sobre los handoffs históricos inferiores. Producción oficial: **https://akstudiovocal.com**. Código publicado en `github/main`; se trabajó en el worktree administrado `ak-studio-repair` para preservar el checkout original con cambios del usuario.

- Descarga: corregido el parser JSON que rechazaba el NDJSON real de `/download`. Transferencia FLAC a R2 por streaming; cinco instancias fijas compartidas por descarga y lectura de archivos, sin una sexta instancia para health.
- Letras: metadatos normalizados tanto desde oEmbed como desde yt-dlp, Unicode, búsquedas alternativas con timeout y validación de canción/artista. Fallos del catálogo no bloquean el audio ni dejan letras de la canción anterior. Se distingue catálogo temporalmente caído de ausencia de coincidencia. Letras planas siguen teniendo tiempos aproximados, no sincronización real.
- Separación: se mantiene **Mel-RoFormer Karaoke**, mismo checkpoint y ajustes FP32/overlap 2/batch 1, en CPU standard-4 (4 vCPU, 12 GiB, máximo una instancia). No se contrató GPU ni otro servicio. Cola serial acotada, reintento de IDs fallidos/cancelados, cancelación del proceso y keepalive solo durante trabajos activos. Subproceso persistente para reutilizar el modelo; eliminado análisis librosa redundante después de separar.
- Editor: se puede buscar/arrastrar el cabezal durante separación; revisiones explícitas de seek actualizan el reloj de audio. Botón Cancel separation y mensajes con progreso real, sin afirmar que falta una GPU cuando el servicio simplemente falla.
- Publicación: imágenes OCI fijadas por digest en `processor/wrangler*.jsonc`, conservando dependencias y modelo de las imágenes desplegadas. `scripts/update-processor-image.mjs` permite parchear solo el código y verificar el checkpoint; no imprime credenciales. Los contenedores antiguos activos pueden acabar usando el proceso viejo hasta su siguiente reinicio aunque el rollout ya marque completado.
- Wrangler 4.92 falla al desplegar estos Containers por conflicto entre observabilidad antigua y nueva. Para los procesadores se usó 4.151.2. El build frontend genera `legacy_env`, por lo que su despliegue se mantiene con la versión fijada 4.92. No borrar secretos ni bindings al desplegar.
- Pasan TypeScript, build Cloudflare, compilación Python y pruebas de NDJSON, letras, routing, cola/cancel/retry/reutilización, orquestación de stems, caché, timeline, cancelación y escala de exportación.
- Pruebas reales: descarga y letras de Believe/Pentatonix, BPM/tonalidad estimados, reproducción/pausa/seek durante separación, zoom, cancelación y navegación cuenta/planes/fuentes/estudio. Separación completa terminada: dos pistas FLAC de 188.23 segundos, ambas decodificadas y reproducidas. Tras recargar, el proyecto restauró los stems sin volver a separar.
- También se probó importar un WAV sintético, crear automáticamente Audio 3 por solapamiento, moverlo, dividirlo en dos y retirar ambos fragmentos con Delete. Probados Eliminar/Undo/Redo en letras. Se corrigió un crash al leer `event.currentTarget.textContent` dentro de un updater diferido después de blur; ahora se captura el valor durante el evento y se selecciona la línea al enfocar su texto.
- La CPU sigue siendo el límite de rendimiento: no afirmar una aceleración multiplicativa sin comparación controlada. Estado, prueba y capturas de esta ronda en `outputs/repair-verification/` (local, ignorado por Git).

## Actualización 26 septiembre: micrófono y fondos

- No se añadió importación de vídeos ni drag/drop. AudioRecorder usa MediaRecorder y el micrófono seleccionado (System default o deviceId exacto), permite detener, preescuchar, descartar y usar la toma. Permiso se solicita solo al pulsar Record audio.
- Con canción existente, Use recording sustituye la pista de voz y conserva acompañamiento/letras; sin audio, inicia una pista local. La toma se incorpora a playback, waveform y mezcla de exportación. No se sube a R2 ni se autosalva; exportar antes de salir. Limpieza del micrófono y URLs al detener/desmontar.
- Background: color, None/Dots/Lines/Grid y Animate pattern. Patrón determinista sincronizado con el cabezal, pausado cuando el playback está pausado; mismo painter en preview/WebCodecs/MediaRecorder. Contraste del patrón se ajusta al color. Settings permite abrir/cerrar el inspector en móvil.
- Prueba de producción con audio sintético, sin usar micrófono físico: start/stop, preescucha, Use recording, waveform y reproducción simultánea con backing. Overrides de prueba restaurados y pestaña temporal cerrada. Revisión desktop y móvil 390×844; sin nueva exportación completa en esta ronda. TypeScript/build, test-studio-background y regresiones de escala/cancelación pasan.

## Actualización 26 septiembre: cancelar exportación

- Durante la exportación, el botón Create karaoke se sustituye por Cancel export, con el estilo existente. AbortController cancela preparación/render/finalización; se comprueba de nuevo antes de descargar para impedir archivos parciales.
- Abort cancela y libera Output/codificadores WebCodecs; en MediaRecorder detiene grabación, audio y tracks. No se activa un fallback después de cancelar. Al desmontar también se aborta.
- Exportación del usuario detenida inmediatamente por recarga al 65% (antes de disponer del botón). Después, prueba real 4K/60 fps cancelada al 21% usando el nuevo botón: mensaje Export cancelled, entrada desbloqueada y sin descarga. Se conservaron la calidad y la configuración del proyecto.
- TypeScript, build, test-export-cancel y regresión test-export-sizes pasan.

## Actualización 26 septiembre: escala del canvas al exportar

- Eliminado el fallback de tamaño pequeño cuando el cabezal está entre letras: `lib/preview-metrics.ts` mide la tipografía CSS con una sonda invisible temporal si no hay texto activo; la sonda se elimina inmediatamente.
- Título superior y logo usan tamaño/posición reales del DOM, no tamaños alternativos. Letra, título y marca comparten la escala `ancho exportado / ancho visible del stage` en ambos motores.
- El ancho de ajuste de línea respeta `max-width` y el padding del contenedor (incluidos valores porcentuales). No se cambió el diseño visible.
- `scripts/test-export-sizes.mjs` comprueba proporciones de los tres elementos en 1080p, 2K y 4K. TypeScript y build pasan.
- Prueba de producción: exportación iniciada con cabezal en 0 y sin letra activa; completó MP4 1920×1080 a 30 fps. Cabezal restaurado. No se realizó comparación píxel a píxel del archivo descargado.

## Actualización 26 septiembre: duración de subtítulos e imán

- Tiradores izquierdo/derecho en los bloques de letra para ajustar inicio/final (duración mínima 150 ms). Arrastrar el centro conserva la duración. Los cambios usan `width` existente y por ello se aplican al preview y a los motores de exportación.
- Imán junto a Split/Delete: activo ajusta movimientos y extremos a pulsos `60 / BPM` (118 si no hay tempo); desactivado permite movimiento libre. Estado accesible `aria-pressed`, sliders con tiempo en segundos y flechas para ajuste fino (50 ms, Shift 500 ms sin imán).
- Pointer capture con limpieza al terminar, cancelar, perder foco o desmontar; bloqueado durante procesamiento/exportación. Identidad estable de bloques durante la edición.
- TypeScript, build y `scripts/test-lyric-timing.mjs` pasan. Verificados arrastres de ambos extremos y teclado en producción; revisión visual desktop y 390×844. Tiempos originales restaurados después de la prueba. No se generó un vídeo nuevo en esta ronda.

## Actualización 26 septiembre: separación desplegada y probada

- Servicio independiente `ak-studio-separator` en Cloudflare Containers, con Mel-RoFormer Karaoke sobre CPU (4 vCPU, 12 GiB, máximo una instancia). El descargador permanece independiente.
- Prueba real completada: canción de 135 segundos, procesamiento de 829 segundos. Lead y backing + instrumental se almacenaron en R2 y ambas pistas se reproducen en el editor; lead queda silenciado por defecto. El modelo no garantiza aislamiento perfecto de todos los coros.
- Jobs asíncronos, solicitudes idempotentes, reintentos de arranque y reutilización de stems existentes. La sesión debe permanecer abierta: todavía no hay una cola durable para separación.
- Corregida la caché que devolvía el full mix antiguo como backing: stems revalidan mediante ETag y el servidor admite 304. Archivos reproducidos comparados por hash con R2. No se hizo otra exportación completa tras este último ajuste.
- TypeScript, build y pruebas de servicio, servidor y caché pasan. Detalles y continuidad: [docs/SEPARATION_STATUS.md](docs/SEPARATION_STATUS.md). Para escalar y reducir latencia hace falta evaluar un servicio GPU; no se ha contratado ninguno.

## Actualización 26 septiembre: zoom y marca de agua

- Timeline: viewport horizontal separado del contenido. Zoom 0–100 equivale a 1×–8.17×; regla, letras, cabezal y waveform comparten la misma escala. Botones, slider, Command/Control + wheel y pinch del trackpad (ctrl-wheel; Safari gesture events) actualizan el zoom y preservan el punto bajo el cursor. Scroll normal sin modificador conserva navegación horizontal. Valor 0 se restaura correctamente.
- Eliminada la raya decorativa junto a la letra en el preview y en ambos motores de exportación.
- Logo `logoak.svg` blanco/transparente en esquina superior derecha, ancho 5%, margen 2.5%, opacidad .65. Botón `Preview watermark` muestra/oculta en preview. Pro respeta el interruptor al exportar; Free fuerza watermark en exportación. Export carga el mismo SVG antes de dibujar.
- Verificado en producción: slider reduce ancho de contenido al ancho del viewport (1101 px) en zoom 0; Command-wheel 62→80; ctrl-wheel 80→69; toggle on/off; revisión visual desktop y móvil 390×844. Se restauró el tamaño del navegador. TypeScript y build pasan. No se realizó una exportación completa de la canción en esta ronda.

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

## Fixed preview aspect ratios (26 Sep 2026)

- The video stage contains an exact 16:9, 9:16, or 1:1 frame at every breakpoint, sizing against both available width and height with container units.
- The surrounding workspace is gray so unused space cannot be mistaken for exported video content.
- Verified production desktop dimensions: horizontal 683×384.1875 (16:9), vertical 286.875×510 (9:16). Both orientations also fit a 390×844 mobile viewport; fractional CSS pixels introduce only subpixel rounding.

Files: `app/globals.css`.

## Owner complimentary Pro access (26 Sep 2026)

- Cloudflare Worker variable `COMPLIMENTARY_PRO_EMAIL` grants Pro access only to the authenticated account `josanager@gmail.com`.
- The server's central plan resolver returns unlimited creation and Pro export behavior for this account without creating a Stripe subscription. Other accounts retain their normal subscription and free weekly limit.
- Remove or clear this Worker variable to revoke the exception; keep the deployment configuration in sync.

Files: `lib/plans.ts`, `cloudflare-env.d.ts`, `wrangler.jsonc`, `scripts/prepare-cloudflare-build.mjs`.

## Editor header colors and brand alignment (26 Sep 2026)

- Inverted the editor header to black with white text and icons; the Export button and AK symbol use white surfaces with black content.
- Centered the AK symbol and Studio text vertically using flex alignment and a consistent text line height.
- Preserved readable hover, keyboard focus, secondary labels, and the export dropdown on the dark header.

Files: `app/globals.css`.


## Preview canvas edge alignment (24 Sep 2026)

- Removed stage-wrap padding so the 16:9 preview uses the full horizontal width between the lyrics panel and inspector; unused vertical letterbox area now matches the canvas black.
- Removed the duplicate Center text toolbar icon; text position reset and alignment controls remain in the inspector.

Files: `app/globals.css`, `PROJECT_STATUS.md`.


## Editor spacing and link paste (24 Sep 2026)

- Link input remains editable after the free weekly creation limit is reached; only the Create action remains gated. Explicit plain-text paste handling trims clipboard whitespace and accepts YouTube / YouTube Music URLs.
- Consolidated the editor's final spacing layer around a 4/8/12/16px rhythm: source bar, panel headers, tabs, action groups, inspector fields, transport, and timeline toolbar now have distinct, consistent separation.
- Narrow layouts use a single-column editor (lyrics above preview) instead of squeezing the lyrics panel beside canvas controls. At ≤640px, the upgrade action receives its own row and touch controls retain 40–44px targets.

Files: `app/studio.tsx`, `app/globals.css`, `PROJECT_STATUS.md`.
# Official domain migration — 2026-09-26

- Cloudflare custom domains `akstudiovocal.com` and `www.akstudiovocal.com` attached to the existing AK Studio Worker. HTTPS root verified with HTTP 200 and browser landing-page check.
- `workers_dev: true` explicitly preserved for existing Google callbacks, Stripe webhooks, and older media links.
- Google OAuth additional origin and callback prepared in the existing AK Studio Web client, awaiting confirmation before saving persistent authorization. Existing OAuth URLs were not removed.
- Until that save is confirmed, `BETTER_AUTH_URL` and `SITE_URL` remain on the previous workers.dev origin. Complete the Google save, then change both variables in `wrangler.jsonc` and `scripts/prepare-cloudflare-build.mjs`, deploy, and verify login and checkout return URLs. Domain migration is not yet end-to-end complete.
# Multitrack microphone recording — 2026-09-26

- Completed takes offer `Add to timeline` and `Record again`. Re-recording discards the pending local take and starts the selected microphone again.
- Recorded clips insert at the playhead; an available non-overlapping audio lane is reused, otherwise a new lane is added. Existing song/stems and lyric track are preserved.
- Audio clips support horizontal/vertical pointer dragging and arrow-key positioning; beat snapping follows the magnet toggle. Audio lane headers support drag reordering and accessible up/down buttons. Each lane has mute and clips have remove controls.
- Playback uses an independent timeline clock and synchronizes all clips to their start offsets. Export mixes the current clips at the same offsets, honoring lane/global mute. Recording blobs remain local and are not persisted to R2 or project storage.
- Verified real MediaRecorder flow with a synthetic microphone in an isolated browser tab: re-record, add on occupied song, new lane, pointer and keyboard movement, channel reordering, and concurrent playback. Hardware microphone was not accessed. Desktop/mobile layout inspected.
- `npx tsc --noEmit`, `scripts/test-audio-timeline.mjs`, `scripts/test-export-sizes.mjs`, and `scripts/test-export-cancel.mjs` pass.
# Timeline scrolling and playback recovery — 2026-09-26

- Timeline toolbar remains fixed while a dedicated vertical scroll region moves all audio tracks and their headers together. Wheel/trackpad scrolling and visible scrollbar are enabled; horizontal zoom/scroll remains independent.
- New recordings automatically reveal their channel and horizontal start position.
- Playback avoids issuing duplicate pending `play()` requests, ignores intentional aborts, and does not repeatedly seek while a media seek is in progress. Play at the end restarts from zero.
- Browser verified with two synthetic recordings under existing song/stems: vertical scrollTop moves 0 → 107; newly added clip fits within viewport; four audio elements advance with readyState 4, correct mute flags, and pause control works.
- User's existing tab was still on the pre-multitrack build with a stalled seek. It was not reloaded because it contains a local recording.
- Recovered user's 78,663-byte WebM microphone take directly between same-origin tabs using a temporary BroadcastChannel, without uploading it; inserted it into corrected editor at original start 0. Browser confirmed all three audio elements playing at readyState 4, microphone audible, then paused. Original tab retained; corrected tab kept as deliverable. Temporary recovery channel closed.
# Local audio drag and drop — 2026-09-26

- Timeline accepts local audio files (single or multiple) without uploading them. Names appear on clips; imported audio shares recording lane placement, playback, movement, mute, export, and auto-reveal behavior.
- Drop position follows timeline mouse time (or playhead when dropped on headers). An unoccupied lane is reused; overlapping files get additional channels. Multi-file placement uses current refs so sequential decoding cannot overwrite earlier files or place overlapping files on the same lane accidentally.
- Video MIME types are rejected. Existing song/stems are not downloaded or separated again.
- Browser test dispatched file drag/drop events with two synthetic WAV files: both decoded and retained names at the same drop time on Audio 3 and Audio 4. A subsequent WAV at ~5 seconds reused Audio 3. A video/mp4 drop produced the rejection message and no clip. TypeScript and audio-timeline tests passed; test tab closed without touching user's local recordings.
# Audio file picker — 2026-09-26

- `Add audio` folder button added beside timeline magnet. Opens a multi-file audio-only picker and inserts at playhead using the shared local import function and collision-aware lanes. Disabled while importing/processing/exporting; input resets so the same file can be chosen again.
- Browser test clicked the actual button, captured the real filechooser, selected `/tmp/ak-picker-test-20260926.wav`, and verified filename and clip at playhead on a new channel. Temporary test tab closed; fresh updated editor tab kept open without reloading user's tab containing local recordings.
- TypeScript passed; deployed to existing Worker and custom domains. No download or stem separation performed. Uncodixfy kept the existing toolbar style.

# Audio trim and split — 2026-09-26

- Audio clips are selectable. Split cuts the selected clip at playhead; Delete targets the selected audio. Edge handles trim either end, with beat snap or free movement and keyboard arrows.
- Non-destructive source offsets are honored by playback and export mixing; waveform reflects the retained source range. Original files are unchanged.
- TypeScript and focused split/trim/export-offset tests passed. Browser verified selection, split into two fragments, and start/end trimming. Isolated test tab closed; user's recording tabs were not reloaded. No song download or stem separation. Uncodixfy preserved toolbar styling.

# Timeline undo and redo — 2026-09-27

- Added Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z and Ctrl+Y, plus toolbar Undo/Redo icons. History tracks lyrics, audio clips and lanes, typography, canvas positioning/background/aspect ratio, watermark, and duration; capped at 100 snapshots. Text entry is not intercepted while an input/contenteditable has focus.
- Toolbar action labels are icon-only; accessible names and hover titles remain. Deployed to the AK Studio Worker and custom domains.

# Transparent adaptive AK logo — 2026-09-27

- Removed the favicon's embedded dark square, gave the transparent favicon a light/dark system appearance, and versioned its URL to refresh browser caches.
- Logo image use throughout the UI blends to its backdrop so the white mark appears dark on light backgrounds and light on dark ones. Removed solid logo-container fills, including the account page mark.

# Account menu and separated settings — 2026-09-27

- The editor profile button opens a compact account popover with Profile, Plans, Font collections, and Sign out; closes on outside click or Escape.
- `/account` now shows basic identity only. Subscription and checkout live at `/account/plans`; saved typography collections remain at `/account/fonts`.
- Confirmed the production profile, plans, and fonts routes render under the signed-in session. Deployment completed to the Worker and custom domains.

# Source bar vertical alignment — 2026-09-27

- Removed inherited vertical padding from the source-bar content grid so the YouTube link field, status, icon, and Create karaoke button center together in the desktop row. Mobile-specific spacing remains unchanged.
- Production build passed with the bundled Node.js runtime.
- Removed the source row's lower divider so it no longer draws a line beneath the controls.

# Profile menu navigation — 2026-09-27

- The menu's Profile, Plans, and Font collections links now use native same-origin navigation. Production's client-side `next/link` handler was throwing a runtime error when clicked, even though `/account/plans` itself rendered correctly.

# Official domain and branded authentication errors — 2026-09-27

- `https://akstudiovocal.com` is now the only application origin. `www` permanently redirects to the apex domain, preserving path and query; application workers.dev and preview URLs are disabled. Build preparation preserves these settings. The separate internal audio processor is unchanged.
- Better Auth base URL, trusted origin, Google callback and JavaScript origin, Google authorized branding domain/homepage, Stripe checkout returns and the existing Stripe webhook destination use the official domain. Existing database, user accounts and webhook signing secret remain unchanged. Stripe is still in test mode; this change does not enable live billing.
- Added `/signin/error` with safe English messages, Try again and Back to home. OAuth errors no longer display Better Auth's default external documentation/Ask AI interface. Google sign-in prevents duplicate clicks and sends failures to the local screen; OAuth state verification remains enabled.
- Production build and TypeScript passed; deployed version `800fe50c-1dac-436e-8919-fa4234326e0c`. Verified official site HTTP 200, www HTTP 308, old app origin HTTP 404, auth error HTTP 302 to the local screen, and webhook HTTP 400 for a missing signature (expected).
- Browser completed Google sign-in with the second account `josan862003@gmail.com` and returned to the official `/studio` editor. Verified the custom error screen and its retry link. Google console still labels the OAuth app as testing with incomplete publication details; successful basic email/profile/openid login was verified, but public branding/publication is not completed in this change.

# Site-wide navigation reliability — 2026-09-27

- Replaced every remaining application `next/link` with native anchors to avoid the production client-router failure: account Studio return, settings tabs, sign-in branding, landing branding, editor branding, and weekly-limit upgrade (now targets `/account/plans`). Existing design unchanged per Uncodixfy.
- Replaced the nonfunctional mock preview button on the landing page with a real editor/sign-in link, preserving its appearance.
- TypeScript and production build passed. Deployed version `f94ffb8c-b9c0-44d0-bacc-93e6ab9efdde`. Browser verified Plans → Studio, editor menu → Profile, settings → Fonts → Plans, plus lyric creation/deletion, undo/redo, aspect ratio, zoom, typeface, alignment, and export menu; no console errors in the isolated editor test. Signed-in home redirects to Studio as designed.
- Controls that require an audio clip remain intentionally disabled without audio; Active is a subscription status, not an action. This navigation pass did not re-download/separate audio, charge a card, record the microphone, or re-test full export.

## 2026-10-26 — Mobile editor controls

Published responsive editor navigation: preview and timeline stay visible; Lyrics, Audio, Style and Saved open as accessible sheets. Phone controls use 44–48px targets and 16px fields; portrait zoom has a dedicated row. Landscape splits preview/timeline and provides a song-link toggle. Audio tools expose separation, import, recording and track ordering without a context menu. Unselected touch clips allow native panning; selected clips retain dragging/trimming. Desktop layout and cloud processing configuration retained.

Validation: TypeScript, Cloudflare build, audio timeline tests and measured export-size tests passed. Isolated synthetic-audio preview inspected at 390×844, 360×640, 844×390 and 1440×900; playback, zoom and all four sheets exercised. Fixed landscape Export label, desktop close icon and small-screen zoom overflow. Browser connection was lost during final confirmation; no physical iOS/Android gesture test. Deployment cb089a73-f0d3-451b-8ec0-c35617f2f0f6; published stylesheet verified over HTTPS (200). No user project or cloud AI model changed.
