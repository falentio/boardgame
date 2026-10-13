# Citadels game definition: thirteenth independent verification

Verifier: review sub-agent (adversarial, thirteenth pass). I did not write this
module. Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`, head `f6cf5c9` (the brief's
head); the working tree is at `d3e1d8f`, a drain of the fix12 wave into the store,
and `git diff f6cf5c9..d3e1d8f -- shared/core/lockstep/games/citadels/` is empty, so
the source I review is the brief's head. The citadels suite is green at 85 files /
680 tests before my file lands.

Product: this report plus
`shared/core/tests/lockstep/citadels/verification13.test.ts` — 11 counterexamples,
each failing against this head, plus 3 positive probes.

## Verdict

**FAIL.** Every D12 fix holds on its own clause: I re-proved the build seam over
all 24 threatenable characters (no character builds before its threat resolves now,
including the three stack reshapers and the Trader), the deferred build still lands
below the resolved threat, the Museum offer rides below the threat for every
character folded, and the both-marker lace, the codec round-trip, and the D10/D11
seating are unchanged.

Pass 13 swept the same mechanism one **window-kind** over, which is where every
previous defect sat: `buildBlockedByThreat` (`helpers.ts`, D12-4) refuses a build,
and nothing refuses an **ability**. `withThreat` splices the threat window below
the first `turn`-purpose window of the called stack *at `applyCall` time, before the
character's effect runs*; each character effect then pushes its own windows *above
that same turn window*. So for every character whose effect opens a window, that
window drains before the threat. Eleven characters are reachable and affected:
**D13-1 Warlord, D13-2 Marshal, D13-3 Diplomat, D13-4 Emperor, D13-5 Wizard,
D13-6 Magician, D13-7 Seer, D13-8 Spy, D13-9 Thief, D13-10 Artist, D13-11 Tax
Collector** — each uses its ability with the Blackmailer's marker still standing.

rules.json (blackmailer), the clause in force since the fix10 seam ruling:
*"A threatened player must resolve the threat before using abilities or building."*

## How to reproduce

```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification13.test.ts \
  --own shared/core/tests/lockstep/citadels/verification13.test.ts
