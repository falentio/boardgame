# 04 Frame Attempt and Game End

## The Frame Attempt

A player triggers a Frame Attempt by taking the Frame/Steal action while holding a preparation token [RB, RP]. `03-turn-structure.md` covers the action that starts it.

Each player must pick an evidence card from their hand [RB, RP]. On a count of three, all players simultaneously reveal their chosen card [RB, RP].

The rulebook gives no exception for a player who holds no legal card. A player with an empty hand or an all-grey hand still faces the requirement to pick. The rules provide no fallback, and `07-open-questions.md` records it.

Before initiating, the framing team must be confident that all players except the scapegoat are holding a card with the scapegoat's portrait on it [RB, RP].

## Success and failure

The frame succeeds when the same colour is present on all of the revealed cards [RB, RP].

The framed player's own revealed card does not need to contain their colour. Every other player's revealed card must [RB, RP]. This is the exception that makes the frame resolvable at all, because the odd card out may be anything [RB, RP].

The precise shape of the condition is this. The frame succeeds when there exists a colour C such that every player except the framed player revealed a card containing C [RB, RP]. The success condition and the identity of the framed player are therefore the same fact, because the odd card out is the framed player's [RB, RP].

The rulebook's worked example: blue, green, and yellow each reveal a card with red's portrait, and red reveals a card with green's portrait. Red is framed. Because red is the true scapegoat, all other players win [RB, RP].

The frame fails when there is no colour present on all but one of the revealed cards [RB, RP]. On a failure the game resumes, and the next player in sequence takes their turn as normal [RB, RP]. Nothing is scored, and the failure itself spends no cards [RB, RP].

The rules do not address a tie [RB, RP]. Two different colours can each appear on all-but-one card. The success condition then holds for one colour and the failure condition holds for the other, so the two readings collide [RB, RP]. An implementation needs a deterministic tiebreak, and none is published. `07-open-questions.md` records it.

A colour present on every revealed card has no odd card out, so nobody is framed and the attempt fails [RB, RP].

## Scoring after a successful frame

After a successful frame, every player reveals who their own player mat says is the scapegoat. This confirms the true identity [RB, RP].

If the scapegoat is the player who was framed, the rest of the players win and the scapegoat loses [RB, RP]. If a player who is not the scapegoat is framed, the real scapegoat wins and the rest of the players lose [RB, RP]. The wrong-player outcome is corroborated by a play report and a review [RD, GNG].

The game ends immediately on a successful frame [RB, RP]. No Evidence Swap follows, because the game is over.

The frame also ends the turn on a failure, and the framer then takes their Evidence Swap as normal before play passes on [RB, RP].

## Going to the cops

A player on their own turn may move to Go to the Cops and perform the action [RB, RP].

A six-player game adds a second way. You may go to the cops at the beginning of the turn of the player sitting three seats to your left [RB, RP]. This is the only count-specific rule beyond setup, and it exists only at six players [RB, RP].

The acting player flips the Go to the Cops card, and the game ends immediately [RB, RP].

All players count to three and simultaneously point at who their own player mat says is the scapegoat. The player pointed at by every other player is the true scapegoat [RB, RP].

Regardless of who went to the cops, the scapegoat wins and all other players lose [RB, RP]. A play report, a review, and a first-impressions piece all confirm that a non-scapegoat who runs to the cops hands the win to the scapegoat [RD, GNG, JTR]. The run is game-losing for the runner and everyone else, and game-winning for the scapegoat.

## The six-player outside-turn run

Only a six-player game allows a player to go to the cops outside their own turn [RB, RP].

The timing is the beginning of the turn of the player sitting three seats to your left [RB, RP]. The run happens at the beginning of that turn, not during it and not after any action [RB, RP].

Three seats along a six-seat circle is the same seat in either direction, so the rulebook's unstated play direction does not affect this rule [RB].

## Win predicates

Stated as implementable predicates [RB, RP].

- The scapegoat wins when any player has taken the cops action.
- The scapegoat wins when a frame attempt succeeds and the framed player is not the true scapegoat.
- Everyone except the scapegoat wins when a frame attempt succeeds and the framed player is the true scapegoat.

The game has no points, no score track, and no second place [RB, RP, GNG].

## What ends the game

There is no fixed round count. Round is not a rules term in this game. The rulebook defines only turns and the two terminal conditions [RB].

The game ends when a frame attempt succeeds, or when a player goes to the cops [RB]. There is no third end condition [RB].

What happens if the deck or a supply runs dry is not addressed by the rules [RB]. `07-open-questions.md` records it.
