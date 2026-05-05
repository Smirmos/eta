# Workout Taxonomy (Appendices B, C, D, E)

> Source: Friel 5th ed., Appendices B–E, pp. 445–481
> Extracted: 2026-05-05

## Summary

Four appendices catalogue Friel's canonical workouts: Appendix B (swim, 15 workouts, pp. 446–452), Appendix C (bike, 18 workouts, pp. 453–464), Appendix D (run, 17 workouts + Table D.1, pp. 465–475), Appendix E (brick, 8 workouts, pp. 476–481). Workouts are grouped by Friel's five abilities (AE, MF, SS, ME, AC) plus Tempo (Te/TE/TB) and Test (T) categories. Codes are NOT unique across appendices — the plan generator must reference workouts as `[appendix-letter]/[code]` (e.g., `B/AE1` ≠ `C/AE1` ≠ `D/AE1` ≠ `E/AE1`).

## Conventions

### Code disambiguation

Codes (AE1, AE2, MF1, MF2, MF3, SS1, SS2, ME1–ME4, AC1–AC3, T1–T3, Te1, TE1, TB1) are reused across appendices with different content. Always namespace by appendix letter when referencing. (pp. 446–481)

### Purpose ↔ Friel ability mapping (vs. EXTRACTION_PROMPT.md enum)

| Friel ability label (source) | Source section header | Prompt enum value | Notes |
|---|---|---|---|
| AE — Aerobic endurance | "Aerobic Endurance Sets/Workouts" | `aerobic` | clean map |
| Te / TE / TB — Tempo | "Tempo Sets/Workout(s)" | (no exact enum match) | `[FLAG]` — see Open Questions |
| MF — Muscular force | "Muscular Force Sets/Workouts" | `force` | clean map |
| SS — Speed skills | "Speed Skills Sets/Workouts" | `speed skills` | clean map |
| ME — Muscular endurance | "Muscular Endurance Sets/Workouts" | `muscular endurance` | clean map |
| AC — Aerobic capacity | "Aerobic Capacity Sets/Workouts" | `anaerobic endurance` | `[FLAG]` — Friel rejects "anaerobic" framing (Ch 4, p. 94) |
| T — Test | "Test Workouts" | `test` | clean map |

### Phase appropriateness

The appendices rarely state phase per workout. Where the source includes an italic note specifying phase ("build, peak, race periods workout intended to be used only if you are preparing for an event in which you will race in zone 3"), I record those bounds. Otherwise:
- AE1 (Recovery): "Recovery workouts are not [included/scheduled] in the annual training plan, but they are an integral part of training throughout the season." (pp. 454, 466) → all phases.
- AE2 (Aerobic Endurance): "should be done year-round, initially for building and later on for maintaining AE" (D/AE2, p. 467) → all phases.
- Tempo (Te/TE/TB): "build, peak, race periods workout" (italic note in B/Te1 p. 447, C/TE1 p. 455, D/TE1 p. 467, E/TB1 p. 478) → Build, Peak, Race.
- Bricks (Appendix E) and most multi-ability work: "Combining multiple abilities into one workout is most commonly done in the build period of the season (see Chapters 7 and 8 for more on periodization of training)." (Appendix C p. 453, Appendix D p. 465, Appendix E p. 476) → Build (per source — appendices do not subdivide; see Ch 7 for Build 1 vs Build 2 split).
- Most single-ability MF / ME / AC / SS workouts: phase not explicit in appendix. Marked `[NOT EXPLICIT IN APPENDIX]`. `[SEE: Chapter 7, p. 157+; Chapter 8, p. 194+]`

### Structure parsing

Most appendix entries don't separate warm-up / main set / cooldown explicitly — they assume the appendix-level intro for warm-up rules and only describe the main set. Where the source doesn't separate the three, I record the description verbatim under "Main set" and reference the appendix intro for warm-up.

### Appendix-level warm-up & intensity rules (verbatim, shared by every workout in that appendix)

**Appendix B intro (Swim, pp. 446–447):** "The typical order for ability sets within a single training session is aerobic endurance (AE) and/or speed skills (SS) as a warm-up, followed by muscular force (MF), aerobic capacity (AC), and muscular endurance (ME). The cooldown is commonly AE and/or SS. For example, if the main set (the portion that is neither warm-up nor cooldown) of the workout includes MF and ME, the order of all the sets within the session from warm-up through cooldown will be as follows: 1st set: SS / 2nd set: MF / 3rd set: ME / 4th set: AE. A common exception is to insert an AE or SS set within the main set to allow a long recovery between high-effort sets. The MF, ME, and AC ability sets are always a part of the main set — the primary portions of the workout that are neither warm-up nor cooldown. They should always be preceded by a warm-up. Note that the more intense the main set of the workout, the longer the warm-up must be." (pp. 446–447) "The intensities for most of the workouts below are based on pace. See Table 4.2 for swim-pace zones." (p. 447)

**Appendix C intro (Bike, p. 453):** "The MF, ME, and AC workouts listed below should be preceded by a warm-up. The warm-up for one of these workouts is at least 20 minutes and could be an hour or more depending on the total duration of the ride and your capacity for work. Gradually increase the intensity for the first half of the warm-up to zone 2. Then include a few brief (10–30 seconds) accelerations at the following workout's highest intensity with long recoveries between. You should use these three ability categories only in the main set — the primary portion of the workout that is neither warm-up nor cooldown. Note that the more intense the main set of the workout, the longer your warm-up should be. Workout intensities are described with power and heart rate. See Table 4.3 for bike heart rate zones and for bike power zones. Note that heart rate and power zones don't always agree. You may want to reread 'Zone Agreement' in Chapter 4, the section that discusses their relationship. If you have both devices, use the power meter to measure performance and the heart rate monitor to gauge effort. The power meter is the preferred intensity gauge for most workouts in the build, peak, and race periods. There are some exceptions, which are described below." (pp. 453–454) `[FLAG: appendix references "Table 4.3" for bike zones, but Chapter 4 establishes a single Table 4.1 with bike-specific columns; no separate Table 4.3 is mentioned in Ch 4. Likely an editorial inconsistency in the source.]`

**Appendix D intro (Run, p. 465):** "The MF, ME, and AC workouts listed below should be preceded by a warm-up. A warm-up for a run workout is at least 20 minutes and could be 40 minutes, depending on the total workout duration and your capacity for workload. Gradually increase intensity to zone 2 for about half of the warm-up. Then include a few brief (10 to 30 seconds) accelerations at the following workout's intensity, with long, easy recoveries between. You should perform these three ability categories only in the main set — the primary portion of the workout that is neither warm-up nor cooldown. Note that the more intense the main set of the workout, the longer your warm-up should be. AE and SS workouts may also be in the main sets and are commonly part of the warm-up and cooldown. Workout intensities are described here with pace and heart rate. See Table 4.1 for run heart rate zones and run pace zones determined by using a GPS device, a measured course, or a track. As explained in the section 'Zone Agreement' in Chapter 4, heart rate and pace zones don't always align. If you have both a heart rate monitor and a GPS device, pace is used to evaluate performance, while heart rate expresses your effort. Pace (or speed) is the preferred metric for most workouts because the goal of training is to improve performance measurably. Although not reflective of workout accomplishment, heart rate may also be used as an indirect way to express intensity. Some workouts rely heavily on heart rate. For very brief intervals, as in MF and AC sessions, and for SS workouts, heart rate is of limited value. RPE is a good alternative." (pp. 465–466)

**Appendix E intro (Brick, pp. 476–477):** "The order of sports within a brick is typically bike followed by run. But duathletes often do run-bike-run workouts because that's their common race design. … When you transition from the bike to the run in one of these brick workouts, it's recommended that you follow the same procedure you intend to use in your targeted race. … For short-course races, a brick that has about the same duration that you expect the combined bike and run portions of the race to have is common. For long-course racing, however, bricks that are equal in duration to the anticipated combined bike and run portions of the race are not recommended because the recovery afterward takes too long. When the bike portion of a brick calls for ME or AC, the workout should be preceded by a warm-up. (MF workouts are best not done as bricks.) These two ability categories are used only in the brick's main set — the primary portion of the workout that is neither warm-up nor cooldown. Note that the more intense the main set of the workout, the longer your warm-up should be. In a brick, the bike portion always serves as a warm-up for the following run." (pp. 476–477)

### Pull-quote callouts (per Rule 13)

The four appendices contain no boxed sidebar callouts in the style of Chapter 4. The closest equivalents are *italicized in-line caveats* attached to specific workouts. These are preserved verbatim in each entry's notes, and listed here for completeness:

- B/MF1: "Note: Do not undertake this set until your speed skills are very well established, as the risk for injury increases if your skills are poor." (p. 448)
- B/Te1: italic — "build, peak, race periods workout intended to be used only if you are preparing for an event in which you will race in zone 3." (p. 447)
- B/MF2: italic — "Do this only with a partner or group." (p. 448)
- B/AC1: "Important: Do not allow technique to break down." (p. 451)
- B/AC2: "Important: Focus on maintaining good posture, direction, length, and catch during each work interval." (p. 451)
- C/TE1: italic — "build, peak, and race periods workout intended to be used only if you are preparing for an event in which you will race on the bike in zone 3." (p. 455)
- D/AE1: italic — "It's okay to walk for parts—or all—of this workout. In fact, starting with a casual walk that slowly becomes a fast walk and then an easy run is a great way to get going." (p. 466)
- D/TE1: italic — "Note that this workout is a build, peak, and race periods session intended to be used only if you are preparing for an event in which you will run in zone 3." (p. 467)
- E/MF section: italic — "MF workouts are best done in isolation as stand-alone bike or run sessions. Combining them greatly increases the risk for injury." (p. 479)
- E/TB1: italic — "build, peak, and race periods workout intended to be used only if you are preparing for an event in which you will race in zone 3." (p. 478)
- E/ME section: italic — "build, peak, and race periods workout intended to be used only if you are preparing for an event in which you will race in zone 4." (p. 479)
- E/AC1, E/AC2: italic — "This workout is recommended for short-course triathletes only." (pp. 480, 481)

---

## Appendix B: Swim Workouts (pp. 446–452)

### B/AE1: Recovery

- **Discipline:** swim
- **Purpose:** aerobic endurance (AE) → enum: `aerobic`
- **Target zones:** pace zone 1
- **Typical duration:** 10 to 20 minutes or more
- **Phase appropriateness:** all phases (recovery)
- **Structure:**
  - Warm-up: [See Appendix B intro, pp. 446–447]
  - Main set: "Swim steadily for 10 to 20 minutes or more in pace zone 1, concentrating on only one aspect of technique." (p. 447)
  - Cooldown: workout itself can serve as cooldown (see Notes)
- **Notes:** "You can use this as a recovery workout after a hard bike or run workout, or as a swim session cooldown." (p. 447)
- **Source:** Appendix B, p. 447

### B/AE2: Aerobic Endurance Intervals

- **Discipline:** swim
- **Purpose:** aerobic endurance (AE) → enum: `aerobic`
- **Target zones:** pace zone 2
- **Typical duration:** intervals of 6–12 minutes each; total set distance "may match the distance of the swim portion of your next A- or B-priority race"
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7, p. 157+; Chapter 8, p. 194+]
- **Structure:**
  - Warm-up: [See Appendix B intro]
  - Main set: "Swim intervals in pace zone 2 at a distance that takes 6 to 12 minutes. Recover after each for 10 to 15 percent of the preceding work-interval time. Total work-interval distance may match the distance of the swim portion of your next A- or B-priority race. Build up to this set duration over a few sessions. A variation on this set is to recover between intervals with a 25- to 50-meter/yard drill." (p. 447)
  - Cooldown: [See Appendix B intro]
