import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Shield, CheckCircle, Clock, Plus, Edit2, Trash2 } from 'lucide-react';
import PolicyPremiumModal from '../components/PolicyPremiumModal';

const PolicyDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPremium, setEditingPremium] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);

    const policy = savings.find(s => s.id.toString() === id);

    const policyCalcs = useMemo(() => {
        if (!policy) {
            return {
                totalPaid: 0,
                amountReceivedBack: 0,
                currentValue: 0,
                totalAmountToBePaid: 0,
                remainingAmountToBePaid: 0,
                details: {},
                premiums: []
            };
        }

        const details = policy.policyDetails || {};
        const premiums = policy.premiums || [];

        const totalPaid = premiums
            .filter(p => p.status === 'Paid')
            .reduce((sum, p) => sum + p.amount, 0);

        const amountReceivedBack = premiums
            .filter(p => p.status === 'Received Back' || p.status === 'Received')
            .reduce((sum, p) => sum + p.amount, 0);

        const currentValue = totalPaid - amountReceivedBack;

        // Calculate total amount to be paid over the term
        const totalAmountToBePaid = (details.premiumAmount || 0) * (details.premiumPayingTerm || 0);
        const remainingAmountToBePaid = totalAmountToBePaid - totalPaid;

        return {
            totalPaid,
            amountReceivedBack,
            currentValue,
            totalAmountToBePaid,
            remainingAmountToBePaid,
            details,
            premiums
        };
    }, [policy]);

    if (!policy) {
        return (
            <div style={{ padding: 'var(--spacing-lg)' }}>
                <p>Policy not found.</p>
                <button
                    onClick={() => navigate(-1)}
                    className="text-primary hover:underline mt-4"
                >
                    Back to Savings
                </button>
            </div>
        );
    }

    const {
        totalPaid,
        amountReceivedBack,
        currentValue,
        totalAmountToBePaid,
        remainingAmountToBePaid,
        details,
        premiums
    } = policyCalcs;

    const handleSavePremium = (premium) => {
        let updatedPremiums = [...premiums];
        if (editingIndex !== null) {
            updatedPremiums[editingIndex] = premium;
        } else {
            updatedPremiums.push(premium);
        }

        // Calculate amount paid for policy summary if needed
        const newTotalPaid = updatedPremiums
            .filter(p => p.status === 'Paid')
            .reduce((sum, p) => sum + p.amount, 0);

        // we might want to update the main 'amount' field of the policy too
        updateItem('savings', { ...policy, premiums: updatedPremiums, amount: newTotalPaid });
        setIsModalOpen(false);
        setEditingPremium(null);
        setEditingIndex(null);
    };

    const handleDeletePremium = (index) => {
        if (window.confirm('Delete this premium entry?')) {
            const updatedPremiums = premiums.filter((_, i) => i !== index);
            const newTotalPaid = updatedPremiums
                .filter(p => p.status === 'Paid')
                .reduce((sum, p) => sum + p.amount, 0);
            updateItem('savings', { ...policy, premiums: updatedPremiums, amount: newTotalPaid });
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }} className="animate-fade-in">
            {/* Custom Styles Injection */}
            <style>{`
                .pol-glass-panel {
                    background: rgba(10, 11, 20, 0.45) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(245, 158, 11, 0.15) !important;
                    border-radius: 1.5rem !important;
                    padding: 1.5rem !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 20px 1px rgba(245, 158, 11, 0.05) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .pol-glass-panel:hover {
                    transform: translateY(-4px) !important;
                    border-color: rgba(245, 158, 11, 0.35) !important;
                    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px 2px rgba(245, 158, 11, 0.15) !important;
                }
                .pol-glass-glow-card {
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(10, 11, 20, 0.5) 100%) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(245, 158, 11, 0.25) !important;
                    border-radius: 1.5rem !important;
                    padding: 1.5rem !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6), 0 0 25px 2px rgba(245, 158, 11, 0.1) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .pol-glass-glow-card:hover {
                    transform: translateY(-4px) !important;
                    border-color: rgba(245, 158, 11, 0.5) !important;
                    box-shadow: 0 20px 45px -15px rgba(0, 0, 0, 0.8), 0 0 35px 3px rgba(245, 158, 11, 0.25) !important;
                }
                .pol-glass-glow-card-emerald {
                    background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(10, 11, 20, 0.5) 100%) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(16, 185, 129, 0.25) !important;
                    border-radius: 1.5rem !important;
                    padding: 1.5rem !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6), 0 0 25px 2px rgba(16, 185, 129, 0.1) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .pol-glass-glow-card-emerald:hover {
                    transform: translateY(-4px) !important;
                    border-color: rgba(16, 185, 129, 0.5) !important;
                    box-shadow: 0 20px 45px -15px rgba(0, 0, 0, 0.8), 0 0 35px 3px rgba(16, 185, 129, 0.25) !important;
                }
                .pol-table-container {
                    background: rgba(10, 11, 20, 0.35) !important;
                    backdrop-filter: blur(12px) !important;
                    -webkit-backdrop-filter: blur(12px) !important;
                    border-radius: 1.5rem !important;
                    border: 1px solid rgba(255, 255, 255, 0.05) !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.4) !important;
                    overflow: hidden !important;
                }
                .pol-table-header {
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                    padding: 1.5rem !important;
                    margin: 0 !important;
                }
                .pol-table {
                    width: 100%;
                    border-collapse: separate !important;
                    border-spacing: 0 !important;
                }
                .pol-table th {
                    background-color: rgba(255, 255, 255, 0.02) !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                    color: rgba(255, 255, 255, 0.5) !important;
                    font-weight: 700 !important;
                    font-size: 0.75rem !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                }
                .pol-table td {
                    border-bottom: 1px solid rgba(255, 255, 255, 0.03) !important;
                    transition: all 0.2s ease !important;
                }
                .pol-table tr:last-child td {
                    border-bottom: none !important;
                }
                .pol-table tr:hover td {
                    background-color: rgba(245, 158, 11, 0.04) !important;
                    color: #ffffff !important;
                }
            `}</style>

            <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-200 hover:text-white transition-all duration-300 mb-8 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 hover:bg-white/20 hover:border-white/30 backdrop-blur-md shadow-lg"
                style={{ cursor: 'pointer' }}
            >
                <ArrowLeft size={16} className="text-white" /> Back to Savings
            </button>

            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
                            <Shield className="text-orange-400" size={32} />
                            {policy.title}
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">{details.planName}</p>
                    </div>
                    <div className={`self-start sm:self-auto px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${details.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                        {details.status === 'Active' ? <CheckCircle size={12} /> : <Clock size={12} />}
                        {details.status}
                    </div>
                </div>
                <button
                    onClick={() => { setEditingPremium(null); setEditingIndex(null); setIsModalOpen(true); }}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 text-sm transition-all shadow-lg shadow-orange-500/25"
                >
                    <Plus size={18} />
                    Add Premium
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-10">
                <div className="pol-glass-panel">
                    <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Policy Number</p>
                    <p className="font-mono font-bold text-lg tracking-tight text-white">{details.policyNumber}</p>
                    <p className="text-xs text-gray-600 mt-1">Unique Identifier</p>
                </div>
                <div className="pol-glass-panel">
                    <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Term Dates</p>
                    <p className="font-bold text-sm tracking-tight text-white mt-1">Start: {details.startDate}</p>
                    <p className="font-bold text-sm tracking-tight text-white">End: {details.maturityDate}</p>
                </div>
                <div className="pol-glass-panel">
                    <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Amount To Be Paid</p>
                    <p className="font-bold text-2xl tracking-tight text-white">{formatCurrency(totalAmountToBePaid)}</p>
                    <p className="text-xs text-gray-600 mt-1">Contract value</p>
                </div>
                <div className="pol-glass-panel">
                    <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Remaining Amount</p>
                    <p className="font-bold text-2xl tracking-tight text-gray-400">{formatCurrency(remainingAmountToBePaid)}</p>
                    <p className="text-xs text-gray-600 mt-1">Future Premium Liability</p>
                </div>
                <div className="pol-glass-panel">
                    <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Premium Paid</p>
                    <p className="font-bold text-2xl tracking-tight text-white">{formatCurrency(totalPaid)}</p>
                    <p className="text-xs text-gray-600 mt-1">Total invested capital</p>
                </div>
                <div className="pol-glass-panel">
                    <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Amount Received Back</p>
                    <p className="font-bold text-2xl tracking-tight text-success">{formatCurrency(amountReceivedBack)}</p>
                    <p className="text-xs text-gray-600 mt-1">Survival benefits / withdrawals</p>
                </div>
                <div className="pol-glass-glow-card-emerald">
                    <p className="text-emerald-300 text-xs font-black uppercase tracking-widest mb-1">Current Value</p>
                    <p className="font-bold text-2xl tracking-tight text-emerald-400">{formatCurrency(currentValue)}</p>
                    <p className="text-xs text-emerald-500/70 mt-1">Paid net of benefits</p>
                </div>
            </div>

            <div className="pol-table-container">
                <h3 className="text-lg font-bold tracking-tight text-white pol-table-header">Premium History</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table className="pol-table">
                        <thead>
                            <tr>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Invested Date</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Amount Invested</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left', paddingLeft: '2rem' }}>Remarks</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {premiums.map((p, index) => (
                                <tr key={index} className="group">
                                    <td style={{ padding: '1.25rem 1rem', color: 'var(--text-primary)' }}>{p.paidDate || '-'}</td>
                                    <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: '500' }}>{formatCurrency(p.amount)}</td>
                                    <td style={{ padding: '1.25rem 1rem', paddingLeft: '2rem', color: 'var(--text-secondary)' }}>
                                        {p.status === 'Paid' ? `Receipt: ${p.receiptNo}` : p.status}
                                    </td>
                                    <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingPremium(p); setEditingIndex(index); setIsModalOpen(true); }}
                                                className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeletePremium(index)}
                                                className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!premiums.length && (
                                <tr>
                                    <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No premium history found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <PolicyPremiumModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSavePremium}
                initialData={editingPremium}
            />
        </div>
    );
};

export default PolicyDetails;
