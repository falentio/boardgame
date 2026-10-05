# 04 Roles Force

Anarchy adds two Force roles. Both are advanced. Base G54 self block rule holds. Each Force role is blocked by itself.

## Anarchist

Category is Force. The only role in the game that can be used without holding the card.
Action is pay 3 coins to Treasury and give the Bomb token to a target. The claim is not challenged because there is no held card to prove.
Counteraction is pass or defuse. The target may claim Anarchist to either pass the bomb to a new target or defuse it. Each pass and defuse claim may be challenged. A player who claims Anarchist to pass or defuse must hold the card if challenged.
The bomb may never return to a prior holder, including the active player. The prior holder list grows with each pass.
Resolution is a life loss for the target only if the target neither passes nor defuses.
Edge cases are the pass target must be named before the challenge window opens, so a player cannot wait for challenges then choose. If the target has no legal pass target, the only legal counter is defuse. The 3 coin cost stays paid on a defuse. The bomb returns to the center after a defuse or after a life loss.
Web notes need a bomb chain state machine. Track current holder, prior holder list, and pending pass target. Exclude prior holders from the target picker. Keep the challenge window on each pass and defuse. Show the bomb on the current holder board.

## Paramilitary

Category is Force. Cost varies by target life count.
Action is declare a target and pay 3 coins if the target has 2 lives remaining, or 5 coins if the target has 1 life remaining. The target loses 1 influence unless blocked.
Counteraction is block with Paramilitary. Only the target may block.
Edge cases are the cost is read at claim time from the target's face down card count. A target at 2 lives costs 3. A target at 1 life costs 5. The cost is checked against the active player's coins before the claim is allowed. A blocked claim does not refund the coins. Paramilitary is the base Guerrilla with a sliding cost, so a full health target is cheaper to hit and a nearly dead target is more expensive.
Web notes need a dynamic cost preview based on the selected target. Show 3 or 5 as the target changes. Single target attack with a block window for the target only plus the global challenge window.

## Force Implementation Checklist

Both need an affordability check, target picker, challenge window, and self block window. Anarchist needs a multi step pass loop with a growing exclusion set and a bomb token state. Paramilitary needs a dynamic cost read from the target's life count. Both need influence loss resolution with the loser choosing the card.
