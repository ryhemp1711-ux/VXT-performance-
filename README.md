# VXT Performance

A responsive, local-first coach workspace for sprint testing and athlete progress. No build step, paid service, account, or API key is needed.

## Run

Download the repository ZIP and extract it. With Python 3 installed, run `python3 -m http.server 8000` from the extracted folder, then open http://localhost:8000. On Windows, use `py -m http.server 8000`. Keep the same browser and address to access saved data.

Alternatively open `index.html` directly; browser storage behavior for file URLs varies, so a local server is preferred. To make it accessible on a phone, host these static files over HTTPS. This repository has not automatically published a live app.

For GitHub Pages: in repository Settings → Pages, choose **Deploy from a branch**, then **main** and **/(root)**. When GitHub reports deployment complete, use its provided URL. Relative asset paths support this repository's trailing hyphen. No private athlete records are included in the repository.

## First session

1. Add an athlete from Overview (or load fictional demo data under Data & backup).
2. Choose the active athlete and log a dated result with a timing method.
3. See personal bests grouped by event and timing method, and event progress.
4. Calculate a 100m, 200m, or 400m estimate and explicitly save it to the athlete.
5. Later results for that event are compared against saved estimates. Comparisons use the earliest result on a later date, not same-day results.
6. Export a JSON backup regularly. Import validates the backup before replacing current records and requires an explicit checkbox.

## Data and limitations

Data is stored in localStorage under `vxt-performance-v1`. It is browser/device/origin specific, not encrypted by this app and not cloud-synced. Clearing browser data removes records. Storage failures are shown rather than reported as successful saves. Corrupt existing data is not silently overwritten. An exported backup contains athlete names, results, notes, and predictions; keep it private. Nothing is sent to a server by the application.

This is a usable MVP, not a multi-user service. Athlete login, access roles, cloud storage, automated imports are future work. There are no automatic conversions between hand, gates, video, and FAT timing.

## Predictor provenance

Formulas are inherited from `VXT_Predictor_App_v1_1.html` (Hemphill prototype), with input validation added. These are **unvalidated heuristics**, not published scientific models. Numerical confidence ratings and statistical-looking ranges were removed because no calibration dataset supports them. Long jump and training prescriptions are outside this sprint-focused starter.

- 100m: `30m acceleration + 7 × fly10 equivalent + 0.18 + max(0, fly10 equivalent − 1) × 0.9`. The selected flying distance is normalized to 10m. Fly speed is segment-average speed, not instantaneous top speed.
- 200m: `2 × 100m PB + profile offset`; optional 150m blends 65% of that result with 35% of `150m × 1.36`.
- 400m: use measured 200m or `100m × (profile factor + level adjustment)`, then multiply by the adjusted 400m factor. Optional 300m blends 60% of this with 40% of `300m + 100m × adjusted finish factor`.

All coefficients are visible in `model.js`. Age, wind, reaction time and timing-system differences are not modeled. The development level is a user-selected heuristic, not an age-specific validation. Predictions retain model version and inputs in backups.

## Development

- `index.html`, `styles.css`: accessible forms and responsive layout.
- `app.js`: athlete/result workflows, local storage, comparisons, backup/import.
- `model.js`: pure prediction and backup validation functions.
- `npm test`: Node's built-in tests; no dependencies or npm install needed.
- GitHub Actions runs tests on pushes and pull requests.

Before adding cloud storage, implement authentication and per-athlete authorization, migrations, server-side validation, and a deliberate data retention policy. Keep real athlete data out of public source files.

## Verification

Run `npm test` for formula, flying-distance normalization, input validation, and backup validation checks. JavaScript syntax is checked with `node --check app.js` and `node --check model.js`. Full visual and end-to-end browser verification remains outstanding.

## Record management (v0.2)

Use Edit in Result history to correct dates, times, events, methods, or notes. Cancel leaves the saved record unchanged. Roster Delete asks for confirmation and removes that athlete’s results and predictions too. Export a backup first if needed. Your selected athlete is remembered on this browser.

The predictor fills saved personal bests for the active athlete and selected timing method, displaying source dates. Flying distance uses only the matching Fly event, never a standing-start time. Missing results stay blank. Change the timing method or click Use saved bests to refill; manual changes remain editable. Changing athletes, events, or saved results resets the predictor. Formulas are unchanged and remain experimental.

