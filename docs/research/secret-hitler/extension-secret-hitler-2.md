# Secret Hitler extensions and variants research for web implementation

## Overview

This file pins every published extension, sequel, promo, and official variant of Secret Hitler, and lists the common unofficial variants clearly marked as such. The base game is pinned in rules.md.

Secret Hitler has exactly one published extension: Secret Hitler: The Trump Pack, a promo card pack by Goat, Wolf, & Cabbage released in 2017 [TP, BGG-TP]. It adds alternate Secret Role cards only and changes no rule [TP].

Secret Hitler has no published sequel. The name Secret Hitler 2, and the Roman-numeral Secret Hitler II, do not name a product. They appear only as a No Rolls Barred video title and a forum roleplay thread [YT-NRB, PPDX].

Secret Hitler has no official print-and-play variant and no official alternate-rules expansion. The official print-and-play PDF is the base game, not a variant [PNP].

## Secret Hitler: The Trump Pack

Name is Secret Hitler: The Trump Pack [BGG-TP]. Publisher is Goat Wolf & Cabbage [BGG-TP]. Artist is Mackenzie Schubert, the base game's artist [BGG-TP, TP]. Year is 2017, released in June of 2017 [BGG-TP, TP]. It is a board game accessory, an alternate-art card pack, not a standalone game [BGG-TP].

Contents: five alternate Secret Role cards featuring Donald Trump and prominent members of his administration as of 6/7/2017, plus a bonus Mike Pence card [TP, BGG-TP]. The card faces are Trump, Pence, Bannon, Spicer, and Miller [EBAY, WP-DRUM]. The Pence card is a bonus, described as suitable for use in case of impeachment or resignation [TP, BGG-TP].

Rules changed or added: none. The pack is alternate artwork for the existing Secret Role cards. The product page states these are official alternate artwork cards by the base game's artist for Secret Hitler and that they require the base game to play [TP]. No new role text, no new policy, and no new win condition is published with the pack [TP, BGG-TP].

Implementation effect: the engine treats the pack as a cosmetic skin over the existing roles. The role counts, the deck, the election, the powers, and the win conditions are unchanged from the base game [TP, RB].

Availability: out of print as of the last retail listing [NOBLE]. A share of the original proceeds went to the ACLU [TP].

## No published sequel

There is no Secret Hitler 2. A search for the exact phrase returns a No Rolls Barred video titled Secret Hitler II and a Paradox Interactive forum roleplay thread titled Secret Hitler II, neither of which is a published product [YT-NRB, PPDX]. No Goat, Wolf, & Cabbage page, no rulebook, and no product listing for a sequel exists [SITE].

Verdict: Secret Hitler 2 and Secret Hitler II are not real products. Do not build an engine path for them.

## No official variant

No official variant, promo role set, or alternate-rules expansion was found from the publisher. The official print-and-play PDF is the base game under the same rules [PNP]. The official site lists no variant [SITE].

## Common unofficial variants

These are widely documented but are not publisher products. Each is marked UNOFFICIAL.

Secret Hitler XL, the Communist expansion. UNOFFICIAL. A fan-made expansion that adds a Communist faction plus Capitalist, Monarchist, and Anarchist roles and scales the game past 10 players, up to 19 or 20 [XL, DICEBREAKER]. It has its own fan rules document [XL]. It is not sold by Goat, Wolf, & Cabbage.

The rebalanced setup. UNOFFICIAL. This is a variant in the secrethitler.io web adaptation, not in the rulebook [SHIO]. It applies only to 6, 7, and 9 players: a 6-player game starts with one Fascist Policy already enacted; a 7-player game starts with 10 Fascist Policies in the deck instead of 11; a 9-player game starts with 9 Fascist Policies in the deck [SHIO]. The official rulebook has no such rule and its deck is always 6 Liberal and 11 Fascist [RB p2]. If the engine offers this, gate it behind an explicit rebalance flag and default it off.

Double Agent. UNOFFICIAL. A fan expansion adding a Liberal double agent role, described on a BoardGameGeek thread [BGG-DA]. Not a publisher product.

Secret Voldemort. UNOFFICIAL. A fan re-theme of Secret Hitler, mentioned on the BoardGameGeek entry [BGG-VOL]. Not a publisher product.

## Rule gaps

1. The complete face list of the Trump Pack. The pack is documented as five alternate Secret Role cards plus a bonus Mike Pence card, and retail listings name Trump, Pence, Bannon, Spicer, and Miller, but the publisher page does not print all faces in one place [TP, EBAY, WP-DRUM]. Question: does the engine ship the pack as a fixed five-card skin, and which role does each face reskin?

