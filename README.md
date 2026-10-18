# Oxalis Flower Atlas

A static GitHub Pages website and labeling protocol for **Oxalis oregana** and **Oxalis smalliana**. No build, backend, API key, or login is needed for the website. Local utilities use Node 20+ and have no npm dependencies.

## Current project key

Protocol **2.0.0** uses the project owner’s categories, intentionally different from the paper’s original groups:

- **Redwood Sorrel Petal Color (23008):** White / Pink / Purple / Cannot be determined. Figure 1: Pink A–F, Purple G–H, White I–P.
- **Redwood Sorrel Petal Vein Contrast (23010):** Low / Medium / High / Cannot be determined. High O,P; Medium A,F,H; all other panels Low.
- **Redwood Sorrel White Center Ring (23011):** Present / Absent / Cannot be determined. Present A,B,G,H; Absent D,F.
- **Redwood Sorrel Petal Pigment Variation (23012):** None / Low / High / Cannot be determined. None B,D,G; High F; Low is the written intermediate category, with no assigned plate anchor.

The site includes four visual-guide tabs, a map for each trait, three comparable color maps, four count/percentage charts, public observation links, filters, and CSV exports. Ring presence is excluded from pigment variation. See [the protocol](docs/protocol.md) for all rules and uncertainty cases.

The fields were created on 18 October 2026. Their first public API snapshot contains **zero observations**. Empty maps/charts are expected until fresh labels are submitted. No synthetic observations are included. Old fields 8625, 43, and 23007 are not queried, converted, or used as fallback. Existing iNaturalist labels have not been rewritten by this pivot.

## Preview and deploy

```sh
node scripts/serve.mjs
```

Open `http://127.0.0.1:4173` (or the port printed by the server). Use HTTP rather than opening HTML directly. Leaflet is bundled; fonts, photos, map tiles, and live API refresh need network access.

In GitHub **Settings → Pages → Build and deployment**, use **Deploy from a branch**, your publishing branch (usually `main`), and **`/docs`**. Commit and push changes to publish them. `docs/.nojekyll` keeps the site buildless; relative asset URLs support project Pages paths. Do not commit `tmp/` or `review-work/`.

## Labeling handoff

Give the reviewing agent [docs/agent-handoff.md](docs/agent-handoff.md), [docs/protocol.md](docs/protocol.md), and [docs/data/project.json](docs/data/project.json). Use the new field IDs and fresh visual review. Existing pilot labels cannot be automatically translated. Independent double-scoring of a varied subset is recommended to check repeatability, particularly Medium contrast and Low variation.

```sh
node scripts/prepare-review.mjs
node scripts/validate-reviews.mjs review-work/protocol-2.0.0/reviews.jsonl
```

The inventory includes all photo-bearing observations of both taxa, all grades, worldwide; it does not depend on flowering annotations. It checkpoints under a protocol-specific directory and resumes safely after interruption. A completed pass produces `candidates.jsonl` and a cutoff ID. Preserve previous audits and start a separate pass for later records or changed photos/identifications. There is no label-prediction or iNaturalist write automation in this repository.

`Cannot be determined` is a recorded, assessed outcome for a visible open flower. It is distinct from no flower, an unassessed trait, and a missing field. Log evidence and reasons, preserve existing data, and verify actual returned field values after writing.

## Data flow and graphs

The website first loads `docs/data/observations.json`, a dated snapshot fetched from iNaturalist. **Refresh from iNaturalist** queries all four new fields, paginates by observation ID, deduplicates observations, and updates only that visitor’s browser. It does not save to GitHub. No recurring sync is installed.

To publish an updated starting snapshot:

```sh
node scripts/sync-data.mjs
node --test
```

Commit/push the changed snapshot. Sync uses unauthenticated public API reads at about one request per second. It preserves the previous file on errors or incomplete pagination. Field-search indexing can lag behind new writes.

Maps include determinate categories and usable public coordinates, hiding obscured locations by default. Charts use the same species/date/grade/establishment filters but also include records without map coordinates. Each percentage’s denominator is the number of assessable labels for that particular trait. Indeterminate, missing, conflicting, and unsupported values are reported separately. Missing means absent among the union of fetched new-field records, not every unlabeled record on iNaturalist. The chart CSV includes uncertainty states; obscured coordinates remain omitted unless the location option is enabled.

## Historical pilot

The earlier 100-observation / 174-photo feasibility review used the previous fields and categories. After seven verified color withdrawals, it retained 80 field values on 58 observations. [The historical report](docs/calibration.html), original v1.0.0 audit, revised v1.1.0 audit, and [old protocol](docs/protocol-v1.1.0.md) remain available. They are not training labels or reliability validation for the new key.

`docs/data/archive/` stores the old project configuration and observation snapshot. Historical `calibration-*` utilities continue to use their historical fields; the verification utility reconciles only the archived snapshot. `historical-review-validation.mjs` validates the old audit shape. These files must not populate the current atlas or silently upgrade decisions.

## Checks and limitations

```sh
node --test
node scripts/validate-reviews.mjs docs/data/review.example.json
```

Tests cover field isolation, conflicts, explicit uncertainty, chart denominators, public coordinate handling, filtering, CSV safety, cursor pagination beyond 10,000 records, retries, audit validation, and relative site assets. The synthetic audit example is never used as map data. Software checks do not establish biological accuracy or agreement between reviewers.

Observations are not independent plants or population frequencies. Camera color, uneven sampling, repeated visits, clones, cultivation, and color-influenced species identifications affect interpretation. The website never uses private coordinates or iNaturalist credentials.

The paper is cited, not redistributed. Schematics are original project drawings. Historical pilot photographs retain their individual attribution and licenses, including noncommercial restrictions. See [credits](docs/credits.html).

Source: [Brinegar (2022), Madroño 69(4):304–326](https://doi.org/10.3120/0024-9637-69.4.304). Current scoring rules are defined by this project, not asserted to reproduce that study.
