# Secret Hitler research for web implementation

## Overview

Secret Hitler is a hidden-role social deduction game for 5 to 10 players. Designers are Max Temkin, Mike Boxleiter, and Tommy Maranges. Artist is Mackenzie Schubert. Publisher is Goat, Wolf, & Cabbage, the Chicago studio behind the game, and the official site is secrethitler.com [WP, SITE]. Release is 2016 [WP]. The rulebook is licensed Creative Commons BY-NC-SA 4.0 and the official PDF is free [RB].

Two teams compete. The Liberal majority does not know anyone's role. The Fascist minority knows itself, and Hitler plays for the Fascists. Liberals win by enacting five Liberal Policies or by killing Hitler. Fascists win by enacting six Fascist Policies, or by getting Hitler elected Chancellor once three Fascist Policies are on the board [RB p2].

This file pins the rules a deterministic engine needs. Citation tags are [RB] for the official rulebook PDF, [PNP] for the official print-and-play PDF that carries the board power tables, [SITE] for secrethitler.com, and the tags listed in Sources for supporting reads. Every quote is from a fetched primary source unless it carries an explicit UNVERIFIED marker.

## 1. Player counts and role counts

The game supports 5 to 10 players [SITE, RB p2]. The rulebook's setup table gives the role distribution verbatim [RB p2]:

| Players | Liberals | Fascists (including Hitler) | Hitler | Fascists known by Hitler? |
| --- | --- | --- | --- | --- |
| 5 | 3 | 1 + Hitler | 1 | Yes |
| 6 | 4 | 1 + Hitler | 1 | Yes |
| 7 | 4 | 2 + Hitler | 1 | No |
| 8 | 5 | 2 + Hitler | 1 | No |
| 9 | 5 | 3 + Hitler | 1 | No |
| 10 | 6 | 3 + Hitler | 1 | No |

The table reads Fascists as 1+H, 2+H, or 3+H, where H is Hitler, so the Fascist number includes Hitler and Hitler is one of the Fascists [RB p2]. The party distribution is confirmed by the official rules and by the print-and-play board headers: 5 OR 6 PLAYERS: PLAY WITH 1 FASCISTS AND HITLER, 7 OR 8 PLAYERS: PLAY WITH 2 FASCISTS AND HITLER, 9 OR 10 PLAYERS: PLAY WITH 3 FASCISTS AND HITLER [PNP].

Who knows whom at setup [RB p3]:

- 5 and 6 players: the rulebook tells Fascist and Hitler to open their eyes and acknowledge each other. In these counts every Fascist knows Hitler and Hitler knows the Fascist.
- 7 to 10 players: all Fascists who are not Hitler open their eyes and acknowledge each other; Hitler keeps his eyes closed and puts a thumb up; the Fascists take note of the extended thumb. So the Fascists know each other and know Hitler, and Hitler does not learn who the Fascists are.
- Liberals learn nothing about anyone at setup.

The board headers restate this: the 5-6 board reads HITLER KNOWS WHO THE FASCIST IS, and the 7-8 and 9-10 boards read HITLER DOESN'T KNOW WHO THE FASCISTS ARE [PNP].

The overview text says the same in general terms: the Fascists know Hitler's identity from the outset, but Hitler doesn't know the Fascists and must work to figure them out [RB p2]. That general sentence holds for 7-10 and is overridden for 5-6 by the explicit setup instruction.

## 2. Policy deck, hand mechanics, and reshuffle

The deck is 17 Policy tiles: 6 Liberal and 11 Fascist [RB p2, components panel: 17 Policy tiles (6 Liberal, 11 Fascist)]. Setup says to shuffle the 11 Fascist Policy tiles and the 6 Liberal Policy tiles into a single Policy deck and place that deck face down on the Draw pile card [RB p2]. The deck is one mixed pile, not two.

A Legislative Session runs as a draw-three, discard-one, pass-two, discard-one, enact-one sequence [RB p4]:

