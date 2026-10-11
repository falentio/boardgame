---
format: 1080x1920
duration: 70s
message: "Coup: Rebellion G54 is a bluffing game — claim a role you may not hold, expect to be challenged, and win by being the last player with a face-down card."
arc: Hook → Identity → Setup → Roles → Turn → Claim → Challenge → Bluff caught → Block → Coup → Close
audience: A brand-new player who has never opened the box.
mode: autonomous
music: none
---

## Video direction

**This is the 9:16 cut.** Same script, same voice tracks, same frame order, same design system as
`videos/coup-rebellion-g54-tutorial` — every word and every beat is identical. What changes is the
**composition**: the canvas is 1080×1920 and every landscape side-by-side becomes a vertical stack.
Nothing here is a crop of the wide edit.

**Canvas & keep-out.** 1080 wide × 1920 tall. All content lives in the **top 83%** — the caption
pill owns y ≥ 1600. A centred hero anchors at **y ≈ 806** (0.42 × height), not the canvas midpoint
(960). Background and ambient layers are exempt and may stay full-bleed.

**Portrait composition rules (these override the wide edit).**

- **Stack, never split.** No side-by-side split screen and no triptych anywhere in this cut. A wide
  two-panel argument becomes a **stacked band pair** (upper band over lower band, 1px hairline
  between). A five-across strip becomes a **vertical row list**. A horizontal seat row becomes a
  **vertical seat column** or a 2×2 grid.
- **Type runs larger, lines run shorter.** The container is 1080 wide, not 1920 — a landscape hero
  that filled the frame at 13cqw of 1920 needs roughly **20–30cqw** of 1080 to fill the same share.
  Never let a hero line exceed **78cqw**; break it into two lines before it reaches the edge.
- **One hero per frame, filling 40–60% of the content area.** The tall canvas punishes a small
  cluster floating in the middle. Push the hero up (anchor ≈ y 806) and let supporting elements
  flow *down* beneath it with rhythm, so the vertical space is composed rather than empty.

**Palette (from `frame.md` — Monokai Filter Machine).** Ground `ink-black` `#273136` with `cream`
`#F2FFFC` text; `fire-orange` `#FFED72` is *the* accent — the one thing that matters in each frame
(the claim, the challenge stamp, the seventh coin, the forced-Coup cap). The theme's categorical hues
are **meaning-coded**, fixed for the whole video: `mk-orange` `#FFB270` = **Finance** (coins,
treasury, income), `mk-cyan` `#7CD5F1` = **Communications** (card draw, the court deck),
`mk-red` `#FF6D7E` = **Force** (danger, a life lost, the challenge stamp), `mk-green` `#A2E57B` =
**Special Interest** (protection, a surviving action, "claim stands"), `mk-purple` `#BAA0F8` = the
Court deck / replacement draw. A category tag is always its own hue; a coin is always `mk-orange`; a
lost life is always `mk-red`. Hairlines are `border-dark` `#414B50`; the deepest field is `mk-deep`
`#01151B`. Never a hue outside this table; never a categorical hue on a hero word or body text —
those are `cream` or `fire-orange`.

**Type roles (from `frame.md`).** Display = Barlow 900 **lowercase**, negative-tracked, treated as a
graphic primitive (the hero words: `coup`, `banker`, `guerrilla`, `challenge`). Chrome = IBM Plex
Mono 500 uppercase at 0.14em (labels, counters, category tags, rules-as-text). Body = Barlow 400.
Every card face, role name, and coin count uses these — **no published card art is reproduced
anywhere**; card faces are invented typography.

**Motion grammar.** One camera, one feel: long-tail eases (`power3` default, smooth over bouncy),
never a spring except on a deliberate punctuation (the challenge stamp). The **VO-paced reveal
model** governs every frame: at t=0 only what the voiceover is saying enters; each further element
reveals on its spoken cue; nothing appears before the VO reaches it. Reveals spread across the back
~50% of each shot. Holds are still — at most a low-amplitude jitter on the held element; no lazy
breathing, no back-half drift.

**Vertical camera.** A portrait push-in travels on the Y axis, not the X. Where the wide edit pushed
in on a horizontal strip, this cut pushes in on a vertical column — the move still resolves to a
slightly larger hero, never a sideways pan (there is no width to pan across).

