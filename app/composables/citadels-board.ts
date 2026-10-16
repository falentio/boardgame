import type { SeatId } from "#shared/rooms/ids.ts";
import type {
  CharacterId,
  CitadelsView,
  DistrictId,
  Phase,
  PlayerView,
  Rank,
} from "#shared/core/lockstep/games/citadels/index.ts";
import { CITY_TARGET, specOfCharacter } from "#shared/core/lockstep/games/citadels/index.ts";
import type { WindowPurpose } from "#shared/core/lockstep/games/citadels/state.ts";

/** A district sitting in a city, with the Artist's beautify marker on it. */
export interface CityCard {
  readonly id: DistrictId;
  readonly gold: number;
}

interface SeatBase {
  readonly seat: SeatId;
  /** Stable across both clients, so a proof can compare the same seat in two browsers. */
  readonly name: string;
  readonly gold: number;
  readonly city: readonly CityCard[];
  readonly crown: boolean;
  readonly active: boolean;
  readonly owed: boolean;
}

/** A rival's plate. A count, never cards: the engine's view cannot supply them. */
export interface OpponentSeat extends SeatBase {
  readonly kind: "rival";
  readonly handCount: number;
}

/** The viewer's plate. Cards, never a count: `hand.length` is the count. */
export interface MySeat extends SeatBase {
  readonly kind: "me";
  readonly hand: readonly DistrictId[];
  readonly cityTarget: number;
}

export type SeatPlate = MySeat | OpponentSeat;

export type CastSlotState = "available" | "mine" | "faceup" | "pending";

export interface CastSlot {
  readonly character: CharacterId;
  readonly name: string;
  readonly rank: Rank;
  readonly state: CastSlotState;
}

export interface OpenWindow {
  readonly purpose: WindowPurpose;
  readonly label: string;
  readonly owedByMe: boolean;
}

export interface PendingAction {
  readonly actor: SeatId;
  readonly actorName: string;
  readonly character: CharacterId | null;
  readonly characterName: string | null;
  readonly target: SeatId | null;
  readonly targetName: string | null;
  readonly cards: number;
}

/** The public table: every fact every seat at it can see. */
export interface CitadelsTable {
  readonly round: number;
  readonly phase: Phase;
  readonly phaseLabel: string;
  readonly cast: readonly CastSlot[];
  readonly myPick: CharacterId | null;
  readonly window: OpenWindow | null;
  readonly pending: PendingAction | null;
  readonly deckCount: number;
  readonly discard: readonly DistrictId[];
  readonly winner: { readonly seat: SeatId; readonly name: string } | null;
  readonly terminal: boolean;
}

export interface CitadelsBoard extends CitadelsTable {
  /** Clockwise from the viewer's seat, so the same table order renders in both layouts. */
  readonly opponents: readonly OpponentSeat[];
  readonly me: MySeat;
}

/**
 * Short plain label for the open window's purpose. Exhaustive over every purpose
 * so a new engine purpose is a compile error, not a blank status line.
 */
const PURPOSE_LABELS: Record<WindowPurpose, string> = {
  "draft-pick": "Pick a character",
  turn: "Take your turn",
  keep: "Keep a card",
  "choose-character": "Choose a character",
  "choose-seat": "Choose a player",
  "choose-type": "Choose a district type",
  "magician-swap": "Swap hands with a player",
  "magician-discard": "Discard cards",
  "seer-give": "Give a card to a player",
  "seer-receive": "Take a random card",
  "emperor-crown": "Hand over the crown",
  "abbot-split": "Split gold and cards",
  "cardinal-gold": "Take gold to cover a build",
  "wizard-take": "Take a rival's card",
  "diplomat-exchange": "Swap a district with a player",
  "marshal-seize": "Seize a district",
  "artist-beautify": "Beautify a district",
  "magistrate-confiscate": "Confiscate a district",
  "blackmailer-resolve": "Resolve the blackmail",
  "scholar-keep": "Keep cards",
  "trader-build": "Build trade districts",
  "warlord-destroy": "Destroy a district",
  "tax-collect": "Take the tax token",
  "witch-resume": "Resume your turn",
  "queen-income": "Queen's gold",
  "thief-rob": "Rob a player",
  "witch-takeover": "Play the bewitched turn",
  "blackmailer-threat": "Name a blackmail target",
  "armory-destroy": "Destroy a district",
  "theatre-swap": "Swap a character blindly",
};

export const citadelsPurposeLabel = (purpose: WindowPurpose): string => PURPOSE_LABELS[purpose];

const PHASE_LABELS: Record<Phase, string> = {
  draft: "Draft",
  turn: "Turn",
  over: "Game over",
};

export const phaseLabel = (phase: Phase): string => PHASE_LABELS[phase];

const castStateOf = (view: CitadelsView, character: CharacterId): CastSlotState => {
  if (view.pending !== null && view.pending.character === character) return "pending";
  if (view.myPick === character) return "mine";
  if (view.faceup.includes(character)) return "faceup";
  return "available";
};

const plateOf = (
  player: PlayerView,
  view: CitadelsView,
  nameOf: (seat: SeatId) => string,
): SeatBase => ({
  seat: player.seat,
  name: nameOf(player.seat),
  gold: player.gold,
  city: player.city.map((district) => ({ id: district.id, gold: district.gold })),
  crown: player.seat === view.crown,
  active: player.seat === view.active,
  owed: view.owedSeats.includes(player.seat),
});

const rotatedToViewer = (players: readonly PlayerView[], seat: SeatId): readonly PlayerView[] => {
  const at = players.findIndex((player) => player.seat === seat);
  if (at <= 0) return players;
  return [...players.slice(at), ...players.slice(0, at)];
};

export const citadelsBoardOf = (
  view: CitadelsView,
  names: ReadonlyMap<SeatId, string>,
): CitadelsBoard => {
  const nameOf = (seat: SeatId): string => names.get(seat) ?? seat;
  const ordered = rotatedToViewer(view.players, view.seat);
  const mine = ordered[0];
  // `project` refuses a seat that is not a player, so a view without its own row
  // is a broken view rather than an input to handle.
  if (mine === undefined) throw new Error("citadels view is missing the viewer's seat");
  return {
    round: view.round,
    phase: view.phase,
    phaseLabel: phaseLabel(view.phase),
    cast: view.cast.map((character) => {
      const spec = specOfCharacter(character);
      return { character, name: spec.name, rank: spec.rank, state: castStateOf(view, character) };
    }),
    myPick: view.myPick,
    window:
      view.window === null
        ? null
        : {
            purpose: view.window.purpose,
            label: citadelsPurposeLabel(view.window.purpose),
            owedByMe: view.owedSeats.includes(view.seat),
          },
    pending:
      view.pending === null
        ? null
        : {
            actor: view.pending.actor,
            actorName: nameOf(view.pending.actor),
            character: view.pending.character,
            characterName:
              view.pending.character === null ? null : specOfCharacter(view.pending.character).name,
            target: view.pending.target,
            targetName: view.pending.target === null ? null : nameOf(view.pending.target),
            cards: view.pending.cards,
          },
    deckCount: view.deckCount,
    discard: [...view.discard],
    winner: view.winner === null ? null : { seat: view.winner, name: nameOf(view.winner) },
    terminal: view.terminal,
    opponents: ordered.slice(1).map((player): OpponentSeat => ({
      ...plateOf(player, view, nameOf),
      kind: "rival",
      handCount: player.handCount,
    })),
    me: {
      ...plateOf(mine, view, nameOf),
      kind: "me",
      hand: [...view.myHand],
      cityTarget: CITY_TARGET,
    },
  };
};
