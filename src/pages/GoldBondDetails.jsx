import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, ScrollText, Plus, Edit2, Trash2, Coins } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import SGBTransactionModal from '../components/SGBTransactionModal';
import SGBInterestModal from '../components/SGBInterestModal';

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

    if (!sgb) return <div>ID not found</div>;

    const handleSaveHolding = (holdingData) => {
        let updatedHoldings = [...sgb.holdings];
        if (editingIndex !== null) {
            updatedHoldings[editingIndex] = holdingData;
        } else {
            updatedHoldings.push(holdingData);
        }

        const totalCurrentValue = updatedHoldings.reduce((sum, item) => sum + (item.units * item.currentPrice), 0);
        updateItem('savings', { ...sgb, holdings: updatedHoldings, amount: totalCurrentValue });
        setIsModalOpen(false);
        setEditingHolding(null);
        setEditingIndex(null);
    };

    const handleDeleteHolding = (index) => {
        if (window.confirm('Delete this gold bond holding?')) {
            const updatedHoldings = sgb.holdings.filter((_, i) => i !== index);
            const totalCurrentValue = updatedHoldings.reduce((sum, item) => sum + (item.units * item.currentPrice), 0);
            updateItem('savings', { ...sgb, holdings: updatedHoldings, amount: totalCurrentValue });
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

    const totalUnits = sgb.holdings.reduce((sum, item) => sum + item.units, 0);
    const totalInvested = sgb.holdings.reduce((sum, item) => sum + (item.units * item.issuePrice), 0);
    const totalCurrentValue = sgb.holdings.reduce((sum, item) => sum + (item.units * item.currentPrice), 0);
    const totalGain = totalCurrentValue - totalInvested;
    const gainPercentage = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

    const totalInterestReceived = (sgb.interestTransactions || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 hover:text-primary transition-colors mb-6"
                style={{ cursor: 'pointer', marginBottom: 'var(--spacing-lg)', color: 'white' }}
            >
                <ArrowLeft size={20} /> Back to Savings
            </button>

            <div className="mb-8 flex justify-between items-end">
                <div className="flex items-end gap-6">
                    <div>
                        <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                            <ScrollText className="text-accent-primary" size={32} />
                            {sgb.name}
                        </h2>
                        <p className="text-secondary">Sovereign Gold Bonds</p>
                    </div>
                </div>
                <button
                    onClick={() => { setEditingHolding(null); setEditingIndex(null); setIsModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/40"
                >
                    <Plus size={20} />
                    Add Holding
                </button>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Total Gold Units</p>
                    <p className="font-bold text-lg">{totalUnits} g</p>
                </div>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Total Invested</p>
                    <p className="font-bold text-lg">{formatCurrency(totalInvested)}</p>
                </div>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Current Value</p>
                    <p className="font-bold text-lg">{formatCurrency(totalCurrentValue)}</p>
                </div>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Total Gains</p>
                    <div className="flex items-end gap-2">
                        <p className={`text-3xl font-bold ${totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`} style={{ fontSize: '1.125rem', lineHeight: '1.75rem' }}>
                            {formatCurrency(totalGain)}
                        </p>
                        <p className={`text-sm mb-0 flex items-center ${totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`} style={{ marginBottom: '2px' }}>
                            ({gainPercentage.toFixed(2)}%)
                        </p>
                    </div>
                </div>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Interest Received</p>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-bold text-emerald-500" style={{ fontSize: '1.125rem', lineHeight: '1.75rem' }}>
                            {formatCurrency(totalInterestReceived)}
                        </p>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Series Name</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Issue Date</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Units (g)</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Issue Price</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Current Price</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Current Value</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Maturity</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sgb.holdings.map((item, index) => {
                            const gain = (item.currentPrice - item.issuePrice) * item.units;
                            return (
                                <tr key={index} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} className="group hover:bg-white/5 transition-colors">
                                    <td style={{ padding: 'var(--spacing-md)', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{item.series}</td>
                                    <td style={{ padding: 'var(--spacing-md)' }}>{formatDate(item.date)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>{item.units}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{formatCurrency(item.issuePrice)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{formatCurrency(item.currentPrice)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>
                                        <div style={{ fontWeight: 'bold' }}>{formatCurrency(item.units * item.currentPrice)}</div>
                                        <div style={{ fontSize: '0.75rem', color: gain >= 0 ? 'var(--color-success)' : 'var(--color-danger)', marginTop: '2px' }}>
                                            {gain >= 0 ? '+' : ''}{formatCurrency(gain)}
                                        </div>
                                    </td>
                                    <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
                                        {formatDate(item.maturityDate)}
                                    </td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingHolding(item); setEditingIndex(index); setIsModalOpen(true); }}
                                                className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteHolding(index)}
                                                className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mb-8 flex justify-between items-end mt-12">
                <div className="flex items-end gap-6">
                    <div>
                        <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                            <Coins className="text-emerald-400" size={24} />
                            Interest History
                        </h2>
                    </div>
                </div>
                <button
                    onClick={() => { setEditingInterest(null); setIsInterestModalOpen(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/40"
                >
                    <Plus size={20} />
                    Add Interest
                </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Date</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Remarks</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Amount</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(sgb.interestTransactions || []).length === 0 ? (
                            <tr>
                                <td colSpan="4" className="text-center py-8 text-gray-500 italic">No interest records found</td>
                            </tr>
                        ) : (
                            (sgb.interestTransactions || []).map((item, index) => (
                                <tr key={item.id || index} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} className="group hover:bg-white/5 transition-colors">
                                    <td style={{ padding: 'var(--spacing-md)' }}>{formatDate(item.date)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>{item.remarks || '-'}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                        {formatCurrency(item.amount)}
                                    </td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingInterest(item); setIsInterestModalOpen(true); }}
                                                className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteInterest(item.id)}
                                                className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
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
