# Citadels (2016) game definition: run framing

## Definition of done (falsifiable)

A `citadels` `GameDefinition` on the lockstep primitive that plays a complete
Citadels (2016 edition) game, plus the Dark City / bonus expansion content the
2016 box ships, where:

1. A full game from genesis reaches terminal (one winner) by folding frames,
   driven by a test harness, for 3, 4, 5, and 6 seats, and for at least three
   distinct character casts.
2. Every one of the 27 characters has its ability implemented and a named test
   that exercises it, including the expansion ranks 1-9 (Witch, Tax Collector,
   Wizard, Emperor, Abbot, Alchemist, Navigator, Diplomat, Artist, Queen,
   Magistrate, Blackmailer, Spy, Seer, Patrician, Cardinal, Trader, Scholar,
   Marshal).
3. Every district card in the catalog has its cost, type, and (for unique
   districts) its effect implemented, with a test per unique effect.
4. Scoring is exact: cost sum, 3 for all five district types, 4 to the first
   completed city, 2 to each other completed city, plus unique-district points,
   with the documented tie-breaks.
5. Hidden information is redacted: other seats' hands and the district deck never
   cross `project`; two peers folding the same frames reach identical state.
6. `vp test` and `vp typecheck` are green; the module has no unverified file.

## Scope

Large. 27 characters across ranks 1-9, 84 district cards (54 basic, 30 unique),
a hidden character draft, a rank-ordered turn phase, a resource/build turn, and
an end-game scoring pass. The game owns its phase/window machine inside `step`;
the primitive is unchanged.

## Rigor level: high

- The phase machine is a one-way door. Design it as data first, before any
  character, exactly as `games/g54` did.
- Risk-first: the draft + rank-ordered turn phase is the riskiest unknown. Build
  and test it against a small cast before the other characters.
- One file per character. One file per unique-district effect. This is what makes
  the work parallelizable across a shared worktree: distinct writers, distinct
  files, no shared write target.
- Every unit ends in a green `vp test`.
- Verification is by replaying real games, not by reading character code.

## The load-bearing design decisions

**1. Everyone-passes windows.** The frame primitive seals a frame only when every
owed seat reports. So a "the Assassin names a character", "the Thief robs a
character", "a player may use a character ability" becomes a frame owed by all
active seats, each of whom acts or passes. Same model g54 accepted. Latency is
acceptable for a turn-based card game.

**2. Rank-ordered turn phase.** Unlike g54, a Citadels round calls characters in
ascending rank. The active seat is derived from the called rank, not from a
rotation. The window machine carries `rank` in the round cursor.

**3. Character abilities are a registry keyed by id.** `Record<CharacterId,
CharacterEffect>`, one effect file per character, mirroring g54's `ROLE_EFFECTS`.

**4. The draft is a linked chain of private picks.** Each pick is a window owed by
exactly the seat whose turn it is to choose. The chosen card leaves the passing
hand; the hand passes to the next seat. Hidden: `project` reveals only the
viewer's own pick and the public faceup discards.

**5. Districts: catalog is data, unique effects are a registry.** The 54 basic
districts are pure data. The 30 unique districts are data plus an effect, keyed
by card id in `districts/effects.ts`.

## Units (riskiest-unknown-first)

1. **Scaffold:** `games/citadels/` module dir, types, state, actions, codec,
   window machine, `GameDefinition` with `genesis/step/seatsOwed/project/
   isTerminal`, all 27 character stub files, and all 30 unique-district stub
   files. Verify: it compiles, `createSession` starts, genesis deals correctly.
2. **Setup and draft:** character deck build, district deck build, 4 cards + 2
   gold, crown holder, faceup/facedown discards by seat count, the passing draft,
   and the 2/3-player two-character rule. Verify: deck conservation, draft
   legality, hidden picks.
3. **Turn phase:** gather resources (2 gold or draw 2 keep 1), build one district,
   rank-ordered calling, skip called-but-absent ranks. Verify: a full round
   advances every rank once.
4. **Scoring and end game:** 8 districts (7 with Bell Tower), cost sum, colour
   bonus, first/other completion points, unique-district points, tie-breaks.
   Verify: exact scores on crafted cities.
5. **Characters (27 units):** one per character, each its own file plus its test.
6. **Districts (data + unique effects):** the 84-card catalog, plus one unit per
   unique effect.
7. **Integration:** full-game harness test, redaction test, codec round-trip,
   convergence across two peers.
8. **Verification:** independent verifier pass on the final head.

## Rules of record

Sources: the Citadels (2016 edition) rulebook as transcribed by UltraBoardGames
(`ultraboardgames.com/citadels/deluxe.php`, fetched 2026-07-18) and the
Wikipedia article on Citadels (fetched 2026-07-18).

- 27 characters, ranks 1-9, three characters per rank 1-8 and rank 9 with two
  (Artist, Queen) plus Tax Collector at 9. One character per rank is chosen for
  the game's cast.
- District deck: 54 basic (11 military, 11 religious, 12 noble, 20 trade) plus 14
  unique districts chosen from the 30 available.
- Each player starts with 4 district cards and 2 gold. The oldest player has the
  crown.
- A round: discard faceup N cards and one facedown, draft one character per
  player in crown order, then call ranks 1-9 ascending.
- A turn: gather (2 gold, or draw 2 keep 1), then optionally build one district.
- End: the round in which a city reaches 8 districts (7 with Bell Tower) finishes,
  then score.
- 2-player: 8 districts, each player drafts two characters. 3-player: 8 districts,
  each player drafts two characters, ranks 1-9.
- Rank 4 can never be among the faceup discards; if drawn, replace and reshuffle.
