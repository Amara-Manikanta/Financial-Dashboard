import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { X, Calendar, DollarSign, CreditCard, Tag, CheckCircle2, ShieldCheck } from 'lucide-react';

const LoanPaymentModal = ({ isOpen, onClose, onSave, loan, editingPayment }) => {
    const { formatCurrency } = useFinance();

    const [date, setDate] = useState('');
    const [amount, setAmount] = useState('');
    const [emiNumber, setEmiNumber] = useState('');
    const [paymentMode, setPaymentMode] = useState('auto_debit');
    const [creditCardName, setCreditCardName] = useState('');
    const [processingFee, setProcessingFee] = useState('');
    const [gstAmount, setGstAmount] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (editingPayment) {
                setDate(editingPayment.date || new Date().toISOString().split('T')[0]);
                setAmount(editingPayment.amount ? String(editingPayment.amount) : '');
                setEmiNumber(editingPayment.emiNumber ? String(editingPayment.emiNumber) : '');
                setPaymentMode(editingPayment.paymentMode || 'auto_debit');
                setCreditCardName(editingPayment.creditCardName || '');
                setProcessingFee(editingPayment.processingFee ? String(editingPayment.processingFee) : '');
                setGstAmount(editingPayment.gstAmount ? String(editingPayment.gstAmount) : '');
                setNotes(editingPayment.notes || '');
            } else if (loan) {
                const paidCount = (loan.payments || []).length;
                setDate(new Date().toISOString().split('T')[0]);
                setAmount(loan.emiAmount ? String(loan.emiAmount) : '');
                setEmiNumber(String(paidCount + 1));
                setPaymentMode('auto_debit');
                setCreditCardName(loan.lender || '');
                setProcessingFee('');
                setGstAmount('');
                setNotes('');
            }
        }
    }, [isOpen, loan, editingPayment]);

    if (!isOpen || !loan) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const pAmt = Number(amount) || 0;
        if (pAmt <= 0) return;

        const paymentData = {
            id: editingPayment ? editingPayment.id : `pay_${Date.now()}`,
            date: date || new Date().toISOString().split('T')[0],
            amount: pAmt,
            emiNumber: Number(emiNumber) || 1,
            paymentMode,
            creditCardName,
            processingFee: Number(processingFee) || 0,
            gstAmount: Number(gstAmount) || 0,
            notes,
            createdAt: new Date().toISOString()
        };

        onSave(paymentData);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: '1rem'
        }}>
            <div style={{
                backgroundColor: '#18181b', border: '1px solid rgba(96, 165, 250, 0.2)',
                borderRadius: '1.5rem', width: '100%', maxWidth: '480px',
                padding: '2rem', color: 'white', position: 'relative',
                boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.7)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle2 style={{ color: '#34d399' }} size={20} />
                            {editingPayment ? 'Edit EMI Transaction' : 'Record EMI Payment'}
                        </h2>
                        <p style={{ fontSize: '0.75rem', color: '#a1a1aa', margin: '0.25rem 0 0 0' }}>{loan.name}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>EMI # Number</label>
                            <input
                                type="number"
                                required
                                min="1"
                                value={emiNumber}
                                onChange={(e) => setEmiNumber(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none', fontWeight: 'bold'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Payment Date</label>
                            <input
                                type="date"
                                required
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <label style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>EMI Paid Amount (₹) *</label>
                            {Number(amount) > 0 && (
                                <span style={{ color: '#34d399', fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                                    {formatCurrency(Number(amount))}
                                </span>
                            )}
                        </div>
                        <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="6533"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            style={{
                                width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white', outline: 'none', fontSize: '1.1rem', fontWeight: 'bold'
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Payment Mode</label>
                            <select
                                value={paymentMode}
                                onChange={(e) => setPaymentMode(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: '#27272a', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            >
                                <option value="auto_debit">Bank Auto-Debit</option>
                                <option value="credit_card">Credit Card EMI</option>
                                <option value="net_banking">Net Banking / NEFT</option>
                                <option value="upi">UPI / GPay / PhonePe</option>
                                <option value="cash">Cash / Cheque</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Bank / Card Name</label>
                            <input
                                type="text"
                                placeholder="Scapia, HDFC, SBI"
                                value={creditCardName}
                                onChange={(e) => setCreditCardName(e.target.value)}
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
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Processing Fee (Optional ₹)</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0"
                                value={processingFee}
                                onChange={(e) => {
                                    setProcessingFee(e.target.value);
                                    const fee = parseFloat(e.target.value) || 0;
                                    if (fee > 0 && !gstAmount) {
                                        setGstAmount(String(Math.round(fee * 0.18)));
                                    }
                                }}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>GST Charge (Optional ₹)</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0"
                                value={gstAmount}
                                onChange={(e) => setGstAmount(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Notes / Transaction Ref</label>
                        <input
                            type="text"
                            placeholder="e.g. Scapia auto-debit, Txn #129381"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            style={{
                                width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white', outline: 'none'
                            }}
                        />
                    </div>

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
                                backgroundColor: '#34d399', border: 'none',
                                color: 'black', fontWeight: 'bold', cursor: 'pointer'
                            }}
                        >
                            {editingPayment ? 'Save Payment' : 'Record Payment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoanPaymentModal;
