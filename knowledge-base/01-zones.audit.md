# Audit: 01-zones.md

## Verdict
PASS WITH NOTES

## Critical issues

1. **Zone 5b cells in Table 4.1 are NOT [UNCLEAR] in the source — they are legibly merged with zone 5a.** The extractor flagged Bike FTPo / Run FTPa / "Commonly Called" / "Workout Type" for zone 5b (RPE 9) as `[UNCLEAR]` and asked the plan generator to treat them as "undefined." Inspection of the source page (p. 86 in printed book / PDF Table 4.1) shows that those four cells are visibly merged across the 5a and 5b rows: i.e. zones 5a and 5b share the same values for these four columns: Bike FTPo `105–120%`, Run FTPa `90–100%`, Commonly Called `Aerobic capacity (AC)`, Workout Type `Short intervals/equal recoveries (VHIT)`. The merge is the same visual pattern Friel uses elsewhere in the table (RPE 4–5 zone 3 row, RPE 6–7 zone 4 row, RPE 2–3 zone 2 row). Treating 5b's bike-power and run-pace bounds as "undefined" will leave a real gap in the plan generator. **Fix:** populate 5b cells with the same values as 5a, retaining a footnote that the cells are merged in the source.

2. **Figure 4.1 numeric duration mapping is missing entirely.** The chapter contains a small but structured chart on p. 87 labeled "Figure 4.1: Standard Triathlon race distances, compared by RPE, zone, and duration" that maps RPE → Zone → Duration (hours) and overlays Ironman / Half-Ironman / Olympic / Sprint bands. Numeric values from the figure: RPE 1→16h, 2→14h, 3→12h, 4→10h, 5→8h, 6→6h, 7→4h, 8→2h, 9→1h, 10→(not shown). Race-band overlays: Ironman spans roughly RPE 1–5, Half-Ironman ~RPE 5–6, Olympic ~RPE 6–7, Sprint ~RPE 8–9. The extraction does not reproduce these numbers at all and only references the figure obliquely once via "(pp. 81, 96)" in the summary. This is load-bearing structured content for any plan that needs to estimate race-day RPE/zone targets from race duration. **Fix:** add a Figure 4.1 reproduction block under the zone tables.

## Minor issues

1. **LT2 paragraph omits one source sentence.** The source LT2 paragraph (printed p. 94) contains a parenthetical between the LT2 definition and the "anaerobic threshold" sentence: "(Both LT1 and LT2 are shown in Table 4.1 in the 'Lactate Threshold Heart Rate (LTHR)' column.)" The extraction merges the LT2 definition and the "anaerobic threshold" sentence directly without this connector. Not factually wrong but breaks verbatim-quote claim.

2. **Boxed pull-quote callouts (sidebar marginalia) not catalogued.** Source pages in this range contain six boxed callouts: "The four ways to measure workout intensity are RPE, pace, heart rate, and power" (p. 82), "Heart rate tells you how intensely you are working" (p. 84), "A bike power meter measures the force at the pedal and the pedaling cadence" (p. 85), "Do a field test to find your FTHR" (p. 89), "Do not take risks to get good data" (p. 91), "For advanced athletes, heart rate zones change very little throughout the season" (p. 95). None are listed in the extraction. They are restatements of body text, not new content, but they are structured marginalia worth capturing as emphasis hints.

3. **"Per-discipline summary" table (extraction lines 60-63) is the extractor's synthesis, not from source.** The extractor flags this honestly ("Friel does not state a single 'primary' method..."), so it is acceptable, but a downstream reader could mistake it for a Friel-authored table. Recommend retitling it "Auditor's synthesis (not from source)" or moving it into the FLAG block.

4. **The "Heart rate lag" cons line (extraction line 43) reads "Lag in response... is implicit but not stated verbatim in this chapter."** This is honest of the extractor, but the line should not be in the "Cons (per Friel)" bullet — it should be moved to the FLAG block since Friel doesn't make this claim in this chapter at all.

5. **Cited sentence on p. 84 is fragmented across two extraction bullets.** Extraction quotes "heart rate has become the common intensity metric for runners" (p. 84) but truncates the immediately preceding sentence "So heart rate has become the common intensity metric for runners." which provides the rationale. Minor stylistic issue.

