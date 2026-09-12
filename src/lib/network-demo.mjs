export const DURATION = 32_000;
export const PROMPT = 'Build a Bitcoin, Lightning, and Cashu cell. Connect two mints and wallets, then send payments through it.';

export const NODES = [
  { id: 'bitcoin-a', kind: 'bitcoin', name: 'chain-a', implementation: 'Bitcoin Core', column: 1, row: 1, compactColumn: 1, compactRow: 1, birth: 5_900 },
  { id: 'bitcoin-b', kind: 'bitcoin', name: 'chain-b', implementation: 'Bitcoin Core', column: 1, row: 2, compactColumn: 2, compactRow: 1, birth: 6_300 },
  { id: 'cln', kind: 'lightning', name: 'ln-alice', implementation: 'CLN', column: 2, row: 1, compactColumn: 1, compactRow: 2, birth: 7_200 },
  { id: 'lnd', kind: 'lightning', name: 'ln-bob', implementation: 'LND', column: 2, row: 2, compactColumn: 2, compactRow: 2, birth: 7_600 },
  { id: 'cdk', kind: 'mint', name: 'mint-a', implementation: 'CDK', column: 3, row: 1, compactColumn: 1, compactRow: 3, birth: 8_800 },
  { id: 'nutshell', kind: 'mint', name: 'mint-b', implementation: 'Nutshell', column: 3, row: 2, compactColumn: 2, compactRow: 3, birth: 9_200 },
  { id: 'alice', kind: 'wallet', name: 'alice', implementation: 'Cashu wallet', column: 4, row: 1, compactColumn: 1, compactRow: 4, birth: 10_400 },
  { id: 'bob', kind: 'wallet', name: 'bob', implementation: 'Cashu wallet', column: 4, row: 2, compactColumn: 2, compactRow: 4, birth: 10_800 },
];

export const LINKS = [
  { id: 'chain', from: 'bitcoin-a', to: 'bitcoin-b', kind: 'bitcoin', label: 'Bitcoin peer connection' },
  { id: 'fund-a', from: 'bitcoin-a', to: 'cln', kind: 'bitcoin', label: 'On-chain funding for Alice' },
  { id: 'fund-b', from: 'bitcoin-b', to: 'lnd', kind: 'bitcoin', label: 'On-chain funding for Bob' },
  { id: 'channel', from: 'cln', to: 'lnd', kind: 'lightning', label: 'Lightning channel' },
  { id: 'mint-a', from: 'cln', to: 'cdk', kind: 'mint', label: 'CDK Lightning backend' },
  { id: 'mint-b', from: 'lnd', to: 'nutshell', kind: 'mint', label: 'Nutshell Lightning backend' },
  { id: 'issue-a', from: 'cdk', to: 'alice', kind: 'mint', label: 'Ecash issuance to Alice' },
  { id: 'issue-b', from: 'nutshell', to: 'bob', kind: 'mint', label: 'Ecash issuance to Bob' },
  { id: 'transfer', from: 'alice', to: 'bob', kind: 'wallet', label: 'Wallet-to-wallet ecash transfer' },
];

export const STEPS = [
  { start: 3_000, end: 5_500, title: 'Discover components', tool: 'catalog_list', detail: 'Bitcoin Core, CLN, LND, CDK, Nutshell', result: 'Component catalog read' },
  { start: 5_500, end: 13_500, title: 'Build the cell', tool: 'cell_up', detail: 'Starting services. Connecting dependencies.', result: '8 components ready' },
  { start: 13_500, end: 17_500, title: 'Fund the channels', tool: 'cell_exec', detail: 'Regtest funds. Two Lightning peers.', result: 'Channels funded and open' },
  { start: 17_500, end: 21_000, title: 'Pay a Lightning invoice', tool: 'cell_exec', detail: 'Sending 1,000 sat from ln-alice to ln-bob.', result: '1,000 sat settled' },
  { start: 21_000, end: 25_500, title: 'Mint ecash', tool: 'cell_exec', detail: 'Funding mint quotes. Issuing Cashu tokens.', result: '1,500 sat issued across two mints' },
  { start: 25_500, end: 29_000, title: 'Send ecash to Bob', tool: 'cell_exec', detail: 'Alice sends 250 sat. Bob receives the tokens.', result: '250 sat received' },
];

