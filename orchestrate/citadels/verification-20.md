# Citadels game definition: twentieth independent verification

Verifier: review sub-agent (adversarial, twentieth pass). I did not write this
module. Source head under review: `feat/citadels-game-definitions`, worktree
`/home/kevin/.t3/worktrees/boardgame/t3-a32da114`, head **446e106**. The D19 fix
(`8c62749`) and every citadels source file are byte-identical at 446e106 — the two
later commits (`d9fc49a`, `446e106`) touch only `orchestrate/`. The citadels suite is
green at 92 files / 749 tests before my file lands; it is 93 files / 757 tests with it
(2 red).

Product: this report plus
`shared/core/tests/lockstep/citadels/verification20.test.ts` — 2 counterexamples,
failing against this head, plus 7 positive probes.

## Verdict

**FAIL.** The D19 fix (`8c62749`) is correct and complete for what it claims: a resumed
turn keeps its ability windows ABOVE the resume turn window, so the turn reads
abilities -> build (the plain order with no gather). I confirm it for every window-opening
character (P1), pinned the guard structurally (P4), and proved the guard has teeth
(T2/T3/T3w below). The D15 plain-turn order is intact (T2 reddens P4 and P1 when the
relocation is neutered; the plain-turn branch is untouched by the `resumed` early return).

But the resume-completeness audit turns up a **seventh family**, in the same
turn-ordering/resume seam: **the Cardinal's Witch resume cannot use its shortfall
clause.** `resolveTurn`'s shortfall branch carries a `!resumedWitch` guard
(`helpers.ts:891`), so on the resume a build the Witch-as-Cardinal cannot afford is
silently dropped — the plain turn covers the shortfall from a donor, retries the build,
and ends with the district built. The resume never opens the `cardinal-gold` offer.

- **D20-1 (real, present since the D6-2 turn model, still open).** The Cardinal's resume
  drops the build the plain turn takes. Measured on a 2-gold Witch purse with a Palace
  (cost 5) in hand and a donor holding gold: **resume builds 0 (hand still 1, gold 4)**;
  **plain builds 1 (Palace, gold 0, donor -1)**. The resume's window trace after
  `witch-resume` is `cardinal-gold, turn` — the `cardinal-gold` there is only the
  income-pass offer (amount 0), never the shortfall offer the build needs.

## The seam: a seventh family, and the under-specified rule

The brief asks for this explicitly. Every defect since D13 has been the ordering or the
reachability of a character ability relative to the gather and the build. D19 closed the
order for the resume (abilities -> build). D20 is the adjacent case: **a rule clause the
plain turn reaches only through a build-path branch is suppressed on the resume.**

The under-specified rule: **the resume plays the bewitched character's turn with the
Witch's hand, gold, and city, so EVERY build-path clause the plain turn reaches must be
reachable on the resume too.** `applyBuild` reaches the Cardinal shortfall clause behind
`!succeeded && !resumedWitch && playedCharacter === "cardinal"`. The `!resumedWitch`
conjunct is wrong: the Cardinal shortfall is an ability of the bewitched character
(rules.json witch: "you use that character's abilities"), and the resume's build is the
same build the plain turn makes. The guard was added in `64420ca` (fix D6-2) as a
conservative "the resume never reaches the shortfall" assumption; nothing about the
resume's mechanics requires it.

**The fix is one line (shared — report and stop):** drop `!resumedWitch` from the
guard at `helpers.ts:891`, i.e.
`if (!succeeded && playedCharacter === "cardinal" && builtId !== undefined)`.
I proved this in the `/tmp` archive copy: removing the conjunct makes D20-1/D20-1b
**GREEN** and leaves **all 749 existing tests green** (no other test reddens), which
confirms the guard is a pure defect and not load-bearing elsewhere. It also confirms the
defect is **untested**: disabling the whole shortfall branch reddens 4 existing tests
(`engine-coverage` "the engine reaches cardinal", `verification11` P2, `verification5`
D5-6, `verification6` P6-3) but those all exercise the **plain** Cardinal; the
**resume** shortfall had no guard until this pass.

This is the seventh family in the turn-ordering/resume seam (D13 11, D14 1, D15 3, D16 1,
D17 5, D18 2, D19 2, now D20 1). The counts have fallen every round and this is the first
non-ordering case — it is a reachability case, adjacent to the same seam.

## The resume completeness audit (the second half of the brief)

