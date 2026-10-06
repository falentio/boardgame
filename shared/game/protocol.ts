import {
  decodeFrame,
  decodeSeatInput,
  decodeSnapshot,
  encodeFrame,
  encodeSeatInput,
  encodeSnapshot,
  expectInteger,
  expectObject,
  expectString,
  field,
  frameIndex,
  seatId,
  type GameDefinition,
  type Inbound,
} from "../core/lockstep/index.ts";
import { encodeEnvelope, parseEnvelope, type GameEnvelope } from "./events.ts";

export type GameMessage<A> = Inbound<A> | { readonly kind: "sync" };

export const encodeMessage = <S, A, Setup, View>(
  game: GameDefinition<S, A, Setup, View>,
  message: GameMessage<A>,
): GameEnvelope => {
  switch (message.kind) {
    case "report":
      return encodeEnvelope({
        kind: "report",
        report: {
          frame: message.report.frame,
          seat: message.report.seat,
          input: encodeSeatInput(message.report.input, game.action),
        },
      });
    case "frame":
      return encodeEnvelope({ kind: "frame", frame: encodeFrame(message.frame, game.action) });
    case "snapshot":
      return encodeEnvelope({ kind: "snapshot", snapshot: encodeSnapshot(game, message.snapshot) });
    case "sync":
      return encodeEnvelope({ kind: "sync" });
  }
};

export const decodeMessage = <S, A, Setup, View>(
  game: GameDefinition<S, A, Setup, View>,
  data: unknown,
): GameMessage<A> | null => {
  const envelope = parseEnvelope(data);
  if (envelope.kind !== "ok") return null;
  try {
    const body = expectObject(envelope.body, "message");
    const kind = expectString(field(body, "kind"), "message kind");
    switch (kind) {
      case "report": {
        const report = expectObject(field(body, "report"), "report");
        return {
          kind: "report",
          report: {
            frame: frameIndex(expectInteger(field(report, "frame"), "report frame")),
            seat: seatId(expectString(field(report, "seat"), "report seat")),
            input: decodeSeatInput(field(report, "input"), game.action),
          },
        };
      }
      case "frame":
        return { kind: "frame", frame: decodeFrame(field(body, "frame"), game.action) };
      case "snapshot":
        return { kind: "snapshot", snapshot: decodeSnapshot(game, field(body, "snapshot")) };
      case "sync":
        return { kind: "sync" };
      default:
        return null;
    }
  } catch {
    return null;
  }
};
