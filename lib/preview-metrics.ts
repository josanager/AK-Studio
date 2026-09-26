import type {PreviewTypographyMetrics} from './export-video';

/** Measure the rendered CSS, including when the playhead is in a lyric gap. */
export function measurePreview(stage: HTMLElement, typography: {font: string; fontSize: number; lineHeight: number; bold: boolean; italic: boolean}): PreviewTypographyMetrics {
  let probe: HTMLElement | undefined;
  let container = stage.querySelector<HTMLElement>('.lyric-canvas');
  if (!container) {
    probe = document.createElement('div');
    probe.className = 'lyric-canvas';
    Object.assign(probe.style, {visibility:'hidden',pointerEvents:'none',fontFamily:typography.font,fontSize:`${typography.fontSize}px`,lineHeight:String(typography.lineHeight),fontWeight:typography.bold?'700':'500',fontStyle:typography.italic?'italic':'normal'});
    const p = document.createElement('p');p.textContent = 'Preview typography';probe.appendChild(p);stage.appendChild(probe);container = probe;
  }
  try {
    const text = container.querySelector('p')!;
    const box = stage.getBoundingClientRect(), css = getComputedStyle(text), parent = getComputedStyle(container);
    const number = (v: string) => Number.parseFloat(v) || 0;
    const fontSizePx = number(css.fontSize);
    const padding = number(parent.paddingLeft) + number(parent.paddingRight);
    // Do not use this phrase's shrink-to-fit width as the wrapping limit for other phrases.
    const parentMax = parent.maxWidth.endsWith('%') ? number(parent.maxWidth) / 100 * box.width : number(parent.maxWidth) || box.width * .82;
    const maxWidthPx = Math.max(1, Math.min(number(css.maxWidth) || box.width, parentMax - padding));
    const result: PreviewTypographyMetrics = {stageWidth:box.width,stageHeight:box.height,fontSizePx,lineHeightPx:number(css.lineHeight)||fontSizePx*typography.lineHeight,letterSpacingPx:number(css.letterSpacing),maxWidthPx,lyricHorizontalPaddingPx:padding,underlineGapPx:0,fontFamily:css.fontFamily,fontWeight:css.fontWeight,fontStyle:css.fontStyle};
    const title = stage.querySelector<HTMLElement>('.stage-meta span');
    if (title) {
      const r = title.getBoundingClientRect(), s = getComputedStyle(title);
      result.title = {x:r.left-box.left,y:r.top-box.top,fontSize:number(s.fontSize),lineHeight:number(s.lineHeight),fontFamily:s.fontFamily,fontWeight:s.fontWeight,letterSpacing:number(s.letterSpacing),color:s.color};
    }
    const logo = stage.querySelector<HTMLElement>('.stage-watermark-logo');
    if (logo) {const r=logo.getBoundingClientRect();result.logo={x:r.left-box.left,y:r.top-box.top,width:r.width,height:r.height,opacity:Number.parseFloat(getComputedStyle(logo).opacity)}}
    return result;
  } finally {probe?.remove()}
}