**Rhythm / held-frame allocation.** Frames 1, 8, and 11 are the deliberate held reads — Frame 1
opens slow and secretive, Frame 8 lands the consequence and stops, Frame 11 resolves and sits.
Frames 3, 4, 7, and 10 are the dense teaching frames. The sequence alternates build → hold → build
so the video never runs at one energy.

**Negative list.** No browser chrome, nav bars, footers, or real cursors. No floating bokeh or
purple-blue "AI" gradients. No generic decorative shapes standing in for a designed metaphor —
every object on screen is a card, a coin, a seat, a stamp, or a type block. **No wide split screen,
no triptych, no horizontally-scrolling strip** — this is the portrait cut and those do not exist
here. **Both motion failure modes are banned:** no slideshow (front-load then freeze) and no
screensaver (everything floating independently). Card backs are the only repeating motif and they
are always the same object.

**Caption band.** The bottom 17% of the canvas (y ≥ 1600) is reserved for the caption pill. All
content caps at the band top (y ≤ 1580); a centred hero anchors at y ≈ 806.

---

## Frame 1 — Two cards, face down

- type: hook
- persuasion: Cold open on the game's central secret
- beat: intrigue
- blueprint: titlecard-reveal (Adapt)
- focal: the two face-down card backs
- roles: card backs = foreground subject · ink field + hairline grid = background · two coins and a mono kicker = supporting
- scene: Two card backs land face-down on dark felt; a coin drops beneath each.
- duration: 5.419s
- poster: 4s
- transition_in: cut
- status: animated
- voiceover: "Two cards, face down. These are your lives, and nobody at this table can see them."
- src: compositions/frames/01-two-cards-face-down.html

**narrativeRole** — Opens on the one object the whole game turns on: the hidden card. No rules yet, just the stakes.

**keyMessage** — Your influence is secret, and it is your life.

**Adapt:** keep the restrained single-move reveal and the allocated stillness; the "card" of the titlecard shape becomes the actual dealt card back. **Portrait:** the pair is the hero and it owns the middle of the tall canvas — two card backs side by side, centred on y ≈ 806, spanning ~72cqw so they read as one object. The coins sit *below* their cards rather than beside them (there is no room beside), and the mono kicker rides the upper-left as before.

Scene 1 (0.0–1.4s): `ink-black` field, a faint `border-dark` hairline grid at ~8% and a mono kicker "g54" upper-left — Layered Depth, 3 depth layers. The VO says "Two cards, face down": ONE card back enters via **slide-up settle** (`spring-pop-entrance`, smooth long-tail, no overshoot) and seats at the pair's left slot, centred vertically on the frame's hero anchor. Nothing else on screen.
Scene 2 (1.4–2.8s): on "These are your lives", the second card back lands in the right slot with the same **slide-up settle** (`spring-pop-entrance`); the pair now reads as one centred object — Centered, 2 depth layers (field + card pair).
Scene 3 (2.8–4.4s): on "nobody at this table", two `mk-orange` coins drop in **beneath their cards** — one under each — via **sequential reveal** (`dynamic-content-sequencing`, one coin per beat), with a small mono counter ticking 0 → 2 (`discrete-text-sequence`) on the rail below the pair.
Scene 4 (4.4–6.4s): a `fire-orange` redaction bar sweeps once across both cards on the final clause via **marker sweep** (`css-marker-patterns`) and holds. Deliberate held read — stillness, at most **subtle jitter** (`sine-wave-loop`, low amplitude) on the pair.

## Frame 2 — That's G54

- type: product_intro
- persuasion: Name the thing, then the win condition
- beat: clarity
- blueprint: ticker-takeover (Adapt)
- focal: the "coup: rebellion g54" lockup
- roles: title lockup = foreground subject · flat ink field = background · player-count and win-condition mono rails = supporting
- scene: "COUP: REBELLION G54" locks up four lines tall; 3–6 and "last card face down wins" stamp in beneath.
- duration: 7.253s
- poster: 3s
- transition_in: cut
- status: animated
- voiceover: "That's Coup: Rebellion G54. Three to six players. Last one holding a face-down card wins."
- src: compositions/frames/02-thats-g54.html

**narrativeRole** — Signs the video: what the game is called and what winning means, before any procedure.

