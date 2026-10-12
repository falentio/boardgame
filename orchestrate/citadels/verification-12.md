# Citadels game definition: twelfth independent verification

Verifier: review sub-agent (adversarial, twelfth pass). I did not write this
module. Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`. The brief names source head
`262836a` (fix11: the flowered-lace identity survives a marker removal, a
threatened Navigator's Museum offer rides below its threat). Working-tree head
is `e576d6c`, a drain of the fix11 wave into the orchestrate store; I confirmed
`git diff 262836a..e576d6c -- shared/core/lockstep/games/citadels/` is empty, so
the source I review is the brief's head. The citadels suite is green at 84 files
/ 672 tests before my file lands.

Product: this report plus
`shared/core/tests/lockstep/citadels/verification12.test.ts` — 3
counterexamples, each failing against this head, plus 3 positive probes.

## Verdict

**FAIL.** The eleventh-pass fix is real on both clauses it landed — I re-proved
the doubled-survivor lace encoding across both marker orderings, every bribe /
refuse / reveal mode, and *mixed* per-seat answers (four extra folds, gold
conserved, at most one looting), and the doubled shape survives the codec
round-trip (`decodeCharacters` is a `.map`; `encode` spreads — no dedup, so no
relacing). The Magistrate's parallel seam is also clean (only `warrants[0]`,
the named target, opens confiscate, and warrants are removed wholesale, so there
is no D11-1 analog).

The twelfth pass found the threat-ordering fix's **third** member, which neither
the tenth nor eleventh pass swept, because both folded threatened seats with an
empty hand. The pass-10/11 fix tells a threatened seat's two turn windows apart
by reading `rest[0]` of the turn window (`resolveTurn`, `helpers.ts`):
`hasThreat` is true only when `rest[0]` *is* the `blackmailer-threat` window.
That holds for every simple character, so the fix is correct for the King, the
Merchant, the Seer, the Trader, the Wizard, the Warlord, the Navigator — and for
all 26 threatenable characters *as long as the seat never builds*. But a
character whose effect reshapes the top of the turn's stack moves the threat out
of that slot:

1. **D12-1** — a threatened **Architect** builds up to three districts and opens
   its Museum placement *before* it resolves the threat.
2. **D12-2** — a threatened **Alchemist** builds and tucks a card under its
   Museum *before* it resolves the threat.
3. **D12-3** — a threatened **Scholar** builds two districts and opens its Museum
   placement *before* it resolves the threat.

rules.json (blackmailer): *"A threatened player must resolve the threat before
using abilities or building."* Measured window orders (below) put every build and
the Museum placement ahead of `blackmailer-threat`.

## How to reproduce

```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification12.test.ts \
  --own shared/core/tests/lockstep/citadels/verification12.test.ts
