---
format: 1920x1080
duration: 70s
message: "Coup: Rebellion G54 is a bluffing game — claim a role you may not hold, expect to be challenged, and win by being the last player with a face-down card."
arc: Hook → Identity → Setup → Roles → Turn → Claim → Challenge → Bluff caught → Block → Coup → Close
audience: A brand-new player who has never opened the box.
mode: autonomous
music: none
---

## Video direction

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

**Rhythm / held-frame allocation.** Frames 1, 8, and 11 are the deliberate held reads — Frame 1
opens slow and secretive, Frame 8 lands the consequence and stops, Frame 11 resolves and sits.
Frames 3, 4, 7, and 10 are the dense teaching frames. The sequence alternates build → hold → build
so the video never runs at one energy.

**Negative list.** No browser chrome, nav bars, footers, or real cursors. No floating bokeh or
purple-blue "AI" gradients. No generic decorative shapes standing in for a designed metaphor —
every object on screen is a card, a coin, a seat, a stamp, or a type block. **Both motion failure
modes are banned:** no slideshow (front-load then freeze) and no screensaver (everything floating
independently). Card backs are the only repeating motif and they are always the same object.

**Caption band.** The bottom 17% of the canvas is reserved for the caption pill. All content caps at
the band top; centered heroes anchor at y ≈ 454.

---

## Frame 1 — Two cards, face down

- type: hook
- persuasion: Cold open on the game's central secret
- beat: intrigue
- blueprint: titlecard-reveal (Adapt)
- focal: the two face-down card backs
- roles: card backs = foreground subject · felt/ink field + hairline grid = background · two coins and a mono kicker = supporting
- scene: Two card backs land face-down on dark felt; a coin drops beside each.
- duration: 5.419s
- poster: 4s
- transition_in: cut
- status: animated
- voiceover: "Two cards, face down. These are your lives, and nobody at this table can see them."
- src: compositions/frames/01-two-cards-face-down.html

**narrativeRole** — Opens on the one object the whole game turns on: the hidden card. No rules yet, just the stakes.

**keyMessage** — Your influence is secret, and it is your life.

**Adapt:** keep the restrained single-move reveal and the allocated stillness; the "card" of the titlecard shape becomes the actual dealt card back. Layout: centered pair, asymmetric 60/40 against a mono kicker rail.

Scene 1 (0.0–1.4s): `ink-black` field with a low `border-dark` hairline rule and a faint mono kicker "g54" upper-left — Layered Depth, ambient hairline grid at ~8% opacity. The VO says "Two cards, face down": ONE card back enters via **slide-up settle** (`spring-pop-entrance`, smooth long-tail, no overshoot) from below centre-left and seats at ~48% width — Centered template, hero card ≈ 40% of frame height. Nothing else on screen.
Scene 2 (1.4–2.8s): on "These are your lives", the second card back lands beside the first with the same **slide-up settle** (`spring-pop-entrance`); the pair now reads as one object, centred — Centered, 2 depth layers (field + card pair).
Scene 3 (2.8–4.4s): on "nobody at this table", two `mk-orange` coins drop in and settle — one beside each card — via **sequential reveal** (`dynamic-content-sequencing`, one coin per beat) with a small mono counter ticking 2 → 2 (`discrete-text-sequence`). Supporting layer only, Asymmetric 60/40.
Scene 4 (4.4–6.4s): a `fire-orange` redaction bar sweeps once across both cards on the final clause via **marker sweep** (`css-marker-patterns`) and holds. Deliberate held read — stillness, at most **subtle jitter** (`sine-wave-loop`, low amplitude) on the pair.

## Frame 2 — That's G54

- type: product_intro
- persuasion: Name the thing, then the win condition
- beat: clarity
- blueprint: ticker-takeover (Adapt)
- focal: the "coup: rebellion g54" lockup
- roles: title lockup = foreground subject · flat ink field = background · player-count and win-condition mono rails = supporting
- scene: "COUP: REBELLION G54" locks up; 3–6 and "last card face down wins" stamp in beneath.
- duration: 7.253s
- poster: 3s
- transition_in: cut
- status: animated
- voiceover: "That's Coup: Rebellion G54. Three to six players. Last one holding a face-down card wins."
- src: compositions/frames/02-thats-g54.html

