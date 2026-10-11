# Unit: independent-verification-2 (SECOND adversarial pass, new head)

## GOAL
Re-verify the citadels game definition at the current head. A first verifier
returned FAIL with 14 counterexamples; those fixes have landed. Your job is to
find what is STILL wrong, including anything the fixes introduced or papered over.

## CONTEXT
- The first verifier's findings: orchestrate/citadels/verification.md
- Its executable counterexamples: shared/core/tests/lockstep/citadels/verification-report.test.ts (now 14/14 passing)
- The fixes landed in commits 91a57df, 7b1a1c9, fdf9d20, 04db150, e887390.
- You did not write any of this. Do not trust the green suite.

## READ FIRST
- orchestrate/citadels/verification.md (the first pass, so you do not repeat it)
- docs/design/citadels-catalog.md and docs/design/citadels-full-game.md
- The whole module and test suite under shared/core/lockstep/games/citadels/ and shared/core/tests/lockstep/citadels/

## WHAT TO DO
1. **Re-run the first pass's counterexamples.** Confirm all 14 pass now, and confirm
   each fix actually addresses its defect rather than the test.
2. **Attack the D1 fix specifically.** It is the load-bearing change. Verify that a
   real folded game now runs every character in a cast, that the Witch's takeover
   and the Thief's rob still fire, that a character's opened window resolves before
   the gather, and that no character's turn double-runs or is skipped. Try to
   construct a cast and policy that stalls or throws.
3. **New defects.** Look for anything the fixes introduced: a character that now
   runs twice, an income counted twice, a window order that breaks a clause, a
   scoring double-count, a conservation break.
4. **The tests the first pass called tautological.** scaffold.test.ts,
   district-triggers.test.ts, district-windows.test.ts were flagged as asserting
   nothing real. Check whether that is still true, and whether it matters now that
   D1 is fixed.
5. **Coverage.** For each of the 27 characters and 30 districts, is there now a test
   that would FAIL if the engine stopped invoking it? Name any that still cannot fail.

## SCOPE (the files you own)
- shared/core/tests/lockstep/citadels/verification2.test.ts (NEW) — a failing test per real defect
- orchestrate/citadels/verification-2.md — your report

Do NOT fix anything. Do NOT edit the module or any existing test.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification2.test.ts`
Then the whole citadels suite. Report both. If verification2.test.ts fails, that is
the point: those are the remaining defects.

## REPORT (in orchestrate/citadels/verification-2.md and your final message)
- Clause-by-clause PASS/FAIL with evidence.
- Every remaining or newly-introduced defect, as a failing test.
- Your verdict on whether the module now meets the done predicate, and what a human
  should still scrutinize.

## STANDING ORDERS
<paste preferences.md verbatim>
