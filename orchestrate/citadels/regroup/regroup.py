#!/usr/bin/env python3
"""Regroup the citadels test suite: git mv each file per the rename map, then
rewrite every relative import specifier by the file's new depth.

Idempotent: a move whose target already exists and whose source is gone is skipped.
"""
import json, os, re, subprocess

ROOT = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True).stdout.strip()
BASE = os.path.join(ROOT, "shared/core/tests/lockstep/citadels")
MAP = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "rename-map.json")))

SPEC_RE = re.compile(r'(from\s+|import\s*\(\s*|import\s+)(["\'])(\.[^"\']*)(\2)')
URL_RE = re.compile(r'(new URL\(\s*)(["\'])(\.[^"\']*)(\2)')

def depth(rel):
    return rel.count("/")

def rewrite(path, d):
    src = open(path).read()
    def sub(m):
        spec = m.group(3)
        stripped = spec[2:] if spec.startswith("./") else spec
        return m.group(1) + m.group(2) + "../" * d + stripped + m.group(2)
    def sub_url(m):
        spec = m.group(3)
        stripped = spec[2:] if spec.startswith("./") else spec
        return m.group(1) + m.group(2) + "../" * d + stripped + m.group(2)
    out, n = SPEC_RE.subn(sub, src)
    out, u = URL_RE.subn(sub_url, out)
    if n or u:
        open(path, "w").write(out)
    return n + u

DESTINATIONS = {rel for _, rel in MAP["moves"]} | {rel for _, rel in MAP["second_pass"]["moves"]}

def landed_paths(dst_rel):
    # regroup2.py may have moved the file on, so the same basename can sit at either
    # pass's destination; a file of that name in an unrelated directory is not this
    # move's target.
    name = os.path.basename(dst_rel)
    return [rel for rel in sorted(DESTINATIONS) if os.path.basename(rel) == name]

def main():
    moved = skipped = rewrites = 0
    for src_rel, dst_rel in MAP["moves"]:
        src, dst = os.path.join(BASE, src_rel), os.path.join(BASE, dst_rel)
        d = depth(dst_rel)
        if os.path.exists(src):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            subprocess.run(["git", "mv", src, dst], check=True)
            moved += 1
        elif any(os.path.exists(os.path.join(BASE, rel)) for rel in landed_paths(dst_rel)):
            skipped += 1
            continue  # already moved by one of the passes: never re-prefix
        else:
            raise SystemExit(f"no source at {src_rel} and no landed file among {landed_paths(dst_rel)}")
        rewrites += rewrite(dst, d)
    print(f"moved={moved} skipped={skipped} import_specifiers_rewritten={rewrites}")

if __name__ == "__main__":
    main()
