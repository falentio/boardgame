# 08 Tokens and Special Cases

## Token Inventory

Bomb times 1. Total 1. The bomb enters play only when Anarchist is active. Anarchy adds no other token. Base G54 tokens are separate.

## Bomb Anarchist

One token. The active player takes it, then passes it down a chain. Each holder passes or defuses. Prior holders are excluded from all later passes. The chain ends on a defuse or an influence loss. The bomb returns to the center when the chain ends.

Web state is current holder ID, prior holder list, and pending pass target. The target picker excludes every prior holder including the active player. The challenge window stays open on each pass and defuse.

## Bank Pile Financier

The Bank general action card replaces Income while Financier is in play. Bank adds 1 coin to a public pile. Financier sweeps the pile. The pile has no cap. Web state is a single public integer. The Bank card must be shown in the general action area. The Income action must be hidden while Financier is active.

## Special Timing Cases

Social Media swap has no challenge or block window because it is a general action.
Bank action has no challenge or block window because it is a general action.
Bomb pass and defuse are counteractions, so each opens a challenge window.
Bomb pass target must be named before the challenge window opens.
Plantation Owner mass payout resolves after all claims and challenges.
Socialist collection and redistribution run inside the active player's turn and move hidden cards.
Arms Dealer reveal is public and reshuffles back, so deck size stays constant.

## Partial Actions

Allowed when coins or cards are short. Take what is available. Web version must never block a legal claim only because Treasury or Court is short. Plantation Owner payout and Arms Dealer payout allow partial. Bank pile is never short because it only grows.

## Double Loss

The base double loss rule still applies. The Bomb can also cause a life loss outside a normal attack. A failed challenge on a pass or defuse claim can combine with a later bomb loss in the same chain. UI must support selecting two cards in one sequence.

## Hidden Information Rules

Never reveal hidden hands. Never allow card peeking. Socialist collection and redistribution stay hidden from everyone except the active player during the keep step. Arms Dealer reveal is public. Bomb holder and prior holder list are public. Bank pile is public. Coin counts are public.