# => VERIFY FAILED: vitest   (Tests 3 failed | 3 passed (6))
```

`vp test shared/core/tests/lockstep/citadels/verification12.test.ts` adds exactly
3 failing tests (D12-1, D12-2, D12-3) to the suite: 3 failed | 668 passed (672)
when it lands; the 3 green are the positive probes P1, P2, P3. `npx tsc -p
tsconfig.citadels.json` is green.

## Defects (each has a failing test in verification12.test.ts)

The fix's sentinel lives in `resolveTurn` (`helpers.ts`): a threatened seat is
told from the stack by whether the `blackmailer-threat` window sits directly
under its turn window.

```
const postThreat = incoming === null && rest[0]?.kind === "resolve";
const alreadyGathered = resumedWitch || gatheredPending !== null || postThreat;
if (threatened && !alreadyGathered) {
  const threat = rest[0];
  const hasThreat = threat?.kind === "window" && threat.window.purpose === "blackmailer-threat";
  const belowThreat = hasThreat ? [threat, buildWindow, POST_THREAT, ...rest.slice(1)]
                                : [buildWindow, ...rest];
  ... gather ... return withSteps(markGathered(gathered), belowThreat);
```

Three character effects take the `hasThreat === false` branch, so the gather is
followed by the pre-seeded build windows with the threat buried in the tail:

- **`withBuildLimit`** (`characters/architect.ts`, and a byte-identical copy in
  `characters/scholar.ts`) hoists its N build windows to the front and drops the
  `blackmailer-threat` into `others` (the non-turn tail):
  `return [...turns, ...others];` where `others` still contains the threat.
- **the Alchemist's `atTop` pass** (`characters/alchemist.ts`) injects a bare
  `RESOLVE` directly under the turn window:
  `return withSteps(..., [turn, RESOLVE, ...ctx.rest.slice(1)]);` so `rest[0]`
  is a RESOLVE, not the threat.

Measured per-frame window purposes, on a fixed board (Museum in the city, three
affordable cards in hand, 20 gold), a build driven at every build window, the
threat refused and not revealed:

| character | window purposes | threat index | first build index | city at threat |
|---|---|---|---|---|
| King (control) | `-,turn,**blackmailer-threat**,blackmailer-resolve,turn,keep,turn` | 2 | 5 | museum |
| Merchant (control) | `-,turn,**blackmailer-threat**,blackmailer-resolve,turn,keep,turn` | 2 | 5 | museum |
| Architect (D12-1) | `-,turn,turn,turn,turn,keep,**blackmailer-threat**,...` | 6 | 3 | museum+tavern+palace+dragon-gate |
| Alchemist (D12-2) | `-,turn,turn,keep,**blackmailer-threat**,...` | 4 | 3 | museum+tavern |
| Scholar (D12-3) | `-,scholar-keep,turn,turn,turn,keep,**blackmailer-threat**,...` | 6 | 4 | museum+tavern+palace |

The King and Merchant resolve the threat before building and before their Museum
placement; the Architect, Alchemist, and Scholar build and place first. The
counterexamples assert that at the `blackmailer-threat` frame the seat's city is
untouched (`["museum"]`) and its Museum tuck count is 0 — the rule's "before
using abilities or building".

### D12-1 — a threatened Architect builds before it resolves the threat

Counterexample *"D12-1 a threatened Architect resolves its threat before it
builds"*. Measured: city at the threat frame is
`museum+tavern+palace+dragon-gate` — three districts built before the threat;
the Museum placement (`keep`, tuck 1) also precedes it. Root cause is
`withBuildLimit` returning `[...turns, ...others]` with the threat in
`others`.

### D12-2 — a threatened Alchemist builds before it resolves the threat

Counterexample *"D12-2 a threatened Alchemist resolves its threat before it
builds"*. Measured: `-,turn,turn,keep,blackmailer-threat`; the Tavern is built
and a card is tucked under the Museum before the threat. Root cause is the
Alchemist's `atTop` `[turn, RESOLVE, ...]` rewrite.

### D12-3 — a threatened Scholar builds before it resolves the threat

Counterexample *"D12-3 a threatened Scholar resolves its threat before it
builds"*. Measured: `-,scholar-keep,turn,turn,turn,keep,blackmailer-threat`; two
districts built before the threat (the `scholar-keep` draw is the Scholar's
gather and may precede the threat; the builds may not). Root cause is the
byte-identical `withBuildLimit`.

No gold crosses on the refused path and the Alchemist refund still lands, so the
only clause broken is the ordering — but the rule states it flatly, and the
coordinator's fix10 seam ruling (`decisions.tsv`, 2026-10-12T06:01:00Z) already
names "before using abilities or building" as the clause in force.

## The teeth audit

Method: `cp -r` the worktree to `/tmp/citadels-v12` (no git command ran in the
shared worktree), patch one source file in the copy with a Python replace that
**asserts the target string is present** (so a no-op patch cannot masquerade as a
passing guard), re-run the named guard with `-t`, record RED/GREEN, restore from
the shared worktree.

Conclusive (patch applied, guard RED on the neutered behaviour):

| # | Guard | Neuter | Result |
|---|-------|--------|--------|
| T2 | engine-coverage "the Laboratory discards one card for two gold, once" | `REWARD = 2` -> `0` | **RED** |
| T3 | engine-coverage "a revealed laced target is looted and a refused decoy never is" | `spendMarker` doubling -> plain survivors | **RED** |
| T8 | navigator unit "four gold" | `NAVIGATOR_GOLD` 4 -> 2 | **RED** |
| F5 | engine-coverage "trader still counts a declared" | trade income -> `0` | **RED** |
| R2 | engine-coverage "the Park draws two cards for an empty hand, once" | `DRAW` 2 -> 1 | **RED** |
| R3 | engine-coverage "the Poor House pays one gold to an empty purse, once" | payout 1 -> 0 | **RED** |

T3 is the important one for this head: the *both-marker lace* guard reddens when
`spendMarker`'s doubling is removed, so the fix11 encoding is genuinely pinned.

Reverse probes (remove behaviour, guard must RED): Park 2->1 (RED) and Poor House
1->0 (RED) above are the reverse direction; the navigation-gather reverse
(`NAVIGATOR_CARDS` 4->1) was mis-aimed by the filter and is not counted.

**Inconclusive, reported not claimed.** Several probes returned empty because my
`-t` substring matched zero subtests, or the matched subtest did not assert the
neutered value (e.g. T9 `keepProtects` off selected a non-keep Warlord subtest:
"1 passed"). A patch applied but a guard stayed green on the *exact* asserted
value would be a theater guard; I did not isolate one inside the timebox, so I
flag these as filter-mismatch, not as proven-weak. The teeth target of "ten
guards, five reverse" is only partly met (six conclusive pins) because the
timebox expired mid-audit; the six that landed span once-per-turn
(Laboratory), both-marker lace (spendMarker), the Navigator gather, Board
declared-type income (Trader), and two end-of-turn districts (Park, Poor House).

**D12 root-cause proof — not completed.** I attempted a "revert the mechanism ->
D12 goes green" round (reverting the Alchemist `[turn, RESOLVE, ...]` insert and
re-seating `withBuildLimit`); the patch strings did not apply inside the timebox,
so the executable evidence for D12 is the three failing counterexamples on the
head plus the read mechanism above, not a patch-and-green round. Stated plainly:
the counterexamples fail (executable), the mechanism is read-identified, and a
targeted source change is the one thing I did not get to measure green.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal (one winner) for 3-6 seats | **PASS** | Unchanged this pass; prior folds hold and nothing I ran touches the round machine. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D12-1/2/3: a threatened Architect, Alchemist, or Scholar builds and places before it resolves the threat, violating "resolve the threat before using abilities or building" (rules.json blackmailer). |
| 3 | Every district implemented with a test per unique effect | **PASS** | No district defect; the end-of-turn and both-marker guard teeth (T2, T3) are sharp. |
| 4 | Exact scoring: cost sum, five-type bonus, 4 first / 2 other, unique points, tie-breaks | **PASS** | Unchanged; prior scorers hold. |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | Unchanged; `threats`/`warrants` are engine bookkeeping, never in `project` (state.ts comment), and the doubled marker survives the codec (P3). |
| 6 | No unverified file; `vp test` and `tsc` green | **FAIL** | `tsc -p tsconfig.citadels.json` is green, but the suite goes red the moment `verification12.test.ts` is added (3 failed | 668 passed). |

## What is verified vs unverified

**Verified:** the eleventh-pass marker-list lace encoding across both orderings,
all bribe/refuse/reveal modes, and mixed per-seat answers (measured: gold
conserved, at most one looting — the decoy is never looted once the lace is
spent, confirmed in a /tmp copy); the doubled marker survives the codec
round-trip (P3, and `decodeCharacters` read as a `.map`); `threats` is cleared
at end of round (`clearRoundMarkers`), so no lace fact carries across a round
boundary; the Magistrate warrant seam is clean (confiscate triggers only on
`warrants[0]`, the named target; warrants removed wholesale — no D11-1 analog);
a refused threat still lands simple characters (King, Merchant) in gather ->
threat -> build -> placement order (P1) and pays nothing across; lighthouse.
The D1..D11 families hold; `tsc` green.

**Unverified / broken:** the "threat before abilities or building" ordering for
characters whose effect reshapes the turn stack top — Architect, Alchemist,
Scholar build and open their Museum placement before the threat resolves (D12-1,
D12-2, D12-3). No guard folds any of the three holding an affordable district, so
none is reachable from the guard suite.

## What a human should still scrutinize

1. **The D12 fix shape.** `resolveTurn` must not assume the threat is at
   `rest[0]`. Either `withBuildLimit` (and the Alchemist's `atTop`) must keep
   the `blackmailer-threat` window above the build windows, or the threatened
   branch must hoist a threat found anywhere in `rest` before the build
   continuation. Both are shared-file (`helpers.ts`) or two character-file
   changes; the coordinator serializes them.
2. **The guard gap that let D12 through.** No guard folds a threatened
   multi-build / stack-reshaping character with a card it can actually build.
   The pass-11 P1 sweep used an empty hand, so the ordering was never exercised;
   the guard's threat rows fold only a single threatened seat. Add a row folding a
   threatened Architect / Alchemist / Scholar holding an affordable district.
3. **Bribe vs refuse under the two-marker double.** I verified the lace by
   folding mixed answers (bribe+reveal, reveal+bribe, bribe+bribe, refuse+refuse);
   a human may still want a guard row that folds a *mixed* two-marker round so
   the doubling cannot regress silently.
4. **The character summaries.** Still no data-driven test compares the 27
   `summary` strings to rules.json; I re-read all 27 against the rule text this
   pass and found no misstatement, but the gap remains (passes 10 and 11 flagged
   it too).

## Appendix: exact verify output

```
$ scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification12.test.ts \
    --own shared/core/tests/lockstep/citadels/verification12.test.ts
== vitest (the gate) ==
 ❯ shared/core/tests/lockstep/citadels/verification12.test.ts (6 tests | 3 failed)
   × D12-1 a threatened Architect resolves its threat before it builds
   × D12-2 a threatened Alchemist resolves its threat before it builds
   × D12-3 a threatened Scholar resolves its threat before it builds
 Test Files  1 failed (1)
      Tests  3 failed | 3 passed (6)
VERIFY FAILED: vitest
```

```
$ vp test shared/core/tests/lockstep/citadels/verification12.test.ts
 Test Files  1 failed (1)
      Tests  3 failed | 3 passed (6)
```

The 3 red, in file order: D12-1, D12-2, D12-3. The 3 green: P1, P2, P3.

## Deviation reported (standing order 4)

None. I wrote only the two files in my brief; every source edit I made for the
teeth audit and probes was made in `/tmp/citadels-v12`, a `cp -r` copy, never in
the shared worktree (confirmed: `git status --porcelain` shows only the untracked
`verification12.test.ts`, and `git diff` under the module is empty). No
`checkout`/`switch`/`stash`/`reset`/`rebase`/`branch` ran in the shared
worktree. The teeth-audit probes that returned empty are filter/subtest
mismatches, not guard weaknesses, and are reported as inconclusive rather than
counted.
