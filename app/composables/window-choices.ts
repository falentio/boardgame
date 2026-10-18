import type { SeatId } from "#shared/rooms/ids.ts";
import {
  CITY_TARGET,
  specOfCharacter,
  specOfDistrict,
  type CharacterId,
  type CitadelsAction,
  type CitadelsView,
  type DistrictType,
  type PlayerView,
} from "#shared/core/lockstep/games/citadels/index.ts";
import { BELL_TOWER, DISTRICT_CATALOG } from "#shared/core/lockstep/games/citadels/districts.ts";
import { canKill } from "#shared/core/lockstep/games/citadels/characters/assassin.ts";
import { canConfiscate } from "#shared/core/lockstep/games/citadels/characters/magistrate.ts";
import { isSeizable, seizePrice } from "#shared/core/lockstep/games/citadels/characters/marshal.ts";
import { canBewitch } from "#shared/core/lockstep/games/citadels/characters/witch.ts";
import { destroyPrice } from "#shared/core/lockstep/games/citadels/characters/warlord.ts";
import { keepProtects } from "#shared/core/lockstep/games/citadels/districts/keep.ts";
import { greatWallToll } from "#shared/core/lockstep/games/citadels/districts/great-wall.ts";
import type { WindowPurpose } from "#shared/core/lockstep/games/citadels/state.ts";

/** What a control is, so the surface can pick a glyph and an assertion can read it. */
export type WindowChoiceKind = "seat" | "character" | "type" | "district" | "card" | "confirm";

/** One legal input a window leaves its owner, and the label that names it. */
export interface WindowChoice {
  readonly action: CitadelsAction;
  readonly label: string;
  readonly kind: WindowChoiceKind;
  /** A short qualifier: a count, a cost, an index. Null when the label is enough. */
  readonly note: string | null;
}

type NameOf = (seat: SeatId) => string;

interface ChoiceCtx {
  readonly view: CitadelsView;
  readonly nameOf: NameOf;
}

type ChoiceBuilder = (ctx: ChoiceCtx) => readonly WindowChoice[];

/** The district types a `name-type` window admits, read off the catalog's own rows. */
const NAMED_TYPES: readonly DistrictType[] = [
  ...new Set(DISTRICT_CATALOG.map((district) => district.type)),
];

const pass = (label: string): WindowChoice => ({
  action: { t: "pass" },
  label,
  kind: "confirm",
  note: null,
});

const gold = (label: string, note: string | null): WindowChoice => ({
  action: { t: "gold" },
  label,
  kind: "confirm",
  note,
});

const choose = (value: string, label: string, note: string | null): WindowChoice => ({
  action: { t: "choose", value },
  label,
  kind: "confirm",
  note,
});

const seatChoice = (seat: SeatId, nameOf: NameOf): WindowChoice => ({
  action: { t: "target", seat },
  label: nameOf(seat),
  kind: "seat",
  note: null,
});

const characterChoice = (character: CharacterId): WindowChoice => ({
  action: { t: "name-character", character },
  label: specOfCharacter(character).name,
  kind: "character",
  note: null,
});

const typeChoice = (type: DistrictType): WindowChoice => ({
  action: { t: "name-type", type },
  label: type,
  kind: "type",
  note: null,
});

const cityChoice = (id: string, index: number, note: string | null): WindowChoice => ({
  action: { t: "keep", index },
  label: specOfDistrict(id).name,
  kind: "district",
  note,
});

const handChoice = (id: string, index: number, note: string | null): WindowChoice => ({
  action: { t: "keep", index },
  label: specOfDistrict(id).name,
  kind: "card",
  note,
});

const plateOf = (view: CitadelsView, seat: SeatId): PlayerView | null =>
  view.players.find((player) => player.seat === seat) ?? null;

const myCity = (view: CitadelsView): PlayerView["city"] => plateOf(view, view.seat)?.city ?? [];

const myGold = (view: CitadelsView): number => plateOf(view, view.seat)?.gold ?? 0;

const rivals = (view: CitadelsView): readonly PlayerView[] =>
  view.players.filter((player) => player.seat !== view.seat);

/**
 * The finish line a complete city reads from the view: eight districts, or seven
 * once the Bell Tower is public (helpers.ts:121 `cityTarget`). A Bell Tower still
 * in the hidden deck is invisible, so that one seat reads eight.
 */
const cityTargetOf = (view: CitadelsView): number => (bellVisible(view) ? CITY_TARGET - 1 : CITY_TARGET);

const bellVisible = (view: CitadelsView): boolean =>
  view.discard.includes(BELL_TOWER) ||
  view.players.some((player) => player.city.some((district) => district.id === BELL_TOWER));

