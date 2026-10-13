# Cross-judge prompt (arena resume-seam) - ready to spawn at candidate completion

You are the arena cross-judge. You did NOT write any candidate.

FIRST: read /home/kevin/.pi/agent/skills/poteto-agent/SKILL.md in full.

Read the rubric at orchestrate/citadels/design/resume-seam/RUBRIC.md and the grounding at
orchestrate/citadels/design/resume-seam/GROUNDING.md. Then read each candidate's design and
diff at /tmp/arena-resume/candidate-{A,B,C}/DESIGN.md and its source diff
(cd /tmp/arena-resume/candidate-X && git diff 2>/dev/null || diff against the archive).

Score each candidate criterion by criterion (1 CLOSES THE FAMILY WITH ONE MECHANISM, 2
IDENTITY IS NOT CLOBBERABLE, 3 CODEC + PRIMITIVE, 4 NO REGRESSION, 5 SMALL SURFACE, 6
RATIONALE). Run each candidate's tests yourself if you can (cd /tmp/arena-resume/candidate-X
&& vp test shared/core/tests/lockstep/citadels/verification17.test.ts) rather than trusting its
DESIGN.md claim. Recommend a base with rationale.

Reply: a per-criterion score table, the recommended base, and the strongest 1-2 ideas from
each loser worth grafting.