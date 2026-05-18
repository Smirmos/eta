# test-profile-5day.json — synthetic fixture, NOT a real athlete

Cloned from `test-profile.json` (Arkadiy, Tallinn IM 2026-08-22, 6 days/week)
with one field flipped: `trainingDaysPerWeek: 6 → 5`. All other fields
including thresholds, race date, history, and warnings are identical.

## Why it exists

ETA-29 added day-count handling to the macro plan prompt (rule 11) for
trainingDaysPerWeek ∈ {5, 6, 7}. The 6-day path is covered by the real
Tallinn fixture. The 5-day path needs a fixture to exercise the
prompt's drop-2-sessions logic and rule-22-violation flagging, but
Arkadiy is not actually a 5-day athlete. Hence this synthetic.

## How it differs structurally from real fixtures

- `trainingDaysPerWeek: 5` instead of 6.
- An extra synthetic-fixture warning appended so the rule-22 reckoning
  is visible to the LLM and to anyone reading the resulting plan.

Everything else is unchanged. Thresholds, planned weekly hours,
discipline distribution, long-session days, race-week handling — all
inherited from the production profile so the only variable under test
is the day-count interpolation path.

## Usage

```sh
pnpm generate:test-plan -- --profile=scripts/test-profile-5day.json
```

(The script accepts an optional `--profile` flag; defaults to
`scripts/test-profile.json`.)

## Status

**NOT a production baseline.** The fixture exists to validate the
5-day path of the macro prompt and is committed alongside its audit
markdown for that purpose only. The current production baseline is
the 6-day Tallinn macro plan (and its v3 weekly detail, post-ETA-29
regeneration).
