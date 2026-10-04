# 06 Roles Force

All Force roles remove influence for coins. One is active per game. Each is blocked by itself. This self block replaces base Coup cross blocks. All may be challenged. Double life loss rule applies to all failed defenses.

## Crime Boss

Category is Force.
Action is choose a target. Target may pay 2 coins to the active player to end the action. Otherwise active player pays 5 coins to Treasury and target loses 1 influence.
Counteraction is none beyond the built in pay to stop. The 2 coin payment is part of the action, not a separate block claim, so it cannot be challenged as a counter. No influence needed to pay.
Edge cases are target with fewer than 2 coins cannot pay and must face the 5 coin kill. Active player with fewer than 5 coins after the refusal cannot complete the kill. Rules allow partial actions. Web version should check affordability before allowing the claim and show the pay or suffer choice to target.
Web notes need two step dialog. Step one is target choice. Step two is target decision pay 2 or refuse. Step three on refusal is kill resolution with block window closed because no block exists.

## General

Category is Force. Area attack.
Action is pay 5 coins to Treasury. All other players lose 1 influence, except those who successfully block with General.
Counteraction is block with General. Every target decides independently. Multiple simultaneous General claims occur. Each block claim may be challenged separately. Resolution is clockwise from active player. Attacker picks who to challenge among blockers, but UI should allow any player to issue challenges on any block.
Edge cases are mass challenge chaos with 5 blockers. Attacker becomes prime retaliation target. Treaty and Peacekeeper tokens still protect holders except the rules for General versus tokens need table agreement. Default is General respects protection tokens because they say cannot be targeted. See tokens file.
Web notes need multi target resolution UI. Show each target as blocked, unblocked, challenged. Apply influence loss one by one. Support multiple reveals in one turn.

## Guerrilla

Category is Force. Basic role. Starter role. Assassin equivalent.
Action is pay 4 coins to Treasury and choose a target. Target loses 1 influence unless blocked.
Counteraction is block with Guerrilla. Only target may block.
Challenge notes are classic double danger. Challenge the attack and lose means lose 1 for challenge plus 1 for execution. False block and get caught means lose 1 for challenge plus 1 for execution.
Web notes are single target attack with block window for target only plus global challenge window.

## Judge

Category is Force.
Action is give 3 coins to a target. Target loses 1 influence unless blocked. Coins go to target, not Treasury.
Counteraction is block with Judge. Only target may block. If blocked or if claim is successfully challenged, target keeps the 3 coins. Attacker still paid.
Conflicting source note is one Reddit thread says countered by Producer with target keeping 3. Deposit Genius table says blocked by Judge. Treat Judge blocks Judge as primary. List Producer interaction as unverified variant in open questions. Web version should implement Judge blocks Judge.
Edge cases are Judge is weak early because target gains Coup funding. Judge is strong late against 1 life players with low coins. Giving coins can backfire into immediate Coup.
Web notes need coin transfer to target before block resolution. Show kept coins on block.

## Mercenary

Category is Force. Delayed kill.
Action is pay 3 coins to Treasury and place a Disappear token on a chosen target.
Effect is target loses 1 influence after their next turn. Target still gets one full turn before the token resolves. Token is visible.
Counteraction is block with Mercenary at placement time. Only target may block.
Edge cases are what happens if target is eliminated before resolution. Token is discarded. What happens if target gains protection after placement. Table rule is token still resolves because placement already succeeded. Multiple Mercenary tokens on one target stack with separate timers. Disappear token count in box is 3.
Web notes need token state with countdown. Show token on player board. Trigger loss at end of target's next turn, with Missionary and Intellectual windows after. Allow block only at placement, not at resolution.

## Force Implementation Checklist

All need affordability check, target picker with protection filtering, challenge window, self block window for target or all targets for General, coin payment to Treasury except Judge to target and Crime Boss conditional, influence loss resolution with loser chooses card, double loss support.
