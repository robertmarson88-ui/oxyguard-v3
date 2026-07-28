# Design QA — Cumulative rule performance integration

- Source visual truth: `C:\Users\twcl.ssa\AppData\Local\Temp\codex-clipboard-d680ae30-d8bf-4ca3-8765-ad6996a7ec57.png`
- Browser-rendered implementation: `C:\Users\twcl.ssa\Documents\Codex\2026-07-28\giv\work\oxyguard-v8-publish\qa-ytd-analytics.png`
- Focused implementation crop: `C:\Users\twcl.ssa\Documents\Codex\2026-07-28\giv\work\oxyguard-v8-publish\qa-ytd-rule-focus.png`
- Combined comparison: `C:\Users\twcl.ssa\Documents\Codex\2026-07-28\giv\work\oxyguard-v8-publish\qa-ytd-comparison.png`
- Browser viewport: 1265 × 712 CSS px
- Source pixels: 1338 × 471 at 120 ppi
- Implementation pixels: 1265 × 712 at device scale factor 1
- Normalization: the source was proportionally resized to 1033 px wide; the matching implementation content region was cropped to 1033 px wide and placed in the same comparison image.
- State: signed in as administrator, Analytics selected, range set to Jan–Jul.

## Full-view comparison evidence

The browser-rendered Analytics page retains the supplied three-card Core rule performance composition, color coding, typography hierarchy, card borders, and rule ordering. The additive month range and KPI summaries sit above the supplied target area and do not introduce overlap or clipping.

## Focused region comparison evidence

The combined image places the supplied source and the rendered rule section in one normalized comparison. The implementation intentionally replaces the source's zero/clear live state with cumulative year-to-date values and YTD badges. The top-level spacing, title alignment, card columns, semantic red/amber/green treatments, and progress bars remain source-aligned. The lower metric grids were also verified in the browser DOM because the fixed viewport crop shows only their top edge.

## Required fidelity surfaces

- Fonts and typography: title, labels, figures, helper copy, badges, and rule names preserve the existing family, weights, hierarchy, line height, and wrapping.
- Spacing and layout rhythm: three equal cards, consistent internal padding, matching gaps, radii, borders, and vertical rhythm are maintained.
- Colors and visual tokens: Ghost Flow remains red, Unauthorized Bed Usage amber, and Residual Gas green; surface fills, borders, and progress colors follow the source tokens.
- Image quality and assets: no new raster or decorative assets were introduced. Existing logo and icon assets remain unchanged; cards and lines render as native UI without stretched imagery.
- Copy and content: labels now clearly say cumulative detections, the reporting month is explicit, and the Dashboard uses the same July snapshot totals.
- Interactions and accessibility: the labeled slider was tested at Jan–Feb, Jan–Apr, and Jan–Jul. It updates `aria-valuetext`, cumulative cards, consumption, loss, exposure, savings, ward summaries, and charts together.
- Responsiveness: the desktop viewport has no overlap, clipping, or broken grid behavior in the tested Analytics and Dashboard states.
- Browser diagnostics: Analytics and Dashboard were exercised; browser console output was empty.

## Findings

No actionable P0, P1, or P2 differences remain. The visible data difference from the source is intentional: the source shows an empty live state, while the implementation now shows connected cumulative reporting.

## Comparison history

- Pass 1: the original source-aligned card design passed, but rule values were live-only and did not respond to the month range.
- Fix: added monthly cumulative rule snapshots, linked the Analytics slider to the selected month, and connected the latest snapshot to Dashboard detection, risk, and exposure figures.
- Pass 2 evidence: Jan–Feb produced 2/1/1 detections; Jan–Apr produced 4/3/2; Jan–Jul produced 8/5/5. Dashboard totals matched July at 18 detections, 455 L at risk, JMD 102,000 exposure, and JMD 71,400 recoverable value. No P0/P1/P2 visual or interaction findings remained.

## Implementation checklist

- [x] Add monthly cumulative snapshots for all three core rules.
- [x] Recalculate rule cards with the selected year-to-date month.
- [x] Keep detection share, oxygen risk, exposure, and recoverable value internally consistent.
- [x] Connect the latest cumulative snapshot to Dashboard KPIs and rule overview.
- [x] Verify Jan–Feb, Jan–Apr, Jan–Jul, Dashboard totals, and console output.

## Follow-up polish

No P3 polish is required for this change.

final result: passed