/** helpers.ts:270 `hasCompleted`: a seat at the target has finished. */
const finished = (view: CitadelsView, seat: SeatId): boolean =>
  (plateOf(view, seat)?.city.length ?? 0) >= cityTargetOf(view);

const cityIds = (view: CitadelsView, seat: SeatId): ReadonlySet<string> =>
  new Set((plateOf(view, seat)?.city ?? []).map((district) => district.id));

/** Whether the window's owner may name a character, read from the view alone. */
type CanName = (view: CitadelsView, character: CharacterId) => boolean;

const CHOOSE_CHARACTER_OWNER: Partial<Record<CharacterId, CanName>> = {
  assassin: canKill,
  // characters/thief.ts:25 canRob and characters/blackmailer.ts:30 canThreat also
  // read `skipped` and `bewitched`, which no view carries, so the cast-level half stands here.
  thief: (_view, id) => id !== "thief" && specOfCharacter(id).rank !== 1,
  witch: canBewitch,
  magistrate: canConfiscate,
  blackmailer: (_view, id) => specOfCharacter(id).rank !== 1,
};

/**
 * The characters the window's owner may name. Every opener arms its pending
 * character before the naming window (assassin.ts:42, thief.ts:48, witch.ts:54,
 * magistrate.ts:48, blackmailer.ts:54), so a view naming no owner is not a
 * naming window the rules describe: the whole cast stays nameable there.
 */
const chooseCharacter: ChoiceBuilder = (ctx) => {
  const owner = ctx.view.pending?.character ?? null;
  const rule = owner === null ? undefined : CHOOSE_CHARACTER_OWNER[owner];
  return ctx.view.cast.filter((id) => rule === undefined || rule(ctx.view, id)).map(characterChoice);
};

const chooseSeat: ChoiceBuilder = (ctx) =>
  rivals(ctx.view).map((player) => seatChoice(player.seat, ctx.nameOf));

const chooseType: ChoiceBuilder = () => NAMED_TYPES.map(typeChoice);

/** characters/magician.ts:56: a live rival swaps hands; anyone else opens the discard. */
const magicianSwap: ChoiceBuilder = (ctx) => [
  ...rivals(ctx.view).map((player) => seatChoice(player.seat, ctx.nameOf)),
  pass("KEEP HAND"),
];

/** characters/magician.ts:68: hand index into the discard-and-refill, or close. */
const magicianDiscard: ChoiceBuilder = (ctx) => [
  ...ctx.view.myHand.map((id, index) => handChoice(id, index, null)),
  pass("END"),
];

/** characters/seer.ts:84: hand index of the card handed to the rival. */
const seerGive: ChoiceBuilder = (ctx) =>
  ctx.view.myHand.map((id, index) => handChoice(id, index, null));

/** characters/seer.ts:73: the engine draws the take itself; the seat only reports. */
const seerReceive: ChoiceBuilder = () => [pass("TAKE CARD")];

/** characters/emperor.ts:30 recipients, then characters/emperor.ts:91 the reward. */
const emperorCrown: ChoiceBuilder = (ctx) =>
  ctx.view.pending?.target === null
    ? rivals(ctx.view).map((player) => seatChoice(player.seat, ctx.nameOf))
    : [gold("TAKE GOLD", "1"), { action: { t: "draw" }, label: "TAKE CARD", kind: "confirm", note: "1" }];

/** characters/abbot.ts:26 religiousIn, read through characters/abbot.ts:49 declaredGold. */
const abbotSplit: ChoiceBuilder = (ctx) => {
  const count = myCity(ctx.view).filter(
    (district) => specOfDistrict(district.id).type === "religious",
  ).length;
  return Array.from({ length: count + 1 }, (_, at): WindowChoice => ({
    action: { t: "choose", value: String(at) },
    label: at === 0 ? "ALL CARDS" : at === count ? "ALL GOLD" : "SPLIT",
    kind: "confirm",
    note: `${at}G ${count - at}C`,
  }));
};

/** characters/cardinal.ts:100: a donor covers the gap the build carried on pending.cards. */
const cardinalGold: ChoiceBuilder = (ctx) =>
  (ctx.view.pending?.cards ?? 0) > 0
    ? [...rivals(ctx.view).map((player) => seatChoice(player.seat, ctx.nameOf)), pass("DECLINE")]
    : [pass("CONTINUE")];

/** characters/wizard.ts:62 a live rival, then characters/wizard.ts:74 a hidden hand index. */
const wizardTake: ChoiceBuilder = (ctx) => {
  const target = ctx.view.pending?.target ?? null;
  if (target === null) return rivals(ctx.view).map((player) => seatChoice(player.seat, ctx.nameOf));
  const count = plateOf(ctx.view, target)?.handCount ?? 0;
  return Array.from({ length: count }, (_, index): WindowChoice => ({
    action: { t: "keep", index },
    label: "CARD",
    kind: "card",
    note: String(index + 1),
  }));
};

