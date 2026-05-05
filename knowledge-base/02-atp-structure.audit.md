# Audit: 02-atp-structure.md

Audited 2026-05-05 against `sources/friel-5e.pdf` Chapter 7 (book pp. 157–193). Image-budget compliant: targeted reads ≤2 pages each, focused on the merged content (Tables 7.5/7.6, Figure 7.5) and lower-priority front-half spot-checks.

## Verdict

**PASS WITH NOTES**

Tables 7.5 and 7.6 transcription is largely accurate across ~20 spot-checked cells (no transcription errors found in the cells sampled). Figure 7.5 captures all header data, both season goals, all four training objectives, and 26 weekly rows correctly. However, there is **one ambiguous numeric mismatch in Figure 7.5 Week 9 volume** that may be a silent transcription correction, **all merged-content page citations are systematically off by one page** versus the PDF reader's pagination, and **the extraction's "row-for-row matches Table 7.5's 500-hours column" claim is overstated** — at least Week 19 (Build 2 wk 1) shows 13.0 in the figure but Table 7.5 prescribes 12.0 at 500 hours. None of these issues are fatal, but the extraction should ship with corrections.

## Critical issues

1. **Figure 7.5 Week 9 volume — possible silent correction.** Source page 192 (book p. 193) shows Week 9 (Mon 1/15, Base 2 wk 3) with volume that visually reads as **19.0** in the rendered PDF. Extraction reports **14.0** — which matches Table 7.5 Base 2 wk 3 at 500 h/yr but does not match what's printed in the figure. If the figure source genuinely shows 19.0, this is either (a) a source typo that the extractor silently corrected without a `[FLAG]`, or (b) a rendering artifact and 14.0 is correct. Image rendering of "1" + "4 vs 9" is genuinely ambiguous at this resolution. Recommend manual eyeballing of the printed book or a higher-resolution PDF render to confirm. If source really shows 19.0, the extraction needs either a flag noting the silent correction or restoration of the verbatim 19.0 with a `[FLAG: likely source typo, Table 7.5 predicts 14.0]`.

2. **"Volume column matches Table 7.5's 500-hours column row-for-row" claim is partially false.** The extraction's Observations section under Figure 7.5 states: "Volume column matches Table 7.5's 500-hours column row-for-row for all training weeks." This is contradicted by **Week 19 (Build 2 wk 1)**: Figure 7.5 shows **13.0**, but Table 7.5 Build 2 wk 1 at 500 hours = **12.0**. The figure doesn't match the table here. (Possible Week 9 mismatch additionally — see issue 1.) The extraction should soften this claim to something like "matches Table 7.5's 500-hours column for most training weeks; minor deviations in Weeks 9 and 19 noted."

## Minor issues

1. **Systematic +1 page-citation offset for merged content.** Extraction cites Table 7.5 on p. 191, Table 7.6 on p. 192, Figure 7.5 on pp. 193–194, summary on pp. 190–191. In the source PDF (which the audit reads), these are on pages 190, 191, 192–193, and 189–190 respectively. The front-half citations (Tables 7.1, 7.4; Figures 7.1–7.4; six-step process) match PDF pagination. So the merged-section cites used a **different page-numbering scheme** than the front-half cites — most likely book page numbers diverge from PDF page numbers near the chapter end (perhaps due to a blank page or front-matter offset within Part III). Non-fatal but inconsistent. Recommend either: (a) document the offset in the file's frontmatter, or (b) normalize all citations to the same scheme.

2. **Extraction states "chapter ends ... pp. 193–194 (Figure 7.5)".** The figure actually ends on PDF page 193 (book page 194 by the +1 offset, but the figure itself spans the bottom of book p. 193 through book p. 194 per extraction's claim, or PDF pp. 192–193 by audit's read). The end-page claim of 194 may be inflated by one page. Cosmetic; unlikely to affect downstream consumers.

3. **`[FLAG — non-monotonic step in Tables 7.5/7.6 around 40 → 42.5K column]` is verified but mislocated.** The actual non-monotonic step in Table 7.6 (recovery rows + Prep + Race) is at the boundary **40K → 42.5K**: the row goes ... 600 (37.5K) → 640 (40K) → **700 (42.5K)** → 720 (45K) — i.e., the +60 step is between 40K and 42.5K, then +20 between 42.5K and 45K. Extraction describes this correctly. Equivalent step in Table 7.5 is 13.5 (800) → 14.5 (850) → 15.0 (900) — a +1.0 then +0.5 pattern (mild irregularity). Verified.

