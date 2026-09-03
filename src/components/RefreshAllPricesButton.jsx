import React, { useState } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';

/**
 * One button that refreshes holdings and the watchlist together.
 *
 * Shared rather than copied onto each page: the previous two buttons drifted
 * into different wording and different failure handling, and the watchlist one
 * silently reported success on a partial fetch.
 *
 * The outcome is always shown. A refresh that updated 40 of 59 symbols is not
 * a success, and a button that just stops spinning looks identical to one that
 * worked.
 */
const RefreshAllPricesButton = ({ compact = false }) => {
    const { refreshAllPrices, savings, isGuest } = useFinance();
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    const market = (savings || []).find((s) => s.type === 'stock_market' && !s.isArchived);
    const lastFetched = market?.pricesUpdatedAt;

    const run = async () => {
        setBusy(true);
        setResult(null);
        const r = await refreshAllPrices();
        setBusy(false);
        setResult(r);
    };

    /** "3 minutes ago" is more readable than a timestamp for a freshness check. */
    const ago = (iso) => {
        if (!iso) return null;
        const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
        if (Number.isNaN(mins)) return null;
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    const freshness = ago(lastFetched);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {result && (
                <span style={{
                    fontSize: '11px', fontWeight: 600,
                    color: result.success ? '#a1a1aa' : '#f87171',
                }}>
                    {result.success ? result.message : (result.message || 'Refresh failed')}
                </span>
            )}
            {!result && freshness && !compact && (
                <span style={{ fontSize: '11px', color: '#52525b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Clock size={11} /> prices {freshness}
                </span>
            )}
            <button
                onClick={run}
                disabled={busy || isGuest}
                title={isGuest ? 'Guest mode — prices are not refreshed' : 'Refresh holdings and watchlist together'}
                style={{
                    padding: compact ? '0.5rem 0.9rem' : '0.625rem 1.1rem',
                    borderRadius: '0.875rem',
                    border: '1px solid rgba(45,212,191,0.3)',
                    backgroundColor: 'rgba(45,212,191,0.15)',
                    color: '#2dd4bf',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: busy ? 'wait' : isGuest ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: busy || isGuest ? 0.6 : 1,
                }}
            >
                <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
                {busy ? 'Fetching…' : 'Refresh all prices'}
            </button>
        </div>
    );
};

export default RefreshAllPricesButton;