- **Example (verbatim):** "4 × 500 meters/yards in 7 minutes, 30 seconds, leaving every 8 minutes, 15 seconds. Or swim long and steady in pace zone 2, especially in open water." (p. 447)
- **Source:** Appendix B, p. 447

### B/Te1: Tempo Intervals

- **Discipline:** swim
- **Purpose:** tempo (Te, zone 3) → enum: no exact match `[FLAG]`
- **Target zones:** pace zone 3
- **Typical duration:** intervals of 3–5 minutes each; total interval time "in the range of 10 to 20 minutes"
- **Phase appropriateness:** Build, Peak, Race (per italic note)
- **Structure:**
  - Warm-up: [See Appendix B intro]
  - Main set: "*This is a build, peak, race periods workout intended to be used only if you are preparing for an event in which you will race in zone 3.* Swim three to seven intervals, each taking about 3 to 5 minutes to complete. Intensity is pace zone 3. Recover after each for 5 to 10 percent of the preceding work-interval time. The total interval time for this session should be something in the range of 10 to 20 minutes." (pp. 447–448)
  - Cooldown: [See Appendix B intro]
- **Example (verbatim):** "5 × 200 meters in 3:00, leaving on 3:15." (p. 448)
- **Notes:** Code printed as "Te1" (lowercase 'e'); other appendices use "TE1" (uppercase). `[FLAG]` — case inconsistency across appendices, see Open Questions.
- **Source:** Appendix B, pp. 447–448

### B/MF1: Muscular Force Reps

- **Discipline:** swim
- **Purpose:** muscular force (MF) → enum: `force`
- **Target zones:** not specified in zones — uses drag/paddles to increase muscular load
- **Typical duration:** 1–3 sets of 3 × 25 m/yd, with 40–60 sec standing recovery; 25–50 m/yd easy swim between sets
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: "After an extensive warm-up including short, fast repeats (such as SS1)" (p. 448)
  - Main set: "*Note: Do not undertake this set until your speed skills are very well established, as the risk for injury increases if your skills are poor.* … do one to three sets of three intervals of 25 meters/yards each. Wear a T-shirt or other such drag device, or use paddles for each interval. The purpose of using a drag device or paddles is to increase stress on the muscles and therefore generate greater force. Take a long (40–60 seconds), standing recovery at the wall after each. Between sets, swim easily as described for AE1 (above) for 25 to 50 meters/yards. The first time you do MF1, do only one set of three intervals. Gradually increase the number of sets." (p. 448)
  - Cooldown: [See Appendix B intro]
- **Notes:** "Stop this set at the first sign of shoulder discomfort, which is an indicator of poor swim skills. Instead of continuing, go to the SS1 set (below) to improve your technique before returning to the MF1 sets." (p. 448)
- **Source:** Appendix B, p. 448

### B/MF2: Open-Water-Current Intervals

- **Discipline:** swim
- **Purpose:** muscular force (MF) → enum: `force`
- **Target zones:** "nearly maximal effort" (no zone specified — current resistance)
- **Typical duration:** 8–10 strokes per high-exertion set, 60–90 sec easy-swim recovery; 3–8 sets total
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: [See Appendix B intro]
  - Main set: "Swim in a river, lake, or ocean with alternating sets against and with the current. Swim each high-exertion set against the current at nearly maximal effort without breaking form, taking 8 to 10 strokes (each arm) in each set. Recover by swimming easily with the current for 60 to 90 seconds. Complete three to eight of these sets. *Do this only with a partner or group.*" (p. 448)
  - Cooldown: [See Appendix B intro]
- **Example (verbatim):** "5 × 8 strokes at nearly maximal effort into the current with 1-minute, easy-swim recoveries." (p. 448)
- **Source:** Appendix B, p. 448

### B/MF3: Paddles

- **Discipline:** swim
- **Purpose:** muscular force (MF) → enum: `force`
- **Target zones:** zones of underlying set (not zone-specific)
- **Typical duration:** progressive — start "no more than 10 percent of the total workout distance" with paddles; cap at "50 percent of a workout"
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: [See Appendix B intro]
  - Main set: "Swim any set other than warm-up or cooldown while using paddles. When you first use paddles, start with small ones, use them only for AE sets (above), and do no more than 10 percent of the total workout distance with them. Over the course of several weeks, increase the size of the paddles. Don't do more than 50 percent of a workout with them, and never increase both paddle size and total distance within a workout at the same time." (p. 449)
  - Cooldown: [See Appendix B intro]
- **Notes:** "At the first sign of shoulder discomfort, discontinue using the paddles and return to an emphasis on SS training (below)." (p. 449)
- **Source:** Appendix B, p. 449

### B/SS1: Fast-Form 25s

- **Discipline:** swim
- **Purpose:** speed skills (SS) → enum: `speed skills`
- **Target zones:** "slow to moderate effort" — zone-agnostic (technique focus)
- **Typical duration:** variable — "a few as a part of the warm-up or cooldown, or … the entire swim session"
- **Phase appropriateness:** all phases (technique work)
- **Structure:**
  - Warm-up: workout itself can serve as warm-up
  - Main set: "Start this set by swimming one length of the pool at a slow to moderate effort. Over the next several 25s, swim each subsequent length more briskly, but never all out. While swimming a length, focus your attention on the one PDLC skill you are trying to improve: posture, direction, length, or catch. Think of nothing else for each 25. Don't time these 25s; your focus must be on technique, not on increasing the effort. When you finish a 25, stop and rest at the wall. Make each recovery long. Don't make the rest stops brief in order to improve your endurance. The only focus is on skill. Let your mind wander while you rest at the wall. Think about anything except your swim performance. You should be breathing easily before starting the next 25. When you're ready to swim the next length, bring your mental focus back to the PDLC skill you are concentrating on. Then swim another 25 focusing only on correctly making this movement." (pp. 449–450)
  - Cooldown: workout itself can serve as cooldown
- **Source:** Appendix B, pp. 449–450

### B/SS2: Toy Sets

- **Discipline:** swim
- **Purpose:** speed skills (SS) → enum: `speed skills`
- **Target zones:** zones of underlying set (not zone-specific)
- **Typical duration:** as part of any set
- **Phase appropriateness:** all phases (technique work)
- **Structure:**
  - Main set: "Do any set wearing fins or keeping a pull buoy between your thighs. These 'toys' are especially helpful during intervals within the main set for maintaining body position on top of the water while you focus on a single PDLC skill." (p. 450)
- **Source:** Appendix B, p. 450

### B/ME1: Long Cruise Intervals

- **Discipline:** swim
- **Purpose:** muscular endurance (ME) → enum: `muscular endurance`
- **Target zones:** pace zones 4 to 5a
- **Typical duration:** work intervals 6 minutes or longer; total set distance "may gradually increase over a few weeks to equal the distance of your next A- or B-priority race"
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: [See Appendix B intro]
  - Main set: "This is a session with work intervals that take 6 minutes or longer. The recovery intervals are about 5 to 15 percent of the preceding work-interval duration. As fitness improves, reduce the duration of the recovery intervals. Intensity is pace zones 4 to 5a. The total work-interval distance for the set may gradually increase over a few weeks to equal the distance of your next A- or B-priority race." (p. 450)
  - Cooldown: [See Appendix B intro]
- **Example (verbatim):** "5 × 400 meters/yards in 6:00 leaving every 6:40." (p. 450)
- **Source:** Appendix B, p. 450

### B/ME2: Short Cruise Intervals

- **Discipline:** swim
- **Purpose:** muscular endurance (ME) → enum: `muscular endurance`
- **Target zones:** pace zone 4
- **Typical duration:** intervals of 3–5 minutes; total work-interval time "may be gradually increased to match the total distance of the swim portion of your next A- or B-priority race"
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: [See Appendix B intro]
  - Main set: "Swim intervals that take 3 to 5 minutes to complete. Intensity is pace zone 4. Recover after each for about 5 to 10 percent of the preceding work-interval duration. Total work-interval time may be gradually increased to match the total distance of the swim portion of your next A- or B-priority race." (p. 450)
  - Cooldown: [See Appendix B intro]
- **Example (verbatim):** "8 × 200 meters in 3:00 leaving every 3:10." (p. 450)
- **Source:** Appendix B, p. 450

### B/ME3: Threshold

- **Discipline:** swim
- **Purpose:** muscular endurance (ME) → enum: `muscular endurance`
- **Target zones:** pace zone 4
- **Typical duration:** 12 to 20 minutes steady
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: [See Appendix B intro]
  - Main set: "Swim steadily for 12 to 20 minutes in pace zone 4." (p. 451)
  - Cooldown: [See Appendix B intro]
- **Example (verbatim):** "1,200 meters/yards in 18:00." (p. 451)
- **Source:** Appendix B, p. 451

### B/AC1: VO₂max Intervals

- **Discipline:** swim
- **Purpose:** aerobic capacity (AC) → enum: `anaerobic endurance` `[FLAG]`
- **Target zones:** pace zone 5b
- **Typical duration:** 3–5 work intervals of 2–3 minutes each
- **Phase appropriateness:** "during the build period as your fitness improves" (p. 451) → build (per source; see Ch 7 for Build 1 vs Build 2 distinction). Base-period usage of the workout itself is implicit (only the recovery-interval reduction is build-specific).
- **Structure:**
  - Warm-up: [See Appendix B intro]
  - Main set: "Complete three to five work intervals, each with a duration of 2 to 3 minutes and each with a recovery that is 10 to 25 percent of the work-interval time. Intensity is pace zone 5b. This session will gradually boost your aerobic capacity. Important: Do not allow technique to break down. Recovery intervals may be reduced to about 10 percent of the work interval during the build period as your fitness improves." (p. 451)
  - Cooldown: [See Appendix B intro]
- **Example (verbatim):** "5 × 200 meters/yards in 2:40 leaving every 3:00." (p. 451)
- **Source:** Appendix B, p. 451

### B/AC2: Aerobic Capacity Intervals

- **Discipline:** swim
- **Purpose:** aerobic capacity (AC) → enum: `anaerobic endurance` `[FLAG]`
- **Target zones:** pace zone 5b
- **Typical duration:** 1–4 intervals of 30–60 seconds each; total work-interval duration < 4 minutes
- **Phase appropriateness:** "particularly beneficial in the late build, peak, and race-week periods" (p. 451) → late build, peak, race-week (per source; see Ch 7 for Build 1 vs Build 2 distinction).
- **Structure:**
  - Warm-up: [See Appendix B intro]
  - Main set: "Swim one to four intervals with durations of 30 to 60 seconds at pace zone 5b and with long recoveries that have at least the same duration in order to fully recover before the next interval. The recovery intervals may get longer as the set progresses. Important: Focus on maintaining good posture, direction, length, and catch during each work interval. This set is particularly beneficial in the late build, peak, and race-week periods when you're preparing for a swim in which you anticipate starting the swim very fast. Total work-interval duration for one swim set is less than 4 minutes." (p. 451)
  - Cooldown: [See Appendix B intro]
- **Example (verbatim):** "3 × 50 meters/yards in 35 seconds leaving every 1:30." (p. 451)
- **Source:** Appendix B, p. 451

### B/T1: Broken Kilometer

