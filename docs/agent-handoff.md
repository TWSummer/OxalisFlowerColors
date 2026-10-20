# Label Redwood Sorrel flowers

Review photo-bearing iNaturalist observations of **Oxalis oregana** (47757) and **Oxalis smalliana** (1464017), worldwide and all dates/grades, under [protocol 2.1.0](protocol.md). Follow the user’s authorized scope for submissions. The website only reads data; it does not write labels.

## Read before starting

Read the entire [protocol](protocol.md), [field configuration](data/project.json), and [audit schema](data/review.schema.json). Consult the original Figure 1 in Brinegar (2022), p. 308, using **our** assignments below, not its original captions. If the reference plate is unavailable, obtain it before reference-based scoring; the website drawings are conceptual.

Also review the [photographic scoring guide](photo-guide.html), especially its None/Low variation boundary and ring-edge examples. The owner's Low anchors are observations **159722286** and **272127265**. Modest broad paling is enough for Low even when the flower has a single overall hue; exclude identifiable compact rings and narrow veins. The [ring-boundary review](ring-edge-review-report.md) supersedes affected decisions from the [125-observation re-review](guide-review-report.md), which in turn supersedes older trial/batch judgments. Keep this history and read current iNaturalist fields before any write; never restore an older audit's value automatically.

- **23008 — Redwood Sorrel Petal Color:** White / Pink / Purple / Cannot be determined. Pink **A–F**; Purple **G–H**; White **I–P**.
- **23010 — Redwood Sorrel Petal Vein Contrast:** Low / Medium / High / Cannot be determined. High **O,P**; Medium **A,F,H**; Low **B,C,D,E,G,I,J,K,L,M,N**.
- **23011 — Redwood Sorrel White Center Ring:** Absent / Faint / Clear / Cannot be determined. Clear **A,B,G,H**, with obvious edges like owner anchor **77541853**; Absent **D,F** and working photograph **262772803**. White anthers inside the throat are not a petal ring. Faint is a visible weak localized band, like **113980346** and **159722286**, not uncertainty. Broad diffuse paling that cannot be separated from pigment variation is indeterminate, as in **362970560** and **27136204**. Hidden centers and white petals without a separate boundary are also indeterminate. Reinspect old Present values; never auto-convert them to Clear.
- **23012 — Redwood Sorrel Petal Pigment Variation:** None / Low / High / Cannot be determined. None **B,D,G**. Low means subtle repeatable variation; no plate anchor was specified. High means strong, repeatable variation in broad background tissue, in any spatial arrangement outside the throat, ring, and narrow veins. **F is one High example, not a required pattern**; neither a pale middle nor nearly white tissue is necessary.

Use these exact values. No Blue category. Exclude throat, veins, and an identifiable center ring from pigment variation. If including versus excluding a diffuse pale inner zone would change the variation score and it cannot be separated as a ring, mark both traits Cannot be determined. Do not infer traits from geography, taxon name, earlier labels, or the expected distribution. The earlier pilot does not supply labels under this protocol.

The [targeted example search](targeted-examples-report.md) adds working High-variation photograph **25044378 / photo 38753930**. Broad pale middle regions and darker pink bases/tips remain after excluding veins and throat. Its observer only permits site curators to add fields: it is a scored guide reference with `blocked` write status, not a submitted label or atlas record. Respect that restriction and distinguish visual reference scores from verified iNaturalist values.

## Inventory and review

1. From the repository root, run `node scripts/prepare-review.mjs`. It inventories all photo-bearing observations, including records without a Flowers annotation. It makes public, rate-limited, cursor-paginated requests and saves/resumes a bounded inventory under `review-work/protocol-2.1.0/`. Do not overwrite a previous review history. Use a later reconciliation pass for observations added/changed during or after the scan.
2. Inspect **all** photos for each observation. Never score unseen images using IDs, metadata, old field values, or thumbnail impressions. Select fresh open flowers and check consistency across suitable flowers/views.
3. Use the protocol’s three-visible-petal requirement and source-size controls (150 px source flower diameter for color; 300 px for the other traits). Assess veins, ring, and variation in the same **tight 300 × 300 px square crop**, showing the whole focal flower with all tips and only a small margin. The crop width, not the flower diameter, is 300 px. Do not enhance or upscale; smaller color-only evidence stays at native size. Score four traits independently. Log a skip when no open target flower exists. For a visible open flower with an unresolved trait, use `Cannot be determined` for that trait with a specific reason.
4. Keep one JSONL audit row per observation following [the synthetic example](data/review.example.json). List every examined photo, the focal flower, approximate source flower diameter, assessment crop width, values, reasons, confidence, and status. The legacy `assessment_diameter_px` property stores crop width (normally 300), not the flower's measured displayed diameter. Save decisions before writing. No accounts, tokens, private coordinates, or EXIF in the public audit.
5. Independently double-scoring a varied subset is recommended, particularly Medium/Low vein contrast, Low pigment variation, and Absent/Faint/Clear ring boundaries. Record disagreements rather than claiming the previous pilot validated this key. A second reviewer must actually inspect images to count as independent review.

