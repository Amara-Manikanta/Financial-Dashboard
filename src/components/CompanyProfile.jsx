import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { API_URL } from '../context/FinanceContext';

// Separate from StockFinancialsCard's cache: a business description does not
// go stale between quarters the way margins and P/E do, and the server backs
// this with a 7-day cache for the same reason. Keyed by symbol, same as there.
const profileCache = new Map();

const panelStyle = {
    backgroundColor: 'rgba(24,24,27,0.6)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '1rem',
    padding: '1.1rem 1.25rem',
};

/**
 * The plain opening of a Yahoo business summary, cut on a sentence boundary.
 *
 * A Yahoo profile is reliably one clean sentence — "X Limited provides
 * consulting, technology, outsourcing, and digital services worldwide." —
 * followed by a long run of product names and jargon: "Infosys Topaz",
 * "enterprise agile DevOps, API economy and microservices". The old code cut
 * at a fixed 320 characters regardless of where a sentence ended, so the
 * default text routinely stopped mid-word — "...engineering service…" — which
 * reads as broken because it is.
 *
 * This keeps whole sentences only, stopping before the running total would
 * exceed `maxChars` rather than mid-sentence. It does not rewrite the jargon
 * into plainer words — that needs judgement about what a phrase like "API
 * economy" actually means, which this file has no way to supply reliably —
 * but it stops presenting a broken fragment as if it were the answer.
 */
const plainOpening = (text, maxChars = 260) => {
    const sentences = text.match(/[^.!?]+[.!?]+(?=\s|$)/g)?.map((s) => s.trim()).filter(Boolean)
        || [text.trim()];
    let out = '';
    for (const sentence of sentences) {
        const next = out ? `${out} ${sentence}` : sentence;
        if (out && next.length > maxChars) break;
        out = next;
    }
    return out || sentences[0] || text.trim();
};

/**
 * What the company actually makes or does, in its own words.
 *
 * A portfolio accumulates names like "REC" and "KFin Technologies" that read
 * as tickers rather than businesses. This answers the plain question a weight
 * and a P/E ratio never do: what does this company actually sell.
 *
 * Collapsed by default past the first paragraph — Yahoo's summaries run to a
 * page for a diversified conglomerate, and a wall of text is worse than a
 * question left half-answered.
 */
const CompanyProfile = ({ symbol, name }) => {
    const [data, setData] = useState(() => profileCache.get(symbol) || null);
    const [loading, setLoading] = useState(!profileCache.has(symbol));
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!symbol) return undefined;
        if (profileCache.has(symbol)) {
            setData(profileCache.get(symbol));
            setLoading(false);
            return undefined;
        }
        let cancelled = false;
        setLoading(true);
        fetch(`${API_URL}/api/stock-profile?symbol=${encodeURIComponent(symbol)}`)
            .then((r) => r.json())
            .then((json) => {
                if (cancelled) return;
                profileCache.set(symbol, json);
                setData(json);
            })
            .catch(() => { if (!cancelled) setData({ symbol, summary: null }); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [symbol]);

    if (loading) return null;
    // No summary is a fact for a REIT/InvIT/fund — it owns assets rather than
    // running a business — and for anything the source has no listing on.
    // Silent rather than an error: absence here is common and not a failure.
    if (!data || !data.summary) return null;

    const opening = plainOpening(data.summary);
    // Whether there is anything left to reveal — never an ellipsis on a
    // sentence that already ends with its own full stop.
    const hasMore = opening.length < data.summary.trim().length;
    const shown = expanded ? data.summary : opening;

    return (
        <div style={panelStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 size={15} style={{ color: '#818cf8' }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#e4e4e7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        What {name || symbol} does
                    </span>
                </div>
                {(data.sector || data.industry) && (
                    <span style={{ fontSize: '0.65rem', color: '#71717a', fontWeight: 700, textAlign: 'right', flexShrink: 0 }}>
                        {data.industry || data.sector}
                    </span>
                )}
            </div>

            <p style={{ margin: 0, fontSize: '0.76rem', lineHeight: 1.65, color: '#c4c4c7' }}>
                {shown}
            </p>

            {/* Set expectations before someone expands into it: the rest is
                Yahoo's own wording, not simplified, and reads like a spec
                sheet — a list of product names and services rather than
                prose. Better to say so than have it look like a mistake. */}
            {expanded && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.63rem', color: '#71717a', fontStyle: 'italic' }}>
                    The rest is the company's own description, unedited — it reads more like a product list.
                </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.7rem' }}>
                {hasMore && (
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            fontSize: '0.68rem', fontWeight: 800, color: '#818cf8',
                        }}
                    >
                        {expanded ? <>Show less <ChevronUp size={12} /></> : <>Full description <ChevronDown size={12} /></>}
                    </button>
                )}
                {data.website && (
                    <a
                        href={data.website}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            fontSize: '0.68rem', fontWeight: 700, color: '#71717a', textDecoration: 'none',
                        }}
                    >
                        {data.website.replace(/^https?:\/\//, '')} <ExternalLink size={11} />
                    </a>
                )}
                {data.employees && (
                    <span style={{ fontSize: '0.68rem', color: '#52525b' }}>
                        {data.employees.toLocaleString('en-IN')} employees
                    </span>
                )}
            </div>
        </div>
    );
};

export default CompanyProfile;
