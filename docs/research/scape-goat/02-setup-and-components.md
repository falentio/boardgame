# 02 Setup and Components

## Components and counts

The rulebook's components panel gives six counts, confirmed verbatim by the rulespal transcript [RB, RP].

- Evidence cards: 30.
- Player mats: 18.
- Location cards: 5.
- Player tokens: 6.
- Preparation tokens: 2.
- Decoder dice: 2.

The five location cards are named Prepare, Spy, Trade, Stash, and Go to the Cops [RB, RP, DY].

Player tokens are colour-matched to the player mats. The rulebook tells you to gather the player tokens that match the colours of the player mats [RB]. Exactly six tokens and six mat colours exist. No source read lists the full set of six colour names. The rulebook's worked example uses red, blue, green, and yellow [RB], and reviews mention blue, green, yellow, and red [GNG, DY, JTR]. The full list is unresolved, and `07-open-questions.md` records it.

Preparation tokens are physical beads [JTR].

## Player mats

Player mats are double-sided [RB, RP, DY].

The front shows a portrait, which is the player's alter-ego, and a reminder of the three steps in a turn [RB, RP]. The alter-egos named across the mats are The Pickpocket, The Muscle, The Face, The Driver, The Thief, and The Hacker [RP]. The names also appear in the rulebook's artwork [RB].

The back carries the decoder matrix [RB, RP, DY].

Each player mat prints, in its top right corner, which player counts it is used for [RB, RP]. Setup takes the mats whose marker matches the number of players [RB].

The rules state that 18 mats exist and that each is marked with its player counts, but no source read says how the 18 divide across the four counts [RB]. The rules text says only that each player count has a corresponding set of player mats [RB]. An arithmetic fit is 3 plus 4 plus 5 plus 6, which equals 18 and would give exactly enough mats for each count, but this is an inference and not a stated rule [RB]. It must be verified against the physical components, and `07-open-questions.md` records it.

## The decoder matrix

The back of each player mat holds a decoder matrix. It is a grid indexed by the two dice, and each coordinate gives the name or colour of the player that this mat's owner believes is the scapegoat [RB, RP, DY].

Dale Yu describes the grid as 10 by 12 [DY]. SPACE-BIFF! says each mat shows over a hundred options [SB]. The two descriptions agree, because 10 times 12 equals 120 [DY, SB]. No source states the exact contents of a cell.

Two properties of the matrix matter for implementation, and independent sources confirm both [SB].

A player's own mat never names that player. Every grid coordinate indicates a different player, so a player is never told that they themselves are the scapegoat [SB].

For a fixed player count and a fixed die result, the scapegoat is the same for every player. The lie is structural and not per-roll [SB]. Dan Thurot confirmed this in the comment thread on his own review [SB]. Mechanically, for a given count exactly one mat entry differs from the consensus, and that difference is what makes the named player the scapegoat [SB].

A player can therefore never see their own colour as their suspect. This is the single most important invariant for an implementation to preserve [SB].

## The location line

Setup arranges the five location cards in a line in the centre of the table, with Prepare at the far left and Go to the Cops at the far right [RB, RP].

Prepare and Go to the Cops are double-sided [RB, RP]. Prepare flips to its Frame/Steal side when its second preparation token is taken [RB, RP, DY, JTR]. Go to the Cops flips to a face reading "THE COPS HAVE ARRIVED! The game ends. The scapegoat wins!" when a player uses it [RB].

## Token placement

Gather the six player tokens [RB]. Starting at the Prepare card and moving right along the line, place one player token on each location [RB, RP]. No player token begins on Go to the Cops [RB]. The assignment is random [RB].

For a five- or six-player game, continue placing tokens a second time, again starting from Prepare and moving right [RB, RP].

After setup, at most two location cards may carry two player tokens [RB]. With 3 players the tokens land on Prepare, Spy, and Trade. With 4 players they land on Prepare, Spy, Trade, and Stash. With 5 or 6 players the second pass gives two locations two tokens each and the rest one [RB].

The player whose token is on Prepare moves first. In a five- or six-player game two tokens sit on Prepare, and the player placed there first starts [RB, RP].

## The deck build

Collect the evidence cards whose bottom-right marker matches the player count [RB, RP]. Each evidence card prints, in its bottom right corner, a number indicating which player counts it is used for [RB, JTR].

A card marked with a bare number and no plus sign is used only at that exact player count [RB]. Return every non-matching card to the box. Non-matching cards are not used [RB].

The rulebook defines the marker semantics but gives no per-marker counts [RB]. An implementation must derive the marker set from the physical cards. `07-open-questions.md` records it.

## The deal

Shuffle the matched evidence cards facedown, then deal in this order [RB, RP].

Deal one card face up next to each location card except Go to the Cops, so Prepare, Spy, Trade, and Stash each get one face-up card [RB, RP].

Deal three cards facedown in a row next to the Stash card. These three are the Stash's facedown supply [RB, RP].

Deal the remaining cards facedown to the players. Every player must end with the same number of cards in hand, and that number is either two or three depending on the number of players [RB, RP].

## The arithmetic that does not close

The stated 30-card total is inconsistent with the stated deal at every player count [RB, RP].

Subtract the 4 face-up location cards and the 3 facedown Stash cards from 30 and 23 cards remain for the players. The 23 does not divide evenly by 6, which gives about 3.83 cards each. It does not divide evenly by 5, which gives 4.6, nor by 4, which gives 5.75, nor by 3, which gives about 7.67 [RB, RP].

The rulebook also says the hand size is either two or three, and no source read says which count gets which number [RB, RP]. Games Night Guru states that players begin with two cards [GNG].

The resolution is almost certainly that the 30 cards are not all in play, because the deck is filtered by player count before the deal [RB]. The rules give no per-count deck size, so the hand size cannot be derived from the published numbers. An implementation must be given the real per-count deck sizes, and they cannot be computed. Treat hand size as a per-player-count data constant to be supplied, not a rule to be applied. `07-open-questions.md` records it.

## The dice

Roll the two decoder dice once during setup [RB, RP].

Use the two numbers and the matrix on the back of your own player mat to learn in secret who the scapegoat is. If you are the scapegoat, you learn who you believe the scapegoat is [RB, RP].

The white die indexes the white vertical column, and the black die indexes the black horizontal row [RB, RP].

Do not re-roll the dice. The same two numbers are referenced for the rest of the game [RB, RP].

The rulebook's worked example uses a 4 on the white die and a 7 on the black die. Three player mats show red as the scapegoat, and the red player's own mat shows blue as the scapegoat. Red is therefore the scapegoat and does not know it. Red must realise this and run to the cops before being framed [RB, RP].

The rulebook does not commit to the number of faces on each die. Dale Yu states that a d10 and a d12 are rolled against a 10 by 12 grid [DY]. These descriptions are compatible, since a white d10 and a black d12 are decoder dice. Treat the matrix dimensions as data to be read off the physical mats, with 10 columns and 12 rows the only dimension any source states [DY]. `07-open-questions.md` records it.
