import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as model from '../src/lib/network-demo.mjs';
import { routeWire } from '../src/lib/network-geometry.mjs';

const controller = ts.transpileModule(
  readFileSync(new URL('../src/scripts/network-demo.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, ''),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText;

// Run the actual controller against a small DOM/event/clock fixture. Geometry
// has separate tests; this fixture checks playback and accessibility behavior.
function demo(reduce = false) {
  const elements = new Map();
  const frameQueue = new Map();
  let id = 0;
  let now = 100;
  let intersection;
  const element = (selector) => {
    if (elements.has(selector)) return elements.get(selector);
    const listeners = new Map();
    const attributes = new Map();
    const value = {
      dataset: {}, textContent: '', value: '', hidden: true,
      clientWidth: 640, clientHeight: 400, offsetWidth: 120, offsetHeight: 120,
      offsetLeft: 0, offsetTop: 0, offsetParent: null,
      style: { setProperty() {} },
      setAttribute(name, content) { attributes.set(name, content); },
      getAttribute(name) { return attributes.get(name); },
      addEventListener(name, callback) { listeners.set(name, callback); },
      fire(name) { listeners.get(name)?.(); },
      querySelector(child) { return element(selector + ' ' + child); },
      getTotalLength() { return 100; },
      getPointAtLength(distance) { return { x: distance, y: 0 }; },
    };
    elements.set(selector, value);
    return value;
  };
  const root = element('root');
  root.querySelector = element;
  const document = element('document');
  document.hidden = false;
  document.querySelector = () => root;
  document.fonts = { ready: Promise.resolve() };
  const media = element('media');
  media.matches = reduce;
  const board = element('[data-network-board]');
  for (const node of model.NODES) {
    const card = element('[data-node="' + node.id + '"]');
    card.offsetParent = board;
    card.offsetLeft = (node.column - 1) * 160;
    card.offsetTop = (node.row - 1) * 200;
  }
  vm.runInNewContext(controller, {
    ...model, routeWire, document, matchMedia: () => media,
    requestAnimationFrame(callback) { frameQueue.set(++id, callback); return id; },
    cancelAnimationFrame(frame) { frameQueue.delete(frame); },
    IntersectionObserver: class { constructor(callback) { intersection = callback; } observe() {} },
    ResizeObserver: class { observe() {} },
  });
  return {
    element, document, media,
    frames: () => frameQueue.size,
    position: () => Number(element('[data-demo-progress]').value),
    visible(value) { intersection([{ isIntersecting: value }]); },
    advance(milliseconds) {
      for (let time = 0; time < milliseconds; time += 100) {
        now += 100;
        const callbacks = [...frameQueue.values()];
        frameQueue.clear();
        callbacks.forEach((callback) => callback(now));
      }
    },
  };
}

test('reduced motion starts complete without a running clock and still permits explicit replay', () => {
  const page = demo(true);
  assert.equal(page.position(), model.DURATION);
  assert.equal(page.frames(), 0);
  assert.equal(page.element('[data-demo-controls]').hidden, false);
  assert.equal(page.element('[data-demo-play]').getAttribute('aria-label'), 'Play animation');
  for (const node of model.NODES) assert.equal(page.element('[data-node="' + node.id + '"]').dataset.nodeReady, 'true');
  page.visible(true);
  assert.equal(page.frames(), 0);
  page.element('[data-demo-replay]').fire('click');
  page.advance(1_000);
  assert.ok(page.position() > 0 && page.position() < 1_000);
  page.media.fire('change');
  assert.equal(page.position(), model.DURATION);
  assert.equal(page.frames(), 0);
});

test('pause, backgrounding, and leaving the viewport preserve the shared playback position', () => {
  const page = demo();
  page.advance(1_000);
  assert.equal(page.position(), 0);
  page.visible(true);
  page.advance(3_000);
  const beforePause = page.position();
  page.element('[data-demo-play]').fire('click');
  page.advance(2_000);
  assert.equal(page.position(), beforePause);
  page.element('[data-demo-play]').fire('click');
  page.advance(500);
  assert.ok(page.position() > beforePause);
  for (const source of ['viewport', 'document']) {
    const before = page.position();
    if (source === 'viewport') page.visible(false);
    else { page.document.hidden = true; page.document.fire('visibilitychange'); }
    page.advance(10_000);
    assert.equal(page.position(), before);
    if (source === 'viewport') page.visible(true);
    else { page.document.hidden = false; page.document.fire('visibilitychange'); }
    page.advance(200);
    assert.equal(page.position(), before + 100);
  }
});

test('scrubbing pauses playback, rewinds balances, and replay resets both screens', () => {
  const page = demo();
  page.visible(true);
  const slider = page.element('[data-demo-progress]');
  slider.value = '28000';
  slider.fire('input');
  assert.equal(page.frames(), 0);
  assert.equal(page.element('[data-node="alice"] [data-node-metric]').textContent, '750 sat');
  assert.equal(page.element('[data-receipt-label]').textContent, '250 sat received');
  slider.value = '27000';
  slider.fire('input');
  assert.equal(page.element('[data-node="alice"] [data-node-metric]').textContent, '1,000 sat');
  assert.equal(page.element('[data-receipt-label]').textContent, 'Sending 250 sat');
  page.element('[data-demo-replay]').fire('click');
  assert.equal(page.position(), 0);
  assert.equal(page.element('[data-prompt-text]').textContent, '');
  assert.equal(page.element('[data-cell-status-text]').textContent, '0 / 8 ready');
});
