import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(join(root, relative), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const locales = readdirSync(join(root, '_locales'));
const messages = Object.fromEntries(
  locales.map((locale) => [locale, JSON.parse(read(`_locales/${locale}/messages.json`))]),
);
const sources = ['src/background.js', 'src/lib/i18n.js', 'src/offscreen/offscreen.js'];

test('the default locale and Korean translations are available', () => {
  assert.ok(messages[manifest.default_locale], 'default locale is missing');
  assert.ok(messages.ko, 'Korean locale is missing');
});

test('every locale defines the same nonempty messages', () => {
  const baseKeys = Object.keys(messages[manifest.default_locale]).sort();
  for (const [locale, table] of Object.entries(messages)) {
    assert.deepEqual(Object.keys(table).sort(), baseKeys, `${locale} message keys differ`);
    for (const [key, entry] of Object.entries(table)) {
      assert.equal(typeof entry.message, 'string', `${locale}.${key} has no message`);
      assert.ok(entry.message.trim(), `${locale}.${key} is empty`);
    }
  }
});

test('every manifest and source message reference resolves in every locale', () => {
  const keys = [
    ...[...JSON.stringify(manifest).matchAll(/__MSG_([A-Za-z0-9_]+)__/g)].map((match) => match[1]),
    ...sources.flatMap((file) =>
      [...read(file).matchAll(/(?<![\w$.])t\(\s*'([A-Za-z0-9_]+)'/g)].map((match) => match[1]),
    ),
  ];
  for (const [locale, table] of Object.entries(messages)) {
    for (const key of keys) assert.ok(table[key], `${locale} is missing message "${key}"`);
  }
});

test('all shipped messages are used by the extension', () => {
  const text = [JSON.stringify(manifest), ...sources.map(read)].join('\n');
  for (const key of Object.keys(messages[manifest.default_locale])) {
    assert.ok(text.includes(`__MSG_${key}__`) || text.includes(`t('${key}')`), `unused message "${key}"`);
  }
});
