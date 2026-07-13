import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Hash, FileText, TrendingUp } from 'lucide-react';

const inputStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '1rem',
    padding: '0.75rem 1rem 0.75rem 2.5rem',
    width: '100%',
    outline: 'none',
    transition: 'all 0.3s ease',
    fontSize: '0.875rem'
};

const iconStyle = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    left: '0.75rem',
    pointerEvents: 'none',
    color: '#71717a',
    width: '16px',
    height: '16px'
};

const MutualFundEditModal = ({ isOpen, onClose, onSave, fund }) => {
    const [title, setTitle] = useState('');
    const [currentNav, setCurrentNav] = useState('');
    const [folioNumber, setFolioNumber] = useState('');
    const [schemeCode, setSchemeCode] = useState('');

    useEffect(() => {
        if (isOpen && fund) {
            setTitle(fund.title || '');
            setCurrentNav(fund.currentNav || '');
            setFolioNumber(fund.folioNumber || '');
            setSchemeCode(fund.schemeCode || '');
        }
    }, [isOpen, fund]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...fund,
            title,
            currentNav: parseFloat(currentNav),
            folioNumber,
            schemeCode
        });
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 1000,
            backdropFilter: 'blur(10px)'
        }} onClick={onClose}>
            <div style={{
                background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.98), rgba(18, 18, 18, 0.98))',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '2rem', width: '100%', maxWidth: '420px',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
            }} onClick={e => e.stopPropagation()}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: 0 }}>Edit Fund Details</h3>
                    <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.75rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Fund Name</label>
                        <div style={{ position: 'relative' }}>
                            <input type="text" required value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
                            <FileText style={iconStyle} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Current NAV (Market)</label>
                        <div style={{ position: 'relative' }}>
                            <input type="number" step="0.0001" required value={currentNav} onChange={e => setCurrentNav(e.target.value)} style={inputStyle} />
                            <Hash style={iconStyle} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Folio Number</label>
                        <div style={{ position: 'relative' }}>
                            <input type="text" value={folioNumber} onChange={e => setFolioNumber(e.target.value)} style={inputStyle} />
                            <Hash style={iconStyle} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Scheme Code (mfapi.in)</label>
                        <div style={{ position: 'relative' }}>
                            <input type="text" value={schemeCode} onChange={e => setSchemeCode(e.target.value)} style={inputStyle} placeholder="e.g. 120503" />
                            <TrendingUp style={iconStyle} />
                        </div>
                        <span style={{ fontSize: '9px', color: '#71717a', display: 'block', marginTop: '0.25rem' }}>Found on mfapi.in (e.g., 120503 for Axis Bluechip)</span>
                    </div>

                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.75rem 1rem', borderRadius: '1rem', fontSize: '11px', color: '#71717a', lineHeight: '1.4' }}>
                        Note: Updating Current NAV will recalculate current value and Unrealized P/L automatically.
                    </div>

                    <button
                        type="submit"
                        style={{
                            width: '100%',
                            padding: '1rem',
                            borderRadius: '1.25rem',
                            backgroundColor: '#c084fc',
                            color: 'black',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            cursor: 'pointer',
                            border: 'none',
                            transition: 'all 0.3s ease',
                            marginTop: '0.5rem'
                        }}
                    >
                        Update Details
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default MutualFundEditModal;
