# G54 full game: run framing

## Definition of done (falsifiable)

A `g54` `GameDefinition` that plays a complete 3-to-6 player Coup Rebellion G54 game on the lockstep primitive, where:

1. A full game from genesis reaches terminal (`isTerminal` true, one winner) by folding frames, driven by a test harness, for the starter set (Banker, Director, Guerrilla, Politician, Peacekeeper) and for at least three other role sets.
2. Every role action, block, and challenge in `docs/research/coup-rebellion-g54/04..07` is implemented and has a test that exercises it.
3. Two independent peers folding the same frames reach identical state (the primitive's convergence guarantee holds for the real game).
4. The rules the docs call out as load-bearing hold: forced Coup at 10+ coins, double life loss in one turn, self-block (Guerrilla blocks Guerrilla), block costs stay paid, treaty/Peacekeeper target filtering, hidden hands and Court deck.
5. `vp check` and `vp test` are green; every role and token has a named test.

## Scope

Large. 25 roles across 4 categories, 8 tokens, a multi-window turn engine (claim -> challenge -> counter -> counter-challenge -> apply -> reactive), partial actions, elimination, and a hidden deck. The game owns its own phase/window machine inside `step`; the primitive is unchanged.

## Rigor level: high

- The turn engine is a one-way door (every role is written against its phase/window vocabulary). Design it first, as a data structure, before any role.
- Risk-first: the phase/window machine is the riskiest unknown. Build and test it against the starter set before the other 20 roles.
- Every unit ends in a green `vp test`.
- Verification is by replaying real games, not by reading role code.

## The load-bearing design decision

The frame primitive seals a frame only when every owed seat reports. So a Coup "challenge window where any player may act" becomes a frame owed by all active seats, each of whom either challenges or passes. This is the "everyone passes" model. Two consequences, both accepted:

- **Latency.** Every window costs a round-trip to all seats. Acceptable for a turn-based card game.
- **First-come-first-served challenge ordering is not representable.** In a sealed total frame all challenges arrive together, so the game applies the deterministic seat-order tie-break (clockwise from the active seat). This matches the rulebook's tie-break rule and loses only the rare "two players raced" case.

The game models a turn as a **window stack**: a data-driven table of window kinds (`turn`, `any`, `oneOf`, `targets`) each with a resolution. This is candidate 2's phase-table design, implemented inside the game's `step`, on top of the frame primitive.

## Units (riskiest-unknown-first)

1. **Scaffold:** `games/g54/` module dir, empty `GameDefinition`, codec. Verify: it compiles and `createSession` starts.
2. **Setup:** role catalog (25), category draft (1/1/1/2), 15-card deck (3 copies), deal 2, coins 2, treasury. Verify: deck conservation, hand counts, determinism.
3. **Window machine:** the phase/window vocabulary and resolution. Verify: a synthetic claim -> challenge -> resolve cycle.
4. **Starter set:** Banker, Director, Guerrilla, Politician, Peacekeeper play a full game. Verify: full game to terminal.
5. **Force roles:** Crime Boss, General, Judge, Mercenary. Verify each.
6. **Finance roles:** Capitalist, Farmer, Speculator, Spy. Verify each.
7. **Communications roles:** Newscaster, Producer, Reporter, Writer. Verify each.
8. **Special Interest roles:** Communist, Customs Officer, Foreign Consular, Intellectual, Lawyer, Missionary, Priest, Protestor. Verify each.
9. **Tokens:** Treaty, Peacekeeping, Disappear, Tax across the roles that use them.
10. **Verification:** full games across four role sets, convergence across two peers, the load-bearing rules.

## Decision trail

`docs/design/g54-decision-log.tsv`, one row per unit and per load-bearing decision, evidence as test names.
