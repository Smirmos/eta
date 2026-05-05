# Audit: 03-workouts.md

## Verdict

PASS WITH NOTES

The extraction is solid overall. All seven extractor self-flags were verified true against the source. Workout codes, durations, zones, intervals, italic notes, and the 22-row VO₂max Table D.1 are all transcribed accurately. Two small verbatim transcription errors in one ME3 quote, a small phase-elaboration that goes one click beyond the source ("Build 1, Build 2" vs source "build period"), and a couple of minor sub-rules in the appendix intros that were compressed away. None of these change the meaning of any workout. The plan generator can rely on this file.

## Critical issues

None.

## Minor issues

1. **C/ME3 verbatim error — "1 to 10" should be "0 to 10".** Extraction line 438 (and surrounding context for C/ME3) renders the RPE scale as "1 to 10": *"use a perceived exertion of 6 to 8 on a scale of 1 to 10 to gauge intensity (see Table 4.1 for details on RPE)"*. The source on p. 460 actually reads *"use a perceived exertion of 6 to 8 on a scale of **0 to 10** to gauge intensity (see Chapter 4 for details on RPE)"*. Two errors in one quoted sentence: (a) "1 to 10" → should be "0 to 10"; (b) "Table 4.1" → should be "Chapter 4". This is the only place in pp. 453–464 where the source uses "0 to 10" instead of "1 to 10", so it's a notable inconsistency in the source itself, which the extractor "fixed" silently — violating the rule against silent resolution. Flag and quote verbatim.

2. **Phase-appropriateness elaboration beyond source.** The italic notes on tempo workouts (B/Te1, C/TE1, D/TE1, E/TB1) say exactly *"build, peak, [and] race periods workout"* — a single un-subdivided "build". The extraction promotes this to **"Build 1, Build 2, Peak, Race"** in the per-entry "Phase appropriateness" field (lines 33, 106, 317, 578, 842, 890, 903). This is a defensible inference from Friel's broader Build 1 / Build 2 split (Ch 7), and the Conventions section labels it as such, but the per-entry expansion to a 4-tuple goes beyond the literal italic note. Mark as inference, or downgrade per-entry phase to literal "build, peak, race" with the Ch 7 split called out separately.

3. **Appendix B intro — explicit ordered list dropped.** Source p. 446 contains a literal list:
   > 1st set: SS / 2nd set: MF / 3rd set: ME / 4th set: AE
   This is structured content (numbered ordering rule) and should be reproduced. The extraction's Appendix B intro quote (line 43) describes the principle but omits the literal enumeration. Same paragraph also includes the rule *"A common exception is to insert an AE or SS set within the main set to allow a long recovery between high-effort sets"* which is omitted entirely.

4. **Appendix C intro — "Zone Agreement" cross-reference dropped.** Source p. 453: *"Note that heart rate and power zones don't always agree. You may want to reread 'Zone Agreement' in Chapter 4, the section that discusses their relationship."* This sentence — which is a useful cross-reference for the plan generator — is replaced with an ellipsis in the extraction's intro quote (line 45). Same goes for the Appendix D intro (line 47), where the *"Although not reflective of workout accomplishment, heart rate may also be used as an indirect way to express intensity. Some workouts rely heavily on heart rate"* sentence is elided.

5. **C/AC1 source-label typo — verified, treatment is correct but borderline rule violation.** Extraction self-flagged this and resolved as `C/AC1` based on AC2's "same as the AC1 session" cross-reference. I confirmed the source p. 461 prints **"AE1: VO₂max Intervals"** under the "Aerobic Capacity Workouts" header. The resolution is correct in substance, but the extraction prompt's Rule 7 forbids silent resolution. Recommend the file note this more prominently (currently buried in Notes line 468 and Open Questions line 949).

6. **Appendix B intro — rule about heart rate/RPE for short MF/AC/SS workouts elaborated for D but not B.** Per source p. 466 (Appendix D intro): *"For very brief intervals, as in MF and AC sessions, and for SS workouts, heart rate is of limited value. RPE is a good alternative."* This is correctly captured for Appendix D (line 47). The analogous rule in Appendix B's intro is likewise present in the source ("the more intense the main set... the longer the warm-up must be") and captured. Not actually missing — listing here only because it's adjacent to issue 4.

## Spot-check results

**A) Numerical accuracy: 5 of 5 verified correct**
- Table D.1, row "7:30 and faster → 75" ✓
- Table D.1, row "11:01–11:30 → 46" ✓
- Table D.1, row "15:31–16:00 → 30" ✓
- Table D.1, row "17:31–18:00 → 25" ✓ (last row matches; no truncation)
- C/MF1 sub-bullet 2: "53 × 16 or 50 × 15" ✓ (source p. 456)
- B/T1 "Subtract 90 seconds" ✓ (source p. 452)
- C/T1 "subtract 5 percent" for FTHR ✓ (source p. 463)

**B) Table completeness: 1 of 1 tables present**
- Table D.1 (Estimation of VO₂max from a 1.5-Mile Run Test, pp. 473–474): all 22 rows present and verbatim, header row matches exactly ("TIME FOR 1.5 MILES (MIN:SEC)" / "ESTIMATED VO₂MAX (ML/KG/MIN)").

