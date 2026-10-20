# iNaturalist field-save investigation

19 October 2026. This clarifies submission mechanics; protocol 2.1.0 categories and field IDs are unchanged. The operational checklist and recovery rules are in [Submit and verify](agent-handoff.md#submit-and-verify).

## Finding

The confirmed defect in our earlier helper was **premature confirmation**: it waited for the field label to appear, read the displayed name/value, and immediately recorded the write as verified. That display can exist while the save is still pending. The next field submission, reload, or navigation could therefore start before completion.

This verifies the unsafe timing in our workflow, but does **not** establish whether each historical missing value resulted from a request interrupted by departure, a server rejection, or another network failure. The retained records do not include the corresponding request outcomes. There is no evidence here that iNaturalist rejects saves solely because they occur less than a particular number of seconds apart. Adding an arbitrary delay would not fix the false confirmation reliably.

## Evidence from our labeling

The [25-observation report](trial-25-report.md#selection-and-evidence) records **13 values missing from the first detail-API check**, despite their earlier appearance in the page. Those discrepancies were repaired and all 100 values passed the final check. The additional batch also required reconciliation, as recorded in its [report](additional-100-report.md).

The retained submission helper awaited the Add click, waited for the exact field-name text to be visible, then compared DOM field names/values. It did not check the row's saving indicator or await the write request. Calling that helper with `await` in a loop therefore serialized clicks and text checks, not completed saves. Some callers reloaded or opened the next observation immediately afterward.

The missing values were not limited to the last field submitted. For example, the first check for observation 343717584 lacked color, ring, and variation while its vein value was present. That pattern cannot isolate departure after the final click as the sole cause. Initial UI-based timestamps from that run are evidence of what the helper checked, not trustworthy server-confirmation timestamps.

## Evidence from iNaturalist's implementation

Inspected public source: `inaturalist/inaturalist` revision `0e15a4a4bd64b914672be1e4e6492c272a79fa9a`. This is a pinned source inspection, not a verification that the deployed website runs that exact revision.

- Adding and editing a field immediately put the requested value into the page's state with `api_status: "saving"`, **before** the API request completes. [Add/update actions](https://github.com/inaturalist/inaturalist/blob/0e15a4a4bd64b914672be1e4e6492c272a79fa9a/app/webpack/observations/shared/ducks/observation.js#L214-L299).
- The field row renders that pending status as `.loading_spinner` alongside the value. Both are inside `.ObservationFieldValue`. [Field-row component](https://github.com/inaturalist/inaturalist/blob/0e15a4a4bd64b914672be1e4e6492c272a79fa9a/app/webpack/observations/show/components/observation_field_value.jsx).
- The input resets immediately after dispatching the submission. An empty input or restored Add form therefore does not mean the save succeeded. [Submission handler](https://github.com/inaturalist/inaturalist/blob/0e15a4a4bd64b914672be1e4e6492c272a79fa9a/app/webpack/observations/show/components/observation_field_input.jsx#L93-L116).
- The API wrapper starts a promise without returning it from the action. It also suppresses an older action's refresh when a newer action has started. Overlapping writes can therefore make the page's refresh timing misleading; this code does not itself prove that writes are dropped. [Request and completion handling](https://github.com/inaturalist/inaturalist/blob/0e15a4a4bd64b914672be1e4e6492c272a79fa9a/app/webpack/observations/shared/ducks/observation.js#L10-L91).
- The observation-detail fetch used after writes includes `ttl: -1`. The handoff uses the same parameter for fresh public detail checks. [Observation fetch](https://github.com/inaturalist/inaturalist/blob/0e15a4a4bd64b914672be1e4e6492c272a79fa9a/app/webpack/observations/show/ducks/observation.js#L554-L575).

An offline execution of these upstream action functions with controlled, deferred API promises confirmed that:

1. The requested value is already in the displayed state before any server response; awaiting the action does not wait for the save.
2. Two successive submissions can leave two requests pending at once.
3. If the later request completes first, its refresh can omit an older pending value; the older request's eventual success need not trigger another refresh.
4. A simulated rejection can follow an initially correct-looking value, which is then removed by the detail refresh.
5. Waiting for each completion before submitting the next field kept only one write in flight and produced all four saved values in the mock server.

This was an offline mechanism check, not a live-browser cancellation or rate-limit experiment. It made no iNaturalist writes. Downloaded sources, the reproduction script, and its result are retained locally under `review-work/save-investigation-2026-10-19/`; historical initial API results remain under `review-work/redwood-trial-25/`. Working files are excluded from Git.

## Required completion rule

**One submission → settled matching field row → matching fresh detail-API response → next submission.** Before leaving the observation, reconcile all intended fields in one fresh detail response and ensure no save is pending. Record server-confirmed values and timestamps, not the temporary display.

If the UI does not expose a reliable saving indicator, require the fresh API confirmation instead of guessing from elapsed time. A missing value, failed read, or timeout is not permission to resubmit: follow the handoff's bounded read retries and conflict-aware recovery. Never reload an observation merely to clear a pending save.