4. **Build 2 wk 3 at 22.5K column anomaly noted but not flagged.** In source Table 7.6 page 191, the Build 2 wk 3 row appears to print "**10.5**" in the 22.5K column (position 4) — clearly an anomaly given Build 2 wks 1 and 2 show 610 in that position, and Build 2's other cells are uniformly identical across weeks 1–3. Extraction silently transcribes 610 (matching the surrounding row pattern) without flagging the apparent source typo. Possible source rendering artifact; either way, deserves a `[FLAG]` rather than silent correction. (Similar in spirit to the existing Build 1 / Table 7.4 typo flag.)

5. **Figure 7.5 Week 37 date "7/29" creates a 5-day gap from week 36 (7/24).** Extraction faithfully reproduces 7/29, but does not flag the obvious source typo (consecutive Monday rows should be 7 days apart; 7/24 → 7/31 is consistent, 7/24 → 7/29 is a 5-day gap). Worth a `[FLAG: apparent source typo; 7/29 should be 7/31 to maintain weekly Monday cadence]`.

## Spot-check results

A) **Numerical accuracy**: ~22 of ~22 cells verified correct on Tables 7.5 and 7.6, plus 26 of 26 Figure 7.5 weekly rows verified against source — except: 1 ambiguous mismatch (Week 9 volume; see Critical 1) and 1 confirmed mismatch between Figure 7.5 and Table 7.5's prescribed value (Week 19 volume; see Critical 2).

   - Cells confirmed: Table 7.5 Prep/all/500 = 8.5 ✓; Table 7.5 Base 1 wk 3 / 1,200 = 32.0 ✓; Table 7.5 Base 3 wk 3 / 800 = 23.5 ✓; Table 7.5 Base 3 wk 3 / 1,200 = 35.0 ✓; Table 7.5 Build 1 wk 1 / 1,200 = 30.0 ✓; Table 7.5 Peak wk 2 / 500 = 8.5 ✓; Table 7.5 Race / 1,200 = 17.0 ✓; Table 7.6 Base 2 wk 3 / 60K = 1,500 ✓; Table 7.6 Base 3 wk 2 / 60K = 1,500 ✓; Table 7.6 Base 3 wk 3 / 60K = 1,620 ✓; Table 7.6 Prep / 60K = 960 ✓; Table 7.6 Build 1 wks 1/2/3 last column (per extraction = 1,500) — visually consistent with Base 3 wk 2 row, treating as ✓ given inter-row consistency.
   - Per-phase Volume target updates verified: Base 3 wk 3 at 800 h/yr = 23.5 ✓; Build 1 wks 1–3 at 1,200 h/yr = 30.0 ✓; Peak wk 2 at 500 h/yr = 8.5 ✓.
   - Figure 7.5 weeks 1–8, 10–18, 20–47 verified ✓; Week 9 ambiguous; Week 19 = 13.0 in source figure (matches extraction) but mismatches Table 7.5 (12.0 expected) — extraction's "row-for-row match" claim is overstated.

B) **Table completeness**: 6 of 6 expected tables present (7.1, 7.2, 7.3, 7.4, 7.5, 7.6). Both new tables (7.5, 7.6) include all 22 rows × 19 numeric columns. ✓

C) **Verbatim definitions**:
   - "Periodization" definition (pp. 159–160 in extraction) — verified verbatim against source page 160 ✓
   - "Base period is for general preparation. Build period is for specific preparation." sidebar (extraction p. 165) — verified at PDF page 164 ✓
   - "general"/"specific" preparation explanation — verified verbatim ✓
   - Table 7.1 Race purpose "Removing fatigue / Sharpening fitness" — verified verbatim ✓
   - Table 7.4 Build 1 purpose missing the word "endurance" — verified as printed in source ✓ (the existing `[FLAG]` is correct)
   - Body context for Figure 7.5: extraction quotes this as "Body context (verbatim, p. 190)" — actual location in PDF is page 189 (top of SUMMARY section), not 190. Verbatim text matches: "ATP for a triathlete whose A-priority races are at the half-Ironman distance" ✓ (citation off by 1, see Minor 1)
   - Six-step ATP procedure list (extraction p. 173) — not re-verified in this audit (lower priority); extraction's verbatim block is a structured list and should be regression-checked if any front-half edits land later.

