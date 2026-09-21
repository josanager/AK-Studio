const allowedHosts = new Set(["youtube.com", "www.youtube.com", "music.youtube.com", "youtu.be", "m.youtube.com"]);
import { getCurrentUser } from "../../auth";
import { getPlanSnapshot } from "../../../lib/plans";

type LyricsRecord = { trackName?: string; artistName?: string; albumName?: string; plainLyrics?: string; syncedLyrics?: string; duration?: number; instrumental?: boolean };
type TimedLyric = { text: string; start: number; end: number };

function extractURL(value: string) {
  const match = value.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) throw new Error("Paste a valid YouTube Music link.");
  return new URL(match[0].replace(/[),.;!?\]}]+$/, ""));
}

function normalize(value: string | undefined) {
  return (value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*(official|lyrics?|audio|video|visualizer|remaster)[^)]*\)/gi, "")
    .replace(/\[[^\]]*(official|lyrics?|audio|video|visualizer|remaster)[^\]]*\]/gi, "")
    .replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
}

function splitYouTubeTitle(rawTitle: string, channel: string) {
  const cleaned = rawTitle.replace(/\s*[|·]\s*(official.*|lyrics?.*|audio.*|video.*|visualizer.*)$/i, "")
    .replace(/\s*[([]\s*(official.*|lyrics?.*|audio.*|video.*|visualizer.*)[)\]]\s*$/i, "").trim();
  const parts = cleaned.split(/\s+[–—-]\s+/, 2);
  if (parts.length === 2) return { artist: parts[0].trim(), title: parts[1].trim() };
  return { artist: channel.replace(/\s+-\s+Topic$/i, "").trim(), title: cleaned || "New song" };
}

function score(record: LyricsRecord, title: string, artist: string) {
  const wantedTitle = normalize(title), wantedArtist = normalize(artist);
  const candidateTitle = normalize(record.trackName), candidateArtist = normalize(record.artistName);
  let value = 0;
  if (candidateTitle === wantedTitle) value += 100;
  else if (candidateTitle.includes(wantedTitle) || wantedTitle.includes(candidateTitle)) value += 40;
  if (candidateArtist === wantedArtist) value += 80;
  else if (candidateArtist.includes(wantedArtist) || wantedArtist.includes(candidateArtist)) value += 30;
  else value -= 80;
  if (record.syncedLyrics) value += 15;
  return value;
}

async function searchLyrics(title: string, artist: string) {
  const requests = [{ track_name: title, artist_name: artist }, { q: `${artist} ${title}` }, { track_name: title }];
  const found: LyricsRecord[] = [];
  for (const params of requests) {
    const endpoint = new URL("https://lrclib.net/api/search");
    Object.entries(params).forEach(([key, value]) => endpoint.searchParams.set(key, value));
    const response = await fetch(endpoint, { headers: { "user-agent": "AK Studio/1.0" } });
    if (!response.ok) continue;
    const records = await response.json() as LyricsRecord[];
    found.push(...records);
    if (records.some(record => record.syncedLyrics)) break;
  }
  return found.sort((a, b) => score(b, title, artist) - score(a, title, artist))[0];
}

function parseLyrics(record: LyricsRecord | undefined): TimedLyric[] {
  const timed = (record?.syncedLyrics || "").split(/\r?\n/).flatMap(line => {
    const matches = [...line.matchAll(/\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g)];
    const text = line.replace(/\[[^\]]+\]/g, "").trim();
    return text ? matches.map(match => ({ text, start: Number(match[1]) * 60 + Number(match[2]), end: 0 })) : [];
  }).sort((a, b) => a.start - b.start);
  if (timed.length) return timed.map((line, index) => ({ ...line, end: timed[index + 1]?.start ?? line.start + 4 }));
  return (record?.plainLyrics || "").split(/\r?\n/).map(text => text.trim()).filter(Boolean)
    .map((text, index) => ({ text, start: index * 4, end: index * 4 + 4 }));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to create a karaoke." }, { status: 401 });
  const plan = await getPlanSnapshot(user);
  if (!plan.canCreate) return Response.json({ error: "Your free karaoke for this week is already used. Upgrade to Pro for unlimited projects.", code: "WEEKLY_LIMIT" }, { status: 429 });
  let source: URL;
  try {
    const body = await request.json() as { url?: string };
    source = extractURL(body.url || "");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Paste a valid YouTube Music link." }, { status: 400 });
  }
  if (!allowedHosts.has(source.hostname.toLowerCase())) return Response.json({ error: "Only public YouTube and YouTube Music links are supported." }, { status: 400 });
  try {
    const endpoint = new URL("https://www.youtube.com/oembed");
    endpoint.searchParams.set("url", source.toString()); endpoint.searchParams.set("format", "json");
    const metadataResponse = await fetch(endpoint, { headers: { "user-agent": "AK Studio/1.0" } });
    if (!metadataResponse.ok) return Response.json({ error: "We could not read that song. Make sure the link is public." }, { status: 422 });
    const metadata = await metadataResponse.json() as { title?: string; author_name?: string; thumbnail_url?: string };
    const parsed = splitYouTubeTitle(metadata.title || "New song", metadata.author_name || "YouTube");
    const record = await searchLyrics(parsed.title, parsed.artist);
    const lyrics = parseLyrics(record).slice(0, 160);
    const duration = record?.duration || (lyrics.length ? Math.ceil(lyrics.at(-1)!.end) : undefined);
    return Response.json({ title: record?.trackName || parsed.title, artist: record?.artistName || parsed.artist,
      album: record?.albumName, duration, lyrics, lyricsSource: record ? "LRCLIB" : null,
      thumbnail: metadata.thumbnail_url, sourceUrl: source.toString(),
      processing: { audio: "processor_required", tempo: "pending", stems: "not_requested" } });
  } catch {
    return Response.json({ error: "The analysis service is temporarily unavailable. Try again." }, { status: 503 });
  }
}
