/**
 * One tooltip style for every chart.
 *
 * Twenty-six charts styled their own tooltip and fifteen of them set a dark
 * background with no text colour, so recharts fell back to its default
 * near-black type and the hover text was unreadable on a dark panel. Styling
 * each chart separately is how they drifted apart; this is the single copy.
 *
 * Spread it: `<Tooltip {...tooltipTheme} />`. A chart that genuinely needs a
 * different colour can still pass itemStyle or labelStyle after the spread,
 * and that wins — the theme is a floor, not a cage.
 */

/** Lighter than the panels behind it, so the tooltip reads as a layer above. */
export const tooltipContentStyle = {
    backgroundColor: '#26262e',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '12px',
    boxShadow: '0 12px 28px rgba(0,0,0,0.55)',
    padding: '8px 12px',
    color: '#f4f4f5',
};

/** The figures. Near-white rather than pure white, which glares on dark. */
export const tooltipItemStyle = {
    color: '#f4f4f5',
    fontSize: '12px',
    fontWeight: 600,
};

/** The row's name. Deliberately quieter than the number it describes. */
export const tooltipLabelStyle = {
    color: '#a1a1aa',
    fontSize: '11px',
    fontWeight: 700,
    marginBottom: '4px',
};

/**
 * No hover cursor by default.
 *
 * On a bar chart recharts paints the hovered band full-height across the plot,
 * and on a dark panel that grey slab reads as a bar of its own — on one chart
 * it made the smallest purchase look like the tallest column. The tooltip
 * already names the row it describes, so the band was adding nothing.
 *
 * Harmless on pie and treemap, which have no cursor. A line or area chart is
 * the exception: there the cursor is a crosshair rather than a slab, and it is
 * what ties the pointer to a position on a continuous series — those pass
 * `crosshairCursor` after the spread.
 */
export const tooltipTheme = {
    contentStyle: tooltipContentStyle,
    itemStyle: tooltipItemStyle,
    labelStyle: tooltipLabelStyle,
    cursor: false,
};

/** For line and area charts: a thin vertical guide, not a filled band. */
export const crosshairCursor = { stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1 };