## v0.3: manual cloud sync

Supabase project URL and publishable key are public browser configuration in `sync.js`. Never add a secret/service-role key.

1. Run `supabase/schema.sql` in the project SQL Editor. It creates one JSON workspace per account, enables RLS, grants only owner reads, and restricts writes to an authenticated revision-checked function.
2. In Authentication → URL Configuration set Site URL and an allowed redirect to `https://ryhemp1711-ux.github.io/VXT-performance-/`.
3. Open Cloud sync in VXT, create an account, confirm the email if required, and sign in. This account is separate from the Supabase dashboard login.
4. On the original device, Upload to cloud. On the other device, sign in with the same VXT account and Download from cloud.

Transfers replace the full destination workspace; no automatic merging or background sync. Review confirmations before replacing records. Upload checks the revision atomically to reject concurrent changes. Before replacement, the old destination is saved as a single local recovery backup. Export recovery backup before another transfer if needed. Sign-out retains local records. Browser storage and independent JSON exports remain supported offline. Auth loads the pinned Supabase JS 2.57.4 UMD bundle only when Cloud sync opens.

Validation: local tests cover cloud action cancellation, errors, stale revision rejection, account switching and successful transfer; live auth/RLS verification requires the owner to run SQL and sign in on two devices.

## v0.4: screenshot season-record import

Import screenshot reads PNG/JPEG/WebP images locally with pinned Tesseract.js 5.1.1. Upload one screenshot at a time, select an existing athlete, check editable candidates, and append reviewed results. Source images are never sent to an OCR API or stored in the repository. Initial OCR loading requires internet. If recognition fails, paste/correct extracted text in the fallback editor.

The parser targets the supplied Athletic.net season-summary layout (event heading, year, Indoor/Outdoor, grade, decimal result, optional wind). It does not claim to parse arbitrary meet sheets. Unknown athlete names are never inferred; timing defaults to Unknown. Exact dates are not fabricated: imported year-only dates remain YYYY. 55m is supported. Season-only results appear in bests and trends but are excluded from subsequent-race prediction comparisons. Wind remains in notes; bests do not automatically exclude wind-assisted results.

Import preserves existing data and skips exact duplicates matching athlete, event, date, time, method and notes. Changing reviewed fields can create a distinct record. Refresh both devices to v0.4 before syncing year-only or 55m results; old validation does not support them. No Supabase schema change is needed.

Validation: all 20 Node tests pass. Local Tesseract CLI recognition plus the parser recovered all 16 and 15 visible rows from the two supplied screenshots, including signed wind. iPhone browser OCR performance still needs user verification.

## v0.5: standardized dates and imported predictor inputs

Result displays and screenshot review use MM/DD/YYYY. Season-only dates display --/--/YYYY and retain YYYY in storage. Complete dates remain canonical YYYY-MM-DD in storage. Shared validation normalizes numeric US MM/DD/YYYY, M/D/YYYY, US hyphen dates and year-first slash/ISO dates from backups, screenshots, existing storage and cloud downloads, and rejects impossible calendar dates. Ambiguous numeric dates are interpreted month-first; unsupported formats require correction.

Predictor autofill defaults to All methods so imported Unknown-method results are available, and retains explicit method filters. It shows the selected date, timing method and source notes/wind. It picks the fastest matching event for the active athlete, so review older, wind-assisted or mixed-method results before calculating. 100m still needs standing 30m plus a fly split; race 55m/60m results are not substituted for fly times. 200m/400m use matching saved race times.

Validation: 25 unit tests and a DOM integration check for screenshot append, standardized dates, default imported Unknown result autofill, 200m calculation, 400m inputs, and timing-method filtering.

## v0.6: group training sessions

Training sessions saves a named, dated practice with multiple athletes and reps. Each standing-start effort accepts a required finish time and optional cumulative 10m/20m/30m/60m splits strictly before the finish. All entered splits must increase in elapsed time. Flying events are separate and accept a finish time only; standing split differences are never relabeled as flying efforts. One timing method applies to a session.

Saving adds the complete session atomically to local storage. A bad row prevents partial saves; successful saves clear the entered reps. Results retain sessionId, repId, repNumber, repEvent and isSplit to group times from the same run. Optional sessions metadata is backward-compatible with existing v1 backups. Sessions and links are included in existing JSON exports and manual cloud transfers without database changes. Refresh both devices to v0.6.

