# 07 Open Questions

Every item below is an ambiguity the sources leave open. Where two readings exist, both appear with their source. Where the implementation has settled the question, the chosen reading appears under "Implementation choice" and points at `docs/design/scape-goat.md` for the decision record. Where nothing has settled it, the item stays marked unresolved.

## 1. Hand size at setup

Reading A is the rulebook, verbatim. All players should have the same number of cards in their hands, either two or three depending on the number of players. The rules never say which count gets which number [RB, RP].

Reading B is Games Night Guru, which states that players begin with two goat cards [GNG].

The item is unresolved by the sources read. The arithmetic compounds it. The stated 30-card total is inconsistent with the stated deal at every player count, and the deck is filtered by player count before the deal, so the hand size cannot be derived from the published numbers [RB, RP]. `02-setup-and-components.md` keeps the arithmetic.

Implementation choice: hand size is a per-count data constant supplied to the engine, and the deal equation pins the value at each count. See `docs/design/scape-goat.md`.

## 2. The two decoder dice

Reading A is the rulebook, which lists two decoder dice, one white and one black, with the white die indexing the white vertical column and the black die indexing the black horizontal row [RB, RP].

Reading B is Dale Yu, who states that a d10 and a d12 are rolled against a 10 by 12 grid on the back of the mat [DY].

The two readings are compatible, because a white d10 and a black d12 are decoder dice. The rulebook does not commit to the number of faces, so the question is unresolved by the sources.

Implementation choice: the matrix dimensions are data to be read off the physical mats, with 10 columns and 12 rows the only dimension any source states. See `docs/design/scape-goat.md`.

## 3. Grid size and number of options

Reading A is Dale Yu, who gives 10 by 12, which is 120 cells [DY].

Reading B is SPACE-BIFF!, which says each mat shows over a hundred options [SB].

The two readings agree in substance, because 10 times 12 equals 120. No source states the exact contents of a cell, so the question is unresolved by the sources.

Implementation choice: the decoder matrix is data, not a rule, and the engine carries no cell contents. See `docs/design/scape-goat.md`.

## 4. Number of location choices per turn

Reading A is the rulebook. You move to any new location, so any of the other four of the five locations, with no occupancy restriction [RB, RP].

Reading B is Games Night Guru, which says you move to one of four locations and that you must move and cannot take the same action as on your last turn [GNG].

Reading C is Jesta ThaRogue, which says a player has two or three actions to choose from [JTR].

Reading B undercounts, because there are five location cards and four non-Cops destinations. Reading C matches neither the rulebook nor Games Night Guru. The two reviewer readings are unresolved by the sources.

Implementation choice: the rulebook's reading. A player may move to any location other than the one they occupy, including Go to the Cops. See `docs/design/scape-goat.md`.

## 5. Spy visibility

Reading A is the plain text. They must show you their hand, which reads as the acting player alone [RB, RP].

Reading B is a reviewer framing, which describes Spy generically as an information-gathering action without naming an audience [JTR].

The item is unresolved by the sources.

Implementation choice: private to the spy by default, exposed as a lobby setup option so a table can choose public. See `docs/design/scape-goat.md`.

## 6. Age rating

Tabletopia states 10 plus [TT]. Dale Yu states 14 plus [DY]. The rulebook prints no age [RB].

The BoardGameGeek age rating was not retrievable, because BGG was blocked [BGG].

The item is unresolved.

Implementation choice: the age rating is display metadata and does not affect the engine. See `docs/design/scape-goat.md`.

## 7. Playing time

BoardGameGeek and Tabletopia state 30 minutes [BGG-via-search, TT]. Dale Yu also states 30 minutes [DY]. Several reviews report 15 to 20 minutes per game [SB, RD].

The readings are compatible if 30 minutes is the box figure and 15 to 20 minutes is a typical game. Both readings belong in the record, and no source reconciles them, so the item is unresolved.

Implementation choice: the playing time is display metadata and does not affect the engine. See `docs/design/scape-goat.md`.

## 8. The direction of play and the next player in sequence

The rulebook says the next player in sequence takes their turn after a failed frame attempt, but never defines the sequence or its direction [RB, RP]. The direction of play is likewise unstated. The item is unresolved by the sources.

Implementation choice: turn order is the canonical seat order, and the next player is the next seat in that order. See `docs/design/scape-goat.md`.

## 9. A Frame Attempt when a player holds no legal card

The rules say each player must pick an evidence card from their hand, with no exception for an empty hand or an all-grey hand [RB, RP]. The rules provide no fallback, so the item is unresolved by the sources.

Implementation choice: a missing pick fails the attempt outright. Framing a seat that did not pick would let a network hiccup decide the game. See `docs/design/scape-goat.md`.