- **Discipline:** swim
- **Purpose:** test (T) → enum: `test`
- **Target zones:** "maximal but maintainable effort"
- **Typical duration:** 10 × 100 m/yd with 10-second recoveries (10–20 minutes total)
- **Phase appropriateness:** "at the end of a rest-and-recovery period" (p. 452)
- **Structure:**
  - Warm-up: "After your standard pretest warm-up" (p. 452)
  - Main set: "Swim 10 × 100 meters/yards at a maximal but maintainable effort with exactly 10-second recovery intervals after each 100. Time the entire set, including recovery intervals, with a running clock from the start of the first 100 to the end of the 10th. Subtract 90 seconds (for recovery intervals) to produce a test 'score.'" (p. 452)
  - Cooldown: not specified
- **Notes:** "Record the time of this test set in your training diary to gauge progress over time." (p. 452)
- **Source:** Appendix B, p. 452

### B/T2: Functional Threshold Pace Test

- **Discipline:** swim
- **Purpose:** test (T) — anchors swim pace zones (Table 4.2) → enum: `test`
- **Target zones:** maximal effort over 1,000 m/yd; warm-up uses RPE 1–3 → 4–5 → "easy/somewhat hard/hard/really hard" progression
- **Typical duration:** 1,000 m/yd time-trial (≈10–25 minutes per Table 4.2 ranges, p. 92)
- **Phase appropriateness:** "at the end of each rest-and-recovery break" (p. 452)
- **Structure:**
  - Warm-up: "Start this swim session with a warm-up. For example, swim a 100 with the first 50 'easy' (RPE 1–3) and the second 50 'somewhat hard' (RPE 4–5). Rest for 30 seconds at the wall. Then do 4 × 200 with each 50 of each 200 of increasing intensity ('easy,' 'somewhat hard,' 'hard,' 'really hard.') Recover at the wall for 10 seconds between 200s. Recover for about 30 seconds after the last 50 before starting the 1,000 test set as follows." (p. 452)
  - Main set: "After your warm-up, swim continuously for 1,000 meters/yards as if racing while concentrating on maintaining good technique. Keep in mind that most athletes start this swim too fast and slow down significantly near the end. Instead, hold back at the start and try to finish faster." (p. 452)
  - Cooldown: not specified
- **Notes:** "Record the time of this test set in your training diary to gauge progress over time. Use your finish time for this test to determine your swim-pace zones (see Table 4.2) for the next training period." (p. 452) Anchors swim FTHR via avg HR × 0.95 (cross-reference: Ch 4 p. 88).
- **Source:** Appendix B, p. 452

---

## Appendix C: Bike Workouts (pp. 453–464)

### C/AE1: Recovery

- **Discipline:** bike
- **Purpose:** aerobic endurance (AE) → enum: `aerobic`
- **Target zones:** heart rate zone 1
- **Typical duration:** [NOT SPECIFIED]
- **Phase appropriateness:** all phases (recovery)
- **Structure:**
  - Warm-up: [See Appendix C intro]
  - Main set: "Do this workout in heart rate zone 1 while using the small chain ring on a flat course. Pedal with a comfortably high cadence. Alternatively, you can use an indoor trainer or rollers for these at any time of the year, especially if flat road courses are not available. Another option is to ride an electric bike to 'flatten' the hills for an easy ride. Other options for recovery in the prep and early base periods include cross-training workouts, such as cross-country skiing on a relatively flat course, and various health club machines. Note that your heart rate zones for these activities are unlikely to be the same as those for the bike. Use RPE (Table 4.1) to gauge intensity." (p. 454)
  - Cooldown: [See Appendix C intro]
- **Notes:** "Although light exercise on a bike is quite beneficial for speeding recovery among advanced triathletes, novices benefit more by taking time off from exercise. Recovery workouts are not included in the annual training plan, but they are an integral part of training throughout the season." (p. 454)
- **Source:** Appendix C, p. 454

### C/AE2: Aerobic Endurance

- **Discipline:** bike
- **Purpose:** aerobic endurance (AE) → enum: `aerobic`
- **Target zones:** heart rate zone 2
- **Typical duration:** "For sprint and Olympic-distance triathlon training, the AE portion is usually 1 to 1.5 hours long (plus warm-up and cooldown). If you're training for a half-Ironman, ride 2 to 2.5 hours (with warm-up and cooldown). Ironman athletes should do an AE portion of 3 to 4 hours (besides warm-up and cooldown)." (p. 455)
- **Phase appropriateness:** all phases ("the most important workout of your training season and should be done more than any other") (p. 454)
- **Structure:**
  - Warm-up: included in duration ranges above
  - Main set: "An important purpose of this workout is to boost aerobic fitness by improving the body's capability for delivering and using oxygen to produce energy in muscle. This is the most important workout of your training season and should be done more than any other (with the possible exception of AE1 above). … Use a heart rate monitor to gauge the intensity of this workout. See Table 4.1 to determine your zone 2, aerobic endurance heart rate. After a warm-up, ride at your AE heart rate on a flat to gently rolling course, or on an indoor trainer." (pp. 454–455)
  - Cooldown: included in duration ranges above
- **Notes:** "If you're also using a power meter, when the workout is over, divide the normalized power for the AE portion by your average heart rate for the same portion to find your efficiency factor (EF) for this session (note that Training Peaks does the math for you). An increasing EF over time indicates that your AE is improving. Note that it seldom rises linearly but instead 'ratchets' up over several weeks as fitness improves." (p. 455)
- **Source:** Appendix C, pp. 454–455

### C/TE1: Tempo Endurance

- **Discipline:** bike
- **Purpose:** tempo (TE, zone 3) → enum: no exact match `[FLAG]`
- **Target zones:** heart rate zone 3
- **Typical duration:** "an hour or more"
- **Phase appropriateness:** Build, Peak, Race (per italic note)
- **Structure:**
  - Warm-up: "After a warm-up" (p. 455)
  - Main set: "*This is a build, peak, and race periods workout intended to be used only if you are preparing for an event in which you will race on the bike in zone 3.* … ride for an hour or more on a mostly flat course or a course similar to the one you will race on. Stay mostly in heart rate zone 3. Remain seated on most hills. You can also do this workout on an indoor trainer by frequently shifting gears to increase the load and simulate hills. Accumulate several minutes of zone 3 in this manner within the ride." (p. 455)
  - Cooldown: [See Appendix C intro]
- **Notes:** "A common variation of this workout is to run 15 to 20 minutes immediately after the ride." (p. 455) — bridges to brick territory
- **Source:** Appendix C, p. 455

### C/MF1: Force Reps

- **Discipline:** bike
- **Purpose:** muscular force (MF) → enum: `force`
- **Target zones:** "very high wattage" — power as sole gauge
- **Typical duration:** 1–3 sets of 3 reps each (3–9 reps total); 3–5 minute easy pedal recovery between reps; 5–10 minute easy pedaling between sets
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8] — "Do this workout no more than once per week."
- **Structure:**
  - Warm-up: "warm up well before starting the reps" (p. 456) [See Appendix C intro for detail]
  - Main set (verbatim, sub-bullets preserved):
    - "Find a short—about 30 to 50 yards or meters long—steep hill. The grade should be about 6 to 8 percent. There should be very little traffic." (p. 456)
    - "For each rep, select a high gear, such as 53 × 16 or 50 × 15. The stronger you are, the higher and more challenging the gear can be. Your gear selection should be high enough that your highest cadence is less than 50 rpm by the end of a rep. The steepness of the hill will also play a role in gear selection, so you will need to experiment with gearing the first time you do this workout. Err on the low-gear (easy) side at first."
    - "Coast back down to the base of the hill in that high (hard) gear and almost come to a complete stop while staying balanced."
    - "As you start up the hill, stay seated. Do not stand. Drive the pedals down with a maximal effort for 5 to 10 revolutions. A revolution is one complete pedal stroke, so, for example, count your right foot driving the pedal down eight times. Alternate the leg you count for subsequent reps because you are likely to push harder with the 'counted' leg."
    - "After a rep, shift to a low (easy) gear and pedal gently for 3 to 5 minutes to allow recovery. Do not shorten the recovery time between reps because this will reduce the workout benefit of strength development. Be sure that your legs are recovered before doing the next rep."
    - "Repeat the above steps two more times for a total of three reps. That's one set. If you are doing a second set (do only one set the first time you try this workout), pedal easily for 5 to 10 minutes after each set to ensure full recovery. Be aware of how your knees feel on each rep. This is a high-risk, high-reward workout. At the first sign of any tenderness, stop the workout. Do not continue, even if the tenderness in your knees is only slight."
    - "Power, not heart rate, is the only gauge of intensity for this session. Strive to produce very high wattage on each rep."
  - Cooldown: [See Appendix C intro]
- **Notes:** "Do this workout no more than once per week. Do not do this workout if you have knee problems." (p. 456)
- **Source:** Appendix C, p. 456

### C/MF2: Hilly Ride

- **Discipline:** bike
- **Purpose:** muscular force (MF) → enum: `force`
- **Target zones:** power zones 4 or 5 on hills; power zones 1–2 on flatter portions; HR zone 4 on hills (if HR-only)
- **Typical duration:** hills 2–5 minutes each
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8] — "Do this workout no more than once per week."
- **Structure:**
  - Warm-up: [See Appendix C intro]
  - Main set: "Select a course that includes several moderately steep hills with a grade of less than 6 percent that take 2 to 5 minutes to climb. Stay seated on all hills, pedaling from the hips. That means little or no rocking of the upper body. Cadence on the climbs is 60 rpm or higher. Increase power to zone 4 or 5 on each hill. Ride in power zones 1 and 2 on the flatter portions of the course. Power is the preferred gauge of intensity for this workout, but if you're using only a heart rate monitor, aim for zone 4 on the hills. On an indoor trainer, you can simulate hills by placing a five- to seven-inch riser under the front wheel and selecting high gears and a wheel-resistance setting that will produce a slow cadence." (pp. 456–457)
  - Cooldown: [See Appendix C intro]
- **Notes:** "Do this workout no more than once per week. Do not do this workout if you are prone to knee injury." (p. 457)
- **Source:** Appendix C, pp. 456–457

### C/MF3: Hill Repeats

- **Discipline:** bike
- **Purpose:** muscular force (MF) → enum: `force`
- **Target zones:** power zone 5 (HR may reach 5a/5b late in workout, mostly zones 3–4 early)
- **Typical duration:** 3–8 climbs of 30–60 seconds each, with 2–4 minute recoveries
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8] — "Do this workout no more than once per week."
- **Structure:**
  - Warm-up: [See Appendix C intro]
  - Main set: "On a steep hill with a grade of about 6 to 8 percent that takes 30 to 60 seconds to climb, do three to eight repeats with 2 to 4 minutes of recovery between them. Maintain power zone 5 for each climb. Your heart rate may reach zone 5a or 5b by the top of the hill later in the workout, but it will be mostly in zones 3 and 4 early in the session, even though your power reading stays the same. To recover, coast while descending before starting the next rep. Climb in the saddle, holding the handlebar tops with minimal upper-body movement. Maintain a cadence of 60 to 70 rpm on each rep." (p. 457)
  - Cooldown: [See Appendix C intro]
- **Notes:** "Stop the workout if you find your knees becoming sensitive. Do this workout no more than once per week. Do not do this workout at all if you are prone to knee injury." (p. 457)
- **Source:** Appendix C, p. 457

### C/SS1: Spin-Ups

