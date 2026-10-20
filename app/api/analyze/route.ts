import { getCurrentUser } from "../../auth";
import { getPlanSnapshot } from "../../../lib/plans";
import { findOwnedStem } from "../../../lib/audio-stems";
import { findLyrics, identifySong, parseLyrics, type SongIdentity } from "../../../lib/lyrics";
import { youtubeVideoId } from "../../../lib/youtube-download";

const allowedHosts = new Set(["youtube.com", "www.youtube.com", "music.youtube.com", "youtu.be", "m.youtube.com"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to create a karaoke." }, { status: 401 });
  let body: { url?: string; audioId?: string; title?: string; artist?: string; duration?: number };
  let source: URL;
  try {
    body = await request.json();
    const match = (body.url || "").match(/https?:\/\/[^\s<>"']+/i);
    source = new URL((match?.[0] || "").replace(/[),.;!?\]}]+$/, ""));
    if (!allowedHosts.has(source.hostname.toLowerCase()) || !youtubeVideoId(source)) throw new Error();
  } catch { return Response.json({ error: "Paste a valid public YouTube or YouTube Music song link." }, { status: 400 }); }
  const stored = typeof body.audioId === "string" && /^[0-9a-f-]{36}$/i.test(body.audioId)
    ? await findOwnedStem(body.audioId, "original", user.userId) : null;
  if (!stored && !(await getPlanSnapshot(user)).canCreate) return Response.json({ error: "Your free karaoke for this week is already used. Upgrade to Pro for unlimited projects.", code: "WEEKLY_LIMIT" }, { status: 429 });
  let song: SongIdentity | null = stored && typeof body.title === "string" && typeof body.artist === "string"
    ? { ...identifySong(body.title.slice(0, 300), body.artist.slice(0, 200)), duration: body.duration } : null;
  let thumbnail: string | undefined;
  if (!song) {
    try {
      const endpoint = new URL("https://www.youtube.com/oembed");
      endpoint.searchParams.set("url", `https://www.youtube.com/watch?v=${youtubeVideoId(source)}`);
      endpoint.searchParams.set("format", "json");
      const response = await fetch(endpoint, { headers: { "user-agent": "AK Studio/1.0" }, signal: AbortSignal.timeout(8000) });
      if (response.ok) {
        const metadata = await response.json() as { title?: string; author_name?: string; thumbnail_url?: string };
        if (metadata.title) song = identifySong(metadata.title, metadata.author_name || "YouTube");
        thumbnail = metadata.thumbnail_url;
      }
    } catch { /* the downloader can still supply song details */ }
  }
  if (!song) return Response.json({ title: "New song", artist: "YouTube", lyrics: [], lyricsSource: null, metadataPending: true,
    warning: "Song details will be read during download.", sourceUrl: source.toString() });
  const { record, unavailable } = await findLyrics(song);
  const lyrics = parseLyrics(record).slice(0, 300);
  return Response.json({ title: record?.trackName || song.title, artist: record?.artistName || song.artist,
    duration: record?.duration || song.duration, album: record?.albumName, lyrics, lyricsSource: record ? "LRCLIB" : null,
    thumbnail, sourceUrl: source.toString(),
    warning: lyrics.length ? null : unavailable ? "Lyrics are temporarily unavailable. Audio download can continue." : "No matching lyrics found. You can add lyrics manually.",
    processing: { audio: "download_on_create", tempo: "pending", stems: "optional" } });
}
