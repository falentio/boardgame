import { parseRoomCode } from "../../../shared/rooms/code.ts";
import { pusherConfigFromEnv } from "../../modules/realtime/config.ts";
import { channelAuth } from "../../modules/realtime/pusher.ts";

const PREFIXES = ["private-room-", "private-game-"] as const;

export default defineEventHandler(async (event) => {
  await requireSession(event);

  const form = await readFormData(event);
  const socketId = form.get("socket_id");
  const channel = form.get("channel_name");
  if (typeof socketId !== "string" || typeof channel !== "string") {
    throw createError({ statusCode: 400, statusMessage: "socket_id and channel_name are required" });
  }
  const prefix = PREFIXES.find((p) => channel.startsWith(p));
  if (prefix === undefined || parseRoomCode(channel.slice(prefix.length)) === null) {
    throw createError({
      statusCode: 400,
      statusMessage: "channel_name must be private-room-<CODE> or private-game-<CODE>",
    });
  }

  const config = pusherConfigFromEnv(cloudflareEnv(event));
  if (config === null) {
    throw createError({ statusCode: 503, statusMessage: "realtime is not configured" });
  }

  return channelAuth(config, socketId, channel);
});
