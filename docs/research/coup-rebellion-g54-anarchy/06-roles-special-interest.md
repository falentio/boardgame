# 06 Roles Special Interest

Anarchy adds two Special Interest roles. Both are advanced. Both are high variance.

## Arms Dealer

Category is Special Interest. Deck gamble for coins.
Action is name a character role, then turn over 2 random cards from the deck. If either card matches the named role, the active player gains 4 coins from Treasury. Then return the 2 cards to the deck and shuffle.
Counteraction is none. Block is none.
Edge cases are the named role is any role in play, not just an active role. The active player names before the reveal. The 2 cards are shown to the table, then reshuffled, so no card leaves the deck. If both cards match the named role the payout is still 4, not 8. If Treasury is short allow partial. The named role should be a role with many copies in the deck to raise the odds, since the deck holds 3 copies of each of the 5 active roles.
Web notes need a role name picker, a public 2 card reveal, a match check, and a reshuffle. No challenge window on the payout itself, but the claim may still be challenged before the reveal. Show the odds hint as 3 copies of each active role in a 15 card deck.

## Socialist

Category is Special Interest. Mass card and coin redistribution.
Action is every other player becomes a target and gives the active player either 1 coin or 1 card, target's choice. The active player keeps all coins. The active player views the cards received, adds 1 card from their own hand, chooses 1 card to keep, then shuffles the rest and deals 1 card back to each player who gave a card. Any leftover card returns to the deck.
Counteraction is block with Socialist. Any target may block. A blocking target keeps their coin or card.
Edge cases are each target chooses coin or card. Targets with 0 coins must give a card. Targets with no cards must give a coin. The active player's final hand size may change by the keep choice. The active player keeps coins from all givers. The number of cards dealt back equals the number of card givers, so card givers end with the same hand size they started with. The active player adds 1 own card and keeps 1, so the net card flow is a swap, not a gain.
The cards received are hidden from other players. Whether the active player learns which card came from which giver is a table question. Primary reading is the cards are collected hidden and shuffled, so the giver of each card is not tracked.
Web notes need a three phase flow. Phase one is a coin or card choice from each target. Phase two is the active player's hidden view of received cards plus own card plus keep choice. Phase three is the hidden redistribution. Server must keep all hands hidden. Show only hand sizes to other players.

## Special Interest Implementation Checklist

Arms Dealer needs a role name picker, a public 2 card reveal, a match check, and a reshuffle that keeps deck size constant. Socialist needs a per target coin or card choice, hidden collection, a keep step, and hidden redistribution. Socialist is the hardest role in the expansion to build because it moves hidden cards between every player and must preserve hand sizes.