The saved session summary reads current linked results, so individual edits/deletions in Results are reflected. Athlete deletion removes their times; session metadata may remain with zero reps. Session drafts persist while moving between app tabs but are not saved across page refreshes.

Validation: 32 unit tests and a DOM integration check confirm multi-athlete save, optional cumulative splits, rejection of inconsistent times, atomic failure, backup round-trip, separate fly events, saved session summaries and 100m predictor autofill from a standing 30m split plus a flying effort.

## v0.7: drills, longer runs, broken runs and session-save feedback

Training sessions now includes continuous 250m, 300m, 350m, 450m and 500m runs; sled pushes with distance, optional load/unit and optional time; wicket runs with count, uniform spacing in feet/meters, calculated first-to-last wicket span and optional time; and broken 200m/300m/400m with 2–4 consecutive distance segments totaling the selected distance. Segment times are optional. Rest between segments is required in seconds (zero accepted); rest after any rep is optional. Total running time excludes rest and appears only when every segment is timed. Drills and broken runs stay in sessions and never become continuous-race predictor inputs.

The session form uses explicit validation with visible save status instead of native browser validation that can stop submission before feedback. Successful saves clear entries only after the local commit succeeds, then open the saved summary. Empty-name, invalid splits, missing athletes and incorrect broken totals retain the form with errors. A normal Results entry alone does not create a training session. New session effort metadata retains drills without timed results and survives JSON backups and cloud transfers; no database migration is required. Refresh both devices to v0.7 before transferring new distances. Athlete deletion also removes associated stored efforts.

Validation: 38 tests pass, plus DOM save-button checks for field errors, wrong-total rejection without partial writes, drill persistence after reload, automatic opening of the saved summary, and athlete deletion.

## v0.8: 400 the hard way

Choose **400 the hard way** in Training sessions. Run 100m, walk back 50m and repeat until reaching the end of the 400m lap: seven 100m runs, six 50m walk-backs, 700m total running and 300m walking. There is no walk-back after the final run. One session entry records the full workout, with optional individual run and walk-back times, optional rest after the workout and notes. Running time appears only when all seven runs are timed and excludes walking. This drill never becomes a continuous 400m result or predictor input.

The fixed structure, optional times and totals survive reloads, JSON backups and manual cloud transfers. Refresh both devices to v0.8 before transferring this drill; older clients reject the new effort type. No database migration is required.

## v0.9: tempo sessions

Choose **Tempo** in Training sessions. The editable default is 2 sets of 5 × 100m. Set the number of sets, reps per set and distance, with optional rest between reps, rest between sets, individual rep times, notes and rest after the complete workout. Between-set recovery replaces between-rep recovery at set boundaries. One-set or one-rep workouts omit the unused recovery field. The summary shows total running distance and per-set times; total running time appears only when all reps are timed and excludes recovery. Up to 200 runs are supported per tempo entry.

Tempo is training-only: no continuous race results or predictor inputs are created. Tempo structure and times survive local reloads, JSON backups and manual cloud transfers. Refresh both devices to v0.9 before transferring tempo entries; no database migration is needed.

Tempo entries now include a category: Extensive or Intensive. Extensive is the editable default for new entries. Previously saved tempo entries keep their original data and display Unspecified rather than being assigned a category. The category is retained in session summaries and backups.

## v0.10: training blocks

Training blocks creates editable plans lasting 3–51 weeks in three-week increments. Choose a start date, block name, optional roster athletes and goals; fill in each week’s focus and workout/recovery notes. Date ranges and three-week cycles are calculated automatically. A three-week block includes 21 calendar days starting on the chosen date. Future plans are allowed. Blank weekly plans can be filled in later with Edit; Cancel leaves the saved plan unchanged. Plans never become completed sessions or race results.

Blocks persist in the existing local workspace and JSON backups/manual cloud transfers. Athlete deletion removes their block assignment while preserving the plan. Existing backups without blocks remain valid. Refresh both devices to v0.10 to view and edit blocks. No SQL migration is required. Unsaved form drafts do not survive page reloads.

## v0.11: team training

