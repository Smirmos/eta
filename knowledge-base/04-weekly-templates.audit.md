# Audit: 04-weekly-templates.md

## Verdict

PASS WITH NOTES

## Critical issues

(None — all load-bearing tables (8.6A–F, 8.4, 8.5, 8.1, 8.2, 8.3) match source byte-for-byte for the rows/cells that render cleanly. No inverted Mon/Tue cells, no Basic→Advanced flips, no fabricated rows.)

## Minor issues

1. **Rule 6 (p. 210) — verbatim defect.** Extraction reads: *"These are the sessions that stressful enough to produce greater fitness…"*. Source p. 210 reads: *"These are the sessions that **are** stressful enough to produce greater fitness — you break through to a new level of fitness."* The auxiliary verb "are" is dropped in the extraction, breaking the quote. Fix in place.

2. **Rule 4 (p. 209) — slight citation drift.** Extraction cites the "Anchors" definition at p. 209. The body-text section header "Anchor Workouts" and the opening sentence (*"'Anchors' are workouts that are tied to specific days and times. Write these into your weekly plan first…"*) do begin on p. 209 (last paragraph), but the gray-box pull-quote with the same wording is on p. 210. Pull-quote callout #11 in the extraction correctly cites p. 210 for the callout. The Rule 4 citation (p. 209) is also defensible because the body text is on p. 209. No fix needed; flagged for awareness.

3. **Rule 32 (p. 232) — citation off by one page.** Extraction cites the T1-rehearsal sentence at p. 232. Source: the sentence "(You should rehearse your T1 transition several times during the peak and race periods.)" appears on p. 233 (in the "Brick Workouts" section, immediately under the section header). The page-232 overlay does *not* include this sentence — the overlay paragraph is the long-ride/long-run discussion, not the brick-workout T1 sentence. Fix in place: change `(p. 232)` → `(p. 233)`.

4. **Table 8.6F editorial note — small inaccuracy.** Extraction note: *"All non-race workouts are Advanced (i.e., muscular endurance / aerobic capacity per the Race-Period overlay rule above)."* The Monday Swim cell is **"Optional"**, which is neither Advanced nor a race workout. Tighten note to "All non-race, non-optional workouts are Advanced."

5. **Pull-quote callout #16 (p. 215) — page citation drift.** Callout in extraction: *"Peak period usually starts two to three weeks before an A-priority race."* cited at p. 215. Source: this gray-box callout actually appears on p. 215 — VERIFIED. (No fix.)

6. **Page-215 quote (rule 8 / Table 8.1 narrative) — minor truncation.** Extraction begins with: *"in the early base period, the athlete does only four breakthrough sessions in a week…"*. Source p. 215 begins: *"Note in this example that in the early base period, the athlete does only four breakthrough sessions in a week…"* The extraction tacitly drops the lead-in. Quote is otherwise faithful. Acceptable as a partial quote.

7. **Caption-vs-footnote contradiction in Table 8.2 — confirmed real.** Source caption (p. 218): "TABLE 8.2 Example of a Two-Week Peak Period Routine". Source footnote (p. 219): "This example is for an experienced triathlete doing several two-a-day workouts per week during base and build periods." This is genuinely contradictory in the source; the extraction's flag is correct.

8. **Table 8.4 / 8.5 [UNCLEAR] markings — appropriate.** Pages 229 and 232 in the source PDF do have body-paragraph text overlaying the tail rows of Tables 8.4 and 8.5 respectively. Cells in the overlap zone (Tue at 29:00 and 29:30, plus the 32:30 row of Table 8.4; weekly TSS > 1,200 for Table 8.5) are partly obscured by the overlapping text "What about when both workouts are breakthroughs?" (Table 8.4) and "The other common issue that must be addressed for triathletes is the order of their long ride and run workouts…" (Table 8.5). The `[UNCLEAR]` markings are defensible — some values are partly readable but the safety call is reasonable.

## Spot-check results

A) **Numerical accuracy: 5 of 5 verified correct.**
- Table 8.4 / 4:00 row → 0:00,1:00,0:00,0:00,0:00,1:30,0:30 ✓
- Table 8.4 / 12:00 row → 1:00,2:00,1:00,2:00,1:30,3:00,1:30 ✓
- Table 8.4 / 28:00 row → 1:30,5:00,3:00,4:30,4:00,6:00,4:00 ✓
- Table 8.5 / 800 row → 50,130,90,130,90,200,110 ✓
- Table 8.5 / 1,200 row → 70,210,130,190,170,260,170 ✓

B) **Table completeness: 8 of 8 tables present.**
- Table 8.1 (p. 216) ✓
- Table 8.2 Week 1 + Week 2 (pp. 218–219) ✓
- Table 8.3 Saturday + Sunday Race (p. 221) ✓
- Table 8.4 Daily Training Hours (pp. 228–229) ✓ (clean rows 4:00–28:00; tail with [UNCLEAR] flags)
- Table 8.5 Daily TSS (pp. 231–232) ✓ (clean rows 240–1,200; tail flagged)
- Tables 8.6A, 8.6B, 8.6C, 8.6D, 8.6E, 8.6F (pp. 238–239) — all 6 templates verified cell-by-cell ✓
- Figure 8.1 (Annual Training Plan, pp. 203–204) — not extracted as a table; chapter content is the worked example, not a row-rule. Acceptable omission since 8.1 is illustrative figure, not load-bearing data.

