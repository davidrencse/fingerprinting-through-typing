import { SENTENCES, REQUIRED, METRICS, formatMetric, features, validSamples, validDraftSamples, train, verify } from './model.js';
const $ = id => document.getElementById(id);
const KEY = 'cadence-profile-v3';
const DRAFT_KEY = 'cadence-onboarding-v3';
let phrase = SENTENCES[0];
let profile = null, mode = 'enroll', samples = [], events = [], held = new Map(), invalid = false, model;
let paused = false, breakBefore = false, measuredCache = '', metricCells = [];
let storageNotice = '';
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    if (saved?.version === 3 && typeof saved.name === 'string' && saved.name.trim() && saved.name.length <= 40 && validSamples(saved.samples)) { profile = saved; model = train(saved.samples); }
    else storageNotice = 'The saved profile is not usable. Complete onboarding to replace it with a fresh profile.';
  }
} catch { storageNotice = 'The saved profile could not be read. You can enroll again; browser storage must be available to save.'; }
let restoredDraft = false;
try {
  const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
  if (draft?.version === 3 && draft.profile === JSON.stringify(profile) && typeof draft.name === 'string' && draft.name.length <= 40 && validDraftSamples(draft.samples)) {
    samples = draft.samples; $('name').value = draft.name; restoredDraft = true;
  }
} catch { /* Draft storage is optional; saving will explain availability. */ }
function persistDraft() {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({version:3, profile:JSON.stringify(profile), name:$('name').value, samples}));
    $('draft-status').textContent = samples.length ? `${samples.length} completed ${samples.length === 1 ? 'sentence' : 'sentences'} saved in this tab. Refreshing keeps them; the current sentence starts over.` : 'Completed sentences are saved in this tab as you continue. The current sentence starts over after a refresh.';
  } catch {
    $('draft-status').textContent = 'Draft storage is unavailable. Keep this tab open to retain your progress.';
  }
  $('discard-draft').hidden = !samples.length && !$('name').value;
}
function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* A saved profile invalidates any old draft. */ }
}
function renderMetrics(sample = null) {
  const signature = JSON.stringify([sample, model?.center]);
  if (signature === measuredCache) return;
  measuredCache = signature;
  if (!metricCells.length) $('metric-rows').replaceChildren(...METRICS.map((metric) => {
    const row = document.createElement('tr');
    const label = document.createElement('th'); label.scope = 'row'; label.textContent = metric.label;
    const value = document.createElement('td');
    const baseline = document.createElement('td');
    metricCells.push({ value, baseline });
    row.replaceChildren(label, value, baseline); return row;
  }));
  METRICS.forEach((metric, i) => {
    metricCells[i].value.textContent = sample ? formatMetric(sample[i], metric) : '—';
    metricCells[i].baseline.textContent = model ? formatMetric(model.center[i], metric) : '—';
  });
  $('metrics-status').textContent = sample ? 'Complete sample measured. Profile values are averages across your five enrollment sentences.' : 'Finish a sentence to see all 20 measurements. Profile values appear after enrollment.';
}
function profileUI() {
  $('verify-tab').disabled = !profile;
  $('profile').textContent = profile ? `${profile.name} · ${REQUIRED} sentences learned on this browser` : 'No profile yet. Complete five sentences to create your typing profile.';
  $('delete').hidden = !profile;
}
function draw() {
  const done = events.filter(e => Number.isFinite(e.up));
  $('trace').replaceChildren(...done.map(e => { const bar = document.createElement('div'); bar.className = 'bar'; bar.style.height = `${Math.min(100, (e.up - e.down) / 4)}%`; bar.title = `${e.key === ' ' ? 'Space' : e.key}: ${Math.round(e.up - e.down)} ms`; return bar; }));
  $('trace').setAttribute('aria-label', `${done.length} completed key presses. Average hold ${done.length ? Math.round(done.reduce((s,e)=>s+e.up-e.down,0)/done.length) : 0} milliseconds.`);
  $('hold').textContent = done.length ? `${Math.round(done.reduce((s,e)=>s+e.up-e.down,0)/done.length)} ms` : '— ms';
  const intervals = events.slice(1).flatMap((event,i) => event.breakBefore ? [] : [event.down - events[i].down]);
  $('interval').textContent = intervals.length ? `${Math.round(intervals.reduce((sum,n) => sum+n,0)/intervals.length)} ms` : '— ms';
  const mismatch = events.findIndex((event, i) => event.key !== phrase[i]);
  const matched = mismatch === -1 ? events.length : mismatch;
  const typed = document.createElement('span'); typed.className = 'typed'; typed.textContent = phrase.slice(0, matched);
  $('phrase').replaceChildren(typed, document.createTextNode(phrase.slice(matched)));
  $('count').textContent = `${events.length} / ${phrase.length} characters`;
  let ready = !invalid && mismatch === -1 && events.length === phrase.length && held.size === 0;
  let measured = null;
  if (ready) { try { measured = features(events, phrase); } catch (error) { invalid = true; ready = false; $('feedback').textContent = error.message; } }
  $('save').disabled = !ready || $('typing').readOnly;
  renderMetrics(measured);
  $('live').textContent = invalid ? 'Restart needed' : paused ? 'Paused' : ready ? 'Captured' : events.length ? 'Recording' : 'Waiting';
  if (ready) $('feedback').textContent = mode === 'enroll' ? (samples.length === REQUIRED - 1 ? 'All five sentences complete. Save your profile to start verification.' : 'Sentence complete. Continue when you are ready.') : 'Sample complete. Compare it with the enrolled profile.';
  else if (!invalid) $('feedback').textContent = paused ? 'Paused. Click the typing field to continue where you left off. Time away is not measured.' : mismatch !== -1
    ? `Typo at character ${mismatch + 1}. Use Backspace to correct it, then keep typing. The phrase is lowercase.`
    : events.length ? 'Keep typing the phrase at your normal pace.' : 'Ready when you are. Timing starts with your first key.';
}
function reset(focus = false) {
  events = []; held.clear(); invalid = false; paused = false; breakBefore = false; $('typing').value = ''; $('typing').readOnly = false;
  $('feedback').textContent = 'Ready when you are. Timing starts with your first key.';
  draw(); if (focus) $('typing').focus();
}
function fail(message) { invalid = true; $('feedback').textContent = message; draw(); }
function pause() {
  if (invalid || $('typing').readOnly || !events.length || (events.length === phrase.length && !held.size)) return;
  // A release outside the field is unobserved. Keep only the complete prefix.
  const incomplete = events.findIndex(event => !Number.isFinite(event.up));
  if (incomplete !== -1) events = events.slice(0, incomplete);
  held.clear(); paused = true; breakBefore = events.length > 0;
  $('typing').value = events.map(event => event.key).join(''); draw();
}
function setMode(next) {
  if (next === 'verify' && !profile) return;
  mode = next; phrase = next === 'enroll' ? SENTENCES[samples.length] : SENTENCES[0]; reset(); $('result').hidden = true;
  $('enroll-tab').setAttribute('aria-pressed', next === 'enroll'); $('verify-tab').setAttribute('aria-pressed', next === 'verify');
  $('name-wrap').hidden = next === 'verify';
  $('session-title').textContent = next === 'enroll' ? "Let's learn your rhythm." : 'Is this your rhythm?';
  $('instruction').textContent = next === 'enroll' ? 'Type five short sentences at your normal pace. Continue after each one, then save your profile. Use a physical keyboard.' : `Type naturally to compare with ${profile.name}. A different person can try the same phrase.`;
  $('save').textContent = next === 'enroll' ? 'Next sentence' : 'Compare rhythm';
  progress();
}
function progress() {
  $('discard-draft').hidden = !samples.length && !$('name').value;
  $('save').textContent = mode === 'enroll' ? (samples.length === REQUIRED - 1 ? 'Save profile' : 'Next sentence') : 'Compare rhythm';
  $('step').textContent = mode === 'enroll' ? `Sentence ${Math.min(samples.length + 1, REQUIRED)} of ${REQUIRED}` : 'Verification';
  $('progress-text').textContent = mode === 'enroll' ? `${samples.length} of ${REQUIRED} sentences completed` : 'Compared locally in your browser';
  $('progress-bar').style.width = `${mode === 'enroll' ? samples.length / REQUIRED * 100 : 100}%`;
}
$('typing').addEventListener('keydown', e => {
  if (e.key === 'Tab') return;
  if (['Shift','Control','Alt','Meta','CapsLock','Escape'].includes(e.key)) return;
  if ((e.ctrlKey || e.metaKey) && ['a', 'c'].includes(e.key.toLowerCase())) return;
  e.preventDefault();
  if (invalid || $('typing').readOnly) return;
  if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if ($('typing').selectionStart === 0 && $('typing').selectionEnd === $('typing').value.length) { reset(); return; }
    const removed = events.pop();
    if (removed?.breakBefore) breakBefore = true;
    for (const [code, event] of held) if (event === removed) held.delete(code);
    $('typing').value = events.map(event => event.key).join('');
    draw();
    return;
  }
  // Navigation and editing commands are not character samples.
  if (e.key.length !== 1) return;
  if (e.repeat) return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) { $('feedback').textContent = 'Type individual keys here. Paste and shortcuts cannot provide typing timings.'; return; }
  if (events.length === phrase.length) return;
  if (held.has(e.code)) return fail('A key release was missed. Restart this sample.');
  const event = { key: e.key, down: performance.now(), breakBefore };
  breakBefore = false; paused = false;
  events.push(event); held.set(e.code, event); $('typing').value = events.map(e => e.key).join(''); draw();
});
$('typing').addEventListener('keyup', e => { const event = held.get(e.code); if (event) { event.up = performance.now(); held.delete(e.code); draw(); } });
for (const type of ['paste','drop','compositionstart','beforeinput']) $('typing').addEventListener(type, e => { e.preventDefault(); if (!$('typing').readOnly) $('feedback').textContent = 'Use a physical keyboard. Pasted or virtual-keyboard input cannot be measured. Your existing text is kept.'; });
$('typing').addEventListener('blur', pause);
$('typing').addEventListener('focus', () => { if (paused) { paused = false; draw(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
$('restart').onclick = () => { $('result').hidden = true; reset(true); };
$('enroll-tab').onclick = () => setMode('enroll'); $('verify-tab').onclick = () => setMode('verify');
$('name').addEventListener('input', persistDraft);
$('discard-draft').onclick = () => {
  if (!window.confirm('Start onboarding over? Completed onboarding sentences will be cleared. Your saved profile will remain.')) return;
  samples = []; $('name').value = ''; clearDraft(); persistDraft(); setMode('enroll'); $('name').focus();
};
$('save').onclick = () => {
  try {
    if ($('save').disabled) return;
    const sample = features(events, phrase);
    if (mode === 'verify') {
      const result = verify(sample, model);
      $('result').hidden = false; $('result').dataset.kind = result.kind; $('result-title').textContent = result.label;
      $('result-detail').textContent = `Normalized difference: ${result.deviation.toFixed(2)}. Profile threshold: ${model.threshold.toFixed(2)}. Lower means more similar. ${result.kind === 'uncertain' ? 'Try another sample before drawing a conclusion.' : 'This is an experimental estimate, not proof of identity.'}`;
      $('save').disabled = true; $('typing').readOnly = true; $('feedback').textContent = 'Comparison complete. Restart the sample to test again.';
      return;
    }
    if (!$('name').value.trim()) { $('feedback').textContent = 'Enter a profile name before continuing.'; $('name').focus(); return; }
    const next = [...samples, sample];
    if (next.length === REQUIRED) {
      const nextModel = train(next);
      const nextProfile = { version: 3, name: $('name').value.trim(), samples: next };
      try { localStorage.setItem(KEY, JSON.stringify(nextProfile)); } catch { $('feedback').textContent = 'Browser storage is unavailable. Allow local storage, then save this sample again.'; return; }
      profile = nextProfile; model = nextModel; samples = []; clearDraft(); profileUI(); setMode('verify');
      $('feedback').textContent = nextModel.consistency > 2 ? 'Profile saved, but your samples varied widely. Consider enrolling again at a steady, natural pace.' : 'All five sentences saved. Your profile is ready! Type a fresh sentence to verify it.';
    } else { samples = next; persistDraft(); phrase = SENTENCES[samples.length]; reset(true); progress(); }
  } catch (error) { fail(error.message); }
};
$('delete').onclick = () => {
  if (!window.confirm('Delete the saved profile and its typing samples from this browser?')) return;
  try { localStorage.removeItem(KEY); localStorage.removeItem('cadence-profile-v2'); localStorage.removeItem('cadence-profile-v1'); } catch { $('feedback').textContent = 'Unable to delete browser storage. Check your browser settings.'; return; }
  profile = null; model = null; samples = []; $('name').value = ''; clearDraft(); profileUI(); setMode('enroll'); persistDraft();
};
profileUI(); setMode(restoredDraft ? 'enroll' : profile ? 'verify' : 'enroll');
if (restoredDraft) $('draft-status').textContent = `Onboarding restored: ${samples.length} of 5 sentences complete. Start the current sentence again.`;
if (storageNotice) $('feedback').textContent = storageNotice;
if (!profile) {
  try {
    if (localStorage.getItem('cadence-profile-v1') || localStorage.getItem('cadence-profile-v2')) $('feedback').textContent = 'The expanded 20-metric model needs a fresh profile. Complete the five sentences to enroll again.';
  } catch { /* Storage errors are reported when saving. */ }
}