## Submit and verify

Read the current observation and its field values immediately before every submission. Check that it remains in scope. Use field IDs to avoid similarly named fields. Do not make more fields, duplicate an agreeing entry, or overwrite someone else’s conflicting entry. Record same-field conflicts for adjudication. Preserve all other fields, including old 8625/43/23007 values.

Submit only a high-confidence determinate score or a documented `Cannot be determined` outcome. An ordinary category with medium/low confidence should remain a draft for review. A field with no open flower / out-of-scope / not-assessed status has no submitted value.

**Save one field at a time, through confirmation.** iNaturalist displays the chosen value and resets the form **before the server finishes saving**. Our earlier helper mistook that temporary display for success. Awaiting a click or seeing the value is insufficient. Read the [save investigation and recovery procedure](save-verification.md) before submitting a batch.

1. Save the intended decision locally; mark the write `attempted`. Click Add/Save **once** for one field. Do not submit another field, reload, close the tab, or navigate away while it is pending. Do not run concurrent writers in the same browser session.
2. Stay on the observation. Wait for the exact field row to contain the expected value **and have no saving indicator**, with no save error. In the inspected iNaturalist UI, each row is `.ObservationFieldValue` and its pending indicator is `.loading_spinner`; scope the check to the exact field name and value. A missing row does not pass. Inspect the current DOM before relying on these selectors. The input clearing, the Add button returning, a fixed sleep, and `networkidle` alone are not completion checks.
3. Before submitting the next field, independently read `https://api.inaturalist.org/v1/observations/OBSERVATION_ID?ttl=-1` using a permitted read-only tool, without navigating the editing tab. Require the expected observation ID and an `ofvs` entry with the exact `field_id` and `value`. Check for conflicting values too. The `ttl=-1` parameter follows iNaturalist's own post-save detail fetch. Use a fresh response, not a cached local object or field-search results. If the saving indicator cannot be inspected, a matching fresh detail response is required before proceeding. If it remains visible even after API confirmation, stop writing in that tab and reconcile it; do not queue another save.
4. Record `verified_fields[].verified_at` only when that detail response confirms the value. Pace public API reads at least 1.1 seconds apart. If a request is slow or a value is not yet returned, keep the page open and retry **reads**, for example after 2, 5, 10, then 20 seconds, with a 60-second initial wait budget. These are polling intervals, not permission to proceed after a delay. Honor `Retry-After` and back off on 429/5xx responses. A timeout or failed read means unverified, not an absent value and not permission to click Add again.
5. Before leaving the observation, obtain one final fresh detail response and reconcile **all intended fields**, including values confirmed earlier or already present. Confirm that no field save is still pending. Mark the observation `verified` only when all intended submissions are confirmed. Keep partial results and pending/blocked/conflicting outcomes distinct.

**Recovery:** do not use immediate reload as a save check. If a save errors or stays unresolved, preserve the attempt and check fresh detail responses first. If the value is present, do not resubmit it. If a different value is present, stop for adjudication. Retry a missing value only after the earlier request has conclusively finished/failed, a fresh detail read still shows it missing, and a settled page has been reread for restrictions and conflicts. Make at most one automatic retry of that field, using the same completion checks; leave repeated or unresolved failures pending for later reconciliation. A timed-out read, vanished spinner, or missing API value alone cannot establish that an earlier request was cancelled. Pause further submissions if completion cannot be established; do not navigate away to clear a pending save.

Before reporting a batch complete, reconcile every intended ID/value against fresh public observation-detail responses again. The first 25-observation trial found 13 missing values despite their earlier appearance in the page UI. Resolve discrepancies using the recovery procedure, then verify again. Field-search results can lag and are not the sole verification source. Respect restrictions on adding others’ fields and continue after recording a confirmed blocked case. Do not modify identifications, comments, licenses, locations, or unrelated data.

Validate audit rows with:

```sh
node scripts/validate-reviews.mjs review-work/protocol-2.1.0/reviews.jsonl
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
