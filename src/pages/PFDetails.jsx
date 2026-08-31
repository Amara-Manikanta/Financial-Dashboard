import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Landmark, Plus, Edit2, Trash2 } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import PFTransactionModal from '../components/PFTransactionModal';
import BackButton from '../components/BackButton';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

const PFDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();
    const [selectedYear, setSelectedYear] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);
    const [isEditingUan, setIsEditingUan] = useState(false);
    const [uan, setUan] = useState('');
    const [activeTab, setActiveTab] = useState('EPF');

    const pf = useMemo(() => savings.find(s => s.id === id), [savings, id]);

    useEffect(() => {
        if (pf && !isEditingUan) {
            setUan(pf.uan || pf.uanNumber || pf.accountNumber || '');
        }
    }, [pf, isEditingUan]);

    const getFinancialYear = (dateStr) => {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 1-indexed
        return month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
    };

    const recalculateBalances = (details) => {
        if (!pf) return [];
        const sorted = [...details].sort((a, b) => new Date(a.date) - new Date(b.date));
        let runningEpfBalance = Number(pf.amount || 0);
        let runningEpsBalance = 0;
        return sorted.map(item => {
            // VPF sits inside the EPF account, so it belongs in the EPF balance
            // rather than in a fund of its own.
            const epfAmount = (Number(item.employeeContribution) || 0) + (Number(item.employerContribution) || 0) + (Number(item.vpfContribution) || 0) + (Number(item.interestEarned) || 0);
            runningEpfBalance += epfAmount;
            
            const epsAmount = Number(item.epsContribution) || 0;
            runningEpsBalance += epsAmount;

            return { 
                ...item, 
                balance: runningEpfBalance,
                epfBalance: runningEpfBalance,
                epsBalance: runningEpsBalance
            };
        });
    };

    const handleSaveUan = () => {
        if (!pf) return;
        updateItem('savings', { ...pf, uan });
        setIsEditingUan(false);
    };

    const handleSaveTx = (txData) => {
        if (!pf) return;
        let updatedDetails = [...(pf.details || [])];
        if (editingIndex !== null) {
            updatedDetails[editingIndex] = txData;
        } else {
            updatedDetails.push(txData);
        }

        const detailsWithBalances = recalculateBalances(updatedDetails);
        updateItem('savings', { ...pf, details: detailsWithBalances });
        setIsModalOpen(false);
        setEditingTx(null);
        setEditingIndex(null);
    };

    const handleDeleteTx = (originalIndex) => {
        if (!pf) return;
        if (window.confirm('Delete this transaction?')) {
            const updatedDetails = (pf.details || []).filter((_, i) => i !== originalIndex);
            const detailsWithBalances = recalculateBalances(updatedDetails);
            updateItem('savings', { ...pf, details: detailsWithBalances });
        }
    };

    // Memoize computations for performance
    const details = useMemo(() => pf?.details || [], [pf]);

    const years = useMemo(() => {
        return ['All', ...new Set(details.map(item => getFinancialYear(item.date)))].sort((a, b) => b.localeCompare(a));
    }, [details]);

    const filteredDetails = useMemo(() => {
        const sorted = [...details].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const tabFiltered = sorted.filter(item => {
            if (activeTab === 'EPF') {
                return (Number(item.employeeContribution) > 0 ||
                        Number(item.employerContribution) > 0 ||
                        Number(item.vpfContribution) > 0 ||
                        Number(item.interestEarned) > 0 ||
                        item.type === 'Interest');
            } else {
                return Number(item.epsContribution) > 0;
            }
        });

        if (selectedYear === 'All') return tabFiltered;
        return tabFiltered.filter(item => getFinancialYear(item.date) === selectedYear);
    }, [details, selectedYear, activeTab]);

    const itemsPerPage = 6;
    const totalPages = useMemo(() => Math.ceil(filteredDetails.length / itemsPerPage), [filteredDetails]);

    const paginatedDetails = useMemo(() => {
        return filteredDetails.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [filteredDetails, currentPage]);

    const openingBalance = useMemo(() => Number(pf?.amount || 0), [pf]);

    const totalEpfInterest = useMemo(() => {
        return details.reduce((sum, item) => sum + (Number(item.interestEarned) || 0), 0);
    }, [details]);

    const totalEmployeeContrib = useMemo(() => {
        return details.reduce((sum, item) => sum + (Number(item.employeeContribution) || 0), 0);
    }, [details]);

    const totalEmployerContrib = useMemo(() => {
        return details.reduce((sum, item) => sum + (Number(item.employerContribution) || 0), 0);
    }, [details]);

    const totalVpfContrib = useMemo(() => {
        return details.reduce((sum, item) => sum + (Number(item.vpfContribution) || 0), 0);
    }, [details]);

    const totalEpsContrib = useMemo(() => {
        return details.reduce((sum, item) => sum + (Number(item.epsContribution) || 0), 0);
    }, [details]);

    const totalEpfBalance = useMemo(() => {
        if (!pf) return 0;
        return details.length > 0 ? recalculateBalances(details).slice(-1)[0].epfBalance : openingBalance;
    }, [details, pf, openingBalance]);

    const totalEpsBalance = useMemo(() => {
        if (!pf) return 0;
        return details.length > 0 ? recalculateBalances(details).slice(-1)[0].epsBalance : 0;
    }, [details, pf]);

    const totalPortfolioBalance = useMemo(() => {
        return totalEpfBalance + totalEpsBalance;
    }, [totalEpfBalance, totalEpsBalance]);

    const yearlyEpfInterestSplit = useMemo(() => {
        return details.reduce((acc, item) => {
            if (item.type === 'Interest' || Number(item.interestEarned) > 0) {
                const fy = getFinancialYear(item.date);
                if (!acc[fy]) {
                    acc[fy] = { employeeInterest: 0, employerInterest: 0 };
                }
                const empInt = item.employeeInterestEarned;
                const emrInt = item.employerInterestEarned;
                if (empInt !== undefined || emrInt !== undefined) {
                    acc[fy].employeeInterest += (Number(empInt) || 0);
                    acc[fy].employerInterest += (Number(emrInt) || 0);
                } else {
                    acc[fy].employeeInterest += (Number(item.interestEarned) || 0);
                }
            }
            return acc;
        }, {});
    }, [details]);

    const epfChartData = useMemo(() => {
        return Object.entries(yearlyEpfInterestSplit)
            .map(([year, split]) => ({ 
                year, 
                employeeInterest: split.employeeInterest, 
                employerInterest: split.employerInterest,
                total: split.employeeInterest + split.employerInterest
            }))
            .sort((a, b) => a.year.localeCompare(b.year));
    }, [yearlyEpfInterestSplit]);

    const yearlyEpsContrib = useMemo(() => {
        return details.reduce((acc, item) => {
            if (Number(item.epsContribution) > 0) {
                const fy = getFinancialYear(item.date);
                acc[fy] = (acc[fy] || 0) + (Number(item.epsContribution) || 0);
            }
            return acc;
        }, {});
    }, [details]);

    const epsChartData = useMemo(() => {
        return Object.entries(yearlyEpsContrib)
            .map(([year, amount]) => ({ year, amount }))
            .sort((a, b) => a.year.localeCompare(b.year));
    }, [yearlyEpsContrib]);

    const yearlyContributionData = useMemo(() => {
        const grouped = {};
        details.forEach(item => {
            if (item.type === 'Interest') return;
            const fy = getFinancialYear(item.date);
            if (!grouped[fy]) {
                grouped[fy] = {
                    year: fy,
                    employeeContribution: 0,
                    employerContribution: 0,
                    epsContribution: 0,
                    vpfContribution: 0,
                    totalEmployer: 0,
                    totalContribution: 0
                };
            }
            const emp = Number(item.employeeContribution) || 0;
            const emr = Number(item.employerContribution) || 0;
            const eps = Number(item.epsContribution) || 0;
            const vpf = Number(item.vpfContribution) || 0;

            grouped[fy].employeeContribution += emp;
            grouped[fy].employerContribution += emr;
            grouped[fy].epsContribution += eps;
            grouped[fy].vpfContribution += vpf;
            grouped[fy].totalEmployer += (emr + eps);
            grouped[fy].totalContribution += (emp + emr + eps + vpf);
        });

        return Object.values(grouped).sort((a, b) => a.year.localeCompare(b.year));
    }, [details]);

    const getYearlyStatus = useMemo(() => {
        const status = {};
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        const currentFY = currentMonth >= 4 ? `${currentYear}-${(currentYear + 1).toString().slice(-2)}` : `${currentYear - 1}-${currentYear.toString().slice(-2)}`;

        const uniqueYears = new Set(details.map(item => getFinancialYear(item.date)));
        uniqueYears.add(currentFY);

        uniqueYears.forEach(fy => {
            if (!fy || fy.length < 7) return;
            const startYearStr = fy.split('-')[0];
            const startYear = parseInt(startYearStr);
            if (isNaN(startYear)) return;
            
            const expectedMonths = [];
            for (let m = 4; m <= 12; m++) {
                expectedMonths.push({ year: startYear, month: m });
            }
            for (let m = 1; m <= 3; m++) {
                expectedMonths.push({ year: startYear + 1, month: m });
            }

            const checkableMonths = expectedMonths.filter(em => {
                if (em.year < currentYear) return true;
                if (em.year === currentYear && em.month <= currentMonth) return true;
                return false;
            });

            const fyTxs = details.filter(item => getFinancialYear(item.date) === fy);
            
            const monthlyContributions = {};
            fyTxs.forEach(tx => {
                if (tx.type !== 'Interest' && (Number(tx.employeeContribution) > 0 || Number(tx.employerContribution) > 0 || Number(tx.epsContribution) > 0 || Number(tx.vpfContribution) > 0)) {
                    const txDate = new Date(tx.date);
                    const key = `${txDate.getFullYear()}-${txDate.getMonth() + 1}`;
                    monthlyContributions[key] = true;
                }
            });

            const missingMonths = checkableMonths.filter(em => {
                const key = `${em.year}-${em.month}`;
                return !monthlyContributions[key];
            });

            const hasInterest = fyTxs.some(tx => tx.type === 'Interest' || Number(tx.interestEarned) > 0);

            status[fy] = {
                totalExpected: checkableMonths.length,
                totalRecorded: checkableMonths.length - missingMonths.length,
                missingCount: missingMonths.length,
                missingMonths: missingMonths.map(em => {
                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    return `${monthNames[em.month - 1]} ${em.year}`;
                }),
                hasInterest,
                isOngoing: fy === currentFY
            };
        });

        return status;
    }, [details]);

    if (!pf) return <div style={{ padding: 'var(--spacing-lg)', color: 'white' }}>PF account not found.</div>;

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
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            color: '#818cf8',
            display: 'flex',
            alignItems: 'center',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.1)'
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
        uanTag: {
            color: 'rgba(255, 255, 255, 0.5)',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.375rem',
            border: '1px solid rgba(255, 255, 255, 0.08)'
        },
        actionButton: (bg = '#4f46e5', shadowColor = 'rgba(99, 102, 241, 0.3)') => ({
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem',
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
        chartCard: {
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '1.25rem',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '1.5rem',
            marginBottom: '2.5rem',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.25)'
        },
        sectionHeader: {
            fontSize: '0.875rem',
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#71717a',
            marginBottom: '1.5rem',
            paddingLeft: '0.25rem',
            margin: 0
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
            backgroundColor: isActive ? '#4f46e5' : 'rgba(255, 255, 255, 0.03)',
            color: isActive ? 'white' : '#71717a',
            boxShadow: isActive ? '0 10px 15px -3px rgba(99, 102, 241, 0.3)' : 'none'
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
            <BackButton label="Back to Savings" />

            <div style={styles.headerPanel}>
                <div>
                    <div style={styles.titleContainer}>
                        <div style={styles.titleIcon}>
                            <Landmark size={24} />
                        </div>
                        <h2 style={styles.titleText}>{pf.title}</h2>
                    </div>
                    <p style={styles.subtitle}>Opening Balance: {formatCurrency(openingBalance)} | Started: {formatDate(pf.date)}</p>
                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={styles.uanTag}>UAN</span>
                        {isEditingUan ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input 
                                    type="text" 
                                    value={uan} 
                                    onChange={e => setUan(e.target.value)} 
                                    style={{
                                        backgroundColor: 'rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: '0.5rem',
                                        padding: '0.375rem 0.75rem',
                                        fontSize: '13px',
                                        color: 'white',
                                        fontFamily: 'monospace',
                                        outline: 'none',
                                        width: '12rem',
                                        transition: 'border-color 0.2s'
                                    }}
                                    placeholder="e.g. 100908765432"
                                    autoFocus
                                    onKeyDown={(e) => { 
                                        if (e.key === 'Enter') handleSaveUan(); 
                                        if (e.key === 'Escape') { setUan(pf.uan || ''); setIsEditingUan(false); } 
                                    }}
                                />
                                <button 
                                    onClick={handleSaveUan} 
                                    style={{
                                        backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: 'none',
                                        padding: '0.375rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer',
                                        fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.25)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)'}
                                >
                                    Save
                                </button>
                                <button 
                                    onClick={() => { setUan(pf.uan || ''); setIsEditingUan(false); }} 
                                    style={{
                                        backgroundColor: 'rgba(255,255,255,0.05)', color: '#a1a1aa', border: 'none',
                                        padding: '0.375rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer',
                                        fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div 
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                                onClick={() => setIsEditingUan(true)}
                            >
                                <span style={{ color: 'white', fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                    {(pf.uan || pf.uanNumber || uan) ? (pf.uan || pf.uanNumber || uan) : <span style={{ color: '#71717a', fontStyle: 'italic', fontSize: '0.875rem' }}>Not specified</span>}
                                </span>
                                <Edit2 size={12} style={{ color: '#818cf8', opacity: 0.6 }} />
                            </div>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => { setEditingTx(null); setEditingIndex(null); setIsModalOpen(true); }}
                    style={styles.actionButton('#4f46e5', 'rgba(99, 102, 241, 0.4)')}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#4338ca';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 10px 20px -3px rgba(99, 102, 241, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#4f46e5';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 10px 20px -3px rgba(99, 102, 241, 0.3)';
                    }}
                >
                    <Plus size={16} />
                    Add Transaction
                </button>
            </div>

            <div style={{
                marginBottom: '1.5rem',
                padding: '1rem 1.5rem',
                borderRadius: '1.25rem',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span style={{ fontSize: '0.875rem', color: '#a1a1aa', fontWeight: '600' }}>Combined PF Portfolio Value (EPF + EPS):</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#818cf8', fontFamily: 'monospace' }}>{formatCurrency(totalPortfolioBalance)}</span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                    onClick={() => { setActiveTab('EPF'); setCurrentPage(1); }}
                    style={styles.filterTab(activeTab === 'EPF')}
                >
                    EPF (Provident Fund)
                </button>
                <button
                    onClick={() => { setActiveTab('EPS'); setCurrentPage(1); }}
                    style={styles.filterTab(activeTab === 'EPS')}
                >
                    EPS (Pension Scheme)
                </button>
            </div>

            {activeTab === 'EPF' ? (
                <div style={styles.statGrid}>
                    <div style={styles.glassCard('rgba(99, 102, 241, 0.05)', 'rgba(99, 102, 241, 0.15)', 'rgba(99, 102, 241, 0.1)')}>
                        <p style={{ fontSize: '10px', color: '#818cf8', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', margin: 0 }}>Total EPF Balance</p>
                        <p style={{ fontSize: '1.6rem', fontWeight: '900', color: 'white', margin: 0, fontFamily: 'monospace' }}>{formatCurrency(totalEpfBalance)}</p>
                    </div>
                    <div style={styles.glassCard('rgba(59, 130, 246, 0.05)', 'rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.1)')}>
                        <p style={{ fontSize: '10px', color: '#60a5fa', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', margin: 0 }}>Employee Contribution</p>
                        <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#60a5fa', margin: 0, fontFamily: 'monospace' }}>{formatCurrency(totalEmployeeContrib)}</p>
                    </div>
                    <div style={styles.glassCard('rgba(244, 114, 182, 0.05)', 'rgba(244, 114, 182, 0.15)', 'rgba(244, 114, 182, 0.1)')}>
                        <p style={{ fontSize: '10px', color: '#f472b6', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', margin: 0 }}>Voluntary PF (VPF)</p>
                        <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#f472b6', margin: 0, fontFamily: 'monospace' }}>{formatCurrency(totalVpfContrib)}</p>
                    </div>
                    <div style={styles.glassCard('rgba(20, 184, 166, 0.05)', 'rgba(20, 184, 166, 0.15)', 'rgba(20, 184, 166, 0.1)')}>
                        <p style={{ fontSize: '10px', color: '#2dd4bf', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', margin: 0 }}>Employer EPF Contribution</p>
                        <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#2dd4bf', margin: 0, fontFamily: 'monospace' }}>{formatCurrency(totalEmployerContrib)}</p>
                    </div>
                    <div style={styles.glassCard('rgba(16, 185, 129, 0.05)', 'rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.1)')}>
                        <p style={{ fontSize: '10px', color: '#34d399', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', margin: 0 }}>Total EPF Interest</p>
                        <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#34d399', margin: 0, fontFamily: 'monospace' }}>{formatCurrency(totalEpfInterest)}</p>
                    </div>
                </div>
            ) : (
                <div style={styles.statGrid}>
                    <div style={styles.glassCard('rgba(251, 191, 36, 0.05)', 'rgba(251, 191, 36, 0.15)', 'rgba(251, 191, 36, 0.1)')}>
                        <p style={{ fontSize: '10px', color: '#fbbf24', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', margin: 0 }}>Total EPS Balance</p>
                        <p style={{ fontSize: '1.6rem', fontWeight: '900', color: 'white', margin: 0, fontFamily: 'monospace' }}>{formatCurrency(totalEpsBalance)}</p>
                    </div>
                    <div style={styles.glassCard('rgba(249, 115, 22, 0.05)', 'rgba(249, 115, 22, 0.15)', 'rgba(249, 115, 22, 0.1)')}>
                        <p style={{ fontSize: '10px', color: '#f97316', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', margin: 0 }}>Total EPS Contributions</p>
                        <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#f97316', margin: 0, fontFamily: 'monospace' }}>{formatCurrency(totalEpsContrib)}</p>
                    </div>
                </div>
            )}

            <div style={styles.chartCard}>
                {activeTab === 'EPF' ? (
                    <>
                        <h3 style={styles.sectionHeader}>EPF Interest Earned By Year (Employee vs Employer)</h3>
                        {epfChartData.length > 0 ? (
                            <div style={{ width: '100%', height: '350px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={epfChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="year" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#121225', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '12px' }}
                                            itemStyle={{ fontWeight: 'bold' }}
                                            formatter={(value) => formatCurrency(value)}
                                            cursor={{fill: 'rgba(255,255,255,0.02)'}}
                                        />
                                        <Bar dataKey="employeeInterest" fill="#34d399" radius={[4, 4, 0, 0]} barSize={20} name="Employee Interest" />
                                        <Bar dataKey="employerInterest" fill="#60a5fa" radius={[4, 4, 0, 0]} barSize={20} name="Employer Interest" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div style={{
                                height: '12rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px dashed rgba(255, 255, 255, 0.12)', borderRadius: '1rem', backgroundColor: 'transparent'
                            }}>
                                <p style={{ color: '#71717a', fontWeight: '800', uppercase: 'true', letterSpacing: '0.08em', fontSize: '11px', margin: 0 }}>No EPF interest recorded yet</p>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <h3 style={styles.sectionHeader}>EPS Contributions By Year</h3>
                        {epsChartData.length > 0 ? (
                            <div style={{ width: '100%', height: '350px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={epsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="year" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#121225', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '12px' }}
                                            itemStyle={{ color: '#fbbf24', fontWeight: 'bold' }}
                                            formatter={(value) => formatCurrency(value)}
                                            cursor={{fill: 'rgba(255,255,255,0.02)'}}
                                        />
                                        <Bar dataKey="amount" fill="#fbbf24" radius={[4, 4, 0, 0]} barSize={40} name="EPS Contribution" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div style={{
                                height: '12rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px dashed rgba(255, 255, 255, 0.12)', borderRadius: '1rem', backgroundColor: 'transparent'
                            }}>
                                <p style={{ color: '#71717a', fontWeight: '800', uppercase: 'true', letterSpacing: '0.08em', fontSize: '11px', margin: 0 }}>No EPS contribution recorded yet</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div style={styles.filterBar}>
                {years.map(year => {
                    const status = getYearlyStatus[year];
                    const isWarning = status && (status.missingCount > 0 || !status.hasInterest);
                    return (
                        <button
                            key={year}
                            onClick={() => { setSelectedYear(year); setCurrentPage(1); }}
                            style={{
                                ...styles.filterTab(selectedYear === year),
                                position: 'relative'
                            }}
                        >
                            {year}
                            {isWarning && year !== 'All' && (
                                <span style={{
                                    position: 'absolute', top: '3px', right: '4px',
                                    width: '6px', height: '6px', borderRadius: '50%',
                                    backgroundColor: '#f87171'
                                }} title="Pending contributions or missing interest" />
                            )}
                        </button>
                    );
                })}
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
                                <th style={styles.th('right')}>Amount</th>
                                <th style={styles.th('center')}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedDetails.map((item, index) => {
                                const originalIndex = details.indexOf(item);
                                const isInterest = item.type === 'Interest';
                                const epfAmount = (Number(item.employeeContribution) || 0) + (Number(item.employerContribution) || 0) + (Number(item.vpfContribution) || 0) + (Number(item.interestEarned) || 0);
                                const epsAmount = Number(item.epsContribution) || 0;
                                const txAmount = activeTab === 'EPF' ? epfAmount : epsAmount;

                                return (
                                    <tr key={index} style={{ transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        <td style={styles.td('left', false, '#d4d4d8')}>{formatDate(item.date)}</td>
                                        <td style={styles.td('left')}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <span style={{
                                                    fontSize: '9px', fontWeight: '900',
                                                    borderRadius: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                                                    padding: '0.25rem 0.5rem', width: 'fit-content',
                                                    backgroundColor: activeTab === 'EPS' ? 'rgba(251, 191, 36, 0.12)' : isInterest ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                                                    color: activeTab === 'EPS' ? '#fbbf24' : isInterest ? '#34d399' : '#818cf8',
                                                    border: activeTab === 'EPS' ? '1px solid rgba(251, 191, 36, 0.2)' : isInterest ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(99, 102, 241, 0.2)'
                                                }}>
                                                    {activeTab === 'EPS' ? 'EPS Contribution' : isInterest ? 'Interest' : 'Contribution'}
                                                </span>
                                                {activeTab === 'EPF' && !isInterest && (Number(item.employeeContribution) > 0 || Number(item.employerContribution) > 0) && (
                                                    <span style={{ fontSize: '10px', color: '#71717a' }}>
                                                        Emp EPF: {formatCurrency(item.employeeContribution || 0)} | Employer EPF: {formatCurrency(item.employerContribution || 0)}
                                                    </span>
                                                )}
                                                {activeTab === 'EPF' && !isInterest && Number(item.vpfContribution) > 0 && (
                                                    <span style={{ fontSize: '10px', color: '#f472b6' }}>
                                                        VPF: {formatCurrency(item.vpfContribution)}
                                                    </span>
                                                )}
                                                {activeTab === 'EPF' && isInterest && (Number(item.employeeInterestEarned) > 0 || Number(item.employerInterestEarned) > 0) && (
                                                    <span style={{ fontSize: '10px', color: '#71717a' }}>
                                                        Emp Int: {formatCurrency(item.employeeInterestEarned || 0)} | Employer Int: {formatCurrency(item.employerInterestEarned || 0)}
                                                    </span>
                                                )}
                                                {activeTab === 'EPF' && isInterest && !item.employeeInterestEarned && !item.employerInterestEarned && (
                                                    <span style={{ fontSize: '10px', color: '#71717a' }}>
                                                        Interest: {formatCurrency(item.interestEarned || 0)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={styles.td('right', true, isInterest ? '#34d399' : activeTab === 'EPS' ? '#fbbf24' : '#e4e4e7')}><span style={{ fontFamily: 'monospace' }}>{isInterest ? `+${formatCurrency(txAmount)}` : formatCurrency(txAmount)}</span></td>
                                        <td style={styles.td('center')}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                <button onClick={() => { setEditingTx(item); setEditingIndex(originalIndex); setIsModalOpen(true); }} style={styles.actionBtn('rgba(99, 102, 241, 0.12)', 'rgba(99, 102, 241, 0.25)', '#818cf8')} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}><Edit2 size={14} /></button>
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
                                    backgroundColor: currentPage === i + 1 ? '#4f46e5' : 'transparent',
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

            {/* Year-Wise PF Contribution Trend Line Chart */}
            <div style={{ ...styles.chartCard, marginTop: '2.5rem' }}>
                <h3 style={styles.sectionHeader}>Yearly Contribution Trend (Employee vs Employer)</h3>
                {/* VPF is drawn only once something has been recorded, so the legend
                    does not carry a flat zero line for everyone who never opted in. */}
                {yearlyContributionData.length > 0 ? (
                    <div style={{ width: '100%', height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={yearlyContributionData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="year" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#121225', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '12px' }}
                                    itemStyle={{ fontWeight: 'bold' }}
                                    formatter={(value) => formatCurrency(value)}
                                    cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeDasharray: '4 4' }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#a1a1aa', paddingTop: '10px' }} />
                                <Line 
                                    type="monotone" 
                                    dataKey="employeeContribution" 
                                    name="Employee (Me) Contribution" 
                                    stroke="#60a5fa" 
                                    strokeWidth={3} 
                                    dot={{ r: 5, fill: '#60a5fa', strokeWidth: 2, stroke: '#121225' }}
                                    activeDot={{ r: 7 }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="employerContribution" 
                                    name="Employer EPF Contribution" 
                                    stroke="#2dd4bf" 
                                    strokeWidth={3} 
                                    dot={{ r: 5, fill: '#2dd4bf', strokeWidth: 2, stroke: '#121225' }}
                                    activeDot={{ r: 7 }}
                                />
                                {totalVpfContrib > 0 && (
                                    <Line
                                        type="monotone"
                                        dataKey="vpfContribution"
                                        name="Employee VPF Contribution"
                                        stroke="#f472b6"
                                        strokeWidth={2}
                                        dot={{ r: 4, fill: '#f472b6' }}
                                    />
                                )}
                                <Line
                                    type="monotone"
                                    dataKey="epsContribution"
                                    name="Employer EPS Contribution" 
                                    stroke="#fbbf24" 
                                    strokeWidth={2} 
                                    dot={{ r: 4, fill: '#fbbf24' }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="totalContribution" 
                                    name="Total Year Contribution" 
                                    stroke="#c084fc" 
                                    strokeWidth={2}
                                    strokeDasharray="5 5" 
                                    dot={{ r: 4, fill: '#c084fc' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{
                        height: '12rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px dashed rgba(255, 255, 255, 0.12)', borderRadius: '1rem', backgroundColor: 'transparent'
                    }}>
                        <p style={{ color: '#71717a', fontWeight: '800', uppercase: 'true', letterSpacing: '0.08em', fontSize: '11px', margin: 0 }}>No contribution records yet</p>
                    </div>
                )}
            </div>

            <PFTransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveTx} initialData={editingTx} />
        </div>
    );
};

export default PFDetails;