## Spot-check results

A) **Numerical accuracy: 8 of 8 verified correct** (sampled more than 5)
   - Zone 4 FTHR `94–99%` ✓ (Table 4.1)
   - Zone 5a Bike FTPo `105–120%` ✓ (Table 4.1)
   - Zone 1 Run FTPa `More than 129% of FTPa` ✓
   - Zone 5c Run FTPa `Less than 90% of FTPa` ✓
   - Table 4.2 row 13:48–14:08, Zone 5c = `1:16–max` ✓
   - Lactate test cost range `$100 to $350` ✓ (p. 95)
   - Worked FTPa example `7.875 minutes (7 minutes, 52 seconds)` ✓ (p. 91)
   - Bike course grade `less than 3 percent` ✓ (p. 89)

B) **Table completeness: 2 of 2 source tables present**
   - Table 4.1 (p. 86): present, all 10 RPE rows reproduced. Zone 5b row's four right-hand cells erroneously marked `[UNCLEAR]` (see Critical Issue #1) — the cells are not missing from the extraction, but they're populated wrongly.
   - Table 4.2 (p. 92): present, all 37 data rows reproduced. Spot-checked 20 cells across 17 different rows (Zone 1, 2, 3, 4, 5a, 5b, 5c columns) — all match source exactly. No transcription errors found. The 10:29–10:40 Zone 5b lower bound of `0:58` (which appears non-monotonic vs. the row above) is faithful to the source — a quirk in Friel's table, not an extraction bug.
   - Figure 4.1 numeric mapping: present in source as structured chart, **missing** from extraction (see Critical Issue #2).

C) **Verbatim definitions:**
   - LT1 definition (p. 93): **PASS** — quoted verbatim including the "upper end of zone 2" follow-on.
   - LT2 definition (p. 94): **PASS WITH NOTE** — main two sentences quoted verbatim, but the connector parenthetical "(Both LT1 and LT2 are shown in Table 4.1...)" between sentences is omitted (see Minor Issue #1).
   - "Anaerobic threshold" disclaimer (p. 94): **PASS** — quoted verbatim.
   - T-time definition (p. 87): **PASS** — quoted verbatim.
   - FTPa worked example (p. 91): **PASS** — quoted verbatim including the math.
   - "RPE is highly subjective..." quote (p. 83): **PASS** — quoted verbatim.

D) **Page citations: 6 of 6 verified correct** (sampled more than 5)
   - p. 82 → "four ways a triathlete can measure workout intensity" ✓
   - p. 86 → Table 4.1 location ✓
   - p. 87 → T-time definition + Setting Training Zones header ✓
   - p. 91 → FTPa worked example + Run Pace Zones header ✓
   - p. 92 → Table 4.2 location ✓
   - pp. 93–94 → LT1/LT2 definitions ✓

E) **Hallucinated content:** None found. The extraction's synthesized "Per-discipline summary" table (extraction lines 59–66) is derivation, not hallucination — the extractor explicitly flags it as not stated by Friel. The "Heart rate lag" line is correctly disclaimed as not in the chapter.

F) **Missing content:**
   1. Figure 4.1 numeric duration mapping (RPE 1=16h through RPE 9=1h, plus the four race-distance overlays) — see Critical Issue #2.
   2. Six boxed pull-quote callouts on pp. 82, 84, 85, 89, 91, 95 — see Minor Issue #2.
   3. Source's parenthetical inside the LT2 paragraph linking it to Table 4.1's LTHR column — see Minor Issue #1.
   4. The source detail "(The same test may also be used to determine your VO₂ max, which we will get to later.)" appended to the lactate-step-test description on p. 94 is omitted from the extraction's lactate-test description.

## Self-flag verifications (the extractor's flags vs. ground truth)

1. **Zone 5b [UNCLEAR] flag — INCORRECT.** Source Table 4.1 has zones 5a and 5b sharing values for Bike FTPo / Run FTPa / Commonly Called / Workout Type via merged cells (the same merge pattern used elsewhere in the table). The cells are legibly readable in the source — the extractor mistook a merged-cell layout for illegibility. See Critical Issue #1.