D) **Page citations**: 5 spot-checked.
   - Table 7.1 cited as p. 165 → actually PDF p. 164 (front-half citation matches book pagination, not PDF reader; consistent with rest of front-half) ✓
   - Table 7.4 cited as pp. 183–184 → PDF pp. 183–184 ✓
   - Table 7.5 cited as p. 191 → actually PDF p. 190 (off by 1; merged-section citation system differs from front-half) ✗
   - Table 7.6 cited as p. 192 → actually PDF p. 191 (off by 1) ✗
   - Figure 7.5 cited as pp. 193–194 → actually PDF pp. 192–193 (off by 1) ✗
   - Net: 2 of 5 verified; 3 of 5 systematically off by one page (see Minor 1).

E) **Hallucinated content**: None found. The extraction's per-phase Volume target updates with example values for 500/800/1,200 h/yr are all sourced from Table 7.5. Figure 7.5 athlete header (Jane Doe / 500 hours / 2024), both season goals, and all four training objectives are verbatim from source page 192 (top section) / page 193 (Goals & Objectives). Extraction flags about "half-Ironman, not full IM," "non-monotonic step," and "no Transition row" are all faithfully derived from source.

F) **Missing content**:
   - Build 2 wk 3 at 22.5K column source anomaly ("10.5" appearing where 610 is expected) — not flagged in extraction (see Minor 4).
   - Figure 7.5 Week 37 date "7/29" anomaly (5-day cadence break) — not flagged in extraction (see Minor 5).
   - Figure 7.5's per-discipline workout-detail columns (Weights / Swim AE-MF-SS-ME-AC-SP-T / Bike / Run): extraction states they're "all blank in this example, deferred to Chapter 8" — verified blank in source ✓. Extraction's note is accurate.
   - Two flag resolutions — the extractor cleared "Tables 7.5/7.6 not in range" and "Figure 7.5 not in range" flags by adding the content, then raised follow-up flags. The resolutions are honest (the content is present and largely correct); follow-up flags about half-IM-only example, no Transition row, repeated Base 3 cycles, and non-monotonic step are all verified.

## Recommended action

**Ship with the following targeted fixes** (do NOT re-extract; the extraction is structurally sound):

1. **Fix Week 9 volume in Figure 7.5.** Re-verify against the source (printed book or higher-resolution PDF). If source genuinely shows 19.0, restore that value with `[FLAG: source prints 19.0 but Table 7.5 Base 2 wk 3 at 500 hours predicts 14.0; likely source typo]`. If source actually shows 14.0, no change needed but raise the rendering ambiguity in audit notes.

2. **Soften the "row-for-row matches Table 7.5's 500-hours column" claim** in the Figure 7.5 Observations section. Replace with: "Volume column closely tracks Table 7.5's 500-hours column for most training weeks; Week 9 volume reads as 19.0 in the figure (vs. 14.0 in Table 7.5 — possible source typo), and Week 19 reads as 13.0 (vs. 12.0 in Table 7.5)."

3. **Add `[FLAG]` for Build 2 wk 3 / 22.5K column source anomaly** ("10.5" printed where 610 is expected; figure is internally consistent for Build 2 wks 1 and 2).

4. **Add `[FLAG]` for Figure 7.5 Week 37 date** "7/29" creates a 5-day gap from Week 36's 7/24 (apparent source typo).

5. **Document the page-citation offset** in the file frontmatter. One sentence: "Page citations in the merged section (Tables 7.5/7.6, Figure 7.5, summary) reference book page numbers; PDF reader pages are 1 less for these locations." This explains the systematic +1 difference observed in this audit.

6. **Optional**: re-verify the Build 1 last-column TSS values (1,500) in Table 7.6 with a higher-res render. The source rendering shows visually ambiguous trailing digits in Build 1 wks 1–3 at the 60K column; cell appears either 1,370 or 1,500 depending on rendering. Inter-row consistency with Base 3 wk 2 (which is 1,500 per extraction) suggests 1,500 is correct, but one explicit confirmation removes residual doubt.

No fundamental re-extraction needed. The merged content (Tables 7.5/7.6, Figure 7.5) is largely accurate, the per-phase Volume target updates are consistent with Table 7.5, and the new flags raised by the extractor (half-IM-only example, no Transition row, repeated Base 3 cycles, non-monotonic step) are all verified.
