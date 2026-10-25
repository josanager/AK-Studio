# Prueba con música real — 25 octubre 2026

Referencia: **Let's Go Fishin' — Karissa Hobbs**, folk/pop con voz e instrumentos.
Grabación completa de **132.989 segundos**, estéreo, 44.1 kHz, descargada
por el worker de Modal mediante `librosa.ex("fishin", hq=True)`.
Licencia [CC-BY 3.0](https://raw.githubusercontent.com/librosa/data/main/audio/Karissa_Hobbs_-_Lets_Go_Fishin.txt).
No se usó ni modificó el proyecto abierto del usuario.

Mismo Mel-RoFormer Karaoke, checkpoint, FP32, batch 1, overlap 2 de la
prueba sintética. CUDA L4, audio-separator 0.47.0 / torch 2.8.0+cu128.
No cambios de calidad para obtener estos tiempos.

## Separación y escritura de dos FLAC

| Entrada real | Tiempo observado |
| --- | --- |
| Canción completa, primera pasada | 25.648 s |
| Canción completa, modelo ya cargado | 25.034 s |
| Fragmento de 30 s | 5.719 s |
| Fragmento de 60 s | 10.957 s |

En el worker: descarga y decodificación 0.594 s; carga del modelo 5.335 s.
Primera canción lista 37.755 s después de empezar la función remota.
Toda la batería (cuatro separaciones) tardó 86.723 s vistos por el cliente.
No confundir esa cifra con una sola canción.

App completada: https://modal.com/apps/josanager/main/ap-bt8fkkNgxUnO3RalFyxDwt
JSON bruto: `outputs/modal-music-benchmark.json` (ignorado por Git).

## Trabajo único desde una GPU nueva

Una segunda app aislada, sin modelo en memoria, ejecutó únicamente la canción
completa. Separación: **26.041 s**. Tiempo total desde la llamada del cliente
hasta obtener el informe: **128.625 s**. Ejecución dentro de la función:
40.570 s, incluida carga/importación, descarga, escritura y validación.
La diferencia de 88.055 s ocurre fuera del cuerpo medido de la función
(asignación/arranque/infraestructura/transporte); no se atribuye a una causa
específica sin trazas adicionales. Incluye 2.6 s de hash final del checkpoint,
que es propio del benchmark, no un requisito de producción por canción.

App completada: https://modal.com/apps/josanager/main/ap-I4pyOVkhdbzWMWF55ylRjk
JSON bruto: `outputs/modal-music-cold.json`.

Se repitió en otra app nueva para no basarse en un solo arranque:
**150.962 s de tiempo total**, 40.048 s dentro de la función y 37.326 s
hasta tener los archivos validados dentro del worker. La espera externa
volvió a ser dominante (110.914 s). Ver
https://modal.com/apps/josanager/main/ap-PFw6li8jYkR6sr2lO4q8gB y
`outputs/modal-music-cold-repeat.json`.

Conclusión observada para esta canción: **unos 25–26 s separando con el
modelo listo**, frente a **2 min 9 s–2 min 31 s para un trabajo completo
desde cero** en estas dos ejecuciones. El segundo rango no es un SLA ni
una garantía para otros audios o momentos. No presentar 25 s como latencia
de principio a fin de AK Studio.

## Validación y alcance

Cada separación produjo dos FLAC estéreo, con duración igual a la entrada,
muestras finitas y señal no silenciosa. La canción completa produjo
12,730,119 bytes de backing y 6,419,882 bytes de lead. Pico GPU: 1.666 GiB.
Es validación técnica, no una evaluación auditiva de calidad o de supresión
de voces. Los archivos temporales permanecieron en Modal y se descartaron
al terminar las apps. El Mac solo ejecutó el cliente de control.

Fuente SHA256: `85901bde0bc5f2cad28acb83487ccf99bd6908d7359f1a449fd799d8bebb3319`.
Checkpoint SHA256: `1de20d459332fe8869aeb01327a31df0032262706e1365114e852dc271779813`.

No incluye YouTube, transferencias R2 ni cola de AK Studio: no es un tiempo
final garantizado para producción. La web aún no usa Modal. No se mide un
factor frente a CPU Cloudflare sin ejecutar la misma entrada allí.
Mantener el modelo caliente puede reducir arranques, pero genera consumo
durante la espera; no se activó capacidad permanente.

## Reproducir (solo con crédito y spend limit $0 verificados)

```sh
/tmp/ak-modal-benchmark-venv/bin/modal run --profile ak-studio-benchmark processor/modal_benchmark.py::music --credits-verified
/tmp/ak-modal-benchmark-venv/bin/modal run --profile ak-studio-benchmark processor/modal_benchmark.py::coldmusic --credits-verified
```
