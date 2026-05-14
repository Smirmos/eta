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
