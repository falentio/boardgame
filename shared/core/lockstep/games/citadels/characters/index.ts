import type { Random, SeatId } from "../../../index.ts";
import { type CharacterId } from "../characters.ts";
import {
  resolveChooseCharacter,
  resolveChooseSeat,
  resolveChooseType,
  resolveDraftPick,
  resolveKeep,
  resolveTurn,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState, Step, WindowPurpose } from "../state.ts";
import { assassin, assassinResolve } from "./assassin.ts";
import { thief, thiefResolve } from "./thief.ts";
import { magician, magicianResolve } from "./magician.ts";
import { king, kingResolve } from "./king.ts";
import { bishop, bishopResolve } from "./bishop.ts";
import { merchant, merchantResolve } from "./merchant.ts";
import { architect, architectResolve } from "./architect.ts";
import { warlord, warlordResolve } from "./warlord.ts";
import { witch, witchResolve } from "./witch.ts";
import { taxCollector, taxCollectorResolve } from "./tax-collector.ts";
import { wizard, wizardResolve } from "./wizard.ts";
import { emperor, emperorResolve } from "./emperor.ts";
import { abbot, abbotResolve } from "./abbot.ts";
import { alchemist, alchemistResolve } from "./alchemist.ts";
import { navigator, navigatorResolve } from "./navigator.ts";
import { diplomat, diplomatResolve } from "./diplomat.ts";
import { artist, artistResolve } from "./artist.ts";
import { queen, queenResolve } from "./queen.ts";
import { magistrate, magistrateResolve } from "./magistrate.ts";
import { blackmailer, blackmailerResolve } from "./blackmailer.ts";
import { spy, spyResolve } from "./spy.ts";
import { seer, seerResolve } from "./seer.ts";
import { patrician, patricianResolve } from "./patrician.ts";
import { cardinal, cardinalResolve } from "./cardinal.ts";
import { trader, traderResolve } from "./trader.ts";
import { scholar, scholarResolve } from "./scholar.ts";
import { marshal, marshalResolve } from "./marshal.ts";

/** The state at the character's turn, plus the round continuation it pushes below. */
export interface CharacterCtx {
  readonly state: CitadelsState;
  readonly seat: SeatId;
  readonly rest: readonly Step[];
  readonly rng: Random;
}

export type CharacterEffect = (ctx: CharacterCtx) => CitadelsState;

/**
 * One effect per character, each imported from its own `characters/<id>.ts`.
 * A character worker edits only its own file; this registry is written once.
 */
export const CHARACTER_EFFECTS: Record<CharacterId, CharacterEffect> = {
  assassin: assassin,
  thief: thief,
  magician: magician,
  king: king,
  bishop: bishop,
  merchant: merchant,
  architect: architect,
  warlord: warlord,
  witch: witch,
  "tax-collector": taxCollector,
  wizard: wizard,
  emperor: emperor,
  abbot: abbot,
  alchemist: alchemist,
  navigator: navigator,
  diplomat: diplomat,
  artist: artist,
  queen: queen,
  magistrate: magistrate,
  blackmailer: blackmailer,
  spy: spy,
  seer: seer,
  patrician: patrician,
  cardinal: cardinal,
  trader: trader,
  scholar: scholar,
  marshal: marshal,
};

/**
 * One resolver per window purpose: the six engine windows resolve in
 * `helpers.ts`, and each of the 19 character-owned purposes points at its own
 * character's `<id>Resolve`. A character worker never edits a shared registry.
 */
export const CHARACTER_RESOLVERS: Record<WindowPurpose, WindowResolver> = {
  "draft-pick": resolveDraftPick,
  "turn": resolveTurn,
  "keep": resolveKeep,
  "choose-character": assassinResolve,
  "choose-seat": thiefResolve,
  "choose-type": spyResolve,
  "magician-swap": magicianResolve,
  "magician-discard": magicianResolve,
  "seer-give": seerResolve,
  "seer-receive": seerResolve,
  "emperor-crown": emperorResolve,
  "abbot-split": abbotResolve,
  "cardinal-gold": cardinalResolve,
  "wizard-take": wizardResolve,
  "diplomat-exchange": diplomatResolve,
  "marshal-seize": marshalResolve,
  "artist-beautify": artistResolve,
  "magistrate-confiscate": magistrateResolve,
  "blackmailer-resolve": blackmailerResolve,
  "scholar-keep": scholarResolve,
  "trader-build": traderResolve,
  "warlord-destroy": warlordResolve,
  "tax-collect": taxCollectorResolve,
  "witch-resume": witchResolve,
  "queen-income": queenResolve,
};

export { resolveChooseCharacter, resolveChooseSeat, resolveChooseType, resolveDraftPick, resolveKeep, resolveTurn };
