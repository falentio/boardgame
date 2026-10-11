# Unit: fix2-final (V2-4, V2-7, V2-8) — commit each fix immediately

## GOAL
Fix three source defects. The previous worker for this unit died to a server
restart with zero edits. Commit each fix the moment it is green, so a restart
loses at most one.

## THE DEFECTS
- **V2-4 (Thieves' Den gold share).** `tryBuild` in helpers.ts charges no gold when
  `payCards > 0`. With 2 gold and 2 spare cards on a cost-4 Den, the Den builds and
  the 2 gold stay in the stash. Fix: debit the gold remainder too.
- **V2-7 (Alchemist refund is dead).** `alchemist` reads `pending.gold` for the
  turn's build spend, but no build path writes it, and the effect runs at the top
  of the turn before the build. Fix: have `tryBuild` record the gold a build paid
  in the turn-local pending, and make the refund land at end of turn.
- **V2-8 (Armory never fires).** `armoryTriggers` declares `["onDestroy"]`, but
  `runDistrictHooks` is never called with `onDestroy`. Fix: fire `onDestroy` for
  the acting seat when its turn opens, so the Armory offers its window in a real game.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/helpers.ts
- shared/core/lockstep/games/citadels/characters/alchemist.ts
- shared/core/lockstep/games/citadels/districts/armory.ts
- shared/core/tests/lockstep/citadels/fix2-final.test.ts (NEW, only if needed)

Do NOT edit windows.ts, blackmailer.ts, trader.ts, emperor.ts, diplomat.ts,
museum.ts, or thieves-den.ts. If V2-4 needs a change in thieves-den.ts, report it.

## WORK ORDER (commit after each)
1. Read helpers.ts (`tryBuild`, `resolveTurn`, `applyEndTurn`, `runDistrictHooks`) and
   the three counterexamples in verification2.test.ts. Fix V2-4, run the one test,
   commit.
2. Fix V2-7, run the one test, commit.
3. Fix V2-8, run the one test, commit.
4. Run the whole citadels suite and report.

## ACCEPTANCE
These three counterexamples pass: "a mixed Thieves' Den payment spends its gold
share", "the Alchemist takes back the gold it spent building this turn", "a seat
that built the Armory is offered its destroy window on its turn". The whole suite
is green apart from two counterexamples I have flagged as flawed (the "folded game
that names characters" test never builds, so it never terminates; and the Trader
and Emperor tests call `advance` from a draft-phase state, so their effect never
runs). Do not try to make those three pass by editing the source; report them.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification2.test.ts --own shared/core/lockstep/games/citadels/helpers.ts --own shared/core/lockstep/games/citadels/characters/alchemist.ts --own shared/core/lockstep/games/citadels/districts/armory.ts`
Then `vp test shared/core/tests/lockstep/citadels/`.

## REPORT
status; files written; verify output including the whole suite; commit SHA per fix;
the exact change per defect; your judgment on the three flagged counterexamples.

## STANDING ORDERS
<paste preferences.md verbatim>
