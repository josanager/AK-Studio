export type SongIdentity = { title: string; artist: string; duration?: number };
export type LyricsRecord = { trackName?: string; artistName?: string; albumName?: string; plainLyrics?: string; syncedLyrics?: string; duration?: number; instrumental?: boolean };
export type TimedLyric = { text: string; start: number; end: number };
const decoration = /\s*[([][^)\]]*(?:official|lyrics?|audio|video|visualizer|remaster)[^)\]]*[)\]]/gi;
// YouTube often appends the original artists as mashup credits, not as
// part of the catalog title. Keep meaningful version labels such as "Live".
export function lyricsTitle(value: string) {
  return value.replace(decoration, "").replace(/\s*[([][^)\]]*\bmashup\b[^)\]]*[)\]]/gi, "").trim();
}
export function normalizeSong(value = "") {
  return lyricsTitle(value).normalize("NFKD").replace(/\p{M}/gu, "").normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();
}
export function identifySong(rawTitle: string, channel: string): SongIdentity {
  const artist = channel.replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim();
  const cleaned = rawTitle.replace(decoration, "").replace(/\s*[|·]\s*(?:official|lyrics?|audio|video|visualizer).*$/i, "").trim();
  const by = cleaned.match(/^"?(.+?)"?\s+by\s+(.+)$/i);
  if (by) return { title: by[1].replace(/^"|"$/g, "").trim(), artist: by[2].trim() };
  const parts = cleaned.split(/\s+[–—-]\s+/);
  if (parts.length >= 2) {
    const left = parts.shift()!.trim(), right = parts.join(" - ").trim();
    if (normalizeSong(right) === normalizeSong(artist)) return { title: left, artist };
    return { artist: left, title: right };
  }
  return { artist: artist || "YouTube", title: cleaned || "New song" };
}
function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const x = new Set(a.split(" ")), y = new Set(b.split(" "));
  return 2 * [...x].filter(word => y.has(word)).length / (x.size + y.size);
}
export function selectLyrics(records: LyricsRecord[], song: SongIdentity): LyricsRecord | undefined {
  const title = normalizeSong(song.title), artist = normalizeSong(song.artist);
  const ranked = records.flatMap(record => {
    if (record.instrumental || !(record.syncedLyrics?.trim() || record.plainLyrics?.trim())) return [];
    const titleMatch = similarity(title, normalizeSong(record.trackName));
    const artistMatch = similarity(artist, normalizeSong(record.artistName));
    if (titleMatch < .72 || artistMatch < .55) return [];
    const durationDiff = song.duration && record.duration ? Math.abs(song.duration - record.duration) : 0;
    return [{ record, score: titleMatch * 140 + artistMatch * 100 + (record.syncedLyrics?.trim() ? 12 : 0) - Math.min(35, durationDiff / 3) }];
  });
  return ranked.sort((a, b) => b.score - a.score)[0]?.record;
}
async function search(params: Record<string, string>): Promise<LyricsRecord[]> {
  const endpoint = new URL("https://lrclib.net/api/search");
  Object.entries(params).forEach(([key, value]) => endpoint.searchParams.set(key, value));
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try { response = await fetch(endpoint, { headers: { "user-agent": "AK Studio/1.0 (akstudiovocal.com)" }, signal: AbortSignal.timeout(6000) }); }
    catch (error) { if (attempt) throw error; await new Promise(resolve=>setTimeout(resolve,400)); continue; }
    if (!response.ok) {
      console.warn("Lyrics upstream HTTP", response.status);
      if (!attempt && [408,425,429,500,502,503,504].includes(response.status)) { await new Promise(resolve=>setTimeout(resolve,400)); continue; }
      throw new Error(`Lyrics service returned ${response.status}`);
    }
    const records: unknown = await response.json();
    if (!Array.isArray(records)) throw new Error("Lyrics service returned an invalid catalog response.");
    return records.filter(r => r && typeof r === "object");
  }
  throw new Error("Lyrics service is temporarily unavailable.");
}
export async function findLyrics(song: SongIdentity) {
  song = { ...song, title: lyricsTitle(song.title) };
  const found: LyricsRecord[] = [];
  let reachable = false;
  try { found.push(...await search({ track_name: song.title, artist_name: song.artist })); reachable = true; } catch(error) { console.warn("Lyrics primary lookup failed", error instanceof Error ? error.name : "lookup"); }
  let best = selectLyrics(found, song);
  if (best?.syncedLyrics && normalizeSong(best.trackName) === normalizeSong(song.title) && normalizeSong(best.artistName) === normalizeSong(song.artist)) return { record: best, unavailable: false };
  const alternatives = await Promise.allSettled([search({ q: `${song.artist} ${song.title}` }), search({ track_name: song.title })]);
  for (const result of alternatives) if (result.status === "fulfilled") { found.push(...result.value); reachable = true; }
  best = selectLyrics(found, song);
  if (!best) console.warn("Lyrics lookup result", { reachable, candidates: found.length });
  return { record: best, unavailable: !reachable };
}
export function parseLyrics(record?: LyricsRecord): TimedLyric[] {
  const timed = (record?.syncedLyrics || "").split(/\r?\n/).flatMap(line => {
    const matches = [...line.matchAll(/\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g)];
    const text = line.replace(/\[[^\]]+\]/g, "").trim();
    return text ? matches.map(match => ({ text, start: Number(match[1]) * 60 + Number(match[2]), end: 0 })) : [];
  }).sort((a, b) => a.start - b.start);
  if (timed.length) return timed.map((line, i) => ({ ...line, end: timed[i + 1]?.start ?? line.start + 4 }));
  const plain = (record?.plainLyrics || "").split(/\r?\n/).map(text => text.trim()).filter(Boolean);
  const span = record?.duration && plain.length ? record.duration / plain.length : 4;
  return plain.map((text, i) => ({ text, start: i * span, end: (i + 1) * span }));
}
