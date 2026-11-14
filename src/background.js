import { t } from './lib/i18n.js';
import { showCopyToast } from './lib/toast.js';

const OFFSCREEN_PATH = 'src/offscreen/offscreen.html';
const OFFSCREEN_TARGET = 'url-copier-offscreen';
// Preserve the command ID so existing Chrome shortcut assignments keep working.
const COPY_COMMAND = '1-copy-primary';

// Serialise writes so one copy cannot close another copy's clipboard document.
let clipboardQueue = Promise.resolve();

async function hasOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)],
  });
  return contexts.length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['CLIPBOARD'],
      justification: t('offscreenJustification'),
    });
  } catch (error) {
    if (!(await hasOffscreen())) throw error;
  }
}

async function closeOffscreen() {
  try {
    await chrome.offscreen.closeDocument();
  } catch {
    // The document may already have been closed by Chrome.
  }
}

async function sendToOffscreen(text) {
  try {
    return await chrome.runtime.sendMessage({ target: OFFSCREEN_TARGET, type: 'copy', text });
  } catch {
    return null;
  }
}

function writeClipboard(text) {
  clipboardQueue = clipboardQueue.then(async () => {
    try {
      await ensureOffscreen();
      let result = await sendToOffscreen(text);
      if (!result) {
        // Rebuild once if Chrome removed the document before the message arrived.
        await closeOffscreen();
        await ensureOffscreen();
        result = await sendToOffscreen(text);
      }
      return result?.ok === true;
    } catch {
      return false;
    } finally {
      await closeOffscreen();
    }
  });
  return clipboardQueue;
}

async function showToast(tab, ok, message) {
  if (typeof tab?.id !== 'number' || !/^https?:\/\//i.test(tab.url || '')) return;
  try {
    const { hostname, pathname } = new URL(tab.url);
    if (hostname === 'chromewebstore.google.com' ||
        (hostname === 'chrome.google.com' && pathname.startsWith('/webstore'))) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showCopyToast,
      args: [message, ok],
    });
  } catch {
    // Restricted pages and navigation can block the toast without affecting copy.
  }
}

async function reportOnIcon(tab, ok, message) {
  const scope = typeof tab?.id === 'number' ? { tabId: tab.id } : {};
  try {
    await chrome.action.setBadgeBackgroundColor({ ...scope, color: ok ? '#137333' : '#c5221f' });
    await chrome.action.setBadgeText({ ...scope, text: ok ? '✓' : '!' });
    await chrome.action.setTitle({ ...scope, title: message });
    setTimeout(() => {
      void chrome.action.setBadgeText({ ...scope, text: '' }).catch(() => {});
      void chrome.action.setTitle({ ...scope, title: t('actionTitle') }).catch(() => {});
    }, 1500);
  } catch {
    // The tab may have closed while the clipboard write was running.
  }
}

async function report(tab, ok, message) {
  await Promise.all([reportOnIcon(tab, ok, message), showToast(tab, ok, message)]);
}

async function copyCurrentTab(candidate) {
  let tab = candidate;
  try {
    if (!tab?.url) {
      if (typeof tab?.id === 'number') {
        tab = await chrome.tabs.get(tab.id);
      } else {
        [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      }
    }
    if (!tab?.url) {
      await report(tab, false, t('feedbackNoUrl'));
      return;
    }
    const ok = await writeClipboard(tab.url);
    await report(tab, ok, ok ? t('feedbackCopied') : t('feedbackCopyFailed'));
  } catch {
    await report(tab, false, t('feedbackCopyFailed'));
  }
}

// Register listeners synchronously so Chrome can deliver events to a cold worker.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === COPY_COMMAND) void copyCurrentTab(tab);
});

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }).catch(() => {});
});
