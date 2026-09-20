---
name: AK Studio
description: A precise monochrome karaoke editing workspace.
colors:
  ink: "#111111"
  paper: "#ffffff"
  workspace: "#f3f3f1"
  muted: "#777777"
  divider: "#d8d8d3"
  tempo: "#e23434"
typography:
  body:
    fontFamily: "Avenir Next Condensed, Avenir Next, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "Avenir Next Condensed, Avenir Next, sans-serif"
    fontSize: "11px"
    fontWeight: 600
rounded:
  sm: "4px"
  md: "7px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "22px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    height: "34px"
---

# Design System: AK Studio

## Overview

**Creative North Star: "The Monochrome Edit Suite"**

AK Studio should feel like a focused production tool: dense, quiet, precise, and immediately usable. Black and warm white define the working hierarchy; borders and tonal surfaces organize the editor without decorative cards.

**Key Characteristics:**
- Monochrome, compact, professional.
- Icons carry frequent actions; labels clarify consequential ones.
- Red is reserved for musical tempo markers.
- The karaoke preview remains the darkest and strongest visual field.

## Colors

The palette is neutral and functional. Ink drives active controls, paper carries panels, workspace gray separates editing regions, and the tempo accent is intentionally rare.

**The Tempo-Only Rule.** Red belongs to beat and bar information, never general actions or decoration.

## Typography

**Display Font:** Avenir Next Condensed (with Avenir Next and sans-serif fallbacks)  
**Body Font:** Avenir Next Condensed (with Avenir Next and sans-serif fallbacks)

The condensed family keeps the editor information-rich while retaining clear labels. Karaoke text may use the user-selected display face.

## Layout

The desktop shell uses a fixed top bar, intake row, four-column editor, and track timeline. At tablet widths the inspector collapses; at mobile widths tools become an overlay selector and the timeline remains horizontally scrollable. Primary controls maintain compact 34–40px heights with larger mobile hit areas.

## Elevation & Depth

The system is flat by default. One restrained shadow separates the black preview stage from its gray workspace; all other hierarchy comes from borders and tonal changes.

## Shapes

Corners are gently squared (4–7px). The logo and timeline remain rectilinear; the transport play control is the single recurring circular control.

## Components

### Buttons
- **Primary:** Ink background, paper text, compact height, short label plus icon.
- **Ghost:** Transparent at rest with a subtle neutral hover fill.
- **Focus:** A solid ink outline with visible offset.

### Inputs / Fields
- **Style:** White or transparent surface, one-pixel neutral border where containment is needed.
- **Disabled:** Lower contrast and a not-allowed cursor; never appears active.

### Navigation
- Tool icons form a vertical dock. The active tool reverses to white on black.

### Karaoke Stage
- The preview is black, with draggable white lyric text, a subdued watermark, and neutral magnetic guides. Tempo feedback stays in the timeline.

## Do's and Don'ts

### Do:
- **Do** keep the preview and timeline visually dominant.
- **Do** disclose demo or unavailable processing states honestly.
- **Do** use borders and spacing before adding elevation.

### Don't:
- **Don't** introduce gradients, glass effects, or decorative color.
- **Don't** use red outside tempo and beat markers.
- **Don't** imply that audio, stems, or export are ready before the external processor is connected.
