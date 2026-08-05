import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useSearchParams } from 'react-router-dom';
import { Plus, Landmark, FileText, CheckCircle, AlertCircle, Edit2, Trash2, ArrowUpRight, ArrowDownLeft, Calculator } from 'lucide-react';
import DocumentAttachments from '../components/DocumentAttachments';
import TaxModal from '../components/TaxModal';
import TaxPlanningCalculator from '../components/TaxPlanningCalculator';

const Taxes = () => {
    const { taxes, addItem, updateItem, deleteItem, formatCurrency } = useFinance();
    const [searchParams, setSearchParams] = useSearchParams();
    
    // Check initial tab from query param ?tab=planning
    const initialTab = searchParams.get('tab') || 'planning';
    const [activeTab, setActiveTab] = useState(initialTab); // 'planning', 'itr', 'partA', 'partB'
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);

    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam && ['planning', 'itr', 'partA', 'partB'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    const handleTabChange = (tabKey) => {
        setActiveTab(tabKey);
        setSearchParams({ tab: tabKey });
    };

    // Sort records by financial year descending
    // Each tab owns a document type, so a year can hold Form 16 Part A and B
    // and the ITR return side by side without them being confused for each other.
    const DOC_TYPES = {
        itr: { label: 'ITR Return', accent: '#34d399' },
        partA: { label: 'Form 16 Part A', accent: '#c084fc' },
        partB: { label: 'Form 16 Part B', accent: '#60a5fa' }
    };

    const saveTaxDocuments = (tax, documents) => {
        updateItem('taxes', { ...tax, documents });
    };

    const sortedTaxes = [...(taxes || [])].sort((a, b) => (b.financialYear || '').localeCompare(a.financialYear || ''));

    const handleSave = async (record) => {
        if (editingRecord) {
            await updateItem('taxes', record);
        } else {
            await addItem('taxes', record);
        }
        setIsModalOpen(false);
        setEditingRecord(null);
    };

    const handleEdit = (record) => {
        setEditingRecord(record);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this tax record?')) {
            await deleteItem('taxes', id);
        }
    };

    // Aggregate Metrics
    const totalTaxPaid = sortedTaxes.reduce((sum, tax) => sum + Number(tax.taxesPaid || 0), 0);
    
    // Refunds are negative numbers in taxPayableRefundable
    const totalRefundReceived = sortedTaxes.reduce((sum, tax) => {
        const val = Number(tax.taxPayableRefundable || 0);
        return val < 0 ? sum + Math.abs(val) : sum;
    }, 0);

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Landmark style={{ color: '#c084fc' }} size={32} />
                        Taxes & Regime Planning
                    </h1>
                    <p style={{ color: '#a1a1aa', marginTop: '0.5rem' }}>Compare tax regimes, calculate liabilities, and track ITR & Form 16 filings</p>
                </div>
                {activeTab !== 'planning' && (
                    <button
                        onClick={() => { setEditingRecord(null); setIsModalOpen(true); }}
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#c084fc',
                            color: 'black',
                            border: 'none',
                            borderRadius: '0.75rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'transform 0.2s',
                            boxShadow: '0 4px 6px rgba(192, 132, 252, 0.25)'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <Plus size={20} /> Record Tax Year
                    </button>
                )}
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap' }}>
                <button
                    onClick={() => handleTabChange('planning')}
                    style={{
                        padding: '1rem 1.5rem', background: 'transparent', border: 'none',
                        color: activeTab === 'planning' ? '#c084fc' : '#a1a1aa',
                        fontWeight: activeTab === 'planning' ? 'bold' : 'normal',
                        borderBottom: activeTab === 'planning' ? '2px solid #c084fc' : '2px solid transparent',
                        cursor: 'pointer', transition: 'all 0.2s', fontSize: '1rem',
                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}
                >
                    <Calculator size={18} /> Tax Planning & Regime Calculator
                </button>
                <button
                    onClick={() => handleTabChange('itr')}
                    style={{
                        padding: '1rem 1.5rem', background: 'transparent', border: 'none',
                        color: activeTab === 'itr' ? '#34d399' : '#a1a1aa',
                        fontWeight: activeTab === 'itr' ? 'bold' : 'normal',
                        borderBottom: activeTab === 'itr' ? '2px solid #34d399' : '2px solid transparent',
                        cursor: 'pointer', transition: 'all 0.2s', fontSize: '1rem'
                    }}
                >
                    ITR Returns
                </button>
                <button
                    onClick={() => handleTabChange('partA')}
                    style={{
                        padding: '1rem 1.5rem', background: 'transparent', border: 'none',
                        color: activeTab === 'partA' ? '#c084fc' : '#a1a1aa',
                        fontWeight: activeTab === 'partA' ? 'bold' : 'normal',
                        borderBottom: activeTab === 'partA' ? '2px solid #c084fc' : '2px solid transparent',
                        cursor: 'pointer', transition: 'all 0.2s', fontSize: '1rem'
                    }}
                >
                    Form 16 Part A
                </button>
                <button
                    onClick={() => handleTabChange('partB')}
                    style={{
                        padding: '1rem 1.5rem', background: 'transparent', border: 'none',
                        color: activeTab === 'partB' ? '#60a5fa' : '#a1a1aa',
                        fontWeight: activeTab === 'partB' ? 'bold' : 'normal',
                        borderBottom: activeTab === 'partB' ? '2px solid #60a5fa' : '2px solid transparent',
                        cursor: 'pointer', transition: 'all 0.2s', fontSize: '1rem'
                    }}
                >
                    Form 16 Part B
                </button>
            </div>

            {/* TAB CONTENT: Tax Planning & Regime Calculator */}
            {activeTab === 'planning' && (
                <TaxPlanningCalculator />
            )}

            {/* TAB CONTENT: ITR Returns Aggregates */}
            {activeTab === 'itr' && sortedTaxes.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div style={{ backgroundColor: 'rgba(52, 211, 153, 0.05)', border: '1px solid rgba(52, 211, 153, 0.2)', padding: '1.5rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '1rem', backgroundColor: 'rgba(52, 211, 153, 0.1)', borderRadius: '0.75rem', color: '#34d399' }}>
                            <ArrowUpRight size={24} />
                        </div>
                        <div>
                            <p style={{ color: '#a1a1aa', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Total Tax Paid (All Years)</p>
                            <h2 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{formatCurrency(totalTaxPaid)}</h2>
                        </div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(96, 165, 250, 0.05)', border: '1px solid rgba(96, 165, 250, 0.2)', padding: '1.5rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '1rem', backgroundColor: 'rgba(96, 165, 250, 0.1)', borderRadius: '0.75rem', color: '#60a5fa' }}>
                            <ArrowDownLeft size={24} />
                        </div>
                        <div>
                            <p style={{ color: '#a1a1aa', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Total Refund Received (All Years)</p>
                            <h2 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{formatCurrency(totalRefundReceived)}</h2>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: Tax Filings List (ITR, Part A, Part B) */}
            {activeTab !== 'planning' && (
                sortedTaxes.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '4rem', backgroundColor: 'rgba(255,255,255,0.02)',
                        borderRadius: '1.5rem', border: '1px dashed rgba(255,255,255,0.1)'
                    }}>
                        <FileText size={48} style={{ color: '#52525b', margin: '0 auto 1rem auto' }} />
                        <h3 style={{ fontSize: '1.25rem', color: '#e4e4e7', marginBottom: '0.5rem' }}>No Tax Records Found</h3>
                        <p style={{ color: '#a1a1aa' }}>Add your first financial year to start tracking Form 16 and ITR data.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                        {sortedTaxes.map((tax) => {
                            const isRefund = Number(tax.taxPayableRefundable || 0) < 0;
                            const isPayable = Number(tax.taxPayableRefundable || 0) > 0;
                            
                            return (
                                <div key={tax.id} style={{
                                    backgroundColor: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '1.5rem',
                                    padding: '1.5rem',
                                    transition: 'all 0.3s ease',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    {/* Tab Specific Highlight Color */}
                                    <div style={{ 
                                        position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', 
                                        backgroundColor: activeTab === 'itr' ? '#34d399' : activeTab === 'partA' ? '#c084fc' : '#60a5fa' 
                                    }} />
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', margin: 0 }}>FY {tax.financialYear}</h3>
                                            <p style={{ fontSize: '0.875rem', color: '#a1a1aa', margin: '0.25rem 0 0 0' }}>
                                                {activeTab === 'itr' ? `Filed on: ${tax.itrFilingDate || 'Not specified'}` : `Form 16: ${tax.form16Status}`}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => handleEdit(tax)} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '0.25rem' }}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(tax.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* ITR Tab Content */}
                                    {activeTab === 'itr' && (
                                        <>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '1rem' }}>
                                                    <p style={{ fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Income</p>
                                                    <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#34d399' }}>
                                                        {formatCurrency(Number(tax.totalIncome || 0))}
                                                    </p>
                                                </div>
                                                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '1rem' }}>
                                                    <p style={{ fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Taxes Paid</p>
                                                    <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#f87171' }}>
                                                        {formatCurrency(Number(tax.taxesPaid || 0))}
                                                    </p>
                                                </div>
                                            </div>

                                            <div style={{ marginBottom: '1.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                    <span style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>ITR Status:</span>
                                                    <span style={{ 
                                                        color: tax.itrStatus === 'Processed' ? '#34d399' : tax.itrStatus === 'Filed' ? '#60a5fa' : '#fbbf24', 
                                                        fontSize: '0.875rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem'
                                                    }}>
                                                        {tax.itrStatus === 'Processed' && <CheckCircle size={14} />}
                                                        {tax.itrStatus === 'Not Filed' && <AlertCircle size={14} />}
                                                        {tax.itrStatus}
                                                    </span>
                                                </div>
                                            </div>

                                            {(isRefund || isPayable) && (
                                                <div style={{ 
                                                    backgroundColor: isRefund ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                                                    border: `1px solid ${isRefund ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
                                                    padding: '1rem', borderRadius: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                                }}>
                                                    <span style={{ color: isRefund ? '#34d399' : '#f87171', fontWeight: 'bold', fontSize: '0.875rem' }}>
                                                        {isRefund ? 'Refund Due/Received' : 'Tax Payable'}
                                                    </span>
                                                    <span style={{ color: isRefund ? '#34d399' : '#f87171', fontWeight: 'bold', fontSize: '1.25rem' }}>
                                                        {formatCurrency(Math.abs(Number(tax.taxPayableRefundable || 0)))}
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Part A Tab Content */}
                                    {activeTab === 'partA' && (
                                        <>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '0.75rem' }}>
                                                    <p style={{ fontSize: '0.65rem', color: '#71717a', textTransform: 'uppercase' }}>Q1 Paid</p>
                                                    <p style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'white' }}>{formatCurrency(Number(tax.f16Q1Paid || 0))}</p>
                                                    <p style={{ fontSize: '0.65rem', color: '#71717a', textTransform: 'uppercase', marginTop: '0.25rem' }}>TDS</p>
                                                    <p style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#c084fc' }}>{formatCurrency(Number(tax.f16Q1Tds || 0))}</p>
                                                </div>
                                                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '0.75rem' }}>
                                                    <p style={{ fontSize: '0.65rem', color: '#71717a', textTransform: 'uppercase' }}>Q2 Paid</p>
                                                    <p style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'white' }}>{formatCurrency(Number(tax.f16Q2Paid || 0))}</p>
                                                    <p style={{ fontSize: '0.65rem', color: '#71717a', textTransform: 'uppercase', marginTop: '0.25rem' }}>TDS</p>
                                                    <p style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#c084fc' }}>{formatCurrency(Number(tax.f16Q2Tds || 0))}</p>
                                                </div>
                                                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '0.75rem' }}>
                                                    <p style={{ fontSize: '0.65rem', color: '#71717a', textTransform: 'uppercase' }}>Q3 Paid</p>
                                                    <p style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'white' }}>{formatCurrency(Number(tax.f16Q3Paid || 0))}</p>
                                                    <p style={{ fontSize: '0.65rem', color: '#71717a', textTransform: 'uppercase', marginTop: '0.25rem' }}>TDS</p>
                                                    <p style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#c084fc' }}>{formatCurrency(Number(tax.f16Q3Tds || 0))}</p>
                                                </div>
                                                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '0.75rem' }}>
                                                    <p style={{ fontSize: '0.65rem', color: '#71717a', textTransform: 'uppercase' }}>Q4 Paid</p>
                                                    <p style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'white' }}>{formatCurrency(Number(tax.f16Q4Paid || 0))}</p>
                                                    <p style={{ fontSize: '0.65rem', color: '#71717a', textTransform: 'uppercase', marginTop: '0.25rem' }}>TDS</p>
                                                    <p style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#c084fc' }}>{formatCurrency(Number(tax.f16Q4Tds || 0))}</p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '1rem' }}>
                                                    <span style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>Total Amount Paid</span>
                                                    <span style={{ color: 'white', fontWeight: 'bold' }}>{formatCurrency(Number(tax.f16AmountPaidPartA || 0))}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(192, 132, 252, 0.1)', border: '1px solid rgba(192, 132, 252, 0.2)', padding: '1rem', borderRadius: '1rem' }}>
                                                    <span style={{ color: '#c084fc', fontSize: '0.875rem', fontWeight: 'bold' }}>Total TDS Deducted</span>
                                                    <span style={{ color: '#c084fc', fontWeight: 'bold', fontSize: '1.125rem' }}>{formatCurrency(Number(tax.f16TdsPartA || 0))}</span>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Part B Tab Content */}
                                    {activeTab === 'partB' && (
                                        <>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '1rem' }}>
                                                    <p style={{ fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Gross Salary</p>
                                                    <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white' }}>
                                                        {formatCurrency(Number(tax.f16GrossSalary || 0))}
                                                    </p>
                                                </div>
                                                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '1rem' }}>
                                                    <p style={{ fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Taxable Income</p>
                                                    <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#60a5fa' }}>
                                                        {formatCurrency(Number(tax.f16TotalTaxableIncome || 0))}
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>80C Deductions:</span>
                                                    <span style={{ color: 'white', fontSize: '0.875rem' }}>{formatCurrency(Number(tax.f1680C || 0))}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>Total Chapter VI-A:</span>
                                                    <span style={{ color: 'white', fontSize: '0.875rem' }}>{formatCurrency(Number(tax.f16TotalChapterVIA || 0))}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                                    <span style={{ color: '#a1a1aa', fontSize: '0.875rem', fontWeight: 'bold' }}>Net Tax Payable:</span>
                                                    <span style={{ color: '#f87171', fontSize: '0.875rem', fontWeight: 'bold' }}>{formatCurrency(Number(tax.f16NetTaxPayable || 0))}</span>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {DOC_TYPES[activeTab] && (
                                        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                            <DocumentAttachments
                                                documents={tax.documents || []}
                                                onChange={(docs) => saveTaxDocuments(tax, docs)}
                                                docType={DOC_TYPES[activeTab].label}
                                                accent={DOC_TYPES[activeTab].accent}
                                                namePrefix={`FY${tax.financialYear || ''}`}
                                                emptyText={`No ${DOC_TYPES[activeTab].label} uploaded for FY ${tax.financialYear}`}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            <TaxModal 
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingRecord(null); }}
                onSave={handleSave}
                taxRecord={editingRecord}
            />
        </div>
    );
};

export default Taxes;
