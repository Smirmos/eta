# Audit: 05-recovery.md

## Verdict

PASS WITH NOTES

The extraction is unusually faithful for a chapter this dense. All numeric prescriptions, table contents, and definitions verified verbatim against source. The 53-rule list is comprehensive and accurate. A small number of minor issues (citation drift on one callout, two omitted-but-arguably-load-bearing rules from the p. 302 summary) — none rise to "fail." Ship after small fixes.

## Critical issues

(none)

## Minor issues

1. **Pull-quote callout #14 citation drift.** Extraction cites "Recovery on demand is the ultimate method for managing recovery." as p. 298. The sidebar callout box appears at the **top of p. 298** (above the body paragraph that repeats the sentence) but is rendered immediately following the p. 297 body text introducing recovery on demand. Citation as p. 298 is defensible but borderline — could equally be cited p. 297. **Fix in place: leave as p. 298 or change to "pp. 297–298" for accuracy.**

2. **Pull-quote #6 omits "theoretically" relative to body text.** The sidebar callout on p. 289 reads "Even the skinniest triathlete has enough stored fat to do a triathlon that lasts several days." (verbatim — extraction correct). The body text on p. 288 reads "Even the skinniest triathlete *theoretically* has enough stored fat..." — extraction's body-text quote at line 275 ("Even the skinniest triathlete theoretically has enough stored fat...") correctly preserves "theoretically." **No action needed; flagging for awareness — source itself is inconsistent between body and callout.**

3. **Two rules from p. 302 summary not extracted as atomic rules.**
   - **Missed rule A (p. 302):** "Second in importance are the easy days that are included every week throughout the season. These can be planned, as when a hard training day is routinely followed by an easy one or even a day off." — i.e. **within-week hard/easy alternation** as a priority second only to R&R weeks themselves. Not in rule list 1–53.
   - **Missed rule B (p. 302):** "Two other times in the season when rest and recovery are critical are in the week immediately preceding an A-priority race and the week after." — explicitly names the **week-before-A-race AND week-after-A-race** as critical rest periods. Partially captured in Rules 41–46 (taper) and Rules 47–49 (transition), but the *paired* "week before + week after" framing is missed.
   **Fix in place: add as Rules 54 and 55, both citing p. 302.**

4. **"Greatly reduce volume" interpolation (extraction's flag #10) is correctly labeled as interpolation.** The extraction proposes "default to ~50% volume" by analogy. Verified: Friel does NOT say 50% anywhere in pp. 280–302. The extraction transparently flags this as "interpolation, not source content." **No action needed; the flag does its job.**

5. **Sleep tips list (line 168–172) drops verbatim wording.** Extraction renders source's "not working out immediately before bedtime" as "Don't work out immediately before bedtime" (imperative form). Trivial paraphrase. **Fix in place: restore source phrasing to be safe.**

6. **Banana phrasing.** Extraction line 226 says "Medium banana"; source p. 289 says "medium-size banana." Trivial. **Fix in place.**

7. **Recovery on Demand: nuance about "easy day even though a hard one was scheduled" not promoted to a rule.** Source p. 297: "Heeding the morning warnings accurately is a skill most of us don't have... it sometimes implies taking an easy day even though a hard one was scheduled." This is meaningful for plan-generator behavior (override planned hard day on warning signal) but is captured only as part of the surrounding R&R-on-demand discussion, not as an atomic rule. **Fix in place: add as a rule under "Daily monitoring rules," citing p. 297.**

## Spot-check results

**A) Numerical accuracy: 5 of 5 verified correct**
- 1–1.85 g carb/kg (0.016–0.03 oz/lb), p. 288 ✓
- 120 lb / 150 lb / 170 lb worked examples (56.7–102 g, 68–127.6 g, 76.5–144.6 g), p. 288 ✓
- 10–30 g (0.35–1.05 oz) protein every 3–4 hours, p. 289 ✓
- Cheese 3 oz (85 g) = 21 g protein, p. 290 ✓
- Transition periods 3–7 days / 2–3 weeks / 2–6 weeks, p. 300 ✓

**B) Table completeness: 2 of 2 tables present**
- Table 11.1 (Common Morning Warning Indicators of Stress, p. 283): all 9 rows verified verbatim, footnote correct ✓
- Table 11.2 (Typical 5-Day Rest-and-Recovery Week, p. 296): all 7 day columns × 3 row labels verified verbatim ✓

**C) Verbatim definitions:**
- HRV (p. 283): pass — extraction quotes the full source paragraph verbatim
- Active-recovery workout (p. 291): pass — verbatim quote, "An active-recovery workout is one that doesn't further stress the body's systems."
- Recovery on demand (p. 297): pass — verbatim, including the "two consecutive days" trigger
- Zatopek effect (p. 299): pass — extraction correctly quotes "Sometimes the body must say 'enough' in order to come into form" and summarizes the historical framing. Minor: extraction's prose summary of Zatopek's biography (line 638–641) paraphrases rather than quotes the source narrative on pp. 298–299 — acceptable since it's framing context, not a load-bearing definition.
- Transition period (p. 300): pass — verbatim, "This is the transition period — a time of greatly reduced physical activity."

**D) Page citations: 5 of 5 verified correct**
- Rule 7 (R&R 3–5 days, p. 295) ✓
- Rule 33 (carb dosing, p. 288) ✓
- Rule 44 (taper run>bike>swim, p. 299) ✓
- Rule 17 (active recovery requires 3+ years, p. 291) ✓
- Rule 49 (transition 2–6 weeks last race, p. 300) ✓