# => VERIFY FAILED: vitest   (Tests 11 failed | 3 passed (14))
```

`vp test shared/core/tests/lockstep/citadels/` adds exactly 11 failing tests to the
suite (D13-1 … D13-11); P1, P2, P3 are green. `npx tsc -p tsconfig.citadels.json` is
green.

## The mechanism

`withThreat` (`helpers.ts`) is called from `applyCall` on the stack
`[RESOLVE, turn, END_TURN, CALL, …]` and splices the threat window below the first
`turn` window. The engine then runs the character's effect with that stack as
`rest`, and effects return their own windows **above** the head of `rest`:

- `warlord: [warlord-destroy, turn, threat, END_TURN, …]`
- `marshal: [marshal-seize, turn, threat, END_TURN, …]`
- `trader: [trader-build, turn, threat, END_TURN, …]`  (D12-4, refused at the build seam)

The D12 fix stops the third by refusing the build itself (`tryBuild` →
`buildBlockedByThreat`), and the character's own limit counter re-offers the
window. No equivalent exists at any other window kind, and the threatened branch
of `resolveTurn` reorders only what sits *below* the turn window, so it never sees
an effect's window above it.

Measured window orders on a fixed board (BOB threatened, hand
`[tavern, market, trading-post, palace]`, 20 gold, city `[museum]`, 4 gold on the
tax token; CARA holds `[market, palace]` and city `[tavern]`), every window driven,
the threat refused:

| character | window purposes | at the `blackmailer-threat` frame |
|---|---|---|
| king (control) | `-,turn,blackmailer-threat,blackmailer-resolve,turn,keep,turn,draft-pick` | city `museum`, nothing taken, nothing marked |
| warlord (D13-1) | `-,warlord-destroy,warlord-destroy,turn,blackmailer-threat,…` | **CARA's city `[]`** (its Tavern destroyed) |
| marshal (D13-2) | `-,marshal-seize,marshal-seize,turn,blackmailer-threat,…` | **BOB city `museum+tavern`**, CARA city `[]`, CARA gold 6→7, BOB gold 21 |
| diplomat (D13-3) | `-,diplomat-exchange,diplomat-exchange,diplomat-exchange,turn,blackmailer-threat,…` | **BOB city `tavern`, CARA city `museum`** — the cities exchanged |
| emperor (D13-4) | `-,emperor-crown,emperor-crown,turn,blackmailer-threat,…` | **BOB hand 4→5, CARA hand 2→1** |
| wizard (D13-5) | `-,wizard-take,wizard-take,turn,blackmailer-threat,…` | **BOB hand 4→5, CARA hand 2→1** |
| magician (D13-6) | `-,magician-swap,turn,blackmailer-threat,…` | **BOB hand 2, CARA hand 4** — the whole hands swapped |
| seer (D13-7) | `-,seer-receive,seer-receive,seer-give,seer-give,turn,blackmailer-threat,…` | CARA's hand dips to **1** mid-take, restored by the give |
| spy (D13-8) | `-,choose-seat,choose-type,turn,blackmailer-threat,…` | **CARA gold 6→5, BOB hand 4→5** |
| thief (D13-9) | `-,choose-character,turn,blackmailer-threat,blackmailer-resolve,turn,keep,thief-rob,turn,draft-pick` | the robbery is **decided** before the threat |
| artist (D13-10) | `-,artist-beautify,turn,blackmailer-threat,…` | **Museum marker 1**, BOB gold 22→21 |
| tax-collector (D13-11) | `-,tax-collect,turn,blackmailer-threat,…` | **BOB gold 22→26** — the whole 4-gold token taken |

## Defects (each has a failing test in verification13.test.ts)

### D13-1 — a threatened Warlord destroys a district before its threat resolves
Counterexample *"D13-1 a threatened Warlord resolves its threat before it
destroys"*. Measured: CARA's city is empty at the threat frame (`purposes
-,warlord-destroy,warlord-destroy,turn,blackmailer-threat`). Root cause: the
Warlord's effect opens `warlord-destroy` above the turn window, above the threat.

### D13-2 — a threatened Marshal seizes a district before its threat resolves
Counterexample *"D13-2 a threatened Marshal resolves its threat before it seizes"*.
Measured: BOB city `museum+tavern` (the seized Tavern), CARA city empty, CARA paid
its cost (6→7), BOB gold 21. Root cause: the Marshal's effect opens `marshal-seize`
above the turn window.

### D13-3 — a threatened Diplomat exchanges cards before its threat resolves
Counterexample *"D13-3 a threatened Diplomat resolves its threat before it
exchanges"*. Measured: the two cities are exchanged at the threat frame — BOB holds
`tavern`, CARA holds `museum`. Root cause: `diplomat-exchange` opens above the
turn window.

### D13-4 — a threatened Emperor takes the crown and a card before its threat resolves
Counterexample *"D13-4 a threatened Emperor resolves its threat before it takes the
crown"*. Measured: BOB hand 4→5, CARA hand 2→1 at the threat frame. Root cause:
`emperor-crown` opens above the turn window.

### D13-5 — a threatened Wizard takes a card before its threat resolves
Counterexample *"D13-5 a threatened Wizard resolves its threat before it takes a
card"*. Measured: BOB hand 4→5, CARA hand 2→1. The same window may also *build* the
taken card at once — a build ahead of the threat that `buildBlockedByThreat` would
refuse if it arrived through the turn window.

### D13-6 — a threatened Magician swaps its whole hand before its threat resolves
Counterexample *"D13-6 a threatened Magician resolves its threat before it swaps
hands"*. Measured: BOB hand 2, CARA hand 4 at the threat frame. Root cause:
`magician-swap` opens above the turn window.

### D13-7 — a threatened Seer takes and gives cards before its threat resolves
Counterexample *"D13-7 a threatened Seer resolves its threat before it takes and
gives cards"*. Measured: `-,seer-receive,seer-receive,seer-give,seer-give,turn,
blackmailer-threat`; the rival's hand falls to 1 during the take and is restored
by the give, so the net sizes hide the ability — the counterexample reads the
minimum hand over every frame before the threat, not the value at the threat.

### D13-8 — a threatened Spy peeks, takes gold, and draws before its threat resolves
Counterexample *"D13-8 a threatened Spy resolves its threat before it peeks and
takes"*. Measured: CARA gold 6→5, BOB hand 4→5. Root cause: `choose-seat` /
`choose-type` open above the turn window.

### D13-9 — a threatened Thief names its victim before its threat resolves
Counterexample *"D13-9 a threatened Thief resolves its threat before it names its
victim"*. Measured: `choose-character` drains before the threat, so the robbery is
decided (gold moves later, at the victim's reveal). Root cause: the Thief's naming
window opens above the turn window.

### D13-10 — a threatened Artist marks a district before its threat resolves
Counterexample *"D13-10 a threatened Artist resolves its threat before it
beautifies"*. Measured: the Museum in the Artist's city carries marker 1 and the
purse drops 22→21 at the threat frame. Root cause: `artist-beautify` opens above
the turn window.

### D13-11 — a threatened Tax Collector empties the token before its threat resolves
Counterexample *"D13-11 a threatened Tax Collector resolves its threat before it
takes the token"*. Measured: BOB gold 22→26 (the whole 4-gold token) with the marker
standing. Root cause: `tax-collect` opens above the turn window.

No gold or district crosses that would not cross anyway: the D12 build seam, the
D10 gather seating and the D11 lace are intact. The clause broken is the ordering —
but the rule states it flatly, and the coordinator's fix10 seam ruling already
names it as the clause in force.

## The teeth audit

Method: `cp -r` the worktree to `/tmp/citadels-v13` (no git command ran in the
shared worktree), patch one source file in the copy with a Python replace that
**asserts the pattern is present** (a no-op patch cannot masquerade as a pass), run
the named guard with `-t`, record RED/GREEN, restore the file from the shared
worktree by copy. Fifteen probes ran; thirteen reddened on the neutered behaviour.

| # | Guard | Neuter | Result |
|---|-------|--------|--------|
| T1 | verification12 "D12-4 a threatened Trader resolves its threat before it trades" | remove `buildBlockedByThreat`'s refusal in `tryBuild` | **RED** |
| T2 | engine-coverage "a threatened seat resolves its threat before it builds, on every stack shape" | threat search → `rest[0]` (revert D12-1..3) | **RED** |
| T3 | verification11 "D11-2 a threatened Navigator resolves the threat before its Museum offer" | drop the navigator branch's `below.slice(0, threatAt + 1)` splice (revert D11-2) | **RED** |
| T4 | verification12 "P2 two refused markers, both revealed, loot exactly one (the lace)" | `spendMarker` doubling → plain survivors | **RED** |
| T5 | verification12 "D12-1 a threatened Architect …" | `buildBlockedByThreat` reads the seat's first claim, not the acting character | **GREEN — finding** |
| T6 | engine-coverage "the Laboratory discards one card for two gold, once" | `REWARD` 2 → 0 | **RED** |
| T7 | engine-coverage "the Park draws two cards for an empty hand, once" | `PARK_DRAW` 2 → 1 | **RED** |
| T8 | engine-coverage "the Poor House pays one gold to an empty purse, once" | `POOR_HOUSE_GOLD` 1 → 0 | **RED** |
| T9 | navigator unit "gain four gold" | `NAVIGATOR_GOLD` 4 → 2 | **RED** |
| T10 | trader unit "gain 1 gold per trade district in your city" | trade income reads `military` | **RED** |
| T11 | district-seams "the Architect's limit of three is enforced by the counter, not the window count" | `BUILD_LIMITS.architect` 3 → 1 | **RED** |
| T12 | verification3 "the Keep protects its owner's city from the Warlord's destroy" | `keepProtects` → `false` | **RED** |
| T13 | verification2 "the Diplomat pays one extra gold to exchange a district out of a Great Wall city" | `greatWallToll` 1 → 0 | **RED** |
| T14 | spy unit "for each card of the named type the Spy takes 1 gold …" | gold taken per matching card → 0 | **RED** |
| T15 | thief unit "when the named character is called the Thief immediately takes all of its owner's gold" | loot → 0 | **RED** |

Reverse direction (behaviour removed, the guard must redden): T6, T7, T8, T9 and T5
are the reverse-direction set — five probes, four RED.

**Two probes are findings.**

1. **T5 is green.** Replacing `activeCharacterOf(state, seat)` with the seat's first
   claim inside `buildBlockedByThreat` leaves the D12-1 guard green: the D12 folds
   hold one claim per seat, so the key that distinguishes the acting character (the
   D7 family) is not pinned on the threat path. No guard folds a *threatened* seat
   holding two characters, so a source change keying the block on the seat's first
   claim would pass the whole suite. This is the guard gap the next wave should
   close.
2. **T11's first aim is itself a finding.** `ARCHITECT_BUILD_LIMIT` in
   `characters/architect.ts:18` is a dead mirror: patching it leaves every guard
   green, because the live clause is `BUILD_LIMITS` in `helpers.ts:432`. Pass 8
   flagged this mirror as redundant; it still cannot be attacked by any guard aimed
   at the character file. With the correct target (`helpers.ts`, row T11 above) the
   guard reddens.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal (one winner) for 3-6 seats | **PASS** | Unchanged this pass; nothing I ran touches the round machine. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D13-1…D13-11: eleven characters use their ability before resolving the threat, violating "A threatened player must resolve the threat before using abilities or building" (rules.json blackmailer). |
| 3 | Every district implemented with a test per unique effect | **PASS** | No district defect; the once-per-turn teeth (T6, T7, T8) and the Great Wall / Keep tolls (T12, T13) are sharp. |
| 4 | Exact scoring: cost sum, five-type bonus, 4 first / 2 other, unique points, tie-breaks | **PASS** | Unchanged; prior scorers hold. |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | Unchanged; `threats` stays engine bookkeeping and the lace survives the codec (verification12 P3, still green). |
| 6 | No unverified file; `vp test` and `tsc` green | **FAIL** | `tsc -p tsconfig.citadels.json` is green, but the suite goes red the moment `verification13.test.ts` lands (11 failed \| 679 passed). |

## What is verified vs unverified

**Verified this pass** (measured, not read):

- The D12 build seam over **all 24 threatenable characters** (ranks 2-9), each
  folded with a buildable hand and every window driven: no character builds before
  its threat resolves — `bobCity@threat` is `[museum]` for all of them. The three
  stack reshapers (Architect `-,turn,blackmailer-threat,…`, Alchemist
  `-,turn,blackmailer-threat,…`, Scholar `-,scholar-keep,turn,blackmailer-threat…`)
  and the Trader (`-,trader-build,turn,blackmailer-threat,…`, nothing built) hold.
- The deferred build is **not lost**: after the threat resolves, every character
  folded reaches at least one post-threat build window (P2 folds the King,
  Architect, Scholar, Trader and Alchemist and asserts a final city longer than the
  start).
- The Museum's placement offer rides **below** the threat for every character
  folded, including the Museum-owning turn and the Navigator (P3).
- Ten characters are clean of the D13 family entirely — King, Patrician, Bishop,
  Merchant, Alchemist, Architect, Navigator, Scholar, Trader, Queen — their effects
  open no window above the turn window, so gather → threat → build is the whole
  order.
- The Cardinal's `cardinal-gold` window **does** open before the threat, but the
  income pass carries a zero shortfall and takes nothing (`shortfall <= 0` →
  `popWindow`), so no gold crosses; measured-clean, not claimed as a defect.
- The Abbot's `abbot-split` window opens before the threat; it is the income
  declaration that belongs to the gather, so it is **not** claimed as a defect.

**Unverified / not checked:** the Blackmailer threatened by its own marker (my
harness forces the marker into `threats` and the Blackmailer's naming pass then
rewrites the array, so the fold is not a reachable single-cast game position — no
claim either way); the rank-1 characters (Assassin, Witch, Magistrate) cannot be
threatened (`canThreat` excludes rank 1), so my first sweep's rows for them are
harness artifacts, not defects; the Witch's takeover path under a standing marker;
the draft spare at 2/3/4/5/6/7 seats; the six preset casts; scoring under two
claims; terminal and winner resolution; card conservation across every path;
determinism and convergence at 2-7 seats; and — still open from passes 10, 11 and
12 — **no data-driven test compares the 27 character `summary` strings to
rules.json**.

## What a human should still scrutinize

1. **The fix shape for D13.** The build seam is refused inside `tryBuild`, which is
   shape-independent; the ability seam needs the same property. Either every
   character effect places its window *below* a standing threat window (a
   per-effect change in 13 files, each pre-registered to its owner), or the effect
   windows are refused when they open, or `withThreat` moves the threat above the
   effect's stack segment — a `helpers.ts` shape. The coordinator serializes the
   choice; `helpers.ts` and `characters/index.ts` are both shared files.
2. **Guard gap T5.** The threat block is not pinned against the seat's first claim,
   the D7 family one window-kind over. A guard that folds a threatened seat holding
   two characters (acting character = second claim) pins it.
3. **Guard gap T11.** `characters/architect.ts`'s `ARCHITECT_BUILD_LIMIT` is a dead
   mirror of the live `BUILD_LIMITS` clause; delete the export (pass 8 recommended
   it) or let the limit read one source.
4. **The two-character and Museum rows still fold one claim each** in the guard
   suite, which is why the D7 and D9 families each needed a pass to find.
5. **The character summaries** still have no rules.json comparison (passes 10-12
   flagged the same gap).

## Appendix: exact verify output

```
$ scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification13.test.ts \
    --own shared/core/tests/lockstep/citadels/verification13.test.ts