**keyMessage** — It is a 3–6 player elimination game; survival is the only score.

**Adapt:** keep the in-place token swap and the per-beat full-screen build; the swap runs across the title's own words rather than a slogan. **Portrait:** the lockup is the hero and stacks *four lines tall* — `that's` → `coup` → `rebellion` → `g54` — filling the upper two-thirds at display scale, so the name itself is the composition. The two mono rails then land beneath the lockup, stacked one over the other rather than side by side.

Scene 1 (0.0–1.6s): flat `ink-black` field, Layered Depth with a deep `mk-deep` vignette. On "That's Coup" the word `that's` slams in centred at ~14cqw via **kinetic beat-slam** (`kinetic-beat-slam`, smooth long-tail) and hard-cuts in place to `coup` at ~26cqw — the **in-place token swap** (`discrete-text-sequence`) IS the beat.
Scene 2 (1.6–3.0s): `rebellion` and `g54` join beneath in the display ramp via **per-word staggered reveal** (`kinetic-beat-slam`), stacking into a four-line lockup on the game's full name — Centered, one display moment, hero anchored y ≈ 806.
Scene 3 (3.0–4.4s): on "Three to six players", a mono rail slides in under the lockup with `3 — 6 players` via **slide-up settle** (`spring-pop-entrance`), stacked above the second rail.
Scene 4 (4.4–5.6s): on the win condition, a second mono rail lands beneath the first via **slide-up settle** (`spring-pop-entrance`): `last card face down wins`, with the word `face down` carrying the `fire-orange` accent. Hold still.

## Frame 3 — Setup in one breath

- type: feature_showcase
- persuasion: Enumerate the setup as it lands on the table
- beat: orientation
- blueprint: grid-card-assemble (Adapt)
- focal: the assembled starting table
- roles: seats + coins + dealt cards + role rail = foreground subject · ink field = background · mono labels = supporting
- scene: Two coins land on each of four seats; two card backs follow; five role cards flip face-up below.
- duration: 6.677s
- poster: 5s
- transition_in: crossfade
- status: animated
- voiceover: "Setup is simple. Two coins and two cards each. And five roles, face up, for everyone to read."
- src: compositions/frames/03-setup-in-one-breath.html

**narrativeRole** — Establishes the physical starting position so every later beat has a place to happen.

**keyMessage** — Everyone starts equal: 2 coins, 2 hidden cards, and the same 5 public roles.

**Adapt:** keep the staggered cascade into an array; the array is the table itself rather than a feature grid. **Portrait:** the ring becomes a **2×2 seat grid** in the upper half (the table seen from above, filling the width), and the five role cards assemble as a **compact 5-up rail** in the lower content band — a horizontal rail is still right here because each card is only a glyph plus a name, and it must read as one public row.

Scene 1 (0.0–1.4s): `ink-black` field with a faint `border-dark` hairline grid — Layered Depth, 3 depth layers. On "Setup is simple", four seat markers appear as empty mono-labelled positions — `seat 1…4` — laid out as a **2×2 grid** filling the upper half via **cluster→outward expansion** (`center-outward-expansion`), no content yet. Centered.
Scene 2 (1.4–3.2s): on "two coins each", `mk-orange` coins land on each seat in a **staggered cascade** (`spring-pop-entrance`); each seat's mono counter ticks to `2`. Supporting layer.
Scene 3 (3.2–4.8s): on "two cards each", two card backs deal into every seat in the same cascade order via **staggered slide-up** (`spring-pop-entrance`), landing face-down on the seat grid.
Scene 4 (4.8–7.4s): on "five roles, face up", the role rail assembles across the lower content band via **card assemble** (the `grid-card-assemble` signature) — five card faces flipping in sequence, one public row — and the 2×2 seat grid dims to ~40% so the rail reads as the public information. Full-width strip. Hold.

## Frame 4 — Tonight's five

- type: feature_showcase
- persuasion: Roll call with a category receipt
- beat: comprehension
- blueprint: grid-card-assemble (Adapt)
- focal: the five role rows and their category tags
- roles: five role rows = foreground subject · category tag column = supporting · ink field + deep underprint = background
- scene: Five role rows stack down the frame; a category label snaps at the right of each (Finance · Communications · Force · Special Interest ×2).
- duration: 6.251s
- poster: 6s
- transition_in: cut
- status: animated
- voiceover: "Tonight's five: Banker, Director, Guerrilla, Politician, and Peacekeeper. One from each category."
- src: compositions/frames/04-tonights-five.html