/** characters/diplomat.ts:74 the rival, :92 the district taken, then the one given. */
const diplomatExchange: ChoiceBuilder = (ctx) => {
  const view = ctx.view;
  const target = view.pending?.target ?? null;
  if (target === null) {
    return rivals(view)
      .filter((player) => !finished(view, player.seat))
      .map((player) => seatChoice(player.seat, ctx.nameOf));
  }
  const mine = cityIds(view, view.seat);
  if ((view.pending?.cards ?? 0) === 0) {
    return (plateOf(view, target)?.city ?? [])
      .map((district, index) => ({ district, index }))
      .filter(({ district }) => !mine.has(district.id))
      .map(({ district, index }) => cityChoice(district.id, index, null));
  }
  const theirs = cityIds(view, target);
  return (plateOf(view, view.seat)?.city ?? [])
    .map((district, index) => ({ district, index }))
    .filter(({ district }) => !theirs.has(district.id))
    .map(({ district, index }) => cityChoice(district.id, index, null));
};

/** characters/marshal.ts:80 the rival, then :45 isSeizable over that city. */
const marshalSeize: ChoiceBuilder = (ctx) => {
  const view = ctx.view;
  const target = view.pending?.target ?? null;
  if (target === null) {
    return rivals(view)
      .filter((player) => !finished(view, player.seat))
      .map((player) => seatChoice(player.seat, ctx.nameOf));
  }
  const mine = cityIds(view, view.seat);
  const purse = myGold(view);
  return (plateOf(view, target)?.city ?? [])
    .map((district, index) => ({ district, index }))
    .filter(
      ({ district }) =>
        isSeizable(district.id) && !mine.has(district.id) && seizePrice(district.id) <= purse,
    )
    .map(({ district, index }) => cityChoice(district.id, index, String(seizePrice(district.id))));
};

/** characters/artist.ts:39 beautify: an unmarked own district, one gold from the stash. */
const artistBeautify: ChoiceBuilder = (ctx) => {
  if (myGold(ctx.view) < 1) return [pass("END")];
  return [
    ...myCity(ctx.view)
      .map((district, index) => ({ district, index }))
      .filter(({ district }) => district.gold === 0)
      .map(({ district, index }) => cityChoice(district.id, index, null)),
    pass("END"),
  ];
};

/** characters/magistrate.ts:66: reveal the signed warrant, or let it pass. */
const magistrateConfiscate: ChoiceBuilder = () => [
  choose("confiscate", "CONFISCATE", null),
  pass("DECLINE"),
];

/** characters/blackmailer.ts:30 canThreat for the name, :153 for the reveal. */
const blackmailerResolve: ChoiceBuilder = (ctx) => [
  ...chooseCharacter(ctx),
  choose("reveal", "REVEAL", null),
];

/** characters/scholar.ts:83: the drawn seven, which the view hands its own seat. */
const scholarKeep: ChoiceBuilder = (ctx) =>
  ctx.view.myDraw.map((id, index) => handChoice(id, index, null));

const buildChoice = (id: string, index: number): WindowChoice => ({
  action: { t: "build", card: index },
  label: specOfDistrict(id).name,
  kind: "district",
  note: String(specOfDistrict(id).cost),
});

/** characters/trader.ts:51: a trade district from hand, then the window reopens. */
const traderBuild: ChoiceBuilder = (ctx) => [
  ...ctx.view.myHand
    .map((id, index) => ({ id, index }))
    .filter(({ id }) => specOfDistrict(id).type === "trade")
    .map(({ id, index }) => buildChoice(id, index)),
  pass("STOP"),
];

/** characters/warlord.ts:85 the owner whose district falls, then :104 the district. */
const warlordDestroy: ChoiceBuilder = (ctx) => {
  const view = ctx.view;
  const target = view.pending?.target ?? null;
  if (target === null) {
    return view.players
      .filter((player) => !finished(view, player.seat))
      .map((player) => seatChoice(player.seat, ctx.nameOf));
  }
  const city = plateOf(view, target)?.city ?? [];
  const toll = greatWallToll(city);
  const purse = myGold(view);
  return city
    .map((district, index) => ({ district, index }))
    .filter(({ district }) => !keepProtects(district.id))
    .map(({ district, index }) => ({
      district,
      index,
      price: destroyPrice(district.id, district.gold) + toll,
    }))
    .filter(({ price }) => price <= purse)
    .map(({ district, index, price }) => cityChoice(district.id, index, String(price)));
};

/** characters/tax-collector.ts:33 wantsTake: empty the token, or leave it standing. */
const taxCollect: ChoiceBuilder = () => [gold("TAKE TOKEN", null), pass("LEAVE IT")];

