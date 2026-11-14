import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/offscreen/offscreen.js', import.meta.url), 'utf8');

function clipboardContext(result = true) {
  const state = { clipboard: 'previous clipboard', selected: '', commands: [], focused: false };
  const scratch = {
    value: '',
    focus() { state.focused = true; },
    select() { state.selected = this.value; },
  };
  let listener;
  runInNewContext(source, {
    chrome: { runtime: { onMessage: { addListener(fn) { listener = fn; } } } },
    document: {
      getElementById: () => scratch,
      execCommand(command) {
        state.commands.push(command);
        if (result instanceof Error) throw result;
        if (result) state.clipboard = state.selected;
        return result;
      },
    },
  });
  return {
    state,
    scratch,
    send(message) {
      let response;
      listener(message, {}, (value) => { response = value; });
      return response;
    },
  };
}

const copyMessage = (text) => ({ target: 'url-copier-offscreen', type: 'copy', text });

test('copies the complete URL as plain text and clears the selection buffer', () => {
  const context = clipboardContext();
  const url = 'https://example.com/문서?q=hello%20world&utm_source=x&next=%2Fa%3Fb#섹션';

  assert.equal(context.send(copyMessage(url)).ok, true);
  assert.equal(context.state.clipboard, url);
  assert.equal(context.state.selected, url);
  assert.equal(context.state.focused, true);
  assert.deepEqual(context.state.commands, ['copy']);
  assert.equal(context.scratch.value, '');
});

test('ignores messages addressed to other contexts or operations', () => {
  const context = clipboardContext();
  for (const message of [undefined, {}, { ...copyMessage('https://example.com/'), target: 'other' },
    { ...copyMessage('https://example.com/'), type: 'ping' }]) {
    assert.equal(context.send(message), undefined);
  }
  assert.equal(context.state.clipboard, 'previous clipboard');
  assert.deepEqual(context.state.commands, []);
});

test('rejects empty or invalid text without replacing the clipboard', () => {
  const context = clipboardContext();
  for (const text of ['', undefined, null, 42, {}]) {
    assert.equal(context.send(copyMessage(text)).ok, false);
  }
  assert.equal(context.state.clipboard, 'previous clipboard');
  assert.deepEqual(context.state.commands, []);
  assert.equal(context.scratch.value, '');
});

for (const result of [false, new Error('Clipboard unavailable')]) {
  test(`reports ${result === false ? 'an unsuccessful' : 'a throwing'} clipboard write and clears the buffer`, () => {
    const context = clipboardContext(result);
    assert.equal(context.send(copyMessage('https://example.com/')).ok, false);
    assert.equal(context.state.clipboard, 'previous clipboard');
    assert.equal(context.scratch.value, '');
  });
}