2. **70–77% FTHR gap between zones 1 and 2 — CONFIRMED.** Source shows zone 1 = "Less than 70% of FTHR" and zone 2 = "78–86%" with no zone defined for the 70–77% band. Friel does not explain the gap. Extractor's decision to flag and not invent a zone is correct.

3. **LTHR phrasing for zones 2 and 4 — CONFIRMED VERBATIM.** Zone 2 LTHR = "Heart rate at LT1 minus 10 BPM"; Zone 4 LTHR = "Heart rate at LT2 plus 10 BPM". Extractor's worry about ambiguity is reasonable — these phrases describe a single-point offset, not a band, and Chapter 4 does not resolve the ambiguity.

4. **Common Perception row spans for RPE 6–8 — VERIFIED.** Source merges "Really hard" across RPE 7 and RPE 8 (single merged cell). RPE 6 alone shows "Hard." The extractor's reproduction (RPE 6 "Hard"; RPE 7 "Really hard"; RPE 8 "Really hard") un-merges the cell with consistent values, which is a faithful flat-table representation.

## Recommended action

**Fix two specific items before shipping; the rest of the extraction is solid.**

1. **Replace `[UNCLEAR]` in Table 4.1 zone 5b row** with the merged-from-5a values: Bike FTPo `105–120%`, Run FTPa `90–100%`, Commonly Called `Aerobic capacity (AC)`, Workout Type `Short intervals/equal recoveries (VHIT)`. Add a footnote: "Cells merged with zone 5a in source." Update the corresponding FLAG to note that the cells are merged, not illegible.

2. **Add a Figure 4.1 block** under the "Zone tables" section reproducing the RPE → duration mapping (RPE 1=16h ... RPE 9=1h) and the four race-distance bands (Ironman ~RPE 1–5, Half-Ironman ~RPE 5–6, Olympic ~RPE 6–7, Sprint ~RPE 8–9). Cite p. 87.

Optional polish (minor issues 1–5): add the LT2 connector parenthetical, list the six boxed callouts, retitle/relocate the synthesized per-discipline summary, move the HR-lag disclaimer to the FLAG block. None of these block use of the extraction; they are quality-of-life improvements.

After fixes 1 and 2, ship. The Table 4.2 transcription is exemplary (37 rows, all spot-checks correct), the verbatim definitions are accurate, the formulas and worked example are correct, and the page citations all verify.

---

## Re-audit (post-fix, 2026-05-05)

### Verdict
**FIXES VERIFIED**

### Scope
Focused re-audit of two critical issues flagged in the initial audit. Source verified against PDF pp. 80–96.

### Fix 1 — Zone 5b row in Table 4.1: VERIFIED
- Bike FTPo for zone 5b now reads `105–120%` ✓ (matches merged cell from 5a in source)
- Run FTPa for zone 5b now reads `90–100%` ✓
- Commonly Called for zone 5b now reads `Aerobic capacity (AC)` ✓
- Workout Type for zone 5b now reads `Short intervals/equal recoveries (VHIT)` ✓
- All four `[UNCLEAR]` markers removed
- A note has been added under the table explaining: "Zone 5b cells for Bike FTPo, Run FTPa, 'Commonly Called', and 'Workout Type' are merged with zone 5a in the source. Zones 5a and 5b share these four values; only the FTHR column and (implicitly) the LTHR column distinguish them." This is accurate and matches the visual layout in the source.
- The corresponding flag in "Open questions / flags" has been correctly retitled `[RESOLVED — zone 5b cells]` rather than left framed as an illegibility issue.

### Fix 2 — Figure 4.1 reproduction: VERIFIED
Cross-checked the new "Figure 4.1 — Race duration by RPE and zone (p. 87)" subsection against the source figure on p. 87.

RPE → Duration (hours) mapping in source figure (read directly from the PDF rendering):
- RPE 1 → 16 ✓
- RPE 2 → 14 ✓
- RPE 3 → 12 ✓
- RPE 4 → 10 ✓
- RPE 5 → 8 ✓
- RPE 6 → 6 ✓
- RPE 7 → 4 ✓
- RPE 8 → 2 ✓
- RPE 9 → 1 ✓
- RPE 10 → not shown ✓ (correctly noted as "(not shown in figure)")

