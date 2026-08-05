import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import TransactionModal from '../components/TransactionModal';
import { useNavigate } from 'react-router-dom';
import {
    Wallet,
    PiggyBank,
    Coins,
    TrendingUp,
    Layers,
    Plus,
    ArrowRight,
    ShieldCheck,
    Briefcase,
    Gem
} from 'lucide-react';

const Dashboard = () => {
    const navigate = useNavigate();
    const { savings, metals, assets, formatCurrency, calculateItemCurrentValue, calculateItemInvestedValue, addItem } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSaveTransaction = async (transaction) => {
        await addItem('expense', transaction);
        setIsModalOpen(false);
    };

    // --- Calculations ---
    const stats = useMemo(() => {
        const totalSavings = savings.reduce((sum, item) => sum + calculateItemCurrentValue(item), 0);

        const goldVal = metals.gold?.reduce((sum, item) => sum + (item.currentValue || 0), 0) || 0;
        const goldGms = metals.gold?.reduce((sum, item) => sum + (item.weightGm || 0), 0) || 0;
        const silverVal = metals.silver?.reduce((sum, item) => sum + (item.currentValue || 0), 0) || 0;
        const silverGms = metals.silver?.reduce((sum, item) => sum + (item.weightGm || 0), 0) || 0;
        const platinumVal = metals.platinum?.reduce((sum, item) => sum + (item.currentValue || 0), 0) || 0;
        const platinumGms = metals.platinum?.reduce((sum, item) => sum + (item.weightGm || 0), 0) || 0;
        const antiqueCoinsVal = metals.antique_coins?.reduce((sum, item) => sum + (item.currentValue || 0), 0) || 0;
        const currenciesVal = metals.currencies?.reduce((sum, item) => sum + (item.currentValue || 0), 0) || 0;
        const totalMetals = goldVal + silverVal + platinumVal + antiqueCoinsVal + currenciesVal;

        const totalAssets = assets.reduce((total, cat) =>
            total + cat.items.reduce((sum, item) => sum + (Number(item.currentValue) || Number(item.purchasePrice) || 0), 0), 0
        );

        const netWorth = totalSavings + totalMetals + totalAssets;

        // Specifics for sub-cards - using centralized calculation logic
        const fd = savings.filter(s => s.type === 'fixed_deposit').reduce((sum, s) => sum + calculateItemCurrentValue(s), 0);
        const stocks = savings.filter(s => s.type === 'stock_market').reduce((sum, s) => sum + calculateItemCurrentValue(s), 0);
        const mf = savings.filter(s => s.type === 'mutual_fund').reduce((sum, s) => sum + calculateItemCurrentValue(s), 0);
        const ppf = savings.filter(s => s.type === 'ppf').reduce((sum, s) => sum + calculateItemCurrentValue(s), 0);
        const nps = savings.filter(s => s.type === 'nps').reduce((sum, s) => sum + calculateItemCurrentValue(s), 0);
        const sgb = savings.filter(s => s.type === 'sgb').reduce((sum, s) => sum + calculateItemCurrentValue(s), 0);

        // Growth Index and Health
        const totalInvestedSavings = savings.reduce((sum, item) => sum + (calculateItemInvestedValue(item) || calculateItemCurrentValue(item)), 0);
        const totalInvestedAssets = assets.reduce((total, cat) =>
            total + cat.items.reduce((sum, item) => sum + (Number(item.purchasePrice) || Number(item.currentValue) || 0), 0), 0
        );
        const totalInvestedMetals = (metals.gold?.reduce((sum, item) => sum + (Number(item.purchasePrice) || Number(item.currentValue) || 0), 0) || 0) +
                                    (metals.silver?.reduce((sum, item) => sum + (Number(item.purchasePrice) || Number(item.currentValue) || 0), 0) || 0) +
                                    (metals.platinum?.reduce((sum, item) => sum + (Number(item.purchasePrice) || Number(item.currentValue) || 0), 0) || 0) +
                                    (metals.antique_coins?.reduce((sum, item) => sum + (Number(item.purchasePrice) || Number(item.currentValue) || 0), 0) || 0) +
                                    (metals.currencies?.reduce((sum, item) => sum + (Number(item.purchasePrice) || Number(item.currentValue) || 0), 0) || 0);

        const totalInvested = totalInvestedSavings + totalInvestedAssets + totalInvestedMetals;
        const growthIndexValue = totalInvested > 0 ? (((netWorth - totalInvested) / totalInvested) * 100) : 0;
        
        let assetHealth = "Stable";
        let healthColor = "text-blue-400";
        if (growthIndexValue > 15) {
            assetHealth = "Excellent";
            healthColor = "text-emerald-400";
        } else if (growthIndexValue < -5) {
            assetHealth = "Volatile";
            healthColor = "text-rose-400";
        } else if (growthIndexValue > 5) {
            assetHealth = "Good";
            healthColor = "text-emerald-400";
        }

        const growthIndex = growthIndexValue > 0 ? `+${growthIndexValue.toFixed(1)}%` : `${growthIndexValue.toFixed(1)}%`;
        const growthColor = growthIndexValue > 0 ? "text-emerald-400" : (growthIndexValue < 0 ? "text-rose-400" : "text-gray-400");

        return {
            netWorth,
            totalSavings,
            totalMetals,
            totalAssets,
            goldVal,
            goldGms,
            silverVal,
            silverGms,
            platinumVal,
            platinumGms,
            antiqueCoinsVal,
            currenciesVal,
            fd,
            stocks,
            mf,
            ppf,
            nps,
            sgb,
            growthIndex,
            growthColor,
            assetHealth,
            healthColor
        };
    }, [savings, metals, assets, calculateItemCurrentValue, calculateItemInvestedValue]);

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {/* Header Section */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>Portfolio</h2>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', margin: '0.25rem 0 0 0' }}>Global Wealth Overview</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '1rem',
                        backgroundColor: '#c084fc',
                        color: 'black',
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        cursor: 'pointer',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                    }}
                >
                    <Plus size={16} /> Record Entry
                </button>
            </div>

            {/* Net Worth Hero */}
            <div style={{
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: 'rgba(16, 185, 129, 0.03)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(16, 185, 129, 0.1)',
                borderRadius: '2rem',
                padding: '2.5rem',
                boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.05)',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '2rem'
            }}>
                <div>
                    <span style={{ fontSize: '9px', fontWeight: '900', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Combined Net Worth</span>
                    <h3 style={{ fontSize: '3rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.5rem 0' }}>
                        {formatCurrency(stats.netWorth)}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#71717a', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <ShieldCheck size={14} className="text-emerald-400" /> Secure and Verified Assets
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '1rem 1.5rem', borderRadius: '1rem', minWidth: '150px' }}>
                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Growth Index</span>
                        <p style={{ fontSize: '1.5rem', fontWeight: '950', fontFamily: 'monospace', margin: '0.25rem 0 0 0', color: stats.growthColor.includes('emerald') ? '#34d399' : stats.growthColor.includes('rose') ? '#f87171' : '#a1a1aa' }}>
                            {stats.growthIndex}
                        </p>
                    </div>
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '1rem 1.5rem', borderRadius: '1rem', minWidth: '150px' }}>
                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Asset Health</span>
                        <p style={{ fontSize: '1.5rem', fontWeight: '950', fontFamily: 'monospace', margin: '0.25rem 0 0 0', color: stats.healthColor.includes('emerald') ? '#34d399' : stats.healthColor.includes('rose') ? '#f87171' : '#a1a1aa' }}>
                            {stats.assetHealth}
                        </p>
                    </div>
                </div>
            </div>

            {/* Major Categories */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                <div
                    onClick={() => navigate('/savings')}
                    style={{
                        backgroundColor: 'rgba(99, 102, 241, 0.02)',
                        border: '1px solid rgba(99, 102, 241, 0.1)',
                        borderRadius: '2rem',
                        padding: '2rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 15px -3px rgba(99, 102, 241, 0.03)'
                    }}
                >
                    <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.5rem', borderRadius: '0.75rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', display: 'flex', alignItems: 'center' }}>
                            <PiggyBank size={18} />
                        </div>
                        <ArrowRight size={16} style={{ color: '#71717a' }} />
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: '900', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Savings</span>
                    <h3 style={{ fontSize: '2rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(stats.totalSavings)}</h3>
                </div>

                <div
                    onClick={() => navigate('/metals')}
                    style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.02)',
                        border: '1px solid rgba(245, 158, 11, 0.1)',
                        borderRadius: '2rem',
                        padding: '2rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 15px -3px rgba(245, 158, 11, 0.03)'
                    }}
                >
                    <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.5rem', borderRadius: '0.75rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', display: 'flex', alignItems: 'center' }}>
                            <Gem size={18} />
                        </div>
                        <ArrowRight size={16} style={{ color: '#71717a' }} />
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: '900', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Precious Metals</span>
                    <h3 style={{ fontSize: '2rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(stats.totalMetals)}</h3>
                </div>

                <div
                    onClick={() => navigate('/assets')}
                    style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.02)',
                        border: '1px solid rgba(16, 185, 129, 0.1)',
                        borderRadius: '2rem',
                        padding: '2rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 15px -3px rgba(16, 185, 129, 0.03)'
                    }}
                >
                    <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.5rem', borderRadius: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399', display: 'flex', alignItems: 'center' }}>
                            <Layers size={18} />
                        </div>
                        <ArrowRight size={16} style={{ color: '#71717a' }} />
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: '900', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Real Estate Assets</span>
                    <h3 style={{ fontSize: '2rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(stats.totalAssets)}</h3>
                </div>
            </div>

            {/* Detailed Multi-Grid Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.5rem' }}>
                    <Briefcase size={18} style={{ color: '#c084fc' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: 0 }}>Investment Ledger</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                    {/* Savings Items */}
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1.5rem' }}>
                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fixed Deposits</span>
                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(stats.fd)}</p>
                    </div>
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1.5rem' }}>
                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equity Stocks</span>
                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(stats.stocks)}</p>
                    </div>
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1.5rem' }}>
                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mutual Funds</span>
                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(stats.mf)}</p>
                    </div>
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1.5rem' }}>
                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Public Provident Fund</span>
                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(stats.ppf)}</p>
                    </div>

                    {/* Retirements & Bonds */}
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1.5rem' }}>
                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retirement (NPS)</span>
                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(stats.nps)}</p>
                    </div>
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1.5rem' }}>
                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gold Bonds (SGB)</span>
                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(stats.sgb)}</p>
                    </div>

                    {/* Physical Metals Quantities */}
                    <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.02)', border: '1px solid rgba(245, 158, 11, 0.1)', borderRadius: '1.5rem', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '8px', fontWeight: '900', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Physical Gold</span>
                            <span style={{ fontSize: '9px', color: '#fbbf24', fontWeight: 'black', fontFamily: 'monospace' }}>{stats.goldGms.toFixed(2)}g</span>
                        </div>
                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(stats.goldVal)}</p>
                    </div>
                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '1.5rem', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Physical Silver</span>
                            <span style={{ fontSize: '9px', color: '#71717a', fontWeight: 'black', fontFamily: 'monospace' }}>{stats.silverGms.toFixed(2)}g</span>
                        </div>
                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(stats.silverVal)}</p>
                    </div>

                    <div style={{ backgroundColor: 'rgba(148, 163, 184, 0.02)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: '1.5rem', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '8px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Physical Platinum</span>
                            <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'black', fontFamily: 'monospace' }}>{stats.platinumGms.toFixed(2)}g</span>
                        </div>
                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(stats.platinumVal)}</p>
                    </div>

                    {/* Collectibles */}
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Antique Coins</span>
                            <span style={{ fontSize: '9px', color: '#71717a', fontWeight: 'black', fontFamily: 'monospace' }}>{(metals.antique_coins?.length || 0)} Items</span>
                        </div>
                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(stats.antiqueCoinsVal)}</p>
                    </div>
                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.02)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '1.5rem', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '8px', fontWeight: '900', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Currencies</span>
                            <span style={{ fontSize: '9px', color: '#34d399', fontWeight: 'black', fontFamily: 'monospace' }}>{(metals.currencies?.length || 0)} Items</span>
                        </div>
                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(stats.currenciesVal)}</p>
                    </div>
                </div>
            </div>

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdd={handleSaveTransaction}
            />
        </div>
    );
};

export default Dashboard;