- **Discipline:** bike
- **Purpose:** speed skills (SS) → enum: `speed skills`
- **Target zones:** "Heart rate and power ratings have no significance for this workout."
- **Typical duration:** 1-minute build to max cadence, hold "as long as possible (which will probably be only a few seconds)"; ≥1-minute recovery; "Repeat several times."
- **Phase appropriateness:** all phases (technique work)
- **Structure:**
  - Warm-up: [See Appendix C intro]
  - Main set: "On a flat or slightly downhill section of road, or on an indoor trainer set to light resistance and in a low (easy) gear, gradually increase cadence for one minute to your maximum. Maximum is the cadence you can maintain without bouncing on the saddle. As the cadence increases, allow your lower legs and feet to relax—especially your toes. Hold your maximum cadence for as long as possible, which will probably be only a few seconds. Recover for at least a minute. Repeat several times. This drill is best done with a handlebar computer that displays cadence." (pp. 457–458)
  - Cooldown: [See Appendix C intro]
- **Notes:** "The purpose is improvement of your pedaling efficiency, indicated by an increasing maximum cadence." (p. 458)
- **Source:** Appendix C, pp. 457–458

### C/SS2: Isolated Leg

- **Discipline:** bike
- **Purpose:** speed skills (SS) → enum: `speed skills`
- **Target zones:** "Heart rate and power ratings have no significance for this workout."
- **Typical duration:** "Change legs when fatigue begins to set in" — variable
- **Phase appropriateness:** all phases (technique work)
- **Structure:**
  - Warm-up: [See Appendix C intro]
  - Main set: "On a flat or slightly downhill section of road, do 90 percent of the work with one leg while the other rests. If you're performing this drill on an indoor trainer (a good idea) while using a light resistance, you can support your resting leg by placing your foot on a chair or stool. Spin with a high cadence. Change legs when fatigue begins to set in. Focus on eliminating the 'dead' portions at the top and bottom of the stroke." (p. 458)
  - Cooldown: [See Appendix C intro]
- **Source:** Appendix C, p. 458

### C/ME1: Cruise Intervals

- **Discipline:** bike
- **Purpose:** muscular endurance (ME) → enum: `muscular endurance`
- **Target zones:** zone 4 (power preferred; HR acceptable; RPE 6–7 during HR-lag)
- **Typical duration:** 3–5 work intervals of 6–12 minutes; recoveries one-fourth of preceding interval; combined work-interval duration "12 minutes or less" first time of season → progress to "30 to 50 minutes (e.g., 5 × 6 minutes or 4 × 12 minutes)"
- **Phase appropriateness:** "very similar to that of an Olympic-distance triathlon" (p. 459) — implies build/peak race-prep
- **Structure:**
  - Warm-up: [See Appendix C intro]
  - Main set: "On a relatively flat course or an indoor trainer, complete three to five work intervals with a duration of 6 to 12 minutes. Each work interval is done in zone 4. Power is the preferred gauge of intensity for this workout, but heart rate may be used. If you're using heart rate, the timed interval begins as soon as the hard effort begins, not when the heart rate achieves zone 4. During this period of increasing heart rate, estimate intensity based on a perceived exertion of 6 to 7 on a scale of 1 to 10 (see Table 4.1 for details on RPE). Recover in zone 1 with easy pedaling for about one-fourth of the preceding interval. For example, after a 6-minute interval, recover for 90 seconds with easy pedaling in zone 1. During the first such workout of the new season, the duration of the work intervals should typically total 12 minutes or less (e.g., 2 × 6 minutes). Gradually, over a few weeks, increase the combined work-interval duration to 30 to 50 minutes (e.g., 5 × 6 minutes or 4 × 12 minutes). Stay relaxed and aerodynamic, and listen closely to your breathing. The work-interval intensity is very similar to that of an Olympic-distance triathlon. Pedal with a cadence similar to what you would use at such a race distance." (pp. 458–459)
  - Cooldown: [See Appendix C intro]
- **Notes:** "An optional variation that challenges you to work harder is to shift occasionally between your 'normal' gear for this intensity and a higher (harder) gear." (p. 459)
- **Source:** Appendix C, pp. 458–459

### C/ME2: Hill Cruise Intervals

- **Discipline:** bike
- **Purpose:** muscular endurance (ME) — with MF crossover → enum: `muscular endurance`
- **Target zones:** zone 4 (power preferred); HR may not reach zone 4 first 1–2 intervals — use RPE 6–7
- **Typical duration:** "same as ME1 cruise intervals" (3–5 intervals of 6–12 minutes); recoveries longer (descent back to base of hill)
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: [See Appendix C intro]
  - Main set: "This session is the same as ME1 cruise intervals, except it is done on a hill with a long, low gradient, such as 2 to 4 percent, or into a strong headwind. Select a hill that has light traffic and no stop signs. As with ME1, a power meter is the preferred tool for measuring intensity while you are riding in zone 4, but a heart rate monitor may be used. If you're training only with a heart rate monitor, the work interval starts as soon as you begin pedaling hard—not when zone 4 is ultimately achieved. Note that you may not achieve heart rate zone 4 during the first or perhaps even the second interval. That's common. During these periods of slowly increasing heart rate, use a perceived exertion of 6 to 7 on a scale of 1 to 10 to gauge intensity (see Table 4.1 for details on RPE). Stay in the aero position for each climb, and work on a smooth stroke with minimal upper-body motion. Recover after each climb by turning around and returning to the bottom of the hill in zone 1. This descent means that the recovery intervals will be longer than when you are doing ME1 intervals, but with a somewhat increased intensity for each interval and a slightly greater benefit for MF." (pp. 459–460)
  - Cooldown: [See Appendix C intro]
- **Notes:** "A variation on this workout is to shift between your 'normal' gear for such a climb and a higher (harder) gear every 30 seconds or so. Be sure to stay in zone 4 when doing this." (p. 460)
- **Source:** Appendix C, pp. 459–460

### C/ME3: Crisscross Intervals

- **Discipline:** bike
- **Purpose:** muscular endurance (ME) → enum: `muscular endurance`
- **Target zones:** crisscross within zone 4 (power preferred or HR zone 4); RPE 6–8 during HR-lag
- **Typical duration:** 3–5 intervals of 4–8 minutes; recoveries one-fourth preceding interval; combined 12–25 minutes
- **Phase appropriateness:** "advanced workout … shouldn't be attempted until you have done 30 minutes or more of combined work-interval time with workout ME1" (p. 461) — implies later build phase
- **Structure:**
  - Warm-up: [See Appendix C intro]
  - Main set: "On a mostly flat course with little traffic and no stop signs, or on an indoor trainer, do three to five intervals with durations of 4 to 8 minutes in power zone 4 or heart rate zone 4. After each interval, recover for one-fourth of the duration of the preceding interval. The combined total of the work intervals in a single session may be 12 to 25 minutes (e.g., 3 × 4 minutes or 5 × 5 minutes). During each work interval, shift to a higher (harder) gear or increase your cadence to build gradually to the top of zone 4 (power), taking 1 to 2 minutes to do so. Then gradually reduce the intensity by shifting to a lower (easier) gear or by reducing cadence so that you slowly drop back to the bottom of zone 4, taking 1 or 2 minutes to do so. Continue this pattern throughout each interval. Power is the preferred tool for gauging intensity for this workout, but a heart rate monitor may be used. If you're training only with a heart rate monitor, the work interval starts as soon as you begin pedaling hard—not when zone 4 is finally achieved. You may not achieve heart rate zone 4 during the first two intervals. That's common. During these periods of slowly increasing heart rate, use a perceived exertion of 6 to 8 on a scale of 0 to 10 to gauge intensity (see Chapter 4 for details on RPE)." (p. 460) `[NOTE]` The source uniquely renders the RPE scale as "0 to 10" here (and uniquely cites "Chapter 4" instead of "Table 4.1") — every other workout in Appendix C uses "1 to 10" and "Table 4.1". Reproduced verbatim per Rule 7.
  - Cooldown: [See Appendix C intro]
- **Notes:** "This is an advanced workout that shouldn't be attempted until you have done 30 minutes or more of combined work-interval time with workout ME1. The first of these workouts in a season should include short intervals (e.g., 4 minutes) with a low total combined interval time (e.g., 12 minutes)." (pp. 460–461)
- **Source:** Appendix C, pp. 460–461

### C/ME4: Threshold Ride

- **Discipline:** bike
- **Purpose:** muscular endurance (ME) → enum: `muscular endurance`
- **Target zones:** zone 4
- **Typical duration:** 20–40 minutes nonstop
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8] — prerequisite of ≥4 prior ME workouts
- **Structure:**
  - Warm-up: [See Appendix C intro]
  - Main set: "On a mostly flat course, ride 20 to 40 minutes nonstop in zone 4. Stay focused on steady pacing while listening to your breathing throughout." (p. 461)
  - Cooldown: [See Appendix C intro]
- **Notes:** "Don't attempt a threshold ride until you've completed at least four ME interval workouts from the above options." (p. 461)
- **Source:** Appendix C, p. 461

### C/AC1: VO₂max Intervals

- **Discipline:** bike
- **Purpose:** aerobic capacity (AC) → enum: `anaerobic endurance` `[FLAG]`
- **Target zones:** power zone 5 (RPE 8–9 if no power meter)
- **Typical duration:** 30 seconds–4 minutes per interval; total interval time 5 minutes (start) → 15 minutes (built up); recovery equal to interval, halved as fitness improves
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: "After a long warm-up" (p. 461) [See Appendix C intro]
  - Main set: "After a long warm-up, on a mostly flat course with no stop signs and light traffic, do several work intervals, each with a duration of 30 seconds to 4 minutes. Recover with easy pedaling in zone 1 for as long as the previous interval. As your fitness improves, reduce the recovery time by half. Start with about 5 minutes of total interval time within a workout (e.g., 10 × 30 seconds) and gradually, over several sessions, build to about 15 minutes in a session (e.g., 5 × 3 minutes). A power meter is the preferred tool for measuring intensity here. Heart rate lag makes heart rate monitors ineffective for gauging intensity. RPE is a better alternative if you don't have a power meter. The goal intensity is power zone 5. If you don't have a power meter, use a rating of perceived exertion of 8 or 9 on a scale of 1 to 10 for each interval (see Table 4.1 for details on RPE). Cadence for these intervals is at the high end of your comfort range." (p. 461)
  - Cooldown: [See Appendix C intro]
- **Notes:** Source label rendered as "AE1" in PDF (p. 461) — likely typo. Contextual evidence: workout sits under "Aerobic Capacity Workouts" header, and the next workout (AC2) reads "This workout is the same as the AC1 session…" (p. 461). Recorded as `C/AC1`. `[FLAG]`
- **Source:** Appendix C, p. 461

### C/AC2: Pyramid Intervals

- **Discipline:** bike
- **Purpose:** aerobic capacity (AC) → enum: `anaerobic endurance` `[FLAG]`
- **Target zones:** power zone 5 (RPE 8–9 if no power meter)
- **Typical duration:** progression 1, 2, 3, 4, 3, 2, 1 minutes (16 minutes total work); recovery equal to preceding work interval (halved later)
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: [See Appendix C intro]
  - Main set: "This workout is the same as the AC1 session, except the work-interval progression is 1, 2, 3, 4, 3, 2, and 1 minutes in power zone 5. The recovery after each interval is equal to the preceding work interval. After having done a few of these or the AC1 workouts, reduce the recovery durations by half. For example, following a 2-minute work interval, recover for 1 minute in zone 1. Heart rate is an ineffective gauge of intensity because of heart rate lag and the shortness of these intervals. If you don't have a power meter, use an RPE of 8 or 9 on a scale of 1 to 10 for each interval (see Table 4.1 for details on RPE). Cadence for these intervals is at the high end of your comfort range." (pp. 461–462)
  - Cooldown: [See Appendix C intro]
