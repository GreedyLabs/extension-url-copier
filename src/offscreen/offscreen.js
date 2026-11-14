'use strict';

// A DOM clipboard context keeps URL copying compatible with Chrome 116+.
const scratch = document.getElementById('scratch');

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'url-copier-offscreen' || message.type !== 'copy') return;
  if (typeof message.text !== 'string' || !message.text) {
    sendResponse({ ok: false });
    return;
  }

  try {
    scratch.value = message.text;
    scratch.focus();
    scratch.select();
    sendResponse({ ok: document.execCommand('copy') });
  } catch {
    sendResponse({ ok: false });
  } finally {
    scratch.value = '';
  }
});
