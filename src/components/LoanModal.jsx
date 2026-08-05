import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { X, Percent, Landmark, Calendar, FileText, Smartphone, Laptop, Sparkles, ShieldCheck } from 'lucide-react';

const LoanModal = ({ isOpen, onClose, onSave, editingLoan }) => {
    const { formatCurrency } = useFinance();

    const [name, setName] = useState('');
    const [type, setType] = useState('gadget');
    const [lender, setLender] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [principalAmount, setPrincipalAmount] = useState('');
    const [interestRate, setInterestRate] = useState('');
    const [tenureMonths, setTenureMonths] = useState('24');
    const [startDate, setStartDate] = useState('');
    const [processingFee, setProcessingFee] = useState('');
    const [gstPercentage, setGstPercentage] = useState('18');
    const [gstAmount, setGstAmount] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (editingLoan) {
            setName(editingLoan.name || '');
            setType(editingLoan.type || 'gadget');
            setLender(editingLoan.lender || '');
            setAccountNumber(editingLoan.accountNumber || '');
            setPrincipalAmount(editingLoan.principalAmount ? String(editingLoan.principalAmount) : '');
            setInterestRate(editingLoan.interestRate !== undefined ? String(editingLoan.interestRate) : '');
            setTenureMonths(editingLoan.tenureMonths ? String(editingLoan.tenureMonths) : '24');
            setStartDate(editingLoan.startDate || '');
            setProcessingFee(editingLoan.processingFee ? String(editingLoan.processingFee) : '');
            setGstPercentage(editingLoan.gstPercentage !== undefined ? String(editingLoan.gstPercentage) : '18');
            setGstAmount(editingLoan.gstAmount ? String(editingLoan.gstAmount) : '');
            setNotes(editingLoan.notes || '');
        } else {
            setName('');
            setType('gadget');
            setLender('Scapia / Bank');
            setAccountNumber('');
            setPrincipalAmount('');
            setInterestRate('15.99');
            setTenureMonths('24');
            setStartDate(new Date().toISOString().split('T')[0]);
            setProcessingFee('');
            setGstPercentage('18');
            setGstAmount('');
            setNotes('');
        }
    }, [editingLoan, isOpen]);

    if (!isOpen) return null;

    const p = Number(principalAmount) || 0;
    const rateVal = Number(interestRate) || 0;
    const r = rateVal / 12 / 100;
    const n = Number(tenureMonths) || 12;
    const pFee = Number(processingFee) || 0;
    const gstRate = Number(gstPercentage) || 0;
    
    const calculatedGst = gstAmount ? Number(gstAmount) : Math.round(pFee * (gstRate / 100));

    let estimatedEmi = 0;
    if (p > 0 && n > 0) {
        if (r > 0) {
            estimatedEmi = Math.round((p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
        } else {
            // 0% No Cost EMI
            estimatedEmi = Math.round(p / n);
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !principalAmount) return;

        const loanData = {
            id: editingLoan ? editingLoan.id : `loan_${Date.now()}`,
            name,
            type,
            lender,
            accountNumber,
            principalAmount: p,
            interestRate: rateVal,
            tenureMonths: n,
            startDate,
            emiAmount: estimatedEmi,
            processingFee: pFee,
            gstPercentage: gstRate,
            gstAmount: calculatedGst,
            payments: editingLoan?.payments || [],
            notes,
            updatedAt: new Date().toISOString()
        };

        onSave(loanData);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: '1rem'
        }}>
            <div style={{
                backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '1.5rem', width: '100%', maxWidth: '540px',
                padding: '2rem', color: 'white', position: 'relative',
                maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 25px 35px -10px rgba(0, 0, 0, 0.7)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Landmark style={{ color: '#60a5fa' }} size={24} />
                        {editingLoan ? 'Edit Loan / EMI' : 'Add Bank Loan or Gadget EMI'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Loan / EMI Title *</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Anith's iPhone EMI, SBI Home Loan"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{
                                width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white', outline: 'none', fontWeight: 'bold'
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Loan / Debt Type</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: '#27272a', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none', fontWeight: 'bold'
                                }}
                            >
                                <option value="gadget">📱 Electronic Gadget EMI</option>
                                <option value="home">🏠 Home Loan</option>
                                <option value="car">🚗 Car / Auto Loan</option>
                                <option value="personal">💼 Personal Loan</option>
                                <option value="no_cost_emi">💳 No-Cost EMI</option>
                                <option value="consumer_durable">🛒 Consumer Durable EMI</option>
                                <option value="education">🎓 Education Loan</option>
                                <option value="other">🪙 Other Debt / EMI</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Lender Bank / Card</label>
                            <input
                                type="text"
                                placeholder="Scapia, HDFC, SBI, ICICI"
                                value={lender}
                                onChange={(e) => setLender(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <label style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Principal / Purchase (₹) *</label>
                                {p > 0 && (
                                    <span style={{ color: '#60a5fa', fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                                        {formatCurrency(p)}
                                    </span>
                                )}
                            </div>
                            <input
                                type="number"
                                required
                                placeholder="133449"
                                value={principalAmount}
                                onChange={(e) => setPrincipalAmount(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none', fontWeight: 'bold'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Interest Rate (% p.a.)</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="15.99 (or 0 for No-Cost EMI)"
                                value={interestRate}
                                onChange={(e) => setInterestRate(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Tenure (Months) *</label>
                            <input
                                type="number"
                                required
                                placeholder="24"
                                value={tenureMonths}
                                onChange={(e) => setTenureMonths(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none', fontWeight: 'bold'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    {/* Processing Fees & GST Section */}
                    <div style={{
                        padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1rem',
                        display: 'flex', flexDirection: 'column', gap: '0.85rem'
                    }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <ShieldCheck size={16} /> Upfront Fees & GST Charges
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.3rem' }}>Processing Fee (₹)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="1999"
                                    value={processingFee}
                                    onChange={(e) => setProcessingFee(e.target.value)}
                                    style={{
                                        width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                                        backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white', outline: 'none', fontSize: '0.9rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.3rem' }}>GST % Rate</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    placeholder="18"
                                    value={gstPercentage}
                                    onChange={(e) => setGstPercentage(e.target.value)}
                                    style={{
                                        width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                                        backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white', outline: 'none', fontSize: '0.9rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.3rem' }}>GST Amount (₹)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder={calculatedGst ? String(calculatedGst) : "360"}
                                    value={gstAmount}
                                    onChange={(e) => setGstAmount(e.target.value)}
                                    style={{
                                        width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                                        backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white', outline: 'none', fontSize: '0.9rem'
                                    }}
                                />
                            </div>
                        </div>

                        {(pFee > 0 || calculatedGst > 0) && (
                            <div style={{ fontSize: '0.75rem', color: '#a1a1aa', display: 'flex', justifyContent: 'space-between', borderTop: '1px border-dashed rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                                <span>Total Fees & Tax: <strong style={{ color: '#f59e0b' }}>{formatCurrency(pFee + calculatedGst)}</strong></span>
                                <span>Net Cost Burden: <strong style={{ color: '#60a5fa' }}>{formatCurrency(p + pFee + calculatedGst)}</strong></span>
                            </div>
                        )}
                    </div>

                    {estimatedEmi > 0 && (
                        <div style={{
                            padding: '0.85rem 1rem', backgroundColor: 'rgba(96, 165, 250, 0.1)',
                            border: '1px solid rgba(96, 165, 250, 0.25)', borderRadius: '0.75rem',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Calculated Monthly EMI</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: '950', color: '#60a5fa', fontFamily: 'monospace' }}>{formatCurrency(estimatedEmi)}</span>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                flex: 1, padding: '0.75rem', borderRadius: '0.75rem',
                                backgroundColor: 'rgba(255,255,255,0.05)', border: 'none',
                                color: '#a1a1aa', fontWeight: 'bold', cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                flex: 1, padding: '0.75rem', borderRadius: '0.75rem',
                                backgroundColor: '#60a5fa', border: 'none',
                                color: 'black', fontWeight: 'bold', cursor: 'pointer'
                            }}
                        >
                            {editingLoan ? 'Save Changes' : 'Add Loan / EMI'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoanModal;