- **Source:** Appendix C, pp. 461–462

### C/AC3: Hill Intervals

- **Discipline:** bike
- **Purpose:** aerobic capacity (AC) → enum: `anaerobic endurance` `[FLAG]`
- **Target zones:** power zone 5
- **Typical duration:** 5–7 climbs of 2–3 minutes each; total 10–15 minutes climbing; recovery interval start every 2–3 minutes
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8] — "very hard workout that is best done only once a week"
- **Structure:**
  - Warm-up: "After a thorough warm-up" (p. 462) [See Appendix C intro]
  - Main set: "Find a relatively steep hill with a gradient of 6 to 8 percent, light traffic, and no stop signs that takes 2 to 3 minutes to climb. After a thorough warm-up, do five to seven climbs in power zone 5 for a total of 10 to 15 minutes of workout climbing time (e.g., 7 × 2 minutes or 5 × 3 minutes). Sit upright with your hands on the handlebar tops while staying on the saddle with a cadence at 60 rpm or higher. Recover by coasting down the hill. Start a new interval every 2 to 3 minutes (e.g., after a 2-minute climb, recover for 2 minutes)." (p. 462)
  - Cooldown: [See Appendix C intro]
- **Notes:** "This is a very hard workout that is best done only once a week." (p. 462)
- **Source:** Appendix C, p. 462

### C/T1: Functional Threshold Test

- **Discipline:** bike
- **Purpose:** test (T) — anchors FTPo and FTHR (bike) → enum: `test`
- **Target zones:** "race-effort" 20-minute time trial
- **Typical duration:** 20-minute test; 5–10 mile course
- **Phase appropriateness:** "after three to five days of active rest and recovery" (p. 462)
- **Structure:**
  - Warm-up: [See Appendix C intro] (≥20 min building to zone 2 with brief accelerations)
  - Main set: "Find a stretch of road with a wide bike lane, light traffic, no stop signs, and few intersections and corners that is flat to slightly uphill (grade of less than 3 percent). You will probably need 5 to 10 miles depending on how fast you are. A safe course is critical. (You may also do this on an indoor trainer.) Throughout the test, keep your head up so that you can see ahead. Ride as if you were in a race that lasts 20 minutes. Hold back slightly in the first 5 minutes (most athletes start much too fast). Every 5 minutes, decide whether you should go slightly faster or more slowly for the next 5 minutes." (pp. 462–463)
  - Cooldown: not specified
- **Computation (verbatim, p. 463):** "After the workout, find your average heart rate for the 20-minute test. Subtract 5 percent, and you have a good estimate of your bike FTHR. Then use Table 4.1 to compute your training zones. To determine FTPo from the same test, subtract 5 percent from your average power (not 'normalized' power), and you have a good estimate of FTPo. You can then use Table 4.1 to set your power training zones."
- **Source:** Appendix C, pp. 462–463

### C/T2: Functional Aerobic Capacity Test

- **Discipline:** bike
- **Purpose:** test (T) — predicts VO₂max power → enum: `test`
- **Target zones:** "steady, all-out effort" — maximal sustainable for 5 minutes
- **Typical duration:** 5-minute test
- **Phase appropriateness:** "after reduced training for about three days" (p. 463)
- **Structure:**
  - Warm-up: "Warm up thoroughly" (p. 463) [See Appendix C intro]
  - Main set: "This test is done to determine your functional aerobic capacity (VO₂max) power. It requires a power meter. It may be done in place of a costly clinical test of VO₂max. … The course you use for the test should be safe. That means light traffic, no stop signs, few intersections, no turns, and a wide bike lane. For safety, you should look straight ahead throughout the test. Do not ride with your head down. The selected test course should also be a flat to slightly uphill (grade of less than 3 percent) section of road that you can use every time you do this test. (You may also do this on an indoor trainer.) Warm up thoroughly and then do a steady, all-out effort for 5 minutes." (p. 463)
  - Cooldown: not specified
- **Computation (verbatim, p. 463):** "Your average power (not normalized) for the 5-minute test portion is a good predictor of your power at aerobic capacity."
- **Source:** Appendix C, p. 463

### C/T3: Time Trial

- **Discipline:** bike
- **Purpose:** test (T) — race rehearsal / fitness tracking → enum: `test`
- **Target zones:** "Treat this test like a race." — maximal effort over 10 km
- **Typical duration:** 10 km time trial
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] — "Treat this test like a race." (p. 464)
- **Structure:**
  - Warm-up: "After a thorough warm-up (see introduction to Appendix C)" (p. 463)
  - Main set: "complete a 10 km time trial on a flat course. The section of road you choose should be safe, with light traffic, few intersections, no stop signs, and a wide bike lane. Keep your head up throughout the test so that you can see traffic and possible road obstacles, such as potholes. The course should be flat to very slightly uphill (grade of less than 3 percent). Mark your start point and finish point for later reference, or note landmarks so that you can test on the same course every time. (You may also do this on an indoor trainer.) Expect faster times as your AE, AC and ME improve. In addition to your time, note your average heart rate and normalized power for the test portion in your training diary. You can use any gear combination, and you may shift during the test." (pp. 463–464)
  - Cooldown: not specified
- **Notes:** "Treat this test like a race." (p. 464)
- **Source:** Appendix C, pp. 463–464

---

## Appendix D: Run Workouts (pp. 465–475)

### D/AE1: Recovery

- **Discipline:** run
- **Purpose:** aerobic endurance (AE) → enum: `aerobic`
- **Target zones:** zone 1
- **Typical duration:** [NOT SPECIFIED] — "The duration or TSS for this workout should be the lowest in a given week of training." (p. 466)
- **Phase appropriateness:** all phases (recovery)
- **Structure:**
  - Warm-up: workout itself can serve as warm-up (walk → fast walk → easy run progression)
  - Main set: "*It's okay to walk for parts—or all—of this workout. In fact, starting with a casual walk that slowly becomes a fast walk and then an easy run is a great way to get going.* This workout is done in zone 1, preferably on a flat, soft surface such as a park or golf course. You can instead use a treadmill for these at any time of the year, especially if flat courses are not available." (p. 466)
  - Cooldown: [See Appendix D intro]
- **Notes:** "Most age-group triathletes will be better off swimming or cycling for recovery because of the risk for an injury resulting from running on tired legs. Novices generally recover faster by taking time off from exercise. Cross-training in other sports may also be beneficial for recovery, especially in the prep and base periods. Recovery workouts are not scheduled in the annual training plan but are an integral part of training throughout the season." (p. 466)
- **Source:** Appendix D, p. 466

### D/AE2: Aerobic Endurance (AE)

- **Discipline:** run
- **Purpose:** aerobic endurance (AE) → enum: `aerobic`
- **Target zones:** heart rate zone 2
- **Typical duration:** "30 minutes to a few hours" — sprint/Olympic: 45–90 min; half-Ironman: 1–2 hours; Ironman: 1.5–3 hours (p. 467)
- **Phase appropriateness:** all phases ("year-round, initially for building and later on for maintaining AE", p. 467)
- **Structure:**
  - Warm-up: [See Appendix D intro]
  - Main set: "Use a heart rate monitor to gauge intensity. See Table 4.1 to determine your zone 2, aerobic endurance heart rate for running. After a warm-up, run from 30 minutes to a few hours at your AE2 heart rate on a flat to gently rolling course or treadmill. The longer your intended race, the longer the AE portion of your longest weekly workout should be." (pp. 466–467)
  - Cooldown: [See Appendix D intro]
- **Notes:** "If you are also using a GPS device, when the workout is over, divide the normalized graded pace (NGP) for the AE portion by your average heart rate for the same portion to find your efficiency factor (EF) for this session (note that Training Peaks does this for you). An increasing EF over time indicates that your aerobic fitness is improving. Note that EF rises and falls over several sessions, but the trend should show an increase if your training is going well." (p. 467) "Build to these durations over several weeks with shorter weekly AE workouts." (p. 467)
- **Source:** Appendix D, pp. 466–467

### D/TE1: Tempo Endurance

- **Discipline:** run
- **Purpose:** tempo (TE, zone 3) → enum: no exact match `[FLAG]`
- **Target zones:** heart rate zone 3
- **Typical duration:** 20–90 minutes
- **Phase appropriateness:** Build, Peak, Race (per italic note)
- **Structure:**
  - Warm-up: "After a warm-up" (p. 468) [See Appendix D intro]
  - Main set: "*Note that this workout is a build, peak, and race periods session intended to be used only if you are preparing for an event in which you will run in zone 3.* … run for 20 to 90 minutes or more on a course with small hills while staying mostly in heart rate zone 3. You can also use a treadmill by frequently changing the grade or speed to control the workload." (pp. 467–468)
  - Cooldown: [See Appendix D intro]
- **Notes:** "The purpose of this workout is to boost your body's capacity for processing oxygen to produce energy at race intensity." (p. 468)
- **Source:** Appendix D, pp. 467–468

### D/MF1: Force Reps

- **Discipline:** run
- **Purpose:** muscular force (MF) → enum: `force`
- **Target zones:** "great effort on each push-off" / "maximal-effort steps" — RPE-anchored, no zone
- **Typical duration:** 1–3 sets of 3 reps; recovery 2–3 minutes between reps; 3–5 minutes between sets
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8] — high-risk; injury-prone runners excluded
- **Structure:**
  - Warm-up: "warm up well before starting the reps" (p. 468) [See Appendix D intro]
  - Main set (verbatim, sub-bullets preserved):
    - "Find a short, steep (grade of 6 to 8 percent) hill that you can run to as a warm-up. Grass or dirt is the preferred surface. The hill should be at least 10 yards/meters from base to peak." (p. 468)
    - "After warming up thoroughly, walk to the base of the hill and come to a complete stop. Then quickly run up the hill with great effort on each push-off."
    - "Your stride length is determined by the steepness of the hill and whether you're wearing a weight vest."
    - "Keep your head up in a neutral posture as you run up the hill. Do not look at your feet."
    - "Produce a total of 10 to 20 maximal-effort steps on each brief hill repeat. A 'step' is a footstrike with either foot. The fewer steps you take in one ascent of the hill, the greater the effort should be."
    - "After each hill rep, walk slowly back down the hill and fully recover for 2 to 3 minutes. Don't run during the recoveries or try to make the recoveries briefer. Doing so will only increase the risk and decrease the potential reward. The purpose of this workout is to increase maximum muscular strength, not to build endurance. Allow your muscles to recover before doing the next rep." (p. 469)
    - "Repeat the above steps two more times for a total of three reps, one set. If you're doing a second or third set (it's best to do only one set of three reps the first time you do this workout), walk and run slowly for 3 to 5 minutes after each set to ensure full recovery."
  - Cooldown: [See Appendix D intro]
- **Notes:** "Avoid this workout if you are prone to foot, Achilles tendon, calf, or knee injuries." (p. 468) "If your legs are fully capable of handling the stress, you may increase the workload by wearing a weight vest equal to 5 to 10 percent of your body weight." (p. 468) "Stop the workout at the first sign of any tenderness. Do not continue even if the tenderness is only slight. No amount of fitness is worth an injury." (p. 469)
- **Source:** Appendix D, pp. 468–469

### D/MF2: Hill Fartlek

