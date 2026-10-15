# Voice server (speech to text)

A small service that turns a short voice recording into text, using Whisper on the CPU
([faster-whisper](https://github.com/SYSTRAN/faster-whisper)). The Pickup League app's server sends it
the recording plus a hint (player names, nicknames, basketball words) and turns the text into plays.
Phones never talk to it directly, so its password never reaches a browser.

Works on arm64 and amd64. Models are baked into the image, so it starts fast and needs no internet at runtime.

## Deploy on Coolify

1. **New resource** → your Git repository (`basketball`), branch `main`.
2. **Build pack:** Dockerfile. **Base directory:** `/voice-server`. **Dockerfile location:** `/Dockerfile`.
3. **Ports exposes:** `8000`.
4. **Domains:** `https://voice.example.com` ← replace with your real domain. Point its DNS (an A or AAAA record) at the server first; Coolify then gets the HTTPS certificate itself.
5. **Environment variables:**

   | Name | Value |
   |---|---|
   | `VOICE_TOKEN` | **Required.** A long random secret: run `openssl rand -hex 32`. The service refuses to start without one. |
   | `WHISPER_MODEL` | `base.en` (default, fastest) or `small` (more accurate, slower). Both are in the image, so switching is just a redeploy. |
   | `CPU_THREADS` | Threads per clip. Default `8`. Try `4`, `8`, `16` and keep whichever is quickest. |
   | `NUM_WORKERS` | Clips processed at once. Default `2`. |
   | `WHISPER_LANGUAGE` | Default `en`. Empty means auto-detect (slower, less accurate). |

   Optional **build argument** `WHISPER_MODELS` (default `base.en small`): the models to include in the image. Add `small.en` or `medium.en` to try them.
6. **Deploy.** The first build downloads the models, so it takes a few minutes. Plan for about 1 GB of memory with `base.en` and 2 GB with `small`.

Then check it:

```bash
curl https://voice.example.com/health
# {"ok":true,"model":"base.en"}
```

Later, in Vercel (once the app is connected to it), you will add `VOICE_SERVER_URL=https://voice.example.com` and `VOICE_SERVER_TOKEN=<the same secret>`.

## Try it by hand

```bash
curl https://voice.example.com/transcribe \
  -H "Authorization: Bearer YOUR_VOICE_TOKEN" \
  -F audio=@clip.webm \
  -F "prompt=Basketball pickup game. Players: Daniel Okoye, also called Chibikes. Joe. Ephraim."
# {"text":"Daniel scores two, assisted by Joe.","audioSeconds":2.8,"ms":540}
```

`ms` is the time the server spent, so use it to compare models and `CPU_THREADS` on your own hardware.
Accepts webm, ogg, m4a/mp4, wav and mp3, up to 2 MB and 20 seconds.

## Getting the best accuracy

The `prompt` is what fixes names. Listing each player once, with their nickname spelled out ("Daniel Okoye,
also called Chibikes"), turned "E-frame" into "Ephraim" and "wheelchair bike" into "Chibikes" in testing.
Without it, Whisper guesses at unusual names. The app builds this prompt from the roster for you.

## Run it without Docker (for development)

```bash
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
VOICE_TOKEN=some-long-secret MODEL_DIR=./models WHISPER_MODEL=base.en .venv/bin/uvicorn main:app --port 8000
```
