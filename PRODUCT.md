# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personas que quieren crear un vídeo de karaoke terminado a partir de una canción publicada en YouTube o YouTube Music, sin preparar manualmente el audio, las letras ni la sincronización.

## Product Purpose

AK Studio convierte un enlace de YouTube o YouTube Music en un proyecto de karaoke editable. El flujo obtiene los metadatos y la letra, prepara dos pistas —voz principal y acompañamiento con coros—, detecta el tempo, alinea letra y compases en la línea de tiempo y permite exportar el vídeo.

El éxito principal es que una persona pueda pasar de enlace a karaoke listo para descargar con una intervención mínima, conservando control fino sobre la letra, el tiempo y la tipografía.

## Positioning

La propuesta combina en un solo flujo la preparación automática de una canción, la separación específica para karaoke, la sincronización de letra asistida por tempo y un editor visual accesible desde el navegador.

## Operating Context

- El proyecto comienza pegando un enlace; no admite carga manual de audio.
- YouTube Music es el origen preferido, con compatibilidad prevista para enlaces públicos de YouTube.
- La línea de tiempo muestra audio, frases de la letra, compases y pulsos musicales.
- El usuario puede editar el texto, la posición temporal y la tipografía de las letras.
- Las sesiones, proyectos, audios y vídeos son efímeros y no se guardan en la cuenta.
- El único contenido creativo persistente del usuario son colecciones de tipografías favoritas.
- La exportación produce un vídeo de karaoke.
- El plan gratuito permite un karaoke por semana y añade una marca de agua.
- El plan de pago elimina la marca de agua y permite exportaciones ilimitadas.

## Capabilities and Constraints

- Nombre confirmado: AK Studio.
- Precio inicial considerado: 13 USD al mes; pendiente de validación competitiva.
- El proveedor premium de separación será Moises.ai o Music.ai; la elección y la clave están pendientes.
- La opción gratuita debe usar un modelo abierto. La implementación de Mosaico confirma que BS-RoFormer puede separar voz principal de acompañamiento con coros.
- La implementación web deberá procesar audio en infraestructura de cómputo externa: Cloudflare Workers no ejecuta modelos pesados de separación ni binarios como yt-dlp o FFmpeg.
- La obtención y el procesamiento de contenido deben limitarse a material propio, con licencia o con autorización del usuario, y respetar las condiciones de la plataforma de origen.
- La pasarela de pago está preparada para Stripe; las credenciales definitivas siguen pendientes.
- Toda la interfaz orientada al usuario se presenta en inglés.
- Para producción a escala, Sites aloja la interfaz y la capa de coordinación; la descarga autorizada, separación y renderizado requieren una cola y cómputo GPU externo.

## Brand Commitments

- Nombre: AK Studio.
- Voz: breve, directa y orientada a acciones.
- Dirección solicitada: minimalista, blanco y negro, con iconos funcionales y muy poco texto.

## Evidence on Hand

- Mosaico contiene lógica probada para normalizar enlaces, extraer audio con yt-dlp, obtener metadatos, buscar letras sincronizadas en LRCLIB, detectar BPM por autocorrelación y separar voz principal mediante BS-RoFormer.
- No hay todavía logotipo, material de marca, testimonios ni datos comerciales validados.
- No deben inventarse cifras de calidad, velocidad o precisión.

## Product Principles

- Un enlace debe convertirse en un proyecto editable con el menor número posible de decisiones.
- La automatización prepara; la línea de tiempo conserva el control creativo.
- La sincronización musical debe ser visible y manipulable, no una caja negra.
- Gratis debe producir un resultado útil; el pago mejora límites y calidad sin bloquear la comprensión del producto.
- Los derechos sobre el material procesado deben quedar claros antes del análisis y la exportación.

## Accessibility & Inclusion

La interfaz debe ser operable con teclado, mantener contraste alto y no comunicar el tempo, la selección o los estados únicamente mediante color.

## Continuidad / handoff IA

El estado vivo, bloqueos y checklist para la siguiente IA están en [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) (sección **Handoff para la siguiente IA**). Actualízalo al cerrar cada entrega.
