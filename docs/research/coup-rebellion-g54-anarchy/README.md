# Coup Rebellion G54 Anarchy research for web implementation

## Overview

Coup Rebellion G54 Anarchy is an expansion for Coup Rebellion G54. Designer is Rikki Tahta. Publisher is Indie Boards and Cards. La Mame Games publishes the twin edition Coup Guatemala 1954 Anarchy with the same rules and different art. Release is 2016. It is not standalone. Base Coup Rebellion G54 is required to play.

The expansion adds six roles and one general action. Force gains Anarchist and Paramilitary. Finance gains Financier and Plantation Owner. Special Interest gains Arms Dealer and Socialist. Communications gains no new role. Social Media is a new general action that takes the Communications slot.

The engine does not change. Claim, challenge, block, Income, Coup, the 10 coin forced Coup, and the 7 coin Coup all stay. Anarchy changes the setup pool, the general action set, and the role list. It also adds one token, the Bomb, and one general action card, the Bank.

## Key Concepts

Role action cards are added to the base piles by category before the draft. Finance pile gains Financier and Plantation Owner. Force pile gains Anarchist and Paramilitary. Special Interest pile gains Arms Dealer and Socialist. Communications pile gains Social Media.

Social Media is a role action card that plays as a general action. When it is selected, it becomes an extra general action and the table draws one additional Communications role. The 5 role set still needs a Communications role.

Bank is a general action card that comes out only with Financier. It replaces the Income card for the whole game.

Bomb is a single role token. Only Anarchist uses it. It moves around the table until it is defused or someone loses an influence to it.

The Bomb chain is a pass loop outside normal turn structure. The active player starts it. Each holder either passes or defuses. The chain ends when someone defuses or fails to act.

## How It Works

Setup adds the seven Anarchy role action cards to the base piles by category. That is six roles plus Social Media. The draft rule is unchanged. Take 1 Finance, 1 Communications, 1 Force, 2 Special Interest. If Social Media is selected, it moves to the general action area and the table draws one extra Communications role.

If Financier is in the game, swap the Income card for the Bank card. From then on the general action is Bank, not Income. Bank takes 1 coin from Treasury and adds 1 coin to the Bank pile.

Turn structure is unchanged. One action per turn. No passing. Claim, challenge, block resolve in the base order. Anarchy adds no new challenge or block rules.

Anarchist runs a sub turn. Active player pays 3, gives the bomb to a target, and pauses. The target passes or defuses. Each pass is a counteraction and may be challenged. The bomb never returns to a prior holder. If the target does nothing, the target loses 1 influence.

Socialist runs a sub turn for every other player. Each target gives 1 coin or 1 card. Active player keeps coins, views cards, adds 1 own card, keeps 1, then reshuffles and deals 1 card back to each giver.

Plantation Owner runs a mass claim like Capitalist. Every other player may claim the role. Payout is 1 coin per surviving claimant, to each claimant.

## Where Things Live in This Folder

`01-overview.md` owns facts, player count, duration, win condition, and relation to base G54.
`02-setup-and-components.md` owns box contents and table setup.
`03-turn-structure-and-rules.md` owns turn order, the Bomb sub turn, and general action changes.
`04-roles-force.md` owns Anarchist and Paramilitary.
`05-roles-finance.md` owns Financier and Plantation Owner.
`06-roles-special-interest.md` owns Arms Dealer and Socialist.
`07-general-action-social-media.md` owns Social Media and Bank.
`08-tokens-and-special-cases.md` owns the Bomb token, the Bank card, and edge cases.
`09-variants-and-play-notes.md` owns difficulty notes, recommended sets, open questions.
`SOURCES.md` owns every source URL used.

## Gotchas for Web Implementation

Anarchy roles are added to base G54. The web version must merge the Anarchy role cards into the category piles, not replace them. See the base folder `docs/research/coup-rebellion-g54` for the base 25 roles.

The role count is reported two ways. The rulebook and Wikipedia say six new roles plus the Social Media general action. BoardGameGeek and some shops list Financier and World Bank as separate entries. They are one thing. Financier is the role. Bank is the general action card it brings. Do not build two Finance roles for this.

Financier removes Income. While Financier is in play, the Income button must be replaced by Bank. Bank cannot be blocked or challenged. The Bank pile needs a public count.

Social Media is drafted like a role but plays as a general action. The setup must move it out of the role area and draw an extra Communications role. If the web draft forgets the extra draw, the game has 4 roles and no Communications role.

The Bomb chain is a multi step sub turn. State must track the current holder and the set of prior holders. The target picker must exclude every prior holder including the active player. The chain can loop many times before it resolves.

Socialist moves hidden cards between players. The server must keep each card hidden, apply the active player's keep choice, then deal hidden replacements. Coin givers and card givers must end with the same hand size they started with.

throughput checkpoint: n/a, read-only investigation