1. The President draws the top three tiles from the Policy deck, looks at them in secret, and discards one tile face down into the Discard pile.
2. The remaining two tiles go to the Chancellor, who looks in secret, discards one Policy tile face down, and enacts the remaining Policy by placing the tile face up on the corresponding track.

So each successful session removes three tiles from the deck and puts two into the Discard pile. The enacted tile goes face up on its Liberal or Fascist track [RB p4]. Discarded tiles should never be revealed to the group, and the President and Chancellor may lie about what they saw [RB p4].

The veto sequence applies from the fifth Fascist Policy onward [RB p6]. The President draws three and discards one as usual, then passes the remaining two. Then the Chancellor may, instead of enacting either Policy, say I wish to veto this agenda. If the President consents by saying I agree to the veto, both Policies are discarded and the President placard passes to the left as usual. If the President does not consent, the Chancellor must enact a Policy as normal. A used veto discards all three tiles and advances the Election Tracker by one [RB p6].

Reshuffle trigger and rule [RB p4, RB p5]:

- At the end of a Legislative Session, if there are fewer than three tiles remaining in the Policy deck, shuffle them with the Discard pile to create a new Policy deck.
- On the chaos enactment after three failed elections, if there are fewer than three tiles remaining in the Policy deck at this point, shuffle them with the Discard pile to create a new Policy deck.
- Reshuffle is of the remaining deck tiles plus the Discard pile, both hidden. Unused Policy tiles should never be revealed, and they should not be simply placed on top of the new Policy deck [RB p5].

The trigger is fewer than three, evaluated after the session or before the chaos draw, so the engine reshuffles when the deck holds 0, 1, or 2 tiles at that check [RB p4, RB p5].

## 3. Election track and voting

A round has three stages in order: Election, Legislative Session, and Executive Action if a power was granted [RB p3]. The Election has three steps [RB p3, RB p4].

Step 1, pass the candidacy: at the beginning of a new round, the President placard moves clockwise to the next player, who is the new Presidential Candidate [RB p3].

Step 2, nominate a Chancellor: the Presidential Candidate chooses a Chancellor Candidate by passing the Chancellor placard to any other eligible player [RB p3]. Eligibility is the term-limit rule [RB p3, RB p4]:

- The last elected President and Chancellor are term-limited, and ineligible to be nominated as Chancellor Candidate.
- Term limits apply to the President and Chancellor who were last elected, not to the last pair nominated.
- Term limits only affect nominations to the Chancellorship; anyone can be President, even someone who was just Chancellor.
- If there are only five players left in the game, only the last elected Chancellor is ineligible to be Chancellor Candidate; the last President may be nominated.

The Special Election and the Election Tracker also change eligibility, covered below and in section 4 [RB p3].

Step 3, vote [RB p4]:

- Every player, including the Candidates, votes on the proposed government. Executed players may not vote [RB p4, RB p5].
- Ballot cards are revealed simultaneously so that everyone's vote is public.
- If the vote is a tie, or if a majority of players votes no, the vote fails. A tie fails, and a majority of no votes fails. A majority of yes votes passes.
- On failure: the Presidential Candidate misses this chance to be elected, and the President placard moves clockwise to the next player. The Election Tracker is advanced by one Election.
- On success: the Presidential Candidate and Chancellor Candidate become the new President and Chancellor, respectively. Then, if three or more Fascist Policies are already enacted, the Hitler check runs (section 6).

The Election Tracker [RB p4]:

- If the group rejects three governments in a row, the country is thrown into chaos. Immediately reveal the Policy on top of the Policy deck and enact it.
- Any power granted by this Policy is ignored, but the Election Tracker resets, and existing term-limits are forgotten. All players become eligible to hold the office of Chancellor for the next Election.
- If there are fewer than three tiles remaining in the Policy deck at this point, shuffle them with the Discard pile to create a new Policy deck.
- Any time a new Policy tile is played face-up, the Election Tracker is reset, whether it was enacted by an elected government or enacted by the frustrated populace.
- A used veto also advances the tracker by one, and each use of the Veto Power represents an inactive government [RB p6].

So the tracker counts consecutive failed elections plus veto uses. Three advances trigger the chaos draw, and any face-up enactment resets it to zero [RB p4, RB p6].