/** characters/blackmailer.ts:102 bribe: half the purse, rounded down, or refuse. */
const blackmailerThreat: ChoiceBuilder = (ctx) => [
  choose("bribe", "PAY BRIBE", String(Math.floor(myGold(ctx.view) / 2))),
  pass("REFUSE"),
];

/** districts/armory.ts:104 the rival whose district falls, then :118 the district. */
const armoryDestroy: ChoiceBuilder = (ctx) => {
  const view = ctx.view;
  if (!cityIds(view, view.seat).has("armory")) return [pass("CONTINUE")];
  const target = view.pending?.target ?? null;
  if (target === null) {
    return rivals(view)
      .filter((player) => !finished(view, player.seat))
      .map((player) => seatChoice(player.seat, ctx.nameOf));
  }
  return (plateOf(view, target)?.city ?? []).map((district, index) =>
    cityChoice(district.id, index, null),
  );
};

/** districts/theater.ts:93: the rival swapped with, or a give-only hold. */
const theaterSwap: ChoiceBuilder = (ctx) => [
  ...rivals(ctx.view).map((player) => seatChoice(player.seat, ctx.nameOf)),
  pass("HOLD"),
];

/** A window whose owner has nothing to pick: the engine applies it on confirm. */
const confirmOnly: ChoiceBuilder = () => [pass("CONTINUE")];

/** One builder per window purpose, so a new purpose has to declare its inputs here. */
const CHOICE_BUILDERS: Record<WindowPurpose, ChoiceBuilder> = {
  "draft-pick": () => [],
  turn: () => [],
  keep: () => [],
  "choose-character": chooseCharacter,
  "choose-seat": chooseSeat,
  "choose-type": chooseType,
  "magician-swap": magicianSwap,
  "magician-discard": magicianDiscard,
  "seer-give": seerGive,
  "seer-receive": seerReceive,
  "emperor-crown": emperorCrown,
  "abbot-split": abbotSplit,
  "cardinal-gold": cardinalGold,
  "wizard-take": wizardTake,
  "diplomat-exchange": diplomatExchange,
  "marshal-seize": marshalSeize,
  "artist-beautify": artistBeautify,
  "magistrate-confiscate": magistrateConfiscate,
  "blackmailer-resolve": blackmailerResolve,
  "scholar-keep": scholarKeep,
  "trader-build": traderBuild,
  "warlord-destroy": warlordDestroy,
  "tax-collect": taxCollect,
  "witch-resume": confirmOnly,
  "queen-income": confirmOnly,
  "thief-rob": confirmOnly,
  "witch-takeover": confirmOnly,
  "blackmailer-threat": blackmailerThreat,
  "armory-destroy": armoryDestroy,
  "theatre-swap": theaterSwap,
};

/** The surfaces other units own; their windows report through their own control. */
const OTHER_SURFACES: ReadonlySet<WindowPurpose> = new Set<WindowPurpose>([
  "turn",
  "keep",
  "draft-pick",
]);

/**
 * The seat whose input a window's resolver reads (helpers.ts:1095 `actorOf`): the
 * pending actor for `any` windows, else the window's own seat. An `any` window
 * names every live seat as owed, so the actor is what tells the seat its report
 * counts; every other seat gets an empty list.
 */
const answersWindow = (view: CitadelsView): boolean =>
  view.window === null
    ? false
    : view.window.kind === "any"
      ? view.pending?.actor === view.seat
      : view.owedSeats.includes(view.seat);

/**
 * The inputs the engine's rules leave the viewer for the open window. Empty when
 * another surface owns the purpose, when a rival's input is the one read, or when
 * the window carries nothing to choose; a window that needs a report and offers no
 * choice keeps a bare confirm so the game never waits on an absent control.
 */
export const windowChoicesFor = (view: CitadelsView, nameOf: NameOf): readonly WindowChoice[] => {
  const purpose = view.window?.purpose;
  if (purpose === undefined || OTHER_SURFACES.has(purpose) || !answersWindow(view)) return [];
  const built = CHOICE_BUILDERS[purpose]({ view, nameOf });
  return built.length > 0 ? built : [pass("CONTINUE")];
};

/** The value an assertion reads off a control; the action stays the source of truth. */
export const windowChoiceValue = (choice: WindowChoice): string => {
  const action = choice.action;
  switch (action.t) {
    case "target":
      return action.seat;
    case "name-character":
    case "pick":
      return action.character;
    case "name-type":
      return action.type;
    case "keep":
      return String(action.index);
    case "build":
      return String(action.card);
    case "choose":
      return action.value;
    case "pay":
      return String(action.amount);
    default:
      return action.t;
  }
};
