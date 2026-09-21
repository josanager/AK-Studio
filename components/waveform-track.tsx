"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resamplePeaks } from "../lib/audio-peaks";

type WaveformTrackProps = {
  peaks: number[] | null;
  className?: string;
  /** Timeline content min-width so the clip stretches with zoom like lyric clips. */
  minWidth?: string | number;
  maxBarHeight?: number;
};

/**
 * Renders real audio peaks across the full clip width.
 * Empty/skeleton when peaks are missing — never a decorative fake stub.
 */
export function WaveformTrack({
  peaks,
  className = "",
  minWidth,
  maxBarHeight = 40,
}: WaveformTrackProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [barCount, setBarCount] = useState(320);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 640;
      // ~2.5px per bar (bar + gap) so peaks span the full clip at current scale
      setBarCount(Math.max(48, Math.min(1400, Math.floor(w / 2.5))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minWidth]);

  const bars = useMemo(() => {
    if (!peaks?.length) return null;
    return resamplePeaks(peaks, barCount);
  }, [peaks, barCount]);

  return (
    <div
      ref={ref}
      className={`wave-track ${className}${bars ? "" : " wave-empty"}`.trim()}
      style={minWidth != null ? { minWidth } : undefined}
      aria-hidden="true"
    >
      {bars?.map((p, i) => (
        <i key={i} style={{ height: Math.max(3, Math.round(p * maxBarHeight)) }} />
      ))}
    </div>
  );
}
