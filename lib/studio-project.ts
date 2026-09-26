/** Shared studio draft payload stored in D1 `projects.timeline_json` (~24h TTL). */

export type StudioLyric = { text: string; start: number; width: number };

export type StudioProjectState = {
  background?: import('./studio-background').StudioBackground;
  url: string;
  track: { title: string; artist: string };
  lyrics: StudioLyric[];
  duration: number;
  analyzed: boolean;
  audioId: string | null;
  audioUrl: string | null;
  backingUrl: string | null;
  vocalUrl: string | null;
  model: string | null;
  bpm: number | null;
  aspect: "16:9" | "9:16" | "1:1";
  exportQuality: "4K" | "2K" | "1080";
  exportFps: 30 | 60;
  font: string;
  fontSize: number;
  lineHeight: number;
  textStyle: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    align: "left" | "center" | "right";
    color: string;
  };
  textPosition: { x: number; y: number };
  stemMuted: { backing: boolean; vocal: boolean };
  position: number;
  zoom: number;
  selected: number;
};

export type SavedProjectSummary = {
  id: string;
  name: string;
  updatedAt: number;
  expiresAt: number | null;
  title: string;
  artist: string;
  hasAudio: boolean;
};

export const PROJECT_TTL_SECONDS = 24 * 60 * 60;

export function emptyStudioProject(): StudioProjectState {
  return {
    url: "",
    track: { title: "", artist: "" },
    lyrics: [],
    duration: 240,
    analyzed: false,
    audioId: null,
    audioUrl: null,
    backingUrl: null,
    vocalUrl: null,
    model: null,
    bpm: null,
    aspect: "16:9",
    exportQuality: "1080",
    exportFps: 30,
    font: "Avenir Next",
    fontSize: 72,
    lineHeight: 0.94,
    textStyle: { bold: true, italic: false, underline: false, align: "center", color: "#fff" },
    textPosition: { x: 50, y: 50 },
    stemMuted: { backing: false, vocal: true },
    position: 0,
    zoom: 62,
    selected: -1,
  };
}

export function parseStudioProject(raw: string | null | undefined): StudioProjectState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<StudioProjectState>;
    if (!data || typeof data !== "object") return null;
    const base = emptyStudioProject();
    return {
      ...base,
      ...data,
      track: { ...base.track, ...(data.track || {}) },
      lyrics: Array.isArray(data.lyrics) ? data.lyrics : [],
      textStyle: { ...base.textStyle, ...(data.textStyle || {}) },
      textPosition: { ...base.textPosition, ...(data.textPosition || {}) },
      stemMuted: { ...base.stemMuted, ...(data.stemMuted || {}) },
      exportQuality: data.exportQuality === "4K" || data.exportQuality === "2K" || data.exportQuality === "1080" ? data.exportQuality : base.exportQuality,
      exportFps: data.exportFps === 60 ? 60 : 30,
    };
  } catch {
    return null;
  }
}