== vitest (the gate) ==
 ❯ shared/core/tests/lockstep/citadels/verification13.test.ts (14 tests | 11 failed)
   × D13-1 a threatened Warlord resolves its threat before it destroys 32ms
   × D13-2 a threatened Marshal resolves its threat before it seizes 3ms
   × D13-3 a threatened Diplomat resolves its threat before it exchanges 3ms
   × D13-4 a threatened Emperor resolves its threat before it takes the crown 3ms
   × D13-5 a threatened Wizard resolves its threat before it takes a card 3ms
   × D13-6 a threatened Magician resolves its threat before it swaps hands 2ms
   × D13-7 a threatened Seer resolves its threat before it takes and gives cards 3ms
   × D13-8 a threatened Spy resolves its threat before it peeks and takes 2ms
   × D13-9 a threatened Thief resolves its threat before it names its victim 2ms
   × D13-10 a threatened Artist resolves its threat before it beautifies 2ms
   × D13-11 a threatened Tax Collector resolves its threat before it takes the token 2ms
 Test Files  1 failed (1)
      Tests  11 failed | 3 passed (14)
VERIFY FAILED: vitest
```

The 11 red, in file order: D13-1 … D13-11. The 3 green: P1, P2, P3.

## Deviation reported (standing order 4)

None. I wrote only the two files named in my brief. Every source edit for the teeth
audit was made in `/tmp/citadels-v13` (a `cp -r` copy, restored from the shared
worktree after each probe); no `checkout`/`switch`/`stash`/`reset`/`rebase`/`branch`
ran in the shared worktree, and `git status --porcelain` shows only my two new
files. The fix for D13 touches `helpers.ts` and up to 13 character files, all
shared or pre-registered to other owners, so it is routed to the coordinator rather
than attempted here.