- **Discipline:** run
- **Purpose:** muscular force (MF) → enum: `force`
- **Target zones:** RPE 6–7 on hills; pace zones 1–2 on flatter portions; HR < zone 5a on hills (HR may only reach zone 3 early)
- **Typical duration:** hills of 2–5 minutes each
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8] — "Do this workout no more than once per week."
- **Structure:**
  - Warm-up: [See Appendix D intro]
  - Main set: "Select a course that includes several moderately steep hills with grades of up to about 6 percent, each taking 2 to 5 minutes to run up. Or run on a treadmill, changing the gradient to create 'hills.' On the uphill portions, run at a rating of perceived exertion (RPE) of 6 or 7 on a scale of 1 to 10 (see Table 4.1 for RPE zones). Maintain a 'proud' posture—head up and tall—while going up the hills. On the flatter portions of the course, run in pace zones 1 and 2. RPE and pace are the preferred gauges of intensity for this workout, but if you're using a heart rate monitor, stay below zone 5a on the hills. Although you are working hard, you may only achieve heart rate zone 3 on hills, especially in the early portion of this workout." (p. 469)
  - Cooldown: [See Appendix D intro]
- **Notes:** "Do this workout no more than once per week. Do not do this workout if you are prone to knee, foot, or lower-leg injury." (p. 469)
- **Source:** Appendix D, p. 469

### D/MF3: Hill Repeats

- **Discipline:** run
- **Purpose:** muscular force (MF) → enum: `force`
- **Target zones:** RPE zone 6 or 7 (on 1–10 scale); HR may reach high zone 4 late, mostly zones 3 and low 4 early
- **Typical duration:** 3–8 repeats of 30–60 seconds each, 2–4 minute walk-down recoveries
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8] — "Do this workout no more than once per week."
- **Structure:**
  - Warm-up: [See Appendix D intro]
  - Main set: "On a steep hill with a grade of about 6 to 8 percent that takes 30 to 60 seconds to climb, do three to eight repeats with 2 to 4 minutes of recovery between them. Maintain an RPE in zone 6 or 7 on a scale of 1 to 10 for each uphill run (see Table 4.1 for RPE zones). Heart rate may reach high zone 4 by the time you're at the top of the hill later in the workout but will be mostly in zones 3 and low 4 early in the session, even though RPE is appropriately high. Maintain a 'proud' posture—head up and tall—while going up the hills. To recover, slowly walk back down the hill before starting the next rep." (pp. 469–470)
  - Cooldown: [See Appendix D intro]
- **Notes:** "Stop the workout if your legs show signs of excessive stress, such as soreness and extreme fatigue. Do this workout no more than once per week. Do not do this workout at all if you are prone to any running injuries." (p. 470)
- **Source:** Appendix D, pp. 469–470

### D/SS1: Strides

- **Discipline:** run
- **Purpose:** speed skills (SS) → enum: `speed skills`
- **Target zones:** pace zone 5c / RPE 10 on a 1–10 scale (HR has no significance)
- **Typical duration:** 4–8 reps of 20 seconds each
- **Phase appropriateness:** all phases (technique work)
- **Structure:**
  - Warm-up: [See Appendix D intro]
  - Main set: "Run fast (zone 5c intensity) down a very slight hill grade of about 1 percent (barely noticeable) with a soft surface such as grass or dirt for 20 seconds (RPE of 10 on a scale of 1 to 10). Do this four to eight times. Focus on one aspect of your technique on each stride. This could be, for example, cadence. Count your right footstrikes for the 20 seconds, with a goal of 28 to 32. A variation is to run these barefoot, but only if the grass is free of sharp objects and there are no breaks in the skin on your feet." (p. 470)
  - Cooldown: [See Appendix D intro]
- **Notes:** "Heart rate has no significance for this workout." (p. 470) Cadence target 28–32 right-foot strikes per 20 sec → 84–96 spm total cadence.
- **Source:** Appendix D, p. 470

### D/SS2: Pickups

- **Discipline:** run
- **Purpose:** speed skills (SS) → enum: `speed skills`
- **Target zones:** "faster than 5 km race pace" — HR is "not a good indicator"
- **Typical duration:** 20-second accelerations within an endurance run; "several" pickups; multi-minute recoveries
- **Phase appropriateness:** all phases (technique-focused; embedded in TE1-style endurance runs)
- **Structure:**
  - Main set: "Within an endurance run such as TE1 above, randomly insert several 20-second accelerations to a speed faster than 5 km race pace (heart rate is not a good indicator of intensity for these). The primary focus should be on your technique, such as working on a flat footstrike. Other goals may be maintaining a relaxed posture or a high cadence. Recover for several minutes between these pickups by returning to zone 2 steady running." (p. 470)
- **Source:** Appendix D, p. 470

### D/ME1: Cruise Intervals

- **Discipline:** run
- **Purpose:** muscular endurance (ME) → enum: `muscular endurance`
- **Target zones:** pace zone 4 / heart rate zone 4 (RPE 6–7 during HR-lag)
- **Typical duration:** 3–5 work intervals of 6–12 minutes; recovery one-fourth of preceding interval (zone 1, walk/jog)
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: "Warm up thoroughly before doing this main set." (p. 471) [See Appendix D intro]
  - Main set: "On a relatively flat course or a treadmill, do three to five work intervals, each with a duration of 6 to 12 minutes. Build to pace zone 4 or heart rate zone 4 on each work interval. If you're training with a heart rate monitor, the work interval starts as soon as you begin running with high effort—not when zone 4 is finally achieved. During this heart rate lag period, run at an RPE of about 6 or 7 on a scale of 1 to 10 (see Table 4.1 for details on RPE). Between intervals, recover in zone 1 by walking or jogging for one-fourth the duration of the previous interval." (p. 471)
  - Cooldown: [See Appendix D intro]
- **Notes:** "A variation is to run cruise intervals on a track with 1- to 2-mile (1600 to 3200 meters) work intervals in pace zone 4. Stay relaxed with a tall posture and a quick cadence while closely monitoring your breathing." (p. 471)
- **Source:** Appendix D, p. 471

### D/ME2: Hill Cruise Intervals

- **Discipline:** run
- **Purpose:** muscular endurance (ME) → enum: `muscular endurance`
- **Target zones:** zone 4 (per ME1 reference)
- **Typical duration:** "same as ME1 cruise intervals" — 3–5 intervals of 6–12 minutes; recoveries longer (descent)
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: [See Appendix D intro]
  - Main set: "This workout is the same as ME1 cruise intervals above, except it's done on a hill with a long, low gradient (2 to 4 percent). Maintain a tall posture and quick cadence. The recovery between intervals will be longer than in ME1 because you must return to the bottom of the hill. Do this by walking and jogging slowly." (p. 471)
  - Cooldown: [See Appendix D intro]
- **Source:** Appendix D, p. 471

### D/ME3: Crisscross Intervals

- **Discipline:** run
- **Purpose:** muscular endurance (ME) → enum: `muscular endurance`
- **Target zones:** crisscross between zone 4 and zone 5a
- **Typical duration:** 10–20 minutes total in zones 4–5a
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8] — prerequisite of ≥2 prior ME1 workouts
- **Structure:**
  - Warm-up: "Complete at least two cruise-interval workouts (ME1) before doing this workout, and warm up thoroughly before doing this main set." (p. 471) [See Appendix D intro]
  - Main set: "On a mostly flat course, run 10 to 20 minutes in pace zones 4 and 5a (preferred) or heart rate zones 4 and 5a. Once zone 4 is attained, gradually build to zone 5a, taking 1 or 2 minutes to do so. Then gradually back off and slowly come to the bottom of zone 4, again taking 1 or 2 minutes. Continue this pattern throughout the run." (pp. 471–472)
  - Cooldown: [See Appendix D intro]
- **Source:** Appendix D, pp. 471–472

### D/ME4: Threshold Run

- **Discipline:** run
- **Purpose:** muscular endurance (ME) → enum: `muscular endurance`
- **Target zones:** pace zone 4 or heart rate zone 4
- **Typical duration:** 10–20 minutes nonstop
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8] — prerequisite of ≥4 prior ME workouts
- **Structure:**
  - Warm-up: "Warm up thoroughly before starting." (p. 472) [See Appendix D intro]
  - Main set: "On a mostly flat course, run 10 to 20 minutes nonstop in pace zone 4 or heart rate zone 4. Maintain good technique while listening to your breathing throughout." (p. 472)
  - Cooldown: [See Appendix D intro]
- **Notes:** "Don't attempt a threshold run until you've completed at least four of the other ME interval workouts." (p. 472)
- **Source:** Appendix D, p. 472

### D/AC1: Group Run

- **Discipline:** run
- **Purpose:** aerobic capacity (AC) → enum: `anaerobic endurance` `[FLAG]`
- **Target zones:** pace or heart rate zones 4 and 5a (pace preferred); periodic surges to zone 5b
- **Typical duration:** "may vary based on your race goals and current level of fitness"
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: "After a thorough warm-up (see introduction to Appendix D)" (p. 472)
  - Main set: "This is an unstructured workout. After a thorough warm-up (see introduction to Appendix D), run fast with other triathletes of similar ability. Gradually increase speed until you're running in pace or heart rate zones 4 and 5a (pace preferred), with periodic surges or hill climbs in which you achieve zone 5b. This may be on mixed terrain, especially something similar to what you anticipate for your short-course race. The duration of the fast portion may vary based on your race goals and current level of fitness." (p. 472)
  - Cooldown: [See Appendix D intro]
- **Source:** Appendix D, p. 472

### D/AC2: VO₂max Intervals

- **Discipline:** run
- **Purpose:** aerobic capacity (AC) → enum: `anaerobic endurance` `[FLAG]`
- **Target zones:** pace zones 5a and 5b (RPE 8–9 if no GPS)
- **Typical duration:** intervals of 30 seconds–4 minutes; recovery equal to interval (halved as fitness improves); total interval time 5 minutes (start) → 15 minutes (built up)
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: "After a long warm-up" (p. 472) [See Appendix D intro]
  - Main set: "After a long warm-up, move to a mostly flat road course, treadmill, or track. Do several work intervals with a duration of 30 seconds to 4 minutes, each in pace zones 5a and 5b. Recover after each with easy jogging and walking in zone 1 for as long as the previous interval. As your fitness improves, reduce the recovery time by half. Start with about 5 minutes of total interval time within a workout (e.g., 10 × 30 seconds) and gradually, over several sessions, build to about 15 minutes in a session (e.g., 5 × 3 minutes). A GPS device (or even a stopwatch on a measured track) is the preferred tool for measuring intensity during this workout. Heart rate lag makes heart rate monitors ineffective for gauging intensity for such short intervals. If you don't have a GPS device, run at an RPE of 8 or 9 on a scale of 1 to 10 for each interval (see Table 4.1 for details on RPE)." (pp. 472–473)
  - Cooldown: [See Appendix D intro]
- **Notes:** "Concentrate on good running technique." (p. 473)
- **Source:** Appendix D, pp. 472–473

### D/AC3: Hill Intervals

- **Discipline:** run
- **Purpose:** aerobic capacity (AC) → enum: `anaerobic endurance` `[FLAG]`
- **Target zones:** RPE 8 or 9 on 1–10 scale (HR ineffective due to lag)
- **Typical duration:** 5–7 climbs of 2–3 minutes each; total 10–15 minutes climbing time; recovery = jog/walk down
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8] — "very hard workout that's best done only once a week"; prerequisite of "at least 2 AC2 and 2 MF workouts"
- **Structure:**
  - Warm-up: "After a thorough warm-up" (p. 473) [See Appendix D intro]
  - Main set: "Find a relatively steep (grade of 6 to 8 percent) hill that takes 2 to 3 minutes to run up. After a thorough warm-up, do five to seven climbs at a perceived exertion of 8 or 9 on a scale of 1 to 10 (see Table 4.1 for details on RPE) for a total of 10 to 15 minutes of total workout climbing time (e.g., 7 × 2 minutes or 5 × 3 minutes). (Heart rate lag makes heart rate monitors ineffective for this workout.) Recover by slowly jogging and walking down the hill, then start a new interval when you reach the base." (p. 473)
  - Cooldown: [See Appendix D intro]
