import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, TrendingDown, Edit2, Trash2, Plus, Settings, RefreshCw, X, Archive, ArchiveRestore, Calculator, BarChart3, Target } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import MutualFundTransactionModal from '../components/MutualFundTransactionModal';
import BackButton from '../components/BackButton';
import MutualFundEditModal from '../components/MutualFundEditModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, ReferenceLine } from 'recharts';
import { recomputeFundUnits } from '../utils/investmentSync';
import FundCompositionModal from '../components/FundCompositionModal';
import FundCompositionPanel from '../components/FundCompositionPanel';
import FundUnitBreakdown from '../components/FundUnitBreakdown';

const MutualFundDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem, refreshMutualFundNAV, calculateItemCurrentValue, calculateItemInvestedValue, addItem, deleteItem } = useFinance();

    // State for modals
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);

    const [isFundEditModalOpen, setIsFundEditModalOpen] = useState(false);
    const [isCompositionModalOpen, setIsCompositionModalOpen] = useState(false);
    // These two lived below the `if (!fund) return` further down, so on a direct
    // page load — where `savings` is still empty and that early return fires —
    // React saw fewer hooks on the first render than the second and crashed the
    // page with "Rendered more hooks than during the previous render". Every
    // hook has to run on every render, so they belong above any early return.
    const [selectedYear, setSelectedYear] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [plannedAmount, setPlannedAmount] = useState('');
    const [targetNav, setTargetNav] = useState('');
    const [refreshMessage, setRefreshMessage] = useState({ type: '', text: '' });

    const fund = savings.find(s => s.id.toString() === id);

    // Spread the fund, never rebuild it — the write guard refuses a payload that
    // drops the transactions this record carries, and rightly so.
    const handleSaveComposition = async (composition) => {
        if (!fund) return;
        await updateItem('savings', { ...fund, composition });
        setIsCompositionModalOpen(false);
    };

    const currentNav = fund ? (fund.currentNav || 0) : 0;

    // --- Unit-based Accounting (Centralized Logic with useMemo) ---
    const fundCalcs = useMemo(() => {
        if (!fund) {
            return {
                currentTotalValue: 0,
                total_cost_held: 0,
                total_unrealised_profit: 0,
                transactionsWithCalcs: [],
                total_units_held: 0,
                avgNav: 0,
                total_realised_profit: 0,
                total_profit: 0
            };
        }

        const currentTotalValue = calculateItemCurrentValue(fund);
        const total_cost_held = calculateItemInvestedValue(fund);
        const total_unrealised_profit = currentTotalValue - total_cost_held;

        let runningUnits = 0;
        let runningCost = 0;
        let transactionsWithCalcs = [];

        if (fund.transactions) {
            const sortedTransactions = [...fund.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

            transactionsWithCalcs = sortedTransactions.map(tx => {
                const isSell = tx.type === 'sell' || tx.type === 'withdraw';
                const txAmount = Number(tx.amount);
                const txUnits = Number(tx.units);

                if (isSell) {
                    const average_cost_per_unit = runningUnits > 0 ? runningCost / runningUnits : 0;
                    const cost_of_units_sold = txUnits * average_cost_per_unit;
                    const realized_for_tx = txAmount - cost_of_units_sold;

                    runningUnits -= txUnits;
                    runningCost -= cost_of_units_sold;
                    // Guard against going negative due to out-of-order data
                    if (runningUnits < 0) runningUnits = 0;
                    if (runningCost < 0) runningCost = 0;

                    return {
                        ...tx,
                        isSell: true,
                        displayAmount: txAmount,
                        displayUnits: -txUnits,
                        displayValue: txAmount,
                        displayPL: realized_for_tx,
                    };
                } else {
                    runningUnits += txUnits;
                    runningCost += txAmount;
                    const currentVal = txUnits * currentNav;
                    return {
                        ...tx,
                        isSell: false,
                        displayAmount: txAmount,
                        displayUnits: txUnits,
                        displayValue: currentVal,
                        displayPL: currentVal - txAmount,
                    };
                }
            });
        }

        const total_units_held = runningUnits;
        const avgNav = total_units_held > 0 ? (runningCost / total_units_held) : 0;
        const total_realised_profit = transactionsWithCalcs.filter(tx => tx.isSell).reduce((sum, tx) => sum + tx.displayPL, 0);
        const total_profit = total_unrealised_profit + total_realised_profit;

        return {
            currentTotalValue,
            total_cost_held,
            total_unrealised_profit,
            transactionsWithCalcs,
            total_units_held,
            avgNav,
            total_realised_profit,
            total_profit
        };
    }, [fund, currentNav, calculateItemCurrentValue, calculateItemInvestedValue]);

    const {
        currentTotalValue,
        total_cost_held,
        total_unrealised_profit,
        transactionsWithCalcs,
        total_units_held,
        avgNav,
        total_realised_profit,
        total_profit
    } = fundCalcs;

    /**
     * What one more purchase would do to the average.
     *
     * Units are bought at today's NAV, so the new average is the old cost plus
     * this amount, over the old units plus what it buys. Buying below the
     * average pulls it down and buying above pushes it up — the point of the
     * panel is to show by how much before the money moves, not after.
     */
    const navProjection = useMemo(() => {
        const amount = Number(plannedAmount);
        if (!Number.isFinite(amount) || amount <= 0 || currentNav <= 0) return null;
        const unitsGained = amount / currentNav;
        const newUnits = total_units_held + unitsGained;
        const newAvgNav = newUnits > 0 ? ((avgNav * total_units_held) + amount) / newUnits : 0;
        return {
            amount,
            unitsGained,
            newUnits,
            newAvgNav,
            change: newAvgNav - avgNav,
            costPerUnit: currentNav,
        };
    }, [plannedAmount, currentNav, total_units_held, avgNav]);

    /**
     * What the position is worth if the NAV reaches a given figure.
     *
     * Measured against what the held units actually cost, so this is profit on
     * the money at risk rather than a move in the NAV. When an amount has been
     * entered above, it is counted in: more units at today's price changes both
     * the cost and the break-even, and answering this on the old position would
     * describe a holding the user is in the middle of leaving behind.
     */
    const targetProjection = useMemo(() => {
        const target = Number(targetNav);
        if (!Number.isFinite(target) || target <= 0) return null;

        const units = navProjection ? navProjection.newUnits : total_units_held;
        const cost = (avgNav * total_units_held) + (navProjection ? navProjection.amount : 0);
        if (units <= 0) return null;

        const value = units * target;
        const profit = value - cost;
        return {
            target,
            units,
            cost,
            value,
            profit,
            percent: cost > 0 ? (profit / cost) * 100 : 0,
            // The NAV at which the position is square — the average, restated.
            breakEven: cost / units,
            includesPlanned: !!navProjection,
        };
    }, [targetNav, navProjection, total_units_held, avgNav]);

    /**
     * How the money already invested is spread across NAV levels.
     *
     * Answers "did I accumulate cheap or expensive", which a date-ordered list
     * of purchases cannot: the same fund bought thirty times tells you nothing
     * until the amounts are grouped by the price they were paid at. Buys only —
     * a redemption returns money at a NAV rather than committing it.
     */
    const navDistribution = useMemo(() => {
        const buys = (fund?.transactions || []).filter((t) => {
            const type = t.type || (t.remarks && t.remarks.toLowerCase().includes('sip') ? 'sip' : 'buy');
            return (type === 'buy' || type === 'sip') && Number(t.nav) > 0 && Number(t.amount) > 0;
        });
        if (buys.length < 2) return [];

        const navs = buys.map((t) => Number(t.nav));
        const min = Math.min(...navs);
        const max = Math.max(...navs);
        if (!(max > min)) return [];

        // Ten bands, or one per purchase when there are fewer — enough shape to
        // read, without slicing a handful of SIPs into mostly-empty columns.
        const bands = Math.max(3, Math.min(10, buys.length));
        const width = (max - min) / bands;
        const buckets = Array.from({ length: bands }, (_, i) => ({
            from: min + (i * width),
            to: min + ((i + 1) * width),
            amount: 0,
            units: 0,
            count: 0,
        }));

        buys.forEach((t) => {
            const nav = Number(t.nav);
            // The top band is closed so the highest purchase lands inside it.
            const i = Math.min(bands - 1, Math.floor((nav - min) / width));
            buckets[i].amount += Number(t.amount) || 0;
            buckets[i].units += Number(t.units) || 0;
            buckets[i].count += 1;
        });

        return buckets
            .filter((b) => b.count > 0)
            .map((b) => ({
                ...b,
                label: `${b.from.toFixed(1)}–${b.to.toFixed(1)}`,
                belowAverage: ((b.from + b.to) / 2) < avgNav,
            }));
    }, [fund, avgNav]);

    const itemsPerPage = 8;

    const getFinancialYear = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const month = date.getMonth();
        const year = date.getFullYear();
        if (month >= 3) { // April onwards
            return `${year}-${(year + 1).toString().slice(-2)}`;
        } else {
            return `${year - 1}-${year.toString().slice(-2)}`;
        }
    };

    const availableYears = useMemo(() => {
        if (!transactionsWithCalcs.length) return ['All'];
        const yearsSet = new Set(transactionsWithCalcs.map(tx => getFinancialYear(tx.date)).filter(Boolean));
        return ['All', ...Array.from(yearsSet).sort((a, b) => b.localeCompare(a))];
    }, [transactionsWithCalcs]);

    const filteredTransactions = useMemo(() => {
        const sorted = [...transactionsWithCalcs].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (selectedYear === 'All') return sorted;
        return sorted.filter(tx => getFinancialYear(tx.date) === selectedYear);
    }, [transactionsWithCalcs, selectedYear]);

    const totalPages = useMemo(() => Math.ceil(filteredTransactions.length / itemsPerPage) || 1, [filteredTransactions, itemsPerPage]);

    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredTransactions.slice(start, start + itemsPerPage);
    }, [filteredTransactions, currentPage, itemsPerPage]);

    const handleYearChange = (year) => {
        setSelectedYear(year);
        setCurrentPage(1);
    };

    const yearlyPLChartData = useMemo(() => {
        if (!transactionsWithCalcs.length) return [];

        const yearlyMap = {};

        transactionsWithCalcs.forEach(tx => {
            const year = getFinancialYear(tx.date) || new Date(tx.date).getFullYear().toString();
            if (!yearlyMap[year]) {
                yearlyMap[year] = { year, realizedPL: 0, unrealizedPL: 0, totalPL: 0 };
            }

            if (tx.isSell) {
                yearlyMap[year].realizedPL += (tx.displayPL || 0);
            } else {
                yearlyMap[year].unrealizedPL += (tx.displayPL || 0);
            }
            yearlyMap[year].totalPL += (tx.displayPL || 0);
        });

        return Object.values(yearlyMap)
            .map(item => ({
                ...item,
                realizedPL: Math.round(item.realizedPL),
                unrealizedPL: Math.round(item.unrealizedPL),
                totalPL: Math.round(item.totalPL)
            }))
            .sort((a, b) => a.year.localeCompare(b.year));
    }, [transactionsWithCalcs]);

    const handleRefreshNav = async () => {
        setIsRefreshing(true);
        setRefreshMessage({ type: '', text: '' });
        const result = await refreshMutualFundNAV(id);
        setIsRefreshing(false);
        if (result.success) {
            setRefreshMessage({ type: 'success', text: `NAV updated to ${result.nav}!` });
            setTimeout(() => setRefreshMessage({ type: '', text: '' }), 3000);
        } else {
            setRefreshMessage({ type: 'error', text: result.message || 'Failed to refresh NAV' });
            setTimeout(() => setRefreshMessage({ type: '', text: '' }), 5000);
        }
    };

    // --- Transaction Handlers ---
    const handleSaveTransaction = (tx) => {
        let updatedTransactions = fund.transactions ? [...fund.transactions] : [];

        if (editingTx) {
            // Edit existing
            updatedTransactions = updatedTransactions.map(t => t.id === tx.id ? tx : t);
        } else {
            // Add new
            updatedTransactions.push(tx);
        }

        updatedTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Shared with the expenses-page sync so both produce the same holding.
        const newAmount = recomputeFundUnits(updatedTransactions) * (fund.currentNav || 0);

        updateItem('savings', { ...fund, transactions: updatedTransactions, amount: newAmount });
        setEditingTx(null);
        setIsTxModalOpen(false);
    };

    const handleDeleteTransaction = (txId) => {
        if (window.confirm('Delete this transaction?')) {
            const updatedTransactions = fund.transactions.filter(t => t.id !== txId);
            const updatedFund = { ...fund, transactions: updatedTransactions };
            updatedFund.amount = calculateItemCurrentValue(updatedFund);
            updateItem('savings', updatedFund);
        }
    };

    const handleEditFundDetails = (updatedFund) => {
        const finalFund = { ...updatedFund };
        finalFund.amount = calculateItemCurrentValue(finalFund);
        updateItem('savings', finalFund);
        setIsFundEditModalOpen(false);
    };

    const handleToggleArchive = () => {
        const action = fund.isArchived ? 'unarchive' : 'archive';
        if (window.confirm(`Are you sure you want to ${action} this fund? Archived funds are hidden from your main dashboard but retain their data.`)) {
            updateItem('savings', { ...fund, isArchived: !fund.isArchived });
        }
    };

    // Below every hook, deliberately.
    //
    // This guard used to sit above five useMemo calls and two useState calls.
    // On a direct page load `savings` is still empty, so the first render took
    // this branch and ran seven fewer hooks than the second — React refuses
    // that, and the page died with "Rendered more hooks than during the
    // previous render" on every refresh. Hooks must run unconditionally; the
    // early exit belongs here, where nothing follows it but the render.
    if (!fund) {
        return (
            <div style={{ padding: 'var(--spacing-lg)' }}>
                <p>Mutual Fund not found.</p>
                <button
                    onClick={() => navigate(-1)}
                    className="text-primary hover:underline mt-4"
                >
                    Back to Savings
                </button>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }} className="animate-fade-in">
            {/* Custom Styles Injection */}
            <style>{`
                .mf-glass-panel {
                    background: rgba(10, 11, 20, 0.45) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(99, 102, 241, 0.15) !important;
                    border-radius: 1.5rem !important;
                    padding: 1.5rem !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 20px 1px rgba(99, 102, 241, 0.05) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .mf-glass-panel:hover {
                    transform: translateY(-4px) !important;
                    border-color: rgba(99, 102, 241, 0.35) !important;
                    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px 2px rgba(99, 102, 241, 0.15) !important;
                }
                .mf-glass-glow-card {
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(10, 11, 20, 0.5) 100%) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(99, 102, 241, 0.25) !important;
                    border-radius: 1.5rem !important;
                    padding: 1.5rem !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6), 0 0 25px 2px rgba(99, 102, 241, 0.1) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .mf-glass-glow-card:hover {
                    transform: translateY(-4px) !important;
                    border-color: rgba(99, 102, 241, 0.5) !important;
                    box-shadow: 0 20px 45px -15px rgba(0, 0, 0, 0.8), 0 0 35px 3px rgba(99, 102, 241, 0.25) !important;
                }
                .mf-table-container {
                    background: rgba(10, 11, 20, 0.35) !important;
                    backdrop-filter: blur(12px) !important;
                    -webkit-backdrop-filter: blur(12px) !important;
                    border-radius: 1.5rem !important;
                    border: 1px solid rgba(255, 255, 255, 0.05) !important;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.4) !important;
                    overflow: hidden !important;
                    margin-top: 2rem !important;
                }
                .mf-table {
                    width: 100%;
                    border-collapse: separate !important;
                    border-spacing: 0 !important;
                }
                .mf-table th {
                    background-color: rgba(255, 255, 255, 0.02) !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                    color: rgba(255, 255, 255, 0.5) !important;
                    font-weight: 700 !important;
                    font-size: 0.75rem !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                }
                .mf-table td {
                    border-bottom: 1px solid rgba(255, 255, 255, 0.03) !important;
                    transition: all 0.2s ease !important;
                }
                .mf-table tr:last-child td {
                    border-bottom: none !important;
                }
                .mf-table tr:hover td {
                    background-color: rgba(99, 102, 241, 0.04) !important;
                    color: #ffffff !important;
                }
            `}</style>

            <BackButton label="Back to Investments" />

            <div className="mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
                                {fund.title}
                            </h2>
                            <button
                                onClick={() => setIsFundEditModalOpen(true)}
                                className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                title="Edit Fund Details (NAV, Name)"
                            >
                                <Settings size={18} />
                            </button>
                        </div>
                        <p className="text-gray-500 text-sm mt-1">Folio: {fund.folioNumber || 'N/A'}</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleToggleArchive}
                            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm ${fund.isArchived ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/20' : 'bg-white/5 hover:bg-white/10 text-gray-300'} border border-white/5`}
                            title={fund.isArchived ? "Unarchive this fund" : "Archive this fund"}
                        >
                            {fund.isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                            <span>{fund.isArchived ? 'Unarchive' : 'Archive'}</span>
                        </button>

                        <button
                            onClick={handleRefreshNav}
                            disabled={isRefreshing}
                            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm ${isRefreshing ? 'bg-gray-700 cursor-not-allowed text-gray-400' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20'}`}
                        >
                            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                            <span>{isRefreshing ? 'Refreshing...' : 'Refresh NAV'}</span>
                        </button>

                        <button
                            onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 text-sm transition-all shadow-lg shadow-indigo-500/25"
                        >
                            <Plus size={18} />
                            Add Transaction
                        </button>
                    </div>
                </div>

                {refreshMessage.text && (
                    <div style={{
                        position: 'fixed',
                        top: '80px',
                        right: '2rem',
                        padding: '1rem 1.5rem',
                        borderRadius: '12px',
                        backgroundColor: refreshMessage.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        zIndex: 100,
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        {refreshMessage.type === 'success' ? <TrendingUp size={20} /> : <X size={20} onClick={() => setRefreshMessage({ type: '', text: '' })} style={{ cursor: 'pointer' }} />}
                        <span className="font-medium">{refreshMessage.text}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    <div className="mf-glass-panel">
                        <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Invested (Net)</p>
                        <p className="font-bold text-2xl tracking-tight">{formatCurrency(total_cost_held)}</p>
                        <p className="text-xs text-gray-600 mt-1">Active Capital</p>
                    </div>
                    <div className="mf-glass-glow-card">
                        <p className="text-indigo-300 text-xs font-black uppercase tracking-widest mb-1">Current Value</p>
                        <p className="font-bold text-2xl tracking-tight text-white">{formatCurrency(currentTotalValue)}</p>
                        <p className="text-xs text-indigo-400/70 mt-1">Valued at Current NAV</p>
                    </div>
                    <div className="mf-glass-panel">
                        <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Profit (All Time)</p>
                        <div className={`font-bold text-2xl tracking-tight flex items-center gap-2 ${total_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                            {total_profit >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
                            {formatCurrency(Math.abs(total_profit))}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Realized + Unrealized</p>
                    </div>
                    <div className="mf-glass-panel">
                        <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Unrealized P/L</p>
                        <div className={`font-bold text-2xl tracking-tight flex items-center gap-2 ${total_unrealised_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                            {total_unrealised_profit >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
                            {formatCurrency(Math.abs(total_unrealised_profit))}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Paper Profits</p>
                    </div>
                    <div className="mf-glass-panel">
                        <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Realized P/L (Booked)</p>
                        <div className={`font-bold text-2xl tracking-tight flex items-center gap-2 ${total_realised_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                            {total_realised_profit >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
                            {formatCurrency(Math.abs(total_realised_profit))}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Booked Profit/Loss</p>
                    </div>
                    <div className="mf-glass-panel">
                        <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Total Units Held</p>
                        <p className="font-mono font-bold text-2xl tracking-tight">{total_units_held.toFixed(3)}</p>
                        <p className="text-xs text-gray-600 mt-1">Accumulated units</p>
                    </div>
                    <div className="mf-glass-panel cursor-pointer" onClick={() => setIsFundEditModalOpen(true)}>
                        <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Average Cost (NAV)</p>
                        <p className="font-mono font-bold text-2xl tracking-tight">{avgNav.toFixed(4)}</p>
                        <p className="text-xs text-gray-600 mt-1">Weighted Average</p>
                    </div>
                    <div className="mf-glass-panel cursor-pointer" onClick={() => setIsFundEditModalOpen(true)}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">Current NAV</p>
                                <p className="font-mono font-bold text-2xl tracking-tight">{currentNav.toFixed(4)}</p>
                            </div>
                            <Edit2 size={16} className="text-indigo-400" />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Click to edit manually</p>
                    </div>
                </div>
            </div>

            {/* What another purchase would do to the average */}
            <div className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="mf-glass-panel">
                    <div className="flex items-center gap-2 mb-1">
                        <Calculator size={18} className="text-indigo-400" />
                        <h3 className="text-base font-black tracking-tight m-0">If I invest more today</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                        At today's NAV of {currentNav.toFixed(4)}. Nothing is saved — this only works out the effect.
                    </p>

                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Amount to invest</label>
                    <div className="relative mt-1.5 mb-4">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
                        <input
                            type="number"
                            min="0"
                            step="100"
                            value={plannedAmount}
                            onChange={(e) => setPlannedAmount(e.target.value)}
                            placeholder="10000"
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm font-bold font-mono text-white focus:border-indigo-500/50 focus:outline-none"
                        />
                    </div>

                    {navProjection ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Units you'd get</p>
                                    <p className="font-mono font-bold text-xl">{navProjection.unitsGained.toFixed(3)}</p>
                                    <p className="text-[10px] text-gray-600 mt-0.5">at ₹{navProjection.costPerUnit.toFixed(4)} each</p>
                                </div>
                                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Units after</p>
                                    <p className="font-mono font-bold text-xl">{navProjection.newUnits.toFixed(3)}</p>
                                    <p className="text-[10px] text-gray-600 mt-0.5">from {total_units_held.toFixed(3)}</p>
                                </div>
                            </div>
                            <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">New average NAV</p>
                                <div className="flex items-baseline gap-2 flex-wrap">
                                    <p className="font-mono font-bold text-2xl">{navProjection.newAvgNav.toFixed(4)}</p>
                                    <span className={`font-mono text-xs font-bold ${navProjection.change <= 0 ? 'text-success' : 'text-danger'}`}>
                                        {navProjection.change <= 0 ? '▼' : '▲'} {Math.abs(navProjection.change).toFixed(4)}
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1">
                                    {navProjection.change <= 0
                                        ? `Today's NAV is below your average of ${avgNav.toFixed(4)}, so this pulls it down.`
                                        : `Today's NAV is above your average of ${avgNav.toFixed(4)}, so this pushes it up.`}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-gray-600">Enter an amount to see the effect on your average.</p>
                    )}

                    <div className="mt-5 pt-5 border-t border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                            <Target size={16} className="text-amber-400" />
                            <h4 className="text-sm font-black tracking-tight m-0">If the NAV reaches…</h4>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                            Break-even is {targetProjection ? targetProjection.breakEven.toFixed(4) : avgNav.toFixed(4)}
                            {targetProjection?.includesPlanned ? ' with the amount above included.' : ' — your average cost.'}
                        </p>

                        <div className="relative mb-4">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={targetNav}
                                onChange={(e) => setTargetNav(e.target.value)}
                                placeholder={(currentNav * 1.1).toFixed(2)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm font-bold font-mono text-white focus:border-amber-500/50 focus:outline-none"
                            />
                        </div>

                        {targetProjection ? (
                            <div className={`rounded-xl p-3 border ${targetProjection.profit >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${targetProjection.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                    {targetProjection.profit >= 0 ? 'Profit' : 'Loss'} at {targetProjection.target.toFixed(4)}
                                </p>
                                <div className="flex items-baseline gap-2 flex-wrap">
                                    <p className={`font-mono font-bold text-2xl ${targetProjection.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {targetProjection.profit >= 0 ? '+' : '−'}{formatCurrency(Math.abs(targetProjection.profit))}
                                    </p>
                                    <span className={`font-mono text-xs font-bold ${targetProjection.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {targetProjection.percent >= 0 ? '+' : ''}{targetProjection.percent.toFixed(2)}%
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1">
                                    {targetProjection.units.toFixed(3)} units worth {formatCurrency(targetProjection.value)}, against {formatCurrency(targetProjection.cost)} put in.
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-600">Enter a NAV to see the profit or loss at that level.</p>
                        )}
                    </div>
                </div>

                {/* Where the money actually went in */}
                <div className="mf-glass-panel">
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart3 size={18} className="text-emerald-400" />
                        <h3 className="text-base font-black tracking-tight m-0">Invested by NAV level</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                        {navDistribution.length > 0
                            ? `Green is bought below your ${avgNav.toFixed(2)} average, amber above it.`
                            : 'Needs at least two purchases at different NAVs.'}
                    </p>

                    {navDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={navDistribution} margin={{ top: 4, right: 4, left: -12, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={52} />
                                <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                                <Tooltip
                                    // No hover cursor at all. Recharts paints the whole band
                                    // full-height, which made the smallest purchase read as the
                                    // tallest bar; dimming it still left a grey slab over the data.
                                    // The tooltip already names the band it is describing.
                                    cursor={false}
                                    // Pinned to the top of the plot rather than floating by the
                                    // pointer. Bars grow upward from the baseline, so a box that
                                    // follows the mouse sits squarely over the tallest ones — the
                                    // reader loses the column they are hovering to read.
                                    position={{ y: 0 }}
                                    allowEscapeViewBox={{ x: false, y: true }}
                                    contentStyle={{ background: 'rgba(24,24,27,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '0.6rem', fontSize: '11px', padding: '6px 10px' }}
                                    separator=" "
                                    formatter={(value, _n, item) => [
                                        `${formatCurrency(value)} · ${item.payload.units.toFixed(3)} units · ${item.payload.count} buy${item.payload.count > 1 ? 's' : ''}`,
                                        'Invested',
                                    ]}
                                    labelFormatter={(l) => `NAV ${l}`}
                                />
                                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                    {navDistribution.map((b, i) => (
                                        <Cell key={i} fill={b.belowAverage ? '#34d399' : '#fbbf24'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[240px] flex items-center justify-center text-xs text-gray-600">
                            Not enough purchase history to chart.
                        </div>
                    )}
                </div>
            </div>

            {/* Year-Wise Profit / Loss Bar Chart */}
            {yearlyPLChartData.length > 0 && (
                <div style={{
                    marginBottom: '2.5rem',
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderRadius: '1.25rem',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '1.5rem',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={22} style={{ color: '#34d399' }} />
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', margin: 0, letterSpacing: '-0.01em' }}>
                                Yearly Profit / Loss Breakdown
                            </h3>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{
                                fontSize: '11px',
                                fontWeight: '800',
                                color: total_profit >= 0 ? '#34d399' : '#f87171',
                                backgroundColor: total_profit >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                padding: '0.35rem 0.85rem',
                                borderRadius: '9999px',
                                border: total_profit >= 0 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                            }}>
                                Total P/L: {formatCurrency(total_profit)}
                            </span>
                        </div>
                    </div>

                    <div style={{ width: '100%', height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={yearlyPLChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="year" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#e4e4e7' }} />
                                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val >= 1000 || val <= -1000 ? (val/1000).toFixed(0) + 'k' : val}`} tick={{ fill: '#a1a1aa' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#121225', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                                    itemStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                                    formatter={(value) => [formatCurrency(value), 'Net Profit / Loss']}
                                    labelStyle={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '4px' }}
                                    // Same reason as the NAV chart above: the band is painted
                                    // full-height over the plot and reads as a bar of its own.
                                    cursor={false}
                                />
                                <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                                <Bar dataKey="totalPL" radius={[6, 6, 0, 0]} maxBarSize={45} name="Net Profit / Loss">
                                    {yearlyPLChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.totalPL >= 0 ? '#34d399' : '#f87171'} opacity={0.9} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <FundCompositionPanel
                fund={fund}
                fundValue={fundCalcs.currentTotalValue}
                formatCurrency={formatCurrency}
                onEdit={() => setIsCompositionModalOpen(true)}
            />

            <FundUnitBreakdown
                fund={fund}
                units={total_units_held}
                nav={currentNav}
                fundValue={fundCalcs.currentTotalValue}
                formatCurrency={formatCurrency}
            />

            <div className="mf-table-container">
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a1a1aa', marginRight: '0.5rem' }}>
                            Filter Year:
                        </span>
                        {availableYears.map(year => (
                            <button
                                key={year}
                                onClick={() => handleYearChange(year)}
                                style={{
                                    padding: '0.375rem 0.875rem',
                                    borderRadius: '0.5rem',
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    border: selectedYear === year ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.08)',
                                    backgroundColor: selectedYear === year ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                    color: selectedYear === year ? '#818cf8' : '#a1a1aa',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {year === 'All' ? 'All Years' : `FY ${year}`}
                            </button>
                        ))}
                    </div>

                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#71717a' }}>
                        {filteredTransactions.length} {filteredTransactions.length === 1 ? 'Transaction' : 'Transactions'}
                    </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="mf-table">
                        <thead>
                            <tr>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Date</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left' }}>Type</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Amount</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>NAV</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Units</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>Value</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>P/L</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left', paddingLeft: '2rem' }}>Remarks</th>
                                <th style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedTransactions.map((tx, index) => {
                                const isProfit = tx.displayPL >= 0;

                                return (
                                    <tr key={index} className="group">
                                        <td style={{ padding: '1.25rem 1rem', color: 'var(--text-primary)' }}>{formatDate(tx.date)}</td>
                                        <td style={{ padding: '1.25rem 1rem' }}>
                                            <span style={{
                                                color: tx.isSell ? 'var(--color-danger)' : 'var(--color-success)',
                                                backgroundColor: tx.isSell ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '0.7rem',
                                                fontWeight: '900',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em'
                                            }}>
                                                {tx.type === 'sip' ? 'SIP' : (tx.isSell ? 'Sell' : 'Buy')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: '500' }}>{formatCurrency(tx.displayAmount)}</td>
                                        <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: '#a1a1aa' }}>{tx.nav}</td>
                                        <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: '500', color: tx.isSell ? 'var(--color-danger)' : '#ffffff' }}>{tx.displayUnits.toFixed(3)}</td>
                                        <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: '500' }}>{formatCurrency(tx.displayValue)}</td>
                                        <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: isProfit ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: '500' }}>
                                            {tx.isSell ? (
                                                <span className="text-gray-500">-</span>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1">
                                                    {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                    {formatCurrency(Math.abs(tx.displayPL))}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '1.25rem 1rem', paddingLeft: '2rem', color: 'var(--text-secondary)' }}>{tx.remarks || '-'}</td>
                                        <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingTx(tx); setIsTxModalOpen(true); }}
                                                    className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTransaction(tx.id)}
                                                    className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!paginatedTransactions.length && (
                                <tr>
                                    <td colSpan="9" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No transactions found for the selected period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredTransactions.length > itemsPerPage && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'space-between',
                        padding: '1rem 1.5rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#71717a' }}>
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                style={{
                                    padding: '0.4rem 0.875rem',
                                    borderRadius: '0.5rem',
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    backgroundColor: currentPage === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
                                    color: currentPage === 1 ? '#52525b' : '#ffffff',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Previous
                            </button>

                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        style={{
                                            width: '2rem',
                                            height: '2rem',
                                            borderRadius: '0.5rem',
                                            fontSize: '11px',
                                            fontWeight: '800',
                                            border: 'none',
                                            cursor: 'pointer',
                                            backgroundColor: currentPage === i + 1 ? '#6366f1' : 'transparent',
                                            color: currentPage === i + 1 ? 'white' : '#71717a',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                style={{
                                    padding: '0.4rem 0.875rem',
                                    borderRadius: '0.5rem',
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    backgroundColor: currentPage === totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
                                    color: currentPage === totalPages ? '#52525b' : '#ffffff',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <MutualFundTransactionModal
                isOpen={isTxModalOpen}
                onClose={() => { setIsTxModalOpen(false); setEditingTx(null); }}
                onSave={handleSaveTransaction}
                initialData={editingTx}
            />

            <FundCompositionModal
                isOpen={isCompositionModalOpen}
                onClose={() => setIsCompositionModalOpen(false)}
                onSave={handleSaveComposition}
                fund={fund}
            />

            <MutualFundEditModal
                isOpen={isFundEditModalOpen}
                onClose={() => setIsFundEditModalOpen(false)}
                onSave={handleEditFundDetails}
                fund={fund}
            />
        </div>
    );
};

export default MutualFundDetails;
