import React, { useState, useEffect } from 'react';
import { X, Archive, Calendar, DollarSign, FileText, AlertTriangle } from 'lucide-react';

const CloseDepositModal = ({ isOpen, onClose, onConfirm, deposit, calculatedInterest, formatCurrency }) => {
    const [closureDate, setClosureDate] = useState(new Date().toISOString().split('T')[0]);
    const [finalInterestEarned, setFinalInterestEarned] = useState('0');
    const [closureRemarks, setClosureRemarks] = useState('');

    useEffect(() => {
        if (isOpen && deposit) {
            setClosureDate(new Date().toISOString().split('T')[0]);
            setFinalInterestEarned(calculatedInterest ? calculatedInterest.toFixed(2) : '0');
            setClosureRemarks(deposit.remarks ? `${deposit.remarks} (Closed premature)` : 'Prematurely closed / archived');
        }
    }, [isOpen, deposit, calculatedInterest]);

    if (!isOpen || !deposit) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm({
            depositId: deposit.id,
            closureDate,
            finalInterestEarned: parseFloat(finalInterestEarned || 0),
            closureRemarks
        });
        onClose();
    };

    const penaltyAmount = calculatedInterest - parseFloat(finalInterestEarned || 0);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '520px',
                backgroundColor: '#121220',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '1.5rem',
                padding: '1.75rem',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                color: '#ffffff'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1.25rem',
                        right: '1.25rem',
                        padding: '0.5rem',
                        borderRadius: '9999px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: '#a1a1aa',
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    <X size={18} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div style={{
                        padding: '0.75rem',
                        borderRadius: '1rem',
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        color: '#fbbf24',
                        border: '1px solid rgba(245, 158, 11, 0.3)'
                    }}>
                        <Archive size={24} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#ffffff', margin: 0 }}>
                            Close & Archive Fixed Deposit
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: '#a1a1aa', margin: '0.125rem 0 0 0' }}>
                            {deposit.bank} — #{deposit.accountNo}
                        </p>
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '1rem',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                }}>
                    <div>
                        <span style={{ fontSize: '0.6875rem', fontWeight: '800', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Principal</span>
                        <p style={{ fontSize: '1.125rem', fontWeight: '800', color: '#ffffff', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>
                            {formatCurrency(deposit.originalAmount)}
                        </p>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.6875rem', fontWeight: '800', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calculated Accrued</span>
                        <p style={{ fontSize: '1.125rem', fontWeight: '800', color: '#34d399', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>
                            {formatCurrency(calculatedInterest)}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                            Closure Date
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="date"
                                value={closureDate}
                                onChange={(e) => setClosureDate(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                    fontSize: '0.875rem',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: '800', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                            <span>Final Interest Received (₹)</span>
                            <span style={{ fontSize: '0.6875rem', color: '#fbbf24' }}>Specify actual payout</span>
                        </label>
                        <input
                            type="number"
                            step="any"
                            value={finalInterestEarned}
                            onChange={(e) => setFinalInterestEarned(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                borderRadius: '0.75rem',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(52, 211, 153, 0.3)',
                                color: '#34d399',
                                fontSize: '1.125rem',
                                fontWeight: '800',
                                fontFamily: 'monospace',
                                outline: 'none'
                            }}
                        />
                        {penaltyAmount > 1 && (
                            <p style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem', margin: '0.375rem 0 0 0' }}>
                                <AlertTriangle size={13} /> Premature closure penalty: {formatCurrency(penaltyAmount)} less interest
                            </p>
                        )}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                            Closure Remarks
                        </label>
                        <input
                            type="text"
                            value={closureRemarks}
                            onChange={(e) => setClosureRemarks(e.target.value)}
                            placeholder="Reason for early closure / notes"
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                borderRadius: '0.75rem',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#ffffff',
                                fontSize: '0.875rem',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                flex: 1,
                                padding: '0.875rem',
                                borderRadius: '0.75rem',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#a1a1aa',
                                fontWeight: 'bold',
                                fontSize: '0.875rem',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                flex: 1,
                                padding: '0.875rem',
                                borderRadius: '0.75rem',
                                backgroundColor: '#f59e0b',
                                color: '#ffffff',
                                fontWeight: '800',
                                fontSize: '0.875rem',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                            }}
                        >
                            Confirm & Archive FD
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CloseDepositModal;
