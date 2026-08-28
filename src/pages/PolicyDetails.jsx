import React, { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Shield, CheckCircle, Clock, Plus, Edit2, Trash2, AlertTriangle, FileText, Download, Paperclip } from 'lucide-react';
import PolicyPremiumModal from '../components/PolicyPremiumModal';
import PolicyRecordModal from '../components/PolicyRecordModal';
import { uploadFile, isImageRef } from '../utils/uploadFile';
import BackButton from '../components/BackButton';

const PolicyDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPremium, setEditingPremium] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);

    // Benefits and claims share one modal; `recordKind` decides which it edits.
    const [recordKind, setRecordKind] = useState('benefit');
    const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [editingRecordIndex, setEditingRecordIndex] = useState(null);

    const docInputRef = useRef(null);
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);
    const [docError, setDocError] = useState('');

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
                premiums: [],
                benefits: [],
                claims: [],
                documents: []
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

        // Outstanding premiums, split by whether the due date has passed, so an
        // overdue instalment is obvious rather than buried in the table.
        const today = new Date().toISOString().split('T')[0];
        const pending = premiums.filter(p => p.status === 'To Pay');
        const overdue = pending.filter(p => p.dueDate && p.dueDate < today);
        const upcoming = pending.filter(p => !p.dueDate || p.dueDate >= today);
        const pendingAmount = pending.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        // Earliest unpaid due date across all pending premiums. Looking only at
        // upcoming ones reported "no due date" whenever everything was overdue.
        const nextDue = pending
            .filter(p => p.dueDate)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] || null;

        // Benefits the policy pays out (survival, maturity, bonus) and claims
        // made against it. Both are stored on the policy record.
        const benefits = policy.benefits || [];
        const claims = policy.claims || [];
        const documents = policy.documents || [];

        const benefitsReceived = benefits
            .filter(b => b.status === 'Received')
            .reduce((sum, b) => sum + (Number(b.settledAmount) || Number(b.amount) || 0), 0);
        const benefitsExpected = benefits
            .filter(b => b.status !== 'Received')
            .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

        const claimsSettled = claims
            .filter(c => c.status === 'Settled')
            .reduce((sum, c) => sum + (Number(c.settledAmount) || Number(c.amount) || 0), 0);
        const claimsOpen = claims.filter(c => !['Settled', 'Rejected'].includes(c.status));
        const claimsOpenAmount = claimsOpen.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

        return {
            totalPaid,
            amountReceivedBack,
            currentValue,
            totalAmountToBePaid,
            remainingAmountToBePaid,
            details,
            premiums,
            benefits,
            claims,
            documents,
            benefitsReceived,
            benefitsExpected,
            claimsSettled,
            claimsOpen,
            claimsOpenAmount,
            pending,
            overdue,
            upcoming,
            pendingAmount,
            nextDue,
            today
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
        premiums,
        benefits,
        claims,
        documents,
        benefitsReceived,
        benefitsExpected,
        claimsSettled,
        claimsOpen,
        claimsOpenAmount,
        pending,
        overdue,
        upcoming,
        pendingAmount,
        nextDue,
        today
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

    /** Benefits and claims are stored as arrays on the policy, like premiums. */
    const saveRecord = (record) => {
        const key = recordKind === 'claim' ? 'claims' : 'benefits';
        const list = [...(policy[key] || [])];
        if (editingRecordIndex !== null) list[editingRecordIndex] = record;
        else list.push(record);

        updateItem('savings', { ...policy, [key]: list });
        setIsRecordModalOpen(false);
        setEditingRecord(null);
        setEditingRecordIndex(null);
    };

    const deleteRecord = (kind, index) => {
        const key = kind === 'claim' ? 'claims' : 'benefits';
        if (!window.confirm(`Delete this ${kind}?`)) return;
        updateItem('savings', { ...policy, [key]: (policy[key] || []).filter((_, i) => i !== index) });
    };

    /**
     * Store policy paperwork — receipts, RC copies, original insurance
     * documents — as files under db/documents rather than in the database.
     */
    const handleAddDocument = async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;

        setIsUploadingDoc(true);
        setDocError('');
        try {
            const stored = await uploadFile(file, `${details.planName || policy.title}`, 'documents');
            updateItem('savings', {
                ...policy,
                documents: [...documents, { ...stored, uploadedAt: new Date().toISOString() }]
            });
        } catch (err) {
            console.error('Document upload failed:', err);
            setDocError(err.message || 'Document upload failed');
        } finally {
            setIsUploadingDoc(false);
        }
    };

    const handleDeleteDocument = (index) => {
        if (!window.confirm('Remove this document?')) return;
        updateItem('savings', { ...policy, documents: documents.filter((_, i) => i !== index) });
    };

    const openRecordModal = (kind, record = null, index = null) => {
        setRecordKind(kind);
        setEditingRecord(record);
        setEditingRecordIndex(index);
        setIsRecordModalOpen(true);
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

            <BackButton label="Back to Savings" />

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
                    <p className="font-bold text-sm tracking-tight text-white mt-1">
                        Start: {details.startDate || <span className="text-gray-600">not recorded</span>}
                    </p>
                    <p className="font-bold text-sm tracking-tight text-white">
                        End: {details.maturityDate || details.expiryDate || <span className="text-gray-600">not recorded</span>}
                    </p>
                    {(details.policyTerm || details.premiumPayingTerm) && (
                        <p className="text-xs text-gray-500 mt-1.5">
                            {details.policyTerm ? `${details.policyTerm} year term` : ''}
                            {details.policyTerm && details.premiumPayingTerm ? ' · ' : ''}
                            {details.premiumPayingTerm ? `paying ${details.premiumPayingTerm} years` : ''}
                        </p>
                    )}
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

            {/* What the plan promises. Kept next to what it has actually paid,
                so the two can be compared without opening the policy document. */}
            {(details.payoutSchedule || (details.benefitPoints || []).length > 0) && (
                <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
                    <p className="mb-3 text-xs font-black uppercase tracking-widest text-emerald-400">
                        What this policy gives back
                    </p>

                    {details.payoutSchedule && (
                        <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-gray-300">
                            {details.payoutSchedule}
                        </p>
                    )}

                    {(details.benefitPoints || []).length > 0 && (
                        <ul className="space-y-2">
                            {details.benefitPoints.map((point, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
                                    <span className="mt-[3px] text-emerald-400">•</span>
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Outstanding premiums, surfaced above the table so a missed payment
                is visible without reading every row. */}
            {pending.length > 0 && (
                <div style={{
                    marginBottom: '1.5rem',
                    padding: '1.25rem 1.5rem',
                    borderRadius: '1.25rem',
                    border: `1px solid ${overdue.length > 0 ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.25)'}`,
                    backgroundColor: overdue.length > 0 ? 'rgba(248,113,113,0.06)' : 'rgba(251,191,36,0.06)',
                    display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <AlertTriangle size={22} style={{ color: overdue.length > 0 ? '#f87171' : '#fbbf24' }} />
                        <div>
                            <p style={{ margin: 0, fontWeight: 900, color: overdue.length > 0 ? '#f87171' : '#fbbf24' }}>
                                {overdue.length > 0
                                    ? `${overdue.length} premium${overdue.length > 1 ? 's' : ''} overdue`
                                    : `${upcoming.length} premium${upcoming.length > 1 ? 's' : ''} pending`}
                            </p>
                            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#a1a1aa' }}>
                                {nextDue
                                    ? `${overdue.length > 0 ? 'Was due' : 'Next due'} ${nextDue.dueDate}`
                                    : 'No due date recorded'}
                            </p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#71717a' }}>Amount Pending</p>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '1.5rem', fontWeight: 900, fontFamily: 'monospace', color: overdue.length > 0 ? '#f87171' : '#fbbf24' }}>
                            {formatCurrency(pendingAmount)}
                        </p>
                    </div>
                </div>
            )}

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
                            {premiums.map((p, index) => {
                                const isPending = p.status === 'To Pay';
                                const isOverdue = isPending && p.dueDate && p.dueDate < today;
                                return (
                                <tr key={index} className="group" style={{
                                    backgroundColor: isOverdue ? 'rgba(248,113,113,0.06)' : isPending ? 'rgba(251,191,36,0.05)' : 'transparent'
                                }}>
                                    <td style={{ padding: '1.25rem 1rem', color: 'var(--text-primary)' }}>
                                        {p.paidDate || (p.dueDate ? `Due ${p.dueDate}` : '-')}
                                    </td>
                                    <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: '500' }}>{formatCurrency(p.amount)}</td>
                                    <td style={{ padding: '1.25rem 1rem', paddingLeft: '2rem', color: 'var(--text-secondary)' }}>
                                        {p.status === 'Paid' ? `Receipt: ${p.receiptNo}` : (
                                            <span style={{
                                                padding: '0.2rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.7rem', fontWeight: 900,
                                                backgroundColor: isOverdue ? 'rgba(248,113,113,0.15)' : isPending ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)',
                                                color: isOverdue ? '#f87171' : isPending ? '#fbbf24' : '#a1a1aa'
                                            }}>
                                                {isOverdue ? 'OVERDUE' : p.status}
                                            </span>
                                        )}
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
                                );
                            })}
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

            {/* Benefits the policy pays out, and claims made against it. Both
                use the same table shape; only the columns differ in meaning. */}
            {[
                {
                    kind: 'benefit',
                    heading: 'Benefits',
                    rows: benefits,
                    empty: 'No benefits recorded. Add survival benefits, maturity or bonuses as they fall due.',
                    dateHead: 'Due / Expected',
                    amountHead: 'Amount',
                    settledHead: 'Received',
                    doneStatus: 'Received',
                    summary: [
                        { label: 'Received', value: benefitsReceived, color: '#34d399' },
                        { label: 'Expected', value: benefitsExpected, color: '#fbbf24' }
                    ]
                },
                {
                    kind: 'claim',
                    heading: 'Claims',
                    rows: claims,
                    empty: 'No claims filed against this policy.',
                    dateHead: 'Claim Date',
                    amountHead: 'Claimed',
                    settledHead: 'Settled',
                    doneStatus: 'Settled',
                    summary: [
                        { label: 'Settled', value: claimsSettled, color: '#34d399' },
                        { label: `Open (${claimsOpen.length})`, value: claimsOpenAmount, color: '#fbbf24' }
                    ]
                }
            ].map(section => (
                <div key={section.kind} className="pol-table-container" style={{ marginTop: '2rem' }}>
                    <div className="pol-table-header" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                            <h3 className="text-lg font-bold tracking-tight text-white">{section.heading}</h3>
                            {section.rows.length > 0 && section.summary.map(s => (
                                <div key={s.label}>
                                    <span style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#71717a' }}>{s.label}</span>
                                    <p style={{ margin: 0, fontFamily: 'monospace', fontWeight: 900, color: s.color }}>{formatCurrency(s.value)}</p>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => openRecordModal(section.kind)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                        >
                            <Plus size={14} /> Add {section.kind}
                        </button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="pol-table">
                            <thead>
                                <tr>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>{section.heading.slice(0, -1)}</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>{section.dateHead}</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>{section.amountHead}</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>{section.settledHead}</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {section.rows.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            {section.empty}
                                        </td>
                                    </tr>
                                ) : section.rows.map((r, index) => {
                                    const done = r.status === section.doneStatus;
                                    const rejected = r.status === 'Rejected';
                                    return (
                                        <tr key={index} className="group">
                                            <td style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                {r.title}
                                                {r.category && <span style={{ display: 'block', fontSize: '0.7rem', color: '#71717a' }}>{r.category}</span>}
                                                {r.reference && <span style={{ display: 'block', fontSize: '0.7rem', color: '#52525b' }}>{r.reference}</span>}
                                            </td>
                                            <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{r.date || '-'}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(r.amount || 0)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace', color: done ? '#34d399' : '#52525b' }}>
                                                {done ? formatCurrency(r.settledAmount || r.amount || 0) : '-'}
                                                {done && r.settledDate && <span style={{ display: 'block', fontSize: '0.7rem', color: '#71717a' }}>{r.settledDate}</span>}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '0.2rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.7rem', fontWeight: 900,
                                                    backgroundColor: done ? 'rgba(52,211,153,0.15)' : rejected ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.15)',
                                                    color: done ? '#34d399' : rejected ? '#f87171' : '#fbbf24'
                                                }}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => openRecordModal(section.kind, r, index)}
                                                        className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteRecord(section.kind, index)}
                                                        className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
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
            ))}

            {/* Policy paperwork. Files live under db/documents on disk, which is
                gitignored, so nothing here is ever committed or put in db.json. */}
            <div className="pol-table-container" style={{ marginTop: '2rem' }}>
                <div className="pol-table-header" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Paperclip size={18} style={{ color: '#38bdf8' }} />
                        <h3 className="text-lg font-bold tracking-tight text-white">Documents &amp; Receipts</h3>
                        {documents.length > 0 && (
                            <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-gray-400">
                                {documents.length}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => docInputRef.current?.click()}
                        disabled={isUploadingDoc}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus size={14} /> {isUploadingDoc ? 'Uploading...' : 'Add Document'}
                    </button>
                    <input
                        type="file"
                        ref={docInputRef}
                        className="hidden"
                        accept="image/*,application/pdf"
                        onChange={handleAddDocument}
                    />
                </div>

                <div style={{ padding: '1.25rem' }}>
                    {docError && (
                        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                            <span className="text-xs font-bold text-rose-300">{docError}</span>
                        </div>
                    )}

                    {documents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <FileText size={36} className="text-gray-600 mb-3" />
                            <p className="text-gray-500 font-bold">No documents uploaded</p>
                            <p className="text-gray-600 text-xs mt-1">Policy copies, premium receipts, RC book — image or PDF</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {documents.map((doc, index) => {
                                const url = typeof doc === 'string' ? doc : doc.url;
                                const label = (typeof doc === 'string' ? '' : doc.name) || `Document ${index + 1}`;
                                return (
                                    <div key={`${url}-${index}`} className="group flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:border-white/15 transition-all">
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                            {isImageRef(url) ? (
                                                <img src={url} alt={label} className="w-14 h-14 rounded-xl object-cover border border-white/10" />
                                            ) : (
                                                <div className="w-14 h-14 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                                    <FileText size={22} className="text-rose-300" />
                                                </div>
                                            )}
                                        </a>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{label}</p>
                                            {doc.uploadedAt && (
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                                                    {doc.uploadedAt.split('T')[0]}
                                                </p>
                                            )}
                                            <a
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold text-gray-400 hover:text-white transition-colors"
                                            >
                                                <Download size={12} /> Open
                                            </a>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteDocument(index)}
                                            className="p-2.5 rounded-full text-gray-600 hover:text-white hover:bg-red-500 transition-all shrink-0"
                                            title="Remove document"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <PolicyPremiumModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSavePremium}
                initialData={editingPremium}
            />

            <PolicyRecordModal
                isOpen={isRecordModalOpen}
                onClose={() => setIsRecordModalOpen(false)}
                onSave={saveRecord}
                initialData={editingRecord}
                kind={recordKind}
            />
        </div>
    );
};

export default PolicyDetails;