**narrativeRole** — Fixes the exact role set the rest of the video plays inside, so no later claim is ambiguous.

**keyMessage** — Only these five roles exist tonight; every legal claim is one of them.

**Adapt:** keep the one-at-a-time cascade into a held array; the five rows arrive on the VO naming each, not in one dump. **Portrait — the biggest re-layout in the cut:** the wide five-across strip becomes a **vertical row list**, one role per row, each row = index + glyph + role name left, category tag right. Five rows fill the tall canvas properly and the role names get real size (the wide edit had to shrink them; here each name runs large enough to read at a glance). A hairline divides the rows.

Scene 1 (0.0–1.4s): an empty five-row rail fills the content area, `border-dark` hairline-divided rows — vertical row list. On "Tonight's five", the rail draws in via **SVG self-draw** (`svg-path-draw`).
Scene 2 (1.4–5.6s): one row lands per spoken name — `banker` on "Banker", `director` on "Director", `guerrilla` on "Guerrilla", `politician` on "Politician", `peacekeeper` on "Peacekeeper" — each row sliding in from the left into its slot in the display ramp via **sequential slide-in reveal** (`spring-pop-entrance`, five arrivals paced to the roll call, one per VO name).
Scene 3 (5.6–8.6s): on "one from each category", a mono category tag snaps at the right of each row in **its category hue** via **staggered pop** (`spring-pop-entrance`) — `finance` `mk-orange`, `communications` `mk-cyan`, `force` `mk-red`, `special interest` `mk-green` (×2). Hold; this is the video's colour key.

## Frame 5 — One action a turn

- type: benefit_highlight
- persuasion: Rule stated as a constraint, not a menu
- beat: focus
- blueprint: comparison-split (Adapt)
- focal: the single turn marker
- roles: turn marker = foreground subject · four seats = supporting · ink field + dimmed seats = background
- scene: A single turn marker steps down four seats; "1 action" holds beside the active seat; the other three dim.
- duration: 6.763s
- poster: 4s
- transition_in: crossfade
- status: animated
- voiceover: "Every turn, you take exactly one action. Take a coin... or claim a role you might not even hold."
- src: compositions/frames/05-one-action-a-turn.html

**narrativeRole** — States the turn budget, the frame everything downstream hangs on.

**keyMessage** — One action per turn — and a claim costs nothing to make.

**Adapt:** keep the two-sided balanced split for the closing contrast; the split is `take a coin` vs `claim a role` rather than two feature cards. **Portrait:** the four seats become a **vertical seat column** and the turn marker *steps down* it (the wide edit slid it sideways). The closing split becomes a **stacked band pair** — `take a coin` over `claim a role`, 1px hairline between — which is the portrait form of the same contrast.

Scene 1 (0.0–1.4s): on "Every turn", `one action` slides down into centre in the display ramp via **slide-up settle** (`spring-pop-entrance`) — Centered hero, anchored y ≈ 806, filling the width.
Scene 2 (1.4–3.0s): the four seats appear **beneath the hero as a vertical column** via **cluster→outward expansion** (`center-outward-expansion`); a single `fire-orange` turn marker **steps down** them (`discrete-text-sequence` positional step) and locks on one seat.
Scene 3 (3.0–4.6s): on "exactly one action", a mono `1 action` pins beside the active seat via **keyword glow** (`asr-keyword-glow`) and the other three seats dim to ~35% (opacity).
Scene 4 (4.6–6.2s): on the two alternatives, the lower band splits **vertically** via **split-tilt cards** (`split-tilt-cards`) — `take a coin` in the upper band with a `mk-orange` coin glyph, `claim a role` in the lower band, divided by a `border-dark` hairline — with `might not even hold` landing under the lower band in `fire-orange`. Stacked bands. Hold.

## Frame 6 — Say you're the Banker

