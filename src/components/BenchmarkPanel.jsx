import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Info, AlertTriangle, Target, Save } from 'lucide-react';
import { compareToIndex } from '../utils/benchmark';
import { recomputeStockMetrics } from '../utils/investmentSync';
import { sectorBreaches } from '../utils/sectorLimits';
import { realisedOutliers } from '../utils/stockAnalytics';

const panel = {
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '1.25rem',
    padding: '1.5rem',
};

const label = {
    fontSize: '10px', fontWeight: 900, color: '#71717a',
    textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
};

const num = (v) => Number(v) || 0;

/**
 * Two questions the holdings table cannot answer: did this beat simply buying
 * the index, and is any one sector larger than intended.
 *
 * The benchmark is money-weighted from the transaction history rather than from
 * `snapshots`. There are two snapshots, they do not separate equities, and the
 * value between them rises tenfold because property already owned was entered
 * into the app — comparing that to an index would produce a confident number
 * that means nothing.
 */
const BenchmarkPanel = ({ stocks = [], sectorLimits = {}, onSaveLimits, formatCurrency, apiUrl }) => {
    const [closes, setCloses] = useState(null);
    const [status, setStatus] = useState('loading');
    const [limits, setLimits] = useState(sectorLimits || {});
    const [dirty, setDirty] = useState(false);

    useEffect(() => { setLimits(sectorLimits || {}); setDirty(false); }, [sectorLimits]);

    useEffect(() => {
        let live = true;
        (async () => {
            try {
                const r = await fetch(`${apiUrl}/api/history?symbol=%5ENSEI&range=5y`);
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const data = await r.json();
                if (!live) return;
                setCloses(data.closes || {});
                setStatus('ok');
            } catch (err) {
                if (!live) return;
                // Said out loud rather than rendering an empty comparison, which
                // would read as "no difference" instead of "not measured".
                setStatus(`Could not load Nifty history: ${err.message}`);
            }
        })();
        return () => { live = false; };
    }, [apiUrl]);

    const totals = useMemo(() => {
        let value = 0, realised = 0, dividends = 0;
        (stocks || []).filter((s) => s && !s.isArchived).forEach((s) => {
            value += num(s.shares) * num(s.currentPrice);
            const m = recomputeStockMetrics(s.transactions || []);
            realised += num(m.realised);
            dividends += Object.values(m.dividends || {}).reduce((a, b) => a + num(b), 0);
        });
        return { value, realised, dividends };
    }, [stocks]);

    const result = useMemo(() => (closes ? compareToIndex({
        stocks, closes, portfolioValue: totals.value, realised: totals.realised, dividends: totals.dividends,
    }) : null), [stocks, closes, totals]);

    const outliers = useMemo(() => realisedOutliers(stocks), [stocks]);
    const sectors = useMemo(() => sectorBreaches(stocks, limits), [stocks, limits]);

    const setLimit = (sector, value) => {
        setLimits((p) => {
            const next = { ...p };
            if (value === '' || Number(value) <= 0) delete next[sector];
            else next[sector] = Number(value);
            return next;
        });
        setDirty(true);
    };

    return (
        <>
            {/* Against the index */}
            <div style={panel}>
                <p style={{ ...label, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <LineChart size={13} /> Against the Nifty 50
                </p>

                {status === 'loading' && <p style={{ fontSize: '0.8rem', color: '#71717a', margin: 0 }}>Loading index history…</p>}
                {status !== 'loading' && status !== 'ok' && (
                    <p style={{ fontSize: '0.8rem', color: '#fbbf24', margin: 0 }}>{status}</p>
                )}

                {result && (
                    <>
                        <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: '#a1a1aa', lineHeight: 1.55, maxWidth: '80ch' }}>
                            What the same money would be worth had each purchase bought the index on the
                            same day instead. Money-weighted, so a stock bought last month is not judged
                            against one bought in 2021.
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.75rem', marginBottom: '1rem' }}>
                            <div>
                                <p style={label}>You deployed</p>
                                <p style={{ margin: '2px 0 0', fontFamily: 'monospace', fontWeight: 900, fontSize: '1.05rem', color: '#e4e4e7' }}>
                                    {formatCurrency(result.comparableInvested)}
                                </p>
                                <p style={{ margin: 0, fontSize: '0.66rem', color: '#71717a' }}>{result.deploymentCount} purchases</p>
                            </div>
                            <div>
                                <p style={label}>Your equities now</p>
                                <p style={{ margin: '2px 0 0', fontFamily: 'monospace', fontWeight: 900, fontSize: '1.05rem', color: result.portfolioReturnPct >= 0 ? '#34d399' : '#f87171' }}>
                                    {formatCurrency(result.portfolioTotal)}
                                </p>
                                <p style={{ margin: 0, fontSize: '0.66rem', color: '#71717a' }}>
                                    {result.portfolioReturnPct >= 0 ? '+' : ''}{result.portfolioReturnPct.toFixed(1)}% · incl. realised and dividends
                                </p>
                            </div>
                            <div>
                                <p style={label}>Same money in Nifty</p>
                                <p style={{ margin: '2px 0 0', fontFamily: 'monospace', fontWeight: 900, fontSize: '1.05rem', color: '#818cf8' }}>
                                    {formatCurrency(result.indexValue)}
                                </p>
                                <p style={{ margin: 0, fontSize: '0.66rem', color: '#71717a' }}>
                                    {result.indexReturnPct >= 0 ? '+' : ''}{result.indexReturnPct.toFixed(1)}%
                                </p>
                            </div>
                            <div>
                                <p style={label}>Difference</p>
                                <p style={{ margin: '2px 0 0', fontFamily: 'monospace', fontWeight: 900, fontSize: '1.05rem', color: result.beatIndex ? '#34d399' : '#f87171' }}>
                                    {result.difference >= 0 ? '+' : ''}{formatCurrency(result.difference)}
                                </p>
                                <p style={{ margin: 0, fontSize: '0.66rem', color: '#71717a' }}>
                                    {result.beatIndex ? 'ahead of the index' : 'behind the index'}
                                </p>
                            </div>
                        </div>

                        {outliers.length > 0 && (
                            <div style={{
                                padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                backgroundColor: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)',
                                display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
                            }}>
                                <AlertTriangle size={14} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
                                <p style={{ margin: 0, fontSize: '0.74rem', color: '#fcd34d', lineHeight: 1.55 }}>
                                    One position dominates this comparison:{' '}
                                    {outliers.map((o) => `${o.name} (${formatCurrency(o.realised)} realised)`).join(', ')}.
                                    Without it the rest of the portfolio reads very differently — worth
                                    checking that history against a broker statement before drawing any
                                    conclusion from the figure above.
                                </p>
                            </div>
                        )}

                        {result.unmatchedCount > 0 && (
                            <p style={{ margin: '0.75rem 0 0', fontSize: '0.7rem', color: '#71717a', display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                                <Info size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                                {result.unmatchedCount} purchase{result.unmatchedCount === 1 ? '' : 's'} worth{' '}
                                {formatCurrency(result.unmatchedAmount)} predate the index history
                                ({result.indexFrom}) and are excluded from both sides.
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* Sector limits */}
            <div style={panel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                        <p style={{ ...label, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Target size={13} /> Sector limits
                        </p>
                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: '#a1a1aa', lineHeight: 1.55, maxWidth: '76ch' }}>
                            Caps you set, in percent of equity value. Nothing is suggested — there is no
                            correct weight for a sector, so a default would be the app inventing a rule
                            and then warning you for breaking it.
                        </p>
                    </div>
                    {dirty && onSaveLimits && (
                        <button
                            onClick={() => { onSaveLimits(limits); setDirty(false); }}
                            style={{
                                padding: '0.45rem 0.9rem', borderRadius: '0.6rem', border: '1px solid rgba(52,211,153,0.3)',
                                backgroundColor: 'rgba(52,211,153,0.15)', color: '#34d399', fontSize: '11px',
                                fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                            }}
                        >
                            <Save size={13} /> Save limits
                        </button>
                    )}
                </div>

                {sectors.breaches.length > 0 && (
                    <div style={{
                        margin: '1rem 0', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                        backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
                    }}>
                        {sectors.breaches.map((b) => (
                            <p key={b.sector} style={{ margin: '0.15rem 0', fontSize: '0.78rem', color: '#f87171', fontWeight: 600 }}>
                                {b.sector} is {b.pct.toFixed(1)}% against your {b.limit}% limit — over by{' '}
                                {b.overBy.toFixed(1)} points, about {formatCurrency(b.excessValue)}.
                            </p>
                        ))}
                    </div>
                )}

                <div style={{ marginTop: '1rem' }}>
                    {sectors.rows.map((r) => {
                        const cap = limits[r.sector];
                        const over = cap > 0 && r.pct > cap;
                        return (
                            <div key={r.sector} style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                            }}>
                                <span style={{ flex: 1, minWidth: 0, fontSize: '0.78rem', color: '#e4e4e7', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.sector}
                                </span>
                                <div style={{ width: '110px', height: '5px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexShrink: 0 }}>
                                    <div style={{ width: `${Math.min(100, r.pct)}%`, height: '100%', backgroundColor: over ? '#f87171' : '#6366f1' }} />
                                </div>
                                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: over ? '#f87171' : '#a1a1aa', minWidth: '46px', textAlign: 'right' }}>
                                    {r.pct.toFixed(1)}%
                                </span>
                                <input
                                    type="number" min="0" max="100" step="1"
                                    value={cap ?? ''}
                                    onChange={(e) => setLimit(r.sector, e.target.value)}
                                    placeholder="cap"
                                    style={{
                                        width: '62px', flexShrink: 0, backgroundColor: '#27272a', color: 'white',
                                        border: `1px solid ${over ? 'rgba(239,68,68,0.4)' : '#3f3f46'}`,
                                        borderRadius: '0.4rem', padding: '0.25rem 0.4rem', fontSize: '12px',
                                        outline: 'none', textAlign: 'right',
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>

                <p style={{ margin: '0.85rem 0 0', fontSize: '0.7rem', color: '#52525b' }}>
                    {sectors.limitedCount} sector{sectors.limitedCount === 1 ? '' : 's'} with a limit ·{' '}
                    {sectors.unlimitedCount} unmeasured. A sector with no limit is not within limits —
                    it is simply not being checked.
                </p>
            </div>
        </>
    );
};

export default BenchmarkPanel;
