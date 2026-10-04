# 05 Roles Communications

All Communications roles manipulate cards. One is active per game. Only Producer has a block. All may be challenged.

## Director

Category is Communications. Basic role. Starter role. Ambassador equivalent.
Action is draw 2 cards from Court, then return any 2 cards to Court. No coins. No target. No token.
Counteraction is none.
Web notes are standard swap UI. Show 2 drawn plus current hidden hand. Player picks 2 to keep. Shuffle return. No information leak to others except counts.

## Newscaster

Category is Communications.
Action is pay 1 coin to Treasury, take 3 cards from Court, return any 3 to Court. Net hand filtering without hand size change.
Counteraction is none.
Edge cases are insufficient Court cards allow partial. Paid coin is not refunded if claim is blocked, but there is no block, so only challenge failure refunds it.
Web notes need pay gate before draw. Show 3 drawn plus hand. Return 3. Strong with 6 players because deck knowledge grows fast. Consider hiding deck count only, not contents.

## Producer

Category is Communications. Strongest card advantage plus disruption.
Action is take 1 card from Court and 1 card from any target. Target chooses which card to give. Then return 1 card to Court and 1 card to target. Active player ends with same hand size but filtered. Target ends with same hand size but may lose a good role.
Counteraction is block Producer. Only target may block. Successful block prevents the exchange. Costs if any stay paid, but Producer has no coin cost.
Edge cases are target with 1 card gives that card. Target chooses, not active player. Returned card to target may be any card from active player's post draw selection, including the taken card or a Court card.
Web notes need target picker, target card choice UI hidden from others, then active player keep and return UI. Needs block window for target only.

## Reporter

Category is Communications. Hybrid income plus filter.
Action is take 1 coin from Treasury and draw 1 card from Court, then return 1 card to Court. Net plus 1 coin plus card filter.
Counteraction is none.
Web notes are simple. Coin plus one card swap. Good pairing with Mercenary because card knowledge helps time the delayed kill.

## Writer

Category is Communications. Deep deck dig.
Action is draw 1 card from Court, then optionally pay 1 coin per extra card drawn. Repeat as long as affordable. Then return the same number of cards to Court. Example is draw 1 free, pay 2 for 2 more, return 3.
Counteraction is none.
Edge cases are player may stop at any time. Deck may empty mid dig. Allow partial. Paid coins stay paid even if player gains little.
Web notes need iterative draw UI with stop button and running cost. Show spent total. With 4 to 5 coins a player can see most of a small Court deck. This reduces bluffing. That is intended. Pairing Writer with Mercenary or Spy is strong.

## Communications Implementation Checklist

All swaps must preserve hidden hands server side. Never send full hands to clients except owner. Drawn cards go only to actor. Return shuffle must be random. Deck count is public. Deck contents are hidden. Producer needs two way hidden exchange. Writer needs loop with pay per card. Newscaster needs pay gate.