I enumerated the resume's lifecycle and checked each transition against the rule
(rules.json witch: the resume "use[s] that character's abilities and build limit, with
YOUR hand, YOUR gold, and YOUR city"):

| Transition | Rule | Verdict | Evidence |
|---|---|---|---|
| Open | `witchResolve` sets `state.resume` and arms the turn | PASS | P3 (record set, codec round-trip) |
| Turn window | resolved as the BUILD (no gather); ability windows above it | PASS | P1, P4; the D19 fix holds |
| Ability | bewitched effect runs with the Witch's seat (`seatHolding`/`buildLimit` read `state.resume`) | PASS | P2, P5, P5b (teeth T4) |
| Build | bewitched character's build limit | PASS | P2 (Scholar/Architect/Trader/Seer limits) |
| Build | Alchemist settle refund after the build | PASS | P2b |
| Build | Scholar/Architect re-seated windows | PASS | P2 |
| Build | Trader's non-counting builds | PASS | P2 (trader builds 3, limit ignored) |
| Build | **Cardinal shortfall** | **FAIL** | **D20-1/D20-1b** |
| Close | `applyEndTurn` clears `state.resume` | PASS | P3 (teeth T6) |
| Close | the Museum offer | PASS | probe: Museum offer opens once, one card under |
| Close | onEndTurn district hooks fire once | PASS | probe: Smithy/Laboratory fire once |
| Codec | a mid-resume snapshot round-trips | PASS | P3 (teeth T7) |
| Project | no hidden info leaks | PASS | probe: `project` carries no `resume` key |

**Fold for every one of the 27 characters.** I folded the resume for every bewitchable
character (24; the three rank-1 characters — Assassin, Witch, Magistrate — can never be
bewitched, one per cast) and compared the window order to the plain turn's:

- **Window order (abilities -> build).** All 16 window-opening characters open their
  ability window before any build turn window (P1): Thief, Spy, Blackmailer, Magician,
  Wizard, Seer, Emperor, Abbot, Cardinal, Trader, Scholar, Warlord, Diplomat, Marshal,
  Artist, Tax Collector. The D19 fix holds for every one.
- **End state (ability + limit).** Magician, Scholar, Architect, Trader, Seer, Alchemist
  reach their plain end state (P2, P2b); Navigator/Emperor differ only by the held +2
  gather (correct). **Cardinal diverges (D20-1).**
- **Two-character seats (2-3 players).** P5b: ANN holding both the Witch and the Merchant
  gathers the held +2, the takeover +2, and the Merchant's +1, then builds on her own
  seat — the resume keys on the acting seat, not the rank cursor (teeth: neutering the
  takeover gather reddens P5b). P5 confirms the resume runs the bewitched income on the
  Witch's purse.

**SEAM VERDICT: SEAM OPEN.** The resume is now completely specified for the *ordering*
half (the D19 fix closed abilities -> build for every character) and for *identity*
(D17) and *arming* (D18). But it is **not** complete: the under-specified rule is that
**every build-path clause the plain turn reaches must be reachable on the resume**, and
the Cardinal's shortfall clause is not. One shared-line fix closes it (drop the
`!resumedWitch` conjunct at `helpers.ts:891`).

## The teeth audit

Method: `git archive HEAD | tar -x -C /tmp/citadels-v20` (no git command ran in the
shared worktree), patch one source file in the copy with a Python replace that
**asserts the pattern is present** (a no-op patch cannot masquerade as a pass; the
patcher raises `AssertionError` on an absent pattern), run the guard, record RED/GREEN,
restore from the shared worktree by copy. The archive sources were diffed back to HEAD
after every probe.

| # | Guard | Neuter | Result |
|---|-------|--------|--------|
| T1 | D20-1/D20-1b (the fix direction) | drop `!resumedWitch` from the Cardinal shortfall guard | **GREEN** (8/8) — the guard IS the mechanism; all 749 existing tests stay green (untested defect) |
| T1n | D20-1 (the defect direction) | shortfall never opens, plain or resume | **RED** (D20-1) — the guard is load-bearing for the plain turn |
| T2 | P1/P4 (the D19 fix) | `relocateEffectBelowThreat` `if (resumed) return` -> `false &&` | **RED** (P1, P4, D20-1, D20-1b) |
| T3 | P1 (windows.ts wiring) | `state.resume != null` -> `false` | **RED** (P1, D20-1, D20-1b) |
| T3w | P1 (seat keying) | `state.resume != null` -> `... && state.resume.seat !== pending.actor` | **RED** (P1) — the flag keys on the acting seat |
| T4 | identity | `seatHolding` resume branch -> null | **RED** (7 of 9) |
| T5 | build limit | `buildLimit` resume branch -> null | **RED** (D20-1, D20-1b) |
| T6 | resume clear | `applyEndTurn` keeps `resume` | **RED** (P3, D20-1, D20-1b) |
| T7 | codec | `decodeResume` -> null | **RED** (P3, D20-1, D20-1b) |
| T8 | relocate witch-exemption | `if (character === "witch") return` -> `false &&` | **RED** (P2, P5b, D20-1b) |
| T9 | P5b (takeover gather) | drop the takeover `addGold(..., GATHER)` | **RED** (P5b) |

