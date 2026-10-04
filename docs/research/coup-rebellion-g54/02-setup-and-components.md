# 02 Setup and Components

## Box Contents Retail

75 influence cards. Three copies of each of the 25 roles.
25 role action cards. One per role. Grouped as 5 Finance, 5 Communications, 5 Force, 10 Special Interest.
2 general action cards. Income and Coup reminder cards.
50 coins.
8 role tokens. Two Treaty, one Peacekeeping, three Disappear, two Tax.
25 role dividers plus 2 storage dividers.
Rulebook.

Kickstarter variant had 4 copies per influence role. That variant enables 7 to 8 players. Retail has 3 copies and supports 3 to 6.

## Table Setup Steps

1. Place the 2 general action cards in the center.
2. Split role action cards into 4 piles by type.
3. Choose 5 role action cards. Take 1 Finance, 1 Communications, 1 Force, 2 Special Interest. Random or by vote. Exclude advanced roles for new players.
4. Place the 5 chosen role cards face up and visible to all. These plus general actions define the only legal actions for the game. Pass them around so all players read them.
5. Place matching tokens in the center. Only Mercenary, Peacekeeper, Foreign Consular, Customs Officer use tokens. Other roles use no tokens.
6. Pull the 3 copies of each chosen role. This is the 15 card influence deck. Shuffle it. Deal 2 face down to each player. Players may look at their own cards at any time. Cards stay face down in front of them.
7. Remainder is the Court deck. Place face down in the center.
8. Give each player 2 coins. Coins stay visible. Remainder is the Treasury in the center.
9. Last winner starts. Otherwise pick a starter. Turns go clockwise.

## Starter Set

Use for first game and for tutorial in web version. Banker for Finance. Director for Communications. Guerrilla for Force. Politician and Peacekeeper for Special Interest. This set mirrors base Coup most closely and has one simple token.

## Category Design Intent

Finance roles provide money. Communications roles exchange or filter cards. Force roles remove influence for a coin cost. Special Interest roles add negotiation, taxation, protection, reactive effects. Every game has money, card flow, attack, plus two wildcards. Web draft UI should enforce this 1 plus 1 plus 1 plus 2 rule. Allow custom draft only as an advanced option because unbalanced sets play poorly.

## Public Versus Hidden State

Public is active role list, all coin counts, revealed influence cards, Court deck size, Treasury size, token locations, whose turn it is, pending claim and target.
Hidden is each player's face down influence. Never reveal to other players except through challenge proof or loss reveal. No peeking API. No card sharing. Web version must enforce hidden hands server side.

## Coin and Deck Limits

No coin cap per player except forced Coup at 10. Treasury has no cap. If coins run out use counters.
Court deck size is 15 minus 2 per player at start. Deck cycles through challenge replacements and Communications swaps. Deck can empty in long games with heavy draw roles. Rules allow partial actions when cards or coins are short. Web version must handle empty deck without crash.
