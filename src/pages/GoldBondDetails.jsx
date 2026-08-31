import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, ScrollText, Plus, Edit2, Trash2, Coins } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import SGBTransactionModal from '../components/SGBTransactionModal';
import SGBInterestModal from '../components/SGBInterestModal';
import { readHolding, writeHolding, holdingGain, totalValue } from '../utils/sgb';
import BackButton from '../components/BackButton';

const GoldBondDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingHolding, setEditingHolding] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);

    // Interest Modal State
    const [isInterestModalOpen, setIsInterestModalOpen] = useState(false);
    const [editingInterest, setEditingInterest] = useState(null);

    const sgb = savings.find(s => s.id === id);

    if (!sgb) {
        return (
            <div style={{ padding: 'var(--spacing-lg)' }}>
                <p>Gold Bond Account not found.</p>
                <button
                    onClick={() => navigate(-1)}
                    className="text-primary hover:underline mt-4"
                >
                    Back to Savings
                </button>
            </div>
        );
    }

    const handleSaveHolding = (holdingData) => {
        const updatedHoldings = [...sgb.holdings];
        if (editingIndex !== null) {
            // Written back in the stored shape, spread over the existing row so
            // its id and any field this form does not expose survive.
            updatedHoldings[editingIndex] = writeHolding(holdingData, sgb.holdings[editingIndex]);
        } else {
            updatedHoldings.push(writeHolding(holdingData));
        }

        updateItem('savings', { ...sgb, holdings: updatedHoldings, amount: totalValue(updatedHoldings) });
        setIsModalOpen(false);
        setEditingHolding(null);
        setEditingIndex(null);
    };

    const handleDeleteHolding = (index) => {
        if (window.confirm('Delete this gold bond holding?')) {
            const updatedHoldings = sgb.holdings.filter((_, i) => i !== index);
            updateItem('savings', { ...sgb, holdings: updatedHoldings, amount: totalValue(updatedHoldings) });
        }
    };

    const handleSaveInterest = (interestData) => {
        let updatedInterest = [...(sgb.interestTransactions || [])];

        // Check if editing existing
        const existingIndex = updatedInterest.findIndex(i => i.id === interestData.id);

        if (existingIndex >= 0) {
            updatedInterest[existingIndex] = interestData;
        } else {
            updatedInterest.push(interestData);
        }

        // Sort by date desc
        updatedInterest.sort((a, b) => new Date(b.date) - new Date(a.date));

        updateItem('savings', {
            ...sgb,
            interestTransactions: updatedInterest
        });

        setIsInterestModalOpen(false);
        setEditingInterest(null);
    };

    const handleDeleteInterest = (id) => {
        if (window.confirm('Delete this interest entry?')) {
            const updatedInterest = (sgb.interestTransactions || []).filter(i => i.id !== id);
            updateItem('savings', {
                ...sgb,
                interestTransactions: updatedInterest
            });
        }
    };

    // Through the normaliser: reading purchasePrice as `issuePrice` straight off
    // the stored row gave undefined, so invested — and every figure derived from
    // it — came out NaN.
    const normalisedHoldings = sgb.holdings.map(readHolding);
    const totalUnits = normalisedHoldings.reduce((sum, item) => sum + item.units, 0);
    const totalInvested = normalisedHoldings.reduce((sum, item) => sum + (item.units * item.issuePrice), 0);
    const totalCurrentValue = totalValue(sgb.holdings);
    const totalGain = totalCurrentValue - totalInvested;
    const gainPercentage = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
    const isProfit = totalGain >= 0;

    const totalInterestReceived = (sgb.interestTransactions || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const glassCardStyle = {
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: '1.25rem',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        transition: 'transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'
    };

    return (
        <div style={{ padding: 'var(--spacing-xl) var(--spacing-lg)', minHeight: '100vh', backgroundColor: '#070715' }}>
            <BackButton label="Back to Investments" />

            <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h2 className="text-4xl font-black mb-2 flex items-center gap-4 text-white tracking-tight">
                        <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                            <ScrollText className="text-amber-400" size={32} />
                        </div>
                        {sgb.name}
                    </h2>
                    <p className="text-zinc-400 font-semibold uppercase tracking-widest text-[10px] pl-1">Sovereign Gold Bonds</p>
                </div>
                <button
                    onClick={() => { setEditingHolding(null); setEditingIndex(null); setIsModalOpen(true); }}
                    className="w-full md:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:brightness-110 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] text-xs uppercase tracking-widest active:scale-95"
                >
                    <Plus size={16} />
                    Add Holding
                </button>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                <div className="card p-6" style={glassCardStyle}>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Total Gold Units</p>
                    <p className="text-2xl font-black text-white">{totalUnits} g</p>
                </div>
                <div className="card p-6" style={glassCardStyle}>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Total Invested</p>
                    <p className="text-2xl font-black text-white">{formatCurrency(totalInvested)}</p>
                </div>
                <div className="card p-6" style={{
                    ...glassCardStyle,
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.02))',
                    border: '1px solid rgba(59, 130, 246, 0.15)'
                }}>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Current Value</p>
                    <p className="text-2xl font-black text-white">{formatCurrency(totalCurrentValue)}</p>
                </div>
                <div className="card p-6" style={{
                    ...glassCardStyle,
                    background: isProfit 
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02))'
                        : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.02))',
                    border: isProfit 
                        ? '1px solid rgba(16, 185, 129, 0.15)'
                        : '1px solid rgba(239, 68, 68, 0.15)'
                }}>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Total Gains</p>
                    <div className="flex items-center gap-2">
                        <p className={`text-2xl font-black ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(totalGain)}
                        </p>
                        <span className={`text-xs font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                            ({isProfit ? '+' : ''}{gainPercentage.toFixed(2)}%)
                        </span>
                    </div>
                </div>
                <div className="card p-6" style={{
                    ...glassCardStyle,
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02))',
                    border: '1px solid rgba(16, 185, 129, 0.15)'
                }}>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Interest Received</p>
                    <p className="text-2xl font-black text-emerald-400">{formatCurrency(totalInterestReceived)}</p>
                </div>
            </div>

            <div className="card p-0 overflow-hidden shadow-2xl mb-12" style={glassCardStyle}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                                <th className="py-5 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Series Name</th>
                                <th className="py-5 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Issue Date</th>
                                <th className="py-5 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Units (g)</th>
                                <th className="py-5 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Issue Price</th>
                                <th className="py-5 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Current Price</th>
                                <th className="py-5 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Current Value</th>
                                <th className="py-5 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Maturity</th>
                                <th className="py-5 px-6 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-bold">
                            {sgb.holdings.map((stored, index) => {
                                // Read through the normaliser: these rows are stored
                                // as issueName/issueDate/purchasePrice.
                                const item = readHolding(stored);
                                const gain = holdingGain(stored);
                                return (
                                    <tr 
                                        key={index} 
                                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} 
                                        className="group hover:bg-white/[0.03] transition-colors"
                                    >
                                        <td className="py-5 px-6 font-mono text-zinc-200">{item.series}</td>
                                        <td className="py-5 px-6 text-zinc-400">{formatDate(item.date)}</td>
                                        <td className="py-5 px-6 text-right font-mono text-zinc-300">{item.units}</td>
                                        <td className="py-5 px-6 text-right font-mono text-zinc-500">{formatCurrency(item.issuePrice)}</td>
                                        <td className="py-5 px-6 text-right font-mono text-zinc-500">{formatCurrency(item.currentPrice)}</td>
                                        <td className="py-5 px-6 text-right font-mono">
                                            <div className="text-zinc-200">{formatCurrency(item.units * item.currentPrice)}</div>
                                            <div className="text-[10px] font-semibold" style={{ color: gain >= 0 ? '#10b981' : '#ef4444', marginTop: '2px' }}>
                                                {gain >= 0 ? '+' : ''}{formatCurrency(gain)}
                                            </div>
                                        </td>
                                        <td className="py-5 px-6 text-zinc-400">{formatDate(item.maturityDate)}</td>
                                        <td className="py-5 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    // readHolding, because the modal reads `series`/`issuePrice`
                                                    // and the row stores `issueName`/`purchasePrice`. Handing it
                                                    // the raw row opened a blank form, and writeHolding would
                                                    // then have written those blanks back over the real values.
                                                    onClick={() => { setEditingHolding(readHolding(item)); setEditingIndex(index); setIsModalOpen(true); }}
                                                    type="button"
                                                    className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all transform hover:scale-110"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteHolding(index)}
                                                    className="p-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all transform hover:scale-110"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mb-8 flex justify-between items-end mt-12">
                <div className="flex items-end gap-6">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-3 text-white tracking-tight">
                            <Coins className="text-emerald-400" size={24} />
                            Interest History
                        </h2>
                    </div>
                </div>
                <button
                    onClick={() => { setEditingInterest(null); setIsInterestModalOpen(true); }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white font-black py-3 px-5 rounded-2xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] text-xs uppercase tracking-widest active:scale-95"
                >
                    <Plus size={16} />
                    Add Interest
                </button>
            </div>

            <div className="card p-0 overflow-hidden shadow-2xl" style={glassCardStyle}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Date</th>
                                <th className="py-4 px-6 text-zinc-400 text-[10px] font-black uppercase tracking-widest">Remarks</th>
                                <th className="py-4 px-6 text-right text-zinc-400 text-[10px] font-black uppercase tracking-widest">Amount</th>
                                <th className="py-4 px-6 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-bold">
                            {(sgb.interestTransactions || []).length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="text-center py-8 text-zinc-500 italic">No interest records found</td>
                                </tr>
                            ) : (
                                (sgb.interestTransactions || []).map((item, index) => (
                                    <tr 
                                        key={item.id || index} 
                                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} 
                                        className="group hover:bg-white/[0.03] transition-colors"
                                    >
                                        <td className="py-4 px-6 text-zinc-300">{formatDate(item.date)}</td>
                                        <td className="py-4 px-6 text-zinc-400">{item.remarks || '-'}</td>
                                        <td className="py-4 px-6 text-right font-mono text-emerald-400">
                                            {formatCurrency(item.amount)}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingInterest(item); setIsInterestModalOpen(true); }}
                                                    className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteInterest(item.id)}
                                                    className="p-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <SGBTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveHolding}
                initialData={editingHolding}
            />

            <SGBInterestModal
                isOpen={isInterestModalOpen}
                onClose={() => setIsInterestModalOpen(false)}
                onSave={handleSaveInterest}
                initialData={editingInterest}
            />
        </div>
    );
};

export default GoldBondDetails;
