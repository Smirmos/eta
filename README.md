# ETA Knowledge Base — Extraction Playbook

This is the handoff package for extracting the Friel methodology
into a structured knowledge base, run via Claude Code.

## Goal

Convert ~130 pages of *The Triathlete's Training Bible* (5th ed.)
into 5 structured markdown files that the plan generator will cite
from. Each file is a "page" of the knowledge base.

## Final output (what success looks like)

```
eta/
└── knowledge-base/
    ├── 01-zones.md              ← from Chapter 4 (~17 pages)
    ├── 02-atp-structure.md      ← from Chapter 7 (~30 pages)
    ├── 03-workouts.md            ← from Appendices B/C/D/E (~36 pages)
    ├── 04-weekly-templates.md    ← from Chapter 8 (~43 pages)
    └── 05-recovery.md            ← from Chapter 11 (~20 pages)
```

These files become the RAG corpus for plan generation.

---

## Repo setup

In a fresh repo (or a folder in your existing ETA repo):

```
eta/
├── sources/
│   └── friel-5e.pdf                ← the PDF you have
├── knowledge-base/                  ← extraction output goes here
├── prompts/
│   └── EXTRACTION_PROMPT.md        ← this folder's other file
└── README.md                        ← this file
```

Drop `friel-5e.pdf` into `sources/`. Drop `EXTRACTION_PROMPT.md`
into `prompts/`.

---

## Run order (recommended)

Process in this order. Each builds on validation from the previous.

1. **Chapter 4 (zones)** — most structured, fastest to validate
2. **Appendices B/C/D/E (workouts)** — taxonomy the rest references
3. **Chapter 7 (ATP)** — uses the zones and workout codes
4. **Chapter 8 (weekly templates)** — uses everything above
5. **Chapter 11 (recovery)** — adaptation rules, last

Don't skip the order. If zones extraction is bad, the workout
extractions inherit the same problems and you re-do everything.

---

## Per-chapter procedure

### Step 1: Open Claude Code in the repo

```
cd /path/to/eta
claude
```

### Step 2: Run the extraction

Paste this prompt (substitute the chapter):

```
Read sources/friel-5e.pdf, pages [START]-[END]. This is Chapter [N]
of *The Triathlete's Training Bible* (5th ed.) by Joe Friel.

Use the extraction rules and chapter-specific instructions from
prompts/EXTRACTION_PROMPT.md (specifically the "[CHAPTER LABEL]"
section).

Write the output to knowledge-base/[FILENAME].md.

Do not paraphrase. Cite page numbers verbatim. Flag ambiguity.
```

Page ranges to use:

| Chapter | Pages | Output file |
|---|---|---|
| Ch. 4: Training Intensity | 80–96 | `01-zones.md` |
| Ch. 7: Planning a Season | 157–188 | `02-atp-structure.md` |
| Appendices B/C/D/E | 445–481 | `03-workouts.md` |
| Ch. 8: Planning a Week | 194–237 | `04-weekly-templates.md` |
| Ch. 11: Rest and Recovery | 280–300 | `05-recovery.md` |

Page numbers above are the **PDF page numbers** (not the printed
book page numbers). They came from the PDF outline/bookmarks of
your specific copy. If your copy has different page numbers, adjust.

### Step 3: Audit the output

Open the generated markdown and check:

- [ ] **Tables match the book**: spot-check 3 tables against the PDF.
      Numbers must be identical.
- [ ] **Workout codes are complete**: pick a known workout code, find
      it in the appendix, confirm extraction has all the same fields.
- [ ] **Page citations present**: every claim cites a page.
- [ ] **No paraphrasing of zone definitions**: Friel's zone language
      is precise — make sure it's verbatim, not "smoothed."
- [ ] **No fabrications**: anything that feels like generic AI
      knowledge ("Z2 is endurance pace") rather than book content
      should be removed unless it's directly from Friel.

If output fails the audit, refine the prompt and re-run. Don't
hand-edit the markdown — fix the prompt instead, so all subsequent
chapters benefit.

### Step 4: Commit

```
git add knowledge-base/01-zones.md
git commit -m "kb: extract zones from Friel ch4"
```

Then move to the next chapter.

---

## Common failure modes and fixes

**Problem: numbers in tables look "off" by tiny amounts**
→ Likely a hallucination. The extraction prompt says verbatim, but
LLMs occasionally smooth numbers. Spot-check more aggressively.
If it happens repeatedly, add to prompt:
"Re-read each table TWICE. Confirm every number against the source."

**Problem: workout structure prose runs together as one paragraph**
→ The book may format with line breaks that get lost in PDF extract.
Check the rasterized version of that page. Add to prompt:
"Workout structures appear as bullet points or short lines in the
source. Preserve that structure."

**Problem: chapter references actual book chapter X but PDF page
numbers are different**
→ The book has its own page numbering separate from the PDF page
count. Decide which to cite. PDF pages are easier for our system to
verify; book pages are what readers see. **Recommend: cite PDF pages.**

**Problem: extraction is too long, gets cut off**
→ Run sub-sections separately. E.g., "Extract only the zone tables
section, pp. 86–95."

**Problem: missing content the chapter clearly has**
→ The "skip out-of-scope content" rule may be too aggressive. Tell
the extractor explicitly what's in scope: "Include all rule-like
statements, even if they appear in narrative paragraphs."

---

## After all 5 files exist

You have your knowledge base. Next steps (separate work, not part of
this handoff):

1. Build the macro plan generation prompt that reads from these files
2. Implement TSS/CTL/ATL/TSB math (independent of KB)
3. Test plan generation against your own AthleteProfile

We'll pick that up in chat together once the KB is built.

---

## Time estimate

- Chapter 4 (zones): ~30 min including audit
- Appendices: ~60 min (most workout codes)
- Chapter 7 (ATP): ~45 min
- Chapter 8 (templates): ~60 min
- Chapter 11 (recovery): ~30 min

Realistically: an evening of work, end-to-end. Maybe two if you're
careful with audits.

---

## Updating Jira

When done with each chapter, update the corresponding Jira task:

| Chapter | Jira ticket |
|---|---|
| Ch. 4 zones | ETA-8 |
| Appendices B/C/D/E workouts | ETA-9 |
| Ch. 7 ATP | ETA-7 |
| Ch. 8 templates | ETA-10 |
| Ch. 11 recovery | ETA-11 + ETA-12 |

Move tickets to "Done" as you go. Drop a comment with the commit
SHA of the extraction.

ETA-6 (the "build extraction prompt" task) closes when this whole
package has shipped — which is now.