Use Team training to write one shared workout and assign it to multiple roster athletes in a single save. Select all or choose individuals; enter the workout date, detailed prescription and optional notes. Each athlete starts as planned and has a separate completion checkbox. Edits update the shared assignment. Changing the prescription or date resets completion; adding athletes alone preserves existing completion and starts new assignments as planned. Cancel discards unsaved edits.

Assignments and completion persist in local storage, backups and manual cloud transfers. Athlete deletion removes only their assignments, preserving the workout for remaining athletes (or for later reassignment). Older backups remain valid. These plans and completion flags create no measured results or predictor inputs; record actual times in Training sessions. Refresh both devices to v0.11. No database migration is needed.

## v0.11.1 — Grouped training navigation

Open Training sessions for Session log, Training blocks, and Team training. The three sections share a secondary navigation bar; existing saved data and forms are retained when switching sections.

## v0.11.2 — Team scheduling conflicts

Team training checks selected athletes against explicitly assigned training blocks (inclusive start/end dates) and other team workouts on the same date. The current workout is excluded during editing. Choose Skip conflicting athletes or Include anyway to save when conflicts exist; skipping everyone leaves the form and existing records intact. Changing the date or selection requires a fresh choice. General blocks with no assigned athletes do not imply roster-wide assignments. Blocks contain weekly free text, so a date-range overlap is a warning, not proof of a daily workout. New or edited blocks do not retroactively remove team assignments.

## v0.12 — Session scheduling and deletion

Session log and Team training both check saved sessions, team workouts and assigned block date ranges before saving. Same-day assignments require an explicit Skip conflicting athletes or Include anyway choice even when start times differ. Multiple reps inside a single session are allowed; existing duplicates are preserved. Logging measured results from a planned workout may require Include anyway. General unassigned blocks are not roster-wide assignments.

Optional local start times appear in saved summaries and survive backup/cloud transfers. Older records display Time not set. Team workout times can be changed through Edit. Session log remains a completed-results log; use Team training for future planned sessions.

Open a saved session or team workout to delete it, then confirm. Deleting a logged session keeps its measured results by default and detaches their session links; select Also delete this session’s measured results and splits to remove those results too. Other sessions and results are preserved. Team deletion removes its assignments and completion statuses without deleting measured results. Deletion is local until the next manual cloud upload. Export a backup if needed before deleting.

## v0.13 — Coaching workspace

Training sessions now includes Calendar, Templates and Groups alongside Session log, Team training and Training blocks. Athlete reports is available from the main menu.

- Save, edit and delete training groups. Group selection adds current members to a workout or block; later membership changes do not retroactively change assignments.
- Save reusable workout templates with written instructions, an effort type, rep-entry count and recovery. Load one in Team training, or save an existing team workout as a template. No measured times are generated. Drill details in free text must still be entered when logging.
- Expand an assigned team workout to save each athlete’s target times/instructions, attendance (unrecorded/present/absent/modified), energy (1–5), soreness (0–10), and readiness/modification notes.
- Choose Log results on a planned workout. On or after its date, eligible athletes receive blank rep entries with the date, start time, effort and recovery prefilled. Absent and already-logged athletes are excluded. Review drill parameters and enter actual measurements. Saving retains the prescription/target snapshots, links the session and marks only logged athletes complete. The source workout is not a scheduling conflict; other workouts and block ranges still trigger review. A second linked log for the same athlete is blocked. Delete its linked session before rebuilding that athlete’s log, or edit continuous times in Results.
- Linked workouts cannot change their date, prescription or remove athletes with linked results. Targets and check-ins remain editable. Deleting the source plan detaches its logs while preserving measured results and historical snapshots. Deleting a linked log reopens completion; optionally keep its measured results as independent results.
- The Monday–Sunday calendar filters by athlete, shows local start times, planned workouts, completed session logs and block ranges, and flags possible same-day conflicts. Linked logs are grouped under their plan. Open workouts and logs directly from calendar entries.
- Athlete reports show personal bests grouped by timing method, first/latest dated performance, training/attendance, individual targets, readiness and saved coach notes. Print/Save PDF through the browser or download a standalone HTML report to share. Positive improvement means faster. Season-only results are excluded from dated trends. No validated readiness score or race prediction is inferred.

All additions are included in JSON backup and existing manual cloud transfers. Update both devices before changing these records. Existing backups without the new fields remain supported. Automated suite: 75 tests. Live Supabase auth/RLS and two-device verification remain separate deployment prerequisites.