export const FLOWS = [
  { id: 'fund-alice', link: 'fund-a', start: 14_000, duration: 1_400, kind: 'bitcoin' },
  { id: 'fund-bob', link: 'fund-b', start: 14_500, duration: 1_400, kind: 'bitcoin' },
  { id: 'lightning-payment', link: 'channel', start: 18_000, duration: 2_000, kind: 'lightning' },
  { id: 'quote-alice', link: 'mint-a', start: 21_300, duration: 1_100, kind: 'lightning' },
  { id: 'quote-bob', link: 'mint-b', start: 21_700, duration: 1_100, kind: 'lightning' },
  { id: 'issue-alice', link: 'issue-a', start: 22_600, duration: 1_200, kind: 'mint' },
  { id: 'issue-bob', link: 'issue-b', start: 23_000, duration: 1_200, kind: 'mint' },
  { id: 'send-ecash', link: 'transfer', start: 26_000, duration: 2_000, kind: 'wallet' },
];

/** @param {number} value */
export const clamp = (value) => Math.min(1, Math.max(0, value));
/** @param {number} value */
export const ease = (value) => 1 - Math.pow(1 - clamp(value), 3);
/** @param {number} time @param {number} start @param {number} duration */
export const progress = (time, start, duration) => clamp((time - start) / duration);
/** @param {number} time */
export function phaseAt(time) {
  if (time < STEPS[0].start) return 'Start with a prompt';
  return STEPS.find((step) => time >= step.start && time < step.end)?.title ?? 'Complete';
}
/** @param {number} time */
export function readyCount(time) {
  return NODES.filter((node) => time >= node.birth + 1_500).length;
}
/** @param {number} time */
export function walletBalances(time) {
  const aliceIssued = time >= 23_800 ? 1_000 : 0;
  const bobIssued = time >= 24_200 ? 500 : 0;
  const transferred = time >= 28_000 ? 250 : 0;
  return { alice: aliceIssued - transferred, bob: bobIssued + transferred };
}
/** @param {string} id @param {number} time */
export function metricAt(id, time) {
  if (id.startsWith('bitcoin')) return time >= 16_000 ? '242 blocks' : '241 blocks';
  if (id === 'cln' || id === 'lnd') return time >= 17_000 ? '50,000 sat' : 'Unfunded';
  if (id === 'cdk') return time >= 23_800 ? '1,000 sat' : 'Ready';
  if (id === 'nutshell') return time >= 24_200 ? '500 sat' : 'Ready';
  const balances = walletBalances(time);
  return (id === 'alice' ? balances.alice : balances.bob).toLocaleString('en-US') + ' sat';
}
/** @param {number} time */
export function receiptAt(time) {
  if (time >= 29_000) return { label: 'All payments settled', detail: '8 services running', kind: 'complete' };
  if (time >= 28_000) return { label: '250 sat received', detail: 'alice → bob · Cashu transfer', kind: 'wallet' };
  if (time >= 26_000) return { label: 'Sending 250 sat', detail: 'alice → bob · Cashu transfer', kind: 'wallet' };
  if (time >= 24_200) return { label: '1,500 sat minted', detail: 'mint-a · 1,000 sat / mint-b · 500 sat', kind: 'mint' };
  if (time >= 21_000) return { label: 'Minting ecash', detail: 'mint-a + mint-b', kind: 'mint' };
  if (time >= 20_000) return { label: '1,000 sat settled', detail: 'ln-alice → ln-bob · Lightning', kind: 'lightning' };
  if (time >= 18_000) return { label: 'Sending 1,000 sat', detail: 'ln-alice → ln-bob · Lightning', kind: 'lightning' };
  if (time >= 17_000) return { label: 'Lightning channels open', detail: 'ln-alice ↔ ln-bob', kind: 'lightning' };
  if (time >= 13_500) return { label: 'Funding the network', detail: 'Local Bitcoin regtest.', kind: 'bitcoin' };
  if (time >= 12_300) return { label: 'All 8 components ready', detail: 'storm cell', kind: 'complete' };
  return { label: 'Waiting for services', detail: 'storm cell', kind: 'idle' };
}
