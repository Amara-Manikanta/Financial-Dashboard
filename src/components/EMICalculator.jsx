import React, { useState } from 'react';
import { Calculator, Percent, Calendar, DollarSign, ArrowRight } from 'lucide-react';

const EMICalculator = () => {
    const [principal, setPrincipal] = useState(3000000);
    const [rate, setRate] = useState(8.5);
    const [tenureYears, setTenureYears] = useState(20);

    const p = Number(principal) || 0;
    const r = (Number(rate) || 0) / 12 / 100;
    const n = (Number(tenureYears) || 0) * 12;

    let emi = 0;
    if (p > 0 && r > 0 && n > 0) {
        emi = Math.round((p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
    } else if (p > 0 && n > 0 && r === 0) {
        emi = Math.round(p / n);
    }

    const totalPayment = emi * n;
    const totalInterest = Math.max(0, totalPayment - p);
    const interestPercentage = totalPayment > 0 ? Math.round((totalInterest / totalPayment) * 100) : 0;

    // Generate sample Amortization Schedule (First 12 months)
    const generateAmortization = () => {
        let balance = p;
        const schedule = [];
        for (let i = 1; i <= Math.min(n, 24); i++) {
            const interestComp = Math.round(balance * r);
            const principalComp = Math.min(balance, emi - interestComp);
            balance = Math.max(0, balance - principalComp);
            schedule.push({
                month: i,
                emi,
                principalComp,
                interestComp,
                balance
            });
        }
        return schedule;
    };

    const schedule = generateAmortization();

    return (
        <div style={{
            backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '1.5rem', padding: '1.5rem', backdropFilter: 'blur(10px)'
        }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calculator style={{ color: '#60a5fa' }} size={22} /> EMI Calculator & Amortization
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
                {/* Inputs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>
                            <span>Loan Amount (Principal)</span>
                            <span style={{ color: 'white', fontWeight: 'bold' }}>₹{p.toLocaleString('en-IN')}</span>
                        </div>
                        <input
                            type="range"
                            min="50000"
                            max="20000000"
                            step="50000"
                            value={principal}
                            onChange={(e) => setPrincipal(e.target.value)}
                            style={{ width: '100%', accentColor: '#60a5fa' }}
                        />
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>
                            <span>Interest Rate (% p.a.)</span>
                            <span style={{ color: 'white', fontWeight: 'bold' }}>{rate}%</span>
                        </div>
                        <input
                            type="range"
                            min="5"
                            max="20"
                            step="0.1"
                            value={rate}
                            onChange={(e) => setRate(e.target.value)}
                            style={{ width: '100%', accentColor: '#60a5fa' }}
                        />
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>
                            <span>Tenure (Years)</span>
                            <span style={{ color: 'white', fontWeight: 'bold' }}>{tenureYears} Years ({n} Mo)</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="30"
                            step="1"
                            value={tenureYears}
                            onChange={(e) => setTenureYears(e.target.value)}
                            style={{ width: '100%', accentColor: '#60a5fa' }}
                        />
                    </div>
                </div>

                {/* Calculation Outputs */}
                <div style={{
                    backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '1.25rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center'
                }}>
                    <span style={{ fontSize: '0.8rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly EMI</span>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: '#60a5fa', margin: '0.25rem 0 1rem 0' }}>
                        ₹{emi.toLocaleString('en-IN')}
                    </h2>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                        <div>
                            <span style={{ fontSize: '0.75rem', color: '#71717a', display: 'block' }}>Total Interest Payable</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f87171' }}>₹{totalInterest.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                            <span style={{ fontSize: '0.75rem', color: '#71717a', display: 'block' }}>Total Amount Payable</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>₹{totalPayment.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Amortization Table Preview */}
            <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', marginBottom: '0.75rem' }}>Amortization Preview (First 2 Years)</h4>
                <div style={{ overflowX: 'auto', maxHeight: '250px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#a1a1aa' }}>
                                <th style={{ padding: '0.5rem' }}>Month</th>
                                <th style={{ padding: '0.5rem' }}>EMI</th>
                                <th style={{ padding: '0.5rem' }}>Principal</th>
                                <th style={{ padding: '0.5rem' }}>Interest</th>
                                <th style={{ padding: '0.5rem' }}>Remaining Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schedule.map(row => (
                                <tr key={row.month} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#d4d4d8' }}>
                                    <td style={{ padding: '0.5rem' }}>M{row.month}</td>
                                    <td style={{ padding: '0.5rem' }}>₹{row.emi.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '0.5rem', color: '#34d399' }}>₹{row.principalComp.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '0.5rem', color: '#f87171' }}>₹{row.interestComp.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '0.5rem' }}>₹{row.balance.toLocaleString('en-IN')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default EMICalculator;
