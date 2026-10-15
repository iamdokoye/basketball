# Whisper speech-to-text service. Builds for arm64 and amd64.
#
# Models are baked into the image, and WHISPER_MODEL (a normal environment variable) picks which one
# runs, so you can switch without rebuilding. Bigger = more accurate but slower:
#   tiny.en, base.en (default), small.en, small, medium.en
FROM python:3.12-slim

# Space-separated list of models to include in the image (Coolify: Build Arguments).
ARG WHISPER_MODELS="base.en small"
ENV WHISPER_MODEL=base.en \
    MODEL_DIR=/models \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HUB_DISABLE_TELEMETRY=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# Bake the models in so the container starts fast and never downloads at runtime.
RUN python -c "import os; from faster_whisper import download_model; [download_model(m, cache_dir=os.environ['MODEL_DIR']) for m in '${WHISPER_MODELS}'.split()]"

COPY main.py .

RUN useradd --create-home app && chown -R app /models
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)" || exit 1

# One process: the model lives in memory once, and requests run on a thread pool.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
