# Rest and Recovery

> Source: Friel 5th ed., Chapter 11, pp. 281–302 (PDF page numbers)
> Extracted: 2026-05-06

## Summary

Chapter 11 specifies how to monitor for recovery need (morning warnings,
HRV) and how to deliver recovery — both unplanned ("recovery on
demand") and planned (rest-and-recovery "weeks" of 3–5 days every third
or fourth week, race-week tapers, end-of-season transition periods).
Load-bearing content for plan generation: (1) **Table 11.1** (p. 283)
listing 9 morning-warning indicators with qualitative thresholds; (2)
**Table 11.2** (p. 296), the canonical 5-day rest-and-recovery week
template; (3) the rule that R&R "weeks" are 3–5 days, not 7 (p. 295);
(4) the recovery-on-demand trigger ("two consecutive days of warnings",
p. 297); (5) sport-specific taper-length ordering (run > bike > swim,
p. 299); (6) post-workout carb and protein dosing (pp. 288–290).

The chapter does **not** give specific HRV percentage thresholds (e.g.
"X% drop from baseline triggers Y") — only qualitative "out of normal
range" language. Friel recommends HRV4Training as the daily measurement
app but defers numeric thresholds to the app.

Page-citation convention: PDF page numbers (per EXTRACTION_PROMPT
rule 8). PDF p. 280 is the tail of Chapter 10; Chapter 11 title page
is p. 281. Body content begins at p. 282.

[FLAG: User's requested page range was pp. 280–302. PDF p. 280 is
Chapter 10 tail (the paragraph "Use your fatigue wisely..." closing
Ch 10 with "Now it's time to examine the other half: rest." and then
the OceanofPDF watermark). Citations from p. 280 below are noted
explicitly when present, but the chapter content proper is pp. 281–302.]

[FLAG: The chapter clearly continues past p. 302. The last visible
sentence on p. 302 is "Table 8.3 suggests one way to do this while
maintaining a high level of..." (mid-sentence). Text beyond p. 302
was not extracted; the load-bearing content for race-week and
transition-period rest is captured within the p. 281–302 range, but
the SUMMARY section running from p. 301 is truncated.]

---

## Recovery indicators (morning warnings)

### Definition

> "I call these morning warnings because they are most obvious when you
> awaken each day. Routinely monitoring a few of these indicators every
> morning will provide feedback on how well you are recovering." (p. 282)

> "There is nothing that tells you, with complete certainty, that
> you're exceeding your limits. There are only weak indicators that
> suggest something isn't right." (p. 282)

### Decision rule (count-based, not numeric)

> "any one of these warnings by itself is probably not enough to
> warrant a rest or recovery day, unless it is extreme. But two or more
> warnings on awakening may be enough for you to decide to take it easy
> that day." (p. 283)

> "Only experience will tell you which metrics are the best indicators
> for you and how many represent a need to decrease training. Like
> everything else in the realm of training, warnings of the need for
> rest and recovery are highly individualized." (p. 283)

### Table 11.1 — Common Morning Warning Indicators of Stress (p. 283)

Verbatim. Friel does **not** give specific numeric thresholds — only
qualitative descriptors.

| Indicators | Warning |
|---|---|
| Sleep | Poor quality and/or inadequate length |
| Overall feeling | Very fatigued, very stressed |
| Mood | Unusually grumpy, out of sorts |
| Appetite | Diminished |
| Motivation to train | Unusually low |
| Muscles, joints | Sore |
| Waking pulse | Out of normal range, either high or low |
| Comparison of supine and standing heart rates | Differential increased |
| Heart rate variability | Out of normal range |

Footnote (verbatim, p. 283): "These symptoms indicate that stress may
be too high and that rest and recovery may be needed."

