# Citadels (2016) authoritative catalog

Source: the official Citadels rulebook as transcribed by RulesPal
(rulespal.com/citadels/rulebook, fetched 2026-07-18), cross-checked against the
Z-Man "Deluxe" rulebook component list and the BoardGameGeek card list. The
six preset cast lists in the rulebook are the proof of the unique-district set:
every one of the 30 uniques appears in at least one preset, and no other card
does.

The scaffold invented this data. This file is the correction. A worker
implementing a character or a district reads this file, not its memory.

## Characters: rank is fixed, three per rank 1-8, three at rank 9

Rank 1: Assassin, Witch, Magistrate
Rank 2: Thief, Spy, Blackmailer
Rank 3: Magician, Wizard, Seer
Rank 4: King, Emperor, Patrician
Rank 5: Bishop, Abbot, Cardinal
Rank 6: Merchant, Alchemist, Trader
Rank 7: Architect, Navigator, Scholar
Rank 8: Warlord, Diplomat, Marshal
Rank 9: Artist, Queen, Tax Collector

Income colour per character (the gem colour on the card):
- King, Emperor, Patrician: noble (gold). Patrician takes a CARD, not gold.
- Bishop, Abbot, Cardinal: religious. Abbot takes gold OR cards. Cardinal takes CARDS.
- Merchant, Trader: trade (gold). Alchemist: none.
- Warlord, Diplomat, Marshal: military (gold).
- All others: none.

Crown: King, Emperor, Patrician (rank 4) take the crown. Only the rank-4 card
can never be a faceup discard.

## Basic districts: 54 cards, 11 military / 12 noble / 11 religious / 20 trade

Format: name, type, cost, copies.

Military (11):
- Watchtower, military, 1, 3
- Prison, military, 2, 3
- Barracks, military, 3, 3
- Fortress, military, 5, 2

Noble (12):
- Manor, noble, 3, 5
- Castle, noble, 4, 4
- Palace, noble, 5, 3

Religious (11):
- Temple, religious, 1, 3
- Church, religious, 2, 3
- Monastery, religious, 3, 3
- Cathedral, religious, 5, 2

Trade (20):
- Tavern, trade, 1, 5
- Market, trade, 2, 4
- Trading Post, trade, 2, 3
- Docks, trade, 3, 3
- Harbor, trade, 4, 3
- Town Hall, trade, 5, 2

Total: 3+3+3+2 + 5+4+3 + 3+3+3+2 + 5+4+3+3+3+2 = 11 + 12 + 11 + 20 = 54.

## Unique districts: exactly 30 cards, 14 are chosen into any one deck

Format: name, id, cost. Each has one copy.

1. Armory, armory, 3
2. Basilica, basilica, 6
3. Capitol, capitol, 5
4. Dragon Gate, dragon-gate, 6
5. Factory, factory, 5
6. Framework, framework, 4
7. Gold Mine, gold-mine, 6
8. Great Wall, great-wall, 6
9. Haunted Quarter, haunted-quarter, 5
10. Imperial Treasury, imperial-treasury, 5
11. Ivory Tower, ivory-tower, 5
12. Keep, keep, 3
13. Laboratory, laboratory, 5
14. Library, library, 6
15. Map Room, map-room, 5
16. Monument, monument, 4
17. Museum, museum, 4
18. Necropolis, necropolis, 5
19. Observatory, observatory, 5
20. Park, park, 6
21. Poor House, poor-house, 4
22. Quarry, quarry, 4
23. School of Magic, school-of-magic, 6
24. Secret Vault, secret-vault, 4
25. Smithy, smithy, 5
26. Stables, stables, 4
27. Statue, statue, 3
28. Theater, theater, 3
29. Thieves' Den, thieves-den, 4
30. Wishing Well, wishing-well, 3

### Unique district effects (the rulebook text, verbatim intent)

- Armory: on your turn you may destroy the Armory to destroy any one other player's district.
- Basilica: at end of game score 1 extra point per district of odd cost in your city.
- Capitol: at end of game, if you have at least 3 districts of one type, score 3 extra points (once).
- Dragon Gate: at end of game score 2 extra points.
- Factory: your other unique districts cost 1 less to build.
- Framework: you may build a district by destroying the Framework instead of paying its cost.
- Gold Mine: when you choose gold while gathering resources, take 1 extra gold.
- Great Wall: the Warlord pays 1 extra gold to destroy your districts; the Diplomat pays 1 extra to exchange them.
- Haunted Quarter: at final scoring, count it as a district of any one type you choose.
- Imperial Treasury: score 1 point per gold in your stash at end of game.
- Ivory Tower: if the Ivory Tower is your only unique district at end of game, score 5 extra points.
- Keep: the Warlord cannot destroy the Keep.
- Laboratory: once per turn, discard a card from your hand to take 2 gold.
- Library: when you choose to draw cards while gathering resources, keep both cards.
- Map Room: score 1 point per card in your hand at end of game.
- Monument: you cannot build the Monument if your city already has 5 or more districts; it counts as 2 districts when counting districts at end of game.
- Museum: once per turn, place a card from your hand under the Museum; score 1 point per card under it at end of game.
- Necropolis: instead of paying the Necropolis cost, destroy any one district in your city.
- Observatory: when you choose to draw cards while gathering resources, draw 3 and keep 1.
- Park: if you have no cards in hand at the end of your turn, draw 2 cards.
- Poor House: if you have no gold at the end of your turn, take 1 gold.
- Quarry: you may build a district already in your city; only one duplicate per city at a time.
- School of Magic: during resource gathering it counts as a district of any one type you choose.
- Secret Vault: the Secret Vault cannot be built; score 3 extra points if it is still in your hand at end of game.
- Smithy: once per turn, pay 2 gold to draw 3 cards.
- Stables: building the Stables does not count toward your building limit this turn.
- Statue: if you hold the crown at end of game, score 5 extra points.
- Theater: at the start of the round, exchange your character card for a random character card from another player.
- Thieves' Den: you may pay for the Thieves' Den with cards from your hand at 1 card = 1 gold.
- Wishing Well: score 1 extra point per unique district in your city at end of game.

## Setup numbers (per seat count)

- 4 players: 2 faceup discards, 1 facedown.
- 5 players: 1 faceup, 1 facedown.
- 6 players: 0 faceup, 1 facedown.
- 7 players: 0 faceup, 1 facedown (last player also takes the facedown card).
- With a rank-9 character in play, add 1 faceup discard (so 4p: 3 faceup, 5p: 2, 6p: 1).
- 2 players: 8 districts completes a city, each player drafts two characters, ranks 1-8 only (no Emperor).
- 3 players: 8 districts completes a city, each player drafts two characters, ranks 1-9.
- 4-8 players: 7 districts completes a city, one character each.

## Scoring (exact)

1. Sum the cost of every district in your city (a beautified district counts +1).
2. +3 if your city has at least one district of each of the five types.
3. +4 to the player who first completed a city.
4. +2 to every other player who completed a city.
5. Plus unique-district points.
Tie-break: the tied player who revealed the highest-numbered rank in the last
round wins.
