# Cadence design

Operate mode: a quiet, daylight-friendly measurement workspace. The main column owns enrollment and verification; the narrower column displays actual key-hold measurements and profile status. No fabricated trace is displayed in empty states.

Enrollment is a five-sentence sequence. Sentence position and completed count stay visible; Next sentence advances the first four steps, and Save profile completes the fifth. Verification becomes available only after a complete profile is persisted. The existing layout and visual tokens are preserved.

The expanded metrics live in a collapsed details section below the workspace. A semantic table compares 20 named measurements with profile averages; incomplete sentences show dashes. Numerical columns use tabular figures and explicit units, including signed gaps and percentages. The table scrolls horizontally within its container on narrow screens.

The typing field pauses on blur and resumes on return. A persistent help line explains physical-keyboard input, end-of-text correction, and pause/resume. Paused status preserves the sentence and never forces focus away from other controls. Completed sentences remain actionable while the user edits the profile name. Expandable help uses 44px minimum targets; action controls wrap on narrow screens.

Tokens: background #f3f6f8; surface #ffffff; foreground #233647; muted #536779; accent #245b9c; border #d7e0e7. Segoe UI for native controls and reading, Consolas for the literal typing phrase. Main heading 32–48px; section headings 19px; body 14–16px. Workspace gap 36px, panel padding 28px, panel radius 14px. At 800px the columns stack. Visible focus, labeled inputs, polite status updates, and reduced-motion support.

Draft status appears beneath the name field and explains exactly what survives refresh. Start onboarding over is a secondary text control with a confirmation before clearing completed steps. Storage failures are visible without preventing continued typing in memory.
