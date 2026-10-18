# Additional 100-observation labeling batch

18 October 2026 · protocol 2.1.0

All four Redwood Sorrel fields were added to **100 additional observations**, comprising 53 currently identified as *Oxalis oregana* and 47 as *O. smalliana*. None overlaps the historical 100-observation pilot or its 25-observation new-field trial. The labeled observations contain **209 examined photos**.

A final unauthenticated observation-detail API check completed at **23:13:17 UTC** confirmed all **400 expected field values**, with no conflicting project values, changes to pre-existing fields, unexpected new fields, or changed photo lists. Several initial form submissions did not persist despite appearing in the page; these were reconciled and the complete batch was checked again before finalizing the audit.

## Saved values

- **Petal color:** 63 White, 12 Pink, 20 Purple, 5 Cannot be determined.
- **Petal vein contrast:** 23 Low, 31 Medium, 11 High, 35 Cannot be determined.
- **White center ring:** 2 Absent, 3 Faint, 19 Clear, 76 Cannot be determined.
- **Petal pigment variation:** 47 None, 2 Low, 0 High, 51 Cannot be determined.

There are **233 determinate and 167 explicitly indeterminate values**. Indeterminate entries are included in the 400 saved values. They represent assessed traits that the photographs could not resolve; they are not missing labels. A separate white-ring boundary was usually unresolved on white flowers. Size, focus, illumination, and viewing angle limited structural scores on many other records. No High pigment-variation example was confidently identified in this selected batch.

## Selection and review

Candidates came from the previously retrieved, Flowers-annotated public pools for both taxa. Historical-pilot observations and observations already bearing the new project fields were excluded. The remaining records were ordered within each taxon using SHA256 with seed `redwood-additional100-2026-10-18-v2.1.0`, then interleaved. Public details and photos were refreshed for review.

The first **127 candidates** were reviewed to obtain 100 completed submissions. Twenty-six were skipped for image suitability or unresolved scope/traits. One additional observer restricted field additions to site curators, so that record was left unchanged and replaced. No conflicting existing project values were overwritten. The [machine-readable summary](data/additional-100-2026-10-18-summary.json) includes all 27 skipped/blocked IDs, photo IDs, and reasons.

Reviews used the project owner's Figure 1 assignments and the [current protocol](protocol.md), including Absent/Faint/Clear ring categories. Photos were inspected without color enhancement; focal views, approximate source sizes, per-trait reasons, and examined photo IDs are recorded in the [100-row audit](data/additional-100-2026-10-18.jsonl). Source images and working files remain locally under `review-work/additional-100-2026-10-18/`, excluded from Git. The public audit contains no private coordinates or credentials.

This is a single-agent review of an annotation-selected convenience sample, not an independent agreement study or an estimate of population frequencies. The broader labeling inventory should still include observations without a Flowers annotation.

## Website data

The saved website snapshot was refreshed from iNaturalist and contains **125 observations**: the previous 25 plus this additional 100. All four traits are present on each record, with no conflicting or unsupported values. The local graphs were checked against these totals and all 21 software tests passed. The repository changes still need to be committed and pushed through the existing GitHub Pages workflow to publish the updated starting snapshot; visitors can also use **Refresh from iNaturalist**.
