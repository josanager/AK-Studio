# Resultado de prueba Modal L4 — 25 octubre 2026

Prueba real en Modal, sin inferencia local ni cambio de producción.
App final completada: https://modal.com/apps/josanager/main/ap-leuRRd8jvnzf3ecfrc9lHm

| Medición | Resultado |
| --- | --- |
| Entrada sintética estéreo | 30 s, 44.1 kHz, PCM16 |
| GPU | NVIDIA L4, 23034 MiB |
| Primera separación | 6.436 s |
| Segunda separación | 5.657 s |
| Tercera separación | 5.666 s |
| Mediana de pasadas calientes | 5.662 s |
| Carga del modelo | 5.088 s |
| Llamada remota completa (3 pasadas + arranque/imports/entrada/carga/validación) | 43.643 s |
| Pico de memoria GPU | 1.666 GiB |

El tiempo remoto completo no incluye la construcción inicial de la imagen.
No representa la latencia de una sola canción. Se validaron dos pistas
estéreo de 30 segundos en cada pasada. No se descargaron pistas al Mac;
solo se recibió JSON de métricas. La imagen y el modelo se prepararon en Modal.

Mismo checkpoint `mel_band_roformer_karaoke_aufr33_viperx_sdr_10.1956.ckpt`,
audio-separator 0.47.0, FP32, batch 1, overlap 2, sin autocast ni TF32.
PyTorch 2.8.0+cu128. Checkpoint SHA256:
`1de20d459332fe8869aeb01327a31df0032262706e1365114e852dc271779813`.
Entrada SHA256:
`a5a4633dcc68c63734bdb1f88daf45d00e0d489ec1772171db2a6243ab8d3afb`.

No es una evaluación de calidad con voces reales ni una comparación con la
CPU de Cloudflare usando la misma entrada. No extrapolar como tiempo
garantizado por canción ni afirmar un factor de aceleración frente a la web.
Sí confirma que nuestro modelo ejecuta CUDA en L4 y termina la muestra
aproximadamente 5.3 veces más rápido que la duración del audio, en caliente.

## Límites y recursos

- Créditos desbloqueados $30; spend limit guardado y verificado $0.
- Usage limit guardado $2 de créditos para esta prueba.
- Una GPU por app, cero instancias permanentes, sin volúmenes persistentes,
  sin despliegue público, sin integración R2 ni credenciales de Cloudflare.
- Sonda L4 exitosa `ap-kRI4wlCLGVSLN8SSHvO7nU`.
- Primera medición `ap-UkLeOaFKQZK3s09qiVWd1n` completó inferencia, pero
  falló al deserializar `torch.__version__` (TorchVersion) en el cliente ligero.
  Corregido devolviendo `str(torch.__version__)`; segunda medición exitosa.
- Todas las apps son efímeras; SDK confirmó terminación. El panel de crédito
  puede tardar en reflejar todo el consumo. No se afirma un cargo final a
  partir de la tarifa GPU sola.

Siguiente paso antes de migrar: medir una canción autorizada representativa,
evaluar auditivamente las pistas y transferencias R2, luego integrar cola,
cancelación, errores y devolución de resultados. Esta prueba no migra la web.
