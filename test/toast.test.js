import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { showCopyToast } from '../src/lib/toast.js';

function page(withBody = true) {
  const timers = [];
  const element = (tag) => ({
    tag, children: [], attributes: {}, style: {}, parent: null,
    append(...nodes) {
      for (const node of nodes) {
        node.parent = this;
        this.children.push(node);
      }
    },
    appendChild(node) { this.append(node); },
    remove() {
      if (!this.parent) return;
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
      this.parent = null;
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    attachShadow(options) {
      this.shadow = { ...element('shadow-root'), mode: options.mode };
      return this.shadow;
    },
  });
  const container = element(withBody ? 'body' : 'html');
  const document = {
    body: withBody ? container : null,
    documentElement: container,
    getElementById: (id) => container.children.find((node) => node.id === id),
    createElement: element,
    createTextNode: (textContent) => ({ textContent }),
  };
  return {
    container,
    timers,
    show(message, ok) {
      // executeScript serialises only the function, without its module scope.
      runInNewContext(`(${showCopyToast.toString()})(message, ok)`, {
        document, message, ok,
        setTimeout: (callback, delay) => timers.push({ callback, delay }),
      });
      return container.children[0];
    },
  };
}

test('the serialised toast displays an accessible confirmation without blocking clicks', () => {
  const context = page();
  const host = context.show('주소가 복사되었습니다', true);
  const [, toast] = host.shadow.children;
  assert.equal(host.shadow.mode, 'closed');
  assert.match(host.style.cssText, /pointer-events:\s*none\s*!important/);
  assert.match(host.style.cssText, /right:\s*20px\s*!important/);
  assert.match(host.style.cssText, /bottom:\s*20px\s*!important/);
  assert.equal(toast.attributes.role, 'status');
  assert.equal(toast.attributes['aria-live'], 'polite');
  assert.equal(toast.children[0].textContent, '✓');
  assert.equal(toast.children[0].attributes['aria-hidden'], 'true');
  assert.equal(toast.children[1].textContent, '주소가 복사되었습니다');
});

test('repeated copies replace the toast and an older timer cannot dismiss the new one', () => {
  const context = page();
  const oldHost = context.show('First copy', true);
  const newHost = context.show('Second copy', true);
  assert.notEqual(oldHost, newHost);
  assert.deepEqual(context.container.children, [newHost]);
  assert.equal(oldHost.parent, null);

  context.timers[0].callback();
  assert.deepEqual(context.container.children, [newHost]);
  assert.equal(context.timers[1].delay, 1800);
  context.timers[1].callback();
  assert.deepEqual(context.container.children, []);
});

test('failure text is shown with a failure icon even before the page has a body', () => {
  const context = page(false);
  const host = context.show('주소를 복사하지 못했습니다', false);
  const [style, toast] = host.shadow.children;
  assert.equal(host.parent, context.container);
  assert.equal(toast.children[0].textContent, '!');
  assert.equal(toast.children[1].textContent, '주소를 복사하지 못했습니다');
  assert.match(style.textContent, /background:\s*#8c1d18/);
});
