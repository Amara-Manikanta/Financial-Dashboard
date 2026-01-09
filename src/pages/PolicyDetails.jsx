import React, { useState } from 'react';
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

    const details = policy.policyDetails || {};
    const premiums = policy.premiums || [];

    const handleSavePremium = (premium) => {
        let updatedPremiums = [...premiums];
        if (editingIndex !== null) {
            updatedPremiums[editingIndex] = premium;
        } else {
            updatedPremiums.push(premium);
        }

        // Calculate amount paid for policy summary if needed
        const totalPaid = updatedPremiums
            .filter(p => p.status === 'Paid')
            .reduce((sum, p) => sum + p.amount, 0);

        // we might want to update the main 'amount' field of the policy too
        updateItem('savings', { ...policy, premiums: updatedPremiums, amount: totalPaid });
        setIsModalOpen(false);
        setEditingPremium(null);
        setEditingIndex(null);
    };

    const handleDeletePremium = (index) => {
        if (window.confirm('Delete this premium entry?')) {
            const updatedPremiums = premiums.filter((_, i) => i !== index);
            const totalPaid = updatedPremiums
                .filter(p => p.status === 'Paid')
                .reduce((sum, p) => sum + p.amount, 0);
            updateItem('savings', { ...policy, premiums: updatedPremiums, amount: totalPaid });
        }
    };

    const totalPaid = premiums
        .filter(p => p.status === 'Paid')
        .reduce((sum, p) => sum + p.amount, 0);

    const amountReceivedBack = premiums
        .filter(p => p.status === 'Received Back' || p.status === 'Received')
        .reduce((sum, p) => sum + p.amount, 0);

    const currentValue = totalPaid - amountReceivedBack;

    // Calculate total amount to be paid over the term
    const totalAmountToBePaid = details.premiumAmount * details.premiumPayingTerm;
    const remainingAmountToBePaid = totalAmountToBePaid - totalPaid;

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
                            <Shield className="text-accent-primary" size={32} />
                            {policy.title}
                        </h2>
                        <p className="text-secondary">{details.planName}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 ${details.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {details.status === 'Active' ? <CheckCircle size={14} /> : <Clock size={14} />}
                        {details.status}
                    </div>
                </div>
                <button
                    onClick={() => { setEditingPremium(null); setEditingIndex(null); setIsModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/40"
                >
                    <Plus size={20} />
                    Add Premium
                </button>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Policy Number</p>
                    <p className="font-mono font-bold text-lg">{details.policyNumber}</p>
                </div>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Start Date</p>
                    <p className="font-bold text-lg">{details.startDate}</p>
                </div>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">End Date</p>
                    <p className="font-bold text-lg">{details.maturityDate}</p>
                </div>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Total Amount To Be Paid</p>
                    <p className="font-bold text-lg">{formatCurrency(totalAmountToBePaid)}</p>
                </div>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Remaining Amount</p>
                    <p className="font-bold text-lg text-secondary">{formatCurrency(remainingAmountToBePaid)}</p>
                </div>
                <div className="card">
                    <p className="text-secondary text-sm mb-1">Amount Received Back</p>
                    <p className="font-bold text-lg text-success">{formatCurrency(amountReceivedBack)}</p>
                </div>
                <div className="card bg-emerald-500/10 border-emerald-500/30 border">
                    <p className="text-emerald-400 text-sm mb-1">Current Value</p>
                    <p className="font-bold text-lg text-emerald-400">{formatCurrency(currentValue)}</p>
                </div>
            </div>


            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <h3 className="text-xl font-bold p-6 border-b border-gray-700">Premium History</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)' }}>Invested Date</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--text-secondary)' }}>Amount Invested</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--text-secondary)', paddingLeft: '2rem' }}>Remarks</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {premiums.map((p, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} className="hover:bg-white/5 transition-colors group">
                                <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-primary)' }}>{p.paidDate || '-'}</td>
                                <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(p.amount)}</td>
                                <td style={{ padding: 'var(--spacing-md)', paddingLeft: '2rem', color: 'var(--text-secondary)' }}>
                                    {p.status === 'Paid' ? `Receipt: ${p.receiptNo}` : p.status}
                                </td>
                                <td style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
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
                    </tbody>
                </table>
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
