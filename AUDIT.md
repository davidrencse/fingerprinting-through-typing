# Code and usability audit — 2026-10-30

Reviewed the application (`app.js`, `model.js`, `index.html`, `style.css`, `server.js`), package configuration, documentation, and tests. The app has a coherent single-profile workflow and no runtime third-party dependencies. The original automated tests used a mock DOM and did not exercise real focus behavior. Real Chromium, Firefox, and WebKit tests now cover the main workflows. This is an engineering audit with automated usability scenarios, not a study with human participants or a validation of biometric accuracy.

## Follow-up improvements

Completed onboarding sentences and the profile name are now restored after a refresh using per-tab sessionStorage. No raw in-progress key events are persisted. The current sentence restarts to preserve timing integrity. A secondary Start onboarding over control clears the draft with confirmation, while retaining any saved profile. Draft data is validated and tied to the profile it started from, so obsolete drafts are ignored after a profile change. Optional draft storage failures are explained without blocking in-memory typing. Final profile save and deletion clear the draft.

## Findings addressed

| Severity | Location | Finding and change |
| --- | --- | --- |
| P1 | `app.js`: blur/visibility handlers | Clicking away locked the field. Capture now pauses, preserves completed characters, and resumes on return. No focus is stolen from other controls. |
| P1 | `app.js`, `model.js`: interrupted capture | Simply allowing resumed input would count time away as typing delay. The next key now marks a segment boundary; cross-boundary intervals are excluded. An unfinished key is discarded because its release time is unknown. Corrections preserve the boundary. |
| P2 | `app.js`: completion validation | A sentence containing a long pause could appear ready, only to fail after Save. Validation now runs at completion, explains the issue, and keeps Save disabled until the sample is usable. |
| P2 | `app.js`: input handling | Paste and held-key repeats unnecessarily locked capture. Paste is rejected with recovery guidance while retaining text; repeats are ignored. Ctrl/Cmd+A followed by Backspace clears the sentence. The interface explicitly describes end-of-text correction. |
| P2 | `app.js`: profile loading | Invalid saved profiles silently disappeared. Missing/corrupt profile data now produces onboarding recovery guidance. Saved names are checked for nonempty content and length. |
| P2 | `index.html`, `app.js` | Help incorrectly referred to eight training samples, and the onboarding heading contained a broken apostrophe. Copy now matches five sentences and twenty metrics. The required name field is explicitly labeled. |
| P2 | `style.css` | Expandable-help targets were below the intended 44px size. Minimum target height increased; narrow action rows wrap. |
| P3 | `app.js`: metrics rendering | All twenty table rows were rebuilt on every key event. Rows are now reused and only refreshed when their measured values or profile averages change. |
| P3 | `server.js` | URL parsing had no error recovery and the static-file lookup inherited object properties. Malformed URLs return 400 and only explicit file entries are served. |

The model retains 20 existing metrics and the v3 profile format. Existing v3 profiles do not need re-enrollment. Interrupted samples must retain at least 70% of adjacent intervals and measurable word-boundary timings; otherwise the user is asked to restart that sentence. This threshold is a quality-control heuristic, not a validated biometric criterion.

## Verification evidence

- **12 Node tests passed:** extraction, same/different synthetic rhythms, inconclusive results, negative release gaps, metric participation, corrupt data rejection, five-sentence onboarding, pause exclusion/coverage rules, and draft validation.
- **42 browser tests passed (14 scenarios in each of Chromium, Firefox, and WebKit):** click-away recovery after a 3.2-second pause; missed key release; enrollment through save; profile persistence; verification and retry; re-enrollment preserving the existing profile; cancel/confirm deletion; typo correction; keyboard navigation; clear-all; paste rejection; missing name; failed storage with successful retry; long-pause recovery; tab-visibility handling; corrupt saved data; static-file allowlist; draft restoration across refresh; draft discard/cancel; unavailable draft storage; corrupt or obsolete draft rejection.
- **Accessibility:** axe checks for WCAG 2 A/AA and 2.1 AA reported no violations in the expanded initial interface at 360, 768, and 1280px widths in all three browser engines. This is not a claim of complete accessibility conformance.
- **Responsive layout:** browser assertions found no page-level horizontal overflow at those three widths. Desktop and phone screenshots were visually inspected; controls and measurement headings remained legible. Screenshots are generated under `test-results/`.
- **Runtime:** the main lifecycle test reported no page JavaScript errors. JavaScript syntax checks pass. npm dependency audit reports no known vulnerabilities.
- Tests run against a separate server on port 5174 with isolated browser storage. The page-visibility scenario dispatches a visibility event; it does not simulate an operating-system window switch. Keyboard events in the main scenarios are generated through the browser automation input API.

## Remaining limitations and follow-up

| Priority | Finding | Impact / next step |
| --- | --- | --- |
| P1 if used for authentication | Real-person identification accuracy is unvalidated. The test signals are synthetic and the threshold comes from five enrollment samples. | Measure false accepts, false rejects, and inconclusive rates on independent real-user sessions before making authentication claims. Local storage and client-side decisions are user-modifiable. |
| P2 | Draft recovery is scoped to the current tab session. | Completed sentences and name survive refresh in sessionStorage; the unfinished sentence starts over. Closing the tab normally ends the draft session. Browser session restoration may retain it. |
| P2 | Physical-keyboard input is required; text editing is append/end-correction oriented. | Virtual keyboards and IME input are not supported measurement sources. Support would require a different capture strategy and validation. |
| P2 | Browser/assistive-technology coverage is limited. | Chromium, Firefox, and WebKit automation and emulated viewport sizes were tested. Physical phones, branded Safari, OS focus changes, and screen-reader sessions were not tested. |
| P3 | CSS mixes shared tokens and literal colors. | A future styling pass can consolidate tokens. There is one intentionally light theme; no theme switcher is advertised. |

The app's local-only data handling, semantic controls/table, keyboard focus styling, reduced-motion treatment, and explicit uncertain outcome are useful foundations. No user study, security certification, or biometric accuracy claim follows from these checks.

## Reproduce

```sh
npm ci
npx playwright install chromium firefox webkit
npm test
npm run test:e2e
npm audit --audit-level=high
```
