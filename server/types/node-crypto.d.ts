// `@types/node` is not a dependency, so the workerd `node:crypto` built-ins the
// realtime trigger relies on have no ambient types. Declare only the two used.
declare module "node:crypto" {
  interface Hash {
    update(data: string): Hash;
    digest(encoding: "hex"): string;
  }
  interface Hmac {
    update(data: string): Hmac;
    digest(encoding: "hex"): string;
  }
  export function createHash(algorithm: string): Hash;
  export function createHmac(algorithm: string, key: string): Hmac;
}
