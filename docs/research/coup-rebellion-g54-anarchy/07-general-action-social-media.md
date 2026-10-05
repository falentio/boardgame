# 07 General Action Social Media

## Social Media

Type is general action. It comes from a role action card that plays as a general action.
Action is take 1 card from the deck and return 1 card to the deck. It cannot be challenged and cannot be blocked.
Setup rule is when Social Media is selected during the draft, it moves to the general action area and the table draws one additional Communications role. The game still needs a Communications role.
Edge cases are Social Media is always available once in play, like Income and Coup. It needs no role claim. It cannot be challenged, so there is no challenge window. It cannot be blocked, so there is no block window. It swaps a card with the deck, so deck size is unchanged. It can be used to dig for a role the player wants or to dump a card they no longer want to hold.
Web notes need a swap UI that shows the drawn card to the actor only, then lets the actor return 1 card. No challenge or block window. Deck count stays public. Contents stay hidden. Social Media is a general action, so the action menu must show it alongside Income and Coup.

## Bank

Type is general action card. It comes out only with Financier.
Action is take 1 coin from Treasury and add 1 coin to the Bank pile. It cannot be challenged and cannot be blocked.
Setup rule is when Financier is in play, the Bank card replaces the Income card for the whole game.
Edge cases are Bank replaces Income entirely. While Financier is in play there is no Income action. Bank grows a public pile that Financier can sweep. The pile has no cap. Bank cannot be blocked or challenged. A player who wants steady income keeps using Bank, which also feeds the Financier.
Web notes need the Income button replaced by Bank. Show the Bank pile as public state. Add 1 coin to the pile on each Bank action. Financier empties it. The forced Coup rule still counts the player's own coins, not the Bank pile.

## General Action Implementation Checklist

Social Media needs a hidden swap with no challenge or block window, and the setup must draw the extra Communications role. Bank needs the Income swap, a public pile counter, and a clean removal of the Income action while Financier is in play. Both are general actions, so neither opens a challenge window.