**narrativeRole** — Signs the video: what the game is called and what winning means, before any procedure.

**keyMessage** — It is a 3–6 player elimination game; survival is the only score.

**Adapt:** keep the in-place token swap and the per-beat full-screen build; the swap runs across the title's own words rather than a slogan. Layout: full-width centred stack, rule-of-thirds anchor. (Blueprint swapped from kinetic-type-beats: that template's body exceeds the packet budget; ticker-takeover carries the same token-swap signature.)

Scene 1 (0.0–1.6s): flat `ink-black` field, Layered Depth with a deep `mk-deep` vignette. On "That's Coup" the word `that's` slams in centred via **kinetic beat-slam** (`kinetic-beat-slam`, smooth long-tail) and hard-cuts in place to `coup` — the **in-place token swap** (`discrete-text-sequence`) IS the beat. Display ramp, hero word ≈ 13cqw.
Scene 2 (1.6–3.0s): `rebellion` and `g54` join beneath in the display ramp via **per-word staggered reveal** (`kinetic-beat-slam`), stacking into the lockup on the game's full name — Centered, one display moment.
Scene 3 (3.0–4.4s): on "Three to six players", a mono rail slides in under the lockup with `3 — 6 players` via **slide-up settle** (`spring-pop-entrance`); rule-of-thirds anchor, supporting layer.
Scene 4 (4.4–5.6s): on the win condition, a second mono rail lands via **slide-up settle** (`spring-pop-entrance`): `last card face down wins`, with the word `face down` carrying the `fire-orange` accent. Hold still.

## Frame 3 — Setup in one breath

- type: feature_showcase
- persuasion: Enumerate the setup as it lands on the table
- beat: orientation
- blueprint: grid-card-assemble (Adapt)
- focal: the assembled starting table
- roles: seats + coins + dealt cards + role rail = foreground subject · ink field = background · mono labels = supporting
- scene: Two coins slide to each of four seats; two card backs follow; five role cards flip face-up in the centre.
- duration: 6.677s
- poster: 5s
- transition_in: crossfade
- status: animated
- voiceover: "Setup is simple. Two coins and two cards each. And five roles, face up, for everyone to read."
- src: compositions/frames/03-setup-in-one-breath.html

**narrativeRole** — Establishes the physical starting position so every later beat has a place to happen.

**keyMessage** — Everyone starts equal: 2 coins, 2 hidden cards, and the same 5 public roles.

**Adapt:** keep the staggered cascade into an array; the array is the table itself rather than a feature grid. Layout: four seats in a ring around a centred role rail, then a settle to a wide full-width strip.

Scene 1 (0.0–1.4s): `ink-black` field with a faint `border-dark` hairline ring — Layered Depth, 3 depth layers. On "Setup is simple", four seat markers appear as empty mono-labelled positions — `seat 1…4` — via **cluster→outward expansion** (`center-outward-expansion`), no content yet. Centered ring.
Scene 2 (1.4–3.2s): on "two coins each", `mk-orange` coins slide to each seat in a **staggered cascade** (`spring-pop-entrance`); each seat's mono counter ticks to `2`. Supporting layer.
Scene 3 (3.2–4.8s): on "two cards each", two card backs deal to every seat in the same cascade order via **staggered slide-up** (`spring-pop-entrance`), landing face-down.
Scene 4 (4.8–7.4s): on "five roles, face up", the role rail assembles across the centre via **card assemble** (the `grid-card-assemble` signature) — five card faces flipping in sequence — and the four seats dim to ~40% so the rail reads as the public information. Full-width strip. Hold.

## Frame 4 — Tonight's five

