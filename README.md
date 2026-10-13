# Subsea Test Lab

**An interactive software validation demonstration.** A simulated underwater navigation processor with a live automated test suite, fault injection and a regression-testing walkthrough. It's designed to be opened on a phone from a QR code and explored in under two minutes.

> All data is simulated. This is a personal portfolio project. It does not represent Sonardyne technology, has not been validated against real underwater equipment, and its requirements are fictional.

---

## Project purpose

The app shows, hands-on, how I approach software validation:

1. A small but realistic system under test: a navigation monitor that decides whether each position fix can be trusted.
2. Genuine automated tests (in the browser *and* in Vitest) that evaluate real outputs against expected results.
3. Controlled fault injection that changes the actual simulated data and test outcomes.
4. A regression demo: introduce a code defect, see exactly which tests catch it and why, fix it, and confirm recovery.

## Why it's relevant to software validation engineering

Navigation software is safety-relevant. A wrong position is often worse than no position at all. So the interesting questions are less "does it compute a number?" and more:

- Does it meet its specification exactly, including at the boundaries? (**verification**)
- Does it refuse to present untrustworthy data as trustworthy? (**validation**)
- When the code changes, does previously verified behaviour stay the same? (**regression**)
- Do the tests actually detect defects? (proved in CI by running them against a deliberately defective build)

## Technology stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Unit / regression tests | Vitest 3 |
| CI | GitHub Actions |
| Hosting | Vercel (static, no backend, no API keys) |
| QR code | `qrcode` npm package |

## Architecture overview

```
src/
  lib/                 ← pure TypeScript, no React: the system under test + test logic
    build.ts           baseline (v1.2.0) and defective (v1.3.0-rc1) processor builds
    geometry.ts        Point, ±1000 m working area, isValidPoint, positionError (contains the injectable defect)
    simulation.ts      deterministic sensor simulator (mulberry32 PRNG, per-step seed, fault models)
    navigation.ts      NavigationMonitor: status, trust, alarm, last-known-good fix, recovery latch
    scenario.ts        fixed 24-step regression scenario (seed 42, every fault type)
    baseline.ts        golden outputs from the verified build (generated, do not hand-edit)
    testSuite.ts       in-app test cases TC-01…TC-07
    requirements.ts    fictional REQ-001…REQ-007 + traceability
  components/          React UI (dashboard, plot, results, regression stepper, traceability)
  app/                 Next.js routes: / (dashboard) and /info (printable QR sheet)
tests/                 Vitest suites
scripts/
  generate-baseline.ts regenerate golden values from the verified build
  generate-qr.mjs      write public/qr.png + qr.svg for the deployed URL
```

The UI only *calls* `src/lib`; all decisions and test logic live there, so Vitest tests them without a browser.

### The system under test

- **Simulator**: a figure-of-eight survey track (`x = 180·sin(0.05t)`, `y = 90·sin(0.1t)`) with Gaussian sensor noise σ = 0.8 m. Each sample is a pure function of `(seed, step, fault, faultAge)`, so every run is reproducible.
- **Fault models**:
  - `sensor_failure`: health FAILED, position jumps (+38, −52) m.
  - `missing_data`: the reading is `null`.
  - `excessive_error`: the sensor claims OK, but a northward bias of 8 m + 0.6 m per step is present.
- **NavigationMonitor**: tolerance 5.0 m (error > 5.0 is out; exactly 5.00 is in). Statuses: `NOMINAL`, `RECOVERING`, `DEGRADED`, `SENSOR_FAULT`, `NO_DATA`, `INVALID_INPUT`. After any fault, 3 consecutive good readings are needed before the fix is trusted again. `process()` never throws.
- **The injectable defect**: in build `1.3.0-rc1`, a "refactor" of `positionError()` returns `|dx|` instead of `√(dx² + dy²)`. North-south errors become invisible.

## Running locally

Requires Node.js 20+ (CI uses 22).

