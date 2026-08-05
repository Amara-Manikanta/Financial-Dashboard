import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Calculator, Sparkles, Check, AlertCircle, ArrowRight, HelpCircle, FileText } from 'lucide-react';

const TaxPlanning = () => {
    const { salaryDetails, savings, formatCurrency } = useFinance();

    // Income fields
    const [basicSalary, setBasicSalary] = useState(600000);
    const [hra, setHra] = useState(250000);
    const [otherAllowances, setOtherAllowances] = useState(350000);
    const [bonus, setBonus] = useState(100000);

    // Deductions fields (Old Regime)
    const [sec80C, setSec80C] = useState(150000);
    const [sec80D, setSec80D] = useState(25000);
    const [nps80CCD, setNps80CCD] = useState(50000);
    const [homeLoanInterest, setHomeLoanInterest] = useState(0);
    
    // HRA Exemption inputs
    const [actualRentPaid, setActualRentPaid] = useState(180000); // 15k/mo
    const [isMetroCity, setIsMetroCity] = useState(true);

    // Auto-populate from salaryDetails & savings
    useEffect(() => {
        const annualRecord = (salaryDetails || []).find(s => s.type === 'annual');
        if (annualRecord) {
            setBasicSalary(Number(annualRecord.basicSalary) || 600000);
            setHra(Number(annualRecord.hra) || 250000);
            const flexi = (Number(annualRecord.conveyanceAllowance) || 0) + (Number(annualRecord.flexibleAllowance) || 0);
            setOtherAllowances(flexi || 350000);
            setBonus(Number(annualRecord.performanceBonus) || 100000);
        }

        // Auto-sum 80C from PF + PPF + Policies
        let auto80C = 0;
        if (annualRecord?.pf) auto80C += Number(annualRecord.pf);

        (savings || []).forEach(item => {
            if (item.type === 'ppf' || item.type === 'Policy') {
                auto80C += Number(item.amount || 0);
            }
        });
        if (auto80C > 0) setSec80C(Math.min(150000, auto80C));
    }, [salaryDetails, savings]);

    const grossIncome = Number(basicSalary) + Number(hra) + Number(otherAllowances) + Number(bonus);

    // HRA Exemption Calculation
    // Min of: 1) Actual HRA received, 2) Rent Paid - 10% of Basic, 3) 50% Basic (Metro) or 40% Basic (Non-Metro)
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
            tax = (taxable - 250000) * 0.05;
            // 87A rebate for taxable <= 5L
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
    // Slabs: 0-4L (0%), 4-8L (5%), 8-12L (10%), 12-16L (15%), 16-20L (20%), 20-24L (25%), 24L+ (30%)
    const newStdDeduction = 75000;
    const newTaxableIncome = Math.max(0, grossIncome - newStdDeduction);

    const calculateNewTax = (taxable) => {
        if (taxable <= 400000) return 0;
        // 87A rebate for taxable <= 12L (rely on Budget slab rebate)
        if (taxable <= 1200000) return 0; // Full rebate under updated new regime

        let tax = 0;
        tax += 400000 * 0.05; // 4L-8L = 20,000
        tax += 400000 * 0.10; // 8L-12L = 40,000

        if (taxable <= 1600000) {
            tax += (taxable - 1200000) * 0.15;
        } else {
            tax += 400000 * 0.15; // 12L-16L = 60,000
            if (taxable <= 2000000) {
                tax += (taxable - 1600000) * 0.20;
            } else {
                tax += 400000 * 0.20; // 16L-20L = 80,000
                if (taxable <= 2400000) {
                    tax += (taxable - 2000000) * 0.25;
                } else {
                    tax += 400000 * 0.25; // 20L-24L = 1,00,000
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

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Calculator style={{ color: '#c084fc' }} size={32} />
                    Tax Planning & Regime Comparison
                </h1>
                <p style={{ color: '#a1a1aa', marginTop: '0.5rem' }}>Compare tax liabilities under Old vs New Tax Regimes (FY 2026-27)</p>
            </div>

            {/* Recommendation Winner Banner */}
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
                            {isNewRegimeBetter ? 'New Tax Regime is Better' : 'Old Tax Regime is Better'}
                        </h3>
                        <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                            You save <strong style={{ color: '#34d399' }}>{formatCurrency(taxDifference)}</strong> per year by opting for the {isNewRegimeBetter ? 'New Regime' : 'Old Regime'}.
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'right' }}>
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
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.3rem' }}>Basic Salary (₹)</label>
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
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.3rem' }}>HRA Allowance Received (₹)</label>
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
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.3rem' }}>Special / Flexible Allowances (₹)</label>
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
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.3rem' }}>Performance Bonus (₹)</label>
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

                {/* Deductions Inputs Card (Old Regime) */}
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '1.5rem', padding: '1.5rem', backdropFilter: 'blur(10px)'
                }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#c084fc', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: '0.5rem' }}>
                        Old Regime Deductions
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.3rem' }}>Sec 80C (PF, PPF, ELSS, Policy) - Max 1.5L</label>
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
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.3rem' }}>Sec 80D Health Insurance (Max 25k/50k)</label>
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
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.3rem' }}>Sec 80CCD(1B) NPS Voluntary (Max 50k)</label>
                            <input
                                type="number"
                                value={nps80CCD}
                                onChange={(e) => setNps80CCD(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.3rem' }}>Annual Rent Paid (for HRA Exemption)</label>
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
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>Detailed Calculation Summary</h3>
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
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TaxPlanning;
