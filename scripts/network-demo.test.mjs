import test from 'node:test';
import { routeWire } from '../src/lib/network-geometry.mjs';
import assert from 'node:assert/strict';
import { DURATION, NODES, LINKS, STEPS, FLOWS, readyCount, metricAt, walletBalances, phaseAt, receiptAt } from '../src/lib/network-demo.mjs';

test('the cell is ready before funding and every payment uses a built connection', () => {
  assert.equal(new Set(NODES.map((node) => node.id)).size, 8);
  const funding = STEPS.find((step) => step.title === 'Fund the channels');
  assert.equal(readyCount(funding.start), 8);
  for (const flow of FLOWS) {
    const link = LINKS.find((link) => link.id === flow.link);
    assert.ok(link, flow.id + ' has a route');
    for (const id of [link.from, link.to]) {
      const node = NODES.find((node) => node.id === id);
      assert.ok(node, id + ' exists');
      assert.ok(node.birth + 1_500 < flow.start, flow.id + ' waits for ' + id);
    }
  }
});

test('receipts and wallet balances change at arrival, not when the agent submits a tool call', () => {
  const issued = FLOWS.find((flow) => flow.id === 'issue-alice');
  const arrived = issued.start + issued.duration;
  assert.equal(walletBalances(arrived - 1).alice, 0);
  assert.equal(walletBalances(arrived).alice, 1_000);
  const transfer = FLOWS.find((flow) => flow.id === 'send-ecash');
  const received = transfer.start + transfer.duration;
  assert.deepEqual(walletBalances(received - 1), { alice: 1_000, bob: 500 });
  assert.deepEqual(walletBalances(received), { alice: 750, bob: 750 });
  assert.equal(receiptAt(received - 1).label, 'Sending 250 sat');
  assert.equal(receiptAt(received).label, '250 sat received');
  for (let time = 24_200; time <= DURATION; time += 50) {
    const balances = walletBalances(time);
    assert.equal(balances.alice + balances.bob, 1_500);
  }
});

test('seeking backwards recomputes the complete scene without stale ready states or balances', () => {
  for (const time of [DURATION, 27_000, 4_000, 24_500, 0, 15_000, DURATION]) {
    assert.equal(readyCount(time), NODES.filter((node) => node.birth + 1_500 <= time).length);
    assert.equal(metricAt('alice', time), walletBalances(time).alice.toLocaleString('en-US') + ' sat');
  }
  assert.equal(phaseAt(0), 'Start with a prompt');
  assert.equal(phaseAt(DURATION), 'Complete');
  assert.equal(readyCount(0), 0);
  assert.equal(readyCount(DURATION), 8);
  assert.deepEqual(walletBalances(0), { alice: 0, bob: 0 });
});

test('single-column connections stay inside the canvas and outside intervening cards', () => {
  for (const scale of [1, 2]) {
    const boardWidth = 248 * scale;
    const positions = new Map(NODES.map((node, index) => [node.id, {
      x: 20 * scale, y: (20 + index * 166) * scale, width: 208 * scale, height: 130 * scale,
    }]));
    for (const link of LINKS) {
      const from = positions.get(link.from);
      const to = positions.get(link.to);
      const otherCards = [...positions].filter(([id]) => id !== link.from && id !== link.to).map(([, rect]) => rect);
      const blocked = otherCards.some((rect) => rect.y > from.y && rect.y < to.y);
      const left = NODES.find((node) => node.id === link.from).compactColumn === 1;
      const rail = blocked ? (left ? 10 * scale : boardWidth - 10 * scale) : null;
      const { curves } = routeWire(from, to, rail);
      for (const curve of curves) {
        const minX = Math.min(...curve.map(([x]) => x));
        const maxX = Math.max(...curve.map(([x]) => x));
        const minY = Math.min(...curve.map(([, y]) => y));
        const maxY = Math.max(...curve.map(([, y]) => y));
        assert.ok(minX >= 0 && maxX <= boardWidth, link.id + ' remains inside the canvas');
        for (const card of otherCards) {
          const intersects = minX < card.x + card.width && maxX > card.x && minY < card.y + card.height && maxY > card.y;
          assert.equal(intersects, false, link.id + ' avoids unrelated cards');
        }
      }
    }
  }
});
