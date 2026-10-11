# 03 Turn Structure

## The three parts of a turn

Each turn has exactly three parts, in this order [RB, RP].

First you move your player token to a new location. Then you perform the action of the location you moved to. Then you swap one evidence card.

The three parts run in sequence and do not nest. The action completes fully before the Evidence Swap begins [RB, RP].

## Movement

Move your player token to any new location [RB, RP].

You may not stay on the location your token currently occupies [RB, RP]. The rulebook allows a move to any of the other four of the five locations [RB, RP].

A location may hold any number of tokens. Nothing in the rules restricts moving onto an occupied location [RB, RP]. `02-setup-and-components.md` covers the two-token placement that setup can produce.

Two reviewers describe a smaller choice. Games Night Guru says you move to one of four locations and that you cannot take the same action as on your last turn [GNG]. Jesta ThaRogue says a player has two or three actions to choose from [JTR]. The Games Night Guru reading undercounts, because there are five location cards and four non-Cops destinations. The Jesta ThaRogue reading matches neither the rulebook nor Games Night Guru. Implement the rulebook's reading. Both reviewer readings are recorded in `07-open-questions.md`.

## The six location actions

There are six location actions. Five are printed on the five location cards, and the sixth is the reverse of Prepare, revealed when Prepare flips [RB, RP].

### Prepare

Prepare costs nothing [RB, RP].

Take one preparation token from the card into your own supply [RB, RP]. When the second token is taken, flip the Prepare card to its Frame/Steal side [RB, RP, DY, JTR].

There are exactly two preparation tokens, so Prepare flips exactly once per game [RB, RP].

### Spy

Spy costs nothing [RB, RP].

Pick one player at the table. That player must show you their hand [RB, RP].

Whether the showing reaches the table or the spy alone is unresolved [RB, RP, JTR]. The plain wording is that they show you their hand, which reads as the acting player alone. An implementation should make the audience configurable and default to private. `07-open-questions.md` records it.

### Trade

Trade costs nothing [RB, RP].

Pick one player at the table. That player must exchange one evidence card from their hand with one evidence card from your hand [RB, RP].

Both players choose which card they give, and the exchange is simultaneous [RB, RP].

### Stash

Stash costs nothing [RB, RP].

Pick one of the three facedown cards at this location and add it to your hand. Then place one card from your hand face down to replace it [RB, RP].

You may place down the very card you just picked up [RB, RP]. The rulebook states this explicitly, so a player can look at one facedown Stash card without changing the Stash [RB].

### Frame/Steal

Frame/Steal is the reverse of Prepare, revealed when Prepare flips [RB, RP].

The action is conditional. If you hold a preparation token, you Frame. If you do not, you Steal [RB, RP].

If you hold a preparation token, you initiate a Frame Attempt [RB, RP]. `04-frame-attempt-and-end.md` covers the procedure.

If you do not hold a preparation token, you steal one from any player who does have one [RB, RP].

The card text does not say that the stolen token is consumed, and it does not say that the act of stealing also triggers a frame [RB, RP]. On the plain reading, stealing and framing are alternatives, so a thief who steals does not also frame on that turn. The card name Frame/Steal invites the alternative reading that stealing initiates a frame attempt. `07-open-questions.md` records it.

### Go to the Cops

Go to the Cops costs nothing [RB, RP].

The game ends immediately and the scapegoat wins [RB, RP].

A six-player game adds a second way to take this action. You may go to the cops at the beginning of the turn of the player sitting three seats to your left, which is outside your own turn [RB, RP]. `04-frame-attempt-and-end.md` covers the outside-turn run.

## The Evidence Swap

The Evidence Swap is the third part of every turn, and it runs after the action is fully completed [RB, RP].

Select one evidence card from your hand and place it face up next to the location your token is on. Then pick up the face-up card that was already there and add it to your hand [RB, RP].

If you hold one or more cards bearing your own player colour, you must select one of those to place down [RB, RP]. The obligation covers a card where your colour is one of several colours on the card [RB].

The Evidence Swap is the game's main information channel. A player who is obliged to place their own colour reveals that they hold it, and the card they leave behind becomes public [RB, RP].

The grey bystander is not any player's colour, so a grey card never satisfies the own-colour obligation [RB, RP].

## Turn order

Play proceeds in turns, starting with the player whose token is on Prepare [RB, RP]. In a five- or six-player game two tokens sit on Prepare, and the player placed there first starts [RB, RP].

Turn order after the first player is sequence order. After a failed frame attempt the next player in sequence takes their turn as normal [RB, RP].

The rulebook never defines the sequence or its direction [RB, RP]. Whether play runs clockwise or counter-clockwise, and how the seat-order tiebreak for the player placed there first resolves, are both unstated in any source read. An implementation must pick and document a convention, and `07-open-questions.md` records it.

## Communication

All discussion and communication is allowed, including nonverbal signals such as winks, nods, finger points, and the rulebook's own word, footsy [RB, RP].

Players may state what cards they hold, and they may tell the truth or lie while doing so [RB, RP].

The design constraint is that giving too much away to the scapegoat lets the scapegoat discover they are the target and run to the cops [RB, RP, SB, DY].
