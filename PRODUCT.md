# Cadence

An experimental single-user typing-rhythm verifier. Enroll five different sentences, then explicitly save the profile, then compare a new sentence with the enrolled profile. Physical keyboard required. Data stays in browser local storage, with explicit deletion. Match, different user, and inconclusive outcomes are heuristic and not proof of identity.

The v3 profile measures 20 timing metrics across four equally weighted families: key holds, pace, release/overlap, and word boundaries. A collapsible comparison table shows the current sentence and enrolled averages. Earlier profiles require fresh enrollment. Synthetic tests do not establish real-user identification accuracy.

Leaving the input pauses capture without locking the field. Completed characters remain, unfinished held keys are discarded, and the next key starts a new measured segment. Cross-segment intervals are excluded; at least 70% of adjacent intervals and word-boundary measurements are required. Existing v3 profiles remain compatible because metric definitions are unchanged.

Onboarding drafts preserve the name and completed sentence vectors in per-tab sessionStorage. Refresh restores the next sentence with an empty input; raw key events are not stored. Starting over clears the draft while preserving an existing saved profile. Drafts tied to an earlier profile are ignored.
