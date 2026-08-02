import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, PiggyBank, Plus, Edit2, Trash2, RefreshCw, TrendingUp, Building2, Archive, ArchiveRestore, ChevronDown, ChevronUp, LayoutGrid, Table, Percent, Clock, MapPin, FileText } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import FixedDepositModal from '../components/FixedDepositModal';
import CloseDepositModal from '../components/CloseDepositModal';
import BackButton from '../components/BackButton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend } from 'recharts';

const calculateProgress = (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return 0;
    const start = new Date(startDateStr).getTime();
    const end = new Date(endDateStr).getTime();
    const now = new Date().getTime();
    if (now >= end) return 100;
    if (now <= start) return 0;
    const total = end - start;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
};

const getDaysRemainingText = (endDateStr) => {
    if (!endDateStr) return '';
    const end = new Date(endDateStr).getTime();
    const today = new Date().setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Matured ${Math.abs(diffDays)}d ago`;
    if (diffDays === 0) return 'Maturing Today';
    return `${diffDays} days left`;
};

const FixedDepositDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDeposit, setEditingDeposit] = useState(null);
    const [isRenewal, setIsRenewal] = useState(false);
    const [selectedBank, setSelectedBank] = useState('ALL');
    const [showArchived, setShowArchived] = useState(false);
    const [viewMode, setViewMode] = useState('cards'); // 'cards' (default) or 'table'

    // Close & Archive Modal state
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [closingDeposit, setClosingDeposit] = useState(null);

    const fund = savings.find(s => s.id.toString() === id);

    const activeDeposits = useMemo(() => {
        if (!fund?.deposits) return [];
        return fund.deposits.filter(d => !d.isArchived);
    }, [fund]);

    const archivedDeposits = useMemo(() => {
        if (!fund?.deposits) return [];
        return fund.deposits.filter(d => d.isArchived);
    }, [fund]);

    const bankList = useMemo(() => {
        if (!activeDeposits.length) return [];
        const banks = Array.from(new Set(activeDeposits.map(d => d.bank).filter(Boolean)));
        return banks.sort();
    }, [activeDeposits]);

    useEffect(() => {
        if (selectedBank !== 'ALL' && !bankList.includes(selectedBank)) {
            setSelectedBank('ALL');
        }
    }, [bankList, selectedBank]);

    const filteredDeposits = useMemo(() => {
        if (!activeDeposits.length) return [];
        if (selectedBank === 'ALL') return activeDeposits;
        return activeDeposits.filter(d => d.bank === selectedBank);
    }, [activeDeposits, selectedBank]);

    const getDepositAccruedDetails = (deposit) => {
        if (!deposit || !deposit.originalAmount || !deposit.startDate) {
            return {
                accruedValue: Number(deposit?.currentValue || deposit?.originalAmount) || 0,
                accruedInterest: Number(deposit?.interestEarned) || 0,
                daysElapsed: 0,
                totalDays: 0
            };
        }

        const P = Number(deposit.originalAmount) || 0;
        const r = (Number(deposit.interestRate) || 0) / 100;
        const start = new Date(deposit.startDate);
        const end = new Date(deposit.endDate);
        const today = new Date();

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return {
                accruedValue: Number(deposit.currentValue || P),
                accruedInterest: Number(deposit.interestEarned) || 0,
                daysElapsed: 0,
                totalDays: 0
            };
        }

        const msPerDay = 1000 * 60 * 60 * 24;
        const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());

        const effectiveEnd = todayMidnight < endMidnight ? todayMidnight : endMidnight;
        const daysElapsed = Math.max(0, Math.round((effectiveEnd - startMidnight) / msPerDay));
        const totalDays = Math.max(1, Math.round((endMidnight - startMidnight) / msPerDay));

        const isSlice = deposit.bank && deposit.bank.toLowerCase().includes('slice');
        let accruedInterest = 0;

        if (isSlice) {
            accruedInterest = P * (Math.pow(1 + r / 365, daysElapsed) - 1);
        } else {
            const tElapsedYears = daysElapsed / 365.25;
            accruedInterest = P * (Math.pow(1 + r / 4, 4 * tElapsedYears) - 1);
        }

        const accruedValue = P + accruedInterest;

        return {
            accruedValue,
            accruedInterest,
            daysElapsed,
            totalDays
        };
    };

    const totalOriginalAmount = useMemo(() => filteredDeposits.reduce((sum, d) => sum + (d.originalAmount || 0), 0), [filteredDeposits]);
    const totalMaturityAmount = useMemo(() => filteredDeposits.reduce((sum, d) => sum + (d.maturityAmount || 0), 0), [filteredDeposits]);
    const totalInterest = useMemo(() => filteredDeposits.reduce((sum, d) => sum + (d.interestEarned || 0), 0), [filteredDeposits]);
    const totalInterestAccruedTillNow = useMemo(() => filteredDeposits.reduce((sum, d) => sum + getDepositAccruedDetails(d).accruedInterest, 0), [filteredDeposits]);

    const getFYLabel = (dateObj) => {
        const d = new Date(dateObj);
        if (isNaN(d.getTime())) return null;
        const year = d.getFullYear();
        const month = d.getMonth();
        if (month >= 3) {
            return `FY ${year}-${(year + 1).toString().slice(-2)}`;
        } else {
            return `FY ${year - 1}-${year.toString().slice(-2)}`;
        }
    };

    const normalizeFYString = (fyStr) => {
        if (!fyStr) return '';
        const str = fyStr.toString().trim();
        if (str.includes('-')) {
            const parts = str.replace(/FY/i, '').trim().split('-');
            if (parts.length === 2) {
                const startY = parts[0].trim();
                const endY = parts[1].trim().slice(-2);
                return `FY ${startY}-${endY}`;
            }
        }
        const parsedDate = new Date(str);
        if (!isNaN(parsedDate.getTime())) {
            return getFYLabel(parsedDate);
        }
        const numYear = parseInt(str);
        if (!isNaN(numYear)) {
            return `FY ${numYear}-${(numYear + 1).toString().slice(-2)}`;
        }
        return str;
    };

    const yearlyBreakdown = useMemo(() => {
        const breakdown = {};
        if (!fund?.deposits?.length) return [];

        fund.deposits.forEach(deposit => {
            const P = deposit.originalAmount || 0;
            const r = (deposit.interestRate || 0) / 100;
            const isSlice = deposit.bank && deposit.bank.toLowerCase().includes('slice');
            const n = isSlice ? 365 : 4;
            const start = new Date(deposit.startDate);
            const end = new Date(deposit.endDate);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

            const startFYYear = start.getMonth() >= 3 ? start.getFullYear() : start.getFullYear() - 1;
            const endFYYear = end.getMonth() >= 3 ? end.getFullYear() : end.getFullYear() - 1;

            for (let y = startFYYear; y <= endFYYear; y++) {
                const fyStart = new Date(y, 3, 1);
                const fyEnd = new Date(y + 1, 2, 31, 23, 59, 59);

                const periodStart = start > fyStart ? start : fyStart;
                const periodEnd = end < fyEnd ? end : fyEnd;

                if (periodEnd > periodStart) {
                    const tStart = (periodStart - start) / (1000 * 60 * 60 * 24 * 365.25);
                    const tEnd = (periodEnd - start) / (1000 * 60 * 60 * 24 * 365.25);

                    const vStart = P * Math.pow((1 + r / n), (n * tStart));
                    const vEnd = P * Math.pow((1 + r / n), (n * tEnd));

                    const interestInFY = vEnd - vStart;
                    const fyLabel = `FY ${y}-${(y + 1).toString().slice(-2)}`;
                    breakdown[fyLabel] = (breakdown[fyLabel] || 0) + interestInFY;
                }
            }
        });

        return Object.entries(breakdown)
            .map(([year, amount]) => ({ year, amount: Math.round(amount) }));
    }, [fund]);

    const yearlyTdsBreakdown = useMemo(() => {
        const breakdown = {};
        if (!fund?.deposits?.length) return [];

        fund.deposits.forEach(deposit => {
            if (deposit.tdsTransactions && deposit.tdsTransactions.length > 0) {
                deposit.tdsTransactions.forEach(tx => {
                    const rawFy = tx.financialYear || tx.date;
                    const fyLabel = normalizeFYString(rawFy);
                    if (fyLabel) {
                        breakdown[fyLabel] = (breakdown[fyLabel] || 0) + (tx.amount || 0);
                    }
                });
            } else if (deposit.tds && deposit.tds > 0) {
                const refDate = deposit.endDate || deposit.startDate;
                if (refDate) {
                    const dt = new Date(refDate);
                    if (!isNaN(dt.getTime())) {
                        const y = dt.getMonth() >= 3 ? dt.getFullYear() : dt.getFullYear() - 1;
                        const fyLabel = `FY ${y}-${(y + 1).toString().slice(-2)}`;
                        breakdown[fyLabel] = (breakdown[fyLabel] || 0) + deposit.tds;
                    }
                }
            }
        });

        return Object.entries(breakdown)
            .map(([year, amount]) => ({ year, amount: Math.round(amount) }));
    }, [fund]);

    const combinedFdChartData = useMemo(() => {
        const interestMap = {};
        const tdsMap = {};

        yearlyBreakdown.forEach(item => {
            interestMap[item.year] = item.amount;
        });

        yearlyTdsBreakdown.forEach(item => {
            tdsMap[item.year] = item.amount;
        });

        const allYears = Array.from(new Set([...Object.keys(interestMap), ...Object.keys(tdsMap)]))
            .sort((a, b) => a.localeCompare(b));

        return allYears.map(year => ({
            year,
            interest: interestMap[year] || 0,
            tds: tdsMap[year] || 0
        }));
    }, [yearlyBreakdown, yearlyTdsBreakdown]);

    if (!fund) {
        return (
            <div style={{ padding: 'var(--spacing-lg)' }}>
                <p>Fixed Deposit account not found.</p>
                <button
                    onClick={() => navigate(-1)}
                    className="text-primary hover:underline mt-4"
                >
                    Back to Savings
                </button>
            </div>
        );
    }

    const handleSaveDeposit = (deposit) => {
        let updatedDeposits = fund.deposits ? [...fund.deposits] : [];

        if (editingDeposit) {
            updatedDeposits = updatedDeposits.map(d => d.id === deposit.id ? deposit : d);
        } else {
            updatedDeposits.push(deposit);
        }

        const newTotalAmount = updatedDeposits
            .filter(d => !d.isArchived)
            .reduce((sum, d) => sum + (getDepositAccruedDetails(d).accruedValue || d.originalAmount || 0), 0);

        updateItem('savings', { ...fund, deposits: updatedDeposits, amount: newTotalAmount });
        setEditingDeposit(null);
        setIsRenewal(false);
        setIsModalOpen(false);
    };

    const handleRenewDeposit = (deposit) => {
        setEditingDeposit(deposit);
        setIsRenewal(true);
        setIsModalOpen(true);
    };

    const handleDeleteDeposit = (depositId) => {
        if (window.confirm('Delete this deposit entry?')) {
            const updatedDeposits = fund.deposits.filter(d => d.id !== depositId);
            const newTotalAmount = updatedDeposits
                .filter(d => !d.isArchived)
                .reduce((sum, d) => sum + (getDepositAccruedDetails(d).accruedValue || d.originalAmount || 0), 0);
            updateItem('savings', { ...fund, deposits: updatedDeposits, amount: newTotalAmount });
        }
    };

    const handleOpenCloseModal = (deposit) => {
        setClosingDeposit(deposit);
        setIsCloseModalOpen(true);
    };

    const handleConfirmCloseModal = ({ depositId, closureDate, finalInterestEarned, closureRemarks }) => {
        const updatedDeposits = fund.deposits.map(d => {
            if (d.id === depositId) {
                const P = Number(d.originalAmount) || 0;
                const finalInterest = Number(finalInterestEarned) || 0;
                return {
                    ...d,
                    isArchived: true,
                    endDate: closureDate || d.endDate,
                    interestEarned: finalInterest,
                    currentValue: P + finalInterest,
                    maturityAmount: P + finalInterest,
                    remarks: closureRemarks || d.remarks
                };
            }
            return d;
        });

        const newTotalAmount = updatedDeposits
            .filter(d => !d.isArchived)
            .reduce((sum, d) => sum + (getDepositAccruedDetails(d).accruedValue || d.originalAmount || 0), 0);

        updateItem('savings', { ...fund, deposits: updatedDeposits, amount: newTotalAmount });
        setClosingDeposit(null);
    };

    const handleRestoreDeposit = (depositId) => {
        const updatedDeposits = fund.deposits.map(d => {
            if (d.id === depositId) {
                return { ...d, isArchived: false };
            }
            return d;
        });

        const newTotalAmount = updatedDeposits
            .filter(d => !d.isArchived)
            .reduce((sum, d) => sum + (getDepositAccruedDetails(d).accruedValue || d.originalAmount || 0), 0);

        updateItem('savings', { ...fund, deposits: updatedDeposits, amount: newTotalAmount });
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }} className="animate-fade-in">
            {/* Custom Styles Injection */}
            <style>{`
                .fd-glass-panel {
                    background: rgba(10, 11, 20, 0.45) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(16, 185, 129, 0.15) !important;
                    border-radius: 1.5rem !important;
                    padding: 1.5rem !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 20px 1px rgba(16, 185, 129, 0.05) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .fd-glass-panel:hover {
                    transform: translateY(-4px) !important;
                    border-color: rgba(16, 185, 129, 0.35) !important;
                    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px 2px rgba(16, 185, 129, 0.15) !important;
                }
                .fd-glass-glow-card {
                    background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(10, 11, 20, 0.5) 100%) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(16, 185, 129, 0.25) !important;
                    border-radius: 1.5rem !important;
                    padding: 1.5rem !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6), 0 0 25px 2px rgba(16, 185, 129, 0.1) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .fd-glass-glow-card:hover {
                    transform: translateY(-4px) !important;
                    border-color: rgba(16, 185, 129, 0.5) !important;
                    box-shadow: 0 20px 45px -15px rgba(0, 0, 0, 0.8), 0 0 35px 3px rgba(16, 185, 129, 0.25) !important;
                }
                .fd-table-container {
                    background: rgba(10, 11, 20, 0.35) !important;
                    backdrop-filter: blur(12px) !important;
                    -webkit-backdrop-filter: blur(12px) !important;
                    border-radius: 1.5rem !important;
                    border: 1px solid rgba(255, 255, 255, 0.05) !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.4) !important;
                    overflow: hidden !important;
                }
                .fd-table {
                    width: 100%;
                    border-collapse: separate !important;
                    border-spacing: 0 !important;
                }
                .fd-table th {
                    background-color: rgba(255, 255, 255, 0.02) !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                    color: rgba(255, 255, 255, 0.5) !important;
                    font-weight: 700 !important;
                    font-size: 0.75rem !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                }
                .fd-table td {
                    border-bottom: 1px solid rgba(255, 255, 255, 0.03) !important;
                    transition: all 0.2s ease !important;
                }
                .fd-table tr:last-child td {
                    border-bottom: none !important;
                }
                .fd-table tr:hover td {
                    background-color: rgba(16, 185, 129, 0.04) !important;
                    color: #ffffff !important;
                }
                .fd-year-card {
                    background: rgba(10, 11, 20, 0.4) !important;
                    backdrop-filter: blur(12px) !important;
                    -webkit-backdrop-filter: blur(12px) !important;
                    border: 1px solid rgba(255, 255, 255, 0.05) !important;
                    border-radius: 1rem !important;
                    padding: 1rem !important;
                    box-shadow: 0 4px 15px -3px rgba(0, 0, 0, 0.3) !important;
                    transition: all 0.3s ease !important;
                }
                .fd-year-card:hover {
                    transform: translateY(-2px) !important;
                    box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.5) !important;
                }
            `}</style>

            <BackButton label="Back to Savings" />

            <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
                        <PiggyBank className="text-emerald-400" size={32} />
                        {fund.title}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Summary of all your active Fixed Deposits.</p>
                </div>
                <button
                    onClick={() => { setEditingDeposit(null); setIsModalOpen(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 text-sm transition-all shadow-lg shadow-emerald-500/25"
                >
                    <Plus size={18} />
                    Add Deposit
                </button>
            </div>

            {/* Bank Selection Tabs */}
            {bankList.length > 0 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    overflowX: 'auto',
                    paddingBottom: '0.5rem',
                    marginBottom: '2rem',
                    scrollbarWidth: 'none'
                }}>
                    <button
                        onClick={() => setSelectedBank('ALL')}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.625rem 1.25rem',
                            borderRadius: '0.875rem',
                            backgroundColor: selectedBank === 'ALL' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            border: selectedBank === 'ALL' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                            color: selectedBank === 'ALL' ? '#ffffff' : '#a1a1aa',
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap',
                            boxShadow: selectedBank === 'ALL' ? '0 0 15px rgba(16, 185, 129, 0.3)' : 'none'
                        }}
                    >
                        <Building2 size={15} style={{ color: selectedBank === 'ALL' ? '#34d399' : '#a1a1aa' }} />
                        <span>All Banks</span>
                        <span style={{
                            backgroundColor: selectedBank === 'ALL' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                            color: '#ffffff',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.6875rem'
                        }}>
                            {fund.deposits?.length || 0}
                        </span>
                    </button>

                    {bankList.map(bank => {
                        const count = fund.deposits.filter(d => d.bank === bank).length;
                        const isSelected = selectedBank === bank;
                        return (
                            <button
                                key={bank}
                                onClick={() => setSelectedBank(bank)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.625rem 1.25rem',
                                    borderRadius: '0.875rem',
                                    backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                                    border: isSelected ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                                    color: isSelected ? '#ffffff' : '#a1a1aa',
                                    fontSize: '0.75rem',
                                    fontWeight: '800',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    whiteSpace: 'nowrap',
                                    boxShadow: isSelected ? '0 0 15px rgba(16, 185, 129, 0.3)' : 'none'
                                }}
                            >
                                <Building2 size={15} style={{ color: isSelected ? '#34d399' : '#a1a1aa' }} />
                                <span>{bank}</span>
                                <span style={{
                                    backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.6875rem'
                                }}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="fd-glass-panel">
                    <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Principal</p>
                    <p className="font-bold text-2xl tracking-tight">{formatCurrency(totalOriginalAmount)}</p>
                    <p className="text-xs text-gray-600 mt-1">{selectedBank === 'ALL' ? 'Total Capital Invested' : `${selectedBank} Principal`}</p>
                </div>
                <div className="fd-glass-glow-card">
                    <p className="text-emerald-300 text-xs font-black uppercase tracking-widest mb-1">Interest Till Today</p>
                    <p className="font-bold text-2xl tracking-tight text-emerald-400">{formatCurrency(totalInterestAccruedTillNow)}</p>
                    <p className="text-xs text-emerald-500/70 mt-1">Live accrued earnings</p>
                </div>
                <div className="fd-glass-panel">
                    <p className="text-emerald-400/80 text-xs font-black uppercase tracking-widest mb-1">Total Interest (Maturity)</p>
                    <p className="font-bold text-2xl tracking-tight text-emerald-300">{formatCurrency(totalInterest)}</p>
                    <p className="text-xs text-gray-600 mt-1">Expected total returns</p>
                </div>
                <div className="fd-glass-panel">
                    <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Maturity Value</p>
                    <p className="font-bold text-2xl tracking-tight text-white">{formatCurrency(totalMaturityAmount)}</p>
                    <p className="text-xs text-gray-600 mt-1">{selectedBank === 'ALL' ? 'Value on completion' : `${selectedBank} Maturity`}</p>
                </div>
            </div>

            {/* View Mode Switcher Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Building2 size={20} style={{ color: '#34d399' }} /> Active Fixed Deposits ({filteredDeposits.length})
                    </h3>
                    {archivedDeposits.length > 0 && (
                        <span style={{ fontSize: '11px', color: '#fbbf24', backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: '0.2rem 0.6rem', borderRadius: '9999px', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 'bold' }}>
                            +{archivedDeposits.length} Closed ({activeDeposits.length + archivedDeposits.length} Total)
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '0.875rem', padding: '0.25rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <button
                        onClick={() => setViewMode('cards')}
                        style={{
                            padding: '0.4rem 0.875rem',
                            borderRadius: '0.625rem',
                            border: 'none',
                            backgroundColor: viewMode === 'cards' ? '#34d399' : 'transparent',
                            color: viewMode === 'cards' ? '#000000' : '#a1a1aa',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <LayoutGrid size={14} /> Card Grid
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        style={{
                            padding: '0.4rem 0.875rem',
                            borderRadius: '0.625rem',
                            border: 'none',
                            backgroundColor: viewMode === 'table' ? '#34d399' : 'transparent',
                            color: viewMode === 'table' ? '#000000' : '#a1a1aa',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Table size={14} /> Classic Table
                    </button>
                </div>
            </div>

            {viewMode === 'cards' ? (
                /* Card Grid View */
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '2rem'
                }}>
                    {[...filteredDeposits]
                        .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
                        .map((deposit) => {
                            const maturityDate = new Date(deposit.endDate);
                            const today = new Date();
                            const isMatured = today >= maturityDate;
                            const isNearingMaturity = !isMatured && (maturityDate - today) / (1000 * 60 * 60 * 24 * 30.44) <= 2;
                            
                            const { accruedInterest, accruedValue } = getDepositAccruedDetails(deposit);
                            const totalInterest = (deposit.interestTransactions || []).reduce((sum, tx) => sum + (tx.amount || 0), 0) || deposit.interestEarned || 0;
                            const totalTds = (deposit.tdsTransactions || []).reduce((sum, tx) => sum + (tx.amount || 0), 0) || deposit.tds || 0;
                            const progressPct = calculateProgress(deposit.startDate, deposit.endDate);
                            const daysText = getDaysRemainingText(deposit.endDate);

                            return (
                                <div
                                    key={deposit.id}
                                    onClick={() => navigate(`/savings/fixed-deposit/${id}/deposit/${deposit.id}`)}
                                    style={{
                                        backgroundColor: 'rgba(24, 24, 27, 0.6)',
                                        backdropFilter: 'blur(12px)',
                                        border: isMatured 
                                            ? '1px solid rgba(16, 185, 129, 0.4)' 
                                            : isNearingMaturity 
                                                ? '1px solid rgba(245, 158, 11, 0.4)' 
                                                : '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '1.5rem',
                                        padding: '1.5rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        gap: '1.25rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.25s ease',
                                        position: 'relative',
                                        boxShadow: '0 10px 20px -5px rgba(0,0,0,0.4)'
                                    }}
                                    className="hover:border-emerald-500/50 hover:shadow-emerald-500/10 group"
                                >
                                    {/* Top Bank & Status Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '1rem',
                                                backgroundColor: 'rgba(52, 211, 153, 0.15)',
                                                border: '1px solid rgba(52, 211, 153, 0.3)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#34d399'
                                            }}>
                                                <Building2 size={20} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '1.05rem', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.01em' }}>
                                                    {deposit.bank}
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.125rem' }}>
                                                    <span style={{ fontSize: '11px', color: '#818cf8', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                                        A/C: {deposit.accountNo}
                                                    </span>
                                                    {deposit.branchName && (
                                                        <span style={{ fontSize: '10px', color: '#34d399', backgroundColor: 'rgba(52, 211, 153, 0.12)', padding: '0.1rem 0.45rem', borderRadius: '6px', border: '1px solid rgba(52, 211, 153, 0.25)', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                            <MapPin size={10} /> {deposit.branchName}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        <div>
                                            {isMatured ? (
                                                <span style={{
                                                    padding: '0.25rem 0.625rem',
                                                    borderRadius: '9999px',
                                                    fontSize: '9px',
                                                    fontWeight: '900',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                                    color: '#34d399',
                                                    border: '1px solid rgba(16, 185, 129, 0.4)'
                                                }}>
                                                    Matured
                                                </span>
                                            ) : isNearingMaturity ? (
                                                <span style={{
                                                    padding: '0.25rem 0.625rem',
                                                    borderRadius: '9999px',
                                                    fontSize: '9px',
                                                    fontWeight: '900',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                                    color: '#fbbf24',
                                                    border: '1px solid rgba(245, 158, 11, 0.4)'
                                                }} className="animate-pulse">
                                                    Maturing Soon
                                                </span>
                                            ) : (
                                                <span style={{
                                                    padding: '0.25rem 0.625rem',
                                                    borderRadius: '9999px',
                                                    fontSize: '9px',
                                                    fontWeight: '900',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                                    color: '#818cf8',
                                                    border: '1px solid rgba(99, 102, 241, 0.3)'
                                                }}>
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Rate & Daily Interest Tag */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.625rem 0.875rem', borderRadius: '0.875rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                            <Percent size={13} style={{ color: '#34d399' }} />
                                            <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 'bold' }}>Rate:</span>
                                            <span style={{ fontSize: '13px', color: '#34d399', fontWeight: '900', fontFamily: 'monospace' }}>{deposit.interestRate || '—'}% p.a.</span>
                                        </div>
                                        {deposit.bank?.toLowerCase().includes('slice') && (
                                            <span style={{ fontSize: '10px', color: '#c084fc', fontWeight: '900', backgroundColor: 'rgba(192, 132, 252, 0.15)', padding: '0.125rem 0.5rem', borderRadius: '9999px', border: '1px solid rgba(192, 132, 252, 0.3)' }}>
                                                ⚡ Daily Interest
                                            </span>
                                        )}
                                    </div>

                                    {/* Financial Metrics Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.875rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <div>
                                            <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717a', fontWeight: '800', display: 'block', marginBottom: '0.25rem' }}>Principal</span>
                                            <span style={{ fontSize: '0.875rem', fontWeight: '900', color: '#ffffff', fontFamily: 'monospace' }}>{formatCurrency(deposit.originalAmount)}</span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#34d399', fontWeight: '800', display: 'block', marginBottom: '0.25rem' }}>Accrued Int</span>
                                            <span style={{ fontSize: '0.875rem', fontWeight: '900', color: '#34d399', fontFamily: 'monospace' }}>{formatCurrency(accruedInterest)}</span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a1a1aa', fontWeight: '800', display: 'block', marginBottom: '0.25rem' }}>Maturity</span>
                                            <span style={{ fontSize: '0.875rem', fontWeight: '900', color: '#ffffff', fontFamily: 'monospace' }}>{formatCurrency(deposit.maturityAmount)}</span>
                                        </div>
                                    </div>

                                    {/* Duration & Progress Bar */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#a1a1aa' }}>
                                            <span>{formatDate(deposit.startDate)}</span>
                                            <span style={{ color: isMatured ? '#34d399' : (isNearingMaturity ? '#fbbf24' : '#a1a1aa'), fontWeight: 'bold' }}>{daysText}</span>
                                            <span>{formatDate(deposit.endDate)}</span>
                                        </div>
                                        <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${progressPct}%`,
                                                height: '100%',
                                                backgroundColor: isMatured ? '#34d399' : (isNearingMaturity ? '#fbbf24' : '#6366f1'),
                                                borderRadius: '9999px',
                                                transition: 'width 0.3s ease'
                                            }}></div>
                                        </div>
                                    </div>

                                    {/* Dedicated Remarks Note Box */}
                                    {deposit.remarks && (
                                        <div style={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: '0.75rem',
                                            padding: '0.5rem 0.75rem',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '0.5rem'
                                        }}>
                                            <FileText size={13} style={{ color: '#fbbf24', marginTop: '2px', flexShrink: 0 }} />
                                            <span style={{
                                                fontSize: '11px',
                                                color: '#d4d4d8',
                                                lineHeight: '1.4',
                                                fontWeight: '500',
                                                fontStyle: 'italic',
                                                wordBreak: 'break-word'
                                            }}>
                                                "{deposit.remarks}"
                                            </span>
                                        </div>
                                    )}

                                    {/* Card Footer Actions */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {deposit.renewalCount > 0 && (
                                                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#60a5fa', backgroundColor: 'rgba(96, 165, 250, 0.15)', padding: '0.125rem 0.5rem', borderRadius: '9999px', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
                                                    {deposit.renewalCount} Renewals
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }} onClick={(e) => e.stopPropagation()}>
                                            {isMatured && (
                                                <button
                                                    onClick={() => handleRenewDeposit(deposit)}
                                                    style={{ padding: '0.4rem', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'pointer' }}
                                                    title="Renew Deposit"
                                                >
                                                    <RefreshCw size={13} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => { setEditingDeposit(deposit); setIsRenewal(false); setIsModalOpen(true); }}
                                                style={{ padding: '0.4rem', borderRadius: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', cursor: 'pointer' }}
                                                title="Edit Deposit"
                                            >
                                                <Edit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenCloseModal(deposit)}
                                                style={{ padding: '0.4rem', borderRadius: '0.5rem', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', cursor: 'pointer' }}
                                                title="Close / Archive Deposit"
                                            >
                                                <Archive size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteDeposit(deposit.id)}
                                                style={{ padding: '0.4rem', borderRadius: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', cursor: 'pointer' }}
                                                title="Delete Deposit"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    {!filteredDeposits.length && (
                        <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: '#71717a', fontSize: '0.875rem' }}>
                            No active fixed deposits found.
                        </div>
                    )}
                </div>
            ) : (
                /* Classic Table View */
                <div className="fd-table-container">
                    <div style={{ overflowX: 'auto' }}>
                        <table className="fd-table" style={{ minWidth: '1000px' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Account No</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Bank</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Branch</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Rate (%)</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Start Date</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>End Date</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Principal</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Interest (Till Today)</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Interest (Maturity)</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>TDS</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Accrued Value</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Maturity Value</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'left', paddingLeft: '1.5rem' }}>Remarks</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>Renewals</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...filteredDeposits]
                                    .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
                                    .map((deposit) => {
                                        const maturityDate = new Date(deposit.endDate);
                                        const today = new Date();
                                        const isMatured = today >= maturityDate;
                                        const isNearingMaturity = !isMatured && (maturityDate - today) / (1000 * 60 * 60 * 24 * 30.44) <= 2;
                                        
                                        const { accruedInterest, accruedValue } = getDepositAccruedDetails(deposit);
                                        const totalInterest = (deposit.interestTransactions || []).reduce((sum, tx) => sum + (tx.amount || 0), 0) || deposit.interestEarned || 0;
                                        const totalTds = (deposit.tdsTransactions || []).reduce((sum, tx) => sum + (tx.amount || 0), 0) || deposit.tds || 0;

                                        return (
                                            <tr key={deposit.id}
                                                onClick={() => navigate(`/savings/fixed-deposit/${id}/deposit/${deposit.id}`)}
                                                style={{
                                                    cursor: 'pointer',
                                                    backgroundColor: isMatured ? 'rgba(16, 185, 129, 0.04)' : (isNearingMaturity ? 'rgba(234, 179, 8, 0.04)' : 'transparent')
                                                }} className="group">
                                                <td style={{ padding: '1.25rem 1rem', fontFamily: 'monospace', fontWeight: '500' }}>
                                                    <div className="flex flex-col">
                                                        <span>{deposit.accountNo}</span>
                                                        {isMatured ? (
                                                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">Matured</span>
                                                        ) : isNearingMaturity && (
                                                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1 animate-pulse">Maturing Soon</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem', color: '#ffffff' }}>
                                                    <div className="flex flex-col">
                                                        <span>{deposit.bank}</span>
                                                        {deposit.bank?.toLowerCase().includes('slice') && (
                                                            <span className="text-[9px] font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 w-fit mt-1">
                                                                ⚡ Daily Interest
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem', color: '#a1a1aa', fontSize: '13px' }}>
                                                    {deposit.branchName ? (
                                                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                                                            <MapPin size={12} /> {deposit.branchName}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem', fontWeight: 'bold', color: 'var(--text-accent)' }}>{deposit.interestRate || '—'}%</td>
                                                <td style={{ padding: '1.25rem 1rem', color: '#a1a1aa' }}>{formatDate(deposit.startDate)}</td>
                                                <td style={{ padding: '1.25rem 1rem', fontWeight: (isNearingMaturity || isMatured) ? 'bold' : 'normal', color: isMatured ? '#10b981' : (isNearingMaturity ? '#fbbf24' : '#ffffff') }}>{formatDate(deposit.endDate)}</td>
                                                <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: '500' }}>{formatCurrency(deposit.originalAmount)}</td>
                                                <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: '#34d399', fontWeight: '600' }}>{formatCurrency(accruedInterest)}</td>
                                                <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-success)', fontWeight: '500' }}>{formatCurrency(totalInterest)}</td>
                                                <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: '#f87171', fontWeight: '500' }}>{totalTds ? formatCurrency(totalTds) : '-'}</td>
                                                <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: '#a1a1aa', fontWeight: '500' }}>{formatCurrency(accruedValue)}</td>
                                                <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>{formatCurrency(deposit.maturityAmount)}</td>
                                                <td style={{ padding: '1.25rem 1rem', paddingLeft: '1.5rem', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={deposit.remarks}>{deposit.remarks || '—'}</td>
                                                <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                                                    <div className="flex items-center justify-center">
                                                        {deposit.renewalCount > 0 ? (
                                                            <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-black">
                                                                {deposit.renewalCount}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-600 text-xs">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                                                    <div className="flex items-center justify-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                                                        {isMatured && (
                                                            <button
                                                                onClick={() => handleRenewDeposit(deposit)}
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    padding: '0.5rem',
                                                                    borderRadius: '0.625rem',
                                                                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                                                    color: '#34d399',
                                                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                                title="Renew Deposit"
                                                            >
                                                                <RefreshCw size={15} style={{ color: '#34d399' }} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => { setEditingDeposit(deposit); setIsRenewal(false); setIsModalOpen(true); }}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                padding: '0.5rem',
                                                                borderRadius: '0.625rem',
                                                                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                                                color: '#60a5fa',
                                                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                            title="Edit Deposit"
                                                        >
                                                            <Edit2 size={15} style={{ color: '#60a5fa' }} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenCloseModal(deposit)}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                padding: '0.5rem',
                                                                borderRadius: '0.625rem',
                                                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                                                color: '#fbbf24',
                                                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                            title="Close / Archive Deposit"
                                                        >
                                                            <Archive size={15} style={{ color: '#fbbf24' }} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteDeposit(deposit.id)}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                padding: '0.5rem',
                                                                borderRadius: '0.625rem',
                                                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                                                color: '#f87171',
                                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                            title="Delete Deposit"
                                                        >
                                                            <Trash2 size={15} style={{ color: '#f87171' }} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                {!filteredDeposits.length && (
                                    <tr>
                                        <td colSpan="14" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            No active fixed deposits found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Yearly Interest & TDS Combined Summary Section */}
            {combinedFdChartData.length > 0 && (
                <div className="mt-12 bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                            <TrendingUp size={22} className="text-emerald-400" />
                            Yearly Interest Accrual vs TDS Deducted
                        </h3>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                                Total Interest: {formatCurrency(yearlyBreakdown.reduce((sum, item) => sum + item.amount, 0))}
                            </span>
                            {yearlyTdsBreakdown.length > 0 && (
                                <span className="text-xs font-semibold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
                                    Total TDS: {formatCurrency(yearlyTdsBreakdown.reduce((sum, item) => sum + item.amount, 0))}
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={{ width: '100%', height: '320px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={combinedFdChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }} barGap={6} barCategoryGap="25%">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="year" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#e4e4e7' }} />
                                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} tick={{ fill: '#a1a1aa' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#121225', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                                    itemStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                                    formatter={(value, name) => [formatCurrency(value), name === 'interest' ? 'Interest Accrued' : 'TDS Deducted']}
                                    labelStyle={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '4px' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '12px' }} />
                                <Bar dataKey="interest" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={28} name="Interest Accrued" />
                                <Bar dataKey="tds" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={28} name="TDS Deducted" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Archived / Closed Fixed Deposits Section */}
            {archivedDeposits.length > 0 && (
                <div className="mt-10">
                    <button
                        onClick={() => setShowArchived(!showArchived)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '1.25rem 1.5rem',
                            borderRadius: '1rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: '#ffffff',
                            cursor: 'pointer',
                            marginBottom: '1rem'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Archive size={20} style={{ color: '#fbbf24' }} />
                            <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>Archived & Closed Fixed Deposits</span>
                            <span style={{
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                color: '#fbbf24',
                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '9999px',
                                border: '1px solid rgba(245, 158, 11, 0.3)'
                            }}>
                                {archivedDeposits.length}
                            </span>
                        </div>
                        {showArchived ? <ChevronUp size={18} style={{ color: '#a1a1aa' }} /> : <ChevronDown size={18} style={{ color: '#a1a1aa' }} />}
                    </button>

                    {showArchived && (
                        <div className="fd-table-container">
                            <div style={{ overflowX: 'auto' }}>
                                <table className="fd-table" style={{ minWidth: '1000px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Account No</th>
                                            <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Bank</th>
                                            <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Branch</th>
                                            <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Rate (%)</th>
                                            <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Start Date</th>
                                            <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>End Date</th>
                                            <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Principal</th>
                                            <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Final Interest Received</th>
                                            <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Closure Amount</th>
                                            <th style={{ padding: '1.25rem 1rem', textAlign: 'left', paddingLeft: '1.5rem' }}>Closure Remarks</th>
                                            <th style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {archivedDeposits.map((deposit) => {
                                            const { accruedInterest, accruedValue } = getDepositAccruedDetails(deposit);
                                            const finalInterest = deposit.interestEarned ?? accruedInterest;
                                            const finalPayout = deposit.maturityAmount ?? accruedValue;

                                            return (
                                                <tr key={deposit.id} style={{ opacity: 0.8 }}>
                                                    <td style={{ padding: '1.25rem 1rem', fontFamily: 'monospace' }}>{deposit.accountNo}</td>
                                                    <td style={{ padding: '1.25rem 1rem', color: '#ffffff' }}>{deposit.bank}</td>
                                                    <td style={{ padding: '1.25rem 1rem', color: '#a1a1aa' }}>{deposit.branchName || '—'}</td>
                                                    <td style={{ padding: '1.25rem 1rem' }}>{deposit.interestRate}%</td>
                                                    <td style={{ padding: '1.25rem 1rem', color: '#a1a1aa' }}>{formatDate(deposit.startDate)}</td>
                                                    <td style={{ padding: '1.25rem 1rem', color: '#a1a1aa' }}>{formatDate(deposit.endDate)}</td>
                                                    <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(deposit.originalAmount)}</td>
                                                    <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: '#34d399', fontWeight: 'bold' }}>{formatCurrency(finalInterest)}</td>
                                                    <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{formatCurrency(finalPayout)}</td>
                                                    <td style={{ padding: '1.25rem 1rem', paddingLeft: '1.5rem', color: '#a1a1aa' }}>{deposit.remarks || '—'}</td>
                                                    <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                                                        <button
                                                            onClick={() => handleRestoreDeposit(deposit.id)}
                                                            className="p-2 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white transition-all border border-amber-500/20 flex items-center gap-1.5 text-xs font-bold mx-auto"
                                                            title="Restore FD to Active"
                                                        >
                                                            <ArchiveRestore size={14} /> Restore
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <FixedDepositModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setIsRenewal(false); }}
                onSave={handleSaveDeposit}
                initialData={editingDeposit}
                isRenewal={isRenewal}
            />

            <CloseDepositModal
                isOpen={isCloseModalOpen}
                onClose={() => setIsCloseModalOpen(false)}
                onConfirm={handleConfirmCloseModal}
                deposit={closingDeposit}
                calculatedInterest={closingDeposit ? getDepositAccruedDetails(closingDeposit).accruedInterest : 0}
                formatCurrency={formatCurrency}
            />
        </div>
    );
};

export default FixedDepositDetails;
