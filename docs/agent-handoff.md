# Label Redwood Sorrel flowers

Review photo-bearing iNaturalist observations of **Oxalis oregana** (47757) and **Oxalis smalliana** (1464017), worldwide and all dates/grades, under [protocol 2.0.0](protocol.md). Follow the user’s authorized scope for submissions. The website only reads data; it does not write labels.

## Read before starting

Read the entire [protocol](protocol.md), [field configuration](data/project.json), and [audit schema](data/review.schema.json). Consult the original Figure 1 in Brinegar (2022), p. 308, using **our** assignments below, not its original captions. If the reference plate is unavailable, obtain it before reference-based scoring; the website drawings are conceptual.

- **23008 — Redwood Sorrel Petal Color:** White / Pink / Purple / Cannot be determined. Pink **A–F**; Purple **G–H**; White **I–P**.
- **23010 — Redwood Sorrel Petal Vein Contrast:** Low / Medium / High / Cannot be determined. High **O,P**; Medium **A,F,H**; Low **B,C,D,E,G,I,J,K,L,M,N**.
- **23011 — Redwood Sorrel White Center Ring:** Present / Absent / Cannot be determined. Present **A,B,G,H**; Absent **D,F**. White flowers without a distinguishable ring boundary are indeterminate.
- **23012 — Redwood Sorrel Petal Pigment Variation:** None / Low / High / Cannot be determined. None **B,D,G**; High **F**. Low means subtle repeatable variation; no plate anchor was specified.

Use these exact values. No Blue category. Exclude throat, veins, and the distinct white center ring from pigment variation. Do not infer traits from geography, taxon name, earlier labels, or the expected distribution. The earlier pilot does not supply labels under this protocol.

## Inventory and review

1. From the repository root, run `node scripts/prepare-review.mjs`. It inventories all photo-bearing observations, including records without a Flowers annotation. It makes public, rate-limited, cursor-paginated requests and saves/resumes a bounded inventory under `review-work/protocol-2.0.0/`. Do not overwrite a previous review history. Use a later reconciliation pass for observations added/changed during or after the scan.
2. Inspect **all** photos for each observation. Never score unseen images using IDs, metadata, old field values, or thumbnail impressions. Select fresh open flowers and check consistency across suitable flowers/views.
3. Use the protocol’s three-visible-petal requirement and source-size controls (150 px flower diameter for color; 300 px source and displayed diameter for the other traits). Do not enhance or upscale. Score four traits independently. Log a skip when no open target flower exists. For a visible open flower with an unresolved trait, use `Cannot be determined` for that trait with a specific reason.
4. Keep one JSONL audit row per observation following [the synthetic example](data/review.example.json). List every examined photo, the focal flower, approximate measured sizes, values, reasons, confidence, and status. Save decisions before writing. No accounts, tokens, private coordinates, or EXIF in the public audit.
5. Independently double-scoring a varied subset is recommended, particularly the new Medium/Low boundaries. Record disagreements rather than claiming the previous pilot validated this key. A second reviewer must actually inspect images to count as independent review.

## Submit and verify

Read the current observation and its field values immediately before every submission. Check that it remains in scope. Use field IDs to avoid similarly named fields. Do not make more fields, duplicate an agreeing entry, or overwrite someone else’s conflicting entry. Record same-field conflicts for adjudication. Preserve all other fields, including old 8625/43/23007 values.

Submit only a high-confidence determinate score or a documented `Cannot be determined` outcome. An ordinary category with medium/low confidence should remain a draft for review. A field with no open flower / out-of-scope / not-assessed status has no submitted value.

After writing, re-read the observation detail or page to verify each exact ID/value and record a verification timestamp. Never mark a write verified merely because Save was clicked. Respect restrictions on adding others’ fields and continue after recording a blocked case. Do not modify identifications, comments, licenses, locations, or unrelated data.

Validate audit rows with:

```sh
node scripts/validate-reviews.mjs review-work/protocol-2.0.0/reviews.jsonl
```

Report reviewed observations, per-trait determinate and indeterminate counts, skips and reasons, conflicts, blocked records, verified fields, and pending writes separately. Do not equate inventory size with inspected photos or successful labels.

## Update the atlas

After labeling, run:

```sh
node scripts/sync-data.mjs
node --test
```

Commit/push the resulting `docs/data/observations.json` with the user’s usual deployment workflow. API field searches can lag behind fresh writes; retry later if needed. Visitors can use **Refresh from iNaturalist** for a temporary browser refresh. It does not change the repository snapshot.

The historical `calibration-*` scripts and files document the earlier protocol; do not use them to generate or automatically convert new-field reviews.
