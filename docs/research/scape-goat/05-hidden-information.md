# 05 Hidden Information

## What is secret

The back of your own player mat is hidden from all other players at all times [RB, RP]. The rulebook states this as an ongoing rule and not only as a setup rule [RB]. The suspect designation on the mat is the only per-player secret [RB, RP].

Face-down cards are hidden. The three facedown Stash cards are hidden from everyone, including during the Stash action. The rulebook says to pick one of the facedown cards and add it to your hand with no reveal step, so the acting player takes it unseen [RB, RP].

Cards in hand are hidden until revealed [RB, RP].

Frame Attempt choices are hidden until the count of three, then revealed simultaneously [RB, RP].

No screening procedure is described for the player mats. The only enforcement mechanism is the physical orientation of the mat, and no source read describes how the mat is kept hidden during reads [RB, RP].

## What is public

The face-up card at each non-Cops location is public [RB, RP].

Which tokens are where is public [RB, RP].

Who holds preparation tokens is public [RB, RP].

Every action taken is public [RB, RP].

Every card placed face up during an Evidence Swap is public [RB, RP]. The Evidence Swap is the game's main information channel, because a player who is obliged to place their own colour reveals that they hold it, and the card they leave behind becomes public [RB, RP].

Hand sizes are public. All players hold the same number of cards, and the count is fixed by the player count, so hand size carries no hidden information [RB].

The front sides of the player mats are public. The portrait and the turn-step reminder are visible to all, and only the reverse is secret [RB].

## The two player mat properties

A player's own mat never names that player. Every grid coordinate indicates a different player, so a player is never told that they themselves are the scapegoat [SB].

For a fixed player count and a fixed die result, the scapegoat is the same for every player. The lie is structural and not per-roll [SB]. Dan Thurot confirmed this in the comment thread on his own review [SB].

Mechanically, for a given count exactly one mat entry differs from the consensus, and that difference is what makes the named player the scapegoat [SB].

Together these two properties mean a player can never see their own colour as their suspect. This is the single most important invariant for an implementation to preserve [SB].

## What Spy reveals

Spy lets the acting player pick one player at the table, and that player must show the acting player their hand [RB, RP].

Nothing in the rules says whether the showing reaches the spy alone or the whole table. The plain wording is that they show you their hand, which reads as the acting player alone [RB, RP]. A reviewer describes Spy generically as an information-gathering action without naming an audience [JTR].

The question is not settled. An implementation should default to private to the spy and expose the audience as a configurable rule. The question appears in `07-open-questions.md`.

## What Stash hides

Stash lets you pick one of the three facedown cards at this location and add it to your hand. You then place one card from your hand face down to replace it [RB, RP].

You may place down the very card you just picked up [RB, RP]. This means a player can look at one facedown Stash card and leave the Stash unchanged, so the Stash identity the player learns does not become public [RB].

The three facedown Stash card identities stay hidden from every player at all times, including the player who picks one [RB, RP].

## The frame reveal as a public event

Frame Attempt choices are hidden until the count of three [RB, RP].

On the count of three, every player reveals their chosen card simultaneously, and every revealed card becomes public [RB, RP].

After a successful frame, every player reveals who their own player mat says is the scapegoat, which confirms the true identity and makes every mat's suspect public [RB, RP].

After a cops run, all players count to three and simultaneously point at who their own player mat says is the scapegoat, which makes every mat's suspect public in the same way [RB, RP].
