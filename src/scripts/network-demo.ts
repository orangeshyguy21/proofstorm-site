import { routeWire } from '../lib/network-geometry.mjs';
import { DURATION, PROMPT, NODES, LINKS, STEPS, FLOWS, clamp, ease, progress, phaseAt, readyCount, metricAt, receiptAt } from '../lib/network-demo.mjs';

const root = document.querySelector<HTMLElement>('[data-network-demo]');

if (root) {
  const within = <T extends Element>(selector: string) => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error('Missing network demo element: ' + selector);
    return element;
  };
  const board = within<HTMLElement>('[data-network-board]');
  const agentPane = within<HTMLElement>('.agent-pane');
  const stage = within<HTMLElement>('.network-demo-stage');
  const mcpPacket = within<HTMLElement>('[data-mcp-packet]');
  const svg = within<SVGSVGElement>('[data-network-wires]');
  const prompt = within<HTMLElement>('[data-prompt-text]');
  const empty = within<HTMLElement>('[data-network-empty]');
  const agentStatus = within<HTMLElement>('[data-agent-status]');
  const done = within<HTMLElement>('[data-agent-done]');
  const cellStatus = within<HTMLElement>('[data-cell-status]');
  const cellStatusText = within<HTMLElement>('[data-cell-status-text]');
  const receipt = within<HTMLElement>('.network-receipt');
  const receiptLabel = within<HTMLElement>('[data-receipt-label]');
  const receiptDetail = within<HTMLElement>('[data-receipt-detail]');
  const play = within<HTMLButtonElement>('[data-demo-play]');
  const replay = within<HTMLButtonElement>('[data-demo-replay]');
  const slider = within<HTMLInputElement>('[data-demo-progress]');
  const phase = within<HTMLElement>('[data-demo-phase]');
  const timeLabel = within<HTMLElement>('[data-demo-time]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const nodes = NODES.map((data) => ({
    ...data,
    element: within<HTMLElement>('[data-node="' + data.id + '"]'),
    metric: within<HTMLElement>('[data-node="' + data.id + '"] [data-node-metric]'),
    arrival: within<HTMLElement>('[data-node="' + data.id + '"] [data-node-arrival]'),
  }));
  const links = LINKS.map((data) => ({
    ...data,
    path: within<SVGPathElement>('[data-link="' + data.id + '"]'),
    length: 0,
    birth: Math.max(NODES.find((node) => node.id === data.from)!.birth, NODES.find((node) => node.id === data.to)!.birth) + 350,
  }));
  const flows = FLOWS.map((data) => {
    const group = within<SVGGElement>('[data-flow="' + data.id + '"]');
    return {
      ...data, group,
      linkData: links.find((link) => link.id === data.link)!,
      trail: group.querySelector<SVGPathElement>('.payment-trail')!,
      aura: group.querySelector<SVGCircleElement>('.payment-aura')!,
      core: group.querySelector<SVGCircleElement>('.payment-core')!,
    };
  });
  const steps = STEPS.map((data, index) => ({
    ...data,
    element: within<HTMLElement>('[data-agent-step="' + index + '"]'),
    detailElement: within<HTMLElement>('[data-agent-step="' + index + '"] [data-step-detail]'),
  }));

  let elapsed = reducedMotion.matches ? DURATION : 0;
  let intentToPlay = !reducedMotion.matches;
  let visible = false;
  let frame = 0;
  let lastFrame = 0;

  function text(element: Element, value: string) {
    if (element.textContent !== value) element.textContent = value;
  }
  function seconds(value: number) {
    return '0:' + Math.floor(value / 1_000).toString().padStart(2, '0');
  }

  // Connections follow the actual card positions, including the two-column
  // mobile layout. Card transforms are excluded from geometry measurements.
  function layout() {
    stage.style.setProperty('--agent-height', agentPane.offsetHeight + 'px');
    const width = board.clientWidth;
    const height = board.clientHeight;
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    const positions = new Map(nodes.map((node) => {
      const element = node.element;
      let x = element.offsetLeft;
      let y = element.offsetTop;
      let parent = element.offsetParent as HTMLElement | null;
      while (parent && parent !== board) {
        x += parent.offsetLeft;
        y += parent.offsetTop;
        parent = parent.offsetParent as HTMLElement | null;
      }
      return [node.id, { x, y, width: element.offsetWidth, height: element.offsetHeight }];
    }));
    for (const link of links) {
      const from = positions.get(link.from)!;
      const to = positions.get(link.to)!;
      const fromCenter = from.y + from.height / 2;
      const toCenter = to.y + to.height / 2;
      const blocked = Math.abs(from.x - to.x) < 1 && [...positions].some(([id, position]) => {
        if (id === link.from || id === link.to) return false;
        const center = position.y + position.height / 2;
        return Math.abs(position.x - from.x) < 1 && center > Math.min(fromCenter, toCenter) && center < Math.max(fromCenter, toCenter);
      });
      const side = NODES.find((node) => node.id === link.from)!.compactColumn;
      const rail = !blocked ? null : side === 1 ? Math.max(4, from.x / 2) : Math.min(width - 4, (from.x + from.width + width) / 2);
      const d = routeWire(from, to, rail).path;
      link.path.setAttribute('d', d);
      link.length = link.path.getTotalLength();
      for (const flow of flows.filter((flow) => flow.link === link.id)) flow.trail.setAttribute('d', d);
    }
    render();
  }

  function render() {
    const complete = elapsed >= 29_000;
    if (root!.dataset.demoComplete !== String(complete)) root!.dataset.demoComplete = String(complete);
    const promptLength = Math.round(PROMPT.length * progress(elapsed, 300, 2_200));
    text(prompt, PROMPT.slice(0, promptLength));
    prompt.style.setProperty('--cursor-opacity', elapsed > 200 && elapsed < 2_800 ? String(.35 + .65 * Math.abs(Math.sin(elapsed / 150))) : '0');
    text(agentStatus, complete ? 'Done' : elapsed < 3_000 ? 'Waiting for prompt…' : elapsed < 5_500 ? 'Planning the cell…' : 'Running tools…');
    empty.style.opacity = String(1 - progress(elapsed, 5_400, 600));
    done.style.opacity = String(progress(elapsed, 29_000, 500));
    done.style.transform = 'translateY(' + (1 - ease(progress(elapsed, 29_000, 600))) * 5 + 'px)';

    for (const step of steps) {
      const state = elapsed >= step.end ? 'complete' : elapsed >= step.start ? 'active' : 'pending';
      if (step.element.dataset.state !== state) step.element.dataset.state = state;
      text(step.detailElement, state === 'complete' ? step.result : step.detail);
      const entered = ease(progress(elapsed, step.start, 400));
      step.element.style.opacity = String(entered);
      step.element.style.transform = 'translateY(' + (1 - entered) * 5 + 'px)';
    }
    // The MCP request crosses between the two independent screens before the
    // canvas acts. Responses travel back when each tool step completes.
    let exchange = 0;
    let exchangeOpacity = 0;
    for (const step of steps) {
      for (const [start, reverse] of [[step.start, false], [step.end - 600, true]] as const) {
        const p = (elapsed - start) / 350;
        if (p >= 0 && p <= 1) {
          exchange = reverse ? 1 - p : p;
          exchangeOpacity = Math.min(1, p * 8, (1 - p) * 8);
        }
      }
    }
    mcpPacket.style.setProperty('--exchange', exchange * 100 + '%');
    mcpPacket.style.opacity = String(exchangeOpacity);

    for (const node of nodes) {
      const entrance = ease(progress(elapsed, node.birth, 650));
      node.element.style.opacity = String(entrance);
      node.element.style.transform = 'translateY(' + (1 - entrance) * 9 + 'px) scale(' + (.96 + .04 * entrance) + ')';
      const ready = elapsed >= node.birth + 1_500;
      if (node.element.dataset.nodeReady !== String(ready)) node.element.dataset.nodeReady = String(ready);
      text(node.metric, ready ? metricAt(node.id, elapsed) : 'Starting…');
      let glow = 0;
      for (const flow of flows) {
        if (flow.linkData.to !== node.id) continue;
        const sinceArrival = elapsed - flow.start - flow.duration;
        if (sinceArrival >= 0 && sinceArrival < 950) glow = Math.max(glow, 1 - sinceArrival / 950);
      }
      node.arrival.style.opacity = String(glow * .75);
      node.arrival.style.transform = 'scale(' + (1 + (1 - glow) * .025) + ')';
    }
    for (const link of links) {
      const drawn = ease(progress(elapsed, link.birth, 900));
      link.path.style.strokeDashoffset = String(1 - drawn);
      link.path.style.opacity = String(drawn);
    }
    for (const flow of flows) {
      const p = (elapsed - flow.start) / flow.duration;
      const active = p >= 0 && p <= 1;
      flow.group.setAttribute('opacity', active ? String(Math.min(1, p * 10, (1 - p) * 10) * .95) : '0');
      if (!active || !flow.linkData.length) continue;
      const distance = clamp(p) * flow.linkData.length;
      const point = flow.linkData.path.getPointAtLength(distance);
      for (const circle of [flow.aura, flow.core]) {
        circle.setAttribute('cx', String(point.x));
        circle.setAttribute('cy', String(point.y));
      }
      const tail = Math.min(22, flow.linkData.length * .25);
      flow.trail.style.strokeDasharray = String(tail) + ' ' + String(flow.linkData.length + tail);
      flow.trail.style.strokeDashoffset = String(tail - distance);
    }

    const ready = readyCount(elapsed);
    if (cellStatus.dataset.ready !== String(ready === NODES.length)) cellStatus.dataset.ready = String(ready === NODES.length);
    text(cellStatusText, ready + ' / ' + NODES.length + ' ready');
    const currentReceipt = receiptAt(elapsed);
    if (receipt.dataset.receiptKind !== currentReceipt.kind) receipt.dataset.receiptKind = currentReceipt.kind;
    text(receiptLabel, currentReceipt.label);
    text(receiptDetail, currentReceipt.detail);
    const title = phaseAt(elapsed);
    text(phase, title);
    text(timeLabel, seconds(elapsed) + ' / ' + seconds(DURATION));
    slider.value = String(elapsed);
    slider.style.setProperty('--progress', elapsed / DURATION * 100 + '%');
    slider.setAttribute('aria-valuetext', title + ', ' + Math.floor(elapsed / 1_000) + ' of 32 seconds');
    const playing = intentToPlay && elapsed < DURATION;
    play.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
    play.title = play.getAttribute('aria-label')!;
    within<SVGElement>('[data-icon-pause]').setAttribute('data-hidden', String(!playing));
    within<SVGElement>('[data-icon-play]').setAttribute('data-hidden', String(playing));
  }

  function tick(now: number) {
    frame = 0;
    if (!intentToPlay || !visible || document.hidden) { lastFrame = 0; return; }
    if (lastFrame) elapsed = Math.min(DURATION, elapsed + Math.min(now - lastFrame, 100));
    lastFrame = now;
    render();
    if (elapsed < DURATION) frame = requestAnimationFrame(tick);
    else { intentToPlay = false; lastFrame = 0; render(); }
  }
  function schedule() {
    if (!frame && intentToPlay && visible && !document.hidden && elapsed < DURATION) frame = requestAnimationFrame(tick);
  }
  function stopClock() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
  }
  function restart() {
    elapsed = 0;
    intentToPlay = true;
    stopClock();
    render();
    schedule();
  }

  play.addEventListener('click', () => {
    if (elapsed >= DURATION) { restart(); return; }
    intentToPlay = !intentToPlay;
    stopClock();
    render();
    schedule();
  });
  replay.addEventListener('click', restart);
  slider.addEventListener('input', () => {
    intentToPlay = false;
    stopClock();
    elapsed = Number(slider.value);
    render();
  });

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    stopClock();
    schedule();
  }, { threshold: 0, rootMargin: '-32px 0px -64px 0px' });
  observer.observe(stage);
  document.addEventListener('visibilitychange', () => {
    stopClock();
    schedule();
  });
  reducedMotion.addEventListener('change', () => {
    stopClock();
    intentToPlay = false;
    elapsed = DURATION;
    render();
  });
  const resize = new ResizeObserver(layout);
  resize.observe(board);
  resize.observe(agentPane);
  for (const node of nodes) resize.observe(node.element);
  document.fonts.ready.then(layout);
  within<HTMLElement>('[data-demo-controls]').hidden = false;
  root.dataset.demoEnhanced = 'true';
  layout();
}
