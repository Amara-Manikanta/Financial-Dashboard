import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, PiggyBank, Plus, Edit2, Trash2, TrendingUp } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import PPFTransactionModal from '../components/PPFTransactionModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

const PPFDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();
    const [selectedYear, setSelectedYear] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);
    const [showFYSelector, setShowFYSelector] = useState(false);

    const ppf = useMemo(() => savings.find(s => s.id === id), [savings, id]);

    const getFinancialYear = (dateStr) => {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 1-indexed
        return month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
    };

    const calculateYearlyInterest = (fy) => {
        if (!ppf) return 0;
        const [startYear] = fy.split('-').map(Number);
        const startDate = new Date(`${startYear}-04-01`);
        const rate = 0.071; // Standard PPF Rate

        const monthlyInterests = [];

        for (let m = 0; m < 12; m++) {
            const currentMonth = (3 + m) % 12; // April is 3
            const currentYear = startYear + (m >= 9 ? 1 : 0);
            const cutoffDate = new Date(currentYear, currentMonth, 5);

            const txsUpTo5th = ppf.details.filter(d => new Date(d.date) <= cutoffDate);
            const balanceOn5th = txsUpTo5th.reduce((sum, d) => sum + (d.amount || 0) + (d.interestEarned || 0), 0);

            monthlyInterests.push(Math.floor(balanceOn5th * rate / 12));
        }

        return monthlyInterests.reduce((a, b) => a + b, 0);
    };

    const recalculateBalances = (details) => {
        const sorted = [...details].sort((a, b) => new Date(a.date) - new Date(b.date));
        let runningBalance = 0;
        return sorted.map(item => {
            runningBalance += (item.amount || 0) + (item.interestEarned || 0);
            return { ...item, balance: runningBalance };
        });
    };

    const handleSaveTx = (txData) => {
        if (!ppf) return;
        let updatedDetails = [...ppf.details];
        if (editingIndex !== null) {
            updatedDetails[editingIndex] = txData;
        } else {
            updatedDetails.push(txData);
        }

        const detailsWithBalances = recalculateBalances(updatedDetails);
        const finalBalance = detailsWithBalances.length > 0 ? detailsWithBalances[detailsWithBalances.length - 1].balance : 0;

        updateItem('savings', { ...ppf, details: detailsWithBalances, amount: finalBalance });
        setIsModalOpen(false);
        setEditingTx(null);
        setEditingIndex(null);
    };

    const handleAddInterest = (fy) => {
        if (!ppf) return;
        const amount = calculateYearlyInterest(fy);
        const [startYear] = fy.split('-').map(Number);
        const date = `${startYear + 1}-03-31`;
        const existingIndex = ppf.details.findIndex(d => d.type === 'interest' && d.date === date);
        const txData = {
            id: existingIndex !== -1 ? ppf.details[existingIndex].id : Date.now(),
            date,
            type: 'interest',
            amount: 0,
            interestEarned: amount
        };
        if (existingIndex !== -1) {
            setEditingIndex(existingIndex);
            handleSaveTx(txData);
        } else {
            setEditingIndex(null);
            handleSaveTx(txData);
        }
    };

    const handleDeleteTx = (originalIndex) => {
        if (!ppf) return;
        if (window.confirm('Delete this transaction?')) {
            const updatedDetails = ppf.details.filter((_, i) => i !== originalIndex);
            const detailsWithBalances = recalculateBalances(updatedDetails);
            const finalBalance = detailsWithBalances.length > 0 ? detailsWithBalances[detailsWithBalances.length - 1].balance : 0;
            updateItem('savings', { ...ppf, details: detailsWithBalances, amount: finalBalance });
        }
    };

    const possibleFYs = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const fys = [];
        for (let i = -5; i <= 1; i++) {
            const y = currentYear + i;
            fys.push(`${y}-${(y + 1).toString().slice(-2)}`);
        }
        return fys;
    }, []);

    // Memoize stats and filtered/paginated details
    const ppfDetails = useMemo(() => ppf?.details || [], [ppf]);

    const years = useMemo(() => {
        return ['All', ...new Set(ppfDetails.map(item => getFinancialYear(item.date)))].sort((a, b) => b.localeCompare(a));
    }, [ppfDetails]);

    const filteredDetails = useMemo(() => {
        const sorted = [...ppfDetails].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (selectedYear === 'All') return sorted;
        return ppfDetails.filter(item => getFinancialYear(item.date) === selectedYear).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [ppfDetails, selectedYear]);

    const itemsPerPage = 6;
    const totalPages = useMemo(() => Math.ceil(filteredDetails.length / itemsPerPage), [filteredDetails]);

    const paginatedDetails = useMemo(() => {
        return filteredDetails.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [filteredDetails, currentPage]);

    const totalInterest = useMemo(() => {
        return ppfDetails.reduce((sum, item) => sum + (item.interestEarned || 0), 0);
    }, [ppfDetails]);

    const totalBalance = useMemo(() => {
        if (ppfDetails.length === 0) return 0;
        const balList = recalculateBalances(ppfDetails);
        return balList[balList.length - 1].balance;
    }, [ppfDetails]);

    const yearlyInterest = useMemo(() => {
        return ppfDetails.reduce((acc, item) => {
            const fy = getFinancialYear(item.date);
            acc[fy] = (acc[fy] || 0) + (item.interestEarned || 0);
            return acc;
        }, {});
    }, [ppfDetails]);

    const ppfInterestChartData = useMemo(() => {
        return Object.entries(yearlyInterest)
            .map(([year, amount]) => ({ year, amount: Math.round(amount) }))
            .sort((a, b) => a.year.localeCompare(b.year));
    }, [yearlyInterest]);

    if (!ppf) return <div style={{ padding: 'var(--spacing-lg)', color: 'white' }}>PPF account not found.</div>;

    // Premium styling constants
    const styles = {
        breadcrumb: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#a1a1aa',
            fontSize: '0.825rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'color 0.2s',
            background: 'none',
            border: 'none',
            padding: 0,
            marginBottom: '1.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
        },
        headerPanel: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '2.5rem'
        },
        titleContainer: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
        },
        titleIcon: {
            padding: '0.75rem',
            borderRadius: '1rem',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            color: '#60a5fa',
            display: 'flex',
            alignItems: 'center',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            boxShadow: '0 0 15px rgba(59, 130, 246, 0.1)'
        },
        titleText: {
            fontSize: '2rem',
            fontWeight: '900',
            color: 'white',
            margin: 0,
            letterSpacing: '-0.02em'
        },
        subtitle: {
            color: '#a1a1aa',
            fontSize: '0.875rem',
            fontWeight: '500',
            marginTop: '0.25rem',
            margin: 0
        },
        actionButton: (bg = '#3b82f6', shadowColor = 'rgba(59, 130, 246, 0.3)') => ({
            padding: '0.75rem 1.5rem',
            borderRadius: '1rem',
            backgroundColor: bg,
            color: 'white',
            fontWeight: '900',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            transition: 'background-color 0.2s, transform 0.2s, box-shadow 0.2s',
            border: 'none',
            boxShadow: `0 10px 20px -3px ${shadowColor}`
        }),
        statGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2.5rem'
        },
        glassCard: (gradientColor = 'rgba(255, 255, 255, 0.02)', borderColor = 'rgba(255, 255, 255, 0.06)', shadowColor = 'rgba(0, 0, 0, 0.25)') => ({
            background: `linear-gradient(135deg, ${gradientColor} 0%, rgba(255, 255, 255, 0.005) 100%)`,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '1.25rem',
            padding: '1.5rem',
            border: `1px solid ${borderColor}`,
            boxShadow: `0 8px 32px 0 ${shadowColor}`,
            transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.3s'
        }),
        sectionHeader: {
            fontSize: '0.875rem',
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#71717a',
            marginBottom: '1rem',
            paddingLeft: '0.25rem'
        },
        yearCard: {
            position: 'relative',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
            backdropFilter: 'blur(12px)',
            borderRadius: '1rem',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '1rem',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
        },
        recalcBtn: {
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            padding: '0.25rem',
            borderRadius: '0.375rem',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#34d399',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'background-color 0.2s, color 0.2s'
        },
        filterBar: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            paddingBottom: '1rem',
            overflowX: 'auto'
        },
        filterTab: (isActive) => ({
            padding: '0.625rem 1.25rem',
            borderRadius: '0.75rem',
            fontSize: '0.75rem',
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            cursor: 'pointer',
            transition: 'all 0.3s',
            border: 'none',
            backgroundColor: isActive ? '#2563eb' : 'rgba(255, 255, 255, 0.03)',
            color: isActive ? 'white' : '#71717a',
            boxShadow: isActive ? '0 10px 15px -3px rgba(37, 99, 235, 0.3)' : 'none'
        }),
        tableContainer: {
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '1.25rem',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse'
        },
        th: (align = 'left') => ({
            padding: '1.125rem 1.5rem',
            textAlign: align,
            color: 'rgba(255, 255, 255, 0.6)',
            fontWeight: '900',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)'
        }),
        td: (align = 'left', isBold = false, color = 'var(--text-primary)', size = '13px') => ({
            padding: '1.125rem 1.5rem',
            textAlign: align,
            color: color,
            fontWeight: isBold ? '900' : '500',
            fontSize: size,
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }),
        actionBtn: (bg, hoverBg, color) => ({
            padding: '0.5rem',
            borderRadius: '0.5rem',
            backgroundColor: bg,
            color: color,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'background-color 0.2s, transform 0.1s'
        })
    };

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-200 hover:text-white transition-all duration-300 mb-8 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 hover:bg-white/20 hover:border-white/30 backdrop-blur-md shadow-lg"
                style={{ cursor: 'pointer' }}
            >
                <ArrowLeft size={16} className="text-white" /> Back to Savings
            </button>

            <div style={styles.headerPanel}>
                <div>
                    <div style={styles.titleContainer}>
                        <div style={styles.titleIcon}>
                            <PiggyBank size={24} />
                        </div>
                        <h2 style={styles.titleText}>{ppf.name}</h2>
                    </div>
                    <p style={styles.subtitle}>Account: {ppf.accountNo} | Bank: {ppf.bank}</p>
                </div>
                <button
                    onClick={() => { setEditingTx(null); setEditingIndex(null); setIsModalOpen(true); }}
                    style={styles.actionButton()}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#2563eb';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 10px 20px -3px rgba(37, 99, 235, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#3b82f6';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 10px 20px -3px rgba(59, 130, 246, 0.3)';
                    }}
                >
                    <Plus size={16} />
                    Add Transaction
                </button>
            </div>

            <div style={styles.statGrid}>
                {/* Balance Card */}
                <div 
                    style={styles.glassCard('rgba(59, 130, 246, 0.05)', 'rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.1)')}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.15)';
                    }}
                >
                    <p style={{ fontSize: '10px', color: '#60a5fa', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', margin: 0 }}>Portfolio Balance</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', margin: 0, fontFamily: 'monospace' }}>{formatCurrency(totalBalance)}</p>
                </div>
                {/* Interest Card */}
                <div 
                    style={styles.glassCard('rgba(16, 185, 129, 0.05)', 'rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.1)')}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.15)';
                    }}
                >
                    <p style={{ fontSize: '10px', color: '#34d399', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', margin: 0 }}>Accumulated Interest</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: '900', color: '#34d399', margin: 0, fontFamily: 'monospace' }}>{formatCurrency(totalInterest)}</p>
                </div>
            </div>

            {/* Yearly Interest Summary Section */}
            {ppfInterestChartData.length > 0 && (
                <div style={{
                    marginBottom: '2.5rem',
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderRadius: '1.25rem',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    padding: '1.5rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={22} style={{ color: '#34d399' }} />
                            <h3 style={{ ...styles.sectionHeader, margin: 0 }}>Yearly PPF Interest Earned</h3>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{
                                fontSize: '11px',
                                fontWeight: '800',
                                color: '#34d399',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                padding: '0.25rem 0.75rem',
                                borderRadius: '9999px',
                                border: '1px solid rgba(16, 185, 129, 0.2)'
                            }}>
                                Total Interest: {formatCurrency(totalInterest)}
                            </span>

                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowFYSelector(!showFYSelector)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        padding: '0.375rem 0.75rem',
                                        borderRadius: '0.5rem',
                                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                        color: '#34d399',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        fontWeight: '800',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.25)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)'}
                                >
                                    <Plus size={14} /> Add Interest
                                </button>
                                {showFYSelector && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '105%',
                                        right: 0,
                                        width: '12rem',
                                        backgroundColor: '#121225',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '0.75rem',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                        zIndex: 50,
                                        padding: '0.5rem',
                                        maxHeight: '12rem',
                                        overflowY: 'auto'
                                    }} className="custom-scrollbar">
                                        <p style={{ fontSize: '10px', fontWeight: '800', color: '#71717a', textTransform: 'uppercase', padding: '0.25rem 0.5rem', margin: 0 }}>Select FY to Calculate</p>
                                        {possibleFYs.map(fy => (
                                            <button
                                                key={fy}
                                                onClick={() => { handleAddInterest(fy); setShowFYSelector(false); }}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: '0.5rem 0.75rem',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    color: '#a1a1aa',
                                                    backgroundColor: 'transparent',
                                                    border: 'none',
                                                    borderRadius: '0.5rem',
                                                    cursor: 'pointer',
                                                    transition: 'background-color 0.2s, color 0.2s'
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'white'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#a1a1aa'; }}
                                            >
                                                FY {fy}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ width: '100%', height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={ppfInterestChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="year" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#e4e4e7' }} />
                                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} tick={{ fill: '#a1a1aa' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#121225', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                                    itemStyle={{ color: '#34d399', fontWeight: 'bold' }}
                                    formatter={(value) => [formatCurrency(value), 'PPF Interest Earned']}
                                    labelStyle={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '4px' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                />
                                <Bar dataKey="amount" fill="#34d399" radius={[6, 6, 0, 0]} maxBarSize={50} name="Interest Earned">
                                    {ppfInterestChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === ppfInterestChartData.length - 1 ? '#10b981' : '#34d399'} opacity={0.9} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <div style={styles.filterBar}>
                {years.map(year => (
                    <button
                        key={year}
                        onClick={() => { setSelectedYear(year); setCurrentPage(1); }}
                        style={styles.filterTab(selectedYear === year)}
                    >
                        {year}
                    </button>
                ))}
            </div>

            <div style={styles.tableContainer}>
                <div style={{
                    padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: 'rgba(255, 255, 255, 0.015)'
                }}>
                    <h3 style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)', margin: 0 }}>Transactions</h3>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase' }}>Page {currentPage} of {totalPages || 1}</span>
                </div>

                <div style={{ overflowX: 'auto' }} className="custom-scrollbar">
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th('left')}>Date</th>
                                <th style={styles.th('left')}>Entry Type</th>
                                <th style={styles.th('right')}>Contribution</th>
                                <th style={styles.th('right')}>Yield</th>
                                <th style={styles.th('right')}>Balance</th>
                                <th style={styles.th('center')}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedDetails.map((item, index) => {
                                const originalIndex = ppf.details.indexOf(item);
                                return (
                                    <tr key={index} style={{ transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        <td style={styles.td('left', false, '#d4d4d8')}>{formatDate(item.date)}</td>
                                        <td style={styles.td('left')}>
                                            <span style={{
                                                fontSize: '9px', fontWeight: '900', px: '0.5rem', py: '0.125rem',
                                                borderRadius: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                                                padding: '0.25rem 0.5rem',
                                                backgroundColor: item.type === 'interest' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                                                color: item.type === 'interest' ? '#34d399' : '#60a5fa',
                                                border: item.type === 'interest' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(59, 130, 246, 0.2)'
                                            }}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td style={styles.td('right', true, '#e4e4e7')}><span style={{ fontFamily: 'monospace' }}>{item.amount > 0 ? formatCurrency(item.amount) : '—'}</span></td>
                                        <td style={styles.td('right', true, '#34d399')}><span style={{ fontFamily: 'monospace' }}>{item.interestEarned > 0 ? `+${formatCurrency(item.interestEarned)}` : '—'}</span></td>
                                        <td style={styles.td('right', true, 'white', '14px')}><span style={{ fontFamily: 'monospace' }}>{formatCurrency(item.balance)}</span></td>
                                        <td style={styles.td('center')}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                <button onClick={() => { setEditingTx(item); setEditingIndex(originalIndex); setIsModalOpen(true); }} style={styles.actionBtn('rgba(59, 130, 246, 0.12)', 'rgba(59, 130, 246, 0.25)', '#60a5fa')} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}><Edit2 size={14} /></button>
                                                <button onClick={() => handleDeleteTx(originalIndex)} style={styles.actionBtn('rgba(239, 68, 68, 0.12)', 'rgba(239, 68, 68, 0.25)', '#f87171')} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredDetails.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <p style={{ color: '#71717a', margin: 0, fontSize: '0.875rem', fontWeight: '500' }}>No transactions identified for the selected interval.</p>
                    </div>
                )}

                <div style={{
                    padding: '1rem 1.5rem', backgroundColor: 'rgba(255, 255, 255, 0.015)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{
                        padding: '0.5rem 1rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.03)',
                        fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: currentPage === 1 ? '#52525b' : '#a1a1aa',
                        border: 'none', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
                    }} onMouseEnter={(e) => { if (currentPage !== 1) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}>Previous</button>
                    
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {[...Array(totalPages)].map((_, i) => (
                            <button 
                                key={i} 
                                onClick={() => setCurrentPage(i + 1)} 
                                style={{
                                    width: '2rem', height: '2rem', borderRadius: '0.5rem', fontSize: '11px', fontWeight: '800',
                                    border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                    backgroundColor: currentPage === i + 1 ? '#2563eb' : 'transparent',
                                    color: currentPage === i + 1 ? 'white' : '#71717a'
                                }}
                                onMouseEnter={(e) => { if (currentPage !== i + 1) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                                onMouseLeave={(e) => { if (currentPage !== i + 1) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>

                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} style={{
                        padding: '0.5rem 1rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.03)',
                        fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: (currentPage === totalPages || totalPages === 0) ? '#52525b' : '#a1a1aa',
                        border: 'none', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
                    }} onMouseEnter={(e) => { if (currentPage !== totalPages && totalPages !== 0) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}>Next</button>
                </div>
            </div>

            <PPFTransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveTx} initialData={editingTx} />
        </div>
    );
};

export default PPFDetails;
