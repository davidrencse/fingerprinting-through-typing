export const SENTENCES = [
  'the rhythm of my typing is unique.',
  'a quiet morning is a good time to begin.',
  'small steps can lead to something great.',
  'take your time and find a comfortable pace.',
  'every little pause tells part of my story.'
];
export const PHRASE = SENTENCES[0];
export const REQUIRED = SENTENCES.length;
const mean = a => a.reduce((s, n) => s + n, 0) / a.length;
// Floors express measurement tolerance in each metric's units. Each family gets
// equal total weight so correlated summaries do not dominate the decision.
export const METRICS = [
  ['holdMean', 'Average key hold', 'ms', 'hold', 20, 0, 2000],
  ['holdQ25', 'Key hold · 25th percentile', 'ms', 'hold', 20, 0, 2000],
  ['holdMedian', 'Median key hold', 'ms', 'hold', 20, 0, 2000],
  ['holdQ75', 'Key hold · 75th percentile', 'ms', 'hold', 20, 0, 2000],
  ['intervalMean', 'Average press interval', 'ms', 'pace', 35, 0, 3000],
  ['intervalQ25', 'Press interval · 25th percentile', 'ms', 'pace', 35, 0, 3000],
  ['intervalMedian', 'Median press interval', 'ms', 'pace', 35, 0, 3000],
  ['intervalQ75', 'Press interval · 75th percentile', 'ms', 'pace', 35, 0, 3000],
  ['holdSD', 'Key-hold variability', 'ms', 'hold', 15, 0, 2000],
  ['holdIQR', 'Middle-half key-hold spread', 'ms', 'hold', 20, 0, 2000],
  ['intervalSD', 'Press-interval variability', 'ms', 'pace', 30, 0, 3000],
  ['flightMean', 'Average release-to-press gap', 'ms', 'flight', 35, -2000, 3000],
  ['flightMedian', 'Median release-to-press gap', 'ms', 'flight', 35, -2000, 3000],
  ['flightSD', 'Release-to-press variability', 'ms', 'flight', 30, 0, 5000],
  ['overlap', 'Overlapping key presses', '%', 'flight', .1, 0, 1],
  ['beforeSpace', 'Interval before a space', 'ms', 'boundary', 40, 0, 3000],
  ['afterSpace', 'Interval after a space', 'ms', 'boundary', 40, 0, 3000],
  ['spaceHold', 'Average spacebar hold', 'ms', 'boundary', 25, 0, 2000],
  ['withinWord', 'Within-word press interval', 'ms', 'boundary', 35, 0, 3000],
  ['intervalCV', 'Relative pace variability', 'ratio', 'pace', .15, 0, 10]
].map(([id, label, unit, group, floor, min, max]) => ({ id, label, unit, group, floor, min, max }));
const sd = a => Math.sqrt(mean(a.map(n => (n - mean(a)) ** 2)));
const validVector = s => Array.isArray(s) && s.length === METRICS.length && s.every((n,i) => Number.isFinite(n) && n >= METRICS[i].min && n <= METRICS[i].max) && s.slice(0, 8).every(n => n > 0);
export function formatMetric(value, metric) {
  return metric.unit === '%' ? `${(value * 100).toFixed(1)}%` : `${value.toFixed(metric.unit === 'ratio' ? 2 : 1)}${metric.unit === 'ms' ? ' ms' : ''}`;
}
function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = p => { const index = (sorted.length - 1) * p; const lo = Math.floor(index); return sorted[lo] + (sorted[Math.ceil(index)] - sorted[lo]) * (index - lo); };
  return [mean(values), quantile(.25), quantile(.5), quantile(.75)];
}
export function features(events, phrase = PHRASE) {
  if (!Array.isArray(events) || !SENTENCES.includes(phrase) || events.length !== phrase.length || events.some((e, i) => !e || e.key !== phrase[i] || !Number.isFinite(e.down) || !Number.isFinite(e.up) || e.up <= e.down || e.up - e.down > 2000 || (i && (e.down <= events[i-1].down || (!e.breakBefore && e.down - events[i-1].down > 3000))))) throw new Error('This sentence contains a long pause or an incomplete key press. Restart this sentence at a natural pace.');
  const holds = events.map(e => e.up - e.down);
  const pairs = events.slice(1).map((e,i) => ({before: events[i], after: e})).filter(pair => !pair.after.breakBefore);
  if (pairs.length < (events.length - 1) * .7) throw new Error('Too many interruptions to measure your rhythm. Restart this sentence and type a longer continuous stretch.');
  const intervals = pairs.map(({before,after}) => after.down - before.down);
  const flights = pairs.map(({before,after}) => after.down - before.up);
  const holdSummary = summarize(holds);
  const beforeSpace = intervals.filter((_,i) => pairs[i].after.key === ' ');
  const afterSpace = intervals.filter((_,i) => pairs[i].before.key === ' ');
  const withinWord = intervals.filter((_,i) => /^[a-z]$/.test(pairs[i].before.key) && /^[a-z]$/.test(pairs[i].after.key));
  if (!beforeSpace.length || !afterSpace.length || !withinWord.length) throw new Error('Word-boundary timings were interrupted. Restart this sentence to capture them.');
  return [...holdSummary, ...summarize(intervals), sd(holds), holdSummary[3] - holdSummary[1], sd(intervals), mean(flights), summarize(flights)[2], sd(flights), flights.filter(n => n < 0).length / flights.length, mean(beforeSpace), mean(afterSpace), mean(events.filter(e => e.key === ' ').map(e => e.up - e.down)), mean(withinWord), sd(intervals) / mean(intervals)];
}
export function validSamples(samples) {
  return Array.isArray(samples) && samples.length === REQUIRED && samples.every(validVector);
}
export function validDraftSamples(samples) {
  return Array.isArray(samples) && samples.length < REQUIRED && Array.from(samples).every(validVector);
}
function fit(samples) {
  const center = samples[0].map((_, i) => mean(samples.map(s => s[i])));
  const spread = center.map((v, i) => Math.max(METRICS[i].floor, Math.abs(v) * .15, Math.sqrt(mean(samples.map(s => (s[i] - v) ** 2)))));
  return { center, spread };
}
function distance(sample, model) {
  const groups = ['hold', 'pace', 'flight', 'boundary'];
  return Math.sqrt(mean(groups.map(group => mean(sample.map((n, i) => ({ group: METRICS[i].group, score: Math.min(36, ((n - model.center[i]) / model.spread[i]) ** 2) })).filter(item => item.group === group).map(item => item.score)))));
}
export function train(samples) {
  if (!validSamples(samples)) throw new Error('Five complete sentence samples are required.');
  const model = fit(samples);
  const heldOut = samples.map((s, i) => distance(s, fit(samples.filter((_, j) => j !== i))));
  return { ...model, threshold: Math.min(2.8, Math.max(1.65, Math.max(...heldOut) * 1.15)), consistency: mean(heldOut) };
}
export function verify(sample, model) {
  if (!validVector(sample) || sample.length !== model.center.length) throw new Error('Invalid timing sample.');
  const deviation = distance(sample, model);
  const ratio = deviation / model.threshold;
  return { deviation, ratio, label: ratio < .85 ? 'Likely enrolled user' : ratio > 1.15 ? 'Likely different user' : 'Inconclusive', kind: ratio < .85 ? 'match' : ratio > 1.15 ? 'different' : 'uncertain' };
}
