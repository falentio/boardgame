# Unit: fix2-drain (V2-1 BLOCKING; smallest possible scope)

## GOAL
Fix V2-1 only, then V2-2 and V2-3 if you have room. V2-1 is one line and unblocks
the other 12 failing counterexamples.

## THE BLOCKING DEFECT (V2-1)
In shared/core/lockstep/games/citadels/windows.ts, the `drain` loop at line ~69 does:

```ts
const owed = owedFor(next, top.window);
if (top.window.kind === "turn" || owed.length > 0) return next;
```

`owedFor` filters the window's explicit `seats` list. A window built with
`winStep(purpose, [])` and `kind: "any"` (the Assassin/Witch/Magistrate
`choose-character`, the Thief/Blackmailer `choose-seat`, the Spy `choose-type`)
has empty seats, so `owedFor` returns `[]`, `drain` treats the window as unowed,
and pops it before any seat can answer. The very next function,
`windowOwed` (line ~79), already handles this correctly:

```ts
const windowOwed = (state, window) =>
  window.kind === "any" ? liveSeats(state) : owedFor(state, window);
```

`stepState` uses `windowOwed` (line ~105); `drain` must use it too. Change the
`drain` call from `owedFor` to `windowOwed`. That is the fix.

**Prove it**: after the change, a folded base-cast game (3 seats, the 8-character
base cast, the driver's `advance`/`autoAction`) must open at least one
`choose-character`/`choose-seat`/`choose-type` window and record a non-empty
`skipped`, `robbed`, `bewitched`, or `threats`. Before the change it records none.

## THEN, IF YOU HAVE ROOM
- **V2-2.** `blackmailer` distinguishes its first pass by `pending === null`, but
  `applyCall` arms `pending` before the effect runs, so it takes the second-pass
  branch immediately and never assigns threats. Use a `pending.note` marker like
  the other two-pass effects (see assassin.ts). This is in
  characters/blackmailer.ts.
- **V2-3.** The turn stack is `[RESOLVE, turn, END_TURN, CALL, ...rest]` and
  `resolveTurn` returns `[END_TURN, ...rest]` where `rest` still holds that
  `END_TURN`, so `applyEndTurn` runs twice and every end-of-turn district fires
  twice. Fix the shape so one `END_TURN` fires per turn. This is in helpers.ts
  (`resolveTurn`) and/or windows.ts.

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/windows.ts
- shared/core/lockstep/games/citadels/helpers.ts
- shared/core/lockstep/games/citadels/characters/blackmailer.ts
- shared/core/tests/lockstep/citadels/fix2-drain.test.ts (NEW, only if needed)

Do NOT edit characters/alchemist.ts, armory.ts, thieves-den.ts, trader.ts,
emperor.ts, diplomat.ts, museum.ts — siblings own those.

## ACCEPTANCE
The V2-1 counterexamples pass: "a folded game that names characters records at
least one kill, rob, or bewitch", and the Assassin/Witch/Magistrate/Thief/Spy
"window surfaces through the engine" tests. If you also do V2-2/V2-3, their tests
pass too. The whole citadels suite is green (the other failing V2 tests need a
sibling's fix; that is expected).

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/verification2.test.ts --own shared/core/lockstep/games/citadels/windows.ts --own shared/core/lockstep/games/citadels/helpers.ts --own shared/core/lockstep/games/citadels/characters/blackmailer.ts`
Then `vp test shared/core/tests/lockstep/citadels/` and report both. Report which
of the 15 V2 counterexamples pass after your change.

## COMMIT
`scripts/citadels-commit.sh "fix(citadels): drain must owe an any-window to every live seat (V2-1)" <your paths>`

## STANDING ORDERS
<paste preferences.md verbatim>
