import type { PusherConfig } from "./pusher.ts";

export interface PusherEnv {
  readonly PUSHER_APP_KEY?: string | undefined;
  readonly PUSHER_HOST?: string | undefined;
  readonly PUSHER_SECRET?: string | undefined;
}

export const pusherConfigFromEnv = (env: PusherEnv): PusherConfig | null => {
  const { PUSHER_APP_KEY, PUSHER_HOST, PUSHER_SECRET } = env;
  if (!PUSHER_APP_KEY || !PUSHER_HOST || !PUSHER_SECRET) return null;
  return { appKey: PUSHER_APP_KEY, host: PUSHER_HOST, secret: PUSHER_SECRET };
};
