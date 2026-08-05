import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Calculator, Sparkles, FileText, ArrowDownLeft, ArrowUpRight, CheckCircle2, AlertCircle, Landmark } from 'lucide-react';

const TaxPlanningCalculator = () => {
    const { salaryDetails, savings, taxes, formatCurrency } = useFinance();

    // Available Form 16 / Tax records sorted by FY descending
    const sortedTaxRecords = [...(taxes || [])].sort((a, b) => (b.financialYear || '').localeCompare(a.financialYear || ''));
    const latestTaxRecord = sortedTaxRecords[0];

    const [selectedFy, setSelectedFy] = useState(latestTaxRecord?.financialYear || '2026-2027');

    // Income fields
    const [basicSalary, setBasicSalary] = useState(600000);
    const [hra, setHra] = useState(250000);
    const [otherAllowances, setOtherAllowances] = useState(350000);
    const [bonus, setBonus] = useState(100000);

    // Form 16 TDS Paid state
    const [tdsPaid, setTdsPaid] = useState(108302);

    // Deductions fields (Old Regime)
    const [sec80C, setSec80C] = useState(150000);
    const [sec80D, setSec80D] = useState(25000);
    const [nps80CCD, setNps80CCD] = useState(50000);
    const [homeLoanInterest, setHomeLoanInterest] = useState(0);
    
    // HRA Exemption inputs
    const [actualRentPaid, setActualRentPaid] = useState(180000); // 15k/mo
    const [isMetroCity, setIsMetroCity] = useState(true);

    // Load data dynamically from selected Form 16 / salaryDetails / savings
    useEffect(() => {
        const record = sortedTaxRecords.find(t => t.financialYear === selectedFy) || latestTaxRecord;
        if (record) {
            if (record.taxesPaid) setTdsPaid(Number(record.taxesPaid));
            else if (record.f16TdsPartA) setTdsPaid(Number(record.f16TdsPartA));

            if (record.f1680C) setSec80C(Number(record.f1680C));
            if (record.f16GrossSalary || record.totalIncome) {
                const total = Number(record.f16GrossSalary || record.totalIncome || 0);
                if (total > 0) {
                    setBasicSalary(Math.round(total * 0.45));
                    setHra(Math.round(total * 0.20));
                    setOtherAllowances(Math.round(total * 0.25));
                    setBonus(Math.round(total * 0.10));
                }
            }
        } else {
            const annualRecord = (salaryDetails || []).find(s => s.type === 'annual');
            if (annualRecord) {
                setBasicSalary(Number(annualRecord.basicSalary) || 600000);
                setHra(Number(annualRecord.hra) || 250000);
                const flexi = (Number(annualRecord.conveyanceAllowance) || 0) + (Number(annualRecord.flexibleAllowance) || 0);
                setOtherAllowances(flexi || 350000);
                setBonus(Number(annualRecord.performanceBonus) || 100000);
            }
        }

        // Auto-sum 80C from PF + PPF + Policies if sec80C is default
        let auto80C = 0;
        const annualSalaryRec = (salaryDetails || []).find(s => s.type === 'annual');
        if (annualSalaryRec?.pf) auto80C += Number(annualSalaryRec.pf);

        (savings || []).forEach(item => {
            if (item.type === 'ppf' || item.type === 'Policy') {
                auto80C += Number(item.amount || 0);
            }
        });
        if (auto80C > 0 && !record?.f1680C) setSec80C(Math.min(150000, auto80C));
    }, [selectedFy, salaryDetails, savings, taxes]);

    const grossIncome = Number(basicSalary) + Number(hra) + Number(otherAllowances) + Number(bonus);

    // HRA Exemption Calculation
    const tenPctBasic = Number(basicSalary) * 0.10;
    const rentMinusTenPct = Math.max(0, Number(actualRentPaid) - tenPctBasic);
    const basicLimit = Number(basicSalary) * (isMetroCity ? 0.50 : 0.40);
    const hraExemption = Math.min(Number(hra), rentMinusTenPct, basicLimit);

    // Old Regime Tax Calculation
    const oldStdDeduction = 50000;
    const capped80C = Math.min(150000, Number(sec80C));
    const capped80D = Math.min(75000, Number(sec80D));
    const cappedNps = Math.min(50000, Number(nps80CCD));
    const cappedHomeLoan = Math.min(200000, Number(homeLoanInterest));

    const totalOldDeductions = oldStdDeduction + hraExemption + capped80C + capped80D + cappedNps + cappedHomeLoan;
    const oldTaxableIncome = Math.max(0, grossIncome - totalOldDeductions);

    const calculateOldTax = (taxable) => {
        if (taxable <= 250000) return 0;
        let tax = 0;
        if (taxable <= 500000) {
            return 0;
        } else {
            tax += 250000 * 0.05; // 12,500
        }
        if (taxable <= 1000000) {
            tax += (taxable - 500000) * 0.20;
        } else {
            tax += 500000 * 0.20; // 1,00,000
            tax += (taxable - 1000000) * 0.30;
        }
        const cess = tax * 0.04;
        return tax + cess;
    };

    // New Regime Tax Calculation (FY 2026-27 Slabs)
    const newStdDeduction = 75000;
    const newTaxableIncome = Math.max(0, grossIncome - newStdDeduction);

    const calculateNewTax = (taxable) => {
        if (taxable <= 400000) return 0;
        if (taxable <= 1200000) return 0; // Full 87A rebate under updated new regime

        let tax = 0;
        tax += 400000 * 0.05;
        tax += 400000 * 0.10;

        if (taxable <= 1600000) {
            tax += (taxable - 1200000) * 0.15;
        } else {
            tax += 400000 * 0.15;
            if (taxable <= 2000000) {
                tax += (taxable - 1600000) * 0.20;
            } else {
                tax += 400000 * 0.20;
                if (taxable <= 2400000) {
                    tax += (taxable - 2000000) * 0.25;
                } else {
                    tax += 400000 * 0.25;
                    tax += (taxable - 2400000) * 0.30;
                }
            }
        }
        const cess = tax * 0.04;
        return tax + cess;
    };

    const oldTax = calculateOldTax(oldTaxableIncome);
    const newTax = calculateNewTax(newTaxableIncome);
    const taxDifference = Math.abs(oldTax - newTax);
    const isNewRegimeBetter = newTax <= oldTax;

    // Refund / Net Payable Calculations
    const oldRefundOrPayable = Number(tdsPaid) - oldTax;
    const newRefundOrPayable = Number(tdsPaid) - newTax;

    return (
        <div>
            {/* Form 16 / Year Quick Selector Bar */}
            <div style={{
                backgroundColor: 'rgba(192, 132, 252, 0.08)', border: '1px solid rgba(192, 132, 252, 0.2)',
                borderRadius: '1.25rem', padding: '1rem 1.5rem', marginBottom: '1.5rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Landmark style={{ color: '#c084fc' }} size={22} />
                    <div>
                        <span style={{ fontSize: '0.85rem', color: '#c084fc', fontWeight: 'bold' }}>⚡ Form 16 & ITR Data Source</span>
                        <p style={{ fontSize: '0.75rem', color: '#a1a1aa', margin: 0 }}>Dynamically populated from Form 16 & salary records</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <label style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Select FY:</label>
                    <select
                        value={selectedFy}
                        onChange={(e) => setSelectedFy(e.target.value)}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '0.75rem',
                            backgroundColor: '#27272a', border: '1px solid rgba(192, 132, 252, 0.4)',
                            color: '#c084fc', fontWeight: 'bold', outline: 'none', cursor: 'pointer'
                        }}
                    >
                        {sortedTaxRecords.map(t => (
                            <option key={t.id} value={t.financialYear}>
                                FY {t.financialYear} ({t.form16Status === 'Received' ? 'Form 16 Received' : 'ITR Record'})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Recommendation & Returns Winner Banner */}
            <div style={{
                backgroundColor: isNewRegimeBetter ? 'rgba(52, 211, 153, 0.1)' : 'rgba(192, 132, 252, 0.1)',
                border: `1px solid ${isNewRegimeBetter ? 'rgba(52, 211, 153, 0.3)' : 'rgba(192, 132, 252, 0.3)'}`,
                borderRadius: '1.5rem', padding: '1.5rem', marginBottom: '2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        padding: '0.75rem', borderRadius: '1rem',
                        backgroundColor: isNewRegimeBetter ? '#34d399' : '#c084fc', color: 'black'
                    }}>
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>
                            {isNewRegimeBetter ? 'New Tax Regime is Recommended' : 'Old Tax Regime is Recommended'}
                        </h3>
                        <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                            You save <strong style={{ color: '#34d399' }}>{formatCurrency(taxDifference)}</strong> in taxes by opting for the {isNewRegimeBetter ? 'New Regime' : 'Old Regime'}.
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'right', flexWrap: 'wrap' }}>
                    <div>
                        <span style={{ fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase' }}>Old Tax Payable</span>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: oldTax > newTax ? '#f87171' : '#34d399' }}>{formatCurrency(oldTax)}</h4>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase' }}>New Tax Payable</span>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: newTax > oldTax ? '#f87171' : '#34d399' }}>{formatCurrency(newTax)}</h4>
                    </div>
                </div>
            </div>

            {/* Form 16 TDS & Expected Returns Card */}
            <div style={{
                backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '1.5rem', padding: '1.5rem', marginBottom: '2rem', backdropFilter: 'blur(10px)'
            }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ArrowDownLeft size={20} /> Form 16 TDS & Estimated ITR Returns (FY {selectedFy})
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Form 16 TDS Deducted</span>
                        <span style={{ fontSize: '1.35rem', fontWeight: 'bold', color: '#c084fc' }}>{formatCurrency(tdsPaid)}</span>
                    </div>

                    <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Old Regime Return / (Payable)</span>
                        <span style={{ fontSize: '1.35rem', fontWeight: 'bold', color: oldRefundOrPayable >= 0 ? '#34d399' : '#f87171' }}>
                            {oldRefundOrPayable >= 0 ? `+ ${formatCurrency(oldRefundOrPayable)} Refund` : `- ${formatCurrency(Math.abs(oldRefundOrPayable))} Payable`}
                        </span>
                    </div>

                    <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>New Regime Return / (Payable)</span>
                        <span style={{ fontSize: '1.35rem', fontWeight: 'bold', color: newRefundOrPayable >= 0 ? '#34d399' : '#f87171' }}>
                            {newRefundOrPayable >= 0 ? `+ ${formatCurrency(newRefundOrPayable)} Refund` : `- ${formatCurrency(Math.abs(newRefundOrPayable))} Payable`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Inputs & Comparison Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Income Inputs Card */}
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '1.5rem', padding: '1.5rem', backdropFilter: 'blur(10px)'
                }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: '0.5rem' }}>
                        Salary & Gross Income
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                <label style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Basic Salary (₹)</label>
                                {basicSalary > 0 && <span style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 'bold' }}>{formatCurrency(basicSalary)}</span>}
                            </div>
                            <input
                                type="number"
                                value={basicSalary}
                                onChange={(e) => setBasicSalary(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                <label style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>HRA Allowance Received (₹)</label>
                                {hra > 0 && <span style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 'bold' }}>{formatCurrency(hra)}</span>}
                            </div>
                            <input
                                type="number"
                                value={hra}
                                onChange={(e) => setHra(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                <label style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Special / Flexible Allowances (₹)</label>
                                {otherAllowances > 0 && <span style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 'bold' }}>{formatCurrency(otherAllowances)}</span>}
                            </div>
                            <input
                                type="number"
                                value={otherAllowances}
                                onChange={(e) => setOtherAllowances(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                <label style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Performance Bonus (₹)</label>
                                {bonus > 0 && <span style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 'bold' }}>{formatCurrency(bonus)}</span>}
                            </div>
                            <input
                                type="number"
                                value={bonus}
                                onChange={(e) => setBonus(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>Total Gross Income</span>
                            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>{formatCurrency(grossIncome)}</span>
                        </div>
                    </div>
                </div>

                {/* Deductions & TDS Card (Old Regime) */}
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '1.5rem', padding: '1.5rem', backdropFilter: 'blur(10px)'
                }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#c084fc', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: '0.5rem' }}>
                        TDS & Old Regime Deductions
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                <label style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Form 16 TDS Deducted (₹)</label>
                                {tdsPaid > 0 && <span style={{ color: '#c084fc', fontSize: '0.8rem', fontWeight: 'bold' }}>{formatCurrency(tdsPaid)}</span>}
                            </div>
                            <input
                                type="number"
                                value={tdsPaid}
                                onChange={(e) => setTdsPaid(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(192, 132, 252, 0.3)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                <label style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Sec 80C (PF, PPF, Policy) - Max 1.5L</label>
                                {sec80C > 0 && <span style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 'bold' }}>{formatCurrency(sec80C)}</span>}
                            </div>
                            <input
                                type="number"
                                value={sec80C}
                                onChange={(e) => setSec80C(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                <label style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Sec 80D Health Insurance (Max 25k/50k)</label>
                                {sec80D > 0 && <span style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 'bold' }}>{formatCurrency(sec80D)}</span>}
                            </div>
                            <input
                                type="number"
                                value={sec80D}
                                onChange={(e) => setSec80D(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                <label style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Annual Rent Paid (for HRA Exemption)</label>
                                {actualRentPaid > 0 && <span style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 'bold' }}>{formatCurrency(actualRentPaid)}</span>}
                            </div>
                            <input
                                type="number"
                                value={actualRentPaid}
                                onChange={(e) => setActualRentPaid(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>Calculated HRA Exemption</span>
                            <span style={{ color: '#34d399', fontWeight: 'bold' }}>{formatCurrency(hraExemption)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Regime Breakdown Table */}
            <div style={{
                backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '1.5rem', padding: '1.5rem'
            }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>Detailed Tax & Return Calculation Summary</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa' }}>
                                <th style={{ padding: '0.75rem 1rem' }}>Component</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Old Tax Regime</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>New Tax Regime</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'white' }}>
                                <td style={{ padding: '0.75rem 1rem' }}>Gross Salary Income</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{formatCurrency(grossIncome)}</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{formatCurrency(grossIncome)}</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#a1a1aa' }}>
                                <td style={{ padding: '0.75rem 1rem' }}>Standard Deduction</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#f87171' }}>- {formatCurrency(oldStdDeduction)}</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#f87171' }}>- {formatCurrency(newStdDeduction)}</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#a1a1aa' }}>
                                <td style={{ padding: '0.75rem 1rem' }}>HRA Exemption</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#f87171' }}>- {formatCurrency(hraExemption)}</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#71717a' }}>N/A</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#a1a1aa' }}>
                                <td style={{ padding: '0.75rem 1rem' }}>Chapter VI-A Deductions (80C, 80D, 80CCD)</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#f87171' }}>- {formatCurrency(capped80C + capped80D + cappedNps)}</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#71717a' }}>N/A</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                <td style={{ padding: '0.75rem 1rem' }}>Net Taxable Income</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#38bdf8' }}>{formatCurrency(oldTaxableIncome)}</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#38bdf8' }}>{formatCurrency(newTaxableIncome)}</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold', fontSize: '1rem', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '1rem' }}>Total Tax Liability (incl. 4% Cess)</td>
                                <td style={{ padding: '1rem', textAlign: 'right', color: oldTax > newTax ? '#f87171' : '#34d399' }}>{formatCurrency(oldTax)}</td>
                                <td style={{ padding: '1rem', textAlign: 'right', color: newTax > oldTax ? '#f87171' : '#34d399' }}>{formatCurrency(newTax)}</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#c084fc' }}>
                                <td style={{ padding: '0.75rem 1rem' }}>Form 16 TDS Paid</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{formatCurrency(tdsPaid)}</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{formatCurrency(tdsPaid)}</td>
                            </tr>
                            <tr style={{ color: 'white', fontWeight: 'bold', fontSize: '1.05rem', backgroundColor: 'rgba(56, 189, 248, 0.08)' }}>
                                <td style={{ padding: '1rem' }}>Net Estimated ITR Return / (Refund)</td>
                                <td style={{ padding: '1rem', textAlign: 'right', color: oldRefundOrPayable >= 0 ? '#34d399' : '#f87171' }}>
                                    {oldRefundOrPayable >= 0 ? `+ ${formatCurrency(oldRefundOrPayable)} Refund` : `- ${formatCurrency(Math.abs(oldRefundOrPayable))} Payable`}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', color: newRefundOrPayable >= 0 ? '#34d399' : '#f87171' }}>
                                    {newRefundOrPayable >= 0 ? `+ ${formatCurrency(newRefundOrPayable)} Refund` : `- ${formatCurrency(Math.abs(newRefundOrPayable))} Payable`}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TaxPlanningCalculator;