- type: feature_showcase
- persuasion: Walk one concrete claim end to end
- beat: momentum
- blueprint: cursor-ui-demo (Adapt)
- focal: the BANKER claim and the coins it moves
- roles: claim chip + coins = foreground subject · treasury + seats = supporting · ink field = background
- scene: Three coins fall out of the treasury down to the claimant; the word BANKER floats over it in claimed-type.
- duration: 4.565s
- poster: 6s
- transition_in: cut
- status: animated
- voiceover: "Say you're the Banker, and you take three coins. Nobody's checked anything yet."
- src: compositions/frames/06-say-youre-the-banker.html

**narrativeRole** — Makes the bluff concrete: an unverified claim that just worked.

**keyMessage** — A claim resolves by itself unless someone stops it.

**Adapt:** keep the state-changing stage and the held lock; the "UI" is the table state machine, and the actor is the claim itself rather than a cursor. No cursor is drawn anywhere. **Portrait:** the treasury sits high (y ≈ 560) and the claimant's seat sits *below* it (y ≈ 1180); coins travel **down** the frame from treasury to claimant, and the challenge ring encircles the claimant's seat rather than the whole table.

Scene 1 (0.0–1.6s): `mk-orange` treasury stack centred high, claimant seat marked below it — asymmetric top/bottom, 3 depth layers. On "Say you're the Banker", the claim chip `banker` rises over the claimant in the display ramp via **slide-up settle** (`spring-pop-entrance`), tagged `finance` in `mk-orange`.
Scene 2 (1.6–3.6s): on "take three coins", three `mk-orange` coins fall **down** from the treasury to the claimant via **sequential slide** (`spring-pop-entrance`, one per beat, staggered); the mono counter ticks `2 → 5` (`counting-dynamic-scale`).
Scene 3 (3.6–5.4s): on "Nobody's checked anything yet", a dashed `fire-orange` challenge ring **draws on** around the claimant's seat (`svg-path-draw`) and then retracts unclaimed — the window opening and closing, visibly passed over.
Scene 4 (5.4–7.0s): a mono stamp `claim stands` lands beside the chip in `mk-green` via **stamp pop** (`spring-pop-entrance`) and the coins settle. Held read on the unchanged state.

## Frame 7 — Or are you bluffing?

- type: feature_showcase
- persuasion: Turn the claim into a question, then answer it
- beat: tension
- blueprint: comparison-split (Adapt)
- focal: the CHALLENGE stamp and the revealed card
- roles: stamp + revealed card = foreground subject · challenger card = supporting · ink field = background
- scene: A CHALLENGE stamp slams down; the card flips to reveal BANKER; the challenger's card turns face-up.
- duration: 9.899s
- poster: 7s
- transition_in: cut
- status: animated
- voiceover: "But anyone can challenge. So — are you the Banker, or are you bluffing? You show the card. They lose a life. You shuffle it back, and draw a replacement."
- src: compositions/frames/07-or-are-you-bluffing.html

**narrativeRole** — Delivers the game's title move: the challenge, and the cost of getting it wrong.

**keyMessage** — A challenge against a true claim costs the challenger a life, and the honest claimant draws a fresh card.

**Adapt:** keep the balanced two-sided framing for the question; the sides are `banker` and `bluffing`, and the frame collapses back to centre for the resolution. **Portrait:** the question's two sides stack **`banker` over `bluffing`** with the `fire-orange` question mark between them; the stamp then slams across the whole stack; the reveal, the lost life, and the replacement all play out centred on the hero anchor.

Scene 1 (0.0–1.6s): on "But anyone can challenge", the frame splits into **stacked bands** via **split-tilt cards** (`split-tilt-cards`) — `banker` in the upper band, `bluffing` in the lower, with the question mark between them in `fire-orange` (keyword glow, `asr-keyword-glow`). Stacked bands.
Scene 2 (1.6–3.2s): the `challenge` stamp slams down across the whole stack in `mk-red` via **kinetic beat-slam** (`kinetic-beat-slam`, the one deliberate overshoot in the video), collapsing both bands back to centre.
Scene 3 (3.2–5.4s): on "You show the card", the claimant's card **flips face-up** (`split-tilt-cards` rotationY) to reveal `banker` — the claim proven; Centered on y ≈ 806.
Scene 4 (5.4–7.4s): on "They lose a life", the challenger's card turns face-up in `mk-red` and dims (opacity); a mono `−1 influence` marks it via **stamp pop** (`spring-pop-entrance`).
Scene 5 (7.4–10.4s): on "shuffle it back, and draw a replacement", the shown card slides back **up** to the `mk-purple` court deck via **card morph-anchor** (`card-morph-anchor`) and a fresh face-down card returns to the claimant. Held read.

