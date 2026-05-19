# scripts/output/ changelog

Tracks post-audit changes to code or schema that affect findings cited in the
committed audit `.md` files in this directory. Audit text is intentionally
preserved at point-in-time — this file records what's since been resolved or
superseded so a future reader doesn't have to diff the code against the audit.

---

## 2026-05-13 — ETA-20

### Resolved post-audit by commit 609324e

**Audit:** `test-week-2026-05-13T12-05-05-560Z-audit.md` (v3 baseline, PASS 0/0/2)
**Finding:** Minor #2 — TSS sum mismatch persists: `weeklyTotalTss` (509.3) vs sum
of per-workout `expectedTss` (509.2). Same 0.1 drift pattern flagged in v1
(450.0 vs 450.1) and v2 (494.1 vs 494.2).

**Resolution:** commit `609324e fix(eta-20): align per-workout, daily, and
weekly TSS to the same rounded value`. Postprocess now aggregates from the
rounded per-workout values rather than rounding the unrounded sum. After this
fix, all three user-visible views agree exactly:

```
Σ workouts[].expectedTss == Σ dailyTssDistribution == weeklyTotalTss
```

The audit `.md` continues to cite `509.3 vs 509.2` because the audit is a
point-in-time record of the fixture at the time of audit; regenerating the
fixture with the post-fix code would yield `509.2 / 509.2 / 509.2` for the
same LLM input. The fix is locked in by four regression tests in
`pass2-postprocess.test.ts` under the "TSS rounding invariant" describe block.

**Per-workout `expectedTss` values are unchanged by the fix** — the rounding
formula (`round(plannedTssForWorkout(wo), 1)`) is bit-identical pre- and
post-fix. Only the aggregates differ if regenerated.

---

## 2026-05-19 — ETA-29 follow-ups (findings 1-4)

### Resolved in prompt; fixture regeneration deferred

**Audits:** `test-plan-2026-05-14T13-32-44-683Z-audit.md` (Tallinn v3) and
`test-plan-2026-05-18T05-54-10-523Z-audit.md` (5-day synthetic).

**Findings addressed in prompt (`apps/api/src/modules/plan-generation/prompts/macro-plan.prompt.ts`):**

1. **Race-week E/AC1/E/AC2 long-course warning.** Rule 11 SHORT-COURSE-ONLY
   FLAG block now requires `[DEVIATION:]` when E/AC1 or E/AC2 is selected in
   race week for a `full_ironman` or `half_ironman` athlete. Cites
   `03-workouts.md` p. 480-481 (verbatim "recommended for short-course
   triathletes only"). Short-course races (sprint, olympic) keep prior
   behaviour with no deviation.

2. **Race-week keySessions formula bump (trainingDaysPerWeek - 1).** Rule 11
   KEYSESSION COUNT block now applies the working-week formula to race weeks
   too. Justified by Table 8.3 / Table 8.6F mirrored for Saturday-race:
   pre-race triple (Friday for Saturday-race, Saturday for Sunday-race) is
   canonical BT content and needs to be a keySession entry. User-prompt
   critical-context line updated to match.

3. **Long-run-Fri deviation.** Rule 10 RULE-28 LONG-RUN-DAY PREFERENCE block
   requires `[DEVIATION: rule 28 prefers long-run-Sat; honoring
   profile.longSessionDays which places long-run-Fri]` whenever
   profile.longSessionDays places the long run on Friday. Cites Friel rules
   25-28 verbatim from `04-weekly-templates.md` lines 568-594 (p. 232).
   Placement is not changed; the profile remains authoritative.

4. **5-day Tue+Wed consecutive BT deviation.** Rule 11 Case 5 CONSECUTIVE BT
   SIDE-EFFECT sub-block requires `[DEVIATION: rule 7 recover-after-BT
   violated; trainingDaysPerWeek=5 forces consecutive BT placement on
   <day1>+<day2>. Recommend opt-in 2-a-day or trainingDaysPerWeek=6 if
   athlete capacity permits.]` whenever build-phase BT sessions land on
   adjacent days because two-a-days are unavailable. Cites rule 7 (Friel
   p. 210).

**Findings 5 and 6 explicitly deferred** to follow-up backlog (W4 R&R
missing B/T2 retest; W13/W10 D/ME3 rationale text wrong).

### Profile date refresh

Both test profiles refreshed to reflect 2026-05-19 plan-start anchor
(`weeksUntilRace=14`). `test-profile.json` (Tallinn) is gitignored so
those edits remain local; `test-profile-5day.json` warning text in the
committed synthetic fixture is updated to "14 weeks" accordingly.

### Audit deferred

Anthropic API credit balance was depleted partway through this session
during fixture regeneration. Two prior attempts failed schema validation
(LLM emitted a 14-day gap between weeks 11→12, partly explained by a
weeksUntilRace=13 anchor inconsistency now fixed at 14). The third
attempt failed on `400 invalid_request_error: Your credit balance is too
low`.

The prompt patches were verified by static self-review against the audit
findings and KB citations. Tests (100/100) and typecheck remain clean.
A real LLM-output audit is queued for next session: regenerate both
fixtures (Tallinn 6-day and 5-day synthetic) and spawn the `plan-auditor`
agent on each to confirm findings 1-4 are resolved and no new regressions
emerged.
