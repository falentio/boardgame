# Unit: independent-verification (ADVERSARIAL)

## GOAL
Independently verify the citadels game definition against its done predicate. You
did not write any of this code. Your job is to find what is wrong, not to confirm
it works. A green test suite you wrote yourself proves nothing here.

## THE DONE PREDICATE (from docs/design/citadels-full-game.md)
A `citadels` `GameDefinition` that plays a complete Citadels (2016) game plus the
expansion content, where:
1. Full games reach terminal (one winner) for 3, 4, 5, and 6 seats and 3+ casts.
2. Every one of the 27 characters is implemented with a test.
3. Every district in the catalog is implemented with a test per unique effect.
4. Scoring is exact: cost sum, 3 for five types, 4 first / 2 other completion,
   unique points, documented tie-breaks.
5. Hidden information never crosses `project`; two peers converge.
6. The module has no unverified file.

## READ FIRST
- docs/design/citadels-catalog.md (the authoritative rules)
- docs/design/citadels-full-game.md (the predicate)
- shared/core/lockstep/games/citadels/ (the module)
- shared/core/tests/lockstep/citadels/ (the tests)

## WHAT TO DO (adversarial)
1. **Coverage audit.** Enumerate the 27 character ids and the 30 unique district
   ids from the catalog. For each, confirm a real implementation exists (not a
   stub) and a named test exercises it. Report any id with no test, or a test that
   would pass against a no-op. Read the implementation and the test, not just names.
2. **Rule fidelity.** Pick at least 8 abilities across characters and districts and
   check the code against the catalog text line by line. Report every mismatch,
   including a subtle one (a wrong rounding, a missing "may not", a limit applied
   to the wrong scope).
3. **Scoring.** Independently recompute the score for a crafted city from the
   rules, then compare to `scoreGame`. Try to construct a city where the
   implementation is wrong (Haunted Quarter type, Ivory Tower, Wishing Well,
   Museum, beautified Artist districts).
4. **Termination and totality.** Confirm a full game terminates for 3-6 seats and
   at least 3 casts. Try to construct a state that stalls the stack machine or
   throws out of `step`. Report any `step` input that throws rather than coercing.
5. **Hidden information.** Attempt to leak hidden state through `project`: a deck
   card, another seat's hand, a pick. Report any leak with the exact seat and field.
6. **The tests themselves.** Find tests that assert nothing meaningful, or that
   would pass with the implementation deleted. Report each with its file and line.

## SCOPE (the files you own)
- shared/core/tests/lockstep/citadels/verification-report.test.ts (NEW) — write a
  failing test for every real defect you find, so the defect is executable.
- orchestrate/citadels/verification.md — your findings report.

Do NOT fix anything. Do NOT edit the module or any existing test. Your product is
findings plus executable counterexamples.

## VERIFY
Run `scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification-report.test.ts`
and report its output. If it fails, that is the point: those are the defects.
Then run the whole citadels suite and report the count.

## REPORT (in orchestrate/citadels/verification.md and your final message)
- For each done-predicate clause: PASS or FAIL, with the evidence you gathered.
- Every defect found, as a counterexample test that fails.
- Every character/district with no real test, if any.
- Your verdict: is this module complete and correct against the predicate? Be
  specific about what is verified and what remains unverified.

## STANDING ORDERS
<paste preferences.md verbatim>
