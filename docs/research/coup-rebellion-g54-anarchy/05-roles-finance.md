# 05 Roles Finance

Anarchy adds two Finance roles. Both are advanced. Neither has a block.

## Financier

Category is Finance. Changes the general action set.
Setup effect is the Income general action card is swapped for the Bank general action card. This applies for the whole game while Financier is in play.
Action is take all coins from the Bank pile. No target. No counteraction. No block.
Edge cases are the Bank pile only grows through the Bank general action. Bank is take 1 coin from Treasury and add 1 coin to the Bank pile. Bank cannot be blocked or challenged. Financier empties the pile in one claim. The claim may be challenged like any role action. There is no counteraction, so a challenge is the only defense. The Bank pile is public. The bigger the pile the stronger the incentive to claim Financier, true or false.
Web notes need the Income button replaced by Bank while Financier is active. Show the Bank pile size as public state. Financier button shows the full pile as the gain. Challenge window only, no block window.

## Plantation Owner

Category is Finance. Mass claim payout.
Action is take 1 coin from Treasury. Then every other player may claim Plantation Owner. Resolve these claims clockwise. After all claims and challenges resolve, each surviving claimant gains 1 coin per surviving claimant.
Example is 3 surviving claimants. Each gains 3 coins, taken from Treasury.
Counteraction is none. Block is none.
Edge cases are the payout count equals the number of surviving claimants. A challenged claimant who fails loses 1 influence and does not count toward the payout. The active player always counts as a claimant because the action is their claim. If Treasury is short allow partial. This mirrors the base Capitalist mass claim but the payout scales with the number of claimants.
Web notes need two phase flow. Phase one is take 1. Phase two is a claim window for all other players. Each claim is a separate challengeable claim. After resolution, compute the survivor count and pay each survivor that many coins. Show the projected payout as claims come in.

## Finance Implementation Checklist

Financier needs the Income to Bank swap and a public Bank pile. Plantation Owner needs a mass claim window and a payout that scales with the surviving claimant count. Both need challenge windows. Neither needs a block window. Both need a net gain preview before commit.
