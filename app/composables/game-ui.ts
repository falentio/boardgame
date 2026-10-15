import type { Component } from "vue";
import type { GameKind } from "#shared/rooms/games.ts";
import CastPicker from "../components/room/CastPicker.vue";
import G54SetupPicker from "../components/room/G54SetupPicker.vue";
import CastStrip from "../components/room/CastStrip.vue";
import RoleStrip from "../components/room/RoleStrip.vue";
import G54GameScreen from "../components/games/G54GameScreen.vue";
import CitadelsGameScreen from "../components/games/CitadelsGameScreen.vue";

/** The UI half of the game registry, keyed by the same `GameKind` as `ROOM_GAMES`. */
export interface GameUi {
  readonly label: string;
  readonly setupLabel: string;
  /** props { setup: RoomSetup | null }, emits change: [RoomSetup | null, missing] */
  readonly createPicker: Component;
  /** props { setup: RoomSetup } */
  readonly lobbySetup: Component;
  /** props { room: Room; viewer: UserId | null; loadFailed: string | null } */
  readonly screen: Component;
}

export const GAME_UI: { readonly [K in GameKind]: GameUi } = {
  g54: {
    label: "Coup: Rebellion G54",
    setupLabel: "Roles",
    createPicker: G54SetupPicker,
    lobbySetup: RoleStrip,
    screen: G54GameScreen,
  },
  citadels: {
    label: "Citadels",
    setupLabel: "Cast",
    createPicker: CastPicker,
    lobbySetup: CastStrip,
    screen: CitadelsGameScreen,
  },
};