- type: feature_showcase
- persuasion: Roll call with a category receipt
- beat: comprehension
- blueprint: grid-card-assemble (Adapt)
- focal: the five role cards and their category tags
- roles: five role cards = foreground subject · category tag rail = supporting · ink field + deep underprint = background
- scene: Five role cards fan out in the centre; category labels snap under each (Finance · Communications · Force · Special Interest ×2).
- duration: 6.251s
- poster: 6s
- transition_in: cut
- status: animated
- voiceover: "Tonight's five: Banker, Director, Guerrilla, Politician, and Peacekeeper. One from each category."
- src: compositions/frames/04-tonights-five.html

**narrativeRole** — Fixes the exact role set the rest of the video plays inside, so no later claim is ambiguous.

**keyMessage** — Only these five roles exist tonight; every legal claim is one of them.

**Adapt:** keep the one-at-a-time cascade into a held array; the five cards arrive on the VO naming each, not in one dump. Layout: full-width five-card strip, then a per-card category tag lands beneath.

Scene 1 (0.0–1.4s): an empty five-slot rail across the centre, `border-dark` hairline-divided — Full-width Strip. On "Tonight's five", the rail draws in via **SVG self-draw** (`svg-path-draw`).
Scene 2 (1.4–5.6s): one card lands per spoken name — `banker` on "Banker", `director` on "Director", `guerrilla` on "Guerrilla", `politician` on "Politician", `peacekeeper` on "Peacekeeper" — each sliding into its slot in the display ramp via **sequential slide-up reveal** (`spring-pop-entrance`, five arrivals paced to the roll call, one per VO name).
Scene 3 (5.6–8.6s): on "one from each category", a mono category tag snaps under each card in **its category hue** via **staggered pop** (`spring-pop-entrance`) — `finance` `mk-orange`, `communications` `mk-cyan`, `force` `mk-red`, `special interest` `mk-green` (×2). Hold; this is the video's colour key.

## Frame 5 — One action a turn

- type: benefit_highlight
- persuasion: Rule stated as a constraint, not a menu
- beat: focus
- blueprint: comparison-split (Adapt)
- focal: the single turn marker
- roles: turn marker = foreground subject · four seats = supporting · ink field + dimmed seats = background
- scene: A single turn marker slides along four seats; "1 action" holds over the active seat; the other three dim.
- duration: 6.763s
- poster: 4s
- transition_in: crossfade
- status: animated
- voiceover: "Every turn, you take exactly one action. Take a coin... or claim a role you might not even hold."
- src: compositions/frames/05-one-action-a-turn.html

**narrativeRole** — States the turn budget, the frame everything downstream hangs on.

**keyMessage** — One action per turn — and a claim costs nothing to make.

**Adapt:** keep the two-sided balanced split for the closing contrast; the split is `take a coin` vs `claim a role` rather than two feature cards. Layout: centred title → seat row → split.

Scene 1 (0.0–1.4s): on "Every turn", `one action` slides down into centre in the display ramp via **slide-up settle** (`spring-pop-entrance`) — Centered hero, ~50% of frame.
Scene 2 (1.4–3.0s): the four seats appear below in a row via **cluster→outward expansion** (`center-outward-expansion`); a single `fire-orange` turn marker **slides along** them (`discrete-text-sequence` positional step) and locks on one seat.
Scene 3 (3.0–4.6s): on "exactly one action", a mono `1 action` pins over the active seat via **keyword glow** (`asr-keyword-glow`) and the other three seats dim to ~35% (opacity).
Scene 4 (4.6–6.2s): on the two alternatives, the frame splits via **split-tilt cards** (`split-tilt-cards`) — `take a coin` left with a `mk-orange` coin glyph, `claim a role` right, divided by a `border-dark` hairline — with `might not even hold` landing under the right side in `fire-orange`. Split-screen. Hold.

## Frame 6 — Say you're the Banker

