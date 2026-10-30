# Cadence

A local browser application that enrolls one user's typing rhythm and compares subsequent samples against that profile.

## Run

Requires Node.js 18 or newer to run the app. There are no runtime dependencies. Browser tests use development dependencies installed with `npm ci` (use Node.js 22 or newer for the test tooling).

```sh
npm start
```

Open http://localhost:5173. Enter a name, type the displayed phrase naturally, and complete five different sentences with **Next sentence**, then click **Save profile**. Then select **Verify a user**, type a fresh sample, and click **Compare rhythm**. Another person can repeat the same test. Use a physical keyboard. Correct the end of your text with Backspace; Ctrl/Cmd+A then Backspace clears the sentence. Clicking away pauses capture; return to the field to continue. If a key was still held when you left, retype that unfinished key. No artificial timing is inserted: intervals crossing a pause are excluded, and at least 70% of adjacent intervals plus measurements around word boundaries must remain. Correction time within a continuous segment remains part of the rhythm. Long pauses inside the field require restarting the sentence. Enrolling again replaces the old profile only after all five new sentences have been saved. Completed onboarding sentences and the profile name are saved in sessionStorage for this tab. Refreshing restores completed steps; the unfinished sentence starts again. Use **Start onboarding over** to discard the draft without changing your saved profile. Closing the tab normally ends the draft session; browser session restoration may retain it. If draft storage is blocked, progress remains available until refresh.

```sh
npm test
```

Real-browser flow, responsive layout, and automated accessibility checks:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run test:e2e
```

Tests launch an isolated localhost server on port 5174 and use temporary browser contexts, leaving your normal profile untouched. See `AUDIT.md` for coverage and remaining limitations.

## Method and limitations

Each sentence produces 20 features. The original eight are the mean and 25th, 50th, and 75th percentiles of key-hold durations and consecutive keydown intervals. Twelve additional measurements are:

1. Key-hold standard deviation.
2. Key-hold interquartile range.
3. Press-interval standard deviation.
4. Mean release-to-next-press gap (negative when keys overlap).
5. Median release-to-next-press gap.
6. Release-to-next-press gap standard deviation.
7. Fraction of consecutive keys that overlap.
8. Mean press interval before a space.
9. Mean press interval after a space.
10. Mean spacebar hold duration.
11. Mean press interval between letters within a word.
12. Press-interval coefficient of variation (standard deviation / mean).

Expand **20 measurements behind your typing profile** to compare the current complete sentence with enrolled averages. These summaries support different sentence lengths but do not capture individual letter-pair patterns. Training estimates per-feature means and standard deviations with unit-specific variance floors. Verification uses a clipped standardized root-mean-square distance, with equal total weighting for hold, pace, release/overlap, and word-boundary families. This limits double-counting correlated metrics; it does not make the metrics independent. A bounded threshold is estimated with leave-one-out training comparisons; a band around it produces an inconclusive result.

These are experimental heuristics, not validated biometric accuracy or probabilities. Similar typists may match; fatigue, practice, devices, sentence composition, and posture may cause rejection. Five enrollment sentences are a small sample. More metrics do not establish accuracy. For an accuracy evaluation, freeze enrollment and thresholds, collect fresh genuine samples across sessions and samples from other consenting typists, and report false-accept, false-reject, and inconclusive rates separately. Do not tune on the held-out evaluation samples. Automated synthetic tests check calculations and behavior, not real-person identification accuracy. This is not suitable as standalone authentication.

The application captures keys only in the dedicated input. It stores the name and five timing vectors in localStorage, not passwords or arbitrary typed text. Incomplete onboarding stores only the name and completed timing vectors in sessionStorage, never raw in-progress key events. Completing onboarding or deleting a profile clears its draft. No external services, fonts, analytics, or network requests are used beyond serving the app from localhost. Local storage can be read or modified by anyone with access to the browser profile. Delete profile removes persisted enrollment data. One profile is supported per browser/origin; changing port creates a separate storage origin.

Profiles from the earlier models require re-enrollment because their missing metrics cannot be reconstructed. The new model uses a separate v3 storage key; Delete profile also removes old v1 and v2 keys.
"# fingerprinting-through-typing" 