```bash
npm install
npm run dev          # http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

## Running the automated tests

```bash
npm test             # all Vitest suites against the verified build: expected to PASS
npm run test:defect  # same suites with SUBSEA_INJECT_DEFECT=1: expected to FAIL
npm run typecheck
```

`npm run test:defect` failing is the point: it proves the tests can detect the defect. CI enforces this in a separate job that fails if the defective build ever passes.

If behaviour is changed *intentionally* and reviewed, regenerate the golden values with `npm run baseline:generate`. The script always uses the verified build.

## Testing types demonstrated

| Type | Where |
| --- | --- |
| **Functional testing** | TC-01…TC-05 check individual behaviours against expected results. |
| **Verification** | TC-04 checks the error calculation against an independent oracle (`Math.hypot`) at the exact 5.00 / 5.01 m boundaries; TC-03 checks input rejection. |
| **Validation** | TC-02, TC-05, TC-07 check that unreliable data (missing, failed sensor, freshly recovered) is never presented as a trusted fix, which is what an operator actually needs. |
| **Boundary-value testing** | (3, 4) = 5.00 m in tolerance; (0, 5.01) and (3.6, 3.6) out. |
| **Robustness** | NaN, Infinity, strings, out-of-area, malformed objects, even a throwing getter: all rejected without crashing. |
| **Fault injection** | Live buttons alter the simulated sensor data; the suite reruns immediately. |
| **Integration testing** | Simulator → monitor → test suite → traceability exercised end to end (`tests/suite.test.ts`, and the UI). |
| **Regression testing** | TC-06 replays a fixed seed-42 scenario and compares every step to golden values from the verified build. The UI stepper walks through baseline → defect → fail → fix → pass. |
| **Test independence** | Tests use their own oracle, never the system's `positionError()`, so a defect in the system can't hide itself. Each test is wrapped in try/catch so an exception is reported as FAIL. |

### In-app test cases

| ID | Test | Requirement |
| --- | --- | --- |
| TC-01 | Normal sensor reading (live check on the current reading) | REQ-002 |
| TC-02 | Missing sensor data handled safely | REQ-004 |
| TC-03 | Invalid coordinates rejected | REQ-005 |
| TC-04 | Position error threshold (boundary values) | REQ-001/002/003 |
| TC-05 | Sensor failure raises alarm | REQ-006 |
| TC-06 | Regression vs. golden baseline | REQ-001/003/007 |
| TC-07 | Recovery after fault (3 good readings) | REQ-007 |

## Example test results

`npm test` (verified build):

```
 ✓ tests/geometry.test.ts
 ✓ tests/simulation.test.ts
 ✓ tests/navigation.test.ts
 ✓ tests/regression.test.ts
 ✓ tests/suite.test.ts
 Test Files  5 passed (5)
      Tests  89 passed (89)
```

`npm run test:defect` (defective build, expected to fail):

```
 × positionError > measures purely north-south errors
 × NavigationMonitor: threshold boundaries > offset (0, 5.01) → DEGRADED
 × NavigationMonitor: recovery > requires 3 consecutive good readings after excessive_error
 × regression against golden baseline > step 6 (excessive_error) matches golden status and error
 ...
 Tests  28 failed | 61 passed (89)
```

In the app, the regression stepper shows:

| Run | Build | Result |
| --- | --- | --- |
| Baseline | v1.2.0 | 7/7 PASS |
| After defect | v1.3.0-rc1 | 4/7: **TC-04, TC-06, TC-07 fail** |
| After fix | v1.2.0 | 7/7 PASS, no regressions |

Why only those three fail: TC-02, TC-03 and TC-05 don't depend on the error calculation, which helps localise the defect. With the defect active, pressing **Excessive Error** shows the dangerous case: the vehicle drifts more than 8 m north while the system still reports a trusted NOMINAL fix, and TC-01's independent oracle flags it.

## Limitations of the simulation

- 2-D only; no depth, heading, velocity, sound-speed, acoustic or inertial modelling.
- The "sensor" is a noisy copy of the planned track, not a physical sensor model.
- Only three fault types, each injected cleanly; real faults are intermittent and correlated.
- Tolerance and recovery rules are fictional and chosen for clarity, not taken from any standard or product.
- In-browser tests are a demonstration; the Vitest suites are the authoritative automated tests.
- No persistence: refreshing the page resets everything.

## Deployment (Vercel)

1. Push the repository to GitHub.
2. On [vercel.com](https://vercel.com), choose **Add New → Project** and import the repo. The defaults for Next.js need no changes, and no environment variables are required.
3. Deploy. Vercel gives you an HTTPS URL such as `https://subsea-test-lab.vercel.app`.
4. Optional: set `NEXT_PUBLIC_APP_URL` to that URL in Vercel → Settings → Environment Variables and redeploy. Otherwise `/info` uses the page's own origin, which is already correct on the deployed site.

Alternatively, from the command line: `npx vercel` (preview) then `npx vercel --prod`.

### QR code

- **Printable page**: open `https://<your-url>/info` and print. The QR code is generated in the browser from the live URL, and the page warns if it would encode `localhost`.
- **Image files**: `npm run qr -- https://<your-url>` writes `public/qr.png` and `public/qr.svg`. The script refuses non-HTTPS, local and placeholder URLs.

Always scan the printed code with a phone before the interview to confirm it opens the live app.