- type: feature_showcase
- persuasion: Walk one concrete claim end to end
- beat: momentum
- blueprint: cursor-ui-demo (Adapt)
- focal: the BANKER claim and the coins it moves
- roles: claim chip + coins = foreground subject · treasury + seats = supporting · ink field = background
- scene: A hand pushes three coins out of the treasury; the word BANKER floats over it in claimed-type.
- duration: 4.565s
- poster: 6s
- transition_in: cut
- status: animated
- voiceover: "Say you're the Banker, and you take three coins. Nobody's checked anything yet."
- src: compositions/frames/06-say-youre-the-banker.html

**narrativeRole** — Makes the bluff concrete: an unverified claim that just worked.

**keyMessage** — A claim resolves by itself unless someone stops it.

**Adapt:** keep the state-changing stage and the held lock; the "UI" is the table state machine, and the actor is the claim itself rather than a cursor. No cursor is drawn anywhere. Layout: treasury centred, claimant seat lower-third, challenge ring around the table.

Scene 1 (0.0–1.6s): `mk-orange` treasury stack centred, claimant seat marked below it — Asymmetric 60/40, 3 depth layers. On "Say you're the Banker", the claim chip `banker` rises over the claimant in the display ramp via **slide-up settle** (`spring-pop-entrance`), tagged `finance` in `mk-orange`.
Scene 2 (1.6–3.6s): on "take three coins", three `mk-orange` coins slide out of the treasury to the claimant via **sequential slide** (`spring-pop-entrance`, one per beat, staggered); the mono counter ticks `2 → 5` (`counting-dynamic-scale`).
Scene 3 (3.6–5.4s): on "Nobody's checked anything yet", a dashed `fire-orange` challenge ring **draws on** around the table (`svg-path-draw`) and then retracts unclaimed — the window opening and closing, visibly passed over.
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

**Adapt:** keep the balanced two-sided framing for the question; the sides are `banker` and `bluffing`, and the frame collapses back to centre for the resolution. Layout: split question → centred reveal → shuffle back to treasury.

Scene 1 (0.0–1.6s): on "But anyone can challenge", the frame splits via **split-tilt cards** (`split-tilt-cards`) — `banker` left, `bluffing` right — with the question mark between them in `fire-orange` (keyword glow, `asr-keyword-glow`). Split-screen.
Scene 2 (1.6–3.2s): the `challenge` stamp slams down across the split in `mk-red` via **kinetic beat-slam** (`kinetic-beat-slam`, the one deliberate overshoot in the video), collapsing both sides back to centre.
Scene 3 (3.2–5.4s): on "You show the card", the claimant's card **flips face-up** (`split-tilt-cards` rotationY) to reveal `banker` — the claim proven; Centered.
Scene 4 (5.4–7.4s): on "They lose a life", the challenger's card turns face-up in `mk-red` and dims (opacity); a mono `−1 influence` marks it via **stamp pop** (`spring-pop-entrance`).
Scene 5 (7.4–10.4s): on "shuffle it back, and draw a replacement", the shown card slides back to the `mk-purple` court deck via **card morph-anchor** (`card-morph-anchor`) and a fresh face-down card returns to the claimant. Held read.

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

**Adapt:** keep the per-beat full-screen build; the frame flips to the `fire-orange` accent register to signal the inverse outcome. Layout: centred, hard cut to full accent field. (Blueprint swapped from kinetic-type-beats for the packet budget; ticker-takeover keeps the violent-replacement signature.)

Scene 1 (0.0–1.6s): the same `challenge` stamp lands via **kinetic beat-slam** (`kinetic-beat-slam`), but the field **hard-cuts** to the **accent register** — `ink-black` type on `fire-orange` (`scale-swap-transition`). The revealed card is blank, a redaction bar over it.
Scene 2 (1.6–3.6s): on "you lose the life", the claimant's own card turns face-up via **card flip** (`split-tilt-cards`) — `−1 influence` in mono.
Scene 3 (3.6–5.0s): on "the action fails", `action fails` slams in the display ramp (`kinetic-beat-slam`), and the three coins slide back to the `mk-orange` treasury.
Scene 4 (5.0–6.2s): the accent field holds, type still. Deliberate held read — stillness, at most **subtle jitter** (`sine-wave-loop`).

