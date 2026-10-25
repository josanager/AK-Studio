# Prueba aislada de GPU L4

## Estado verificado el 25 de octubre de 2026

- Workspace `josanager`, correo `josanager@gmail.com`, plan Starter.
- Crédito desbloqueado $1; límite de uso $1; gasto mostrado $0.
- Onboarding completado para AK Studio Vocal, Inference (Audio).
- SDK Modal 1.6.2 en un entorno virtual temporal; perfil
  `ak-studio-benchmark`, autorización del usuario con caducidad de una hora.
  No se guardan credenciales en este repositorio.
- Sonda mínima `modal_gpu_probe.py` rechazada antes de arrancar GPU:
  `Please add a payment method to use L4 GPU functions.`
- App efímera `ap-jyXQ0DHhLyQaY5gJC3U4rf` detenida. No benchmark real,
  no imagen grande construida y ningún resultado de velocidad todavía.
- Para continuar, el usuario debe añadir un método de pago en Modal.
  El diálogo oficial indica un cargo de verificación de $0.50 reembolsable;
  no cumple una condición estricta de cero desembolso inicial. Se dejó
  abierto ese aviso, sin pasar al formulario de tarjeta ni realizar cargos.
  Después verificar créditos desbloqueados y guardar spend limit $0
  antes de ejecutar. No asumir que añadir tarjeta garantiza cero cargos.

## Alcance

No cambia Cloudflare ni despliega endpoints públicos. No ejecuta IA en el Mac.
El SDK local solo envía código y recibe métricas. El audio sintético se genera
en Modal y se descarta junto con sus pistas al terminar.

## Antes de ejecutar

1. Verificar en Modal el saldo de créditos aplicables y la habilitación de GPU.
   El anuncio de $30/mes no significa que estén todos desbloqueados: una cuenta
   nueva puede tener solo $1 y requerir método de pago para los $29 restantes.
2. Fijar **Workspace spend limit = $0** en Usage & Billing y comprobar que se
   guardó. Limitar también el usage budget (consumo antes de créditos) a $1
   para esta prueba, si el panel lo permite. No confundir ambos límites.
3. Si Modal exige tarjeta o no permite garantizar $0 de cargos, parar. No
   contratar otro servicio ni activar recargas. El usuario pidió no gastar.
4. Autorizar el SDK en la cuenta correcta sin copiar tokens a chat o Git.

## Ejecución

```sh
python3 -m venv /tmp/ak-modal-benchmark-venv
/tmp/ak-modal-benchmark-venv/bin/pip install modal==1.6.2
/tmp/ak-modal-benchmark-venv/bin/modal token new --profile ak-studio-benchmark --expires-in 1h
/tmp/ak-modal-benchmark-venv/bin/modal run --profile ak-studio-benchmark processor/modal_gpu_probe.py --credits-verified
/tmp/ak-modal-benchmark-venv/bin/modal run --profile ak-studio-benchmark processor/modal_benchmark.py --credits-verified
```

Usar `modal run`, no `modal deploy` ni `--detach`: la app es efímera y se
detiene al salir. Una L4, máximo un contenedor, cero instancias permanentes,
sin reintentos automáticos y timeout de 15 minutos por invocación. El timeout
no limita el coste de construir la imagen; el límite del workspace es esencial.

Mantiene audio-separator 0.47.0, checkpoint Mel-RoFormer Karaoke, FP32,
batch 1 y overlap 2. CUDA habilitado; falla si cae a CPU silenciosamente.
El paquete conserva el extra `[cpu]` del servidor para las dependencias ONNX:
el modelo RoFormer usa PyTorch CUDA, comprobado antes de medir.

Genera 30 segundos sintéticos y hace tres pasadas consecutivas sobre el mismo
modelo cargado. Registra carga, primera pasada, dos pasadas calientes,
VRAM, hashes de entrada/checkpoint y tiempo remoto total. Verifica dos
pistas estéreo con duración correcta. Resultados en `outputs/` (ignorado).

No es una prueba de calidad musical ni justifica un factor de aceleración
respecto a Cloudflare sin medir allí la misma muestra y ajustes. La CPU de
Modal tampoco sería una comparación exacta con la CPU de Cloudflare.
Una prueba posterior con música autorizada debe incluir escucha, tiempo de
transferencia desde/hacia R2 y medición del coste real del panel.

Referencias: https://modal.com/pricing · https://modal.com/docs/guide/budgets
· https://modal.com/docs/guide/gpu
