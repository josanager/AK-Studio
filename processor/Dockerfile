FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg unzip libsndfile1 \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir yt-dlp "audio-separator[cpu]" librosa \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

RUN mkdir -p /models && audio-separator --model_filename model_bs_roformer_ep_317_sdr_12.9755.ckpt --model_file_dir /models --download_model_only

WORKDIR /app
COPY server.py /app/server.py
ENV PORT=8080
ENV SEPARATOR_MODEL=model_bs_roformer_ep_317_sdr_12.9755.ckpt
EXPOSE 8080
CMD ["python", "/app/server.py"]
