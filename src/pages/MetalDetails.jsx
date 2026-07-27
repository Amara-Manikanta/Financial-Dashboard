import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Coins, Plus, Edit2, Trash2, MapPin, Settings, X, RefreshCw } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import BackButton from '../components/BackButton';
import MetalModal from '../components/MetalModal';

const MetalDetails = () => {
    const { type } = useParams(); // 'gold' or 'silver'
    const navigate = useNavigate();
    const { metals, formatCurrency, addMetal, updateMetal, deleteMetal, metalRates, manualMetalRates, updateManualRates } = useFinance();

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [isRateModalOpen, setIsRateModalOpen] = useState(false);

    // Rate state
    const [goldRate, setGoldRate] = useState('');
    const [silverRate, setSilverRate] = useState('');

    const metalItems = metals[type] || [];

    // Filter items based on search term
    const filteredItems = metalItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.purity && item.purity.toString().includes(searchTerm)) ||
        (item.place && item.place.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.remarks && item.remarks.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const formattedType = type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    const colorHex = type === 'gold' ? '#eab308' : type === 'silver' ? '#cbd5e1' : type === 'antique_coins' ? '#cd853f' : '#34d399';
    const accentBgHex = type === 'gold' ? '#eab308' : type === 'silver' ? '#64748b' : type === 'antique_coins' ? '#8b5a2b' : '#059669';
    const accentBorderHex = type === 'gold' ? 'rgba(234, 179, 8, 0.2)' : type === 'silver' ? 'rgba(100, 116, 139, 0.2)' : type === 'antique_coins' ? 'rgba(139, 90, 43, 0.2)' : 'rgba(5, 150, 105, 0.2)';
    const accentGlowHex = type === 'gold' ? 'rgba(234, 179, 8, 0.05)' : type === 'silver' ? 'rgba(100, 116, 139, 0.05)' : type === 'antique_coins' ? 'rgba(139, 90, 43, 0.05)' : 'rgba(5, 150, 105, 0.05)';

    // Calculate aggregate stats (on all items, not filtered)
    const totalWeight = metalItems.reduce((sum, item) => sum + item.weightGm, 0);
    const totalCurrentValue = metalItems.reduce((sum, item) => sum + item.currentValue, 0);
    const totalInvested = metalItems.reduce((sum, item) => sum + item.purchasePrice, 0);

    // Determine active rate
    // Note: manualMetalRates might be undefined if not yet loaded, handle safely
    const isManualRateActive = (type === 'gold' && Number(manualMetalRates?.gold) > 0) || (type === 'silver' && Number(manualMetalRates?.silver) > 0);

    const currentRate = type === 'gold'
        ? (isManualRateActive ? Number(manualMetalRates?.gold) : (metalRates.gold || 0))
        : (isManualRateActive ? Number(manualMetalRates?.silver) : (metalRates.silver || 0));

    const handleEdit = (item) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        if (window.confirm(`Are you sure you want to delete this ${type} item?`)) {
            deleteMetal(type, id);
        }
    };

    const handleSave = (data) => {
        if (editingItem) {
            updateMetal(type, data);
        } else {
            addMetal(type, data);
        }
        setEditingItem(null);
    };

    // Rate Modal Handlers
    const openRateModal = () => {
        setGoldRate(manualMetalRates?.gold || '');
        setSilverRate(manualMetalRates?.silver || '');
        setIsRateModalOpen(true);
    };

    const handleRateSubmit = (e) => {
        e.preventDefault();
        updateManualRates({
            gold: parseFloat(goldRate) || 0,
            silver: parseFloat(silverRate) || 0
        });
        setIsRateModalOpen(false);
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header Section */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                <BackButton label="Back to Precious Metals" to="/metals" style={{ marginBottom: 0 }} />

                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1.5rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            padding: '1rem',
                            borderRadius: '1.25rem',
                            backgroundColor: accentBorderHex,
                            color: colorHex,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Coins size={32} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
                                    {formattedType} <span style={{ color: '#71717a' }}>Portfolio</span>
                                </h2>
                                <button
                                    onClick={openRateModal}
                                    style={{
                                        padding: '0.375rem',
                                        borderRadius: '50%',
                                        backgroundColor: isManualRateActive ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.05)',
                                        color: isManualRateActive ? '#eab308' : '#71717a',
                                        cursor: 'pointer',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    title="Set Manual Rates"
                                >
                                    <Settings size={18} />
                                </button>
                            </div>
                            {type !== 'antique_coins' && type !== 'currencies' && (
                                <div
                                    onClick={openRateModal}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        marginTop: '0.375rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        color: '#71717a',
                                        cursor: 'pointer'
                                    }}
                                    title="Click to edit rate"
                                >
                                    {isManualRateActive ? (
                                        <span style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Edit2 size={12} /> Manual Rate:
                                        </span>
                                    ) : (
                                        <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <RefreshCw size={12} /> Live Rate:
                                        </span>
                                    )}
                                    <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{formatCurrency(currentRate)}/g</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        {/* Search Bar */}
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="Search items..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    borderRadius: '1rem',
                                    padding: '0.75rem 1rem 0.75rem 2.5rem',
                                    width: '240px',
                                    outline: 'none'
                                }}
                            />
                            <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }}>🔍</span>
                        </div>

                        <button
                            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '1rem',
                                backgroundColor: accentBgHex,
                                color: type === 'gold' ? 'black' : 'white',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                cursor: 'pointer',
                                border: 'none',
                                boxShadow: `0 4px 10px -2px ${accentGlowHex}`
                            }}
                        >
                            <Plus size={16} /> Add {formattedType}
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                {/* Total accumulation */}
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
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#71717a', marginBottom: '0.25rem', margin: 0 }}>
                            {type === 'antique_coins' || type === 'currencies' ? 'Total Items' : 'Total Accumulation'}
                        </p>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>
                            {type === 'antique_coins' || type === 'currencies' ? metalItems.length : parseFloat(totalWeight.toFixed(4))}
                            {type !== 'antique_coins' && type !== 'currencies' && (
                                <span style={{ fontSize: '0.875rem', color: '#71717a', marginLeft: '0.25rem' }}>grams</span>
                            )}
                        </h3>
                    </div>
                </div>

                {/* Historical invested */}
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
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '850', color: '#71717a', marginBottom: '0.25rem', margin: 0 }}>Historical Investment</p>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(totalInvested)}</h3>
                    </div>
                </div>

                {/* Current Valuation */}
                <div style={{
                    background: `linear-gradient(135deg, ${accentGlowHex} 0%, rgba(24, 24, 27, 0.9) 100%)`,
                    border: `1px solid ${accentBorderHex}`,
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: `0 10px 15px -3px ${accentGlowHex}`
                }}>
                    <div>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: colorHex, marginBottom: '0.25rem', margin: 0 }}>Current Valuation</p>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: '950', color: colorHex, fontFamily: 'monospace', margin: 0 }}>{formatCurrency(totalCurrentValue)}</h3>
                    </div>
                </div>
            </div>

            {/* Holdings Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '2rem',
                marginBottom: '2.5rem'
            }}>
                {filteredItems.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => navigate(`/metals/${type}/${item.id}`)}
                        style={{
                            backgroundColor: 'rgba(24, 24, 27, 0.4)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '2rem',
                            overflow: 'hidden',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            height: '340px',
                            justifyContent: 'space-between',
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                        }}
                    >
                        {/* Image Header Block */}
                        <div style={{ position: 'relative', height: '160px', backgroundColor: 'rgba(255, 255, 255, 0.02)', overflow: 'hidden' }}>
                            {item.image ? (
                                <img
                                    src={item.image}
                                    alt={item.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Coins size={40} style={{ opacity: 0.15, color: colorHex }} />
                                </div>
                            )}

                            {/* Tags overlay */}
                            {type === 'gold' && item.purity && (
                                <div style={{
                                    position: 'absolute',
                                    top: '1rem',
                                    left: '1rem',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(234, 179, 8, 0.2)',
                                    border: '1px solid rgba(234, 179, 8, 0.3)',
                                    fontSize: '9px',
                                    fontWeight: '900',
                                    color: '#eab308'
                                }}>
                                    {item.purity}K
                                </div>
                            )}
                            {type === 'antique_coins' && item.printedYear && (
                                <div style={{
                                    position: 'absolute',
                                    top: '1rem',
                                    left: '1rem',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(205, 133, 63, 0.2)',
                                    border: '1px solid rgba(205, 133, 63, 0.3)',
                                    fontSize: '9px',
                                    fontWeight: '900',
                                    color: '#cd853f'
                                }}>
                                    {item.printedYear}
                                </div>
                            )}
                            {type === 'currencies' && (
                                <div style={{
                                    position: 'absolute',
                                    top: '1rem',
                                    left: '1rem',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(52, 211, 153, 0.2)',
                                    border: '1px solid rgba(52, 211, 153, 0.3)',
                                    fontSize: '9px',
                                    fontWeight: '900',
                                    color: '#34d399'
                                }}>
                                    {item.currencyCode || 'Currency'}
                                </div>
                            )}
                        </div>

                        {/* Card Info Content */}
                        <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: '0 0 0.25rem 0' }}>{item.name}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#71717a', fontSize: '10px' }}>
                                        <MapPin size={10} style={{ color: colorHex }} />
                                        <span>{item.place || 'Unknown Place'}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.375rem' }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                                        style={{
                                            padding: '0.375rem',
                                            borderRadius: '0.5rem',
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            color: 'white',
                                            cursor: 'pointer',
                                            border: 'none',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                        title="Edit Item"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                        style={{
                                            padding: '0.375rem',
                                            borderRadius: '0.5rem',
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                            color: '#f87171',
                                            cursor: 'pointer',
                                            border: 'none',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                        title="Delete Item"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div style={{
                                marginTop: '1rem',
                                padding: '0.75rem',
                                borderRadius: '1rem',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <p style={{ fontSize: '8px', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.125rem 0' }}>
                                        {type === 'antique_coins' ? 'Quantity' : type === 'currencies' ? 'Foreign Value' : 'Weight'}
                                    </p>
                                    <p style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'white', margin: 0 }}>
                                        {type === 'antique_coins' ? (item.quantity || 1) : type === 'currencies' ? `${item.currencyCode || ''} ${item.foreignValue || 0}` : `${item.weightGm}g`}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '8px', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.125rem 0' }}>Value</p>
                                    <p style={{ fontSize: '1rem', fontWeight: '950', color: colorHex, margin: 0 }}>{formatCurrency(item.currentValue)}</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '8px', color: '#52525b', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                                <span>{formatDate(item.purchaseDate)}</span>
                                <span>
                                    ID: {type === 'gold' ? 'G' : type === 'silver' ? 'S' : type === 'antique_coins' ? 'A' : 'C'}{(filteredItems.indexOf(item) + 1)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty States */}
            {filteredItems.length === 0 && metalItems.length > 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '6rem 1.5rem',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    borderRadius: '1.5rem'
                }}>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#71717a', marginBottom: '0.5rem' }}>No results found for "{searchTerm}"</h4>
                    <button
                        onClick={() => setSearchTerm('')}
                        style={{
                            fontSize: '10px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            color: 'white',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            padding: '0.5rem 1.5rem',
                            border: 'none',
                            borderRadius: '0.75rem',
                            cursor: 'pointer'
                        }}
                    >
                        Clear Search Filter
                    </button>
                </div>
            )}

            {metalItems.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '6rem 1.5rem',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    borderRadius: '1.5rem'
                }}>
                    <Coins size={48} style={{ color: '#71717a', marginBottom: '1rem' }} />
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>Portfolio is Empty</h4>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', marginBottom: '1.5rem' }}>Start building your {type} wealth by adding your first item.</p>
                    <button
                        onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                        style={{
                            fontSize: '10px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            color: colorHex,
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer'
                        }}
                    >
                        + Add New Entry
                    </button>
                </div>
            )}

            <MetalModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
                onAdd={handleSave}
                initialData={editingItem}
                metalType={type}
            />

            {/* Manual Rate Modal */}
            {/* Manual Rate Modal */}
            {isRateModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsRateModalOpen(false)}
                >
                    <div
                        className="bg-[#1c1c20] w-full max-w-md rounded-[32px] border border-white/10 shadow-2xl p-8 relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setIsRateModalOpen(false)}
                            className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-500">
                                <Settings size={24} />
                            </div>
                            <h2 className="text-2xl font-black text-white">Set Manual Rates</h2>
                        </div>
                        <p className="text-gray-400 text-sm mb-6 ml-1">Enter today's market rates (per gram). Set to 0 to use live API rates.</p>

                        <form onSubmit={handleRateSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Gold Rate (24K / gram)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold pointer-events-none">₹</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={goldRate}
                                        onChange={(e) => setGoldRate(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-white font-bold focus:outline-none focus:border-yellow-500/50 transition-colors"
                                        placeholder="e.g. 7800"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Silver Rate (per gram)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold pointer-events-none">₹</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={silverRate}
                                        onChange={(e) => setSilverRate(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-white font-bold focus:outline-none focus:border-slate-500/50 transition-colors"
                                        placeholder="e.g. 95"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:bg-gray-200 transition-all transform active:scale-95"
                            >
                                Save Rates
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div >
    );
};

export default MetalDetails;
