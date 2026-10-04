import { roomAppFor } from "../../modules/rooms/composition.ts";

export default defineEventHandler((event) =>
  roomAppFor(cloudflareEnv(event)).fetch(toWebRequest(event)),
);