RPE → Zone mapping in source figure:
- Zone 1 sits under RPE 1 only ✓
- Zone 2 spans RPE 2–3 ✓
- Zone 3 spans RPE 4–5 ✓
- Zone 4 spans RPE 6–7 ✓
- Zone 5 spans RPE 8–10 ✓
The extraction's RPE→Zone column shows zone 5 covering RPE 8/9/10 (with 10 marked "not shown" for duration), which is faithful.

Race-distance band overlays in source figure:
- IRONMAN bar: spans roughly the left half of the chart, ending around RPE 5. Extraction says "~RPE 1–5" ✓
- HALF-IRONMAN bar: short bar centered roughly over RPE 5–6 area. Extraction says "~RPE 5–6" ✓
- OLYMPIC bar: short bar covering roughly RPE 6–7. Extraction says "~RPE 6–7" ✓
- SPRINT bar: short bar at the right end over roughly RPE 8–9. Extraction says "~RPE 8–9" ✓

Caption quoted as "Standard Triathlon race distances, compared by RPE, zone, and duration." — verbatim match to source caption ✓
Page citation (p. 87) correct ✓
Interpretation hint quoted from p. 86 ("as duration ('Time to Exhaustion') increases, RPE and zones decrease of necessity. For example, you can't run a marathon at your 5 km pace.") — verbatim match ✓

### Regression scan (other sections)
Quick sanity check of sections not directly modified:
- Definitions of RPE, Pace, Heart Rate, Power: intact and verbatim citations check out (pp. 82–85) ✓
- Threshold concepts (FTHR, LT1, LT2, FTPo, FTPa, T-time): unchanged from prior audit; LT1 and LT2 verbatim quotes still match source pp. 93–94 ✓
- Table 4.2 swim zones (37 rows): unchanged from prior audit; structure intact ✓
- Zone derivation formulas (FTHR/FTPo/FTPa, ×0.95 / ×1.05): intact ✓
- Worked FTPa example (7.5 → 7.875 min): intact ✓
- Test execution rules (warm-up, pacing, cooldown, rest, course): intact ✓
- Intensity distribution paragraph (polarized vs. pyramidal): intact, p. 96 quote unchanged ✓
- Cross-references to Chapters 2/3/7/8 and Appendices B/C/D: intact ✓

No regressions introduced.

### New issues introduced by the fix
None of substance. Two minor observations:

1. **Zone 5 / RPE 10 entry in the new Figure 4.1 table is slightly underspecified.** The table row for RPE 10 shows `Zone | 5 | (not shown in figure)`. In the actual figure, zone 5 visually spans RPE 8–10 — the duration for RPE 10 isn't plotted, but the zone band does include it. The extraction's wording "(not shown in figure)" applies to the duration value only, which is what the column header says, so this is technically correct. Not a blocker.

2. **The race-band overlay positions in Figure 4.1 are approximations.** The extraction prefixes them with `~RPE 1–5` etc., which is appropriate hedging since the figure shows continuous bars whose left/right edges don't align perfectly with integer RPE tick marks. The "~" hedge is preserved in the extraction. Good practice; downstream consumers should not treat these as sharp bounds.

### Minor issues from the prior audit (still open, not blockers)
The original audit noted four minor polish items. None were addressed in this fix pass, but none block use of the extraction:
- LT2 connector parenthetical "(Both LT1 and LT2 are shown in Table 4.1...)" is still merged into the LT2 paragraph rather than included as a connector. **Update on re-audit:** actually the extraction *does* still preserve the substantive content of this parenthetical via the `[FLAG FTHR vs. LTHR overlap]` flag. Cosmetic.
- Six boxed callouts on pp. 82, 84, 85, 89, 91, 95 still uncatalogued.
- Per-discipline summary table still labeled as "Per-discipline summary (Friel's recommended primary method)" with FLAG underneath; the suggested retitling to "Auditor's synthesis" was not done. The FLAG underneath does honestly disclaim the synthesis, so this is acceptable.
- HR-lag disclaimer line is still in the "Cons (per Friel)" bullet rather than moved to the FLAG block.

### Recommended action
**Ship as-is.** Both critical fixes landed cleanly with no regressions. The minor polish items from the original audit remain open but were never blockers; they can be addressed in a future polish pass or deferred indefinitely.
