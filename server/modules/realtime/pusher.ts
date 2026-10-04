import { createHash, createHmac } from "node:crypto";

export interface PusherConfig {
  readonly appKey: string;
  readonly host: string;
  readonly secret: string;
}

export interface TriggerRequest {
  readonly url: string;
  readonly method: "POST";
  readonly headers: Record<string, string>;
  readonly body: string;
}

export type Publisher = (
  channel: string,
  event: string,
  data: unknown,
) => Promise<void>;

export interface PublisherOptions {
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
  readonly log?: (message: string) => void;
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

const seconds = (): number => Math.floor(Date.now() / 1000);

const md5Hex = (value: string): string =>
  createHash("md5").update(value).digest("hex");

const hmacHex = (secret: string, value: string): string =>
  createHmac("sha256", secret).update(value).digest("hex");

export const signTrigger = (
  config: PusherConfig,
  body: string,
  nowSeconds: number,
): TriggerRequest => {
  const query =
    `auth_key=${config.appKey}` +
    `&auth_timestamp=${String(nowSeconds)}` +
    `&auth_version=1.0` +
    `&body_md5=${md5Hex(body)}`;
  const signature = hmacHex(config.secret, `POST\n/apps/${config.appKey}/events\n${query}`);
  return {
    url: `https://${config.host}/apps/${config.appKey}/events?${query}&auth_signature=${signature}`,
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  };
};

export const channelAuth = (
  config: PusherConfig,
  socketId: string,
  channel: string,
): { auth: string } => ({
  auth: `${config.appKey}:${hmacHex(config.secret, `${socketId}:${channel}`)}`,
});

export const pusherPublisher = (
  config: PusherConfig,
  opts: PublisherOptions = {},
): Publisher => {
  const doFetch = opts.fetch ?? fetch;
  const clock = opts.now ?? seconds;
  const log = opts.log ?? ((message: string) => console.error(message));
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async (channel, event, data) => {
    const body = JSON.stringify({
      name: event,
      channels: [channel],
      data: JSON.stringify(data),
    });
    const request = signTrigger(config, body, clock());
    try {
      const response = await doFetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        log(`pusher trigger to ${channel} failed with ${String(response.status)}`);
      }
    } catch (error) {
      log(`pusher trigger to ${channel} failed: ${String(error)}`);
    }
  };
};
