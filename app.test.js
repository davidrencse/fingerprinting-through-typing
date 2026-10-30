import test from 'node:test';
import assert from 'node:assert/strict';
import { PHRASE, SENTENCES } from './model.js';

test('typing recovers from typos, ignores navigation, and restarts without stale keys', async () => {
  class Element {
    value = ''; style = {}; dataset = {}; disabled = false; readOnly = false; handlers = {};
    addEventListener(type, fn) { this.handlers[type] = fn; }
    setAttribute() {}
    replaceChildren() {}
    focus() {}
  }
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const original = { document: globalThis.document, localStorage: globalThis.localStorage, performance: globalThis.performance };
  let now = 0;
  globalThis.document = { getElementById: get, createElement: () => new Element(), createTextNode: text => text, addEventListener() {} };
  const stored = new Map();
  globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
  globalThis.performance = { now: () => (now += 60) };
  try {
    await import('./app.js');
    const input = get('typing');
    const key = (key, type = 'keydown') => input.handlers[type]({ key, code: key, preventDefault() {} });
    const press = char => { key(char); key(char, 'keyup'); };
    press('t'); press('x');
    assert.equal(input.value, 'tx');
    assert.equal(input.readOnly, false);
    assert.equal(get('save').disabled, true);
    assert.match(get('feedback').textContent, /Backspace/);
    press('Backspace'); press('ArrowLeft'); press('Enter');
    assert.equal(input.value, 't');
    for (const char of PHRASE.slice(1)) press(char);
    assert.equal(get('save').disabled, false);
    assert.equal(input.value, PHRASE);
    get('name').value = 'Test'; get('save').onclick();
    assert.equal(get('progress-text').textContent, '1 of 5 sentences completed');
    key('t'); press('Backspace'); key('t', 'keyup');
    assert.equal(input.value, '');
    press('x'); get('restart').onclick();
    assert.equal(input.value, '');
    assert.equal(input.readOnly, false);
    assert.equal(get('save').disabled, true);
    for (let i = 1; i < SENTENCES.length; i++) {
      assert.equal(stored.size, 0, 'must not persist an unfinished profile');
      assert.equal(get('step').textContent, `Sentence ${i + 1} of 5`);
      for (const char of SENTENCES[i]) press(char);
      assert.equal(get('save').disabled, false);
      assert.equal(get('save').textContent, i === 4 ? 'Save profile' : 'Next sentence');
      get('save').onclick();
    }
    const profile = JSON.parse(stored.get('cadence-profile-v3'));
    assert.equal(profile.samples.length, 5);
    assert.equal(profile.samples[0].length, 20);
    assert.equal(profile.version, 3);
    assert.equal(profile.name, 'Test');
    assert.equal(get('step').textContent, 'Verification');
    for (const char of PHRASE) press(char);
    get('save').onclick();
    assert.equal(get('result-title').textContent, 'Likely enrolled user');
    assert.equal(input.readOnly, true);
  } finally {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
  }
});
