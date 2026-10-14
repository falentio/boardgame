#!/usr/bin/env python3
"""Regroup the citadels test suite: git mv each file per the rename map, then
rewrite every relative import specifier by the file's new depth.

Idempotent: a move whose target already exists and whose source is gone is skipped.
"""
import glob, json, os, re, subprocess, sys

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
    out, n = SPEC_RE.subn(sub, src)
    out, u = URL_RE.subn(lambda m: m.group(1) + "../" * d + m.group(2) + m.group(3), out)
    if n or u:
        open(path, "w").write(out)
    return n + u

def main():
    moved = skipped = rewrites = 0
    for src_rel, dst_rel in MAP["moves"]:
        src, dst = os.path.join(BASE, src_rel), os.path.join(BASE, dst_rel)
        d = depth(dst_rel)
        # A later pass may have moved the file on again (regroup2.py), so resolve the
        # final location by basename; only a file that exists nowhere is an error.
        landed = glob.glob(os.path.join(BASE, "**", os.path.basename(dst)), recursive=True)
        if not os.path.exists(src) and landed:
            skipped += 1
            continue  # already moved and already rewritten: never re-prefix
        else:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            subprocess.run(["git", "mv", src, dst], check=True)
            moved += 1
        rewrites += rewrite(dst, d)
    print(f"moved={moved} skipped={skipped} import_specifiers_rewritten={rewrites}")

if __name__ == "__main__":
    main()