(Note: callout #14 citation as p. 298 vs. p. 297 — see Minor issue #1.)

**E) Hallucinated content: none found**
No "smoothed" round numbers; no rules promoted from "may"/"could" hedging into hard rules without explicit hedge preservation. Extraction is conservative throughout — flags hedging where it exists (e.g., "may" in Rule 14 about >14 weekly workouts; "may" in Rule 31 about pre-bed protein). Notably, the extraction explicitly flags its own interpolation in Open Question #10 ("default to ~50% volume" — labeled as interpolation, not source).

**F) Missing content:**
- p. 302 summary rule: "easy days every week" priority (see Minor issue #3, Missed rule A)
- p. 302 summary rule: "week before + week after A-race" as critical rest pairs (see Minor issue #3, Missed rule B)
- p. 297 nuance: morning warnings can override a planned hard day (see Minor issue #7)

These are gaps but not critical — the load-bearing rules (R&R duration, R&R math, taper lengths, transition durations, Table 11.1, Table 11.2, two-a-day reductions) are all present.

## Chapter-11-specific findings

**1. Adaptation rules (1–53).** Spot-checked rules 1, 5, 7, 17, 22, 31, 33, 44, 49 — all faithful to source in trigger, action, and citation. No paraphrasing of "may"/"could" into hard rules detected. Rule list is approximately 95% complete; missing 2–3 atomic rules from the p. 302 summary (see Minor issue #3, #7).

**2. HRV thresholds.** Verified. Source pp. 283–284 explicitly says only "Out of normal range" (Table 11.1) and "tells you how your body is handling stress" (definition); no percentage thresholds, no "X% drop" rule, no SDNN/RMSSD numbers. Extraction's flag is accurate. The source defers numeric interpretation to the HRV4Training app explicitly.

**3. Carb / protein dosing (pp. 288–290).** All numbers verified verbatim:
- 1–1.85 g carb/kg (0.016–0.03 oz/lb) ✓
- 120 lb (54.4 kg) → 2–3.6 oz (56.7–102 g)/h ✓
- 150 lb (68 kg) → 2.4–4.5 oz (68–127.6 g)/h ✓
- 170 lb (77.1 kg) → 2.7–5.1 oz (76.5–144.6 g)/h ✓
- Banana ≈ 1 oz (28.3 g) carb ✓
- OJ ≈ 1 oz carb ✓
- OJ+banana smoothie = 2 oz carb ✓
- 10–30 g (0.35–1.05 oz) protein every 3–4 hours ✓
- Egg = 7 g protein (¼ oz) ✓
- 8 oz milk (~237 mL) = 7 g protein (¼ oz) ✓
- 3 tbsp peanut butter (~45 g) = 14 g protein (½ oz) ✓
- 3 oz cheddar (85 g) = 21 g protein (¾ oz) ✓

**4. R&R cycle math (p. 296).** All three computations verified:
- 3-week cycle, 4-day R&R → 17 days hard training (21−4) ✓
- 3-week cycle, 5-day R&R → 16 days hard training (21−5) ✓
- 4-week cycle, 3-day R&R → 25 days hard training (28−3) ✓

**5. Transition durations (p. 300).** All three ranges verified:
- Midseason short-course A-race → 3–7 days ✓
- Midseason long-course A-race → 2–3 weeks ✓
- Last race of season → 2–6 weeks ✓

**6. Cross-reference to 03-workouts.md.** Verified by grep:
```
72:### B/AE1: Recovery
283:### C/AE1: Recovery
544:### D/AE1: Recovery
822:### E/AE1: Aerobic Endurance Brick
```
The disambiguation note in extraction (line 464–467 and lines 865–868) is correct: AE1 in Ch 11 p. 297 unambiguously refers to the B/C/D Recovery workout, NOT the E/AE1 brick.

**7. Pull-quote callouts (1–17).** Spot-checked 4 callouts:
- Callout #3 "Never stand if you can lean..." (p. 285) — verified as sidebar box on p. 285 ✓
- Callout #11 "There may be a benefit to using compression garments..." (p. 294) — verified as sidebar box on p. 294 ✓
- Callout #14 "Recovery on demand is the ultimate method..." — sidebar box appears spanning the p. 297/298 boundary; citation as p. 298 is defensible but could be p. 297 (see Minor issue #1)
- Callout #15 "Sometimes the body must say 'enough'..." (p. 300) — verified as sidebar box on p. 300 ✓ (and the same sentence appears in body text on p. 299, also correctly noted)

**8. Page citations.** 5 of 5 spot-checked citations verified (see section D above). One citation (callout #14) borderline — see Minor issue #1.

## Recommended action

**Ship with 4 small fixes in place:**

1. Add Rule 54 (within-week easy days as priority #2 after R&R weeks): cite p. 302.
2. Add Rule 55 (week-before-A-race AND week-after-A-race as critical rest pair): cite p. 302.
3. Add a rule under "Daily monitoring rules" capturing the p. 297 nuance: "Morning warnings can override a planned hard day → swap to easy day even if plan calls for hard."
4. Adjust callout #14 citation to "pp. 297–298" for precision.

Optional polish:
- Restore "not working out immediately before bedtime" in sleep tips list.
- Change "Medium banana" → "medium-size banana" (trivial).

The extraction does NOT need re-extraction. It is one of the more careful extractions I've audited — all load-bearing structured content is present, citations are accurate, hedging is preserved, interpolations are explicitly flagged. The plan generator can rely on this file with the 3 rule additions above.
