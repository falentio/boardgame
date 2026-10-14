#!/usr/bin/env python3
"""Second regroup pass: group the cross-family sweeps, merge the theatre/theater
spelling duplicate, and repoint prose at the new filenames."""
import os, re, subprocess

ROOT = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True).stdout.strip()
C = os.path.join(ROOT, "shared/core/tests/lockstep/citadels")

CROSS = ["broad-sweep", "naming-windows", "declared-types", "threat-and-gather",
         "witch-and-threat", "turn-model"]

SPEC = re.compile(r'(from\s+|import\s*\(\s*|import\s+)(["\'])(\.[^"\']*)(\2)')
URL = re.compile(r'(new URL\(\s*)(["\'])(\.[^"\']*)(\2)')

def deepen(path):
    src = open(path).read()
    def bump(m):
        spec = m.group(3)
        stripped = spec[2:] if spec.startswith("./") else spec
        return m.group(1) + m.group(2) + "../" + stripped + m.group(2)
    out, n = SPEC.subn(bump, src)
    out, u = URL.subn(bump, out)
    if n or u:
        open(path, "w").write(out)
    return n + u

os.makedirs(os.path.join(C, "rules/cross-cutting"), exist_ok=True)
for name in CROSS:
    src = os.path.join(C, "rules", name + ".test.ts")
    dst = os.path.join(C, "rules/cross-cutting", name + ".test.ts")
    if not os.path.exists(src) and os.path.exists(dst):
        print(f"skipped rules/{name}.test.ts (already moved)")
        continue
    subprocess.run(["git", "mv", src, dst], check=True)
    print(f"moved rules/{name}.test.ts -> rules/cross-cutting/  specs+={deepen(dst)}")

# --- merge the British-spelled duplicate into the district's own file ---
tn = {"theatre": os.path.join(C, "districts/theatre.test.ts"),
      "theater": os.path.join(C, "districts/theater.test.ts")}

if not os.path.exists(tn["theatre"]):
    print("skipped theatre/theater merge (already merged)")
else:
    theatre = open(tn["theatre"]).read().splitlines(keepends=True)
    theater = open(tn["theater"]).read()
    start = next(i for i, l in enumerate(theatre) if l.startswith("const withCity"))
    block = "".join(theatre[start:]).rstrip() + "\n"

    assert "UNIQUE_SCORING" not in theater and "scoreGame" not in theater
    anchor = 'import { DISTRICT_HOOKS } from "../../../../lockstep/games/citadels/districts.ts";\n'
    assert anchor in theater
    theater = theater.replace(anchor, anchor
        + 'import { UNIQUE_SCORING } from "../../../../lockstep/games/citadels/districts/effects.ts";\n'
        + 'import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";\n', 1)

    header = ("\n"
        "/**\n"
        " * The Theater's end-game scoring seam: its unique points are exactly zero, the\n"
        " * crafted-city total is its cost sum plus colour and completion bonuses, and its\n"
        " * scoring function and round-start trigger are the ones the registry holds.\n"
        " */\n")
    theater = theater.rstrip() + "\n" + header + block
    open(tn["theater"], "w").write(theater)
    subprocess.run(["git", "rm", "-q", tn["theatre"]], check=True)
    print("merged districts/theatre.test.ts -> districts/theater.test.ts; removed theatre.test.ts")

# --- repoint prose at the new filenames ---
EDITS = [
    ("rules/cards/naming-window-fold.test.ts", "counterexamples in verification2.test.ts pin",
     "counterexamples in naming-windows.test.ts pin"),
    ("rules/witch-resume/no-regather.test.ts", "(verification4 D4-1b pins",
     "(threat-and-gather.test.ts D4-1b pins"),
    ("rules/witch-resume/no-regather.test.ts", "and verification15's Spy row",
     "and purse-timing.test.ts's Spy row"),
]
for rel, old, new in EDITS:
    path = os.path.join(C, rel)
    src = open(path).read()
    if old not in src:
        print(f"skipped prose repoint in {rel} (already repointed)")
        continue
    open(path, "w").write(src.replace(old, new))
    print(f"repointed prose in {rel}")