## 4. Presidential power table

When a Fascist Policy is enacted, the President may receive a single-use power that must be used before the next round can begin [RB p2, RB p5]. The power is the one printed on the Fascist board at that Fascist-policy count for the current player count [PNP]. The table, cross-checked from the official print-and-play boards [PNP] and the fetched rule summaries [SR, SHIO]:

| Fascist policy count | 5-6 players | 7-8 players | 9-10 players |
| --- | --- | --- | --- |
| 1st | none | none | Investigate Loyalty |
| 2nd | none | Investigate Loyalty | Investigate Loyalty |
| 3rd | Policy Peek | Special Election | Special Election |
| 4th | Execution | Execution | Execution |
| 5th | Execution (and Veto unlocks) | Execution (and Veto unlocks) | Execution (and Veto unlocks) |

The 5-6 board shows Policy Peek once (THE PRESIDENT EXAMINES THE TOP THREE CARDS) and Execution twice [PNP 5-6 board]. The 7-8 board shows Investigate once (THE PRESIDENT INVESTIGATES A PLAYER'S IDENTITY CARD), Special Election once (THE PRESIDENT PICKS THE NEXT PRESIDENTIAL CANDIDATE), and Execution twice [PNP 7-8 board]. The 9-10 board shows Investigate twice, Special Election once, and Execution twice [PNP 9-10 board]. The ordering by count matches the fetched rule summaries [SR, SHIO]. If the physical boards ever disagree with this table, the printed board is the authority [RB p2, PNP].

Resolution of each power, quoted from the rulebook [RB p5]:

- Investigate Loyalty: the President chooses a player to investigate; that player hands over their Party Membership card (not the Secret Role card), the President checks the loyalty in secret, and returns the card. The President may share or lie about the result. No player may be investigated twice in the same game. The President sees the Party Membership card only, which reads Liberal or Fascist; Hitler's reads Fascist, so the President cannot tell Hitler from an ordinary Fascist [RB p2, RB p5].
- Call Special Election: the President chooses any other player to be the next Presidential Candidate by passing that player the President placard. Any player can become President, even a term-limited one. The new President nominates an eligible Chancellor Candidate and the Election proceeds as usual. A Special Election does not skip any players, and afterward the President placard returns to the left of the President who enacted the Special Election. The rulebook warns that passing to the next player in rotation lets that player run twice in a row [RB p5].
- Policy Peek: the President secretly looks at the top three tiles in the Policy deck and then returns them to the top of the deck without changing the order [RB p5].
- Execution: the President executes one player by saying I formally execute that player. If that player is Hitler, the game ends in a Liberal victory. If the executed player is not Hitler, the table should not learn whether a Fascist or a Liberal has been killed. Executed players are removed from the game and may not speak, vote, or run for office [RB p5].

Visibility per power: Investigate and Policy Peek are private to the President, who may lie about them. Execution is public, and only the target's team stays hidden. The Special Election is public. The rulebook's lying note says a player may always lie about hidden knowledge, with one exception, that Hitler must answer truthfully in the game-ending Hitler scenarios [RB p5].

Powers are single-use and do not stack or carry over: Presidential Powers are used only once; they don't stack or roll over to future turns [RB p5]. The President must use the power before the next round can begin, and a power from a chaos enactment is ignored [RB p4, RB p5].

## 5. Fascist board limits per player count

The Fascist board prints, per Fascist-policy count, either a power or a blank space, and the fascist win line at six policies [PNP]. The power counts are in section 4. The win line is the same at every player count: six Fascist Policies [RB p2]. Veto unlocks at five Fascist Policies at every count [RB p6]. The Liberal win line is five Liberal Policies at every count [RB p2].

So per count: the first power lands at the 2nd Fascist policy for 7-8, at the 1st Fascist policy for 9-10, and at the 3rd Fascist policy for 5-6; the board reaches six Fascist slots in every case [PNP].

## 6. Win conditions and the Hitler-Chancellor trigger

Liberal win, either [RB p2]:

- Five Liberal Policies are enacted.
- Hitler is assassinated (Execution resolves this, section 4).

Fascist win, either [RB p2]:

- Six Fascist Policies are enacted.
- Hitler is elected Chancellor any time after the third Fascist Policy has been enacted.

The Hitler-Chancellor trigger fires inside the Election step, after a yes vote [RB p4]: if three or more Fascist Policies have been enacted already, ask if the new Chancellor is Hitler; if so, the game is over and the Fascists win; otherwise other players know for sure the Chancellor is not Hitler.

So the trigger requires at least three Fascist Policies on the board at the moment the new Chancellor takes office, and the new Chancellor must be Hitler [RB p2, RB p4]. The rulebook's strategy note stresses this is the main Fascist win path [RB p6]. Hitler must answer the are-you-Hitler question truthfully, and this is the one place lying is forbidden [RB p5].

## 7. Hidden-information facts

Two cards carry a player's identity [RB p2, RB p5]:

- Secret Role card: Liberal, Fascist, or Hitler. A player sees only their own, in secret [RB p2].
- Party Membership card: Liberal or Fascist. Hitler's shows Fascist and gives no hint of the special role [RB p2]. This is the card Investigate Loyalty reads [RB p5].

What each role knows:

- Liberal: nothing about other players at setup. Learns only from play and from powers [RB p2].
- Ordinary Fascist: knows the other Fascists and knows Hitler at every count, except that in 5-6 the only other Fascist is Hitler [RB p2, RB p3].
- Hitler: in 5-6 knows the Fascist; in 7-10 knows no Fascist and must infer them [RB p2, RB p3].

Private during play:

- The President's three drawn tiles and the Chancellor's two are hidden from the table [RB p4].
- Discarded tiles are never revealed; the President and Chancellor may lie about them [RB p4].
- Investigate Loyalty reveals one Party Membership card to the President alone, and the President may lie about it [RB p5].
- Policy Peek shows the top three tiles to the President alone [RB p5].
- Execution does not reveal the victim's team unless the victim was Hitler [RB p5].

Public during play:

- Every vote is public and simultaneous [RB p4].
- Every enacted Policy is face up on its track [RB p4].
- Who holds the President and Chancellor placards is public [RB p3].
- Which players are executed is public [RB p5].
- The Election Tracker position is public [RB p4].

## 8. Extensions, sequels, promos, and official variants

A published expansion exists. It is Secret Hitler: The Trump Pack, by Goat, Wolf, & Cabbage, released 2017, art by Mackenzie Schubert [TP, BGG-TP]. It adds five alternate Secret Role cards featuring Donald Trump and members of his administration as of 6/7/2017, plus a bonus Mike Pence card [TP, BGG-TP]. It is alternate artwork for the existing roles, the source states it requires the base game, and it adds no rules [TP]. Full details are in extension-secret-hitler-2.md.

There is no published sequel. A search for Secret Hitler 2 returns only a No Rolls Barred YouTube video title and a Paradox forum roleplay thread, not a product [YT-NRB, PPDX]. No publisher page, rulebook, or product listing for a Secret Hitler 2 or Secret Hitler II exists. Treat Secret Hitler 2 as not a real product.

No official print-and-play variant, promo role set, or alternate-rules expansion was found from the publisher. The official print-and-play PDF is the base game, not a variant [PNP].

Common unofficial variants, marked UNOFFICIAL:

- UNOFFICIAL. Secret Hitler XL, the Communist expansion, is a fan-made expansion that adds Communist, Capitalist, Monarchist, and Anarchist roles and scales past 10 players [XL, DICEBREAKER]. Not a Goat, Wolf, & Cabbage product.
- UNOFFICIAL. The rebalanced setup is a variant in the secrethitler.io web adaptation, not in the rulebook: 6-player games start with one Fascist Policy already enacted, 7-player games start with 10 Fascist Policies in the deck instead of 11, and 9-player games start with 9 Fascist Policies [SHIO]. The official rulebook has no such rule [RB].
- UNOFFICIAL. Double Agent and Secret Voldemort are fan expansions seen on BoardGameGeek threads, not publisher products [BGG-DA, BGG-VOL].

## Rule gaps

Each item is a place the primary sources are silent or ambiguous. The question an implementer must decide follows.

1. The board power table is read from the print-and-play artwork, not from rulebook body text. The rulebook body lists the four powers but never states which count grants which power; that lives only on the printed boards [RB p5, PNP]. Question: does the engine encode the board table exactly as section 4, and does it fail loudly if a board image contradicts it?

2. The reshuffle trigger timing for the chaos draw. The rulebook says to reshuffle when fewer than three tiles remain at that point, meaning at the moment of the chaos enactment, after revealing the top tile [RB p4]. Question: does the engine reveal the top tile first and then test the remaining count, or test before the reveal? The two orders differ when exactly three tiles remain before the reveal.

3. Whether the Election Tracker reset and the term-limit reset are one event. The rulebook says a chaos enactment resets the tracker and forgets term limits, and a face-up policy resets the tracker [RB p4]. It does not say a face-up policy also forgets term limits. Question: does only the chaos event clear term limits, or does any reset clear them? The plain reading is that only the chaos event clears term limits.

4. The Special Election placard return. The rulebook says the placard returns to the left of the President who enacted the Special Election and separately warns a special election does not skip any players [RB p5]. Question: after the special-election round ends, does the next normal President continue from the special-election President, or from the original rotation point? The rulebook's own note implies the rotation resumes as if the special election had not happened.

5. Whether Hitler knows the Fascists in a 5-6 game is stated two ways. The overview sentence says Hitler does not know the Fascists [RB p2], but the 5-6 setup instruction has Hitler and the Fascist acknowledge each other [RB p3]. Question: does the engine follow the per-count setup instruction (Hitler knows, at 5-6) and treat the overview sentence as the general 7-10 case?

6. Executed-player voting and the all-eligible-voters rule. The rulebook says every player votes and executed players may not vote [RB p4, RB p5]. It does not state the majority denominator once players are executed. Question: is a majority of the living players, or a majority of the seats at the table? The plain reading is a majority of the living, voting players.

7. The exact seat direction of clockwise versus to the left. The rulebook uses clockwise for the candidate rotation and to the left for the veto and special-election placard moves [RB p3, RB p5, RB p6]. These are consistent only if clockwise is the same direction as left, which the rulebook never defines. Question: does the engine define a single canonical rotation direction and map both phrases to it?

8. No rule covers an empty Policy deck at the moment of a draw. The reshuffle triggers are at the end of a Legislative Session and at the chaos draw [RB p4, RB p5]. Question: if a session begins with fewer than three tiles in the deck, does the engine reshuffle before the President draws? The plain reading is yes, because a session cannot draw three from a smaller deck.

9. Whether the no-player-investigated-twice ban is per President or global. The rulebook says no player may be investigated twice in the same game, which reads as global across all Presidents [RB p5]. Question: does the engine track investigated targets for the whole game rather than per President? The plain reading is global.

10. The exact content of the Trump Pack roles is not fully specified. The source states five alternate Secret Role cards plus a bonus Mike Pence card but does not name all six faces [TP, BGG-TP]. Question: does the engine treat the pack as alternate art only, with no role or rule change? The source says it is alternate artwork for the existing roles [TP].

## Sources

Tag, URL, what it is, and what it supports. All URLs fetched this session.

- [RB] https://www.secrethitler.com/assets/Secret_Hitler_Rules.pdf. Official Secret Hitler rulebook PDF, Goat, Wolf, & Cabbage, 7 pages, hosted on the official site. Fetched 2026-10-13. Source of the objective, components and counts, setup, the role-reveal instructions, the election steps, term limits, voting, the Election Tracker, the Legislative Session, the Executive Action, the four powers, the veto, the win conditions, and the lying rule. Page numbers in citations are the PDF pages.
- [PNP] https://www.secrethitler.com/assets/Secret_Hitler_Print_and_Play.pdf. Official print-and-play PDF, 13 pages, hosted on the official site. Fetched 2026-10-13. Source of the three Fascist board power tables (pages 11, 12, 13) and the board header text for each player count. Board text was extracted by OCR of the rendered pages because the board text is outlined artwork.
- [SITE] https://www.secrethitler.com/. Official site. Fetched 2026-10-13. Player count 5-10, publisher identity, Creative Commons license, and the availability FAQ answers.
- [WP] https://en.wikipedia.org/wiki/Secret_Hitler. Wikipedia article. Fetched 2026-10-13. Designer credits, illustrator, publisher, release date 2016-08-25, and the 5-6 versus 7-plus Hitler-knowledge summary. Used only for product identity, not for rule text.
- [SHIO] http://web.archive.org/web/20240415212438id_/https://secrethitler.io/rules. Archived rules page of the secrethitler.io web adaptation, fetched 2026-10-13. Source of the role-table cross-check and the optional rebalanced setup variant for 6, 7, and 9 players. The live page returned bot_blocked, so the archive copy was read.
- [SR] https://service-rat.com/secret-hitler-rules. Fetched 2026-10-13. Cross-check of the role table and the presidential power table. Secondary source, used only where it agrees with the official boards.
- [TP] https://trumppack.deals/. The Trump Pack product page. Fetched 2026-10-13. States five alternate Secret Role cards, the bonus Mike Pence card, the artist, the base-game requirement, and that the cards are alternate artwork.
- [BGG-TP] http://web.archive.org/web/20241117062955id_/https://boardgamegeek.com/boardgameaccessory/228781/secret-hitler-the-trump-pack. Archived BoardGameGeek accessory page for Secret Hitler: The Trump Pack. Fetched 2026-10-13. Confirms publisher Goat Wolf & Cabbage, year 2017, artist Mackenzie Schubert, and the Trump-administration description. BGG blocked the live fetch.
- [XL] https://makerworld.com/en/models/1052392-secret-hitler-xl-communist-expansion and https://www.scribd.com/document/586815181/Secret-Hitler-XL-Rules. Fetched 2026-10-13. Fan-made Secret Hitler XL Communist expansion. UNOFFICIAL.
- [DICEBREAKER] https://www.dicebreaker.com/games/secret-hitler. Fetched 2026-10-13. Reports the Communist expansion as fan-created.
- [YT-NRB] https://www.youtube.com/watch?v=oW4xOXiu820. No Rolls Barred Secret Hitler II video. Fetched 2026-10-13. Shows Secret Hitler II is a video title, not a product.
- [PPDX] https://forum.paradoxplaza.com/forum/threads/secret-hitler-ii.903147/. Paradox Interactive forum roleplay thread titled Secret Hitler II. Fetched 2026-10-13. Not a product.
- [BGG-DA] https://boardgamegeek.com/thread/2287710/double-agent-expansion. BoardGameGeek thread. Seen via search snippet, page not fetched directly. Fan-made Double Agent expansion. UNOFFICIAL.
- [BGG-VOL] https://boardgamegeek.com/boardgame/188834/secret-hitler. BoardGameGeek entry. Live fetch blocked; used only to confirm the game id. A comment mentions a fan-made Secret Voldemort version. UNOFFICIAL.

## Gotchas for web implementation

The role table and the reveal rule interact. At 5-6, Hitler knows the Fascist. At 7-10, Hitler does not. Encode both from the per-count setup instruction, not the general overview sentence [RB p2, RB p3].

The deck is one mixed pile of 17, reshuffled from the discard when fewer than three tiles remain at the two check points. Two tiles leave the deck per session into the discard [RB p2, RB p4].

A tie vote fails. There is no tiebreak [RB p4].

Three consecutive failed elections or veto uses trigger the chaos draw, which enacts a policy with no power, resets the tracker, and forgets term limits [RB p4, RB p6].

The Hitler-Chancellor win needs three Fascist Policies already enacted when a yes vote seats a new Chancellor who is Hitler [RB p4].

Investigate reads the Party Membership card, not the Secret Role card, so it cannot separate Hitler from an ordinary Fascist, and no player may be investigated twice [RB p5].
