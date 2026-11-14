/**
 * Guards the manifest rules that fail *silently* or fail at install time — the
 * ones you would otherwise only discover by loading the extension by hand.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

const exists = (relative) => existsSync(join(root, relative));

test('every file the manifest points at exists', () => {
  const referenced = [
    manifest.background.service_worker,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ];
  for (const path of referenced) {
    assert.ok(exists(path), `missing ${path}`);
  }
});

test('at most four commands carry a suggested_key', () => {
  // Chromium's kMaxCommandsWithKeybindingPerExtension is 4 and exceeding it is a
  // hard manifest load error, not a silent drop.
  const bound = Object.values(manifest.commands).filter((c) => c.suggested_key);
  assert.ok(bound.length <= 4, `${bound.length} commands have a suggested_key`);
});

test('every command has a description', () => {
  for (const [name, command] of Object.entries(manifest.commands)) {
    assert.ok(command.description, `${name} has no description`);
  }
});

test('mac-only modifier tokens never appear outside a "mac" section', () => {
  // `Command`, `Option` and `MacCtrl` in `default`/`windows`/`linux` are a hard
  // parse error: the extension refuses to install.
  for (const [name, command] of Object.entries(manifest.commands)) {
    const keys = command.suggested_key;
    if (!keys) continue;
    for (const [platform, combo] of Object.entries(keys)) {
      if (platform === 'mac') continue;
      for (const token of ['Command', 'Option', 'MacCtrl']) {
        assert.ok(!combo.includes(token), `${name}.${platform} uses "${token}"`);
      }
    }
  }
});

test('no suggested shortcut collides with the DevTools inspect accelerator', () => {
  // Cmd+Shift+C (mac) / Ctrl+Shift+C (win, linux) is hard-coded to
  // IDC_DEV_TOOLS_INSPECT, so CommandService::CanAutoAssign refuses to bind it and
  // the extension installs with no shortcut at all — silently, with no warning.
  const reserved = {
    mac: ['Command+Shift+C', 'Ctrl+Shift+C', 'Command+Alt+C', 'Ctrl+Alt+C'],
    default: ['Ctrl+Shift+C'],
    windows: ['Ctrl+Shift+C'],
    linux: ['Ctrl+Shift+C'],
    chromeos: ['Ctrl+Shift+C'],
  };
  for (const [name, command] of Object.entries(manifest.commands)) {
    for (const [platform, combo] of Object.entries(command.suggested_key ?? {})) {
      assert.ok(
        !(reserved[platform] ?? []).includes(combo),
        `${name}.${platform} = ${combo} would be silently dropped by Chrome`,
      );
    }
  }
});

test('suggested shortcuts use a modifier combination Chrome accepts', () => {
  for (const [name, command] of Object.entries(manifest.commands)) {
    for (const [platform, combo] of Object.entries(command.suggested_key ?? {})) {
      const tokens = combo.split('+');
      const where = `${name}.${platform}`;
      assert.ok(tokens.length <= 3, `${where}: at most two modifiers plus one key`);

      const modifiers = tokens.slice(0, -1);
      assert.ok(modifiers.length > 0, `${where}: a modifier is required`);
      assert.ok(
        modifiers.some((m) => m !== 'Shift'),
        `${where}: Shift alone is not a sufficient modifier`,
      );
      const hasAlt = modifiers.includes('Alt') || modifiers.includes('Option');
      const hasCtrlLike = modifiers.includes('Ctrl') || modifiers.includes('Command');
      assert.ok(!(hasAlt && hasCtrlLike), `${where}: Ctrl+Alt / Cmd+Opt is rejected`);
    }
  }
});

test('exposes only the existing URL copy command and Chrome-owned shortcut settings', () => {
  assert.deepEqual(Object.keys(manifest.commands), ['1-copy-primary']);
  assert.equal(manifest.options_ui, undefined);
  assert.equal(manifest.options_page, undefined);
  assert.equal(manifest.action.default_popup, undefined);
});

test('requests only the permissions needed to copy the current URL and show feedback', () => {
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.permissions, ['activeTab', 'clipboardWrite', 'offscreen', 'scripting']);
  assert.equal(manifest.optional_permissions, undefined);
});

test('minimum_chrome_version covers runtime.getContexts', () => {
  // getContexts (used to detect an existing offscreen document) landed in 116.
  assert.ok(Number(manifest.minimum_chrome_version) >= 116);
});
