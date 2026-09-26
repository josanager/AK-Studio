export type LyricTiming = { start: number; width: number };
export type TimingAction = "move" | "start" | "end";

/** Width is a percentage of the project's duration, not of the zoomed viewport. */
export function editLyricTiming(line: LyricTiming, delta: number, action: TimingAction, duration: number, limit: number, beat: number | null) {
  const minimum = .15;
  const span = Math.max(minimum, line.width / 100 * duration);
  const quantize = (time: number) => beat && beat > 0 ? Math.round(time / beat) * beat : time;
  let start = line.start, end = start + span;
  if (action === "move") {
    start = Math.max(0, Math.min(Math.max(0, limit - span), quantize(start + delta)));
    end = start + span;
  } else if (action === "start") {
    start = Math.max(0, Math.min(end - minimum, quantize(start + delta)));
  } else {
    end = Math.max(start + minimum, Math.min(limit, quantize(end + delta)));
  }
  return { start, width: (end - start) / Math.max(1, duration) * 100 };
}