2. Whether the Pence card replaces a role or is a spare. The source calls Pence a bonus card suitable for use in case of impeachment or resignation, which reads as an extra card rather than a replacement [TP, BGG-TP]. Question: does the engine treat Pence as a sixth cosmetic face or as a spare for the Trump face?

3. The exact rules of every unofficial variant. Secret Hitler XL has a fan rules document but it is a secondary, fan-authored source and was not fetched in full [XL]. Question: if the engine ever supports unofficial variants, does it treat their text as UNVERIFIED until checked against the fan documents directly?

## Sources

Tag, URL, what it is, and what it supports. All URLs fetched this session unless marked.

- [TP] https://trumppack.deals/. The Trump Pack product page. Fetched 2026-10-13. States five alternate Secret Role cards, the bonus Mike Pence card, the artist, the base-game requirement, the alternate-artwork framing, and the ACLU donation.
- [BGG-TP] http://web.archive.org/web/20241117062955id_/https://boardgamegeek.com/boardgameaccessory/228781/secret-hitler-the-trump-pack. Archived BoardGameGeek accessory page. Fetched 2026-10-13. Confirms the name, publisher Goat Wolf & Cabbage, year 2017, artist Mackenzie Schubert, and accessory type. BGG blocked the live fetch.
- [NOBLE] https://www.nobleknight.com/P/2148257692/Secret-Hitler---The-Trump-Pack. Retail listing. Fetched 2026-10-13. Confirms the five-card description and out-of-print status.
- [EBAY] https://www.ebay.com/itm/178319115443. Retail listing naming the five promo faces. Seen via search snippet, page not fetched directly. UNVERIFIED for the exact face list.
- [WP-DRUM] https://www.worthpoint.com/worthopedia/secret-hitler-donald-trump-promo-card-1872597369. Auction archive naming Trump, Pence, Bannon, Spicer, and Miller. Seen via search snippet, page not fetched directly. UNVERIFIED for the exact face list.
- [YT-NRB] https://www.youtube.com/watch?v=oW4xOXiu820. No Rolls Barred Secret Hitler II video. Fetched 2026-10-13. Shows Secret Hitler II is a video title, not a product.
- [PPDX] https://forum.paradoxplaza.com/forum/threads/secret-hitler-ii.903147/. Paradox Interactive forum roleplay thread. Fetched 2026-10-13. Not a product.
- [XL] https://makerworld.com/en/models/1052392-secret-hitler-xl-communist-expansion and https://www.scribd.com/document/586815181/Secret-Hitler-XL-Rules. Fetched 2026-10-13. Fan-made Secret Hitler XL Communist expansion. UNOFFICIAL.
- [DICEBREAKER] https://www.dicebreaker.com/games/secret-hitler. Fetched 2026-10-13. Reports the Communist expansion as fan-created.
- [SHIO] http://web.archive.org/web/20240415212438id_/https://secrethitler.io/rules. Archived rules page of the secrethitler.io web adaptation. Fetched 2026-10-13. Source of the rebalanced setup variant.
- [BGG-DA] https://boardgamegeek.com/thread/2287710/double-agent-expansion. BoardGameGeek thread. Seen via search snippet, page not fetched directly. Fan-made Double Agent expansion. UNOFFICIAL.
- [BGG-VOL] https://boardgamegeek.com/boardgame/188834/secret-hitler. BoardGameGeek entry. Live fetch blocked. Mentions a fan-made Secret Voldemort version. UNOFFICIAL.
- [RB] https://www.secrethitler.com/assets/Secret_Hitler_Rules.pdf. Official rulebook PDF. Fetched 2026-10-13. Source of the base deck and the base rules the extension does not change.
- [PNP] https://www.secrethitler.com/assets/Secret_Hitler_Print_and_Play.pdf. Official print-and-play PDF. Fetched 2026-10-13. The base game, not a variant.
- [SITE] https://www.secrethitler.com/. Official site. Fetched 2026-10-13. Lists no variant and no sequel.

## Gotchas for web implementation

The Trump Pack changes no rule. Ship it as a cosmetic skin and keep the base engine untouched [TP, RB].

There is no Secret Hitler 2. Do not add a product path for it [YT-NRB, PPDX].

The rebalanced setup is a web-app variant, not a rulebook rule. Default it off and label it unofficial [SHIO, RB p2].

Secret Hitler XL and the other fan expansions are unofficial. If supported at all, gate them behind an explicit unofficial flag and treat their text as UNVERIFIED until read from the fan documents directly [XL, BGG-DA, BGG-VOL].