[FLAG: Several indicators have no numeric threshold ("out of normal
range", "differential increased", "diminished"). The plan generator
must require user-supplied baselines for each indicator and let the
user (or the HRV app) define what "out of normal range" means
operationally. Friel says explicitly that this is "highly
individualized" (p. 283).]

[FLAG: Table 11.1 lists "Comparison of supine and standing heart
rates: Differential increased" as one indicator separate from waking
pulse. The chapter does not define the supine-to-standing test
protocol. This is a known orthostatic test in coaching literature, but
the chapter omits the procedure. Plan generator should treat this as
"requires external protocol definition."]

---

## HRV usage

### Definition (p. 283)

> "One of the best indicators of readiness to train is heart rate
> variability (HRV). This is a measure of the rhythm of your heartbeat
> and, in particular, how much variability there is between beats.
> Contrary to what is commonly believed, the rhythm is not constant.
> It's controlled by your nervous system, which is best known for
> managing your 'fight or flight' response in a stressful situation.
> When measured at rest, the parasympathetic branch of the nervous
> system, the one in charge of your rest and recovery status, modulates
> heart rhythm, and its activity can be captured by measuring HRV.
> Basically, HRV tells you how your body is handling stress, whether
> from training or other aspects of your life." (p. 283)

### Measurement protocol (p. 283–284)

> "It's simple to use, takes very little time (one minute), requires
> minimal equipment (your phone camera), and an app (such as
> HRV4Training). I highly recommend using this daily to determine your
> rest and recovery status, and readiness to train." (pp. 283–284)

### Numeric thresholds

[FLAG: Chapter 11 does not give specific HRV thresholds (no "X% drop
from baseline triggers Y" rules). Table 11.1 only says HRV is a
warning when "out of normal range." Friel defers numeric
interpretation to the HRV app (HRV4Training). Plan generator must
either: (a) accept a binary "HRV warning" signal from the app as one
of the indicators in Table 11.1's count-rule; or (b) implement its own
threshold (e.g. >1 SD below 7-day rolling mean) and document the
deviation from source.]

---

## Quick recovery protocols

### Day-of and post-workout recovery hierarchy

> "Whether you have time to fit it in or not, though, remember that
> it's critical to pay attention to your nightly sleep patterns and
> diet. Take care of those first. Don't try to substitute one or more
> of these methods [hot/cold immersion, music, leg elevation, foam
> roller, massage, stretching] for the basics of good nutrition and a
> good night's sleep." (p. 292)

Priority order (per p. 292): **sleep > food > everything else**.

### Sleep (pp. 284–286)

> "You already have the world's best device for recovery — your bed.
> Nothing is better. After all, the purpose of sleep is to rejuvenate
> and rebuild your muscular, skeletal, and immune systems. Sleep is
> your primary means of recovery from training stress." (p. 284)

> "Going to bed earlier and sleeping until you wake up naturally will
> undoubtedly improve your training and performance." (p. 285)

> "And it doesn't work to try to 'catch up' on sleep on the weekends.
> The body doesn't operate that way. It works best when you meet your
> restoration needs every day." (p. 285)

Common-sense sleep tips, verbatim list (p. 285):
- "avoiding caffeine in the late afternoon"
- "not working out immediately before bedtime"
- "maintaining a calm and quiet environment before going to bed"
- "following a regular sleep schedule"
- "bedding down in a dark, cool room"

Specific evidence-based rules (pp. 285–286):
- **Melatonin supplements: not recommended.** "When you use a
  supplement regularly to promote some functional change, your body
  typically responds by reducing or even halting its natural production
  of the targeted chemical." (pp. 285–286)
- **Tart cherry juice in the evening helps.** "Studies have confirmed
  that drinking a glass of tart cherry juice in the evening can help.
  ... The subjects in these studies had a natural increase in melatonin
  production and improved sleep compared with those who drank a
  placebo." (p. 286)
- **Alcohol: go light.** "go light on alcohol in the evening, if at
  all, because it has a rebound effect that can wake you later from an
  otherwise sound sleep." (p. 286)
- **Don't eat right before bed.** "A late evening meal or a pre-bedtime
  snack may also reduce sleep quality. So you probably shouldn't eat
  right before going to bed." (p. 286)
- **High-protein pre-bed meal > high-carb pre-bed meal.** "a study from
  the University of North Dakota showed that subjects who ate a
  high-protein meal right before bedtime had the fewest sleep
  interruptions. A high-carb meal produced the most restless sleep."
  (p. 286)

### Food (pp. 286–290)

> "Nearly all this rebuilding takes place while you sleep, and the
> quality of what you eat is critical for recovery." (p. 286)

> "Real food that's close to its original state costs much less and
> helps you recover more fully. Foods such as fruits, vegetables, animal
> products, berries, nuts, and seeds are the most powerful way you can
> support your training goals and general health." (p. 287)

> "Eating nutritionally dense, real food immediately following workouts
> is as important as it is during your regular meals, and it is
> probably the single best thing most athletes can do to improve
> recovery and health." (p. 287)

#### Carbohydrate dosing post-workout (p. 288)

> "The research suggests that about 1 to 1.85 grams of carbohydrate per
> kilogram of body weight (0.016–0.03 ounces per pound) is about the
> right amount to take in per hour after a hard workout."

Worked examples (p. 288):

| Body weight | Carb per hour |
|---|---|
| 120 lb (54.4 kg) | 2 to 3.6 oz (56.7–102 g) |
| 150 lb (68 kg) | 2.4 to 4.5 oz (68–127.6 g) |
| 170 lb (77.1 kg) | 2.7 to 5.1 oz (76.5–144.6 g) |

Reference foods (p. 289):
- Medium-size banana: ~1 oz (28.3 g) carbohydrate
- Glass of orange juice: ~1 oz carbohydrate
- Banana + OJ smoothie: ~2 oz carbohydrate

Duration / cadence:
> "You can drink something like that starting immediately and hourly
> thereafter for up to five hours after a workout." (p. 289)

> "Pay close attention to how well you recover after given workouts and
> what you ate as you recovered to get suggested carbohydrate recovery
> intakes for future similar workouts." (p. 289)

#### Carb dosing for low-carb / high-fat athletes (p. 289)

> "If you are an athlete who adheres to a low-carb, high-fat diet,
> however, post-workout food intake is not as critical for you as it is
> for the high-carb eater. You burn a lot of fat to fuel your workouts
> while sparing your supplies of glycogen, and you don't need to make
> a special effort to replace the fat afterward. Simply return to your
> normal foods to satisfy hunger, and the replenishment of fats will
> occur naturally." (p. 289)

#### Protein dosing post-workout (pp. 289–290)

> "Most of the research that studied the role of protein in recovery
> had subjects take in between 10 and 30 grams (0.35–1.05 ounces) of
> protein every three to four hours following a hard workout."
> (p. 289)

Reference foods (pp. 289–290):

| Food | Protein |
|---|---|
| Large boiled egg | ~7 g (0.25 oz) |
| 8-oz glass of milk (~237 mL) | ~7 g (0.25 oz) |
| 3 tbsp peanut butter (~45 g) | ~14 g (0.5 oz) |
| 3 oz cheddar cheese (85 g) | ~21 g (0.75 oz) |

#### Pre-bed protein (p. 290)

> "Other research has found that taking in a similar amount of protein
> shortly before going to bed for the night also improves the body's
> capability for recovery and the repair of damaged muscles following a
> hard training day." (p. 290)

#### High-fat diet rationale (p. 288)

> "many ultra-endurance athletes have found that a high-fat diet
> improves their race performances. They are less likely to 'bonk'
> because they are burning mostly fat for fuel. Even the skinniest
> triathlete theoretically has enough stored fat to do a triathlon that
> lasts several days. And because fat-adapted athletes need less food
> during a race, they eliminate the likelihood of gastric distress.
> This is especially advantageous in races such as long-course
> triathlons." (p. 288)

### Fluids (pp. 290–291)

> "drink fluids steadily to satisfy your thirst throughout the
> post-workout hours. There is really no need to weigh yourself before
> and after the session and then drink that exact amount of fluids."
> (p. 290)

> "If thirsty, drink. If not thirsty, don't drink. It's that simple."
> (p. 290)

Exception — over 60:
> "There is some research showing that the thirst sensation of elderly
> people is decreased when compared with that of younger subjects. ...
> But if you're over 60, it is probably in your best interest to pay
> close attention to drinking after a workout. You may need to drink
> just a bit beyond thirst." (p. 290)

Hyponatremia warning:
> "if you get carried away with drinking lots of fluids even when
> you're not thirsty, you set yourself up for far greater problems, the
> most common of which is hyponatremia. That's the dilution of sodium
> stores in the blood that leads to poor performance, collapse, and
> even death." (p. 291)

What to drink:
> "What should you drink? The best option is again simple — water.
> However, if you're taking in a carbohydrate-based drink, like the
> orange juice–banana smoothie suggested above, that will certainly
> contribute to successful rehydration." (p. 291)

> "It seems the old saw that coffee and alcoholic beverages cause
> dehydration is apparently not true. There is considerable research
> showing that both contribute positively to hydration. This doesn't
> mean you should necessarily use a cuppa joe or a beer to recover. I'm
> just setting the record straight." (p. 291)

### Active recovery (pp. 291–292)

#### When active recovery works

> "those who experienced a speedy recovery by going easy were usually
> advanced athletes. Another caveat appears to be that this method
> works only if the athlete has a high level of fitness. What that
> means for you, if you are beyond three years of serious training in
> the sport, is that doing an easy workout later the same day and
> perhaps having another easy workout the following day works best in
> the base, build, and peak periods, when fitness should be high."
> (p. 291)

#### When active recovery does NOT work

> "It is likely less effective in the prep period at the start of the
> season or after some time away from regular training. The same would
> hold true if you've had time away from training because of injury or
> illness and lost a significant amount of fitness. If in doubt about
> what to do, total rest is the way to go." (p. 291)

#### Active-recovery workout definition

> "An active-recovery workout is one that doesn't further stress the
> body's systems. That means truly taking it easy. The session should
> be shorter than your average workout and the intensity should be
> zone 1 whether you use heart rate, power, pace, or perceived
> exertion (see Chapter 4). In other words, it should be really easy.
> To ensure that this is the case, it's best to avoid other athletes.
> You're more likely to keep it easy if you are swimming, biking, or
> running solo." (p. 291)

#### Sport choice for active recovery (p. 292)

Ranked best to worst per Friel:

1. **Swimming** — "best is usually swimming. An active-recovery swim is
   a good time to work on skills. If your legs are trashed from a hard
   ride or run, a pull buoy may be in order."
2. **Bike** — "Riding your bike on a relatively flat course or on an
   indoor trainer is usually the second-best option."
3. **Running** — generally avoid. "Unless you have been running for
   many years and don't have a history of running-related injuries,
   I'd recommend avoiding active-recovery runs. For most triathletes,
   running is simply too orthopedically stressful for quick recovery.
   Even if you're one of the fortunate few who isn't prone to injury,
   it's still best to hold down the risk by keeping the run very
   short, very easy, and on a soft surface such as grass, dirt, or
   gravel."

### Other recovery aids (p. 292)

Listed methods (research mixed): "Alternating hot and cold water
immersion, listening to music, elevating the legs, using a foam roller,
massage, and stretching." (p. 292)

> "the recovery benefits, if there are any for you, are rather small
> when compared with those of sleep and food." (p. 292)

### Compression garments (p. 293)

> "the performance benefits of compression garments during a race are
> minimal and perhaps nonexistent. The time it takes to put the garment
> on in the transition area is probably greater than the amount of time
> gained by wearing it, if there is any time gain at all." (p. 293)

> "When it comes to recovery, however, I believe there may be some
> benefit. Most of the research suggests this also." (p. 293)

> "So there may be something beneficial in using compression garments
> in the hours immediately after a workout to assist recovery. This
> recovery aid is worth a try." (pp. 293–294)

### Pneumatic compression devices (p. 294)

> "Do they work? The consensus seems to be that they do. Then again,
> like other recovery products, they may simply be a placebo. The
> research on their effectiveness is generally positive. My impression
> from having used one considerably is that they are beneficial. Not
> everyone agrees." (p. 294)

---

## Planned recovery (rest-and-recovery weeks)

### Frequency

> "rest-and-recovery weeks ... come after two or three weeks of hard
> training" (p. 301, summary)

> "include breaks from training every third or fourth week. This is
> evident in Tables 7.5 and 7.6, where in every period's week 4 the
> hourly volume or training stress score is decreased considerably
> compared with that of previous weeks in the same period. These are
> the planned rest-and-recovery weeks." (p. 295)

### Duration: NOT 7 days

> "Rest-and-recovery 'weeks' are seldom seven days long. Most advanced
> triathletes can recover and be ready to go again in fewer than seven
> days. Significantly reducing the training load for three to five
> days is usually enough." (p. 295)

> "rest-and-recovery 'week' should not literally be taken to mean
> seven days. Some athletes recover very quickly and may find that they
> are ready to go again in three days. Others need five days or more.
> Older athletes are more likely than younger athletes to need longer
> recovery breaks. Less fit athletes also need more time than those who
> are highly fit." (p. 301)

### Cycle math (p. 296)

For a **3-week** training cycle:
- 4-day R&R → 17 days of focused training (21 minus 4)
- 5-day R&R → 16 days of focused training (21 minus 5)

For a **4-week** training cycle:
- 3-day R&R → 25 days of focused training (28 minus 3)

> "the number of days devoted to quality training may vary from period
> to period depending on how long you decide to make your rest-and-
> recovery breaks. You can make that decision during the break as you
> gauge how well you are recovering." (p. 296)

### Volume reduction (qualitative)

[FLAG: Chapter 11 does NOT give a specific percentage volume reduction
for the R&R week. The chapter says "Significantly reducing the training
load for three to five days is usually enough" (p. 295) and references
Tables 7.5 and 7.6 for the actual volume numbers. Plan generator must
read the percentage from those Ch 7 tables (already extracted in
`02-atp-structure.md`). Friel does say "greatly reduce the volume of
training and eliminate all high-intensity sessions" (p. 297) for
recovery on demand, but no exact percentage.]

### Intensity reduction (specific)

> "When you realize that it's time to take a break from training based
> on your apparent need for rest, greatly reduce the volume of training
> and eliminate all high-intensity sessions until you're ready to start
> training normally again. The primary type of workout you should use
> in a rest and recovery week is **AE1** — that's a zone 1 recovery
> session. It should be short relative to what you normally do in a
> training week. The other alternative is speed skills for swimming."
> (p. 297)

[Cross-reference: AE1 = Recovery workout, see `03-workouts.md` lines
72 (B/AE1), 283 (C/AE1), 544 (D/AE1). Note E/AE1 (line 822) is
"Aerobic Endurance Brick", a different code — Ch 11 means the
zone-1 recovery AE1 from B/C/D, not the E/AE1 brick.]

### Common mistakes (p. 295)

> "the biggest mistake you can make is to continue to train through
> what was planned to be a rest-and-recovery week. Athletes often do
> this because they feel a need to gain more fitness in the last few
> weeks before an important race. This is a huge mistake. Even if you
> manage to avoid a breakdown, the quality of training will decline as
> fatigue continues to accumulate, and the result will be an even worse
> race performance." (p. 295)

> "Another common mistake is to make the workouts too hard on what are
> supposed to be easy days. Instead of doing them in zone 1, as called
> for in the training plan, they become zone 3. Or what is supposed to
> be a short active-recovery session becomes a long one. ... Sometimes
> the best way to improve fitness is to go easy." (p. 295)

### Two-a-day adjustment in R&R week (p. 296)

Atomic rules:
- "If you frequently do three workouts a day in a 'normal' training
  week, do no more than two a day in a rest-and-recovery week."
- "If two-a-day sessions are your common way to train, then do only one
  workout per day in a rest-and-recovery break."
- "If one session per day is what you usually do, then do that in a
  rest-and-recovery week, but also be sure to take at least one day off
  from training altogether."
- "I recommend some single-workout days regardless of your usual
  schedule."
- "Those who usually work out more than 14 times in a week may opt to
  do a very light workout on Monday."
- "But if in doubt, leave it out. You'll likely recover faster this
  week if one of the days is a day with no swim, bike, or run workout."

Summary cap (p. 302): "**The starting point is to do one less workout
than you normally do in a day.** So if you normally do a daily session
in each sport — three-a-days — leave one out on each recovery day and
vary which two you do each day. If you usually do two sessions a day,
do only one. If you typically do only one, take a couple of days off
completely. If you are not recovering quickly during these days, then
do even less. The purpose is recovery from fatigue — not more fitness.
Less is better now."

### Table 11.2 — A Typical 5-Day Rest-and-Recovery Week (p. 296)

|  | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday |
|---|---|---|---|---|---|---|---|
| Purpose | Rest/recovery | Recovery | Recovery | Recovery | Recovery | Test | Test |
| Workout | Day off | Swim | Bike | Run | Swim | Run test | Bike test |
| Optional second workout | Strength | Run | Swim | Bike | Bike | Swim test | (None) |

Counts (5 R&R days + 2 test days):
- Mon (rest), Tue–Fri (recovery), Sat–Sun (test)
- Workouts assume test days = end of R&R block

> "This could easily be made into a three- or four-day break from
> serious training." (p. 296)

> "Note that an 'optional second workout' is listed for most days."
> (p. 296)

### Defining an "easy day" (p. 302)

> "What exactly an 'easy' day of training consists of depends on the
> athlete. Recall from Chapter 3 that the only two training variables
> you can manipulate to make a workout easy or hard are duration and
> intensity. When it comes to intensity, defining an easy day is
> simple. It's a zone 1 workout. Duration is a bit harder to be so
> precise about. If you're an elite athlete who trains upward of 30
> hours per week, a workout with an easy duration may be a 2-hour ride.
> But if you train 6 hours in a week, then an easy duration may be
> something more like 20 minutes." (p. 302)

### Rest and Test (p. 297)

> "the last two days of the [R&R] week are dedicated to testing. This
> is the perfect time to measure your progress, because you're rested
> and ready to go. The number and type of tests you do are entirely up
> to you. You could, for example, decide to test all three sports.
> That's what is assumed in Table 11.2. Or you could decide to test
> only one or two sports. There may even be times when you decide not
> to test at all and get right back into serious training. As for which
> ability to test within a given sport, see the test protocols in
> Appendixes B, C, and D." (p. 297)

### Recovery on demand (pp. 297–298)

> "Athletes who have been around the sport for many years and are good
> at sensing when they need a break from serious training can take a
> break based strictly on their experience. This is called *recovery
> on demand*. **When the morning warnings for two consecutive days
> indicate you've reached your limit, you simply assume that you need
> a break.** This can happen at any time and is not based on a planned
> schedule." (p. 297)

> "Recovery on demand is the ultimate method for managing recovery. It
> works best for coached athletes, when athlete and coach have daily,
> face-to-face contact. ... Most self-coached athletes, however, are
> emotionally attached to their goal to the point of disregarding
> their physical condition and are not good at stepping back to take
> in the big picture. So if you are not good at this and don't have
> close contact with a coach, it's best that you pre-plan your
> rest-and-recovery weeks." (p. 298)

---

## Race-week rest pattern (taper)

### Taper length

> "A taper typically lasts one to three weeks, depending on many
> variables." (p. 299)

Variables that LENGTHEN the taper (p. 299):
- More important race
- Higher fitness level
- Longer race distance
- Later in the season
- Running > cycling > swimming (orthopedic stress ordering)

Verbatim:
> "The more important the race, the more likely your taper period
> should be long. The more fit you are, the longer the taper may be.
> The longer the race, the longer the taper. Races late in the season
> may benefit more from a longer taper than those earlier in the year.
> Taper length also varies by sport. Running, for example, demands a
> longer taper than cycling because the body is subjected to more
> orthopedic stress during running. Cycling generally requires more
> tapering than swimming." (p. 299)

### B-priority race taper

> "A bare-bones, minimum taper is about two to three days of greatly
> decreased activity. That's the sort of thing you do right before a
> B-priority race. It's just enough to shed a bit of the fatigue."
> (p. 299)

### A-priority race taper

> "for an A-priority race, you need a longer taper. It might consist
> of two to three weeks of stair-stepped training reduction —
> especially a reduction of workout duration and therefore training
> volume. Table 8.2 provides guidance on how to organize a taper
> during the peak period that ends about a week before a race. Table
> 8.3 suggests how you may train in this last week leading up to the
> race." (p. 299)

[Cross-reference: Tables 8.2 and 8.3 are in `04-weekly-templates.md`
(pp. 218–221 of the source). Ch 11 defers the day-by-day race-week
schedule to Ch 8.]

### Night-before-race rule (p. 300)

> "The night before the race, go to bed at a time similar to when you
> normally bed down. You may have trouble falling asleep. That's not
> unusual for athletes of all abilities, but somewhat more common for
> those who are less experienced with racing. You need not be
> concerned if you have a sleepless night. One research study
> conducted at the University of Texas showed that 25 to 30 hours of
> sleep deprivation did not cause a loss of aerobic performance in
> male and female cyclists. It's likely the same for swimming and
> running." (p. 300)

### Zatopek effect (pp. 298–299)

> "Sometimes the body must say 'enough' in order to come into form."
> (p. 299, restated as callout p. 300)

Forced rest before a key race (e.g. illness, minor injury) can
counterintuitively produce a peak. Friel calls this "the Zatopek
effect" after the Czech runner who won 5,000m, 10,000m, and marathon
gold at the 1952 Helsinki Olympics following hospitalization for food
poisoning two weeks before the 1950 European Games (won both 10,000m
and 5,000m by 23 seconds).

---

## Transition-period rest and recovery (pp. 300–301)

> "After a race, you also need a break from highly focused, physically
> and mentally demanding workouts before you ramp up the training for
> your next race. This is the transition period — a time of greatly
> reduced physical activity." (p. 300)

### Duration by race type / season position

| Scenario | Transition duration |
|---|---|
| After early or midseason A-priority **short-course** race | 3 to 7 days |
| After early or midseason A-priority **long-course** race | 2 to 3 weeks |
| After **last race of the season** | 2 to 6 weeks |

(All ranges verbatim, p. 300.)

### Transition-period activity rules (p. 301)

> "Some low-key workouts during this period, along with occasional days
> off, are good for maintaining a bit of aerobic fitness while
> satisfying your need to be active. This is the time of the year when
> it's best not to have a plan. Decide each day what you will do for
> exercise, if anything at all. You could go for an easy ride with a
> buddy. But exercise now doesn't have to be swimming, biking, and
> running. You might hike in the hills with your family. Perhaps you
> play a pickup basketball game with friends. Or maybe you decide to
> try your hand at tennis. Don't become totally inactive. Do something
> on most days, but don't make it more of the same focused training
> that you've done throughout most of the preceding season." (p. 301)

### When to end transition period (p. 301)

Three concurrent signals:
1. "There are no more aches or pains"
2. "You're so well rested you are perhaps starting to gain weight"
3. "You start craving focused training again"

> "This is when it's time to begin a new season." (p. 301)

---

## Adaptation rules (decision triggers)

Atomic, code-implementable rules. Each: trigger condition + action +
page citation.

### Daily monitoring rules

1. **2+ morning warnings → easy day (p. 283).** "two or more warnings
   on awakening may be enough for you to decide to take it easy that
   day."
2. **1 extreme warning → take a rest or recovery day (p. 283).** "any
   one of these warnings by itself is probably not enough to warrant
   a rest or recovery day, **unless it is extreme**."
3. **2 consecutive days of warnings → unplanned R&R block (p. 297).**
   "When the morning warnings for two consecutive days indicate
   you've reached your limit, you simply assume that you need a
   break."
4. **Unplanned R&R: cut volume + eliminate high intensity (p. 297).**
   "greatly reduce the volume of training and eliminate all
   high-intensity sessions until you're ready to start training
   normally again. The primary type of workout you should use in a
   rest and recovery week is AE1 — that's a zone 1 recovery session."
5. **R&R workout: zone 1 only (p. 297, p. 302).** "It's a zone 1
   workout."

### Volume / cycle rules

6. **R&R every 3rd or 4th week (p. 295).** Per Tables 7.5 and 7.6,
   week 4 of every 4-week period (or week 3 of every 3-week period)
   is the planned R&R week.
7. **R&R duration: 3 to 5 days, not 7 (p. 295).** "Rest-and-recovery
   'weeks' are seldom seven days long. ... Significantly reducing
   the training load for three to five days is usually enough."
8. **3-week training cycle math (p. 296).** 4-day R&R → 17 days hard
   training; 5-day R&R → 16 days hard training.
9. **4-week training cycle math (p. 296).** 3-day R&R → 25 days hard
   training.

### R&R two-a-day reduction rules

10. **3-a-day normal → ≤2-a-day in R&R (p. 296).**
11. **2-a-day normal → 1-a-day in R&R (p. 296).**
12. **1-a-day normal → 1-a-day in R&R + ≥1 full day off (p. 296).**
13. **Always include single-workout days in R&R (p. 296).** "I
    recommend some single-workout days regardless of your usual
    schedule."
14. **>14 weekly workouts: optional very-light Monday (p. 296).**
    "Those who usually work out more than 14 times in a week may opt
    to do a very light workout on Monday."
15. **Default starting point: do one less workout than usual (p. 302).**
    "The starting point is to do one less workout than you normally
    do in a day."
16. **Not recovering quickly → do even less (p. 302).** "If you are
    not recovering quickly during these days, then do even less."

### Active-recovery selection rules

17. **Active recovery requires high fitness + 3+ years experience
    (p. 291).** "this method works only if the athlete has a high
    level of fitness. What that means for you, if you are beyond
    three years of serious training in the sport, is that doing an
    easy workout later the same day and perhaps having another easy
    workout the following day works best in the base, build, and
    peak periods, when fitness should be high."
18. **No active recovery in prep period or after layoff (p. 291).**
    "It is likely less effective in the prep period at the start of
    the season or after some time away from regular training."
19. **In doubt → total rest, not active recovery (p. 291).** "If in
    doubt about what to do, total rest is the way to go."
20. **Active-recovery duration < average workout (p. 291).** "The
    session should be shorter than your average workout..."
21. **Active-recovery intensity = zone 1 (p. 291).** "...the intensity
    should be zone 1 whether you use heart rate, power, pace, or
    perceived exertion."
22. **Active-recovery sport priority: swim > bike > run (p. 292).**
    Most triathletes should avoid active-recovery runs.
23. **Active recovery alone (p. 291).** "it's best to avoid other
    athletes."

### Sleep rules

24. **Sleep > food > all other recovery (p. 292).** "the recovery
    benefits [of other aids], if there are any for you, are rather
    small when compared with those of sleep and food."
25. **Sleep until natural waking (p. 285).** "Going to bed earlier
    and sleeping until you wake up naturally will undoubtedly improve
    your training and performance."
26. **No weekend sleep catch-up (p. 285).** "it doesn't work to try
    to 'catch up' on sleep on the weekends. The body doesn't operate
    that way."
27. **No melatonin supplements (pp. 285–286).** Reason given: body
    reduces natural production.
28. **Tart cherry juice in evening promotes sleep (p. 286).** "Studies
    have confirmed that drinking a glass of tart cherry juice in the
    evening can help."
29. **No alcohol in evening (p. 286).** "go light on alcohol in the
    evening, if at all, because it has a rebound effect that can wake
    you later."
30. **No late evening meal / pre-bedtime snack (p. 286).** "may also
    reduce sleep quality. So you probably shouldn't eat right before
    going to bed."
31. **Pre-bed protein > pre-bed carbs IF eating (p. 286).** "subjects
    who ate a high-protein meal right before bedtime had the fewest
    sleep interruptions. A high-carb meal produced the most restless
    sleep."
32. **Pre-bed protein dose for muscle repair (p. 290).** "taking in a
    similar amount of protein [10–30 g] shortly before going to bed
    for the night also improves the body's capability for recovery."

### Post-workout nutrition rules

33. **Post-workout carbs (high-carb athlete): 1–1.85 g/kg/hour
    (p. 288).** Worked: 120 lb → 56.7–102 g/h; 150 lb → 68–127.6 g/h;
    170 lb → 76.5–144.6 g/h.
34. **Post-workout carb cadence: hourly for up to 5 hours (p. 289).**
35. **Low-carb / high-fat athlete: no special post-workout intake
    needed (p. 289).** "Simply return to your normal foods."
36. **Post-workout protein: 10–30 g every 3–4 hours (p. 289).**
37. **Drink to thirst (p. 290).** "If thirsty, drink. If not thirsty,
    don't drink."
38. **Over 60 → drink slightly beyond thirst (p. 290).** Reason:
    decreased thirst sensation in elderly per research.
39. **Don't overhydrate (p. 291).** Hyponatremia risk.
40. **Best fluid: water; carb-based drink also OK (p. 291).**

### Race-week / taper rules

41. **B-race taper: 2–3 days greatly decreased activity (p. 299).**
42. **A-race taper: 2–3 weeks stair-stepped reduction (p. 299).**
    Especially reduce duration / volume.
43. **Taper length scales with race importance, fitness, distance,
    season position (p. 299).**
44. **Sport-specific taper-length ordering: run > bike > swim
    (p. 299).** "Running, for example, demands a longer taper than
    cycling because the body is subjected to more orthopedic stress
    during running. Cycling generally requires more tapering than
    swimming."
45. **Race day-by-day schedule: defer to Tables 8.2 and 8.3 (p. 299).**
46. **Sleepless night before race: not a concern (p. 300).**
    "25 to 30 hours of sleep deprivation did not cause a loss of
    aerobic performance in male and female cyclists" (University of
    Texas study).

### Transition-period rules

47. **Transition after midseason short-course A-race: 3–7 days
    (p. 300).**
48. **Transition after midseason long-course A-race: 2–3 weeks
    (p. 300).**
49. **Transition after last race of season: 2–6 weeks (p. 300).**
50. **Transition activity: unstructured, varied, daily-discretion
    (p. 301).** "This is the time of the year when it's best not to
    have a plan. ... Don't become totally inactive. Do something on
    most days, but don't make it more of the same focused training."
51. **End transition when 3 conditions met (p. 301).** No aches/pains
    AND well-rested-perhaps-gaining-weight AND craving focused
    training.

### Recovery on demand eligibility (p. 298)

52. **Recovery on demand requires: experienced + coached daily
    (p. 298).** "It works best for coached athletes, when athlete and
    coach have daily, face-to-face contact."
53. **Self-coached athletes default to pre-planned R&R (p. 298).**
    "if you are not good at this and don't have close contact with a
    coach, it's best that you pre-plan your rest-and-recovery
    weeks."

### Additional rules from p. 302 summary (post-audit additions)

54. **[Daily monitoring] Morning warnings override the planned hard
    day (p. 297).** "Heeding the morning warnings accurately is a
    skill most of us don't have because it involves paying very close
    attention to how all the body's systems are responding to
    training. And it sometimes implies taking an easy day even though
    a hard one was scheduled." → If morning warnings indicate
    overload on a day the plan calls for hard work, swap to the
    easy-day prescription (zone 1, shorter than average) and
    reschedule the hard workout.
55. **[Volume / cycle] Within-week easy days are priority #2 after
    R&R weeks (p. 302).** "Second in importance are the easy days
    that are included every week throughout the season. These can be
    planned, as when a hard training day is routinely followed by an
    easy one or even a day off." → After the every-3rd-or-4th-week
    R&R week, the next-most-important rest pattern is the within-week
    hard/easy alternation (every hard day followed by an easy day or
    a day off).
56. **[Race-week / taper] Week before A-race AND week after A-race
    are paired critical rest periods (p. 302).** "Two other times in
    the season when rest and recovery are critical are in the week
    immediately preceding an A-priority race and the week after. If
    you don't cast off a significant amount of fatigue before an
    important race, you are likely to have a poor performance." →
    Treat both pre-race taper week and post-race recovery week as
    rest periods, not just the taper alone. (Note: the post-race
    recovery week falls inside the transition period defined by
    Rules 47–49.)

---

## Workout codes referenced in this chapter

Cross-reference back to `knowledge-base/03-workouts.md`:

| Code (in Ch 11) | Meaning | Source page | 03-workouts.md entry |
|---|---|---|---|
| AE1 | Zone-1 Recovery session | p. 297 | B/AE1 (line 72) "Recovery", C/AE1 (line 283) "Recovery", D/AE1 (line 544) "Recovery" ✓ |

[FLAG: 03-workouts.md also defines `E/AE1` (line 822) as "Aerobic
Endurance Brick" — a different workout entirely. The AE1 referenced on
p. 297 is unambiguously the B/C/D Recovery workout, not the E brick.
Plan generator must respect this disambiguation.]

The chapter introduces no new workout codes.

---

## Emphasized concepts (pull-quote callouts)

Sidebar callouts (rule 13). Author-emphasized statements.

1. "Two or more warnings on awakening may be enough to decide to take
   it easy that day." (p. 282)
2. "Going to bed earlier and sleeping until you wake up naturally will
   improve your training and performance." (p. 285)
3. "Never stand if you can lean, never lean if you can sit, and never
   sit if you can lie down." (p. 285)
4. "High-stress training increases the need for high-quality food."
   (p. 288)
5. "Nutrient density is one of the main reasons why you're better off
   preparing your food yourself." (p. 288)
6. "Even the skinniest triathlete has enough stored fat to do a
   triathlon that lasts several days." (p. 289)
7. "Your experience plays a big role in deciding what to eat after a
   training session." (p. 289)
8. "Protein after a stressful workout is beneficial for rejuvenation
   and muscle building." (p. 290)
9. "An active-recovery workout is one that doesn't further stress the
   body's systems." (pp. 291–292)
10. "It is critical to pay attention to your nightly sleep patterns
    and diet." (p. 292)
11. "There may be a benefit to using compression garments immediately
    following a workout to assist recovery." (p. 294)
12. "Your body adapts to hard workouts through rest and recovery."
    (p. 295)
13. "Most advanced triathletes can recover and be ready to go again in
    fewer than seven days." (p. 297)
14. "Recovery on demand is the ultimate method for managing recovery."
    (pp. 297–298)
15. "Sometimes the body must say 'enough' in order to come into form."
    (p. 300)
16. "A bare-bones, minimum taper is about two to three days of greatly
    decreased activity." (p. 300)
17. "You need not be concerned if you have a sleepless night." (p. 300)

---

## Open questions / flags

1. **No specific HRV thresholds.** Chapter 11 does not give "X% drop
   from baseline triggers Y" rules, despite naming HRV as one of the
   nine morning-warning indicators. Friel defers numeric interpretation
   to the HRV4Training app. The plan generator must either accept a
   binary "HRV warning" signal from the app, or define its own
   threshold and document the deviation from source.

2. **Several Table 11.1 indicators have no operational definition.**
   "Out of normal range" (waking pulse, HRV), "differential increased"
   (supine vs. standing HR), "diminished" (appetite) — all qualitative.
   The chapter explicitly calls these "highly individualized" (p. 283).
   The plan generator must require user-supplied baselines.

3. **Supine-vs-standing HR test protocol not defined.** Table 11.1
   names this test as one indicator but the chapter doesn't provide
   the procedure. This is a known orthostatic test in coaching
   literature, but the chapter omits it. Treat as "external protocol
   required."

4. **No specific R&R volume reduction percentage.** Chapter 11 says
   "significantly reduce" and "greatly reduce" but defers to Tables
   7.5 / 7.6 in Chapter 7 for the actual numbers (already extracted
   in `02-atp-structure.md`). Plan generator should read percentages
   from the Ch 7 tables, not from Ch 11 prose.

5. **Chapter content extends past p. 302.** The user's requested page
   range was pp. 280–302. The last visible sentence on p. 302 is
   "Table 8.3 suggests one way to do this while maintaining a high
   level of..." (mid-sentence). The SUMMARY: REST AND RECOVERY
   section starts on p. 301 and runs into p. 302; some of it is
   captured here, but text past p. 302 was not extracted. The
   load-bearing rules (Table 11.1, Table 11.2, taper rules,
   transition rules, R&R math) are all captured within the requested
   range.

6. **Recovery-on-demand vs. planned-recovery overlap.** The chapter
   describes both as valid strategies but says recovery-on-demand
   "works best for coached athletes" (p. 298). For the plan generator
   targeting self-coached users (per the project's user model), the
   default should be **planned R&R** every 3rd or 4th week, with
   morning-warning monitoring as a *supplementary* trigger that can
   shorten or extend the planned break — not replace it.

7. **"Test" days at end of R&R: untyped.** Table 11.2 says Sat/Sun
   are "Run test" / "Bike test" / "Swim test" but doesn't specify
   which test (T1, T2, T3, etc.) — defers to Appendices B/C/D test
   protocols. Plan generator should pick an appropriate test from
   `03-workouts.md` based on the period the R&R week ends (e.g. base
   2 → muscular endurance test; base 3 → aerobic capacity test).

8. **"AE1" disambiguation.** The chapter says "the primary type of
   workout you should use in a rest and recovery week is AE1" (p. 297).
   `03-workouts.md` has FOUR entries for "AE1" — three are zone-1
   Recovery (B/C/D, lines 72, 283, 544); one is "Aerobic Endurance
   Brick" (E/AE1, line 822). The Ch 11 reference is unambiguously the
   B/C/D Recovery, but a future reader could mistake it for the E
   brick. Flagged in the workout-codes table above.

9. **No explicit guidance on R&R within build/peak.** Chapter 11
   covers planned R&R weeks across the season uniformly but does not
   explicitly address whether an R&R week in build 2 (1–2 weeks before
   peak) should be shorter / different. The Chapter 8 peak-week and
   race-week templates implicitly fold rest into the period structure.

10. **"Greatly reduce" volume — not quantified.** For recovery on
    demand (p. 297). Plan generator should default to ~50% volume +
    eliminate intensity > zone 1, by analogy to the Ch 7 R&R-week
    pattern. **This is interpolation, not source content.**

---

## Cross-references out

- **Chapter 3** (training fundamentals): pp. 295, 302 (workout
  variables: duration vs. intensity).
- **Chapter 4** (intensity zones): p. 291 (zone 1 definition for
  active-recovery workouts).
- **Chapter 7** (Planning a Season): pp. 295, 296 (Tables 7.5 and 7.6
  for R&R volume specifics; periodization context).
- **Chapter 8** (Planning a Week): p. 299 (Tables 8.2 and 8.3 for
  taper and race-week schedules).
- **Chapter 9** (alternative periodization): p. 296 (3-week vs. 4-week
  training cycles).
- **Chapter 10** (overtraining): pp. 281, 282 (precondition for this
  chapter; symptoms of overtraining as the failure mode this chapter
  prevents).
- **Chapter 13** (strength training): not directly cited in Ch 11.
- **Appendices B, C, D** (workout taxonomy): pp. 297, 297 (AE1 zone-1
  recovery sessions; test protocols at end of R&R weeks).
- **External: HRV4Training app** (p. 284): recommended daily HRV
  measurement tool. Plan generator must integrate or defer.
- **External: University of North Dakota study on pre-bed meal
  composition** (p. 286). Not cited; high-protein > high-carb finding.
- **External: University of Texas study on sleep deprivation in
  cyclists** (p. 300). Not cited; 25–30 h deprivation did not impair
  aerobic performance.