## Frame 8 — If you're lying

- type: pain_point
- persuasion: Mirror the previous frame to its inverse
- beat: consequence
- blueprint: ticker-takeover (Adapt)
- focal: the blank revealed card
- roles: blank card = foreground subject · claimant's own face-up card = supporting · accent-register field = background
- scene: The same stamp lands, but the revealed card is blank; the claimant's own card turns face-up.
- duration: 3.349s
- poster: 5s
- transition_in: cut
- status: animated
- voiceover: "If you're lying, you lose the life, and the action fails."
- src: compositions/frames/08-if-youre-lying.html

**narrativeRole** — Completes the challenge pair so the viewer can price the risk before they ever bluff.

**keyMessage** — A caught bluff costs the bluffer, not the challenger.

**Adapt:** keep the per-beat full-screen build; the frame flips to the `fire-orange` accent register to signal the inverse outcome. **Portrait:** the whole canvas hard-cuts to `fire-orange` — the most violent beat in the video is also the most saturated — and the blank card, the lost life, and the failed action stack down the centre.

Scene 1 (0.0–1.6s): the same `challenge` stamp lands via **kinetic beat-slam** (`kinetic-beat-slam`), but the field **hard-cuts** to the **accent register** — `ink-black` type on `fire-orange` across the full 1080×1920 (`scale-swap-transition`). The revealed card is blank, a redaction bar over it, centred on y ≈ 806.
Scene 2 (1.6–3.6s): on "you lose the life", the claimant's own card turns face-up **beneath** the blank card via **card flip** (`split-tilt-cards`) — `−1 influence` in mono.
Scene 3 (3.6–5.0s): on "the action fails", `action fails` slams in the display ramp (`kinetic-beat-slam`), and the three coins slide back **up** to the `mk-orange` treasury.
Scene 4 (5.0–6.2s): the accent field holds, type still. Deliberate held read — stillness, at most **subtle jitter** (`sine-wave-loop`).

## Frame 9 — Guerrilla stops Guerrilla

- type: feature_showcase
- persuasion: Rule stated as a repetition the viewer can hear
- beat: surprise
- blueprint: fixed-anchor-cycle (Adapt)
- focal: the two Guerrilla cards
- roles: two role cards = foreground subject · block arc = supporting · ink field + hairline grid = background
- scene: Two identical GUERRILLA cards face each other down the frame; a block arc snaps between them and the attack collapses.
- duration: 7.616s
- poster: 6s
- transition_in: crossfade
- status: animated
- voiceover: "Some actions can be blocked. And in G54, each Force role blocks only itself. Guerrilla stops Guerrilla."
- src: compositions/frames/09-guerrilla-stops-guerrilla.html

**narrativeRole** — Teaches the rule that most distinguishes G54 from base Coup.

**keyMessage** — There are no cross-role blocks here; a Force role answers itself.

**Adapt:** keep the pinned anchor and the arriving second element; the anchor is the attacker's card and what joins it is its identical blocker. **Portrait:** the two cards face each other **vertically** — the pinned card holds the hero anchor and its identical twin arrives from **above**, seating face to face. The block arc snaps on the vertical axis between them, and the mono rule line lands beneath the pair.

Scene 1 (0.0–2.2s): on "Some actions can be blocked", one `guerrilla` card **pins dead centre** on the hero anchor via **slide-up settle** (`spring-pop-entrance`), tagged `force` in `mk-red`, and does not move again — Centered, the **fixed anchor**.
Scene 2 (2.2–4.0s): on "each Force role blocks only itself", a **second, identical** `guerrilla` card arrives from **above** via **slide-in** (`spring-pop-entrance`) and seats facing the first — the repetition made visible as a vertical pair.
Scene 3 (4.0–6.2s): on "Guerrilla stops Guerrilla", a `fire-orange` block arc **snaps between** the two cards on the vertical axis via **SVG self-draw** (`svg-path-draw`) and the incoming attack on the lower card collapses to nothing (`scale-swap-transition`).
Scene 4 (6.2–8.4s): a mono rule line lands beneath the pair: `no cross-role blocks` (`dynamic-content-sequencing`). The pinned card has not moved since Scene 1 — the anchor's stillness IS the claim. Hold.

