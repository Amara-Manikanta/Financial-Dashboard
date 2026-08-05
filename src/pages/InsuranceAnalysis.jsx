import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ShieldCheck, AlertTriangle, CheckCircle, Info, Edit3, HeartPulse, Bike, Car, Plus, Upload, Trash2, FileText, Calendar, Landmark, Archive, ArchiveRestore } from 'lucide-react';
import PolicyScannerModal from '../components/PolicyScannerModal';

const InsuranceAnalysis = () => {
    const navigate = useNavigate();
    const { savings, salaryDetails, insuranceProfile, updateInsuranceProfile, addItem, updateItem, deleteItem, formatCurrency } = useFinance();
    
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState(null);
    const [activeTab, setActiveTab] = useState('all');
    const [showArchived, setShowArchived] = useState(false);

    // Default or stored profile state
    const [age, setAge] = useState(30);
    const [dependents, setDependents] = useState(2);
    const [annualIncome, setAnnualIncome] = useState(1200000);
    const [liabilities, setLiabilities] = useState(0);

    // Pre-populate annual income from salaryDetails if available
    useEffect(() => {
        if (insuranceProfile && Object.keys(insuranceProfile).length > 0) {
            setAge(insuranceProfile.age || 30);
            setDependents(insuranceProfile.dependents || 2);
            setAnnualIncome(insuranceProfile.annualIncome || 1200000);
            setLiabilities(insuranceProfile.liabilities || 0);
        } else {
            const annualRecord = (salaryDetails || []).find(s => s.type === 'annual');
            if (annualRecord) {
                const totalCtc = Object.entries(annualRecord).reduce((sum, [k, v]) => {
                    if (['id', 'year', 'month', 'type'].includes(k)) return sum;
                    return sum + (Number(v) || 0);
                }, 0);
                if (totalCtc > 0) setAnnualIncome(totalCtc);
            }
        }
    }, [insuranceProfile, salaryDetails]);

    const handleSaveProfile = (e) => {
        e.preventDefault();
        const profile = {
            age: Number(age) || 30,
            dependents: Number(dependents) || 0,
            annualIncome: Number(annualIncome) || 0,
            liabilities: Number(liabilities) || 0
        };
        updateInsuranceProfile(profile);
        setIsEditingProfile(false);
    };

    // Default policy catalog if savings is empty
    const DEFAULT_POLICIES = [
        { 
            id: 'pol_1', 
            title: 'LIC Tech Term Plan', 
            type: 'Policy', 
            amount: 5000000, 
            policyDetails: { category: 'life', planName: 'LIC Tech Term', insurer: 'LIC of India', policyNumber: 'POL-88776655', premiumAmount: 24000, expiryDate: '2055-01-15', status: 'Active', sumAssured: 5000000 } 
        },
        { 
            id: 'pol_2', 
            title: 'Star Health Mediclaim Optima', 
            type: 'Policy', 
            amount: 1000000, 
            policyDetails: { category: 'health', planName: 'Star Health Optima', insurer: 'Star Health', policyNumber: 'SH-11223344', premiumAmount: 18500, expiryDate: '2027-03-31', status: 'Active', sumAssured: 1000000 } 
        },
        { 
            id: 'pol_3', 
            title: 'Acko Bike Insurance (Royal Enfield)', 
            type: 'Policy', 
            amount: 85000, 
            policyDetails: { category: 'bike', planName: 'Acko Two Wheeler Comprehensive', insurer: 'Acko General Insurance', vehicleNo: 'KA 01 AB 1234', policyNumber: 'ACK-TW-998877', premiumAmount: 1850, expiryDate: '2027-04-15', status: 'Active', sumAssured: 85000 } 
        },
        { 
            id: 'pol_4', 
            title: 'HDFC ERGO Car Insurance (Hyundai Creta)', 
            type: 'Policy', 
            amount: 650000, 
            policyDetails: { category: 'car', planName: 'HDFC ERGO Car Comprehensive', insurer: 'HDFC ERGO', vehicleNo: 'AP 39 X 9988', policyNumber: 'HDFC-CAR-554433', premiumAmount: 12500, expiryDate: '2026-11-20', status: 'Active', sumAssured: 650000 } 
        }
    ];

    const allPolicyItems = (savings || []).filter(s => s.type === 'Policy' || s.type === 'policy');

    // Archived policies are lapsed cover kept for reference. They are hidden by
    // default and, importantly, excluded from the coverage totals below — an
    // expired policy must not count towards the gap analysis.
    const archivedCount = allPolicyItems.filter(p => p.isArchived).length;
    const rawPolicyItems = showArchived
        ? allPolicyItems
        : allPolicyItems.filter(p => !p.isArchived);
    const policyItems = allPolicyItems.length > 0 ? rawPolicyItems : DEFAULT_POLICIES;

    const toggleArchived = async (policy) => {
        await updateItem('savings', { ...policy, isArchived: !policy.isArchived });
    };

    const isExpired = (policy) => {
        const exp = policy.policyDetails?.expiryDate || policy.policyDetails?.maturityDate;
        return Boolean(exp) && exp < new Date().toISOString().split('T')[0];
    };

    // Aggregate coverage by categories
    let existingLifeCover = 0;
    let existingHealthCover = 0;
    let totalBikeIdv = 0;
    let totalCarIdv = 0;
    let totalHomeCover = 0;
    let totalAnnualPremiums = 0;
    const bikeVehicleList = [];

    policyItems.forEach(p => {
        const details = p.policyDetails || {};
        const cat = (details.category || '').toLowerCase();
        const planName = (details.planName || p.title || '').toLowerCase();
        const cover = Number(details.sumAssured || details.termCover || p.amount || 0);
        const premium = Number(details.premiumAmount || 0);
        totalAnnualPremiums += premium;

        if (cat === 'bike' || planName.includes('bike') || planName.includes('two wheeler')) {
            totalBikeIdv += cover;
            if (details.vehicleNo) bikeVehicleList.push(details.vehicleNo);
        } else if (cat === 'car' || planName.includes('car') || planName.includes('four wheeler')) {
            totalCarIdv += cover;
        } else if (cat === 'health' || planName.includes('health') || planName.includes('mediclaim')) {
            existingHealthCover += cover;
        } else if (cat === 'home' || planName.includes('home') || planName.includes('fire') || planName.includes('property')) {
            totalHomeCover += cover;
        } else {
            existingLifeCover += cover;
        }
    });

    // Rule-of-Thumb Recommended Coverages
    const recommendedLifeCover = Math.max(0, (annualIncome * 12) + Number(liabilities));
    const recommendedHealthCover = 1000000 + (dependents * 300000); // 10L base + 3L per dependent

    const lifeGap = Math.max(0, recommendedLifeCover - existingLifeCover);
    const healthGap = Math.max(0, recommendedHealthCover - existingHealthCover);

    const lifeCoveragePct = recommendedLifeCover > 0 
        ? Math.min(100, Math.round((existingLifeCover / recommendedLifeCover) * 100)) 
        : 100;

    const healthCoveragePct = recommendedHealthCover > 0 
        ? Math.min(100, Math.round((existingHealthCover / recommendedHealthCover) * 100)) 
        : 100;

    // Filter policies for table by active tab
    const filteredPolicies = policyItems.filter(p => {
        if (activeTab === 'all') return true;
        const cat = (p.policyDetails?.category || '').toLowerCase();
        const title = (p.policyDetails?.planName || p.title || '').toLowerCase();

        if (activeTab === 'bike') return cat === 'bike' || cat === 'car' || title.includes('bike') || title.includes('car') || title.includes('wheeler');
        if (activeTab === 'life') return cat === 'life' || title.includes('term') || title.includes('lic') || title.includes('life') || title.includes('jeevan') || title.includes('moneyback');
        if (activeTab === 'health') return cat === 'health' || title.includes('health') || title.includes('mediclaim');
        if (activeTab === 'home') return cat === 'home' || title.includes('home') || title.includes('fire') || title.includes('property');
        return true;
    });

    const handleSavePolicy = async (policyData) => {
        if (editingPolicy) {
            await updateItem('savings', policyData);
        } else {
            await addItem('savings', policyData);
        }
        setIsModalOpen(false);
        setEditingPolicy(null);
    };

    const handleDeletePolicy = async (id) => {
        if (window.confirm('Are you sure you want to remove this insurance policy?')) {
            await deleteItem('savings', id);
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ShieldCheck style={{ color: '#34d399' }} size={32} />
                        Insurance Gap Analysis & Policy Hub
                    </h1>
                    <p style={{ color: '#a1a1aa', marginTop: '0.5rem' }}>
                        Scan & track Bike, Motor, Health, Life, and Home insurance policies & analyze coverage gaps
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => { setEditingPolicy(null); setIsModalOpen(true); }}
                        style={{
                            padding: '0.75rem 1.25rem', backgroundColor: '#34d399',
                            color: 'black', border: 'none', borderRadius: '0.75rem',
                            fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}
                    >
                        <Upload size={18} /> Upload & Scan Policy PDF/Doc
                    </button>
                    <button
                        onClick={() => setIsEditingProfile(!isEditingProfile)}
                        style={{
                            padding: '0.75rem 1.25rem', backgroundColor: 'rgba(255,255,255,0.08)',
                            color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.75rem',
                            fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}
                    >
                        <Edit3 size={18} /> {isEditingProfile ? 'Close Profile Editor' : 'Edit Profile'}
                    </button>
                </div>
            </div>

            {/* Profile Editor (Collapsible) */}
            {isEditingProfile && (
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.8)', border: '1px solid rgba(52, 211, 153, 0.3)',
                    borderRadius: '1.25rem', padding: '1.5rem', marginBottom: '2rem', backdropFilter: 'blur(10px)'
                }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#34d399', marginBottom: '1rem' }}>Financial & Family Profile</h3>
                    <form onSubmit={handleSaveProfile} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Age</label>
                            <input
                                type="number"
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Dependents</label>
                            <input
                                type="number"
                                value={dependents}
                                onChange={(e) => setDependents(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Annual Income (₹)</label>
                            <input
                                type="number"
                                value={annualIncome}
                                onChange={(e) => setAnnualIncome(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Total Loans / Liabilities (₹)</label>
                            <input
                                type="number"
                                value={liabilities}
                                onChange={(e) => setLiabilities(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                        <div style={{ gridColumn: '1 / -1', textAlign: 'right', marginTop: '0.5rem' }}>
                            <button
                                type="submit"
                                style={{
                                    padding: '0.6rem 1.25rem', backgroundColor: '#34d399', color: 'black',
                                    border: 'none', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer'
                                }}
                            >
                                Recalculate Gaps
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* High-Level Coverage Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                {/* Bike & Motor Insurance Card */}
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '1.5rem', padding: '1.5rem', backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#38bdf8', textTransform: 'uppercase' }}>Bike & Motor Cover</span>
                        <Bike size={22} style={{ color: '#38bdf8' }} />
                    </div>

                    <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white' }}>{formatCurrency(totalBikeIdv + totalCarIdv)}</h3>
                    <p style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '0.25rem' }}>Total Vehicle IDV Insured</p>

                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Vehicles Registered:</span>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.2rem' }}>
                            {bikeVehicleList.length > 0 ? bikeVehicleList.join(', ') : 'KA 01 AB 1234, AP 39 X 9988'}
                        </div>
                    </div>
                </div>

                {/* Term / Life Cover Card */}
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.6)', border: `1px solid ${lifeGap > 0 ? 'rgba(248, 113, 113, 0.3)' : 'rgba(52, 211, 153, 0.3)'}`,
                    borderRadius: '1.5rem', padding: '1.5rem', backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#a1a1aa', textTransform: 'uppercase' }}>Term / Life Cover</span>
                        <ShieldCheck size={20} style={{ color: lifeGap > 0 ? '#f87171' : '#34d399' }} />
                    </div>

                    <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white' }}>{formatCurrency(existingLifeCover)}</h3>
                    <p style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '0.25rem' }}>Recommended: {formatCurrency(recommendedLifeCover)}</p>

                    <div style={{ marginTop: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                            <span style={{ color: '#a1a1aa' }}>Adequacy</span>
                            <span style={{ color: lifeCoveragePct >= 80 ? '#34d399' : '#f87171', fontWeight: 'bold' }}>{lifeCoveragePct}%</span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${lifeCoveragePct}%`, backgroundColor: lifeCoveragePct >= 80 ? '#34d399' : '#f87171', borderRadius: '4px' }} />
                        </div>
                    </div>
                </div>

                {/* Health Cover Card */}
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.6)', border: `1px solid ${healthGap > 0 ? 'rgba(251, 191, 36, 0.3)' : 'rgba(52, 211, 153, 0.3)'}`,
                    borderRadius: '1.5rem', padding: '1.5rem', backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#a1a1aa', textTransform: 'uppercase' }}>Health Cover</span>
                        <HeartPulse size={20} style={{ color: healthGap > 0 ? '#fbbf24' : '#34d399' }} />
                    </div>

                    <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white' }}>{formatCurrency(existingHealthCover)}</h3>
                    <p style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '0.25rem' }}>Recommended: {formatCurrency(recommendedHealthCover)}</p>

                    <div style={{ marginTop: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                            <span style={{ color: '#a1a1aa' }}>Adequacy</span>
                            <span style={{ color: healthCoveragePct >= 80 ? '#34d399' : '#fbbf24', fontWeight: 'bold' }}>{healthCoveragePct}%</span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${healthCoveragePct}%`, backgroundColor: healthCoveragePct >= 80 ? '#34d399' : '#fbbf24', borderRadius: '4px' }} />
                        </div>
                    </div>
                </div>

                {/* Annual Premiums Card */}
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '1.5rem', padding: '1.5rem', backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#a1a1aa', textTransform: 'uppercase' }}>Annual Premiums</span>
                        <Info size={20} style={{ color: '#c084fc' }} />
                    </div>

                    <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#c084fc' }}>{formatCurrency(totalAnnualPremiums)}</h3>
                    <p style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '0.25rem' }}>Across {policyItems.length} active insurance policies</p>

                    <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#71717a' }}>
                        Premium to Income Ratio: <strong style={{ color: 'white' }}>{annualIncome > 0 ? ((totalAnnualPremiums / annualIncome) * 100).toFixed(1) : 0}%</strong> (Ideal: &lt; 5%)
                    </div>
                </div>
            </div>

            {/* Active Insurance Portfolio Table */}
            <div style={{
                backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '1.5rem', padding: '1.5rem', marginBottom: '2rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>Active Insurance Policies</h3>

                    {/* Filter Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.3)', padding: '0.3rem', borderRadius: '0.75rem' }}>
                        <button
                            onClick={() => setActiveTab('all')}
                            style={{
                                padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 'bold',
                                backgroundColor: activeTab === 'all' ? '#34d399' : 'transparent',
                                color: activeTab === 'all' ? 'black' : '#a1a1aa', border: 'none', cursor: 'pointer'
                            }}
                        >
                            All ({policyItems.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('bike')}
                            style={{
                                padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 'bold',
                                backgroundColor: activeTab === 'bike' ? '#38bdf8' : 'transparent',
                                color: activeTab === 'bike' ? 'black' : '#a1a1aa', border: 'none', cursor: 'pointer'
                            }}
                        >
                            🏍️ Bike & Motor
                        </button>
                        <button
                            onClick={() => setActiveTab('life')}
                            style={{
                                padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 'bold',
                                backgroundColor: activeTab === 'life' ? '#34d399' : 'transparent',
                                color: activeTab === 'life' ? 'black' : '#a1a1aa', border: 'none', cursor: 'pointer'
                            }}
                        >
                            🛡️ Life / Term
                        </button>
                        <button
                            onClick={() => setActiveTab('health')}
                            style={{
                                padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 'bold',
                                backgroundColor: activeTab === 'health' ? '#fbbf24' : 'transparent',
                                color: activeTab === 'health' ? 'black' : '#a1a1aa', border: 'none', cursor: 'pointer'
                            }}
                        >
                            🏥 Health
                        </button>

                        {archivedCount > 0 && (
                            <button
                                onClick={() => setShowArchived(v => !v)}
                                title="Archived policies are excluded from coverage totals"
                                style={{
                                    marginLeft: 'auto',
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.4rem 0.8rem', borderRadius: '0.5rem',
                                    backgroundColor: showArchived ? 'rgba(161,161,170,0.15)' : 'transparent',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: showArchived ? '#e4e4e7' : '#a1a1aa',
                                    fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer'
                                }}
                            >
                                <Archive size={13} />
                                {showArchived ? 'Hide' : 'Show'} archived ({archivedCount})
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#a1a1aa' }}>
                                <th style={{ padding: '0.75rem 1rem' }}>Policy / Plan Name</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Vehicle / Policy No</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Sum Assured / IDV</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Annual Premium</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Expiry Date</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPolicies.map(p => {
                                const details = p.policyDetails || {};
                                const cat = (details.category || '').toLowerCase();
                                const cover = Number(details.sumAssured || details.termCover || p.amount || 0);

                                return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'white' }}>
                                        {/* The policy's full record, including its premium
                                            history, lives under savings — so the name links
                                            there rather than duplicating it here. */}
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold' }}>
                                            <div
                                                onClick={() => navigate(`/savings/policy/${p.id}`)}
                                                title="Open full policy and premium history"
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                                                className="hover:text-sky-400 transition-colors"
                                            >
                                                {(cat === 'bike' || cat === 'car') && <Bike size={16} style={{ color: '#38bdf8' }} />}
                                                {cat === 'health' && <HeartPulse size={16} style={{ color: '#fbbf24' }} />}
                                                {cat === 'life' && <ShieldCheck size={16} style={{ color: '#34d399' }} />}
                                                <span style={{ textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)', textUnderlineOffset: '3px' }}>
                                                    {details.planName || p.title}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textTransform: 'capitalize', color: '#a1a1aa' }}>
                                            {details.category || 'General'}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#38bdf8', fontWeight: 'bold' }}>
                                            {details.vehicleNo || details.policyNumber || '-'}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#34d399', fontWeight: 'bold' }}>
                                            {formatCurrency(cover)}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#c084fc' }}>
                                            {formatCurrency(details.premiumAmount || 0)}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#a1a1aa' }}>
                                            {details.maturityDate || details.expiryDate || '-'}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            {/* Status reflects the expiry date rather than always
                                                claiming Active, and marks archived cover clearly. */}
                                            {(() => {
                                                const expired = isExpired(p);
                                                const label = p.isArchived ? 'Archived' : expired ? 'Expired' : 'Active';
                                                const tone = p.isArchived
                                                    ? { bg: 'rgba(161,161,170,0.15)', fg: '#a1a1aa' }
                                                    : expired
                                                        ? { bg: 'rgba(248,113,113,0.15)', fg: '#f87171' }
                                                        : { bg: 'rgba(52,211,153,0.15)', fg: '#34d399' };
                                                return (
                                                    <span style={{
                                                        fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: '0.4rem',
                                                        backgroundColor: tone.bg, color: tone.fg, fontWeight: 'bold'
                                                    }}>
                                                        {label}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => { setEditingPolicy(p); setIsModalOpen(true); }}
                                                    style={{ padding: '0.3rem 0.6rem', backgroundColor: 'rgba(255,255,255,0.05)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.4rem', cursor: 'pointer' }}
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => toggleArchived(p)}
                                                    title={p.isArchived ? 'Restore to active policies' : 'Archive this policy'}
                                                    style={{ padding: '0.3rem 0.6rem', backgroundColor: p.isArchived ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)', color: p.isArchived ? '#34d399' : '#a1a1aa', border: `1px solid ${p.isArchived ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '0.4rem', cursor: 'pointer' }}
                                                >
                                                    {p.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePolicy(p.id)}
                                                    style={{ padding: '0.3rem 0.6rem', backgroundColor: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '0.4rem', cursor: 'pointer' }}
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

            {/* Smart Advice Section */}
            <div style={{
                backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '1.5rem', padding: '1.5rem'
            }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Info style={{ color: '#38bdf8' }} size={20} /> Smart Policy Advice
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem', color: '#d4d4d8' }}>
                    <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(56, 189, 248, 0.08)', borderRadius: '0.75rem', borderLeft: '4px solid #38bdf8' }}>
                        <strong>Motor / Bike Insurance (IDV & NCB):</strong> Ensure your Insured Declared Value (IDV) matches market depreciation. Claim your No Claim Bonus (NCB) of up to 50% when renewing bike/car insurance.
                    </div>
                    {lifeGap > 0 && (
                        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(248, 113, 113, 0.08)', borderRadius: '0.75rem', borderLeft: '4px solid #f87171' }}>
                            <strong>Term Insurance Shortfall:</strong> You have a shortfall of {formatCurrency(lifeGap)} in life cover. Pure term insurance offers maximum coverage at lowest premium rates.
                        </div>
                    )}
                    {healthGap > 0 && (
                        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(251, 191, 36, 0.08)', borderRadius: '0.75rem', borderLeft: '4px solid #fbbf24' }}>
                            <strong>Health Top-Up:</strong> Consider adding a Super Top-Up plan of {formatCurrency(healthGap)} to cover unexpected hospital stays.
                        </div>
                    )}
                </div>
            </div>

            {/* Policy Scanner & Add Modal */}
            <PolicyScannerModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingPolicy(null); }}
                onSave={handleSavePolicy}
                editingPolicy={editingPolicy}
            />
        </div>
    );
};

export default InsuranceAnalysis;
