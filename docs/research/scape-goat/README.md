# Scape Goat research for web implementation

## Overview

Scape Goat is a social-deduction card game for 3 to 6 players. Designer is Jon Perry. Publisher is Indie Boards and Cards, and Lone Oak Games is the parent company behind that imprint. Release is 2020 [RB, JP, TT, DY, RD].

One player is the scapegoat and does not know it. Every other player's own player mat names the scapegoat. The scapegoat's own player mat names a different player instead. The table wins only by framing the true scapegoat. The scapegoat wins if any player goes to the cops, or if the table frames a player who is not the scapegoat.

The game has no points, no score track, and no elimination. It ends the moment a frame succeeds or a player reaches the cops.

## Key concepts

The scapegoat is a role, written with a lowercase s. Exactly one player holds it in a game, and that player never learns it from their own player mat [RB, RP, SB].

The suspect is the player a given player mat names. Every player mat names a suspect, and for every player except the scapegoat the suspect is the true scapegoat [RB, RP, SB].

The player mat carries the hidden information. Its front shows a portrait and a reminder of the three turn steps. Its back shows the decoder matrix [RB, RP, DY].

The decoder matrix is a grid indexed by two dice. You read your own player mat's back with the two die results to learn who you believe is the scapegoat. The matrix never names its own owner [SB].

Preparation tokens are the two beads that start on the Prepare card. Holding one is what lets you attempt a frame. Taking the second token flips Prepare to its Frame/Steal side [RB, RP, JTR].

Evidence cards are the only card type. Each bears one or more goat colours, and each is legal only at the player counts printed in its bottom right corner. The grey goat is an innocent bystander and matches no player [RB, RP].

The Evidence Swap is the third part of every turn. You place one card face up and pick up the card already there. When you hold your own colour you must place one of those cards, which is how the table leaks information to the scapegoat and to itself [RB, RP].

## How it works

Setup gathers the player mats for the player count and lays the five location cards in a line from Prepare to Go to the Cops. It then places the player tokens, builds the deck from the matching evidence cards, deals, and rolls the two decoder dice once. Each player then reads their own player mat in secret [RB, RP].

A turn has three parts in order. You move your player token to a new location, you take that location's action, and you swap one evidence card [RB, RP]. The location actions are Prepare, Spy, Trade, Stash, and Go to the Cops. Prepare flips to Frame/Steal once both preparation tokens are gone.

A frame attempt needs every player to reveal one card. It succeeds when one colour sits on every revealed card but one, and the player holding the odd card is framed. If that player is the scapegoat, the table wins. If not, the scapegoat wins [RB, RP].

Going to the cops ends the game at once and always hands the win to the scapegoat, whoever runs [RB, RP, RD, GNG, JTR].

## Where things live in this folder

`01-overview.md` owns identity, player count, session length, the win condition, the core loop, the two end conditions, and the two roles.
`02-setup-and-components.md` owns the component counts, the player mats and the decoder matrix, the location line, token placement, the deck build, the deal, and the dice.
`03-turn-structure.md` owns the three-part turn, movement, the six location actions, the Evidence Swap, turn order, and communication.
`04-frame-attempt-and-end.md` owns the frame procedure, success and failure, the scoring after a successful frame, going to the cops, and the six-player outside-turn run.
`05-hidden-information.md` owns what is secret, what is public, the two player mat properties, what Spy reveals, and what Stash hides.
`06-variants-and-player-counts.md` owns the three setup differences by count, the six-player-only rule, and what does not vary.
`07-open-questions.md` owns every ambiguity, both readings where two exist, and the reading the implementation chose.
`SOURCES.md` owns every source URL used.

## Gotchas for web implementation

A player's own player mat never names that player. For a fixed player count and a fixed die result, one player mat entry differs from the consensus, and that difference is what makes the named player the scapegoat [SB]. Preserve this invariant above all others. See `05-hidden-information.md`.

The 30-card box total does not divide into the stated deal at any player count [RB, RP]. The deck is filtered by player count before the deal, and no source gives the per-count deck size. Treat the hand size as a per-count data constant. See `02-setup-and-components.md` and `07-open-questions.md`.

The two decoder dice are rolled once and never re-rolled. The same two numbers are read for the rest of the game [RB, RP].

Grey matches no player. A grey card can never satisfy the own-colour swap obligation and can never take part in a matching frame set [RB, RP].

A run to the cops is game-losing for the runner and game-winning for the scapegoat [RD, GNG, JTR]. Six-player games add an outside-turn run at the beginning of the turn of the player three seats to the left [RB, RP].

Two reviewers describe a smaller location choice than the rulebook does [GNG, JTR]. Implement the rulebook's reading, which allows a move to any other location. See `03-turn-structure.md`.

Whether a Spy reveal reaches the table or the spy alone is unresolved [RB, RP, JTR]. The implementation defaults to private and exposes the choice as a setup option. See `05-hidden-information.md`.