- **Notes:** "This is a very hard workout that's best done only once a week. Complete at least 2 AC2 and 2 MF workouts before doing this one." (p. 473)
- **Source:** Appendix D, p. 473

### Test Workouts intro (verbatim, p. 473)

> "This test should be done year-round at least every six to eight weeks. If possible, use the same course every time and keep other conditions (e.g., shoes, warm-up, time of day, and before-workout meals) the same from one test to the next."

### Table D.1 — Estimation of VO₂max from a 1.5-Mile Run Test (pp. 473–474)

> Reproduced verbatim. Per Rule 12 (figures with structured content) and Rule 11 (merged-cell handling — n/a here, no merges). The table maps a 1.5-mile run-test finish time to an estimated VO₂max (ml/kg/min).

| Time for 1.5 miles (min:sec) | Estimated VO₂max (ml/kg/min) |
|---|---|
| 7:30 and faster | 75 |
| 7:31–8:00 | 72 |
| 8:01–8:30 | 67 |
| 8:31–9:00 | 62 |
| 9:01–9:30 | 58 |
| 9:31–10:00 | 55 |
| 10:01–10:30 | 52 |
| 10:31–11:00 | 49 |
| 11:01–11:30 | 46 |
| 11:31–12:00 | 44 |
| 12:01–12:30 | 41 |
| 12:31–13:00 | 39 |
| 13:01–13:30 | 37 |
| 13:31–14:00 | 36 |
| 14:01–14:30 | 34 |
| 14:31–15:00 | 33 |
| 15:01–15:30 | 31 |
| 15:31–16:00 | 30 |
| 16:01–16:30 | 28 |
| 16:31–17:00 | 27 |
| 17:01–17:30 | 26 |
| 17:31–18:00 | 25 |

(Source: Table D.1, pp. 473–474)

### D/T1: Functional Threshold Test

- **Discipline:** run
- **Purpose:** test (T) — anchors run FTPa and FTHR → enum: `test`
- **Target zones:** "race-effort" 20-minute time trial
- **Typical duration:** 20-minute test
- **Phase appropriateness:** "after three days of active rest and recovery" (p. 474)
- **Structure:**
  - Warm-up: [See Appendix D intro]
  - Main set: "A road course should be relatively flat for this test, or do it on a track (preferred). Use the same course every time. (Most treadmills aren't calibrated closely enough to attain the accuracy required for this test.) Run as if you were in a race that lasts 20 minutes. Hold back slightly in the first 5 minutes (most athletes start much too fast). Every 5 minutes, decide whether you should go slightly faster or slightly slower for the next 5 minutes." (p. 474)
  - Cooldown: "Cool down afterward with easy jogging and walking." (p. 474)
- **Computation (verbatim, p. 475):** "After the workout, find your average heart rate for the 20-minute test. Subtract 5 percent, and you have an estimate of your run FTHR. Then use Table 4.1 to compute your heart rate training zones. If you're using a GPS device on a road course, add 5 percent to your NGP to determine FTPa. If you performed the test on a track, use the track measurements to determine pace and also add 5 percent for an estimate of FTPa. Table 4.1 may then be used to set your pace training zones."
- **Source:** Appendix D, pp. 474–475

### D/T3: VO₂max Estimation Time Trial

- **Discipline:** run
- **Purpose:** test (T) — predicts VO₂max via 1.5-mile time trial → enum: `test`
- **Target zones:** maximum effort over 1.5 miles
- **Typical duration:** 1.5-mile time trial
- **Phase appropriateness:** "year-round at least every six to eight weeks" (p. 473)
- **Structure:**
  - Warm-up: "After a thorough 10- to 20-minute warm-up" (p. 475)
  - Main set: "complete a 1.5-mile, maximum-effort time trial on a track or a flat and precisely measured road course. (Most treadmills can't be calibrated closely enough to attain the accuracy required for this test.) Record the time for the time trial in your training diary to compare with future time trials. In addition to time, record your average and peak heart rates. Keep the conditions the same from one time trial to the next. You can estimate your VO₂max from your time in this 1.5-mile time trial as shown in Table D.1." (p. 475)
  - Cooldown: not specified
- **Notes:** Appendix D contains no T2. Numbering goes T1 → T3 with no T2 entry. `[FLAG]` — see Open Questions.
- **Source:** Appendix D, p. 475

---

## Appendix E: Combined Bike-Run ("Brick") Workouts (pp. 476–481)

### E/AE1: Aerobic Endurance Brick

- **Discipline:** brick (bike → run)
- **Purpose:** aerobic endurance (AE) → enum: `aerobic`
- **Target zones:** power zone 2 (preferred) or heart rate zone 2 on bike; pace (preferred) or heart rate zone 2 on run
- **Typical duration:** [NOT SPECIFIED in detail] — week-to-week variation between long-bike-short-run and short-bike-long-run
- **Phase appropriateness:** Build (per Appendix E intro, p. 476: bricks "most commonly done in the build period of the season"; appendix does not subdivide — see Ch 7 for Build 1 vs Build 2 split) — "especially good workout when you're preparing for a long-course race" (p. 478)
- **Structure:**
  - Warm-up: "After a warm-up" (p. 478) [See Appendix E intro]
  - Main set: "After a warm-up, ride on a flat to rolling course with more than half of the time in power zone 2 (preferred) or heart rate zone 2, accumulating as much zone 2 time as possible. Then transition to a run, also primarily in pace (preferred) or heart rate zone 2. You can vary emphasizing the bike and run portion durations from week to week by alternately doing a long bike ride followed by a short run and then reversing the durations the following week." (p. 478)
  - Cooldown: not specified
- **Notes:** "This is an especially good workout when you're preparing for a long-course race." (p. 478)
- **Source:** Appendix E, p. 478

### E/TB1: Tempo Brick

- **Discipline:** brick (bike → run)
- **Purpose:** tempo (TB, zone 3) → enum: no exact match `[FLAG]`
- **Target zones:** power zone 3 (preferred) or HR zone 3 on bike; pace (preferred) or HR zone 3 on run
- **Typical duration:** [NOT SPECIFIED in detail] — week-to-week variation as in E/AE1
- **Phase appropriateness:** Build, Peak, Race (per italic note)
- **Structure:**
  - Warm-up: "After a warm-up" (p. 478) [See Appendix E intro]
  - Main set: "*This is a build, peak, and race periods workout intended to be used only if you are preparing for an event in which you will race in zone 3.* … ride on a flat to rolling course with more than half of the time in power zone 3 (preferred) or heart rate zone 3, accumulating as much zone 3 time as possible. Then transition to a run, also primarily in pace (preferred) or heart rate zone 3. You can vary emphasizing the bike and run portion durations from week to week by alternately doing a long bike ride followed by a short run and then reversing the durations the following week." (p. 478)
  - Cooldown: not specified
- **Notes:** "This is an especially good workout when you're preparing for a long-course race to be raced in zone 3." (p. 478) Code is `TB1`, distinct from swim `Te1` and bike/run `TE1`. `[FLAG]` — see Open Questions on tempo-code naming.
- **Source:** Appendix E, p. 478

### E/MF — section explicitly empty

> "*MF workouts are best done in isolation as stand-alone bike or run sessions. Combining them greatly increases the risk for injury.*" (p. 479)

Appendix E contains a "Muscular Force Workouts" section header with no workout codes — Friel explicitly forbids MF bricks. The plan generator should treat E/MF* as undefined and use C/MF1–MF3 or D/MF1–MF3 directly when MF is required.

### E/SS1: Transition 1 (T1) Practice

- **Discipline:** brick (swim → bike) — exception to typical bike→run brick order
- **Purpose:** speed skills (SS) — transition rehearsal → enum: `speed skills`
- **Target zones:** "race intensity" — race-pace swim, race-intensity bike
- **Typical duration:** swim sets + 5-min bike ride per repeat; 3–5 repeats
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8] — race-prep oriented
- **Structure:**
  - Warm-up: not specified
  - Main set: "At the pool or other swimming venue, set up your bike on a trainer. Swim several race-pace sets and then transition to the bike for 5 minutes at race intensity. The transition involves putting on cycling shoes and helmet, and possibly removing a wet suit (the latter should be rehearsed if you're doing a race with a wet suit swim). Repeat this three to five times." (p. 479)
  - Cooldown: not specified
- **Notes:** "Emphasis should be placed on making T1 as efficient and quick as possible." (p. 479) "T1" in the workout name refers to the race-day swim-to-bike transition, NOT the test workout T1.
- **Source:** Appendix E, p. 479

### E/SS2: Transition 2 (T2) Practice

- **Discipline:** brick (bike → run)
- **Purpose:** speed skills (SS) — transition rehearsal → enum: `speed skills`
- **Target zones:** race pace (bike) and T2-exit goal-race pace (run)
- **Typical duration:** 5-min bike + 3–5-min run per repeat; 3–5 repeats
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX] [SEE: Chapter 7/8] — race-prep oriented
- **Structure:**
  - Warm-up: "After a warm-up" (p. 479)
  - Main set: "At the running track or other handy venue, set up your bike on a trainer. After a warm-up, ride 5 minutes at race pace and then transition by changing into running shoes and putting on a cap or any other materials you will use during the run in your race. Following the transition, run for 3 to 5 minutes at T2-exit, goal-race pace. Repeat the bike-to-run workout three to five times." (p. 479)
  - Cooldown: not specified
- **Notes:** "Emphasis should be placed on making T2 as efficient and quick as possible." (p. 479) "T2" in the workout name = race-day bike-to-run transition.
- **Source:** Appendix E, p. 479

### E/ME1: Muscular Endurance Brick

- **Discipline:** brick (bike → run)
- **Purpose:** muscular endurance (ME) → enum: `muscular endurance`
- **Target zones:** zone 4 ("This is a build, peak, and race periods workout intended to be used only if you are preparing for an event in which you will race in zone 4." — italic note for ME section, p. 479)
- **Typical duration:** bike 60–90 min including 10/20/30/40 km race-effort segment; run 10/20/30/40 minutes at goal-race pace
- **Phase appropriateness:** Build, Peak, Race (per italic note)
- **Structure:**
  - Warm-up: [See Appendix E intro]
  - Main set: "Depending on the length of your next race, bike for 60 to 90 minutes including a 10 km (sprint), 20 km (Olympic), 30 km (half-Ironman), or 40 km (Ironman) effort at race-like intensity on a course similar to that of your next A-priority race. Ride the measured portion at an intensity similar to or slightly greater than that planned for your next important race. Then transition to a 10- (sprint), 20- (Olympic), 30- (half-Ironman), or 40-minute (Ironman) run at your goal-race pace." (p. 480)
  - Cooldown: not specified
- **Source:** Appendix E, p. 480

### E/ME2: Hilly Brick

