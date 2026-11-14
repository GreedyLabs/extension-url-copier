import { readFileSync } from 'node:fs';

const messages = JSON.parse(
  readFileSync(new URL('../../_locales/en/messages.json', import.meta.url), 'utf8'),
);

export function createChromeStub() {
  const listeners = new Map();
  const state = {};
  const reset = () => Object.assign(state, {
    calls: [],
    offscreenOpen: false,
    clipboardReply: { ok: true },
    sendReplies: [],
    tabs: [],
    queryError: false,
    createError: false,
    sendGate: null,
    scriptingError: false,
  });
  reset();

  const record = (api, args) => state.calls.push({ api, args });
  const event = (name) => ({
    addListener: (listener) => listeners.set(name, listener),
  });

  const chrome = {
    i18n: { getMessage: (key) => messages[key]?.message ?? '' },
    runtime: {
      getURL: (path) => `chrome-extension://stub/${path}`,
      getContexts: async (filter) => {
        record('runtime.getContexts', [filter]);
        return state.offscreenOpen ? [{ contextType: 'OFFSCREEN_DOCUMENT' }] : [];
      },
      sendMessage: async (message) => {
        record('runtime.sendMessage', [message]);
        if (state.sendGate) await state.sendGate;
        if (!state.offscreenOpen) throw new Error('No clipboard document.');
        const reply = state.sendReplies.length ? state.sendReplies.shift() : state.clipboardReply;
        if (reply === null) throw new Error('Receiving end does not exist.');
        return reply;
      },
    },
    offscreen: {
      createDocument: async (options) => {
        record('offscreen.createDocument', [options]);
        if (state.createError) throw new Error('Cannot create clipboard document.');
        if (state.offscreenOpen) throw new Error('Document already exists.');
        state.offscreenOpen = true;
      },
      closeDocument: async () => {
        record('offscreen.closeDocument', []);
        state.offscreenOpen = false;
      },
    },
    commands: { onCommand: event('commands.onCommand') },
    scripting: {
      executeScript: async (injection) => {
        record('scripting.executeScript', [injection]);
        if (state.scriptingError) throw new Error('Cannot access this page.');
        return [{ result: undefined }];
      },
    },
    action: {
      onClicked: event('action.onClicked'),
      setBadgeText: async (details) => record('action.setBadgeText', [details]),
      setBadgeBackgroundColor: async (details) => record('action.setBadgeBackgroundColor', [details]),
      setTitle: async (details) => record('action.setTitle', [details]),
    },
    tabs: {
      get: async (tabId) => {
        record('tabs.get', [tabId]);
        const tab = state.tabs.find((item) => item.id === tabId);
        if (!tab) throw new Error('Tab not found.');
        return tab;
      },
      query: async (query) => {
        record('tabs.query', [query]);
        if (state.queryError) throw new Error('No active window.');
        return state.tabs;
      },
      create: async (options) => record('tabs.create', [options]),
    },
  };

  const dispatch = (name, ...args) => {
    if (!listeners.has(name)) throw new Error(`Missing listener: ${name}`);
    return listeners.get(name)(...args);
  };
  const settle = async () => {
    // All API responses in this stub resolve within the current event-loop turn.
    await new Promise((resolve) => setImmediate(resolve));
  };
  const callsTo = (api) => state.calls.filter((call) => call.api === api);
  const lastCall = (api) => callsTo(api).at(-1);

  return { chrome, state, dispatch, settle, reset, callsTo, lastCall };
}