C) **Verbatim definitions:**
- "Anchors" definition (p. 209): extraction quotes verbatim. PASS.
- "Breakthrough" definition (p. 210): MINOR verbatim defect — extraction drops "are" from "These are the sessions that **are** stressful enough…". FAIL (minor).
- AE2 / efficiency-factor test (p. 206): extraction paraphrases the procedure (10% threshold, 5% threshold) but the source itself uses near-identical numerical thresholds. PASS — the operationalization is faithful.
- AC workout definition (p. 234): extraction quotes verbatim *"An aerobic capacity workout is one involving short intervals (usually less than four minutes for each interval) done at a very high intensity — zones 5a and 5b — with short recoveries (again, four minutes or less)."* PASS.
- "Five-2 distribution" (p. 209): extraction quotes verbatim. PASS.

D) **Page citations: 4 of 5 verified correct.**
- Rule 1 (5-2 distribution, p. 209) ✓
- Rule 19 (limiter sport scheduled first, p. 226) ✓
- Rule 20 (active-recovery first session, p. 229) ✓ (overlay-zone but readable)
- Rule 32 (T1 rehearsal, p. 232) ✗ — actually p. 233.
- Rule 49 (omission priority, p. 238) ✓

E) **Hallucinated content: none found.** Every quoted callout, every workout-placement rule, and every table cell traces back to a sentence or table cell on the cited page. No "Wikipedia-style" generic training advice slipped in. The interpolation flags (Saturday-race variant of Table 8.6F, 5/6/7-day variants of Tables 8.6A–E) are correctly labeled "interpolation, not source content."

F) **Missing content:**
- **Figure 8.1 (Annual Training Plan, pp. 203–204)** is not extracted in tabular form. The figure is a worked example showing one athlete's 52-week ATP. Rationale for omission is reasonable (it's a worked example illustrating the rules above, not a per-week rule itself), but plan-generator authors may want the example for validation. Recommend a brief note that Figure 8.1 exists at pp. 203–204 and shows the AA/MT/MS/SM weights progression and ability columns visually for an entire 52-week cycle.
- **Pull-quote on p. 215** ("Peak period usually starts two to three weeks before an A-priority race.") — captured as callout #16. ✓
- **"Reverse periodization" discussion (p. 211)** — not captured as a separate rule. Source defines reverse periodization and explains why long-course AC-in-base-3 is *not* reverse periodization. The extraction's rule 36 captures the placement rule but not the terminology defense. Acceptable.
- **Rule about not using heart rate for 90-second race-week intervals (p. 218)** — captured as part of the "Race-week rule" verbatim block. ✓

## Chapter-8-specific findings

1. **Tables 8.6A–F (pp. 238–239)** — verified cell-by-cell, all 6 templates. No flipped weekdays. No Basic↔Advanced flips. The per-table workout counts (Total 12 / 12 / 13 / 12 / 11 / 19) derive correctly from the cells. Editorial notes about differences between tables (e.g., "Table 8.6D differs from Base 3 only by removing Run Friday") are accurate.

2. **Tables 8.4 and 8.5** — the in-extraction rows up to weekly hours 28:00 (Table 8.4) and weekly TSS 1,200 (Table 8.5) are 100% accurate against the source. The `[UNCLEAR]` cells in the overlap region are appropriate — pp. 229 and 232 in the source PDF really do have body-paragraph text rendered on top of the table tail rows. The extraction's flag note is accurate: this is a real PDF rendering issue, not a transcription failure.

3. **Tables 8.1, 8.2, 8.3** — structure verified. The Table 8.2 caption ("Two-Week Peak Period Routine") vs footnote ("base and build periods") contradiction is genuinely present in the source; extraction's flag is correct. The Thursday-Workout-2 multi-line cell in Table 8.1 is faithfully rendered.

4. **Workout placement rules 1–50** — spot-checked rules 1, 4, 6, 19, 20, 32, 38, 41, 49. All page citations match the source except rule 32 (T1 rehearsal, cited p. 232 → actual p. 233). Rule 6 has a verbatim defect (missing "are"). All other rules are faithful.

5. **Pull-quote callouts** — spot-checked callouts #1 (p. 197), #11 (p. 210), #13 (p. 213), #20 (p. 218), #23 (p. 224), #28 (p. 234), #30 (p. 236). All appear in gray sidebar boxes in the source on the cited pages with verbatim wording. PASS.

6. **Cross-reference to 03-workouts.md AE2** — verified. `grep` confirms AE2 entries at lines 86 (Appendix B), 297 (Appendix C), and 558 (Appendix D). Extraction cross-reference accurate.

7. **Page citations** — all citations are PDF page numbers (per EXTRACTION_PROMPT rule 8). Spot-check of rule 32 caught a 1-page drift (232 vs 233). Other 4 of 5 spot-checked citations are correct.

## Recommended action

**Ship as-is with three small fixes in place:**

1. Rule 6 — restore the missing "are": *"These are the sessions that **are** stressful enough to produce greater fitness…"*
2. Rule 32 — change page citation from `(p. 232)` to `(p. 233)`.
3. Table 8.6F editorial note — change *"All non-race workouts are Advanced"* to *"All non-race, non-optional workouts are Advanced"* (Monday Swim is "Optional").

No re-extraction needed. The load-bearing per-phase weekly templates (8.6A–F) and the volume lookup tables (8.4, 8.5) are accurate to the source. The captured workout-placement rules are faithful with one verbatim defect and one off-by-one citation. The extraction's flags about (a) Table 8.2 caption/footnote contradiction, (b) Table 8.4/8.5 overlay obscuring tail rows, (c) absence of Saturday-race variant of Table 8.6F, and (d) absence of explicit 5/6/7-day variants are all confirmed as accurate observations of the source — not transcription failures.
