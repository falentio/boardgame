# Citadels game definition: eleventh independent verification

Verifier: review sub-agent (adversarial, eleventh pass). I did not write this
module. Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`, head `cd506d5` ("fold the
Blackmailer's refuse path in the engine-coverage guard"), the commit the brief
names. The citadels suite is green at 83 files / 666 tests before my file lands.

Product: this report plus
`shared/core/tests/lockstep/citadels/verification11.test.ts` — 2
counterexamples, each failing against this head, plus 2 positive probes.

## Verdict

**FAIL.** The tenth-pass fix is real: I re-proved the refuse path for **every one
of the 26 threatenable characters** on two boards (P1 below) — a refused threat
now lands exactly where an unthreatened turn lands, no gold crosses, no ability is
skipped, and the Cardinal's shortfall retry still builds below a refused threat
(P2). Both refusal-thread guard rows redden on revert in the teeth audit (F1, F2).

The eleventh pass found the seam's **second** member, which the tenth pass also
did not sweep: the Blackmailer places **two** threat markers. The
`blackmailerResolve` resolver decides whether the revealed marker is the laced
one by reading `threats[0]` — the first threat **still standing**, not the one
that **carried** the lace. Since `state.threats` is recorded target-first and
each resolution removes its character, the moment the target's marker leaves the
list the second marker **inherits** the lace:

1. **D11-1** — a refused **decoy** is looted for all its gold. rules.json
   (blackmailer): "one shows the flowered lace and is the target ... revealing the
   flowered lace takes all their gold." One marker carries the lace, so at most
   one seat can ever be looted by a reveal. Measured: the target loots 8, then the
   decoy loots 7 more; the Blackmailer takes **15 out of 10 gold on the table**.
2. **D11-2** — a threatened **Navigator owning a Museum** is handed the Museum's
   placement offer **above** its threat window. rules.json (blackmailer): "A
   threatened player must resolve the threat before using abilities or building."
   Measured purposes: `turn, keep, blackmailer-threat` — the seat tucks a card
   (an ability) before it resolves the threat.

Both are one clause beside the fix that just landed, and both are invisible to the
guard suite: the guard's threat rows drive only a **single** threatened seat
(`threats: [threatened, "assassin"]`, and the assassin is rank 1, so it is never
threatened in play), so the two-marker dimension is folded nowhere.

## How to reproduce

```
scripts/citadels-verify.sh \
  shared/core/tests/lockstep/citadels/verification11.test.ts \
  --own shared/core/tests/lockstep/citadels/verification11.test.ts