## Frame 10 — Seven coins buys a Coup

- type: feature_showcase
- persuasion: State the exception flatly, then the forced-move rule
- beat: authority
- blueprint: dataviz-countup (Adapt)
- focal: the 7-coin stack and the Coup marker
- roles: coin stack + Coup marker = foreground subject · target card = supporting · ink field = background
- scene: Seven coins stack and land hard; a Coup marker sweeps a target's card face-up; a 10-coin counter pins to "only move".
- duration: 7.851s
- poster: 5s
- transition_in: cut
- status: animated
- voiceover: "Seven coins buys a Coup: unblockable, unchallengeable, one life gone. At ten coins, it's your only move."
- src: compositions/frames/10-seven-coins-buys-a-coup.html

**narrativeRole** — Gives the viewer the one action that always works, and the cap that forces it.

**keyMessage** — Coup cannot be stopped; hoarding to ten coins forces your hand.

**Adapt:** keep the count-up instrument and the push-through to a hero metric; the metrics are coin counts and the hero is the forced-Coup cap. **Portrait:** the stack grows **upward** from a baseline rather than sideways, the push-through travels **down** the frame onto the target card, and the closing "ten coins / only move" reads as a vertical strip — counter, then `only move` pinned beneath it.

Scene 1 (0.0–1.6s): a `mk-orange` coin stack **counts up** on the hero anchor, growing **upward** from a hairline baseline — a mono numeral ticking `0 → 7` (`counting-dynamic-scale`) as the stack grows to seven, one coin per tick. On "Seven coins buys a Coup". Centered.
Scene 2 (1.6–3.6s): on "one life gone", the frame **pushes through downward** to the target's card (`coordinate-target-zoom`) and a `coup` marker sweeps it face-up in `mk-red`; the two stamps `unblockable` and `unchallengeable` land flatly **stacked beneath** it in `fire-orange` (`kinetic-beat-slam`). Asymmetric top/bottom.
Scene 3 (3.6–5.6s): on "At ten coins", the frame pulls back to a **vertical strip** (`coordinate-target-zoom`) and a second counter ticks `7 → 10` in `fire-orange` (`counting-dynamic-scale`).
Scene 4 (5.6–8.6s): `only move` pins **beneath** the 10 via **keyword glow** (`asr-keyword-glow`), and every other action word on the strip greys to `cream-hint`. Hold.

## Frame 11 — Know when not to

- type: branding
- persuasion: Return the hook's object, restated as the lesson
- beat: resolution
- blueprint: titlecard-reveal (Adapt)
- focal: the returning card backs and the title lockup
- roles: card backs + lockup = foreground subject · ink field + hairline rule = background
- scene: The two opening card backs return, one now face-up; the title locks up beneath them.
- duration: 4.053s
- poster: 3s
- transition_in: crossfade
- status: animated
- voiceover: "So the game is simple. Know when to tell the truth — and when not to."
- src: compositions/frames/11-know-when-not-to.html

**narrativeRole** — Closes the loop opened in Frame 1 and leaves the viewer with the decision the game is actually about.

**keyMessage** — The rules are short; the skill is choosing when to lie.

**Adapt:** keep the single restrained move and the closing stillness; the object is Frame 1's exact card pair, returning changed. **Portrait:** the pair returns to Frame 1's exact centred slot on y ≈ 806 (the mirror is exact — same cards, same place), and the title lockup then lands **beneath** the pair instead of beside it.

Scene 1 (0.0–1.4s): the two card backs from Frame 1 return to the identical centre position and size via the same **slide-up settle** (`spring-pop-entrance`) — Centered on y ≈ 806, mirroring Frame 1's composition exactly.
Scene 2 (1.4–3.2s): on "Know when to tell the truth", the left card **flips face-up** in `mk-red` (`split-tilt-cards`) — one life spent — and the right card stays face-down.
Scene 3 (3.2–5.6s): on "and when not to", the title `know when not to` locks up **beneath** the pair in the display ramp (`kinetic-beat-slam`), and the frame holds still to the end — the final frame's exit.