**C) Verbatim definitions:** All sampled italic notes match exactly:
- B/Te1 italic note (p. 447) ✓
- B/MF1 "Note: Do not undertake..." (p. 448) ✓
- B/MF2 "Do this only with a partner or group" (p. 448) ✓
- D/AE1 italic walk-progression note (p. 466) ✓
- D/TE1 italic note (p. 467) ✓
- E/MF section italic disclaimer (p. 479) ✓
- E/TB1 italic note (p. 478) ✓
- E/ME-section italic note "build, peak, and race... zone 4" (p. 479) ✓
- E/AC1, E/AC2 "short-course triathletes only" (pp. 480, 481) ✓

The single verbatim failure is the C/ME3 RPE-scale quote (issue 1).

**D) Page citations: 6 of 6 verified correct**
- B/T1 cited p. 452 ✓
- B/T2 cited p. 452 ✓
- C/AC1 cited p. 461 ✓
- C/T1 computation cited p. 463 ✓
- D/MF1 cited pp. 468–469 ✓ (sub-bullet 6 starts on p. 469)
- D/T3 / Table D.1 cited pp. 473–475 ✓
- E/AC2 truncation cited p. 481 ✓ (last word on page is indeed "Aim")

**E) Hallucinated content:**
- "Build 1, Build 2" tempo-phase expansion (issue 2) — minor inference, flagged.
- No fabricated workouts, no invented zones, no smoothed numbers.
- Cadence "84–96 spm" derived in D/SS1 Notes (line 646) — this is an arithmetic derivation from the verbatim "28 to 32" right-foot strikes per 20 sec; correctly labeled as a derivation, not a source quote.

**F) Missing content:**
- Appendix B intro: literal "1st set / 2nd set / 3rd set / 4th set" enumeration on p. 446 (issue 3).
- Appendix B intro: "A common exception is to insert an AE or SS set..." rule on p. 446 (issue 3).
- Appendix C intro: "Zone Agreement" cross-reference and the "heart rate and power zones don't always agree" rule on p. 453 (issue 4).
- Appendix D intro: "Although not reflective of workout accomplishment, heart rate may also be used as an indirect way to express intensity. Some workouts rely heavily on heart rate." on pp. 465–466 (issue 4).
- D/MF1 source intro (p. 468): the source has a paragraph explicitly stating *"The purpose is to build greater force by strengthening your running muscles. Combining the greater force produced from doing this workout with the increased cadence of SS training results in improved running power."* — this purpose statement is not preserved in the extraction's D/MF1 entry (line 588+). Minor — the extraction captures protocol fully but skips the rationale paragraph.

## Self-flag verification

All seven extractor self-flags verified TRUE against source:

1. **Code-namespace collision** — TRUE. AE1 means Recovery in B/C/D and VO₂max Intervals (typo for AC1) in C; MF1 differs across B/C/D; ME1, ME2, AE2, AC1 etc. all repeat with different content. The plan-generator namespacing (`B/AE1` ≠ `C/AE1`) is required.

2. **C/AC1 typo** — TRUE. Source p. 461 prints "AE1: VO₂max Intervals" under "Aerobic Capacity Workouts" header. AC2 references "AC1 session" — confirms typo.

3. **D/T2 absence** — TRUE. Test Workouts in D goes T1 (p. 474) → T3 (p. 475). No T2.

4. **E/MF empty** — TRUE. P. 479 has "Muscular Force Workouts" header with only italic disclaimer "MF workouts are best done in isolation as stand-alone bike or run sessions. Combining them greatly increases the risk for injury." No workout codes.

5. **E/AC2 truncation** — TRUE. Source p. 481 ends with the word "Aim" with sentence cut off mid-thought. The extraction correctly flags this; reading p. 482 will be required to complete E/AC2.

6. **Phantom Table 4.3** — TRUE. Source p. 453: *"See Table 4.3 for bike heart rate zones and for bike power zones."* Per the prior 01-zones audit, Chapter 4 has Tables 4.1 and 4.2 only; no Table 4.3 exists in Ch 4. Editorial inconsistency confirmed.

7. **Tempo-code case** — TRUE.
   - B p. 447: "**Te1**: Tempo Intervals" (lowercase 'e')
   - C p. 455: "**TE1**: Tempo Endurance" (uppercase)
   - D p. 467: "**TE1**: Tempo Endurance" (uppercase)
   - E p. 478: "**TB1**: Tempo Brick" (different letter)

## Recommended action

**Ship as-is, with a follow-up patch for issues 1, 3, and 4.**

Specifically:
1. Fix the C/ME3 quote (line 438) to read *"a scale of 0 to 10"* and *"see Chapter 4 for details on RPE"* — preserving the source's actual rendering even though it disagrees with the rest of the appendix. This is a 2-character + cross-ref fix.
2. Add the literal "1st set / 2nd set / 3rd set / 4th set" enumeration to the Appendix B intro section, plus the "common exception" rule.
3. Replace the ellipses in the Appendix C and D intro quotes (lines 45, 47) with the elided sentences, particularly the "Zone Agreement" cross-reference (Appendix C) and the "heart rate may also be used as an indirect way" rule (Appendix D).
4. Optional: downgrade the per-entry "Phase appropriateness: Build 1, Build 2, Peak, Race" lines to "build, peak, race (per source italic note); see Ch 7 for Build 1 vs Build 2 split" — to match the source literally.
5. When the page range is extended past 481, complete the E/AC2 entry from the rest of p. 481 / p. 482 as flagged.

The numerical content (Table D.1, all interval prescriptions, all duration ranges, all zone targets) has been preserved correctly. The Open Questions / Cross-references sections are thorough. The plan generator can use the file in its current state without risk to workout correctness.