# => VERIFY FAILED: vitest   (Tests 2 failed | 2 passed (4))
```

Whole citadels suite with this file added:

```
vp test shared/core/tests/lockstep/citadels/
# => Test Files  1 failed | 83 passed (84)
#    Tests  2 failed | 668 passed (670)
```

`npx tsc -p tsconfig.citadels.json` is green (rc=0).

## Defects (each has a failing test in verification11.test.ts)

### D11-1 — the second threat marker inherits the flowered lace

`blackmailerResolve` (characters/blackmailer.ts:122-138) decides the reveal:

```
const threats = cleared.threats ?? [];
const flowered = threats[0] === character;
```

`state.threats` is built in `applyCall`'s neighbour `blackmailer`
(characters/blackmailer.ts:61-73) as `[...base, second]` with the **target
first**, and both `resolveThreat` (line 106) and `resolveReveal` (line 133)
drop the resolved character from that same array. So `threats[0]` is "the
target" only until the target's marker is removed; from then on it is whatever
marker survived, which is the **decoy** — the one with no lace at all.

Measured (BOB holds the Merchant, the first threat named, so the lace; CARA holds
the Architect, the decoy; BOB starts at 5 gold, CARA at 5; both refuse and the
Blackmailer reveals both):

| fold | ANN | BOB | CARA |
|------|-----|-----|------|
| both revealed (defect) | **15** | 0 | **0** |
| target revealed only (control) | 8 | 0 | **7** |
| neither revealed (control) | 0 | 8 | 7 |

BOB's purse at the threat is 5 + 2 gather + 1 Merchant income = 8; CARA's is
5 + 2 = 7. The rule allows exactly one looting of 8. The second row is the
control that isolates the cause: with the reveal declined for the decoy, the decoy
keeps all 7 — the only difference is the reveal answer.

Counterexample: *"D11-1 the second threat marker carries no flowered lace"*.
Controls (7/7/0 and 8/0) pass; the revealed fold measures CARA **0** (expected 7)
and ANN **15** (expected 8).

Root cause proven in a `/tmp` copy: keying the lace to the first-**assigned**
marker instead of the first-**remaining** one
(`const flowered = threats[0] === character && threats.length > 1`) turns this
counterexample green with no other change.

### D11-2 — a threatened Navigator tucks under its Museum before it resolves

`resolveTurn`'s Navigator branch (helpers.ts:762-772) splices the Museum's
placement offer into the continuation **above** everything the resolve step left:

```
const at = rest.findIndex((step) => step.kind === "resolve");
if (at < 0) return withSteps(armed, rest);
const offer = withMuseumOffer(armed, seat, endTurnThen(withoutTurnWindows(rest.slice(at + 1), seat)));
return withSteps(offer.state, [...rest.slice(0, at + 1), ...offer.steps]);
```

`withThreat` (helpers.ts:979-1009) puts the Navigator's threat window below its
resolve step, so `rest.slice(at + 1)` starts with the threat window. The offer is
prepended in front of it, so the keep window opens while the marker is still on
the table.

Measured (Navigator, Museum in city, one card in hand, empty purse, threat
refused and not revealed):

| path | window order |
|------|--------------|
| unthreatened (control) | `-, turn, keep, warlord-destroy, turn, turn` |
| refused threat (defect) | `-, turn, keep, blackmailer-threat, blackmailer-resolve, warlord-destroy, turn, turn` |

Counterexample: *"D11-2 a threatened Navigator resolves the threat before its
Museum offer"*. The controls (the offer opens once; the tuck lands once) pass; the
ordering assertion measures `keep` at index 2 and `blackmailer-threat` at index
3 — the placement ran first.

The gold at the threat window is still post-gain (the D10-3 fix holds: a bribing
Navigator pays half of 4 = 2), so the ordering is the only clause broken — but
the rule states it flatly.

The coordinator's own fix10 seam ruling already names the clause this defect
breaks. `orchestrate/citadels/decisions.tsv`, 2026-10-12T06:01:00Z: "the rule
text ('gather resources, then resolve the threat' + **'before using abilities or
building'**) settles the order". The offer was routed with the first half in mind
and not the second: `withMuseumOffer` was told to step past a standing turn
window, never past a standing `blackmailer-threat` window.

## The teeth audit

Method: `cp -r` the worktree to `/tmp/citadels-v11` (no git command ran in the
shared worktree; the copy's files are restored between probes by `cp` from the
shared worktree), patch one source file in the copy with `python3`, re-run the
named guard with `-t`, record RED/GREEN, restore. 17 probes: 12 forward (revert
the fix, the guard must redden), 4 reverse (remove the behaviour, the guard must
redden), 1 root-cause proof for each defect.

### Forward (revert/neuter the fix, the guard must redden)

| # | Guard | Reverted | Result |
|---|-------|----------|--------|
| F1 | engine-coverage "the engine reaches blackmailer" (refuse row) | `const postThreat = ...` -> `false` (the D10-1/2/3 fix) | **RED** — "the refused King gathered exactly once: expected 4 to be 2" |
| F2 | engine-coverage "the engine reaches blackmailer" | `value === "bribe"` -> `... && false` | **RED** |
| F3 | engine-coverage "the engine reaches navigator" | `NAVIGATOR_GOLD` 4 -> 2 | **RED** |
| F4 | engine-coverage "the engine reaches keep" | `keepProtects` -> `false` | **RED** |
| F5 | engine-coverage "the engine reaches great-wall" | toll 1 -> 0 | **RED** |
| F6 | engine-coverage "the engine reaches trader" | income -> `ctx.state` (no-op) | **RED** |
| F7 | engine-coverage "the Laboratory discards one card for two gold, once" | `REWARD` 2 -> 0 | **RED** |
| F8 | engine-coverage "the Alchemist's build with a Museum keeps its refund and still tucks" (Museum-owning row) | `pending?.note === MUSEUM_OFFER_NOTE` dropped from `resolveKeep` | **RED** — "the Museum's offer did not steal the Alchemist's spend pending ... expected 1 to be 2" |
| F9 | engine-coverage "the Navigator's turn still opens the Museum's placement offer" (Museum-owning row) | the Navigator branch's splice dropped | **RED** — "expected [ null, 'turn', 'draft-pick' ] to include 'keep'" |
| F10 | engine-coverage "the Witch's resume declares the School of Magic of a two-character seat" (two-character row) | the resume's `declareSchoolOfMagic` removed | **RED** |
| F11 | engine-coverage "the Theater owner gives the claim it chooses from a two-character seat" (two-character row) | `giveIndex` forced to 0 | **RED** |
| F12 | engine-coverage "the engine reaches spy" | `transferGold` -> the cleared state | **RED** |

All twelve forward probes turn RED. The refuse-path rows (F1, F2) are now sharp:
the tenth-pass guard does have teeth on the seam it was written for.

### Reverse (remove the behaviour, the guard must redden)

| # | Guard | Behaviour removed | Result |
|---|-------|-------------------|--------|
| R1 | engine-coverage "the engine reaches thief" | `loot` -> 0 | **RED** |
| R2 | engine-coverage "the Poor House pays one gold to an empty purse, once" | `POOR_HOUSE_GOLD` 1 -> 0 | **RED** |
| R3 | engine-coverage "the Park draws two cards for an empty hand, once" | `PARK_DRAW` 2 -> 1 | **RED** |
| R4 | engine-coverage "the engine reaches navigator" | `withoutBuild` dropped, so the Navigator's turn keeps a build window | **GREEN** |

### One guard that stayed GREEN — finding

**R4.** The Navigator's build-strip (`withoutBuild`, characters/navigator.ts:56-67)
is not pinned by any engine-coverage row. Removing it leaves the guard suite
green because the Navigator's folded hand is empty, so the offered build window
resolves to nothing. rules.json (navigator): "You cannot build any districts this
turn, not even districts that would not count toward your building limit." That
clause is covered only by the character's own unit test
(`characters/navigator.test.ts`), which arms the state by hand — the same shape
of gap that let the D9 and D10 families through. A guard row that folds a
Navigator holding an affordable district would close it.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | A full game reaches terminal for 3-6 seats | **PASS** | Integration folds 3/4/5/6 seats and the casts; nothing I ran touched the round machine, and my P1 sweep reaches a fresh draft from a real deal for 52 folds. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D11-1 breaks the threatened seat's gold for every character (the second marker). D11-2 breaks the threatened Navigator's Museum turn. P1 proves the other 26 refuse paths and the bribe paths are right. |
| 3 | Every district implemented with a test per unique effect | **PASS** | No district defect found this pass; both Museum-owning rows redden on revert (F8, F9), and the end-of-turn rows (Laboratory, Poor House, Park) are sharp in both directions. |
| 4 | Exact scoring | **PASS** | Unchanged this pass; the prior scorers hold. |
| 5 | Hidden information never crosses `project`; two peers converge | **PASS** | Unchanged; the threat seam writes no view-visible state (`project` carries `pending`s actor/character/target/card count only). |
| 6 | No unverified file; `vp test` and the citadels typecheck green | **FAIL** | `tsc -p tsconfig.citadels.json` is green (rc=0), but the suite goes red the moment `verification11.test.ts` is added (2 failed | 668 passed). |

## What is verified vs unverified

**Verified:** the tenth-pass fix on the refuse path for all 26 threatenable
characters on two boards (Museum-owning and School-of-Magic-owning) — refuse
equals unthreatened on gold, hand, city and Museum tuck, and the bribe pays half
rounded down of the post-gather purse (P1); the Cardinal's shortfall retry below a
refused threat (P2); the threatened Witch's held turn still ends without a second
gather and still resolves its threat; the Tax Collector's window still opens
above a threatened seat's gather; the Museum's offer still opens exactly once on
a threatened seat's own turn; `tsc` green; the D1..D10 families hold and 12 of
16 teeth probes redden on revert.

**Unverified / broken:** the two-threat-marker dimension. D11-1: the second
marker's reveal takes the decoy's gold. D11-2: the threatened Navigator's Museum
placement runs before the threat resolves. No guard row folds two threatened
seats, so neither is reachable from the guard suite.

## What a human should still scrutinize

1. **Where the lace is recorded.** The rule gives the Blackmailer two markers and
   names exactly one as the lace, so the engine needs to remember **which**
   character received it. `state.threats` records the target first, which is the
   right order but not the right fact once an entry is removed. A `laceHolder`
   field (or keeping the target's marker in a separate field until it resolves)
   is the shape a fix needs — a helpers/state change, so the coordinator
   serializes it.
2. **The Navigator + Museum splice.** The offer is prepended in front of everything
   the resolve step left. A threatened Navigator's threat window lives there, so
   the offer must be spliced **below** the threat rather than at the head: the
   continuation should be `[RESOLVE, threat, offer, END_TURN, ...]`, not
   `[RESOLVE, offer, threat, END_TURN, ...]`. `withMuseumOffer` would need to
   know to step past a `blackmailer-threat` window the way `endTurnThen`
   already does.
3. **The guard-file gap on the two-marker dimension.** `engine-coverage.test.ts`
   folds exactly one threatened seat (`threats: [threatened, "assassin"]`, and
   the assassin is rank 1 and can never be threatened). It should fold **both**
   markers being resolved in one round — one bribe then one refused-and-revealed —
   so the lace seam cannot regress silently again.
4. **R4 above.** No guard row pins "the Navigator may build nothing this turn",
   not even a non-counting build. A Navigator guard row holding an affordable
   district would close it.
5. **The character summaries.** Still no test compares the 27 `summary` strings
   to rules.json. I re-read all 27 against the rule text this pass and found no
   misstatement; the gap remains.

## Appendix: exact verify output

```
$ scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification11.test.ts \
    --own shared/core/tests/lockstep/citadels/verification11.test.ts
