import type { Scene } from "./kit.ts";

/**
 * Every scene module a purpose slice adds lands here. One file per purpose keeps
 * two writers off the same path, and the glob means a new slice needs no edit here.
 */
const modules = import.meta.glob("./*.ts", { eager: true }) as Record<
  string,
  { default?: Scene | readonly Scene[] }
>;

export const SCENES = new Map<string, Scene>();
for (const [path, mod] of Object.entries(modules)) {
  if (path.endsWith("kit.ts") || path.endsWith("index.ts") || mod.default === undefined) continue;
  for (const scene of Array.isArray(mod.default) ? mod.default : [mod.default]) {
    SCENES.set(scene.purpose, scene);
  }
}