## 10. A Frame Attempt with two colours each present on all but one card

The success condition is that the same colour is present on all of the revealed cards. The failure condition is that no colour is present on all but one [RB, RP]. If two different colours each appear on all-but-one card, the readings collide. The rules do not address a tie, and no tiebreak is published, so the item is unresolved by the sources.

Implementation choice: a deterministic tiebreak by canonical seat order, so the earliest-seated framed player wins. The colour only names the colour and never decides the winner, because the outcome reads whether the framed player is the scapegoat. A colour present on every reveal has no odd card out, so nobody is framed and the attempt fails. See `docs/design/scape-goat.md`.

## 11. Whether the thief spends the stolen preparation token

The Frame/Steal text says that if you do not have a preparation token, you steal one from any player who does [RB, RP]. It does not say the token is consumed, and it does not say that stealing also triggers a frame, so the item is unresolved by the sources.

On the plain reading, stealing and framing are alternatives, so a thief who steals does not also frame on that turn. The card name Frame/Steal invites the alternative reading that stealing initiates a frame attempt.

Implementation choice: stealing and framing are alternatives. A steal moves the token and never spends it, and it does not open a frame attempt. See `docs/design/scape-goat.md`.

## 12. What the player placed there first means in a five- or six-player game

Setup's second pass places two tokens on Prepare. The starting player is the player placed there first [RB, RP]. With a random placement pass, first is ambiguous, so the item is unresolved by the sources. It could mean the first pass's occupant, or the first of the two placed during setup by the person setting up.

The natural reading is the first pass's occupant.

Implementation choice: the first-pass occupant of Prepare moves first. See `docs/design/scape-goat.md`.

## 13. The full list of six player mat and token colour names

Exactly six tokens and six mat colours exist, and tokens are colour-matched to the mats [RB]. No source read lists the full set of six colour names, so the item is unresolved. The rulebook's worked example uses red, blue, green, and yellow [RB], and reviews mention blue, green, yellow, and red [GNG, DY, JTR].

Implementation choice: the engine defines a fixed set of six colours and maps the i-th canonical seat to the i-th colour. See `docs/design/scape-goat.md`.

## 14. The breakdown of the 18 player mats

The rules state that 18 mats exist and that each is marked with its player counts, but no source read says how the 18 divide across the four counts [RB]. The rules text says only that each player count has a corresponding set of player mats [RB].

An arithmetic fit is 3 plus 4 plus 5 plus 6, which equals 18 and would give exactly enough mats for each count. This is an inference and not a stated rule, so the item is unresolved, and it must be verified against the physical components.

Implementation choice: the mat breakdown is component metadata and does not enter the engine, because the engine assigns each seat a colour by canonical order. See `docs/design/scape-goat.md`.

## 15. The breakdown of the 30 evidence cards by marker

The 30 evidence cards carry bottom-right markers, and the rules define the marker semantics but give no per-marker counts [RB]. The item is unresolved. Any implementation must derive the marker set from the physical cards, because the deck build depends on it and the arithmetic does not close.

Implementation choice: the card faces and their per-count markers are authored data, and the deck for each count is the filter of that data by marker. See `docs/design/scape-goat.md`.

## 16. What happens when the deck or a supply runs dry

The rulebook gives no rule for an exhausted deck, an exhausted preparation token supply, or an exhausted evidence supply [RB]. The game has no third end condition [RB]. The item is unresolved by the sources.

Implementation choice: the deal consumes the per-count deck exactly, so no draw pile remains, and a state that carried one would need a draw in the step. See `docs/design/scape-goat.md`.

## 17. The age rating on BoardGameGeek

BGG was unreachable on every fetch attempt, and the XML API returned HTTP 401 [BGG]. BGG's own age rating was therefore not retrievable.

## 18. The 30-minute figure on BoardGameGeek

BGG was unreachable, so the 30-minute playing time rests on a search snippet and carries the marker `BGG-via-search` [BGG-via-search]. Tabletopia and Dale Yu independently state 30 minutes [TT, DY], so the fact does not rest on the snippet alone.

## 19. The best player-count recommendation on BoardGameGeek

BGG was unreachable, so the community player-count recommendation rests on a search snippet and carries the marker `BGG-via-search` [BGG-via-search]. Dale Yu's expectation that the game improves at higher counts supports it [DY], but the recommendation itself is a snippet fact.

## 20. The release year tag on BoardGameGeek

BGG was unreachable, so the "(2020)" tag rests on a search snippet and carries the marker `BGG-via-search` [BGG-via-search]. The release year does not rest on the snippet alone, because the rulebook's own dated file is 2/17/2020 and the designer's page is a direct read [RB, JP].