- **Discipline:** brick (bike → run)
- **Purpose:** muscular endurance (ME) — race rehearsal on hills → enum: `muscular endurance`
- **Target zones:** "intensity (power, pace, heart rate, or RPE) similar to what you will do in the race" on flats; "increase the power, run speed, or heart rate by no more than one zone" on uphills
- **Typical duration:** "considerably shorter than those in the race, at about one-half of the race distance or less"
- **Phase appropriateness:** Build, Peak, Race (per ME-section italic note, p. 479)
- **Structure:**
  - Warm-up: [See Appendix E intro]
  - Main set: "In preparation for a hilly race, design a brick course that closely simulates the race course. This can be a hilly bike and flat run or a flat bike and hilly run, or both the bike and run may be hilly. The emphasis of the workout is on the hilly portions, where you should rehearse race-like pacing on the climbs. The bike and run courses should be considerably shorter than those in the race, at about one-half of the race distance or less. On the flat portions, ride and run steadily at an intensity (power, pace, heart rate, or RPE) similar to what you will do in the race. On the uphill portions, increase the power, run speed, or heart rate by no more than one zone. This intensity variation is recommended for the race so that the workout can be a rehearsal." (p. 480)
  - Cooldown: not specified
- **Source:** Appendix E, p. 480

### E/AC1: Bike-Intervals Brick

- **Discipline:** brick (bike → run)
- **Purpose:** aerobic capacity (AC) → enum: `anaerobic endurance` `[FLAG]`
- **Target zones:** bike: "at or above your functional threshold power (FTPo)" — power preferred, RPE 6–8 if HR-only; run: pace zone 4 (preferred) or HR zone 4
- **Typical duration:** bike 45–90 minutes; intervals 2–4 minutes each, 3–5 intervals; recovery half preceding interval; total high-intensity interval time "up to about 15 minutes"; run = half the bike duration; "10 to 20 minutes of steady state in pace zone 4 (preferred) or heart rate zone 4" during run
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX — except "short-course triathletes only"] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: [See Appendix E intro]
  - Main set: "*This workout is recommended for short-course triathletes only.* Ride 45 to 90 minutes on a flat to rolling course. After warming up on the bike, do three to five work intervals, each with a duration of 2 to 4 minutes. The interval intensity should be at or above your functional threshold power (FTPo). Power is the preferred measurement, but if you're using a heart rate monitor, you're unlikely to achieve heart rates above zone 4 because of heart rate lag. In this case, use a rating of perceived exertion (RPE) of 6 to 8 on a scale of 1 to 10. Recover after each work interval for a time equal to half of the preceding work-interval time. For example, after a 4-minute work interval, recover for 2 minutes. Accumulate up to about 15 minutes of total high-intensity work-interval time on the bike. Transition to a run with a duration about half the duration of the preceding bike portion (e.g., if you rode for 60 minutes, run for 30 minutes). During the run and immediately after the transition, include 10 to 20 minutes of steady state in pace zone 4 (preferred) or heart rate zone 4." (pp. 480–481)
  - Cooldown: not specified
- **Source:** Appendix E, pp. 480–481

### E/AC2: Run-Intervals Brick

- **Discipline:** brick (bike-run-bike-run-… alternating)
- **Purpose:** aerobic capacity (AC) → enum: `anaerobic endurance` `[FLAG]`
- **Target zones:** bike: zone 4 (power preferred); run: pace zone 5a or 5b (preferred), or RPE 8–9 if HR-only (HR ineffective due to short interval lag)
- **Typical duration:** warm-up 10–20 min run zones 1–2; bike sets 5–10 min building to zone 4; run intervals 2–4 min × 2–4; recoveries half work interval (zone 1); 1–3 alternating cycles + 10-min cooldown bike
- **Phase appropriateness:** [NOT EXPLICIT IN APPENDIX — except "short-course triathletes only"] [SEE: Chapter 7/8]
- **Structure:**
  - Warm-up: "Run for 10 to 20 minutes in pace (preferred) or heart rate zones 1 to 2 for warm up. Then, on the bike trainer, ride for 5 to 10 minutes while achieving power (preferred) or heart rate zone 4 in the last minute or so." (p. 481)
  - Main set: "*This workout is recommended for short-course triathletes only.* Take your indoor bike trainer to a running track. … Transition to running shoes and complete two to four work intervals that last 2 to 4 minutes, with intensity rising into pace (preferred) zone 5a or 5b on each. You may also do these work intervals with intensity based on an RPE of 8 to 9 on a scale of 1 to 10. Heart rate is ineffective because of the shortness of the intervals. Recovery intervals are half the duration of the previous work interval and done in zone 1. Return to the bike and again ride 5 minutes, building to zone 4. Repeat this alternating bike-run pattern one to three more times before cooling down for 10 minutes or so on the bike. Aim…" (p. 481)
  - Cooldown: "cooling down for 10 minutes or so on the bike" (p. 481)
- **Notes:** Workout text appears to **continue past the page-481 boundary** specified for this extraction. The last printed word in the read range is "Aim" (p. 481), with the sentence cut off. `[FLAG]` — see Open Questions. Plan generator should treat the post-"Aim" content as missing until the page range is extended.
- **Source:** Appendix E, p. 481 (truncated)

---

## Open questions / flags

- **[FLAG: code-namespace collision]** Codes (AE1, AE2, MF1–3, SS1–2, ME1–4, AC1–3, T1–T3) are reused across appendices with different content. The plan generator MUST namespace by appendix letter (e.g., `B/AE1` ≠ `C/AE1` ≠ `D/AE1` ≠ `E/AE1`). Each AE1 means "Recovery" but the protocol differs by discipline.

- **[FLAG: tempo-code case inconsistency]** Tempo workouts use three different code styles across appendices: `Te1` (lowercase 'e', Appendix B p. 447), `TE1` (uppercase, Appendix C p. 455 and Appendix D p. 467), `TB1` (different letter — "Tempo Brick", Appendix E p. 478). Likely a typesetting inconsistency in the source. Recorded verbatim.

- **[FLAG: Purpose-enum mismatch — Tempo]** The EXTRACTION_PROMPT.md Purpose enum (`aerobic | force | muscular endurance | anaerobic endurance | sprint power | speed skills | test`) has no value for tempo (zone 3) workouts. Friel's tempo work is distinct from both AE (zones 1–2) and ME (zone 4) per Ch 4 zone tables (p. 86). Recorded as Friel-label "tempo" with `[FLAG]` notation; plan generator should treat as a first-class category.

- **[FLAG: Purpose-enum mismatch — Aerobic Capacity]** AC workouts mapped to enum `anaerobic endurance`, but Friel explicitly rejects "anaerobic" framing in Ch 4 (p. 94: "LT2 is often referred to as the 'anaerobic threshold,' which is misleading, since anaerobic means 'without oxygen,' which is certainly not the case"). Plan generator should prefer Friel's term "aerobic capacity" / `AC`.

- **[FLAG: C/AC1 source label is "AE1"]** Appendix C, p. 461: workout code is rendered as `AE1` in the source ("AE1: VO₂max Intervals") but appears under the "Aerobic Capacity Workouts" section header, and the next workout (AC2) explicitly references "the AC1 session" (p. 461). Recorded as `C/AC1` with the typo flagged. This treatment violates rule 7 ("do not silently resolve") in spirit but the cross-reference inside AC2 is conclusive — the entry would otherwise be a duplicate `C/AE1`.

- **[FLAG: missing T2 in Appendix D]** Appendix D's Test Workouts go `T1` → `T3` with no `T2` entry. The other appendices (B has T1–T2; C has T1–T3) include their full sequences. Either Friel intentionally omitted a run T2 or there's a typesetting omission. Plan generator should not infer a `D/T2` exists.

- **[FLAG: Appendix E section header without workouts]** Appendix E has a "Muscular Force Workouts" section header (p. 479) with no codes listed under it — only an italic note saying MF "are best done in isolation". Treat as intentional: there are no E/MF entries.

- **[FLAG: E/AC2 truncated at page boundary]** Workout E/AC2 (p. 481) ends mid-sentence with the word "Aim" — the description appears to continue beyond the user-specified page range (445–481). Re-read p. 482 to capture the remainder. `[ACTION]` for plan generator: treat E/AC2 as incomplete pending extension.

- **[FLAG: Appendix C references "Table 4.3"]** Bike appendix intro (p. 453) tells the reader: "See Table 4.3 for bike heart rate zones and for bike power zones." Chapter 4 establishes only Table 4.1 (the master 7-zone table) and Table 4.2 (swim pace zones). No Table 4.3 is defined in Ch 4 (pp. 80–96). Likely an editorial pointer that survived a renumbering. Plan generator should treat this as a typo for Table 4.1.

- **[FLAG: Phase appropriateness mostly absent]** The appendices specify phase only for tempo (Build/Peak/Race) and recovery (all-phase). For most MF, ME, AC, SS workouts, phase is not stated in the appendix and must be inferred from Chapter 7 (pp. 157–188) and Chapter 8 (pp. 194–237). Each entry above is marked accordingly.

- **[NOTE: appendices contain no boxed pull-quote callouts]** Per Rule 13, a "Pull-quote callouts (per Rule 13)" subsection has been included in Conventions, listing all italicized in-line caveats encountered. No sidebar marginalia in the style of Chapter 4 are present in pp. 445–481.

## Cross-references out

- **Chapter 4 — Training Intensity (pp. 80–96)** — Table 4.1 master zone table (referenced by every workout's "Target zones" field for HR/power/pace ranges); Table 4.2 swim pace zones (anchored on T-time from B/T2); zone-derivation formulas from FTHR/FTPo/FTPa. (e.g., pp. 86, 92)
- **Chapter 6 — Five Abilities** — referenced by every appendix intro for the AE/MF/SS/ME/AC framework. (Appendix C p. 453, Appendix D p. 465, Appendix E p. 476)
- **Chapter 7 — Planning a Season (pp. 157–188)** — periodization context; phase placement of multi-ability workouts. (Appendix C p. 453, Appendix D p. 465, Appendix E p. 476)
- **Chapter 8 — Planning a Week (pp. 194–237)** — weekly-template placement of these workouts; multi-ability merging rules. (Appendix C p. 453, Appendix D p. 465, Appendix E p. 476)
- **Chapter 12** — referenced from Appendix B Speed Skills intro: "Revisit Chapter 12 for more details on SS training." (p. 449)
- **Friel, *The Power Meter Handbook*** — external book referenced from Ch 4 p. 85 for power-meter detail; relevant to MF/ME/AC bike workouts in Appendix C.
- **Internal cross-references (workout → workout):**
  - B/MF1 prerequisite: B/SS1 (p. 448 — "do one to three sets ... including short, fast repeats (such as SS1)")
  - B/SS1 fallback from B/MF1 on shoulder discomfort (p. 448)
  - C/AC2 references "AC1 session" (p. 461)
  - C/ME3 prerequisite: ≥30 min combined work-interval time with C/ME1 (pp. 460–461)
  - C/ME4 prerequisite: ≥4 prior C/ME interval workouts (p. 461)
  - C/T1 ↔ C/T2 ↔ C/T3 share course/setup; C/T2 piggybacks on C/T1 data per Ch 4 p. 90
  - D/ME3 prerequisite: ≥2 prior D/ME1 workouts (p. 471)
  - D/ME4 prerequisite: ≥4 prior D/ME interval workouts (p. 472)
  - D/AC3 prerequisite: ≥2 D/AC2 + ≥2 D/MF workouts (p. 473)
  - D/SS2 embedded inside D/TE1-style endurance runs (p. 470)
  - D/T1 anchors D-pace and D-HR zones for the next training period (p. 475); D/T3 maps to Table D.1 (pp. 473–474)
