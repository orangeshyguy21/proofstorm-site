# MCP network demonstration

The section below the install hero shows a coding agent constructing a cell and moving payments through it. HTML, CSS, SVG, and one JavaScript timeline drive the sequence. It does not contact an agent, start infrastructure, or move money.

## Composition and story

Two independent screens have equal width and height on desktop. The neutral agent window connects to the Proofstorm canvas through a small MCP bridge. Requests and responses cross that bridge as tools run. On narrower screens the windows stack, and the agent shows the current tool call. There is no shared window frame, promotional eyebrow, or explanatory footer.

The cell contains two Bitcoin Core peers, CLN and LND, CDK and Nutshell mints, and Alice and Bob wallets. Tinted connections show the topology; brighter moving packets show activity. The canvas uses the existing Proofstorm SVG logo and wordmark.

The 32-second sequence types a prompt, discovers components, starts eight services, funds a Lightning channel, pays a 1,000-sat invoice, issues 1,000 and 500 sat of ecash, and transfers 250 sat from Alice to Bob. Wallets can hold tokens from the cell's mints. Bitcoin nodes are peers in the same regtest network. The channel's 50,000 sat is capacity, mint figures are issued amounts, and wallet figures are held ecash. These are demonstration values.

Tool names match the developer MCP surface: catalog_list, cell_up, and cell_exec. Native command invocations and detailed receipt polling are condensed for the presentation.

## Playback and layout

One elapsed-time value drives typing, tool entrances, MCP exchanges, node entrances, connections, payment motion, arrival highlights, receipts, and balances. Scrubbing computes the scene directly, including backwards seeks. Playback starts when either screen is visible. User pause, an offscreen demonstration, and a hidden document suspend the clock without adding elapsed time. Playback stops at completion; play or replay restarts it.

The graph measures rendered card positions and follows four-column, two-column, or narrow/text-enlarged single-column arrangements. Side rails keep nonadjacent single-column connections outside intervening cards. Resize and font changes refresh geometry.

Reduced-motion mode and initial HTML show the completed scene. Playback requires explicit input in reduced-motion mode. The visual transcript is hidden from screen readers; a static description and labeled keyboard-operable controls provide the accessible version.

## Source layout

- src/components/NetworkDemo.astro: section, screens, cards, connections, and controls.
- src/lib/network-demo.mjs: story, topology, timing, and derived metrics.
- src/lib/network-geometry.mjs: connections between rendered card edges.
- src/scripts/network-demo.ts: shared animation clock and responsive geometry.
- src/styles/network-demo.css: visual and responsive styling.
- scripts/network-demo.test.mjs: topology readiness, arrival timing, balance conservation, reverse seeking, and routing.
- scripts/network-playback.test.mjs: actual controller exercised with a DOM/event/clock fixture for reduced motion, playback, backgrounding, visibility, and scrubbing.

## Verification

Reviewed in the local in-app browser on September 12, 2026:

- Widths 320, 375, 390, 640, 768, 1024, 1280, 1440, and 1920 pixels, plus 844 × 390 landscape. No horizontal page overflow or clipped node text was found. Desktop panel dimensions match exactly.
- Text enlarged to 200% at 1440 and 320 pixels using a temporary root font-size override, then restored. Fixed agent-title wrapping and wordmark shrinkage. The graph reflows to one column at the narrowest enlarged size.
- Construction, funding, Lightning payment, ecash issuance, transfer, and reverse seeking inspected through the browser controls. A 250-sat transfer changes wallet balances from 1,000/500 to 750/750 on arrival.
- Payment paths visually remain aligned when switching desktop and phone arrangements.
- Keyboard seeking and play work; the offscreen clock held at the same position across subsequent browser actions. The install copy button showed its success state with no error; clipboard bytes were not independently confirmed by the browser connector.
- Reduced-motion initialization and changes, explicit replay, user pause, hidden-document suspension, and visibility suspension pass controller tests. The browser connector does not expose OS motion-preference emulation, so native preference switching was not manually exercised.
- No browser warnings or errors were reported. Astro diagnostics, all 15 tests, the static production build, release integrity checks, and git diff whitespace validation pass.

Screenshots were captured during desktop, tablet, mobile, payment, and enlarged-text review. The desktop review artifact is saved outside the repository at /Users/admin/.codex/visualizations/2026/09/11/01a08e26-bda3-7023-93cd-948c7443b0df/proofstorm-mcp-desktop.jpg. Temporary viewport and font-size overrides were restored. Installer and release behavior were not changed.
