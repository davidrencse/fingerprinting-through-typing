import test from 'node:test';
import assert from 'node:assert/strict';
import { PHRASE, SENTENCES, METRICS, features, train, verify, validSamples, validDraftSamples } from './model.js';
const sample = (offset = 0) => features(Array.from(PHRASE, (key,i) => ({key, down:i*(165 + offset), up:i*(165 + offset)+85+offset})));
test('a similar held-out sample matches, a different rhythm does not', () => {
  const model = train(Array.from({length:5}, (_,i) => sample(i-4)));
  assert.equal(verify(sample(6), model).kind, 'match');
  assert.equal(verify(sample(190), model).kind, 'different');
});
test('borderline distances are inconclusive', () => {
  const model = train(Array.from({length:5}, () => sample()));
  assert.equal(verify(model.center.map((x,i) => x + model.spread[i] * model.threshold), model).kind, 'uncertain');
});
test('extracts hold times and inter-key timing including overlapping keys', () => {
  const events = Array.from(PHRASE, (key,i) => ({key,down:i*100,up:i*100+120}));
  assert.deepEqual(features(events), [120,120,120,120,100,100,100,100,0,0,0,-20,-20,0,1,100,100,120,100,0]);
  assert.throws(() => features(events.slice(1)));
  events[3].up = undefined; assert.throws(() => features(events));
});
test('rejects corrupt training data and interrupted samples', () => {
  assert.equal(validSamples(Array(8).fill([NaN])), false);
  assert.throws(() => train([sample()]));
  const events = Array.from(PHRASE, (key,i) => ({key,down:i*4000,up:i*4000+100}));
  assert.throws(() => features(events));
});

test('different sentence lengths produce comparable features', () => {
  const samples = SENTENCES.map(phrase => features(Array.from(phrase, (key,i) => ({key, down:i*150, up:i*150+90})), phrase));
  assert.equal(validSamples(samples), true);
  assert.equal(verify(samples[0], train(samples)).kind, 'match');
});

test('boundary measurements use spaces and adjacent letter pairs only', () => {
  let down = 0;
  const events = Array.from(PHRASE, (key, i) => {
    if (i) down += key === ' ' ? 300 : PHRASE[i-1] === ' ' ? 400 : key === '.' ? 500 : 100;
    return {key, down, up: down + (key === ' ' ? 70 : 40)};
  });
  const vector = features(events);
  const value = id => vector[METRICS.findIndex(m => m.id === id)];
  assert.equal(value('beforeSpace'), 300);
  assert.equal(value('afterSpace'), 400);
  assert.equal(value('spaceHold'), 70);
  assert.equal(value('withinWord'), 100);
  assert.equal(value('overlap'), 0);
  assert.ok(value('holdSD') > 0);
  assert.ok(value('intervalSD') > 0);
  assert.ok(value('flightSD') > 0);
  assert.ok(Math.abs(value('intervalCV') - value('intervalSD') / value('intervalMean')) < 1e-10);
});

test('every new metric participates in the comparison', () => {
  const baseline = sample();
  const model = train(Array.from({length:5}, () => baseline));
  for (let i = 8; i < METRICS.length; i++) {
    const changed = [...baseline];
    changed[i] += METRICS[i].floor;
    assert.ok(verify(changed, model).deviation > 0, METRICS[i].id);
  }
});

test('accepts zero variability and signed overlap gaps but rejects impossible measurements', () => {
  const vector = features(Array.from(PHRASE, (key,i) => ({key, down:i*100, up:i*100+120})));
  assert.equal(validSamples(Array(5).fill(vector)), true);
  const model = train(Array(5).fill(vector));
  assert.equal(verify(vector, model).kind, 'match');
  for (const [id, bad] of [['overlap', 1.1], ['flightMean', -2001], ['holdSD', -1], ['intervalCV', NaN]]) {
    const corrupt = [...vector]; corrupt[METRICS.findIndex(m => m.id === id)] = bad;
    assert.equal(validSamples(Array(5).fill(corrupt)), false);
    assert.throws(() => verify(corrupt, model));
  }
  assert.equal(validSamples(Array(5).fill(Array(8).fill(100))), false, 'old model vectors cannot be reused');
});

test('pause boundaries exclude unattended time without fabricating measurements', () => {
  const events = Array.from(PHRASE, (key,i) => ({key, down:i*150 + (i >= 8 ? 10000 : 0), up:i*150+90 + (i >= 8 ? 10000 : 0), breakBefore:i === 8}));
  const vector = features(events);
  assert.equal(vector[4], 150);
  assert.equal(vector[11], 60);
  assert.equal(vector[14], 0);
  events[8].breakBefore = false;
  assert.throws(() => features(events), /long pause/);
});

test('excessive pauses and missing word-boundary measurements cannot be saved', () => {
  const events = Array.from(PHRASE, (key,i) => ({key, down:i*150, up:i*150+90, breakBefore:i % 2 === 0}));
  assert.throws(() => features(events), /Too many interruptions/);
  for (const event of events) event.breakBefore = event.key === ' ';
  assert.throws(() => features(events), /Word-boundary/);
});

test('draft validation accepts only incomplete, valid enrollment vectors', () => {
  assert.equal(validDraftSamples([]), true);
  assert.equal(validDraftSamples([sample(), sample()]), true);
  assert.equal(validDraftSamples(Array(5).fill(sample())), false);
  assert.equal(validDraftSamples([Array(20).fill(NaN)]), false);
  assert.equal(validDraftSamples(new Array(2)), false);
  assert.equal(validDraftSamples(null), false);
});