## Frame 9 — Guerrilla stops Guerrilla

- type: feature_showcase
- persuasion: Rule stated as a repetition the viewer can hear
- beat: surprise
- blueprint: fixed-anchor-cycle (Adapt)
- focal: the two Guerrilla cards
- roles: two role cards = foreground subject · block arc = supporting · ink field + hairline grid = background
- scene: Two identical GUERRILLA cards face each other; a block arc snaps between them and the attack collapses.
- duration: 7.616s
- poster: 6s
- transition_in: crossfade
- status: animated
- voiceover: "Some actions can be blocked. And in G54, each Force role blocks only itself. Guerrilla stops Guerrilla."
- src: compositions/frames/09-guerrilla-stops-guerrilla.html

**narrativeRole** — Teaches the rule that most distinguishes G54 from base Coup.

**keyMessage** — There are no cross-role blocks here; a Force role answers itself.

**Adapt:** keep the pinned anchor and the arriving second element; the anchor is the attacker's card and what joins it is its identical blocker. Layout: centred pair, symmetric.

Scene 1 (0.0–2.2s): on "Some actions can be blocked", one `guerrilla` card **pins dead centre** via **slide-up settle** (`spring-pop-entrance`), tagged `force` in `mk-red`, and does not move again — Centered, the **fixed anchor**.
Scene 2 (2.2–4.0s): on "each Force role blocks only itself", a **second, identical** `guerrilla` card arrives from the right via **slide-in** (`spring-pop-entrance`) and seats facing the first — the repetition made visible.
Scene 3 (4.0–6.2s): on "Guerrilla stops Guerrilla", a `fire-orange` block arc **snaps between** the two cards via **SVG self-draw** (`svg-path-draw`) and the incoming attack on the left card collapses to nothing (`scale-swap-transition`).
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

**Adapt:** keep the count-up instrument and the push-through to a hero metric; the metrics are coin counts and the hero is the forced-Coup cap. Layout: centred stack → asymmetric 60/40 with the target card → full-width strip.

Scene 1 (0.0–1.6s): a `mk-orange` coin stack **counts up** in centre — a mono numeral ticking `0 → 7` (`counting-dynamic-scale`) as the stack grows to seven, one coin per tick. On "Seven coins buys a Coup". Centered.
Scene 2 (1.6–3.6s): on "one life gone", the frame **pushes through** to the target's card (`coordinate-target-zoom`) and a `coup` marker sweeps it face-up in `mk-red`; the two stamps `unblockable` and `unchallengeable` land flatly beneath in `fire-orange` (`kinetic-beat-slam`). Asymmetric 60/40.
Scene 3 (3.6–5.6s): on "At ten coins", the frame pulls back to a full-width strip (`coordinate-target-zoom`) and a second counter ticks `7 → 10` in `fire-orange` (`counting-dynamic-scale`).
Scene 4 (5.6–8.6s): `only move` pins beside the 10 via **keyword glow** (`asr-keyword-glow`), and every other action word on the strip greys to `cream-hint`. Hold.

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

**Adapt:** keep the single restrained move and the closing stillness; the object is Frame 1's exact card pair, returning changed. Layout: centred pair → lockup beneath, mirroring Frame 1's composition.

Scene 1 (0.0–1.4s): the two card backs from Frame 1 return to the identical centre position via the same **slide-up settle** (`spring-pop-entrance`) — Centered, mirroring Frame 1's composition.
Scene 2 (1.4–3.2s): on "Know when to tell the truth", the left card **flips face-up** in `mk-red` (`split-tilt-cards`) — one life spent — and the right card stays face-down.
Scene 3 (3.2–5.6s): on "and when not to", the title `know when not to` locks up beneath the pair in the display ramp (`kinetic-beat-slam`), and the frame holds still to the end — the final frame's exit.
