# 04 Roles Finance

All Finance roles provide money. One is active per game. None has a block except where noted as none. All may be challenged. General rule is unchallenged claim succeeds.

## Banker

Category is Finance. Basic role. Starter role.
Action is take 3 coins from Treasury. No target. No counteraction. No block. No token.
Web notes are simple income button. No target picker. Challenge window only.

## Capitalist

Category is Finance.
Action is take 4 coins from Treasury. Then each other player may claim to hold Capitalist and take 1 coin from the active player. Resolve these secondary claims clockwise. Each secondary claim may itself be challenged. After resolution the active player keeps the remainder.
Counteraction is none. Block is none.
Edge cases are active player may end with net 3 or fewer if many rivals claim. Insufficient coins means partial payment. If active player's claim is successfully challenged the whole action fails and costs are returned. Secondary claims that fail on challenge cost the secondary claimant 1 influence but do not refund the active player beyond the failed transfer.
Web notes need two phase flow. Phase one is take 4. Phase two is collection window for all other players. Each collection is a separate challengeable claim.

## Farmer

Category is Finance.
Action is take 3 coins from Treasury. Keep 2. Give 1 to another player of active player's choice. Target selection is required even though the effect is positive.
Counteraction is none. Block is none.
Edge cases are choice of recipient matters for table politics. If Treasury is short allow partial. No block window.
Web notes need recipient picker. Show as gain 2 plus gift 1.

## Speculator

Category is Finance. High risk high reward.
Action is double current coins using Treasury, up to 5 coins taken. Holding N coins allows taking N coins, capped at 5 taken. Holding 0 takes 0. Holding 6 takes 5.
Counteraction is none. Block is none.
Challenge penalty is special. If Speculator claim is successfully challenged, challenger receives all of the claimant's initial coins. Claimant also loses 1 influence for the failed challenge. Earned coins if any are returned to Treasury. Net effect can leave claimant at 0 coins and minus 1 influence. This matches Space Biff account where accuser swipes invested cash and earned cash returns to bank.
Web notes must show current coins, max take, and risk text. Disable when holding 0 unless bluffing for no gain. Challenge resolution needs coin transfer to challenger, not just influence loss.

## Spy

Category is Finance in Deposit Genius list. Function is tempo, not pure income.
Action is take 1 coin from Treasury, then immediately take a second action of player's choice. Second action may be a general action or a role action other than Spy, since the Spy action can only be performed once per turn. It goes through normal challenge and block windows. If player holds 10 or more coins after the first coin, the second action must be Coup.
Counteraction is none. Block is none.
Edge cases are second action may target anyone including same target. Costs apply normally. Spy plus Customs Officer tax interaction is harsh because the Spy claim pays the Tax and the second action claim pays it again if its role is the taxed one. Spy does not grant immunity to forced Coup rule. Web notes need chained action flow. Show first coin, then reopen action menu with Coup forced when applicable. Both steps need separate challenge windows.

## Finance Implementation Checklist

Income preview must show net gain before commit for Capitalist and Speculator. Target picker only for Farmer. No token handling. No block buttons. All five need challenge windows. Speculator needs custom fail penalty. Capitalist needs secondary claim window. Spy needs chained turn state.
