# Oxalis Flower Atlas

A static GitHub Pages website and a reproducible labeling protocol for **Oxalis oregana** and **Oxalis smalliana**. No build, backend, API key, or account login is needed for the website. Node 20+ is needed only for the local utilities/tests.

## What is included

- Four-color visual guide (white, blue, purple, pink), original botanical schematics, and attributed photo examples.
- Full interactive map, four comparable color maps, optional vein-contrast map, observation links, filters, and CSV export.
- A real, dated snapshot of existing public iNaturalist field values, plus a user-triggered live refresh. No synthetic mapped observations.
- Agent/human instructions, a conservative optional vein-contrast pilot, a machine-readable audit schema, and a validator.
- Public-data sync and a resumable inventory tool for the separate labeling agent. No iNaturalist write automation.

The site reads **Primary flower color (8625)** by default; the older **Flower Color (43)** is optional. **Oxalis petal vein contrast v1 (23007)** is active as a pilot field. The October 2026 feasibility review inspected 100 observations / 174 photos and added 87 field values across 63 observations with the owner's explicit authorization. See [the pilot report](docs/calibration.html) and its downloadable audit. This was one agent's review, not independent-rater validation. Existing community labels are not assumed to follow this protocol.

## Preview

```sh
npm start
```

Open `http://127.0.0.1:4173`. Serve the files over HTTP; do not double-click the HTML, because module and JSON loading needs a web server. There are no npm dependencies to install. Fonts, iNaturalist photos, live API refresh, and OSM tiles use the network; Leaflet itself is bundled. The dated snapshot and guide work without API access.

## Deploy on GitHub Pages

1. Create a GitHub repository and upload this project's source. Do not upload `tmp/` or `review-work/`.
2. Open the repository's **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select your branch (usually `main`), and select the **`/docs`** folder. Save.
4. Wait for GitHub Pages to publish. Open the URL shown in Settings.

All site asset URLs are relative, so both `username.github.io/` and `username.github.io/repository-name/` work. `docs/.nojekyll` keeps the site buildless. No Sites-hosting account or separate service is required. Push changes to the configured Pages branch to publish them.

For the platform's current setup details, see [GitHub's Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

## Hand off the labeling work

Give the reviewing agent **`docs/agent-handoff.md`**, **`docs/protocol.md`**, and **`docs/data/project.json`**. Its first job is a calibration pilot with independent review, followed by authorized production writes using an appropriate iNaturalist account. The site itself cannot change observations.

```sh
npm run prepare-review
npm run validate-reviews -- review-work/reviews.jsonl
```

`prepare-review` inventories all photo-bearing records of both taxa, all grades, worldwide. It does not rely on flowering annotations, download bulk images, or assign traits. Allow roughly one request per second; runtime depends on the number of records. It checkpoints batches in `review-work/` and resumes after interruption. The complete pass produces `review-work/candidates.jsonl` and a cutoff ID. To start a new pass after completing one, archive the old `review-work/` directory and run again. Preserve old reviews when reconciling new/changed records. The ID cutoff is not a historical database transaction: changes while scanning can require a later reconciliation pass.

The protocol deliberately abstains for ambiguous colors, unsuitable views, or conflicting flowers. Coverage must be reported as reviewed/labeled/skipped/blocked, not silently equated with successful labeling.

## Update the maps

Click **Refresh from iNaturalist** to read current values into your browser. This does not save changes to the repository or persist a visitor cache.

To update the publicly served snapshot after labels have been added:

```sh
npm run sync
npm test
```

Commit and push `docs/data/observations.json`. The sync uses public unauthenticated reads, full cursor pagination, deduplication, and rate limiting. It retains the previous file on any error or paging limit. API indexing can lag behind a new field write. No scheduled job is installed.

The vein field is configured as **23007**. Its pilot labels are available on the map, but independent agreement and class-coverage gates remain unmet. Keep the configuration, human protocol, and audit schema consistent when versioning the protocol. No credentials belong in configuration or GitHub Pages.

The October pilot files are in ignored `review-work/calibration-2026-10/`. `calibration-sample.mjs` records a deterministic, taxon-stratified sample from observations with a Flowers annotation; it is narrower than the production inventory. `calibration-images.py` prepares unenhanced previews for manual review. `calibration-record.mjs` records manual decisions; `calibration-audit.mjs` validates them. `calibration-verify.mjs` checks all 100 records through the public observation-detail API and reconciles their atlas records; `calibration-report.mjs` exports the verified public audit without coordinates or downloaded photos. These utilities do not predict or submit labels. Do not rerun sampling over an active review directory.

## Tests and limitations

```sh
npm test
npm run validate-reviews -- docs/data/review.example.json
```

Tests cover field conflicts, invalid values, public coordinate handling, privacy filters, CSV safety, pagination above 10,000 observations, retries, audit constraints, and the local static assets. Tests do not validate flower biology. The example review is synthetic, with dummy IDs, and is never included in map data.

Points are observations, not independent plants or population frequencies. Cultivation, uneven sampling, repeated visits/clones, color-dependent species identifications, and camera color affect interpretation. Obscured public coordinates are hidden by default; a visitor can include them with clear marking. The site never uses private coordinates. See the protocol for details.

Photo licenses remain with their creators. Some teaching photos and all pilot examples are CC BY-NC: retain attribution and noncommercial use, or remove/replace them for a commercial adaptation. See the individual captions, `docs/credits.html`, and `docs/vendor/LEAFLET-LICENSE.txt`. The attached paper is cited but not distributed.

## Project layout

- `docs/index.html`, `docs/styles.css`, `docs/js/`: deployable site.
- `docs/data/project.json`: taxon IDs, field IDs/names, protocol version.
- `docs/data/observations.json`: dated public field-value snapshot.
- `docs/protocol.md`, `docs/agent-handoff.md`: labeling instructions.
- `docs/data/review.schema.json`, `docs/data/review.example.json`: audit format.
- `scripts/`: local preview, read-only data tools, audit validation.
- `test/`: meaningful data and integration checks.

Source paper: [Brinegar (2022), Madroño 69(4):304–326](https://doi.org/10.3120/0024-9637-69.4.304). Field/API guidance: [iNaturalist observation fields](https://help.inaturalist.org/en/support/solutions/articles/151000178357-how-to-use-observation-fields) and [API recommended practices](https://www.inaturalist.org/pages/api+recommended+practices).
