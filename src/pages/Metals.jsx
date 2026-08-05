import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { Plus, Coins, ChevronRight, ArrowUpRight, Shield, Award } from 'lucide-react';
import MetalModal from '../components/MetalModal';

const Metals = () => {
    const { metals, formatCurrency, addMetal, metalRates } = useFinance();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('gold');

    const handleAddItem = (type) => {
        setModalType(type);
        setIsModalOpen(true);
    };

    // Calculate aggregated metrics
    const goldValue = (metals.gold || []).reduce((sum, item) => sum + (item.currentValue || 0), 0);
    const silverValue = (metals.silver || []).reduce((sum, item) => sum + (item.currentValue || 0), 0);
    const platinumValue = (metals.platinum || []).reduce((sum, item) => sum + (item.currentValue || 0), 0);
    const coinsValue = (metals.antique_coins || []).reduce((sum, item) => sum + (item.currentValue || 0), 0);
    const currenciesValue = (metals.currencies || []).reduce((sum, item) => sum + (item.currentValue || 0), 0);
    const totalMetalsValue = goldValue + silverValue + platinumValue + coinsValue + currenciesValue;

    const goldWeight = (metals.gold || []).reduce((sum, item) => sum + (item.weightGm || 0), 0);
    const silverWeight = (metals.silver || []).reduce((sum, item) => sum + (item.weightGm || 0), 0);

    const renderMetalSection = (title, items = [], borderClr, glowBg) => {
        const totalWeight = items.reduce((sum, item) => sum + (item.weightGm || 0), 0);
        const totalValue = items.reduce((sum, item) => sum + (item.currentValue || 0), 0);
        const urlType = title.toLowerCase().replace(' ', '_');
        const hideWeight = urlType === 'antique_coins' || urlType === 'currencies';

        return (
            <div
                onClick={() => navigate(`/metals/${urlType}`)}
                style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.4)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '1.25rem',
                    border: `1px solid ${borderClr}`,
                    padding: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    marginBottom: '1.25rem',
                    boxShadow: `0 4px 20px -2px ${glowBg}`
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', zIndex: 10 }}>
                    <div style={{
                        padding: '0.75rem',
                        borderRadius: '0.75rem',
                        backgroundColor: borderClr,
                        color: 'black',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Coins size={24} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: '0 0 0.25rem 0', letterSpacing: '-0.015em' }}>{title}</h3>
                        <p style={{ fontSize: '10px', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                            {items.length} positions
                        </p>
                    </div>
                </div>

                <div style={{ textAlign: 'right', position: 'relative', zIndex: 10 }}>
                    <p style={{ fontSize: '8px', color: '#71717a', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.125rem 0' }}>Current Valuation</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(totalValue)}</p>
                    {!hideWeight && (
                        <p style={{ fontSize: '10px', color: '#a1a1aa', marginTop: '0.25rem', margin: 0 }}>
                            {parseFloat(totalWeight.toFixed(4))}g weight
                        </p>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header Title Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2.5rem' }}>
                <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>Precious Metals</h2>
                <p style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>Manage and track your physical gold and silver assets</p>
            </div>

            {/* Stats Overview Panel */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                {/* Total Portfolio Value */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(24, 24, 27, 0.9) 100%)',
                    border: '1px solid rgba(234, 179, 8, 0.2)',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 10px 15px -3px rgba(234, 179, 8, 0.05)'
                }}>
                    <Coins style={{ position: 'absolute', top: 0, right: 0, padding: '0.75rem', opacity: 0.1, color: '#eab308' }} size={64} />
                    <div>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#eab308', marginBottom: '0.25rem', margin: 0 }}>Total Metals Value</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(totalMetalsValue)}</h3>
                    </div>
                    <p style={{ fontSize: '0.625rem', color: '#a1a1aa', marginTop: '0.75rem', margin: 0 }}>
                        Live evaluated bullion & coins worth
                    </p>
                </div>

                {/* Gold Price 24K */}
                <div style={{
                    backgroundColor: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#71717a', marginBottom: '0.25rem', margin: 0 }}>Gold Rate (24K)</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#eab308', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(metalRates?.gold || 0)} <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>/ g</span></h3>
                    </div>
                    <p style={{ fontSize: '0.625rem', color: '#a1a1aa', marginTop: '0.75rem', margin: 0 }}>
                        Gold holdings weight: <span style={{ fontWeight: 'bold', color: 'white' }}>{parseFloat(goldWeight.toFixed(3))}g</span>
                    </p>
                </div>

                {/* Silver Rate */}
                <div style={{
                    backgroundColor: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#71717a', marginBottom: '0.25rem', margin: 0 }}>Silver Rate</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#cbd5e1', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(metalRates?.silver || 0)} <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>/ g</span></h3>
                    </div>
                    <p style={{ fontSize: '0.625rem', color: '#a1a1aa', marginTop: '0.75rem', margin: 0 }}>
                        Silver holdings weight: <span style={{ fontWeight: 'bold', color: 'white' }}>{parseFloat(silverWeight.toFixed(3))}g</span>
                    </p>
                </div>
            </div>

            {/* Quick Actions Panel */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '2.5rem'
            }}>
                <button
                    onClick={() => handleAddItem('gold')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.75rem',
                        backgroundColor: '#eab308',
                        color: 'black',
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        cursor: 'pointer',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgba(234, 179, 8, 0.2)'
                    }}
                >
                    <Plus size={16} /> Add Gold
                </button>
                <button
                    onClick={() => handleAddItem('silver')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.75rem',
                        backgroundColor: '#475569',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        cursor: 'pointer',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: '0 4px 6px -1px rgba(71, 85, 105, 0.2)'
                    }}
                >
                    <Plus size={16} /> Add Silver
                </button>
                <button
                    onClick={() => handleAddItem('platinum')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.75rem',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        cursor: 'pointer',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: '0 4px 6px -1px rgba(107, 114, 128, 0.2)'
                    }}
                >
                    <Plus size={16} /> Add Platinum
                </button>
                <button
                    onClick={() => handleAddItem('antique_coins')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.75rem',
                        backgroundColor: '#78350f',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        cursor: 'pointer',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: '0 4px 6px -1px rgba(120, 53, 15, 0.2)'
                    }}
                >
                    <Plus size={16} /> Add Antique Coin
                </button>
                <button
                    onClick={() => handleAddItem('currencies')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.75rem',
                        backgroundColor: '#059669',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        cursor: 'pointer',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.2)'
                    }}
                >
                    <Plus size={16} /> Add Currency
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                {renderMetalSection('Gold', metals.gold, 'rgba(234, 179, 8, 0.5)', 'rgba(234, 179, 8, 0.02)')}
                {renderMetalSection('Silver', metals.silver, 'rgba(203, 213, 225, 0.5)', 'rgba(203, 213, 225, 0.02)')}
                {renderMetalSection('Platinum', metals.platinum, 'rgba(148, 163, 184, 0.5)', 'rgba(148, 163, 184, 0.02)')}
                {renderMetalSection('Antique Coins', metals.antique_coins, 'rgba(205, 133, 63, 0.5)', 'rgba(205, 133, 63, 0.02)')}
                {renderMetalSection('Currencies', metals.currencies, 'rgba(52, 211, 153, 0.5)', 'rgba(52, 211, 153, 0.02)')}
            </div>

            <MetalModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdd={(data) => addMetal(modalType, data)}
                metalType={modalType}
            />
        </div>
    );
};

export default Metals;
