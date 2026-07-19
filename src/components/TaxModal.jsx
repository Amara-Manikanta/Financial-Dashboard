import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

const InputField = ({ label, type = "text", value, onChange, placeholder, required = false }) => (
    <div style={{ flex: '1', minWidth: '200px' }}>
        <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '0.5rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.75rem',
                color: 'white',
                fontSize: '0.875rem',
                outline: 'none',
                transition: 'all 0.2s ease',
            }}
            onFocus={(e) => {
                e.target.style.borderColor = '#c084fc';
                e.target.style.backgroundColor = 'rgba(192, 132, 252, 0.05)';
            }}
            onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                e.target.style.backgroundColor = 'rgba(255,255,255,0.03)';
            }}
        />
    </div>
);

const TaxModal = ({ isOpen, onClose, onSave, taxRecord = null }) => {
    const [activeTab, setActiveTab] = useState('itr'); // 'partA', 'partB', 'itr'
    
    const [formData, setFormData] = useState({
        financialYear: '',
        form16Status: 'Not Received',
        form16Notes: '',
        itrStatus: 'Not Filed',
        itrAckNumber: '',
        itrFilingDate: '',
        businessLoss: '',
        totalIncome: '',
        bookProfitMAT: '',
        adjustedTotalIncomeAMT: '',
        netTaxPayable: '',
        interestFeePayable: '',
        totalTaxInterestFeePayable: '',
        taxesPaid: '',
        taxPayableRefundable: '',
        accretedIncome: '',
        addlTaxPayable115TD: '',
        interestPayable115TE: '',
        addlTaxInterestPayable: '',
        taxInterestPaid: '',
        accretedTaxPayableRefundable: '',
        
        // Form 16 Part A Fields
        f16AmountPaidPartA: '',
        f16TdsPartA: '',
        f16Q1Paid: '',
        f16Q1Tds: '',
        f16Q2Paid: '',
        f16Q2Tds: '',
        f16Q3Paid: '',
        f16Q3Tds: '',
        f16Q4Paid: '',
        f16Q4Tds: '',

        // Form 16 Part B Fields
        f16Salary17_1: '',
        f16Perquisites17_2: '',
        f16Profits17_3: '',
        f16GrossSalary: '',
        f16HRA: '',
        f16TotalSalaryCurrentEmployer: '',
        f16StandardDeduction: '',
        f16ProfessionalTax: '',
        f16IncomeChargeableSalaries: '',
        f16GrossTotalIncome: '',
        f1680C: '',
        f16TotalChapterVIA: '',
        f16TotalTaxableIncome: '',
        f16TaxOnTotalIncome: '',
        f16HealthEducationCess: '',
        f16TaxPayable: '',
        f16NetTaxPayable: '',
        
        notes: ''
    });

    useEffect(() => {
        setActiveTab('itr');
        if (taxRecord) {
            setFormData({ ...taxRecord });
        } else {
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth();
            const startYear = currentMonth > 2 ? currentYear : currentYear - 1;
            
            setFormData({
                financialYear: `${startYear}-${startYear + 1}`,
                form16Status: 'Not Received',
                form16Notes: '',
                itrStatus: 'Not Filed',
                itrAckNumber: '',
                itrFilingDate: '',
                businessLoss: '',
                totalIncome: '',
                bookProfitMAT: '',
                adjustedTotalIncomeAMT: '',
                netTaxPayable: '',
                interestFeePayable: '',
                totalTaxInterestFeePayable: '',
                taxesPaid: '',
                taxPayableRefundable: '',
                accretedIncome: '',
                addlTaxPayable115TD: '',
                interestPayable115TE: '',
                addlTaxInterestPayable: '',
                taxInterestPaid: '',
                accretedTaxPayableRefundable: '',
                
                f16AmountPaidPartA: '',
                f16TdsPartA: '',
                f16Q1Paid: '',
                f16Q1Tds: '',
                f16Q2Paid: '',
                f16Q2Tds: '',
                f16Q3Paid: '',
                f16Q3Tds: '',
                f16Q4Paid: '',
                f16Q4Tds: '',

                f16Salary17_1: '',
                f16Perquisites17_2: '',
                f16Profits17_3: '',
                f16GrossSalary: '',
                f16HRA: '',
                f16TotalSalaryCurrentEmployer: '',
                f16StandardDeduction: '',
                f16ProfessionalTax: '',
                f16IncomeChargeableSalaries: '',
                f16GrossTotalIncome: '',
                f1680C: '',
                f16TotalChapterVIA: '',
                f16TotalTaxableIncome: '',
                f16TaxOnTotalIncome: '',
                f16HealthEducationCess: '',
                f16TaxPayable: '',
                f16NetTaxPayable: '',
                
                notes: ''
            });
        }
    }, [taxRecord, isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...formData,
            id: taxRecord ? taxRecord.id : Date.now().toString(),
            updatedAt: new Date().toISOString()
        });
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem', animation: 'fadeIn 0.2s ease-out'
        }}>
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }} onClick={onClose} />
            
            <div style={{
                position: 'relative',
                backgroundColor: '#18181b',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '1.5rem',
                width: '100%',
                maxWidth: '900px',
                height: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', margin: 0 }}>
                            {taxRecord ? `Edit Tax Record - FY ${formData.financialYear}` : 'Add Tax Record'}
                        </h2>
                        {/* Always show Financial Year input at the top regardless of tab */}
                        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>Financial Year:</span>
                            <input
                                type="text"
                                value={formData.financialYear}
                                onChange={e => setFormData({...formData, financialYear: e.target.value})}
                                placeholder="e.g. 2023-2024"
                                required
                                style={{
                                    padding: '0.25rem 0.5rem', backgroundColor: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem',
                                    color: 'white', fontSize: '0.875rem', width: '120px'
                                }}
                            />
                        </div>
                    </div>
                    <button type="button" onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.05)', border: 'none', color: '#a1a1aa',
                        padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0 1.5rem' }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('itr')}
                        style={{
                            padding: '1rem', border: 'none', background: 'transparent',
                            color: activeTab === 'itr' ? '#34d399' : '#71717a',
                            fontWeight: activeTab === 'itr' ? 'bold' : 'normal',
                            borderBottom: activeTab === 'itr' ? '2px solid #34d399' : '2px solid transparent',
                            cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.2s'
                        }}
                    >
                        ITR Returns
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('partA')}
                        style={{
                            padding: '1rem', border: 'none', background: 'transparent',
                            color: activeTab === 'partA' ? '#c084fc' : '#71717a',
                            fontWeight: activeTab === 'partA' ? 'bold' : 'normal',
                            borderBottom: activeTab === 'partA' ? '2px solid #c084fc' : '2px solid transparent',
                            cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.2s'
                        }}
                    >
                        Form 16 Part A
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('partB')}
                        style={{
                            padding: '1rem', border: 'none', background: 'transparent',
                            color: activeTab === 'partB' ? '#60a5fa' : '#71717a',
                            fontWeight: activeTab === 'partB' ? 'bold' : 'normal',
                            borderBottom: activeTab === 'partB' ? '2px solid #60a5fa' : '2px solid transparent',
                            cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.2s'
                        }}
                    >
                        Form 16 Part B
                    </button>
                </div>

                {/* Scrollable Content */}
                <form id="taxForm" onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    {/* --- ITR TAB --- */}
                    <div style={{ display: activeTab === 'itr' ? 'block' : 'none', animation: 'fadeIn 0.2s ease-out' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
                            <div style={{ flex: '1', minWidth: '200px' }}>
                                <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '0.5rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    ITR Status
                                </label>
                                <select 
                                    value={formData.itrStatus}
                                    onChange={e => setFormData({...formData, itrStatus: e.target.value})}
                                    style={{
                                        width: '100%', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem',
                                        color: 'white', fontSize: '0.875rem', outline: 'none'
                                    }}
                                >
                                    <option value="Not Filed">Not Filed</option>
                                    <option value="Filed">Filed</option>
                                    <option value="Processed">Processed</option>
                                    <option value="Defective">Defective</option>
                                </select>
                            </div>
                            <InputField 
                                label="ITR Acknowledgement Number" 
                                value={formData.itrAckNumber} 
                                onChange={e => setFormData({...formData, itrAckNumber: e.target.value})} 
                            />
                            <InputField 
                                label="ITR Filing Date" 
                                type="date"
                                value={formData.itrFilingDate} 
                                onChange={e => setFormData({...formData, itrFilingDate: e.target.value})} 
                            />
                        </div>

                        <h3 style={{ fontSize: '1rem', color: '#34d399', marginBottom: '1rem', fontWeight: 'bold', borderBottom: '1px solid rgba(52, 211, 153, 0.2)', paddingBottom: '0.5rem' }}>Taxable Income & Tax Details (As per ITR Ack)</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                            <InputField label="1A. Total Income (₹)" type="number" value={formData.totalIncome} onChange={e => setFormData({...formData, totalIncome: e.target.value})} />
                            <InputField label="1. Current Year Business Loss (₹)" type="number" value={formData.businessLoss} onChange={e => setFormData({...formData, businessLoss: e.target.value})} />
                            <InputField label="2. Book Profit MAT (₹)" type="number" value={formData.bookProfitMAT} onChange={e => setFormData({...formData, bookProfitMAT: e.target.value})} />
                            <InputField label="3. Adjusted Total Income AMT (₹)" type="number" value={formData.adjustedTotalIncomeAMT} onChange={e => setFormData({...formData, adjustedTotalIncomeAMT: e.target.value})} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                            <InputField label="4. Net Tax Payable (₹)" type="number" value={formData.netTaxPayable} onChange={e => setFormData({...formData, netTaxPayable: e.target.value})} />
                            <InputField label="5. Interest and Fee Payable (₹)" type="number" value={formData.interestFeePayable} onChange={e => setFormData({...formData, interestFeePayable: e.target.value})} />
                            <InputField label="6. Total Tax, Interest & Fee (₹)" type="number" value={formData.totalTaxInterestFeePayable} onChange={e => setFormData({...formData, totalTaxInterestFeePayable: e.target.value})} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                            <InputField label="7. Taxes Paid (₹)" type="number" value={formData.taxesPaid} onChange={e => setFormData({...formData, taxesPaid: e.target.value})} />
                            <InputField label="8. (+ Payable / - Refundable) (₹)" type="number" value={formData.taxPayableRefundable} onChange={e => setFormData({...formData, taxPayableRefundable: e.target.value})} />
                        </div>

                        <h3 style={{ fontSize: '1rem', color: '#f87171', marginBottom: '1rem', marginTop: '2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(248, 113, 113, 0.2)', paddingBottom: '0.5rem' }}>Accreted Income & Tax Detail</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                            <InputField label="9. Accreted Income u/s 115TD" type="number" value={formData.accretedIncome} onChange={e => setFormData({...formData, accretedIncome: e.target.value})} />
                            <InputField label="10. Addl Tax Payable u/s 115TD" type="number" value={formData.addlTaxPayable115TD} onChange={e => setFormData({...formData, addlTaxPayable115TD: e.target.value})} />
                            <InputField label="11. Interest Payable u/s 115TE" type="number" value={formData.interestPayable115TE} onChange={e => setFormData({...formData, interestPayable115TE: e.target.value})} />
                            <InputField label="12. Addl Tax & Interest Payable" type="number" value={formData.addlTaxInterestPayable} onChange={e => setFormData({...formData, addlTaxInterestPayable: e.target.value})} />
                            <InputField label="13. Tax & Interest Paid" type="number" value={formData.taxInterestPaid} onChange={e => setFormData({...formData, taxInterestPaid: e.target.value})} />
                            <InputField label="14. (+ Payable / - Refundable)" type="number" value={formData.accretedTaxPayableRefundable} onChange={e => setFormData({...formData, accretedTaxPayableRefundable: e.target.value})} />
                        </div>
                    </div>

                    {/* --- PART A TAB --- */}
                    <div style={{ display: activeTab === 'partA' ? 'block' : 'none', animation: 'fadeIn 0.2s ease-out' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
                            <div style={{ flex: '1', minWidth: '200px' }}>
                                <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '0.5rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Form 16 Status
                                </label>
                                <select 
                                    value={formData.form16Status}
                                    onChange={e => setFormData({...formData, form16Status: e.target.value})}
                                    style={{
                                        width: '100%', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem',
                                        color: 'white', fontSize: '0.875rem', outline: 'none'
                                    }}
                                >
                                    <option value="Not Received">Not Received</option>
                                    <option value="Received">Received</option>
                                    <option value="Not Applicable">Not Applicable</option>
                                </select>
                            </div>
                        </div>

                        <h3 style={{ fontSize: '1rem', color: '#c084fc', marginBottom: '1rem', fontWeight: 'bold', borderBottom: '1px solid rgba(192, 132, 252, 0.2)', paddingBottom: '0.5rem' }}>Part A Quarterly Details</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                            <InputField label="Q1 Amount Paid (₹)" type="number" value={formData.f16Q1Paid} onChange={e => setFormData({...formData, f16Q1Paid: e.target.value})} />
                            <InputField label="Q1 Tax Deducted (₹)" type="number" value={formData.f16Q1Tds} onChange={e => setFormData({...formData, f16Q1Tds: e.target.value})} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                            <InputField label="Q2 Amount Paid (₹)" type="number" value={formData.f16Q2Paid} onChange={e => setFormData({...formData, f16Q2Paid: e.target.value})} />
                            <InputField label="Q2 Tax Deducted (₹)" type="number" value={formData.f16Q2Tds} onChange={e => setFormData({...formData, f16Q2Tds: e.target.value})} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                            <InputField label="Q3 Amount Paid (₹)" type="number" value={formData.f16Q3Paid} onChange={e => setFormData({...formData, f16Q3Paid: e.target.value})} />
                            <InputField label="Q3 Tax Deducted (₹)" type="number" value={formData.f16Q3Tds} onChange={e => setFormData({...formData, f16Q3Tds: e.target.value})} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                            <InputField label="Q4 Amount Paid (₹)" type="number" value={formData.f16Q4Paid} onChange={e => setFormData({...formData, f16Q4Paid: e.target.value})} />
                            <InputField label="Q4 Tax Deducted (₹)" type="number" value={formData.f16Q4Tds} onChange={e => setFormData({...formData, f16Q4Tds: e.target.value})} />
                        </div>

                        <h3 style={{ fontSize: '1rem', color: '#c084fc', marginBottom: '1rem', fontWeight: 'bold', borderBottom: '1px solid rgba(192, 132, 252, 0.2)', paddingBottom: '0.5rem' }}>Part A Totals</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                            <InputField label="Total Amount Paid/Credited (₹)" type="number" value={formData.f16AmountPaidPartA} onChange={e => setFormData({...formData, f16AmountPaidPartA: e.target.value})} />
                            <InputField label="Total Tax Deducted (TDS) (₹)" type="number" value={formData.f16TdsPartA} onChange={e => setFormData({...formData, f16TdsPartA: e.target.value})} />
                        </div>
                    </div>

                    {/* --- PART B TAB --- */}
                    <div style={{ display: activeTab === 'partB' ? 'block' : 'none', animation: 'fadeIn 0.2s ease-out' }}>
                        <h3 style={{ fontSize: '1rem', color: '#60a5fa', marginBottom: '1rem', fontWeight: 'bold', borderBottom: '1px solid rgba(96, 165, 250, 0.2)', paddingBottom: '0.5rem' }}>Form 16 Part B Summary</h3>
                        
                        <h4 style={{ fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.5rem', fontWeight: '600' }}>Gross Salary & Allowances</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                            <InputField label="1(a) Salary u/s 17(1) (₹)" type="number" value={formData.f16Salary17_1} onChange={e => setFormData({...formData, f16Salary17_1: e.target.value})} />
                            <InputField label="1(b) Perquisites u/s 17(2) (₹)" type="number" value={formData.f16Perquisites17_2} onChange={e => setFormData({...formData, f16Perquisites17_2: e.target.value})} />
                            <InputField label="1(c) Profits in lieu u/s 17(3) (₹)" type="number" value={formData.f16Profits17_3} onChange={e => setFormData({...formData, f16Profits17_3: e.target.value})} />
                            <InputField label="1(d) Gross Salary Total (₹)" type="number" value={formData.f16GrossSalary} onChange={e => setFormData({...formData, f16GrossSalary: e.target.value})} />
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                            <InputField label="2(e) HRA Exempt u/s 10(13A) (₹)" type="number" value={formData.f16HRA} onChange={e => setFormData({...formData, f16HRA: e.target.value})} />
                            <InputField label="3 Total Salary from Current Employer (₹)" type="number" value={formData.f16TotalSalaryCurrentEmployer} onChange={e => setFormData({...formData, f16TotalSalaryCurrentEmployer: e.target.value})} />
                        </div>

                        <h4 style={{ fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.5rem', fontWeight: '600' }}>Deductions & Taxable Income</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                            <InputField label="4(a) Standard Deduction u/s 16(ia) (₹)" type="number" value={formData.f16StandardDeduction} onChange={e => setFormData({...formData, f16StandardDeduction: e.target.value})} />
                            <InputField label="4(c) Professional Tax u/s 16(iii) (₹)" type="number" value={formData.f16ProfessionalTax} onChange={e => setFormData({...formData, f16ProfessionalTax: e.target.value})} />
                            <InputField label="6 Income Chargeable 'Salaries' (₹)" type="number" value={formData.f16IncomeChargeableSalaries} onChange={e => setFormData({...formData, f16IncomeChargeableSalaries: e.target.value})} />
                            <InputField label="9 Gross Total Income (₹)" type="number" value={formData.f16GrossTotalIncome} onChange={e => setFormData({...formData, f16GrossTotalIncome: e.target.value})} />
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                            <InputField label="10(a) Deduction u/s 80C (₹)" type="number" value={formData.f1680C} onChange={e => setFormData({...formData, f1680C: e.target.value})} />
                            <InputField label="11 Aggregate Deductions Chapter VI-A (₹)" type="number" value={formData.f16TotalChapterVIA} onChange={e => setFormData({...formData, f16TotalChapterVIA: e.target.value})} />
                            <InputField label="12 Total Taxable Income (₹)" type="number" value={formData.f16TotalTaxableIncome} onChange={e => setFormData({...formData, f16TotalTaxableIncome: e.target.value})} />
                        </div>

                        <h4 style={{ fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.5rem', fontWeight: '600' }}>Tax Calculation</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                            <InputField label="13 Tax on Total Income (₹)" type="number" value={formData.f16TaxOnTotalIncome} onChange={e => setFormData({...formData, f16TaxOnTotalIncome: e.target.value})} />
                            <InputField label="16 Health and Education Cess (₹)" type="number" value={formData.f16HealthEducationCess} onChange={e => setFormData({...formData, f16HealthEducationCess: e.target.value})} />
                            <InputField label="17 Tax Payable (₹)" type="number" value={formData.f16TaxPayable} onChange={e => setFormData({...formData, f16TaxPayable: e.target.value})} />
                            <InputField label="21 Net Tax Payable (₹)" type="number" value={formData.f16NetTaxPayable} onChange={e => setFormData({...formData, f16NetTaxPayable: e.target.value})} />
                        </div>
                    </div>

                    {/* Shared Notes (Appears on all tabs at the bottom) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                        <div style={{ flex: '1' }}>
                            <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '0.5rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                General Notes
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                placeholder="Any additional notes..."
                                rows={3}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem',
                                    color: 'white', fontSize: '0.875rem', outline: 'none', resize: 'vertical'
                                }}
                            />
                        </div>
                    </div>

                </form>

                <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button type="button" onClick={onClose} style={{
                        padding: '0.75rem 1.5rem', borderRadius: '0.75rem', backgroundColor: 'transparent',
                        color: 'white', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                        fontSize: '0.875rem', fontWeight: 'bold'
                    }}>
                        Cancel
                    </button>
                    <button type="submit" form="taxForm" style={{
                        padding: '0.75rem 1.5rem', borderRadius: '0.75rem', backgroundColor: '#c084fc',
                        color: 'black', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                        gap: '0.5rem', fontSize: '0.875rem', fontWeight: 'bold'
                    }}>
                        <Save size={16} /> Save Tax Record
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaxModal;
