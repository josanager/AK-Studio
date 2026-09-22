"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { resamplePeaks } from "../lib/audio-peaks";

type WaveformTrackProps = {
  peaks: number[] | null;
  className?: string;
  /**
   * Timeline zoom min-width (same formula as `.lyric-track`).
   * Applied so the clip participates in scroll/zoom like lyrics.
   */
  minWidth?: string | number;
  /**
   * Clip width as a percent of the timeline (audioDuration / timelineDuration * 100).
   * Defaults to 100 — full song on the same scale as lyrics.
   */
  widthPercent?: number;
  maxBarHeight?: number;
  /** Enable pointer events (hover / context menu) on this clip. */
  interactive?: boolean;
  title?: string;
  "aria-label"?: string;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  children?: ReactNode;
};

/**
 * Renders real audio peaks across the full clip width.
 * Empty/skeleton when peaks are missing — never a decorative fake stub.
 *
 * Layout: stretch like `.lyric-track` (width % of timeline + minWidth for zoom).
 * Do NOT pin `width` to the zoom px value alone — that made the grey box end
 * around ~1:02 while lyrics used the full canvas as 0→duration.
 */
export function WaveformTrack({
  peaks,
  className = "",
  minWidth,
  widthPercent = 100,
  maxBarHeight = 40,
  interactive = false,
  title,
  "aria-label": ariaLabel,
  onContextMenu,
  children,
}: WaveformTrackProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [barCount, setBarCount] = useState(320);
  const pct = Math.max(0.5, Math.min(100, Number.isFinite(widthPercent) ? widthPercent : 100));
  const isPartial = pct < 99.5;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 640;
      // ~2px per bar (bar + gap) so peaks span the full clip at current scale
      setBarCount(Math.max(64, Math.min(1600, Math.floor(w / 2))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minWidth, pct]);

  const bars = useMemo(() => {
    if (!peaks?.length) return null;
    return resamplePeaks(peaks, barCount);
  }, [peaks, barCount]);

  // Scale zoom minWidth when the audio clip is shorter than the timeline.
  let scaledMin: string | number | undefined = minWidth;
  if (minWidth != null && isPartial) {
    if (typeof minWidth === "number") {
      scaledMin = Math.max(48, (minWidth * pct) / 100);
    } else if (typeof minWidth === "string") {
      const m = minWidth.trim().match(/^([\d.]+)px$/i);
      if (m) scaledMin = `${Math.max(48, (parseFloat(m[1]) * pct) / 100)}px`;
    }
  }

  const spanStyle: CSSProperties = {
    left: 0,
    // Full-span clips use left+right like lyric-track; partial clips use explicit %.
    right: isPartial ? "auto" : 0,
    width: isPartial ? `${pct}%` : "100%",
    ...(scaledMin != null ? { minWidth: scaledMin } : {}),
  };

  return (
    <div
      ref={ref}
      className={`wave-track ${className}${bars ? "" : " wave-empty"}${interactive ? " interactive" : ""}`.trim()}
      style={spanStyle}
      aria-hidden={interactive ? undefined : "true"}
      role={interactive ? "group" : undefined}
      title={title}
      aria-label={ariaLabel}
      onContextMenu={onContextMenu}
    >
      {bars?.map((p, i) => (
        <i key={i} style={{ height: Math.max(3, Math.round(p * maxBarHeight)) }} />
      ))}
      {children}
    </div>
  );
}
