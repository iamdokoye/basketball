import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Proxies voice recording audio clips to the self-hosted Whisper voice-server.
 * This keeps the server token secret (never sent to the browser) and allows
 * voice scorekeeping on iOS Safari, Android, and desktop browsers alike.
 */
export async function POST(req: Request) {
  const serverUrl = process.env.VOICE_SERVER_URL;
  const token = process.env.VOICE_SERVER_TOKEN ?? process.env.VOICE_TOKEN;

  if (!serverUrl || !token) {
    return NextResponse.json({
      ok: false,
      configured: false,
      error: "Whisper voice server is not configured.",
      setup:
        "To enable Whisper speech recognition, set VOICE_SERVER_URL and VOICE_SERVER_TOKEN in your .env.local (see voice-server/README.md).",
    });
  }

  try {
    const incomingData = await req.formData();
    const audio = incomingData.get("audio");
    const prompt = incomingData.get("prompt")?.toString() ?? "";
    const hotwords = incomingData.get("hotwords")?.toString() ?? "";

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json(
        { ok: false, error: "No audio file provided." },
        { status: 400 },
      );
    }

    const forwardForm = new FormData();
    forwardForm.append("audio", audio, "clip.webm");
    if (prompt) forwardForm.append("prompt", prompt);
    if (hotwords) forwardForm.append("hotwords", hotwords);

    const targetUrl = serverUrl.replace(/\/+$/, "") + "/transcribe";

    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: forwardForm,
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      return NextResponse.json({
        ok: false,
        configured: true,
        error: `Voice server error (${upstream.status}): ${errText || upstream.statusText}`,
      });
    }

    const result = (await upstream.json()) as {
      text: string;
      audioSeconds: number;
      ms: number;
    };

    return NextResponse.json({
      ok: true,
      configured: true,
      text: result.text,
      ms: result.ms,
      audioSeconds: result.audioSeconds,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      configured: true,
      error:
        err instanceof Error
          ? err.message
          : "Could not connect to Whisper voice server.",
    });
  }
}
