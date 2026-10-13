# Rubric: the Witch resume seam redesign (arena)

Score each candidate criterion by criterion.

1. CLOSES THE FAMILY WITH ONE MECHANISM. D17-1 (the Scholar/Architect resume
   double-gathers) and D17-2..5 (the Abbot/Emperor/Spy/Blackmailer resume ability
   lands on the real holder instead of the Witch) all pass, via ONE seam change.
   A per-character patch (editing scholar.ts, abbot.ts, emperor.ts, spy.ts,
   blackmailer.ts one by one) fails this criterion.
2. IDENTITY IS NOT CLOBBERABLE. The resume identity is owned by the immutable stack
   or a dedicated field no character effect writes, not by the shared `pending`
   slot. A future effect that writes pending.note cannot break the resume.
3. CODEC + PRIMITIVE. Any new Step kind or state field round-trips through
   `encodeStep`/`decodeStep`; the lockstep primitive (shared/core/lockstep/*.ts) is
   untouched. Demonstrated by a codec round-trip test.
4. NO REGRESSION. D13/D14/D15/D16 hold: every prior pass counterexample
   (verification-report through verification16, 16 files / 131 tests) green.
5. SMALL SURFACE. The public/effect-facing surface does not grow: the 27 character
   files need no edit and no effect must learn about the resume mechanism. Prefer
   the design that hides more complexity behind a smaller interface.
6. RATIONALE. Names the alternatives considered and rejected, and why.