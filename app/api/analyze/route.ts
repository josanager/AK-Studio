const allowedHosts = new Set(["youtube.com", "www.youtube.com", "music.youtube.com", "youtu.be", "m.youtube.com"]);

type LyricsRecord = { trackName?: string; artistName?: string; plainLyrics?: string; syncedLyrics?: string; duration?: number };

function lyricLines(record: LyricsRecord | undefined) {
  const value = record?.syncedLyrics || record?.plainLyrics || "";
  return value.split(/\r?\n/).map(line => line.replace(/^(\[[0-9:.]+\])+\s*/, "").trim()).filter(Boolean);
}

export async function POST(request: Request) {
  const body = await request.json() as { url?: string };
  let source: URL;
  try { source = new URL(body.url || ""); } catch { return Response.json({ error: "Pega un enlace válido de YouTube Music." }, { status: 400 }); }
  if (!allowedHosts.has(source.hostname.toLowerCase())) return Response.json({ error: "Por ahora solo se admiten enlaces públicos de YouTube y YouTube Music." }, { status: 400 });
  try {
    const endpoint = new URL("https://www.youtube.com/oembed"); endpoint.searchParams.set("url", source.toString()); endpoint.searchParams.set("format", "json");
    const metadataResponse = await fetch(endpoint, { headers: { "user-agent": "AK Studio/1.0" } });
    if (!metadataResponse.ok) return Response.json({ error: "No pudimos leer esa canción. Comprueba que el enlace sea público." }, { status: 422 });
    const metadata = await metadataResponse.json() as { title?: string; author_name?: string };
    const title = metadata.title?.replace(/\s*[|–-]\s*(official.*|lyrics?.*|audio.*|video.*)$/i, "").trim() || "Nueva canción";
    const artist = metadata.author_name || "YouTube";
    const search = new URL("https://lrclib.net/api/search"); search.searchParams.set("track_name", title); search.searchParams.set("artist_name", artist);
    const lyricsResponse = await fetch(search, { headers: { "user-agent": "AK Studio/1.0" } });
    const records = lyricsResponse.ok ? await lyricsResponse.json() as LyricsRecord[] : [];
    const record = records.find(item => item.trackName?.toLowerCase() === title.toLowerCase()) || records[0];
    return Response.json({ title, artist, lyrics: lyricLines(record).slice(0, 80), processing: { audio: "external_required", tempo: "external_required", stems: "external_required" } });
  } catch { return Response.json({ error: "El servicio de análisis no está disponible ahora. Inténtalo de nuevo." }, { status: 503 }); }
}
