# Citadels test layout

The lockstep citadels suite at `shared/core/tests/lockstep/citadels/`, regrouped on
2026-10-14 by subject. Every move is a `git mv` plus a relative-import rewrite; no
test body, title, or assertion changed. Before: 94 files / 760 tests green (vitest).
After: 93 files / 760 tests, the `theatre`/`theater` spelling duplicate collapsed into
one district file.

The 722 titles the pin compares are what a source-level grep sees (712 lines with
`test(` plus 10 with `describe(`). It counts no `test.each` line, so the 48 rows the
two `test.each` calls expand in `engine/engine-coverage.test.ts` are invisible to it:
that file's 23 grepped lines stand for 71 runtime cases. The vitest JSON capture covers
all 760 rows, and the titles match before and after, per file and globally.

## What gates the suite

`vitest run shared/core/tests/lockstep/citadels` runs the 760 tests; vitest transpiles
each test without type-checking it. `tsc -p tsconfig.citadels.json` includes only
`shared/core/lockstep/games/citadels/**/*.ts`, so it never reads a test file.
`shared/tsconfig.json`, the config the repo's `typecheck` script runs over the test tree, is
red at baseline. The generated `.nuxt` configs list `shared/**` too, tests included, so it is
not the only config that includes them, and no script type-checks those:
`typecheck:server` reads `.nuxt/tsconfig.server.json`, which takes only
`../shared/**/*.d.ts` from `shared/`, and `typecheck:client` reads `tsconfig.client.json`, which
takes none of it.

## Groups

| Directory | Holds |
| --- | --- |
| `characters/` | One file per character: its spec, ability, resolver, and seams. |
| `districts/` | One file per district: its cost, scoring, triggers, and hooks. |
| `engine/` | Engine mechanisms shared by all cards: genesis scaffold, module seams, codec and redaction, hook/trigger/window seams, cross-card coverage guards, and full-game integration. |
| `rules/` | Counterexamples and clause regressions, grouped by the rule family they pin. |
| `rules/turn-order/` | The plain/threatened turn ordering: refusal, markers, stack reshaper, threat-before-ability, build order, purse timing. |
| `rules/witch-resume/` | The Witch's resumed turn: no re-gather, resume identity, turn shape, ability order, build clauses, resume-vs-plain equivalence. |
| `rules/income-scoring/` | Declared-type income, Warlord military income, and end-game scoring clauses. |
| `rules/cards/` | Single-card mechanics: Thieves' Den payment split, naming-window fold, Museum interactions. |
| `rules/seats/` | Seat-count and second-character behaviour. |
| `rules/cross-cutting/` | The six early broad verification passes, each spanning several families: one file per pass, named for its dominant subject. |
| `catalog.test.ts` | The whole-card catalog data integrity check. |
| `driver.ts` | The shared driver: seats, casts, genesis, turn folding, raw-state helpers. |

## Rename map

Old name -> new name, relative to `shared/core/tests/lockstep/citadels/`.

