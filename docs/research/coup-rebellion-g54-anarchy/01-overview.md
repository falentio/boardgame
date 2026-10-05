# 01 Overview

## Identity

Name is Coup Rebellion G54 Anarchy. Short name is Anarchy. Designer is Rikki Tahta. Publisher is Indie Boards and Cards. La Mame Games publishes the twin edition Coup Guatemala 1954 Anarchy. Year is 2016. It is an expansion. It is not standalone. Base Coup Rebellion G54 is required. Art is political dystopia themed, matching base G54.

It adds to the base game. It does not replace it. Rules are the base rules with the exceptions listed in this folder.

## Player Count and Session

Same as base G54. Standard is 3 to 6 players. Best with 4 to 6. Session is about 15 to 20 minutes with a known role set. Anarchy roles add table talk and sub turns, so games run slightly longer than base G54. Age rating is 14 plus. Difficulty is higher than base G54 because every Anarchy role is advanced.

## Win Condition

Last player with influence wins. Influence means at least one face down influence card. There is no scoring. There is no second place. Same as base G54.

## Core Loop

Unchanged from base G54. One action per turn. No passing. Action is general or role claimed. General actions are Income or Bank if Financier is in play, Coup, and Social Media if it was selected. Claim does not require proof unless challenged. Counteractions may be claimed and challenged. Costs already paid are not refunded on a block.

## What Anarchy Adds

Six roles. Force gains Anarchist and Paramilitary. Finance gains Financier and Plantation Owner. Special Interest gains Arms Dealer and Socialist. Communications gains no role.

One general action. Social Media swaps a card with the deck and cannot be challenged or blocked. It takes the Communications slot and forces one extra Communications role into the draft.

One general action card. Bank replaces Income for the whole game while Financier is in play. Bank takes 1 coin and grows a public pile that Financier can sweep.

One token. Bomb. Only Anarchist uses it.

## Relation to Base G54

Anarchy role action cards are added to the base category piles. The draft rule is unchanged. The base 25 roles and the 6 Anarchy roles share one pool after mixing.

Anarchy keeps the self block rule. Paramilitary is blocked by Paramilitary. Anarchist is special because it can be used without holding the card.

Anarchy does not add cross role blocks. It adds a card swap general action and a growing coin pile. It also adds the first pass loop in the system, the Bomb.

Anarchy does not change the 10 coin forced Coup, the 7 coin Coup, or the hidden hand rules.

## Implementation Scope

The web version must merge Anarchy role cards into the base category piles. It must handle the Social Media special setup, the Financier Income swap, the Bomb sub turn, the Socialist card redistribution, the Plantation Owner mass payout, and the Arms Dealer deck reveal.

The base folder `docs/research/coup-rebellion-g54` owns the base engine. This folder owns only what Anarchy adds. Read both before building.
