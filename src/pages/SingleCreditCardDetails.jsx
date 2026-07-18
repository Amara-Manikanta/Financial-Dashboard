import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Plus, Calendar, Award, CheckCircle, XCircle, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatDate } from '../utils/dateUtils';
import CreditCardTransactionModal from '../components/CreditCardTransactionModal';
import CreditCardImportModal from '../components/CreditCardImportModal';
import { mergeTransactionsIntoExpenses } from '../utils/importUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label, formatCurrency }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#18181b] border border-white/10 p-3 rounded-xl shadow-xl">
                <p className="text-white font-bold mb-2">{label}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex justify-between items-center gap-4 text-sm mb-1">
                        <span style={{ color: entry.color }}>{entry.name}</span>
                        <span className="font-mono text-white">{formatCurrency(entry.value)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const SingleCreditCardDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { creditCards, expenses, updateItem, saveExpenses, formatCurrency, categories } = useFinance();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isBaselineModalOpen, setIsBaselineModalOpen] = useState(false);
    const [baselineMonth, setBaselineMonth] = useState('');
    const [baselineYear, setBaselineYear] = useState('');

    const [filterYear, setFilterYear] = useState('All');
    const [filterMonth, setFilterMonth] = useState('All');
    const [filterType, setFilterType] = useState('All');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Reset page when navigating to a different card
    useEffect(() => { setCurrentPage(1); }, [id]);

    const card = creditCards.find(c => c.id.toString() === id);

    // Sync local baseline state when card loads
    React.useEffect(() => {
        if (card?.carryForwardBaseline) {
            const [bm, by] = card.carryForwardBaseline.split('/');
            setBaselineMonth(bm || '');
            setBaselineYear(by || '');
        } else {
            setBaselineMonth('');
            setBaselineYear('');
        }
    }, [card?.id, card?.carryForwardBaseline]);

    if (!card) {
        return (
            <div className="p-8 text-center text-gray-500">
                <p>Credit Card not found.</p>
                <button onClick={() => navigate(-1)} className="text-purple-400 hover:underline mt-4">Go Back</button>
            </div>
        );
    }

    const monthlyData = card.monthlyData || [];
    const totalPoints = monthlyData.reduce((sum, m) => sum + (Number(m.points) || 0), 0);

    // Filter Linked Transactions from Expenses
    const linkedTransactions = [];
    if (expenses) {
        Object.entries(expenses).forEach(([year, months]) => {
            Object.entries(months).forEach(([month, data]) => {
                if (data.transactions) {
                    data.transactions.forEach(tx => {
                        // Match payment mode and credit card name loosely
                        if (tx.paymentMode === 'credit_card' && tx.creditCardName) {
                            const txName = tx.creditCardName.trim().toLowerCase();
                            const cardName = card.name.trim().toLowerCase();

                            // Check for exact match, or partial matches (e.g. "Scapia" matches "Scapia Card")
                            // Also check aliases for legacy data
                            const aliases = {
                                'coral rupay': ['icici rupay'],
                                'hpcl': ['icici hp card']
                            };

                            const knownAliases = aliases[cardName] || [];

                            if (
                                txName === cardName ||
                                cardName.includes(txName) ||
                                txName.includes(cardName) ||
                                knownAliases.includes(txName)
                            ) {
                                linkedTransactions.push({ ...tx, month, year });
                            }
                        }
                    });
                }
            });
        });
    }

    // Extract available filter options
    const yearsSet = new Set(linkedTransactions.map(t => t.year));
    const currentYear = new Date().getFullYear();
    for (let y = 2022; y <= currentYear + 1; y++) {
        yearsSet.add(y.toString());
    }
    const availableYears = [...yearsSet].sort((a, b) => b - a);

    const availableMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Filter Logic
    // Filter Logic
    const filteredTransactions = linkedTransactions.filter(tx => {
        if (filterYear !== 'All' && String(tx.year) !== String(filterYear)) return false;
        if (filterMonth !== 'All' && String(tx.month).trim().toLowerCase() !== String(filterMonth).trim().toLowerCase()) return false;
        if (filterType !== 'All') {
            const isCredit = !!tx.isCredited;
            if (filterType === 'credit' && !isCredit) return false;
            if (filterType === 'debit' && isCredit) return false;
        }
        return true;
    });

    // Compute baseline date for filtering
    const baselineDate = card?.carryForwardBaseline
        ? new Date(`${card.carryForwardBaseline.split('/')[0]} 1, ${card.carryForwardBaseline.split('/')[1]}`)
        : null;

    const parseLocalDate = (dateStr) => {
        const parts = dateStr ? dateStr.split('-').map(Number) : [];
        return parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(dateStr);
    };

    const baselinedTransactions = baselineDate
        ? linkedTransactions.filter(t => parseLocalDate(t.date) >= baselineDate)
        : linkedTransactions;

    const totalOutstanding = baselinedTransactions.reduce((sum, t) => {
        if (t.category === 'credit card bill' || t.category === 'credit card payment') {
            return sum - Number(t.amount);
        }
        return sum + (t.isCredited ? -Number(t.amount) : Number(t.amount));
    }, 0);

    const filteredNetSpend = filteredTransactions.reduce((sum, t) => {
        if (t.category === 'credit card bill' || t.category === 'credit card payment') {
            return sum - Number(t.amount);
        }
        return sum + (t.isCredited ? -Number(t.amount) : Number(t.amount));
    }, 0);

    const handleSaveBaseline = async () => {
        if (!baselineMonth || !baselineYear) {
            // Clear baseline
            const updatedCard = { ...card, carryForwardBaseline: null };
            await updateItem('creditCards', updatedCard);
        } else {
            const updatedCard = { ...card, carryForwardBaseline: `${baselineMonth}/${baselineYear}` };
            await updateItem('creditCards', updatedCard);
        }
        setIsBaselineModalOpen(false);
    };

    // Compute chart data using ALL linked transactions to show a complete trend, not just the filtered ones
    const monthlyAggregates = {};
    linkedTransactions.forEach(tx => {
        const d = new Date(tx.date);
        const month = d.toLocaleString('default', { month: 'long' });
        const year = d.getFullYear();
        const key = `${month} ${year}`;
        
        if (!monthlyAggregates[key]) {
            monthlyAggregates[key] = { month, year, debit: 0, credit: 0, net: 0 };
        }
        
        const amt = Number(tx.amount) || 0;
        const cat = (tx.category || '').toLowerCase();
        if (tx.isCredited) {
            monthlyAggregates[key].credit += amt;
            monthlyAggregates[key].net -= amt;
        } else {
            if (cat === 'credit card bill' || cat === 'credit card payment') {
                monthlyAggregates[key].credit += amt;
                monthlyAggregates[key].net -= amt;
            } else {
                monthlyAggregates[key].debit += amt;
                monthlyAggregates[key].net += amt;
            }
        }
    });

    const sortedAggregates = Object.values(monthlyAggregates).sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return months.indexOf(b.month) - months.indexOf(a.month);
    });

    const chartData = [...sortedAggregates].reverse().map(agg => ({
        ...agg,
        name: `${agg.month.substring(0, 3)} '${String(agg.year).substring(2)}`
    }));

    const sortedFilteredTransactions = [...filteredTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalPages = Math.max(1, Math.ceil(sortedFilteredTransactions.length / itemsPerPage));
    const paginatedTransactions = sortedFilteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


    const handleSaveTransaction = async (transaction) => {
        let updatedMonthlyData;
        if (editingTx) {
            updatedMonthlyData = monthlyData.map(m => m.id === transaction.id ? transaction : m);
        } else {
            updatedMonthlyData = [...monthlyData, transaction];
        }

        const updatedCard = { ...card, monthlyData: updatedMonthlyData };
        await updateItem('creditCards', updatedCard);
        setEditingTx(null);
        setIsModalOpen(false);
    };

    const handleSaveImport = async (parsedTransactions) => {
        const { updatedExpenses, addedCount } = mergeTransactionsIntoExpenses(expenses || {}, parsedTransactions);
        await saveExpenses(updatedExpenses);
        alert(`Successfully imported ${addedCount} new transactions!`);
    };

    const handleDeleteTransaction = async (txId) => {
        if (window.confirm('Delete this monthly record?')) {
            const updatedMonthlyData = monthlyData.filter(m => m.id !== txId);
            const updatedCard = { ...card, monthlyData: updatedMonthlyData };
            await updateItem('creditCards', updatedCard);
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            <button
                onClick={() => navigate(-1)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#71717a',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    padding: 0
                }}
            >
                ← Back to Cards
            </button>

            {/* Header Card */}
            <div style={{
                backgroundColor: 'rgba(24, 24, 27, 0.4)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(192, 132, 252, 0.1)',
                borderRadius: '2rem',
                padding: '2rem',
                boxShadow: '0 10px 25px -5px rgba(192, 132, 252, 0.05)',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '2rem'
            }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: '0 0 0.5rem 0' }}>{card.name}</h2>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', margin: 0 }}>
                        {card.bankName} • Ending in <span style={{ fontFamily: 'monospace', color: 'white', fontWeight: 'bold' }}>{card.last4Digits}</span>
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '1rem 1.5rem',
                        borderRadius: '1rem',
                        minWidth: '160px'
                    }}>
                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Outstanding</span>
                        <p style={{ fontSize: '1.5rem', fontWeight: '950', color: totalOutstanding > 0 ? '#f87171' : '#34d399', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>
                            {formatCurrency(Math.max(0, totalOutstanding))}
                        </p>
                        {baselineDate && (
                            <p style={{ fontSize: '9px', color: '#f59e0b', margin: '0.25rem 0 0 0' }}>
                                From {card.carryForwardBaseline.split('/')[0]} {card.carryForwardBaseline.split('/')[1]}
                            </p>
                        )}
                    </div>
                    <div style={{
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '1rem 1.5rem',
                        borderRadius: '1rem',
                        minWidth: '160px'
                    }}>
                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Points</span>
                        <p style={{ fontSize: '1.5rem', fontWeight: '950', color: '#fbbf24', fontFamily: 'monospace', margin: '0.25rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <Award size={18} /> {totalPoints.toLocaleString()}
                        </p>
                    </div>
                    <div>
                        <button
                            onClick={() => setIsBaselineModalOpen(true)}
                            style={{
                                padding: '0.75rem 1.25rem',
                                borderRadius: '0.75rem',
                                backgroundColor: baselineDate ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.03)',
                                border: baselineDate ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                                color: baselineDate ? '#fcd34d' : '#71717a',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Calendar size={14} />
                            {baselineDate ? `Baseline: ${card.carryForwardBaseline.split('/')[0].substring(0,3)} ${card.carryForwardBaseline.split('/')[1]}` : 'Set Baseline'}
                        </button>
                        {baselineDate && (
                            <p style={{ fontSize: '9px', color: '#6b7280', marginTop: '0.375rem', textAlign: 'center' }}>Carry forward from this month</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Baseline Modal */}
            {isBaselineModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ backgroundColor: '#18181b', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '1.5rem', padding: '2rem', maxWidth: '480px', width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: '0 0 0.5rem 0' }}>Set Carry Forward Baseline</h3>
                        <p style={{ fontSize: '0.875rem', color: '#71717a', margin: '0 0 1.5rem 0', lineHeight: '1.6' }}>
                            Choose the month from which carry forward tracking begins. All transactions <strong style={{ color: 'white' }}>before</strong> this month will be ignored — assuming the card was fully paid off by then.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <label style={{ fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Month</label>
                                <select
                                    value={baselineMonth}
                                    onChange={e => setBaselineMonth(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: 'white', fontSize: '0.875rem', outline: 'none' }}
                                >
                                    <option value="">Select Month</option>
                                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => (
                                        <option key={m} value={m} style={{ backgroundColor: '#18181b' }}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Year</label>
                                <select
                                    value={baselineYear}
                                    onChange={e => setBaselineYear(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: 'white', fontSize: '0.875rem', outline: 'none' }}
                                >
                                    <option value="">Select Year</option>
                                    {Array.from({ length: 8 }, (_, i) => 2020 + i).map(y => (
                                        <option key={y} value={y} style={{ backgroundColor: '#18181b' }}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {baselineMonth && baselineYear && (
                            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '0.75rem', padding: '0.875rem 1rem', marginBottom: '1.5rem' }}>
                                <p style={{ fontSize: '0.8rem', color: '#fcd34d', margin: 0, lineHeight: '1.5' }}>
                                    ✓ Carry forward will only include transactions from <strong>{baselineMonth} {baselineYear}</strong> onwards.
                                    Any gap before this date will be treated as ₹0 outstanding.
                                </p>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            {card?.carryForwardBaseline && (
                                <button
                                    onClick={async () => { setBaselineMonth(''); setBaselineYear(''); await updateItem('creditCards', { ...card, carryForwardBaseline: null }); setIsBaselineModalOpen(false); }}
                                    style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239,68,68,0.05)', color: '#f87171', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}
                                >
                                    Clear Baseline
                                </button>
                            )}
                            <button
                                onClick={() => setIsBaselineModalOpen(false)}
                                style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: '#a1a1aa', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveBaseline}
                                disabled={!baselineMonth || !baselineYear}
                                style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', border: 'none', backgroundColor: '#f59e0b', color: 'black', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', opacity: (!baselineMonth || !baselineYear) ? 0.5 : 1 }}
                            >
                                Save Baseline
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions & List */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>Monthly History</h3>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                            color: '#818cf8',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                        }}
                    >
                        <Upload size={14} /> Import Statement
                    </button>
                    <button
                        onClick={() => { setEditingTx(null); setIsModalOpen(true); }}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.75rem',
                            backgroundColor: '#c084fc',
                            color: 'black',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            cursor: 'pointer',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                        }}
                    >
                        <Plus size={14} /> Add Entry
                    </button>
                </div>
            </div>

            {/* Monthly History Table */}
            <div style={{
                backgroundColor: 'rgba(24, 24, 27, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '2rem',
                overflow: 'hidden',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
            }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Month / Year</th>
                                <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bill Amount</th>
                                <th style={{ textAlign: 'center', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Points</th>
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remarks</th>
                                <th style={{ textAlign: 'center', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody style={{ divideY: '1px solid rgba(255,255,255,0.05)' }}>
                            {[...monthlyData]
                                .sort((a, b) => {
                                    if (b.year !== a.year) return b.year - a.year;
                                    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                                    return months.indexOf(b.month) - months.indexOf(a.month);
                                })
                                .map((item) => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '1rem 1.5rem', color: 'white', fontWeight: 'bold', fontSize: '0.875rem' }}>
                                            {item.month} {item.year}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right', color: 'white', fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 'bold' }}>
                                            {item.billAmount > 0 ? formatCurrency(item.billAmount) : '—'}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                                            {item.billAmount > 0 ? (
                                                item.isPaid ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399', fontSize: '10px', fontWeight: 'bold' }}>
                                                        <CheckCircle size={10} /> Paid
                                                    </span>
                                                ) : (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', fontSize: '10px', fontWeight: 'bold' }}>
                                                        <XCircle size={10} /> Unpaid
                                                    </span>
                                                )
                                            ) : (
                                                <span style={{ color: '#71717a', fontSize: '0.875rem' }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right', color: '#fbbf24', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.875rem' }}>
                                            {item.points > 0 ? `+${item.points.toLocaleString()}` : '—'}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', color: '#a1a1aa', fontSize: '0.875rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.remarks || '—'}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => { setEditingTx(item); setIsModalOpen(true); }}
                                                    style={{ padding: '0.25rem', borderRadius: '0.375rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: '#71717a', cursor: 'pointer' }}
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTransaction(item.id)}
                                                    style={{ padding: '0.25rem', borderRadius: '0.375rem', border: 'none', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {!monthlyData.length && (
                                <tr>
                                    <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: '#71717a', fontSize: '0.875rem' }}>
                                        No monthly records found. Add one to start tracking.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Linked Expenses Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>Recent Transactions (Expenses)</h3>
                        <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.25rem' }}>
                            Net Bill Amount (Selected Period): <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: filteredNetSpend > 0 ? 'white' : '#34d399' }}>{formatCurrency(filteredNetSpend)}</span>
                        </p>
                    </div>

                    <div style={{
                        display: 'flex',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '1rem',
                        padding: '2px',
                        gap: '2px'
                    }}>
                        <select
                            value={filterYear}
                            onChange={(e) => { setFilterYear(e.target.value); setCurrentPage(1); }}
                            style={{ backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '11px', fontWeight: 'bold', padding: '0.5rem', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="All" style={{ backgroundColor: '#18181b' }}>All Years</option>
                            {availableYears.map(year => (
                                <option key={year} value={year} style={{ backgroundColor: '#18181b' }}>{year}</option>
                            ))}
                        </select>
                        <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
                        <select
                            value={filterMonth}
                            onChange={(e) => { setFilterMonth(e.target.value); setCurrentPage(1); }}
                            style={{ backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '11px', fontWeight: 'bold', padding: '0.5rem', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="All" style={{ backgroundColor: '#18181b' }}>All Months</option>
                            {availableMonths.map(month => (
                                <option key={month} value={month} style={{ backgroundColor: '#18181b' }}>{month}</option>
                            ))}
                        </select>
                        <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
                        <select
                            value={filterType}
                            onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
                            style={{ backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '11px', fontWeight: 'bold', padding: '0.5rem', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="All" style={{ backgroundColor: '#18181b' }}>All Types</option>
                            <option value="debit" style={{ backgroundColor: '#18181b' }}>Debit</option>
                            <option value="credit" style={{ backgroundColor: '#18181b' }}>Credit</option>
                        </select>
                    </div>
                </div>

                {/* Monthly Aggregates Summary */}
                {chartData.length > 0 && (
                    <div style={{
                        backgroundColor: 'rgba(24, 24, 27, 0.4)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '2rem',
                        padding: '1.5rem',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                    }}>
                        <h4 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={16} style={{ color: '#818cf8' }} /> Monthly Expenditure Overview
                        </h4>
                        <div style={{ height: 300, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`} />
                                    <RechartsTooltip content={<CustomTooltip formatCurrency={formatCurrency} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
                                    <Bar dataKey="debit" name="Debit" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="credit" name="Credit" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Transactions Table */}
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '2rem',
                    overflow: 'hidden',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                                    <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
                                    <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                                    <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                                    <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedTransactions.map((tx) => {
                                    const isCCBill = (tx.category || '').toLowerCase() === 'credit card bill' || (tx.category || '').toLowerCase() === 'credit card payment';
                                    const isEffectivelyCredit = tx.isCredited || isCCBill;
                                    
                                    return (
                                        <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '1rem 1.5rem', color: '#71717a', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                                                {formatDate(tx.date)}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', color: 'white', fontWeight: 'bold', fontSize: '0.875rem' }}>
                                                {tx.title}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <span style={{ display: 'inline-flex', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: isEffectivelyCredit ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: isEffectivelyCredit ? '#34d399' : '#f87171', border: isEffectivelyCredit ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                    {isEffectivelyCredit ? 'Credit' : 'Debit'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <span style={{ display: 'inline-flex', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.03)', color: '#a1a1aa' }}>
                                                    {tx.category}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.875rem', color: isEffectivelyCredit ? '#34d399' : 'white' }}>
                                                {isEffectivelyCredit ? '+' : ''}{formatCurrency(tx.amount)}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredTransactions.length === 0 && (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: '#71717a', fontSize: '0.875rem' }}>
                                            No linked expense transactions found matching filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination controls */}
                    {filteredTransactions.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '11px', color: '#71717a' }}>Rows per page:</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '0.5rem', padding: '0.25rem', outline: 'none' }}
                                >
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontSize: '11px', color: '#71717a' }}>
                                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
                                </span>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '0.375rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}><ChevronLeft size={16} /></button>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '0.375rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer', opacity: currentPage === totalPages ? 0.3 : 1 }}><ChevronRight size={16} /></button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <CreditCardTransactionModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingTx(null); }}
                onSave={handleSaveTransaction}
                initialData={editingTx}
            />

            <CreditCardImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSave={handleSaveImport}
                existingTransactions={linkedTransactions}
                cardName={card.name}
            />
        </div>
    );
};

export default SingleCreditCardDetails;
