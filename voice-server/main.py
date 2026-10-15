"""Speech-to-text service for Pickup League voice entry.

The app's server sends a short recording plus a hint (player names, nicknames, basketball words) and
gets text back, which the app turns into plays. Runs Whisper on the CPU through faster-whisper.
"""

import hmac
import io
import logging
import os
import time

import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from faster_whisper import WhisperModel

log = logging.getLogger("voice")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

MODEL = os.getenv("WHISPER_MODEL", "base.en")
MODEL_DIR = os.getenv("MODEL_DIR", "/models")
COMPUTE = os.getenv("WHISPER_COMPUTE", "int8")
THREADS = int(os.getenv("CPU_THREADS", "8"))  # threads per transcription
WORKERS = int(os.getenv("NUM_WORKERS", "2"))  # transcriptions that can run at once
LANGUAGE = os.getenv("WHISPER_LANGUAGE", "en") or None  # empty = detect (slower, less accurate)
TOKEN = os.getenv("VOICE_TOKEN", "")
MAX_BYTES = int(os.getenv("MAX_AUDIO_BYTES", str(2 * 1024 * 1024)))
MAX_SECONDS = float(os.getenv("MAX_AUDIO_SECONDS", "20"))

if len(TOKEN) < 16:
    # Fail closed: an open transcription endpoint would be free compute for anyone who finds it.
    raise RuntimeError("Set VOICE_TOKEN to a secret of at least 16 characters.")

log.info("Loading model %s (%s, %d threads, %d workers)", MODEL, COMPUTE, THREADS, WORKERS)
model = WhisperModel(
    MODEL,
    device="cpu",
    compute_type=COMPUTE,
    cpu_threads=THREADS,
    num_workers=WORKERS,
    download_root=MODEL_DIR,
)
# Warm up so the first real clip isn't slow.
list(model.transcribe(np.zeros(16000, dtype=np.float32), language=LANGUAGE)[0])
log.info("Ready")

app = FastAPI(title="Pickup League voice", docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL}


@app.post("/transcribe")
def transcribe(
    audio: UploadFile = File(...),
    prompt: str = Form(""),
    hotwords: str = Form(""),
    authorization: str = Header(default=""),
):
    if not hmac.compare_digest(authorization.encode(), f"Bearer {TOKEN}".encode()):
        raise HTTPException(status_code=401, detail="unauthorized")

    data = audio.file.read(MAX_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="empty audio")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="audio too large")

    started = time.perf_counter()
    try:
        segments, info = model.transcribe(
            io.BytesIO(data),
            language=LANGUAGE,
            beam_size=1,  # greedy: fastest, and plenty for short clips
            temperature=0.0,
            condition_on_previous_text=False,
            without_timestamps=True,
            vad_filter=True,  # drop silence so we only process speech
            vad_parameters={"min_silence_duration_ms": 300, "speech_pad_ms": 200},
            initial_prompt=prompt.strip()[:800] or None,
            hotwords=hotwords.strip()[:400] or None,
        )
        if info.duration > MAX_SECONDS:
            raise HTTPException(status_code=413, detail="audio too long")
        text = " ".join(s.text.strip() for s in segments).strip()
    except HTTPException:
        raise
    except Exception:
        log.exception("could not transcribe")
        raise HTTPException(status_code=422, detail="could not read that audio")

    ms = round((time.perf_counter() - started) * 1000)
    log.info("%.1fs of audio -> %d ms: %s", info.duration, ms, text)
    return {"text": text, "audioSeconds": round(info.duration, 2), "ms": ms}
