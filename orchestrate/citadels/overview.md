# Citadels program overview

Spec: docs/design/citadels-full-game.md
Target module: shared/core/lockstep/games/citadels/
Tests: shared/core/tests/lockstep/citadels/
Reference implementation to mirror: shared/core/lockstep/games/g54/ (read it first)

## Done predicate

All units merged on feat/citadels-game-definitions, each with a ledger row of
`unit-test-verified` or better, and a full game reaching terminal for 3-6 seats.

## Tracks

- core: scaffold (types, state, actions, codec, window machine, genesis, project).
- rules: setup+draft, turn phase, scoring+end game.
- characters: 9 rank-group units covering all 27 characters.
- districts: catalog, unique-effect groups.
- verify: integration, redaction, convergence, independent verifier pass.
