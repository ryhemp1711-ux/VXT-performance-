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
