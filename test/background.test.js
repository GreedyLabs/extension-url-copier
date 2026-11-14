import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createChromeStub } from './helpers/chrome-stub.js';

const stub = createChromeStub();
globalThis.chrome = stub.chrome;
const TAB = { id: 7, url: 'https://example.com/a?utm_source=x&b=1#section', title: 'A page' };

before(async () => {
  await import('../src/background.js');
});
beforeEach(() => stub.reset());

async function runCommand(tab = TAB, command = '1-copy-primary') {
  stub.dispatch('commands.onCommand', command, tab);
  await stub.settle();
}
const copiedText = () => stub.lastCall('runtime.sendMessage')?.args[0]?.text;
const badge = () => stub.lastCall('action.setBadgeText')?.args[0]?.text;

test('the existing shortcut copies only the exact URL and releases the clipboard document', async () => {
  await runCommand();
  assert.deepEqual(stub.lastCall('runtime.sendMessage').args[0], {
    target: 'url-copier-offscreen', type: 'copy', text: TAB.url,
  });
  assert.equal(badge(), '✓');
  assert.equal(stub.state.offscreenOpen, false);
  assert.equal(stub.callsTo('offscreen.closeDocument').length, 1);
});

test('the event tab wins over the currently active tab', async () => {
  stub.state.tabs = [{ id: 99, url: 'https://other.test/' }];
  await runCommand();
  assert.equal(stub.callsTo('tabs.query').length, 0);
  assert.equal(copiedText(), TAB.url);
});

test('the active tab is queried when the command has no tab', async () => {
  stub.state.tabs = [TAB];
  await runCommand(null);
  assert.deepEqual(stub.lastCall('tabs.query').args[0], { active: true, lastFocusedWindow: true });
  assert.equal(copiedText(), TAB.url);
});

test('an event tab without a URL is re-read by ID instead of copying another tab', async () => {
  stub.state.tabs = [{ id: 99, url: 'https://other.test/' }, TAB];
  await runCommand({ id: TAB.id });
  assert.deepEqual(stub.lastCall('tabs.get').args, [TAB.id]);
  assert.equal(stub.callsTo('tabs.query').length, 0);
  assert.equal(copiedText(), TAB.url);
});

test('Chrome pages and the Web Store copy without page injection', async () => {
  for (const url of ['chrome://settings/', 'https://chromewebstore.google.com/detail/abc',
    'https://chrome.google.com/webstore/detail/abc']) {
    await runCommand({ ...TAB, url });
    assert.equal(copiedText(), url);
    assert.equal(badge(), '✓');
  }
  assert.equal(stub.callsTo('scripting.executeScript').length, 0);
});

test('a copy shows translated confirmation in the copied tab', async () => {
  await runCommand();
  const injection = stub.lastCall('scripting.executeScript').args[0];
  assert.deepEqual(injection.target, { tabId: TAB.id });
  assert.deepEqual(injection.args, [stub.chrome.i18n.getMessage('feedbackCopied'), true]);
});

test('toast injection failure preserves a successful copy', async () => {
  stub.state.scriptingError = true;
  await runCommand();
  assert.equal(copiedText(), TAB.url);
  assert.equal(badge(), '✓');
  assert.equal(stub.lastCall('action.setTitle').args[0].title,
    stub.chrome.i18n.getMessage('feedbackCopied'));
});

test('a missing URL leaves the clipboard alone and explains the failure', async () => {
  stub.state.tabs = [{ id: 99, url: 'https://other.test/' }, { id: TAB.id }];
  await runCommand({ id: TAB.id });
  assert.equal(stub.callsTo('runtime.sendMessage').length, 0);
  assert.equal(stub.callsTo('tabs.query').length, 0);
  assert.equal(badge(), '!');
  assert.equal(stub.lastCall('action.setTitle').args[0].title, stub.chrome.i18n.getMessage('feedbackNoUrl'));
});

test('a rejected tab query reports a copy failure', async () => {
  stub.state.queryError = true;
  await runCommand(null);
  assert.equal(stub.callsTo('runtime.sendMessage').length, 0);
  assert.equal(badge(), '!');
});

test('feedback is scoped to the copied tab', async () => {
  await runCommand();
  assert.deepEqual(stub.lastCall('action.setBadgeText').args[0], { tabId: TAB.id, text: '✓' });
  assert.equal(stub.lastCall('action.setTitle').args[0].tabId, TAB.id);
});

test('a stale clipboard document is rebuilt and retried once', async () => {
  stub.state.offscreenOpen = true;
  stub.state.sendReplies = [null, { ok: true }];
  await runCommand();
  assert.equal(stub.callsTo('runtime.sendMessage').length, 2);
  assert.equal(stub.callsTo('offscreen.createDocument').length, 1);
  assert.equal(stub.state.offscreenOpen, false);
  assert.equal(badge(), '✓');
});

test('an unreachable clipboard document stops after one retry', async () => {
  stub.state.clipboardReply = null;
  await runCommand();
  assert.equal(stub.callsTo('runtime.sendMessage').length, 2);
  assert.equal(stub.state.offscreenOpen, false);
  assert.equal(badge(), '!');
});

test('a failed write closes the document and does not poison the next copy', async () => {
  stub.state.clipboardReply = { ok: false };
  await runCommand();
  assert.equal(badge(), '!');
  assert.match(stub.lastCall('action.setTitle').args[0].title, /Couldn't copy/);
  assert.deepEqual(stub.lastCall('scripting.executeScript').args[0].args,
    [stub.chrome.i18n.getMessage('feedbackCopyFailed'), false]);
  assert.equal(stub.state.offscreenOpen, false);

  stub.state.clipboardReply = { ok: true };
  await runCommand();
  assert.equal(badge(), '✓');
});

test('a failed document creation does not poison later writes', async () => {
  stub.state.createError = true;
  await runCommand();
  assert.equal(badge(), '!');
  assert.equal(stub.callsTo('runtime.sendMessage').length, 0);

  stub.state.createError = false;
  await runCommand();
  assert.equal(copiedText(), TAB.url);
  assert.equal(badge(), '✓');
});

test('rapid shortcuts wait for the previous write before closing its document', async () => {
  let release;
  stub.state.sendGate = new Promise((resolve) => { release = resolve; });
  stub.dispatch('commands.onCommand', '1-copy-primary', TAB);
  stub.dispatch('commands.onCommand', '1-copy-primary', { ...TAB, url: 'https://second.test/' });
  await stub.settle();
  assert.equal(stub.callsTo('runtime.sendMessage').length, 1);
  assert.equal(stub.callsTo('offscreen.closeDocument').length, 0);

  release();
  await stub.settle();
  assert.deepEqual(stub.callsTo('runtime.sendMessage').map((call) => call.args[0].text), [
    TAB.url, 'https://second.test/',
  ]);
  assert.equal(stub.callsTo('offscreen.closeDocument').length, 2);
  assert.equal(stub.state.offscreenOpen, false);
});

test('removed commands do not touch the clipboard', async () => {
  for (const command of ['2-copy-secondary', '3-copy-title-url', '4-copy-window-tabs', 'unknown']) {
    await runCommand(TAB, command);
  }
  assert.equal(stub.state.calls.length, 0);
});

test('the toolbar button opens Chrome shortcut settings', async () => {
  stub.dispatch('action.onClicked', TAB);
  await stub.settle();
  assert.deepEqual(stub.lastCall('tabs.create').args[0], { url: 'chrome://extensions/shortcuts' });
  assert.equal(stub.callsTo('runtime.sendMessage').length, 0);
});
