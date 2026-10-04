# 03 Turn Structure and Rules

## Turn Basics

One action per turn. No passing. Player may choose any action they can afford. Afford means pay the listed coin cost. Claim of a role action means stating possession of that role. Truth is optional.

If player starts turn with 10 or more coins the only legal action is Coup. Web version must enforce this and disable all other buttons.

## General Actions

Always available. No influence needed. Cannot be challenged. Cannot be blocked.

Income is take 1 coin from Treasury.
Coup is pay 7 coins to Treasury and choose a target. Target immediately loses 1 influence. Always succeeds.

## Role Actions

Available only if the role is among the 5 active roles. Claimant names the role and target if any. No reveal unless challenged. Unchallenged claim succeeds automatically.

If several players claim linked effects from one action, such as Capitalist payouts or Protestor funding, resolve in clockwise order starting with the active player.

## Counteractions

Counter is a block claim using an active role. Claimant may be lying. No reveal unless challenged. Unchallenged counter succeeds automatically.

Default rule is only the target may block to defend self. Some roles allow third party intervention. Protestor funding and Capitalist collection and General multi block are exceptions. Role files name the exception.

Successful block stops the loss or theft. Attacker costs already paid are not refunded. Example is Judge pays 3 and kill is blocked. The 3 stays paid and target keeps the 3 if role says so. See Judge.

Multiple counters resolve clockwise from the active player.

## Challenges

Any role action or counteraction may be challenged. Any player may challenge. General actions may never be challenged.

Sequence per claim:

1. Claim action and target. Pause for challenges. If challenged resolve now.
2. Extra linked claims. Pause for challenges on each.
3. Claim counters. Pause for challenges on each counter.
4. Apply counters that survived.
5. Apply actions that survived and were not blocked.

Challenge timing is strict. Once play moves past a claim, late challenges are invalid. Web version needs an explicit challenge window with timeout.

Resolution:
Challenged player shows a matching face down card or declines. Show means challenger loses 1 influence. Then shower shuffles the shown card into the Court and draws a random replacement. Decline or inability means claimant loses 1 influence and the whole action fails. Costs paid for a failed challenged action are returned.

Multiple challenges use first come first served. Tie break is clockwise from active player.

Challenge winner's replacement draw keeps identity hidden from all other players.

## Losing Influence and Elimination

Face down cards are lives. On each life loss the loser chooses which of their own cards to turn face up. Revealed cards stay face up and give no power. Zero face down cards means elimination at once. Eliminated player returns all coins to Treasury. Lawyer window may interrupt coin return. See Lawyer.

Double life loss in one turn is possible. Challenge a Guerrilla attack and lose, then suffer the Guerrilla execution. That is 2 lives. False block with Guerrilla and get caught, then suffer execution. That is also 2 lives. Web version must allow two reveals in one attack sequence.

## Trust Rules

Negotiation is allowed. Promises are never binding. Players may not show hidden cards to anyone. Coins may not be given or lent except where a role forces transfer. There is no second place. Game ends when one player remains.
