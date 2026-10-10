---
workflow: faceless-explainer
flow: automation
storyboard: no
message: "Coup: Rebellion G54 is a bluffing game — claim a role you may not hold, expect to be challenged, and win by being the last player with a face-down card."
destination: youtube
aspect: 1920x1080
language: en
length: 90s
angle: how-to
narration: yes
audience: "A brand-new player who has never opened the box and needs to sit down at a real table knowing how a turn works."
---

## Intent

A ~90-second how-to that takes a brand-new player from an unopened box to a
confident first turn of Coup: Rebellion G54. It teaches by playing one sample
game: the five roles are chosen and laid out, cards and coins are dealt, one
player claims a role, someone challenges, a life is lost, a block is attempted,
and the Coup closes it out. The bluff is the middle act — the moment the video
earns its title — and the last act shows the one action that cannot be stopped.
Confident and a little conspiratorial, like a friend leaning across the table:
the game is a dystopia, but the tone is sharp fun, not grim.

Routed autonomously from `/hyperframes` on a fresh creation (the user said
"automate your work"). Subject and source text: the rules-research folder
already in this repo at `docs/research/coup-rebellion-g54/` (01–09 + README),
written for the web implementation.

## Customizations

- **Teaching spine: the starter set.** Banker (Finance) · Director
  (Communications) · Guerrilla (Force) · Politician + Peacekeeper (Special
  Interest). The research explicitly recommends this set for a first game and
  for a tutorial; the whole video stays inside these five roles.
- **Color palette: Monokai Filter Machine** — the user's named palette, taken
  from `opencode-zedokai`'s `zedokai-filter-machine` theme (Zedokai / Monokai
  Pro "Filter Machine"). Ground `#273136`, text `#f2fffc`, accent `#ffed72`
  (the theme's own interactive hue), neutral ladder `#212b30 → #3a4449 → #616c6f
  → #8b9798`, extended hues red `#ff6d7e` · orange `#ffb270` · green `#a2e57b`
  · cyan `#7cd5f1` · purple `#baa0f8`. Applied through the frame preset's role
  mapping so the design system's geometry and type stay intact.
- **Design system: Broadside** (remembered preference, user-confirmed across two
  prior runs on this subject). Massive lowercase display type as graphic
  primitive, one display accent, 1px hairlines, flat plane.
- Captions on, word-timed, using the preset's caption skin.

## Notes

- **Voice:** English, warm and confident, mid-pace — teaching a table game, not
  announcing a product. No voice was specified by the user; the remembered
  voice applies if one exists, otherwise the pipeline default.
- **Visual world:** the table. Cards and coins as physical objects, top-down, a
  persistent board the camera never fully leaves. The game's own dystopian
  political art is referenced through texture (stamps, redaction bars, dossier
  paper) but the video must NOT reproduce the published card art — every card
  face is invented typography.
- **Facts are load-bearing.** Every rule stated must match
  `docs/research/coup-rebellion-g54/`. The load-bearing ones: 3–6 players; each
  player gets 2 coins and 2 face-down influence cards; Income takes 1; Coup
  costs 7 and cannot be blocked or challenged; a role claim may be a lie and any
  player may challenge; a failed challenge costs one influence; a truthful
  reveal shuffles the card back and draws a replacement; each Force role is
  blocked only by itself (Guerrilla blocks Guerrilla) — there is no base-Coup
  cross-block; 10+ coins forces Coup; the last player with a face-down card
  wins. Do not import base Coup rules (Contessa, Duke, Captain, Ambassador).
- **Pitch directions considered and left behind:** "The G54 Dossier"
  (declassified-manual treatment), "How You Lose in Four Turns" (annotated
  replay of a losing line), "5625 Games" (the setup-combinatorics angle). All
  three are stylistic; none ends with a player who can actually take a turn.
- **Chosen over the median.** The typical explainer on this subject is a rule
  recital over a static card image. The build must stay a played game.
- **Project location:** `videos/coup-rebellion-g54-tutorial/`, branch
  `feat/coup-rebellion-g54-tutorial-video-1`.
