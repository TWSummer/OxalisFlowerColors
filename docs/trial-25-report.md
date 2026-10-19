# First trial of the new Redwood Sorrel fields

**Historical trial results:** the later [125-observation re-review](guide-review-report.md) supersedes affected judgments and supplies the current photographic guide. The original counts and audits below are preserved unchanged.

18 October 2026 · original protocol 2.0.0; ring revision under 2.1.0

## Current ring revision

The ring field now uses **Absent / Faint / Clear / Cannot be determined**. Following the project owner's feedback, 347719180 changed from Absent to Cannot be determined because the cupped, oblique view can hide an inner pale band. 294114815 changed from Present to Faint because its visible basal paling blends into the pale pink petals. The other seven Present examples were visually reassessed and changed to Clear.

The current ring totals are **0 Absent, 1 Faint, 7 Clear, and 17 Cannot be determined**. The other three traits are unchanged. All 100 project values across the 25 observations were checked through the public observation-detail API at **06:46:29 UTC**; only the nine intended ring values changed, with no unrelated field changes or changed photo lists. There are now 78 determinate and 22 indeterminate values in the set.

The [ring revision audit](data/ring-revision-2026-10-18.jsonl) contains the nine before/after records and reasons. Its color, vein and variation assessments are explicitly carried from the original trial, not rescored in this revision. The website snapshot was refreshed after verification. The original audit and results below are retained as history, not current ring instructions.

## Original trial verification

All four new fields were added to **25 observations**, for **100 verified field values**. A final unauthenticated iNaturalist observation-detail API check at **06:21:30 UTC** found every expected field ID/value, no changes to pre-existing field values, no unexpected new field values, and no changed photo lists. There were no blocked observations or same-field conflicts.

## Original results

- **Petal color:** 15 White, 4 Pink, 5 Purple, 1 Cannot be determined.
- **Petal vein contrast:** 5 Low, 12 Medium, 7 High, 1 Cannot be determined.
- **White center ring:** 8 Present, 1 Absent, 16 Cannot be determined.
- **Petal pigment variation:** 21 None, 1 Low, 0 High, 3 Cannot be determined.

These are observation counts, not estimates of population frequencies. There are 79 determinate values and 21 explicitly indeterminate values. Indeterminate values are included in the 100 saved entries.

## What the trial showed

The traits can be scored independently. [Observation 48617846](https://www.inaturalist.org/observations/48617846) has White petals, High vein contrast, and None background pigment variation. Strong veins do not make the petal background colored or variable.

The initial ring field was scored as assessable on nine observations. [Observation 73278626](https://www.inaturalist.org/observations/73278626) was initially Present and is now Clear. The original Absent judgment for [347719180](https://www.inaturalist.org/observations/347719180) was corrected to Cannot be determined; it must not be used as an Absent example. All 15 White flowers received Cannot be determined for ring because a distinct outer boundary was not visible. Another uncertain ring belongs to the uncertain-color flower. This does not establish that white flowers biologically lack a ring.

[Observation 214927467](https://www.inaturalist.org/observations/214927467) was scored Low for modest repeated background intensity variation. It is a candidate boundary example for another reviewer, not an independently validated anchor. No clear High example occurred in this selected set. The absence of High here does not establish rarity. Shadows and folds prevented a confident variation score on two observations, and defocus prevented one more.

[Observation 269478378](https://www.inaturalist.org/observations/269478378) has clearly High veins but uncertain petal color: the pale blue-lilac background could not be securely distinguished from cool white with strong magenta veins. [377017094](https://www.inaturalist.org/observations/377017094) illustrates another limitation: its broad White hue is assessable, but defocus prevents the three structural scores despite sufficient nominal pixel dimensions.

This is a single-agent trial. A separate reviewer has not checked agreement. A useful next review set would include the Low variation candidate, Medium/High contrast boundaries, the uncertain color, and an unambiguous High variation flower.

## Selection and evidence

The 25 observations were freshly rescored from the earlier 100-observation pilot: 13 currently identified as O. oregana and 12 as O. smalliana. Selection used the previous crop-size and visibility metadata (at least 300 source pixels and three visible upper petals), then a seeded SHA256 ordering within each taxon. Old trait values were not used for selection or translated into new labels. The seed was `redwood-sorrel-v2-trial25-2026-10-18`.

The selected observations contain 46 photos. Their cached photo previews and unaltered focal crops were reviewed; detailed source views were consulted when needed. Structural judgments used the 300 px focal view. This is a clarity-selected convenience subset, with a final focus check during scoring, not a random sample of all iNaturalist observations or independent validation of the new protocol.

The [25-row audit](data/trial-25-2026-10-18.jsonl) records every observation ID, examined photo IDs, focal crop, per-trait rationale, existing fields, and verified values. It contains no private coordinates. Local working files and the baseline/detail API responses remain under `review-work/redwood-trial-25/` and are excluded from Git.

The first API pass found 13 missing values despite their earlier appearance in the page UI. Those discrepancies were resolved and the final check passed for all 100 values. This is why a batch must be reconciled against saved records before reporting completion. Public field-search indexing can also lag behind observation details.
