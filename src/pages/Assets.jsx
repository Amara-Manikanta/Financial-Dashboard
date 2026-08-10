import React, { useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Home, PieChart, Layers, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { summariseWarranties } from '../utils/warranty';

const Assets = () => {
    const { assets, formatCurrency } = useFinance();
    const navigate = useNavigate();
    const warranties = useMemo(() => summariseWarranties(assets || []), [assets]);

    const getIcon = (id) => {
        switch (id) {
            case 'plots': return <Layers size={24} style={{ color: '#34d399' }} />;
            case 'apartments': return <Home size={24} style={{ color: '#60a5fa' }} />;
            case 'other_assets': return <PieChart size={24} style={{ color: '#c084fc' }} />;
            default: return <Layers size={24} style={{ color: '#a1a1aa' }} />;
        }
    };

    const getGlowColor = (id) => {
        switch (id) {
            case 'plots': return 'rgba(52, 211, 153, 0.15)';
            case 'apartments': return 'rgba(96, 165, 250, 0.15)';
            case 'other_assets': return 'rgba(192, 132, 252, 0.15)';
            default: return 'rgba(255, 255, 255, 0.05)';
        }
    };

    const getBorderColor = (id) => {
        switch (id) {
            case 'plots': return 'rgba(52, 211, 153, 0.2)';
            case 'apartments': return 'rgba(96, 165, 250, 0.2)';
            case 'other_assets': return 'rgba(192, 132, 252, 0.2)';
            default: return 'rgba(255, 255, 255, 0.1)';
        }
    };

    const calculateTotalValue = (items) => {
        return items.reduce((sum, item) => sum + (Number(item.currentValue) || Number(item.purchasePrice) || Number(item.purchasedValue) || 0), 0);
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2.5rem' }}>
                <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: '0 0 0.5rem 0' }}>Assets</h2>
                <p style={{ fontSize: '0.875rem', color: '#71717a', margin: 0 }}>Track and manage your real estate and other valuable assets.</p>
            </div>

            {/* Warranty cover worth acting on, surfaced here because the item it
                belongs to is several clicks away. */}
            {(warranties.expiring > 0 || warranties.expired > 0 || warranties.unknown > 0) && (
                <button
                    type="button"
                    onClick={() => navigate('/warranties')}
                    className="mb-8 flex w-full flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-left transition-all hover:bg-white/[0.06]"
                >
                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <ShieldCheck size={14} className="text-emerald-400" /> Warranties
                    </span>
                    {warranties.expiring > 0 && (
                        <span className="text-xs font-bold text-amber-400">{warranties.expiring} expiring soon</span>
                    )}
                    {warranties.active > 0 && (
                        <span className="text-xs font-bold text-emerald-400">{warranties.active} in warranty</span>
                    )}
                    {warranties.expired > 0 && (
                        <span className="text-xs font-bold text-gray-500">{warranties.expired} expired</span>
                    )}
                    {warranties.unknown > 0 && (
                        <span className="text-xs font-bold text-gray-500">{warranties.unknown} not recorded</span>
                    )}
                    {warranties.missingReceipt > 0 && (
                        <span className="text-xs font-bold text-amber-500/80">{warranties.missingReceipt} without a receipt</span>
                    )}
                    <span className="ml-auto text-[11px] font-bold text-gray-500">View all →</span>
                </button>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '2rem'
            }}>
                {assets.map(category => {
                    const totalValue = calculateTotalValue(category.items);
                    const glowColor = getGlowColor(category.id);
                    const borderColor = getBorderColor(category.id);
                    return (
                        <div
                            key={category.id}
                            onClick={() => navigate(`/assets/${category.id}`)}
                            style={{
                                backgroundColor: 'rgba(24, 24, 27, 0.4)',
                                backdropFilter: 'blur(10px)',
                                border: `1px solid ${borderColor}`,
                                borderRadius: '2rem',
                                padding: '1.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                height: '220px',
                                boxShadow: `0 10px 20px -5px ${glowColor}`,
                                transition: 'transform 0.2s, border-color 0.2s',
                                position: 'relative'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.borderColor = 'white';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.borderColor = borderColor;
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{
                                    padding: '0.75rem',
                                    borderRadius: '1rem',
                                    backgroundColor: glowColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {getIcon(category.id)}
                                </div>
                                <span style={{ fontSize: '9px', fontWeight: '900', color: '#71717a', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {category.items.length} items
                                </span>
                            </div>

                            <div style={{ marginTop: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: '0 0 0.5rem 0' }}>{category.title}</h3>
                                <div>
                                    <p style={{ fontSize: '8px', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.125rem 0' }}>Total Valuation</p>
                                    <p style={{ fontSize: '1.75rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(totalValue)}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Assets;
