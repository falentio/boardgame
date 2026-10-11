---
workflow: faceless-explainer
flow: automation
storyboard: no
message: "Coup: Rebellion G54 is a bluffing game — claim a role you may not hold, expect to be challenged, and win by being the last player with a face-down card."
destination: shorts
aspect: 1080x1920
language: en
length: 90s
angle: how-to
narration: yes
audience: "A brand-new player who has never opened the box and needs to sit down at a real table knowing how a turn works."
---

## Intent

A ~70-second **vertical (9:16) variant** of the landscape how-to at
`videos/coup-rebellion-g54-tutorial`. Same film, same script, same voice tracks,
same design system and palette — re-laid-out for the tall canvas so it can run as
a YouTube Short / Reel / TikTok. The landscape edit is untouched; this is a
sibling project, not a crop.

The teaching spine, the narration and the frame order are inherited verbatim from
the landscape build. Only the **composition** changes: every landscape
side-by-side becomes a vertical stack, heroes anchor at y ≈ 0.42 × height, and the
display ramp runs larger because the container is only 1080 wide.

## Customizations

- **Canvas: 1080×1920.** Authored portrait from the start — never a cropped 16:9.
- **Palette: Monokai Filter Machine**, unchanged from the landscape build (ground
  `#273136`, text `#F2FFFC`, accent `#FFED72`, categorical hues meaning-coded).
- **Design system: Broadside**, unchanged — massive lowercase Barlow 900 as graphic
  primitive, one accent, 1px hairlines, flat plane. `frame.md` already documents
  the 9:16 behaviour of every treatment.
- **Captions on**, same preset skin and same word timings.

## Notes

- **Source of truth for content:** `videos/coup-rebellion-g54-tutorial/` —
  `SCRIPT.md`, `audio_meta.json` (word timings), `assets/voice/*.wav`, `frame.md`.
  These are copied in, not regenerated, so the two edits stay word-for-word and
  frame-for-frame identical.
- **Facts are load-bearing** and unchanged: 3–6 players; 2 coins and 2 face-down
  cards each; Income takes 1; Coup costs 7 and cannot be blocked or challenged; a
  role claim may be a lie and any player may challenge; a failed challenge costs one
  influence; a truthful reveal shuffles the card back and draws a replacement; each
  Force role is blocked only by itself; 10+ coins forces Coup; the last player with
  a face-down card wins. No base-Coup rules.
- **Portrait discipline:** no wide split-screen or triptych anywhere — stacked
  bands and vertical step lists instead. Content stays above y ≈ 1580 (the caption
  band owns the bottom 17%). Type runs larger with fewer words per line.
- **Project location:** `videos/coup-rebellion-g54-portrait/`, branch
  `feat/coup-rebellion-g54-portrait`.
