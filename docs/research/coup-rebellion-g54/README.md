# Coup Rebellion G54 research for web implementation

## Overview

Coup: Rebellion G54 is a standalone bluffing and deduction card game for 3 to 6 players. Designer is Rikki Tahta. Publisher is La Mame Games and Indie Boards and Cards. Release is 2014. It reuses the core engine of Coup. It is a reskin of Coup Guatemala 1954 with new art.

Each player holds hidden influence cards. Each card is a life and a claimed power. Players claim actions. Claims may be lies. Any claim may be challenged. Some actions may be blocked. A lost challenge costs a life. A successful attack costs a life. Coup costs coins and cannot be blocked. Last player with a face down card wins.

The difference from base Coup is the variable setup. The box holds 25 roles. Each game uses 5 roles. Deck is 15 cards. Three copies of each of the 5 chosen roles. Categories enforce balance. One Finance. One Communications. One Force. Two Special Interest. This yields 5625 legal combinations.

Standard game is 15 minutes. Age is 14 plus. Player elimination is fast enough to be acceptable. Kickstarter copies had 4 copies per role and support 7 to 8 players. Retail box has 3 copies per role and supports 3 to 6.

## Key Concepts

Influence is life and permission to claim. Two cards dealt face down. Lose a life by turning one face up. Choice of which card to reveal belongs to the loser. Revealed cards give no power. Zero face down cards means elimination. Eliminated player returns coins to Treasury and leaves cards face up.

Claim is a statement of holding a role. Truth is optional. Proof is only required when challenged. General actions need no claim and cannot be challenged.

Challenge is a call of bluff on any role action or counteraction. Any player may challenge. Even uninvolved players may challenge. One challenge resolves fully before play continues.

Counteraction is a block claim. It also may be a lie. It also may be challenged. Unless the card says otherwise only the target may block in self defense.

Court deck is the undealt remainder of the 15 card deck. Successful defense of a claim shuffles the shown card back and draws a replacement. Identity stays hidden.

Treasury is the central coin pool. All coin costs go to Treasury unless a role says another recipient. Coin counts are public. No lending. No gifting except where a role requires it.

Tokens modify targeting or costs. Treaty, Peacekeeping, Disappear, Tax. Only roles in play bring their tokens into play.

## How It Works

Setup selects 5 roles by category. Starter set for first game is Banker, Director, Guerrilla, Politician, Peacekeeper. Players review all 5 role cards face up. Influence deck is built from those 5 roles only. Each player gets 2 coins and 2 influence. Last winner starts. Turns go clockwise. One action per turn. No passing.

Turn order per action is fixed. Claim action and target. Resolve challenges on the claim. Resolve extra claims in clockwise order. Claim counteractions. Resolve challenges on counters. Apply counters. Apply surviving action. Ten or more coins at start of turn forces Coup as the only action.

Income takes 1 coin. Coup pays 7 coins and removes 1 influence from a target. Coup always works. No challenge. No block. Partial actions are allowed when coins or cards are short. Treasury has no hard cap. Use substitute counters when empty.

Loss of influence has special reactive roles. Missionary and Intellectual trigger after a loss. Lawyer triggers after an elimination. These create extra claim and challenge steps outside the normal turn.

Endgame has no second place. When one player retains face down influence the game ends at once.

## Where Things Live in This Folder

`01-overview.md` owns facts, player count, duration, win condition.
`02-setup-and-components.md` owns box contents and table setup.
`03-turn-structure-and-rules.md` owns turn order, challenge, counter, elimination.
`04-roles-finance.md` owns the 5 Finance roles.
`05-roles-communications.md` owns the 5 Communications roles.
`06-roles-force.md` owns the 5 Force roles.
`07-roles-special-interest.md` owns the 10 Special Interest roles.
`08-tokens-and-special-cases.md` owns tokens and edge cases.
`09-variants-and-play-notes.md` owns variants, balance notes, open questions.
`SOURCES.md` owns every source URL used.

## Gotchas for Web Implementation

Only 5 roles are active per game. All other role text is dead for that game. UI must show the 5 active role cards at all times.

Self blocking is the norm. Unlike base Coup where Contessa blocks Assassin, here Guerrilla blocks Guerrilla and Judge blocks Judge. Do not import base Coup cross role blocks.

Counter still costs the attacker. If Judge pays 3 and the kill is blocked the 3 stays paid unless the block text says otherwise. If Crime Boss action is stopped the coins paid stay paid.

Double life loss in one turn is legal. Failed challenge plus successful Force execution equals 2 lives in one turn. UI must support revealing two cards from one attack sequence.

Missionary and Intellectual break the normal one life per challenge rule. They can cause a second life loss on a failed defense. See role files.

Treaty and Peacekeeper change the legal target set. Coup is the only exception to Peacekeeper immunity. Treaty expires when the two allies are the final two players. Target picker must enforce this.

throughput checkpoint: n/a, read-only investigation
