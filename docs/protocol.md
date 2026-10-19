# Redwood Sorrel flower-trait protocol

Protocol 2.1.0 · 18 October 2026 · applies to **Oxalis oregana** (47757) and **Oxalis smalliana** (1464017), including their iNaturalist descendants. Use all observation dates, grades, and locations. Record cultivated status rather than silently discarding cultivated plants.

These are **our project categories**, following the project owner’s interpretation of Figure 1 in [Brinegar (2022), p. 308](https://doi.org/10.3120/0024-9637-69.4.304). They intentionally differ from the paper. Do not use the paper’s original color captions, geographic pattern, species identification, or old community fields to override this key. The website drawings are conceptual aids, not measured colors or substitute reference photographs.

Use the [photographic scoring guide](photo-guide.html) alongside these rules. It shows close-ups spanning the reviewed categories, with explanations and image-level credits. The 18 October 2026 review added the owner's two Low-variation anchors; the subsequent [ring-boundary review](ring-edge-review-report.md) tightened Clear to require obvious edges and corrected ambiguous ring/variation assignments. Field IDs and allowed values remain unchanged. The [125-observation re-review](guide-review-report.md) and later ring review preserve the decision history. These examples are a working calibration set, not independent validation.

## Fields and exact values

All four are new text fields, used independently. Submit the spelling and capitalization below.

- [Redwood Sorrel Petal Color — 23008](https://www.inaturalist.org/observation_fields/23008): `White`, `Pink`, `Purple`, `Cannot be determined`.
- [Redwood Sorrel Petal Vein Contrast — 23010](https://www.inaturalist.org/observation_fields/23010): `Low`, `Medium`, `High`, `Cannot be determined`.
- [Redwood Sorrel White Center Ring — 23011](https://www.inaturalist.org/observation_fields/23011): `Absent`, `Faint`, `Clear`, `Cannot be determined`.
- [Redwood Sorrel Petal Pigment Variation — 23012](https://www.inaturalist.org/observation_fields/23012): `None`, `Low`, `High`, `Cannot be determined`.

The names have no version suffix. The audit records the protocol version separately. Verify IDs, names, and allowed values against [project.json](data/project.json) before writing. Do not repurpose Primary flower color (8625), Flower Color (43), or Oxalis petal vein contrast v1 (23007). Their values are not inputs to the new atlas.

## Before scoring

1. Open the observation and inspect every photo of the target plant, at original available resolution. Identify fresh, open flowers and their upper petal surfaces. Do not score a closed bud, petal underside, wilted flower, detached flower of uncertain identity, or a different plant in the same photo.
2. Record all examined photo IDs. Choose a focal flower and identify it in the audit. Examine other suitable flowers/views to check consistency; never select a convenient flower to hide contradictory evidence.
3. Require at least three clearly visible upper petals for a determinate score. As project quality controls, require a flower at least 150 source pixels across for color, and at least 300 source pixels for veins, ring, and variation. Assess these three structural traits at a displayed flower diameter of 300 px. These are workflow limits, not biological thresholds or rules from the paper. An original-resolution view can check an apparent feature, but must not create a higher contrast score just by magnifying it further.
4. Use unaltered images. Do not sharpen, recolor, auto-white-balance, or upscale to meet the size rule. Prefer diffuse, even illumination. Exposure, shadows, reflections, petal folds, and camera cast can imitate traits. If good views cannot resolve them, use `Cannot be determined` for that trait.
5. Score each trait independently. High vein contrast can coexist with White petals and None pigment variation. A visible ring can coexist with None variation. Vein color and branching are not fields in this protocol.

## Petal color

Judge the broad **interveinal background on the upper petals**, excluding the yellow/orange throat, anthers, vein lines, and any distinct white center ring. If the background varies, consider the broad colored regions together; do not let a nearly white middle erase clearly pink bases and margins, as in F. Color means hue class, not how dark the flower is.

- **Pink:** Figure 1 **A, B, C, D, E, F**. Includes rose pink and the pale pink/lilac-looking E and F. This project intentionally places E and F in Pink.
- **Purple:** Figure 1 **G, H**. Clearly violet interveinal background matching those examples. A dark vein on otherwise white or pink tissue is not enough.
- **White:** Figure 1 **I, J, K, L, M, N, O, P**. Includes neutral, ivory, and the near-white cool-looking examples I–L. Purple/pink veins may be prominent. There is **no Blue option** and no need to reproduce the paper’s white/blue boundary.
- **Cannot be determined:** the image cannot resolve Pink versus Purple or pigment versus lighting; the view/resolution is inadequate; a clearly different hue does not fit the key; or suitable flowers/photos conflict.

Do not create numerical RGB cutoffs from this printed plate. A slight photographic cool cast is not a new category. If a large genuinely colored region cannot be assigned confidently, record the uncertainty rather than forcing White.

## Petal vein contrast

Judge **the visual prominence of narrow vein lines relative to the immediately adjacent petal tissue**, not the absolute vein hue, vein count, or branching shape. Use the standard 300 px flower view and compare multiple petals.

- **Low:** faint/subtle lines or no visible lines in an otherwise adequate view. Figure 1 **B, C, D, E, G, I, J, K, L, M, N**. Low does not assert that veins are anatomically absent.
- **Medium:** vein lines are readily visible but remain secondary to the background. Figure 1 **A, F, H**.
- **High:** a strong, contrasting vein network is a dominant feature across the visible petals. Figure 1 **O, P**.
- **Cannot be determined:** insufficient detail or illumination, fewer than three suitable petals, a persistent boundary between adjacent categories, or conflicting suitable views/flowers.

The plate assignments are the reference key. The old two-line/half-petal rule and binary conspicuous/faint field are superseded. Do not map old `conspicuous` values automatically to High: some may belong to Medium or Low under this key.

## White center ring

Look for a **white or paler band immediately outside the yellow/orange throat and inside the colored outer petal**. Across the flower, the band should form a ring-like zone. Individual veins may interrupt it; it need not be a perfectly continuous geometric circle. This field scores how distinct the band looks in an adequate photograph, not pigment chemistry.

First check whether the bases and the entire throat-to-petal transition can be inspected on at least three petals. A cupped or oblique flower can hide a ring inside the flower even when the outer petals are clear. If that transition cannot be assessed, use Cannot be determined before considering the three appearance categories.

- **Absent:** in an adequate view of at least three petal bases, the colored background continues to the yellow/orange throat without an intervening pale or white band. Figure 1 **D, F**. A pale middle farther along the petal, as in F, is not this center ring. Not seeing a ring because it is hidden is not evidence of absence.
- **Faint:** a weak, **localized** pale band can actually be seen encircling the throat across at least three petals, but blends softly into the outer tissue. It may retain a slight pink/lilac tint. Its placement immediately outside the throat must be recognizable and repeat across petals, rather than being an unresolved broad gradient or glare/shadow. **Faint is a visible feature, not a confidence label.** The owner's Faint examples are [113980346](https://www.inaturalist.org/observations/113980346) and [159722286](https://www.inaturalist.org/observations/159722286); both were previously scored Absent in error. No Figure 1 panel has been designated a Faint anchor.
- **Clear:** the white band's edges are **obvious**, including its outer boundary against colored tissue on at least three petals at the standard 300 px view. You should be able to locate and trace that outer edge, not merely notice that the center is paler. Figure 1 **A, B, G, H**; [77541853](https://www.inaturalist.org/observations/77541853) is the owner's photographic Clear anchor. Veins may cross the band and its outline need not be circular. Width alone does not decide Faint versus Clear: a narrow, clearly bounded white band can be Clear.
- **Cannot be determined:** the center is hidden, angled away, blurred, shadowed, or overexposed; a possible ring cannot be distinguished from lighting; broad inner paling cannot be separated into a localized band versus petal pigment variation; the Absent/Faint/Clear boundary remains unresolved; suitable views disagree; or an all-white flower has no distinguishable outer boundary for a separate ring. An all-white flower is not automatically Absent, Faint, or Clear.

**Diffuse paling is not automatically Faint.** In [362970560](https://www.inaturalist.org/observations/362970560) and [27136204](https://www.inaturalist.org/observations/27136204), the pale inner region has poorly defined edges and cannot confidently be separated from broad pigment variation. Both traits are Cannot be determined here. Do not exclude that entire pale zone as a ring and then call the remaining tissue uniform. The [guide](photo-guide.html#ring) compares these unresolved cases with the owner's Clear and Faint examples. No confirmed Absent photograph remains among the 125 reviewed observations after this correction; Figure 1 D/F remain the reference for absence.

[Observation 294114815](https://www.inaturalist.org/observations/294114815) is a working **Faint** example: subtle basal paling blends into the pale pink petals. The project owner placed it near the Faint/Absent boundary; this is not an independently validated anchor. [Observation 347719180](https://www.inaturalist.org/observations/347719180) is **Cannot be determined**: its cupped, oblique center could conceal a pale circle. Do not use it as an Absent example.

Protocol 2.1.0 replaces the old `Present` option with `Faint` and `Clear`; the field ID stays 23011. Reinspect older Present values rather than automatically converting them to Clear. The atlas treats a remaining Present value as unsupported, not as a new category. The [2.0.0 protocol](protocol-v2.0.0.md) and initial trial audit remain historical records.

## Petal pigment variation

This is a **photographic score of broad pigment-intensity variation within the petal background**, not a chemical measurement. Compare the base, middle, and margins of the same petal, then check that the pattern repeats on at least three suitable petals. Exclude the yellow/orange throat, narrow vein lines, **the distinct white center ring**, shadows, glare, folds, damage, and aging.

- **None:** nearly uniform interveinal background after those exclusions. Small ordinary photographic fluctuations do not establish variation. Figure 1 **B, D, G**. A uniformly pale flower and a uniformly dark flower can both score None. Ring presence alone does not move B or G out of None. Do not use None simply because the flower has one overall hue: repeated broad paling within that hue can qualify as Low.
- **Low:** a subtle, repeatable gradient or modest light/dark difference across the background, without strongly separated pale and dark regions. The difference must survive comparison across petals/views and not track shadow or a fold. **Observations [159722286](https://www.inaturalist.org/observations/159722286) and [272127265](https://www.inaturalist.org/observations/272127265) are owner-specified Low anchors.** Their modest broad paling outside the throat and narrow vein lines is sufficient; an F-like near-white middle is not required. No Figure 1 panel has been designated a Low anchor.
- **High:** clearly distinct pale and dark background regions, as in **F**: pink toward the center, nearly white in the petal middle, and deeper pink near the margins. This is broad tissue variation, not merely dark vein lines or a center ring.
- **Cannot be determined:** the image cannot separate pigment variation from illumination, fails the visibility/detail rules, lies unresolved between None/Low or Low/High, cannot separate a possible center ring from broad pigment variation when that exclusion would change the score, or suitable views/flowers conflict.

A white flower can score None if adequately shown; do not invent variation from its veins or yellow throat. Variation among different flowers is not this trait. If their within-petal scores disagree, record Cannot be determined for the observation and explain the disagreement.

Compare [None and Low close-ups](photo-guide.html#variation) before scoring. Exclude a compact basal band only when it can actually be identified as a ring. A pale region extending farther into the petal background can contribute to variation. If the two cannot be separated and including versus excluding that region would affect the score, use Cannot be determined for variation as well as ring. Ring uncertainty alone does not force variation uncertainty: a hidden center may still leave enough outer tissue to judge variation independently. Do not raise Low to High for dark narrow veins, stronger saturation of the whole flower, or a sharply contrasting white center ring alone.

## Uncertainty, skips, and disagreement

`Cannot be determined` is an actual allowed field value for a **visible open flower that has been assessed**. Use it separately for each unresolved trait, with a specific reason and photo evidence in the audit. It is not the same as a missing field and is never counted as White, Low, None, or Absent.

If there is no open target flower, the subject is outside the two taxa, or the trait has not been assessed, leave that field unwritten and record `no_open_flower`, `out_of_scope`, or `not_assessed` locally. Do not fill nonflowering observations with four indeterminate values. If open flowers are visible but their upper surfaces cannot be seen, an assessed trait may be Cannot be determined.

For multiple usable photos of the same flower, resolve a poor view using a better view when possible. If good views still disagree, use Cannot be determined. For multiple suitable flowers with genuinely different trait values, do not majority-vote or submit several conflicting values; use Cannot be determined and log the evidence. Other consistent traits can still be scored.

Do not use an existing field value as visual evidence. Read existing values immediately before submission. An agreeing current value requires no duplicate write. A differing value in the **same new field** needs adjudication: record the conflict and do not overwrite another person’s entry. Unrelated/old fields do not block a new-field review and must be preserved.

## Audit and verification

Use [review.schema.json](data/review.schema.json) and the explicitly [synthetic example](data/review.example.json). Save one review per observation, including reviewer, time, protocol, examined photos, per-trait value/status/confidence/reason/evidence, pre-existing fields, write status, and verified returned values. Status `scored` means a determinate category; `cannot_be_determined` requires that exact field value. Other statuses have null values. A high-confidence scored judgment or a documented indeterminate outcome can be submitted. A tentative category should be reviewed before submission.

After each write, re-read the observation and verify the exact field ID and value. Distinguish a draft, attempted write, blocked write, already-present value, and verified write. API indexing may lag, so the observation detail/page is the immediate verification source. Do not claim a write succeeded from a button click alone. Respect observer restrictions; log them and continue. Do not change identifications, comments, locations, licenses, or other fields as part of this work.

## Reliability and interpretation

The earlier 100-observation pilot used different categories. Its [historical report](calibration.html) and [old protocol](protocol-v1.1.0.md) remain available, but do not validate these new fields. Fresh image review is required; do not translate its labels automatically.

Before scaling, it is useful to independently double-score a varied subset covering all categories, especially Medium contrast, Low variation, Absent/Faint/Clear ring boundaries, and white flowers without a ring boundary. Compare per-trait disagreements and indeterminate rates. Record agreed boundary examples with photo IDs and permissions. This is a recommendation for checking repeatability, not a claim that such validation has already happened or an additional authorization requirement.

Maps use only public coordinates and determinate values from the four new fields. Charts use all fetched records matching species/grade/date/establishment filters, including those without usable map coordinates. Percentages divide by **assessable labels for that trait**; indeterminate, missing, conflicting, and unsupported values are reported separately. A missing count covers only the union of records fetched through the new fields, not every unreviewed observation on iNaturalist. Records are deduplicated by observation ID, not by individual plant.

These are convenience-sampled observations, not population frequencies. Repeated visits, clones, geographic coverage, image quality, cultivation, and color-influenced identifications can all bias counts. Do not infer a species boundary or evolutionary mechanism from these maps alone.
