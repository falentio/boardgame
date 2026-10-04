# 07 Roles Special Interest

Two are active per game. This category holds negotiation and reactive powers. Read each carefully because timing differs.

## Communist

Action is steal up to 3 coins from the wealthiest target and give them to the poorest player. Active player chooses nothing except to claim the role. Wealthiest means highest coin count among other players. Poorest means lowest coin count among all players including active player. If tie, active player chooses among tied players. If active player is poorest, they receive the coins.
Block is block with Communist. Target may block to prevent theft.
Edge cases are wealthiest with fewer than 3 coins gives what they have. Poorest selection needs UI when ties occur. Self transfer is allowed when actor is poorest.
Web notes need wealth ranking display, target confirmation, recipient picker on ties.

## Customs Officer

Action is take the 2 Tax tokens. Keep 1. Place the other on any active role card. From then on every other player must pay 1 coin to the Customs Officer holder each time they claim that taxed role. Tax applies per claim, including blocked or challenged claims where the claim was made. Tax is paid before resolution.
Block is none.
Edge cases are tax holder changes when another player claims Customs Officer and retaxes. Old tax is replaced. Tax on a role with no cost such as Director still costs 1 to claim. Spy double claims pay twice if both are taxed. Speculator plus tax is harsh.
Web notes need tax marker on role board, auto charge on claim, payment to holder. Show holder name on taxed role.

## Foreign Consular

Action is take the 2 Treaty tokens. Keep 1. Give the other to another player of choice. The two holders become allies and cannot target one another, even by Coup. Treaty lasts until they are the final two players. Then treaty expires and they may target each other.
Block is none.
Edge cases are treaty with Peacekeeper holder stacks protection. Treaty does not stop third parties. Treaty does not stop challenges. Only targeting is blocked. Target picker must exclude ally.
Web notes need ally picker, treaty badge on both boards, target filter, expiry check at 2 players left.

## Intellectual

Reactive role. No turn action.
Trigger is after holder loses an influence for any reason. Holder may claim Intellectual. Effect is take 5 coins from Treasury.
Challenge rules are special. Claim may be challenged like normal. Successful challenge against the Intellectual claim causes claimant to lose another influence. Failed challenge causes challenger to lose 1 influence. Net effect can be 2 lives lost in one sequence.
Edge cases are trigger after Coup loss still applies. Trigger after challenge loss still applies. Multiple losses in one turn may trigger multiple times if holder still has face down Intellectual. Web version needs reactive window after every influence loss when Intellectual is active.
Do not confuse with Missionary. Intellectual gives coins. Missionary gives cards.

## Lawyer

Reactive role. No turn action.
Trigger is when any player is eliminated. Any surviving player may claim Lawyer to take all coins of the eliminated player. If several claim, resolve clockwise from eliminated player. Each claim may be challenged.
Timing matters. Normal elimination returns coins to Treasury. Lawyer window must come before Treasury return. If Lawyer claim succeeds, coins go to Lawyer, not Treasury. If challenged and fails, claimant loses influence and coins go to Treasury or next Lawyer.
Web notes need elimination pause, Lawyer claim window for all survivors, challenge on each claim, then coin transfer.

## Missionary

Reactive role. No turn action.
Trigger is after holder loses an influence by any means except Coup. Holder may claim Missionary to take 1 card from Court. Process is remove the lost card from game face down, draw a replacement, keep playing with same life count. Successful challenge on the Missionary claim causes claimant to lose a second influence. Failed challenge causes challenger to lose 1 influence.
Firedrake account adds detail. Lost card is set aside face down, not revealed as Missionary proof beyond the claim. Exact table handling varies. Web version should keep lost card hidden until claim resolution, then handle reveal per challenge outcome.
Edge cases are with 6 players Missionary slows the game and is rated as awful by some groups. Intellectual is preferred at high counts. With Mercenary delayed kill, Missionary triggers at resolution time.
Web notes need reactive window after non Coup loss, hidden draw, special double loss logic.

## Peacekeeper

Action is take 1 coin from Treasury and take the Peacekeeping token. Holder cannot be targeted by any action except Coup and except challenges. Only one holder at a time. New claim steals the token from prior holder. Prior holder loses protection at once.
Block is none. Protection is passive while holding token.
Edge cases are holder is prime Coup target because Coup bypasses token. Holder cannot be selected for Force attacks, theft, treaty, Producer exchange, Priest tax, Communist steal, Protestor target. Challenge is still allowed. Box has 1 token.
Web notes need token holder badge, target filter, Coup exception, steal on new claim.

## Politician

Action is steal up to 2 coins from a chosen target. Basic role. Starter role. Captain equivalent.
Block is block with Politician. Only target may block.
Edge cases are target with fewer than 2 gives what they have. No token. Simple challenge and block windows.
Web notes are single target steal with block window.

## Priest

Action is all other players must give 1 coin to the active player, if able. Players with 0 give 0. No target selection. Affects table.
Block is block with Priest. Any affected player may block. If any block succeeds, does it stop all payments or only that player's payment. Primary reading is each player blocks only their own payment. Implement per player block. List as open question if table wants whole action block.
Web notes need multi payer resolution clockwise, per player block and challenge, running total.

## Protestor

Action is pay 2 coins to Treasury and select a target. Then any other player may pay 3 coins to force the target to lose 1 influence. This is crowdfunded kill. Funder may be anyone except target. Multiple funders are not needed. First funder resolves.
Block is block with Protestor. Block occurs after money is paid. Target claims Protestor to stop the kill. Paid coins stay paid.
Edge cases are no one funds means target safe and active player wasted 2. Target may also be funder blocker. Treaty and Peacekeeper still filter legal targets at selection time. Third party funder needs UI even when not their turn.
Web notes need three phase flow. Phase one is pay 2 and target. Phase two is funding window for all others. Phase three is block window for target. Then resolution.

## Special Interest Implementation Checklist

Communist needs wealth ranking. Customs Officer needs persistent tax marker. Foreign Consular needs ally state and expiry. Intellectual and Missionary need post loss reactive windows with special double loss. Lawyer needs post elimination window. Peacekeeper needs singleton token and target filter. Priest needs multi payer loop. Protestor needs funding window plus late block. Politician is simple steal.
