/** @typedef {{ x: number, y: number, width: number, height: number }} Rectangle */
/**
 * Build cubic segments whose endpoints meet card edges. An optional side rail
 * keeps a long connection outside intermediate cards in a single-column cell.
 * @param {Rectangle} from
 * @param {Rectangle} to
 * @param {number | null} rail
 */
export function routeWire(from, to, rail = null) {
  const x1 = from.x + from.width / 2;
  const y1 = from.y + from.height / 2;
  const x2 = to.x + to.width / 2;
  const y2 = to.y + to.height / 2;
  /** @type {number[][][]} */
  let curves;
  if (rail !== null) {
    const start = rail < x1 ? from.x : from.x + from.width;
    const end = rail < x2 ? to.x : to.x + to.width;
    const bend = Math.sign(y2 - y1) * Math.min(12, Math.abs(y2 - y1) / 4);
    curves = [
      [[start, y1], [rail, y1], [rail, y1], [rail, y1 + bend]],
      [[rail, y1 + bend], [rail, y1 + bend], [rail, y2 - bend], [rail, y2 - bend]],
      [[rail, y2 - bend], [rail, y2], [rail, y2], [end, y2]],
    ];
  } else if (Math.abs(x2 - x1) > Math.abs(y2 - y1)) {
    const direction = Math.sign(x2 - x1);
    const start = x1 + direction * from.width / 2;
    const end = x2 - direction * to.width / 2;
    const middle = (start + end) / 2;
    curves = [[[start, y1], [middle, y1], [middle, y2], [end, y2]]];
  } else {
    const direction = Math.sign(y2 - y1);
    const start = y1 + direction * from.height / 2;
    const end = y2 - direction * to.height / 2;
    const middle = (start + end) / 2;
    curves = [[[x1, start], [x1, middle], [x2, middle], [x2, end]]];
  }
  return {
    curves,
    path: 'M ' + curves[0][0].join(' ') + curves.map((curve) => ' C ' + curve.slice(1).map((point) => point.join(' ')).join(', ')).join(''),
  };
}
