// Pure helpers behind scripts/sync-wrangler-bindings.mjs.
//
// Kept separate from the CLI so the JSONC reader, the remote-binding ->
// wrangler.jsonc mapping, and the drift comparison can be unit tested without
// shelling out to wrangler or touching the network.

/**
 * Minimal JSONC reader: strips line/block comments and trailing commas.
 * wrangler.jsonc is JSON-with-comments, so JSON.parse alone is not enough.
 */
export const stripJsonc = (text) => {
  let out = "";
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inLine) {
      if (c === "\n") inLine = false;
      continue;
    }
    if (inBlock) {
      if (c === "*" && n === "/") {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += c;
      if (c === "\\") {
        out += text[++i];
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === "/" && n === "/") {
      inLine = true;
      i++;
      continue;
    }
    if (c === "/" && n === "*") {
      inBlock = true;
      i++;
      continue;
    }
    out += c;
  }
  return out.replace(/,\s*([}\]])/g, "$1");
};

/**
 * Maps a Worker version's `resources.bindings` array (as returned by
 * `wrangler versions view <id> --json`) into the fields of a wrangler.jsonc.
 * Secrets are returned by name only — their values are never readable.
 */
export const wranglerFragmentFromBindings = (bindings) => {
  const vars = {};
  const d1 = [];
  const kv = [];
  const r2 = [];
  const durableObjects = [];
  const queues = [];
  const services = [];
  const vectorize = [];
  const hyperdrive = [];
  const secrets = [];
  const other = [];

  for (const b of bindings ?? []) {
    switch (b.type) {
      case "plain_text":
        vars[b.name] = b.text;
        break;
      case "json":
        vars[b.name] = b.json;
        break;
      case "secret_text":
        secrets.push(b.name);
        break;
      case "d1":
        d1.push({ binding: b.name, database_id: b.id });
        break;
      case "kv_namespace":
        kv.push({ binding: b.name, id: b.namespace_id });
        break;
      case "r2_bucket":
        r2.push({ binding: b.name, bucket_name: b.bucket_name });
        break;
      case "durable_object_namespace":
        durableObjects.push({
          name: b.name,
          class_name: b.class_name,
          ...(b.script_name ? { script_name: b.script_name } : {}),
        });
        break;
      case "queue":
        queues.push({ binding: b.name, queue: b.queue_name });
        break;
      case "service":
        services.push({ binding: b.name, service: b.service });
        break;
      case "vectorize":
        vectorize.push({ binding: b.name, index_name: b.index_name });
        break;
      case "hyperdrive":
        hyperdrive.push({ binding: b.name, id: b.id });
        break;
      case "assets":
        break; // assets come from the deploy, not a hand-written binding
      default:
        other.push({ type: b.type, name: b.name, raw: b });
    }
  }

  const fragment = {
    ...(Object.keys(vars).length ? { vars } : {}),
    ...(d1.length ? { d1_databases: d1 } : {}),
    ...(kv.length ? { kv_namespaces: kv } : {}),
    ...(r2.length ? { r2_buckets: r2 } : {}),
    ...(durableObjects.length
      ? { durable_objects: { bindings: durableObjects } }
      : {}),
    ...(queues.length ? { queues: { producers: queues } } : {}),
    ...(services.length ? { services } : {}),
    ...(vectorize.length ? { vectorize } : {}),
    ...(hyperdrive.length ? { hyperdrive } : {}),
  };

  return { fragment, vars, d1, kv, r2, secrets, other };
};

/**
 * Sorts object keys recursively so two configs compare by content, not by the
 * order the keys happened to arrive in. Array order is kept: a list of bindings
 * is ordered.
 */
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
};

/**
 * Compares the mapped remote bindings against the local wrangler.jsonc fields
 * and returns one {label, remote, local, equal} row per field.
 */
export const diffAgainstConfig = (local, mapped) => {
  const rows = [
    ["vars", mapped.vars, local.vars ?? {}],
    [
      "d1_databases",
      mapped.d1,
      (local.d1_databases ?? []).map((d) => ({
        binding: d.binding,
        database_id: d.database_id,
      })),
    ],
    ["kv_namespaces", mapped.kv, local.kv_namespaces ?? []],
    ["r2_buckets", mapped.r2, local.r2_buckets ?? []],
  ];
  return rows.map(([label, remote, mine]) => ({
    label,
    remote,
    local: mine,
    equal: JSON.stringify(canonical(remote)) === JSON.stringify(canonical(mine)),
  }));
};