== vitest (the gate) ==
 ❯ shared/core/tests/lockstep/citadels/verification11.test.ts (4 tests | 2 failed)
   × D11-1 the second threat marker carries no flowered lace
   × D11-2 a threatened Navigator resolves the threat before its Museum offer
 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
VERIFY FAILED: vitest
```

```
$ vp test shared/core/tests/lockstep/citadels/
 Test Files  1 failed | 83 passed (84)
      Tests  2 failed | 668 passed (670)
```

```
$ npx tsc -p tsconfig.citadels.json
(no output)
TSC_RC=0
```

The 2 red tests, in file order: D11-1, D11-2. The 2 green: P1, P2.

## Deviation reported (standing order 4)

My first teeth-audit script opened with `cd /tmp/citadels-v11` before that copy
existed, so the first probe patched `shared/core/lockstep/games/citadels/helpers.ts`
**in the shared worktree** instead of the copy (one line: `const postThreat = ...`
-> `const postThreat = false;`). I restored that line by hand within the same
minute and confirmed `git diff shared/core/lockstep/games/citadels/helpers.ts`
is empty afterwards; the current diff of that file is clean. No test was run
against the modified line and no other shared file was touched. I re-ran the whole
teeth audit in a copy created first, with `cd` inside every command. This is the
one thing I got wrong this pass; it is recorded here so the coordinator can
verify the restore rather than trust my word.