| Old | New |
| --- | --- |
| `scaffold.test.ts` | `engine/scaffold.test.ts` |
| `seams.test.ts` | `engine/cross-turn-fields.test.ts` |
| `integration.test.ts` | `engine/integration.test.ts` |
| `codec-redaction.test.ts` | `engine/codec-redaction.test.ts` |
| `engine-coverage.test.ts` | `engine/engine-coverage.test.ts` |
| `hooks.test.ts` | `engine/cross-turn-hooks.test.ts` |
| `district-triggers.test.ts` | `engine/district-triggers.test.ts` |
| `district-seams.test.ts` | `engine/district-seams.test.ts` |
| `district-windows.test.ts` | `engine/district-windows.test.ts` |
| `verification-report.test.ts` | `rules/cross-cutting/broad-sweep.test.ts` |
| `verification2.test.ts` | `rules/cross-cutting/naming-windows.test.ts` |
| `verification3.test.ts` | `rules/cross-cutting/declared-types.test.ts` |
| `verification4.test.ts` | `rules/cross-cutting/threat-and-gather.test.ts` |
| `verification5.test.ts` | `rules/cross-cutting/witch-and-threat.test.ts` |
| `verification6.test.ts` | `rules/cross-cutting/turn-model.test.ts` |
| `verification10.test.ts` | `rules/turn-order/threat-refusal.test.ts` |
| `verification11.test.ts` | `rules/turn-order/threat-markers.test.ts` |
| `verification12.test.ts` | `rules/turn-order/threat-stack-reshapers.test.ts` |
| `verification13.test.ts` | `rules/turn-order/threat-before-abilities.test.ts` |
| `verification14.test.ts` | `rules/turn-order/threatened-build-order.test.ts` |
| `verification15.test.ts` | `rules/turn-order/purse-timing.test.ts` |
| `verification16.test.ts` | `rules/witch-resume/no-regather.test.ts` |
| `verification17.test.ts` | `rules/witch-resume/identity.test.ts` |
| `verification18.test.ts` | `rules/witch-resume/turn-shape.test.ts` |
| `verification19.test.ts` | `rules/witch-resume/ability-order.test.ts` |
| `verification20.test.ts` | `rules/witch-resume/build-clauses.test.ts` |
| `verification20sweep.test.ts` | `rules/witch-resume/plain-equivalence.test.ts` |
| `fix-income.test.ts` | `rules/income-scoring/declared-type-income.test.ts` |
| `fix-warlord.test.ts` | `rules/income-scoring/warlord-income.test.ts` |
| `fix-scoring.test.ts` | `rules/income-scoring/scoring-clauses.test.ts` |
| `fix-den.test.ts` | `rules/cards/thieves-den-payment.test.ts` |
| `fix2-drain.test.ts` | `rules/cards/naming-window-fold.test.ts` |
| `verification9.test.ts` | `rules/cards/museum-interactions.test.ts` |
| `verification7.test.ts` | `rules/seats/second-character.test.ts` |
| `verification8.test.ts` | `rules/seats/seats-and-theater.test.ts` |
| `districts/theatre.test.ts` | merged into `districts/theater.test.ts` |

`catalog.test.ts` and `driver.ts` keep their names and their place at the root.

`regroup/rename-map.json` carries the same mapping for a script to read: its `moves`
list is pass 1, and its `second_pass` object is pass 2, the six cross-cutting moves
and the theatre merge. Three destinations were renamed a second time by the 2026-10-14
fix round so the name states the file's subject: `engine/cross-turn-hooks.test.ts`
(was `engine/district-hooks.test.ts`), `engine/cross-turn-fields.test.ts`
(was `engine/seams.test.ts`), `rules/cards/naming-window-fold.test.ts`
(was `rules/cards/drain-window.test.ts`).

## What was deliberately not rewritten

The store records that cite the old names -- `units.tsv`, `ledger.tsv`, `decisions.tsv`, the
briefs, and `HANDOFF.md` -- keep them. They describe what was asked and found at the time,
and this directory's convention is that history stays as written. This file and the decision
row for the regroup are the translation layer; `overview.md`'s open items are the only
live text repointed.

## Left as designed

The 2026-10-14 verification swarm over this regrouped suite raised five rows that the
coordinator left alone. A later pass should not re-open them as defects.

- Character-topic tests under `rules/`: the six `rules/witch-resume/` files and the
  per-character titles in `rules/income-scoring/declared-type-income.test.ts` are the
  documented grouping (F05). Moving them rewrites pass-record grouping for no coverage
  change.
- District docblocks: 10 of the 30 district files carry no header docblock while the other
  20 do (F08). Cosmetic; the file name and its tests state the contract.
- Duplicated coverage across pass files: the six `rules/cross-cutting/` files are one file
  per pass by design (F25, F39, F40), so a subject pinned in its own card file and again in
  the pass record that found it stays pinned twice. No deletion, and neither copy is
  wrong.

## Finding a test after a rename

`git log --follow --name-status` on the new path carries the old name; this table is
the same mapping in one place. The verification reports in this directory
(`verification*.md`) keep their own names; they are the pass records. Six moved files
name the report their counterexamples came from in their header, the six under
`rules/cross-cutting/` (`grep -rl orchestrate/citadels/verification shared/core/tests/lockstep/citadels`
prints exactly those six). The other moved files cite no report.

## Reproducing the move

The move is two scripts, kept beside this file so a reviewer can rerun or audit them
against the tree: `regroup.py` (35 renames and relative-import rewrites) and
`regroup2.py` (the cross-cutting grouping, the theatre/theater merge, and the prose
repointing). Each is idempotent: a move whose target already exists is skipped.

To rerun them, start a worktree at `32140e6` (the commit before the move), copy
`orchestrate/citadels/regroup/` from the head into it, and run both scripts. Then
the replayed tree equals head's `shared/` (`git diff <head-sha> -- shared/` is empty),
`git diff 756876f -- shared/` shows exactly the three rename pairs the fix round added
to the map, and the citadels suite runs 93 files / 760 tests green.
