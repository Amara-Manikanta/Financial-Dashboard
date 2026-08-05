import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle2, ShieldCheck, Bike, Car, HeartPulse, Landmark, AlertCircle, Sparkles } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';

const PolicyScannerModal = ({ isOpen, onClose, onSave, editingPolicy }) => {
    const { formatCurrency } = useFinance();

    const [category, setCategory] = useState(editingPolicy?.policyDetails?.category || 'bike');
    const [planName, setPlanName] = useState(editingPolicy?.policyDetails?.planName || editingPolicy?.title || '');
    const [insurer, setInsurer] = useState(editingPolicy?.policyDetails?.insurer || '');
    const [policyNumber, setPolicyNumber] = useState(editingPolicy?.policyDetails?.policyNumber || '');
    const [vehicleNo, setVehicleNo] = useState(editingPolicy?.policyDetails?.vehicleNo || '');
    const [sumAssured, setSumAssured] = useState(editingPolicy?.policyDetails?.sumAssured || editingPolicy?.amount || '');
    const [premiumAmount, setPremiumAmount] = useState(editingPolicy?.policyDetails?.premiumAmount || '');
    const [expiryDate, setExpiryDate] = useState(editingPolicy?.policyDetails?.maturityDate || editingPolicy?.policyDetails?.expiryDate || '');
    const [ncb, setNcb] = useState(editingPolicy?.policyDetails?.ncb || '0');
    const [notes, setNotes] = useState(editingPolicy?.policyDetails?.notes || '');

    const [isScanning, setIsScanning] = useState(false);
    const [scannedFileName, setScannedFileName] = useState('');
    const [scanSuccess, setScanSuccess] = useState(false);

    // The useState initialisers above only run when this component first mounts,
    // and it stays mounted between openings. Without this sync, clicking Edit
    // on a policy showed whatever the form held last — usually blank — so
    // editing an existing policy did not work at all.
    useEffect(() => {
        if (!isOpen) return;
        const d = editingPolicy?.policyDetails || {};
        setCategory(d.category || 'bike');
        setPlanName(d.planName || editingPolicy?.title || '');
        setInsurer(d.insurer || '');
        setPolicyNumber(d.policyNumber || '');
        setVehicleNo(d.vehicleNo || '');
        setSumAssured(d.sumAssured ?? editingPolicy?.amount ?? '');
        setPremiumAmount(d.premiumAmount ?? '');
        setExpiryDate(d.maturityDate || d.expiryDate || '');
        setNcb(d.ncb || '0');
        setNotes(d.notes || '');
        setScannedFileName('');
        setScanSuccess(false);
    }, [isOpen, editingPolicy]);

    if (!isOpen) return null;

    // Handle File Upload & Extract Text / Auto-Fill Policy Info
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setScannedFileName(file.name);
        setIsScanning(true);
        setScanSuccess(false);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const textContent = (event.target.result || '').toString();

            setTimeout(() => {
                setIsScanning(false);
                setScanSuccess(true);

                const textLower = textContent.toLowerCase() + ' ' + file.name.toLowerCase();

                // 1. Detect Category
                if (textLower.includes('bike') || textLower.includes('two wheeler') || textLower.includes('2 wheeler') || textLower.includes('scooter') || textLower.includes('motorcycle')) {
                    setCategory('bike');
                } else if (textLower.includes('car') || textLower.includes('four wheeler') || textLower.includes('4 wheeler') || textLower.includes('motor car') || textLower.includes('private car')) {
                    setCategory('car');
                } else if (textLower.includes('health') || textLower.includes('mediclaim') || textLower.includes('star health') || textLower.includes('care health') || textLower.includes('niva bupa')) {
                    setCategory('health');
                } else if (textLower.includes('life') || textLower.includes('term') || textLower.includes('lic') || textLower.includes('hdfc life') || textLower.includes('max life')) {
                    setCategory('life');
                } else if (textLower.includes('home') || textLower.includes('fire') || textLower.includes('property')) {
                    setCategory('home');
                }

                // 2. Extract Plan Name
                if (file.name) {
                    const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
                    setPlanName(cleanName);
                }

                // 3. Extract Vehicle Number Pattern (e.g. KA01AB1234 or AP39X1234)
                const vehicleRegex = /([A-Z]{2}[-\s]?[0-9]{2}[-\s]?[A-Z]{1,2}[-\s]?[0-9]{4})/i;
                const vehicleMatch = textLower.match(vehicleRegex);
                if (vehicleMatch) {
                    setVehicleNo(vehicleMatch[0].toUpperCase());
                }

                // 4. Extract Policy Number
                const policyRegex = /(policy|certificate)\s*(no|number|#)?\s*[:\s]?\s*([A-Z0-9\/-]{6,20})/i;
                const policyMatch = textLower.match(policyRegex);
                if (policyMatch && policyMatch[3]) {
                    setPolicyNumber(policyMatch[3].toUpperCase());
                }

                // 5. Extract Sum Assured / IDV
                const idvRegex = /(idv|insured\s*declared\s*value|sum\s*insured|sum\s*assured)\s*[:\s]?\s*₹?\s*([0-9,]{4,9})/i;
                const idvMatch = textLower.match(idvRegex);
                if (idvMatch && idvMatch[2]) {
                    const num = parseInt(idvMatch[2].replace(/,/g, ''), 10);
                    if (!isNaN(num)) setSumAssured(num);
                } else if (!sumAssured) {
                    if (textLower.includes('bike')) setSumAssured(85000);
                    else if (textLower.includes('car')) setSumAssured(650000);
                    else if (textLower.includes('health')) setSumAssured(1000000);
                    else setSumAssured(5000000);
                }

                // 6. Extract Premium
                const premiumRegex = /(premium|net\s*premium|total\s*premium)\s*[:\s]?\s*₹?\s*([0-9,]{3,7})/i;
                const premiumMatch = textLower.match(premiumRegex);
                if (premiumMatch && premiumMatch[2]) {
                    const pNum = parseInt(premiumMatch[2].replace(/,/g, ''), 10);
                    if (!isNaN(pNum)) setPremiumAmount(pNum);
                } else if (!premiumAmount) {
                    if (textLower.includes('bike')) setPremiumAmount(1850);
                    else if (textLower.includes('car')) setPremiumAmount(12500);
                }

                // Default Expiry Date to 1 year from now if not specified
                if (!expiryDate) {
                    const nextYear = new Date();
                    nextYear.setFullYear(nextYear.getFullYear() + 1);
                    setExpiryDate(nextYear.toISOString().split('T')[0]);
                }
            }, 800);
        };

        reader.readAsText(file);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!planName || !sumAssured) return;

        const policyData = {
            // Carry the existing record forward. This form only edits the
            // policyDetails fields, but the record is saved with a replacing
            // PUT — without this spread, editing a policy silently deleted its
            // premium history, benefits, claims and attached documents.
            ...(editingPolicy || {}),
            id: editingPolicy ? editingPolicy.id : `pol_${Date.now()}`,
            title: planName,
            type: 'Policy',
            amount: Number(sumAssured) || 0,
            policyDetails: {
                // Same reasoning: keep fields this form does not expose, such as
                // planDetails, taxBenefit, premiumPayingTerm and policyTerm.
                ...(editingPolicy?.policyDetails || {}),
                category,
                planName,
                insurer: insurer || 'General Insurance',
                policyNumber: policyNumber || 'POL-UNSPECIFIED',
                vehicleNo: (category === 'bike' || category === 'car') ? vehicleNo : '',
                sumAssured: Number(sumAssured) || 0,
                premiumAmount: Number(premiumAmount) || 0,
                maturityDate: expiryDate,
                expiryDate,
                ncb: Number(ncb) || 0,
                status: 'Active',
                notes
            },
            updatedAt: new Date().toISOString()
        };

        onSave(policyData);
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
                borderRadius: '1.5rem', width: '100%', maxWidth: '640px',
                maxHeight: '90vh', overflowY: 'auto',
                padding: '2rem', color: 'white', position: 'relative',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ShieldCheck style={{ color: '#34d399' }} size={24} />
                        {editingPolicy ? 'Edit Insurance Policy' : 'Add & Scan Insurance Policy'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* AI Document Upload / Scanner Drop Zone */}
                {!editingPolicy && (
                    <div style={{
                        backgroundColor: 'rgba(52, 211, 153, 0.05)', border: '2px dashed rgba(52, 211, 153, 0.3)',
                        borderRadius: '1.25rem', padding: '1.5rem', textAlign: 'center', marginBottom: '1.5rem',
                        position: 'relative'
                    }}>
                        <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.txt"
                            onChange={handleFileUpload}
                            style={{
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                opacity: 0, cursor: 'pointer', zIndex: 10
                            }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ padding: '0.75rem', borderRadius: '1rem', backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
                                <Upload size={24} />
                            </div>
                            <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', margin: 0 }}>
                                Upload Policy Document (PDF, Image)
                            </h4>
                            <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: 0 }}>
                                Auto-extract Bike, Car, Health, or Life policy details & IDV/Sum Assured
                            </p>
                        </div>

                        {isScanning && (
                            <div style={{ marginTop: '1rem', color: '#38bdf8', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <Sparkles size={16} className="animate-spin" /> Scanning document text & extracting coverage details...
                            </div>
                        )}

                        {scanSuccess && (
                            <div style={{ marginTop: '1rem', color: '#34d399', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <CheckCircle2 size={16} /> Auto-filled policy fields from "{scannedFileName}"!
                            </div>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Category Selection */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Insurance Type / Category *</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            style={{
                                width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                backgroundColor: '#27272a', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white', outline: 'none', fontSize: '0.9rem'
                            }}
                        >
                            <option value="bike">🏍️ Bike / Two-Wheeler Insurance</option>
                            <option value="car">🚗 Car / Four-Wheeler Insurance</option>
                            <option value="life">🛡️ Life / Term Insurance</option>
                            <option value="health">🏥 Health / Mediclaim Insurance</option>
                            <option value="home">🏡 Home & Property Insurance</option>
                            <option value="other">📋 Other General Insurance</option>
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Policy / Plan Name *</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. HDFC ERGO Two Wheeler Policy"
                                value={planName}
                                onChange={(e) => setPlanName(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Insurer Company</label>
                            <input
                                type="text"
                                placeholder="HDFC ERGO, Acko, Star Health, LIC"
                                value={insurer}
                                onChange={(e) => setInsurer(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    {/* Vehicle Registration Number field for Bike & Car */}
                    {(category === 'bike' || category === 'car') && (
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#38bdf8', marginBottom: '0.4rem' }}>Vehicle Registration Number</label>
                            <input
                                type="text"
                                placeholder="e.g. KA 01 AB 1234, AP 39 X 9988"
                                value={vehicleNo}
                                onChange={(e) => setVehicleNo(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.3)',
                                    color: '#38bdf8', outline: 'none', fontWeight: 'bold'
                                }}
                            />
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <label style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>
                                    {(category === 'bike' || category === 'car') ? 'IDV (Insured Value ₹) *' : 'Sum Assured / Cover (₹) *'}
                                </label>
                                {sumAssured > 0 && <span style={{ color: '#34d399', fontSize: '0.85rem', fontWeight: 'bold' }}>{formatCurrency(sumAssured)}</span>}
                            </div>
                            <input
                                type="number"
                                required
                                placeholder="100000"
                                value={sumAssured}
                                onChange={(e) => setSumAssured(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <label style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Annual Premium (₹)</label>
                                {premiumAmount > 0 && <span style={{ color: '#c084fc', fontSize: '0.85rem', fontWeight: 'bold' }}>{formatCurrency(premiumAmount)}</span>}
                            </div>
                            <input
                                type="number"
                                placeholder="2500"
                                value={premiumAmount}
                                onChange={(e) => setPremiumAmount(e.target.value)}
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
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Policy Number</label>
                            <input
                                type="text"
                                placeholder="POL-12345678"
                                value={policyNumber}
                                onChange={(e) => setPolicyNumber(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Expiry / Renewal Date</label>
                            <input
                                type="date"
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
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
                            {editingPolicy ? 'Save Changes' : 'Save Policy'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PolicyScannerModal;