**Every guard I cite reddens under its neuter; no guard stayed GREEN** — except T1, which
is the *fix* direction (removing the defect makes the counterexample pass), the expected
result that proves the mechanism. **No guard-stays-GREEN finding this pass.**

## New defects from the D19 fix (the brief's question 3)

The D19 fix introduces no double gather of its own, no lost payload, no conservation
break, no window that re-offers forever, no turn that runs twice, and no district hook
that fires twice. I checked directly: card conservation holds across the resume for 13
window-opening characters; the Smithy and Laboratory `onEndTurn` hooks fire exactly
once; the Museum offer opens exactly once; `project` carries no `resume` field. The
`resumed` flag keys on the ACTING seat (T3w reddens P1 when keyed wrongly), so a
two-character seat is handled. **D20-1 is the only defect, and it is in the resume seam.**

## Coverage

Every one of the 27 characters and 30 districts still has at least one test that fails
when the engine stops invoking it (`engine-coverage.test.ts` plus the per-character
files). The standing gaps from passes 10-19 remain:

- **No data-driven test compares the 27 character summary strings to rules.json.**
  verification5 pins three by hand; the other 24 are unguarded.
- **No pass has re-derived the six preset casts, scoring under two claims,
  terminal/winner resolution under every stack shape, or 2-7 seat convergence.**
- **The Cardinal's resume shortfall was unguarded** until this pass; D20-1 and D20-1b now
  cover it.

## Done-predicate clause-by-clause

| # | Clause | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Full game reaches terminal for 3-6 seats | **PASS** | Unchanged; prior passes hold. |
| 2 | Every character implemented with a behavioral test | **FAIL** | D20-1: the Cardinal's resume drops the build its shortfall clause exists for. |
| 3 | Every district implemented with a test per unique effect | **PASS** | No district defect this pass. |
| 4 | Exact scoring | **PASS** | Unchanged; prior scorers hold. |
| 5 | Hidden information never crosses project; two peers converge | **PASS** | The resume record round-trips the codec (P3) and `project` carries no `resume` key. |
| 6 | The resume arms the bewitched character's own turn | **PASS** | D18 holds; the D19 fix confirms abilities -> build. |
| 7 | The resume *runs* the bewitched character's own turn (abilities AND build clauses) | **FAIL** | D20-1: the Cardinal shortfall clause is suppressed on the resume. |

## REPORT

- **Status:** FAIL. 2 counterexamples (D20-1, D20-1b) red at head 446e106, plus 7
  positive probes green. **(a) The defect is IN the resume seam** (a build-path clause
  the plain turn reaches is unreachable on the resume), not elsewhere. **(b) SEAM OPEN**:
  the resume ordering/identity/arming are now complete, but the resume is not
  clause-complete — the Cardinal's shortfall is unreachable. One shared-line fix closes
  it (`helpers.ts:891`, drop `!resumedWitch`).
- **Files written:** `shared/core/tests/lockstep/citadels/verification20.test.ts` (NEW),
  `orchestrate/citadels/verification-20.md` (this report). No source file edited.
- **Exact verify command:**
  `scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification20.test.ts --own shared/core/tests/lockstep/citadels/verification20.test.ts`
- **Raw result:** `Tests 2 failed | 7 passed (9)` then `VERIFY FAILED: vitest`.
  `npx tsc -p tsconfig.citadels.json` is clean (rc 0). Full citadels suite with my file:
  93 files, `Tests 2 failed | 755 passed (757)` — the only reds are D20-1/D20-1b.
- **Commit SHA:** 884f33f (the test file); this report is committed as the branch tip
  `verify(citadels): verify-20 report`.
- **Deviation / shared-file change needed:** none written. The fix needs a shared change
  (`helpers.ts` `resolveTurn`'s `!resumedWitch` conjunct on the Cardinal shortfall
  branch at line 891), so per standing order 4 I report it and stop. The fix is one line:
  `if (!succeeded && playedCharacter === "cardinal" && builtId !== undefined)`.
- **Seam:** the defect is IN the resume seam (a build-path clause reachable on the plain
  turn is suppressed on the resume). D20-1 is the D6-2 turn model's own consequence: the
  shortfall guard assumed "the resume never reaches the shortfall", which the D17-owned
  resume makes false.
