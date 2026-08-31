import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, Plus, Edit2, Trash2, X, Save, TrendingDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { formatDate } from '../utils/dateUtils';
import StockTransactionModal from '../components/StockTransactionModal';
import BackButton from '../components/BackButton';
import ConfirmModal from '../components/ConfirmModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { recomputeStockMetrics } from '../utils/investmentSync';
import { costRecovery, NEARLY_FREE_FROM } from '../utils/costRecovery';
import { dividendProfile } from '../utils/dividendAnalytics';

const StockDetails = () => {
    const { id, stockId } = useParams();
    const navigate = useNavigate();
    const { savings, updateItem, formatCurrency } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [isEditStockModalOpen, setIsEditStockModalOpen] = useState(false);
    const [editingDividend, setEditingDividend] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [txToDelete, setTxToDelete] = useState(null);

    // Find Market and Stock
    const market = useMemo(() => savings.find(s => s.id.toString() === id), [savings, id]);
    const stock = useMemo(() => market?.stocks?.find(s => s.id.toString() === stockId), [market, stockId]);

    const transactions = useMemo(() => stock?.transactions || [], [stock]);

    // Synthetic Initial Transaction for Legacy Data
    const effectiveTransactions = useMemo(() => {
        const txList = [...transactions];
        if (txList.length === 0 && stock?.shares > 0) {
            txList.push({
                id: 'synthetic-initial',
                date: '2020-01-01', // Fallback date
                type: 'buy',
                quantity: Number(stock.shares),
                price: Number(stock.avgPrice ?? stock.avgCost ?? 0),
                remarks: 'Initial Balance (Legacy Data)'
            });
        }
        return txList;
    }, [transactions, stock]);

    // Sorting transactions by date descending
    const sortedTransactions = useMemo(() => {
        return [...effectiveTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [effectiveTransactions]);

    const [selectedYear, setSelectedYear] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
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
        if (!effectiveTransactions.length) return ['All'];
        const yearsSet = new Set(effectiveTransactions.map(tx => getFinancialYear(tx.date)).filter(Boolean));
        return ['All', ...Array.from(yearsSet).sort((a, b) => b.localeCompare(a))];
    }, [effectiveTransactions]);

    const filteredTransactions = useMemo(() => {
        const sorted = [...effectiveTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (selectedYear === 'All') return sorted;
        return sorted.filter(tx => getFinancialYear(tx.date) === selectedYear);
    }, [effectiveTransactions, selectedYear]);

    const totalPages = useMemo(() => Math.ceil(filteredTransactions.length / itemsPerPage) || 1, [filteredTransactions, itemsPerPage]);

    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredTransactions.slice(start, start + itemsPerPage);
    }, [filteredTransactions, currentPage, itemsPerPage]);

    const handleYearChange = (year) => {
        setSelectedYear(year);
        setCurrentPage(1);
    };

    // The formula itself lives in utils/investmentSync so that logging a
    // purchase from the expenses page recomputes this holding exactly the way
    // this page does. Two copies had already drifted apart once.
    const recalculateStockMetrics = recomputeStockMetrics;

    const handleSaveTransaction = async (txData) => {
        const updatedTransactions = editingTx
            ? transactions.map(t => t.id === txData.id ? txData : t)
            : [...transactions, { ...txData, id: Date.now().toString() }];

        const { shares, avgCost, dividends } = recalculateStockMetrics(updatedTransactions);

        const updatedStocks = market.stocks.map(s => {
            if (s.id.toString() === stockId) {
                return {
                    ...s,
                    transactions: updatedTransactions,
                    shares,
                    // Persist as avgPrice to match every existing record.
                    avgPrice: avgCost,
                    dividends: { ...s.dividends, ...dividends }
                };
            }
            return s;
        });

        const updatedMarket = { ...market, stocks: updatedStocks };
        await updateItem('savings', updatedMarket);
        setIsModalOpen(false);
        setEditingTx(null);
    };

    const handleDeleteTransaction = async (txId) => {
        setTxToDelete(txId);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteTransaction = async () => {
        if (!txToDelete) return;
        const updatedTransactions = transactions.filter(t => String(t.id) !== String(txToDelete));

        const { shares, avgCost, dividends } = recalculateStockMetrics(updatedTransactions);

        const updatedStocks = market.stocks.map(s => {
            if (String(s.id) === String(stockId)) return {
                ...s,
                transactions: updatedTransactions,
                shares,
                avgPrice: avgCost,
                dividends: { ...s.dividends, ...dividends }
            };
            return s;
        });
        const updatedMarket = { ...market, stocks: updatedStocks };
        await updateItem('savings', updatedMarket);
        setTxToDelete(null);
        setIsDeleteModalOpen(false);
    };

    const handleUpdateStock = async (updatedStockData) => {
        const updatedStocks = market.stocks.map(s => {
            if (s.id.toString() === stockId) {
                return { ...updatedStockData, transactions: s.transactions };
            }
            return s;
        });
        const updatedMarket = { ...market, stocks: updatedStocks };
        await updateItem('savings', updatedMarket);
        setIsEditStockModalOpen(false);
    };

    const handleSaveDividend = async (year, amount) => {
        const currentDividends = stock.dividends || {};
        const updatedDividends = { ...currentDividends, [year]: parseFloat(amount) };

        const updatedStock = { ...stock, dividends: updatedDividends };

        const updatedStocks = market.stocks.map(s => {
            if (s.id.toString() === stockId) return updatedStock;
            return s;
        });

        const updatedMarket = { ...market, stocks: updatedStocks };
        await updateItem('savings', updatedMarket);
        setEditingDividend(null);
    };

    // Summary Calculations optimized via useMemo.
    // Guarded rather than skipped: this memo used to sit after an early return
    // for a missing stock, so a direct page load ran fewer hooks on the first
    // render than the second and React threw "Rendered more hooks than during
    // the previous render". Hooks must run on every render.
    const metrics = useMemo(() => {
        if (!stock) {
            return { totalBuyValue: 0, totalSellValue: 0, totalInvested: 0, currentValue: 0,
                     unrealizedPL: 0, wholePL: 0, isProfit: true, dividendEarned: 0 };
        }
        const buyVal = transactions.reduce((sum, tx) => {
            if (['buy', 'ipo', 'demerger'].includes(tx.type)) {
                return sum + (Number(tx.quantity) * Number(tx.price));
            }
            return sum;
        }, 0);

        const sellVal = transactions.reduce((sum, tx) => {
            if (['sell', 'buyback'].includes(tx.type)) {
                return sum + (Number(tx.quantity) * Number(tx.price));
            }
            return sum;
        }, 0);

        // Stored records use avgPrice; avgCost was never written by any record
        // and read as undefined, which is why Avg Price and Total Invested
        // both displayed zero on every stock.
        const avgCost = Number(stock.avgPrice ?? stock.avgCost ?? 0);
        const totalInvested = Number(stock.shares || 0) * avgCost;
        const currentValue = stock.shares * stock.currentPrice;
        const unrealizedPL = currentValue - totalInvested;
        const wholePL = (currentValue + sellVal) - buyVal;
        const isProfit = wholePL >= 0;
        const dividendEarned = Object.values(stock.dividends || {}).reduce((sum, val) => sum + val, 0);

        return {
            totalBuyValue: buyVal,
            totalSellValue: sellVal,
            totalInvested,
            currentValue,
            unrealizedPL,
            wholePL,
            isProfit,
            dividendEarned
        };
    }, [transactions, stock]);

    // Cost recovery for this one holding. Kept beside `metrics` rather than
    // inside it because it answers a different question: `metrics` reports
    // average-cost profit, this reports whether any of your own money is still
    // in the position at all. Bajaj Housing shows +20% on the first measure and
    // is fully recovered on the second — both true.
    const recovery = useMemo(() => (stock ? costRecovery(stock) : null), [stock]);

    // Yield on cost and payout reliability. Neither is derivable from the
    // Dividends card beside it: that shows a rupee total, which says nothing
    // about what the money committed is returning, or whether it still pays.
    const dividendInfo = useMemo(() => (stock ? dividendProfile(stock) : null), [stock]);

    // Realised P/L per disposal, from the same replay that produces the totals.
    const realisedByTx = useMemo(
        () => (stock ? recomputeStockMetrics(stock.transactions || []).realisedByTx : {}),
        [stock],
    );

    const currentYear = new Date().getFullYear();
    const dividendYears = useMemo(() => Array.from({ length: 5 }, (_, i) => (currentYear - i).toString()), [currentYear]);

    const dividendChartData = useMemo(() => {
        const years = Array.from({ length: 6 }, (_, i) => (currentYear - i).toString()).reverse();
        return years.map(year => ({
            year,
            amount: Number(stock?.dividends?.[year] || 0)
        }));
    }, [currentYear, stock]);

    // Redesigned premium inline CSS styles
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
            marginBottom: '1.5rem'
        },
        headerPanel: {
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginBottom: '2rem'
        },
        titleContainer: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
        },
        titleText: {
            fontSize: '2rem',
            fontWeight: '900',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            margin: 0,
            letterSpacing: '-0.02em'
        },
        titleIcon: {
            padding: '0.5rem',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            color: '#818cf8',
            display: 'flex',
            alignItems: 'center',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.1)'
        },
        statGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '1rem',
            marginTop: '1.25rem'
        },
        glassCard: (bg = 'rgba(255, 255, 255, 0.02)', border = 'rgba(255, 255, 255, 0.06)', shadow = 'rgba(0,0,0,0.2)') => ({
            background: `linear-gradient(135deg, ${bg} 0%, rgba(255, 255, 255, 0.005) 100%)`,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '1rem',
            padding: '1.125rem',
            border: `1px solid ${border}`,
            boxShadow: `0 4px 20px ${shadow}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            transition: 'transform 0.2s, border-color 0.2s'
        }),
        actionButton: (bg = '#4f46e5', hoverBg = '#4338ca') => ({
            padding: '0.625rem 1.25rem',
            borderRadius: '0.75rem',
            backgroundColor: bg,
            color: 'white',
            fontWeight: '700',
            fontSize: '0.825rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            cursor: 'pointer',
            transition: 'background-color 0.2s, transform 0.2s',
            border: 'none',
            boxShadow: `0 4px 12px ${bg}25`
        }),
        tableContainer: {
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '1.25rem',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            marginTop: '2rem'
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse'
        },
        th: (align = 'left') => ({
            padding: '1rem var(--spacing-lg)',
            textAlign: align,
            color: 'rgba(255, 255, 255, 0.6)',
            fontWeight: '700',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)'
        }),
        td: (align = 'left', isBold = false, color = 'var(--text-primary)') => ({
            padding: '1rem var(--spacing-lg)',
            textAlign: align,
            color: color,
            fontWeight: isBold ? '700' : '500',
            fontSize: '13px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            backgroundColor: 'transparent'
        }),
        actionBtnCell: (color) => ({
            padding: '0.375rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            color: color,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'background-color 0.2s, color 0.2s'
        })
    };


    // Safe to bail out here: every hook above has already run.
    if (!market || !stock) {
        return <div className="p-8 text-white">Stock not found.</div>;
    }

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <BackButton label="Back to Account" />

            <div style={styles.headerPanel}>
                <div style={styles.titleContainer}>
                    <h2 style={styles.titleText}>
                        <span style={styles.titleIcon}>
                            <TrendingUp size={24} />
                        </span>
                        {stock.name} <span style={{ color: '#71717a', fontSize: '1.25rem', fontWeight: '500', marginLeft: '0.25rem' }}>({stock.symbol || stock.ticker || '—'})</span>
                    </h2>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={() => setIsEditStockModalOpen(true)}
                            style={styles.actionButton('rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.1)')}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                        >
                            <Edit2 size={16} /> Edit Details
                        </button>
                        <button
                            onClick={() => { setEditingTx(null); setIsModalOpen(true); }}
                            style={styles.actionButton('#4f46e5', '#4338ca')}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#4338ca';
                                e.currentTarget.style.transform = 'scale(1.02)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#4f46e5';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            <Plus size={16} /> Add Transaction
                        </button>
                    </div>
                </div>

                {recovery && recovery.invested > 0 && recovery.rawPct >= NEARLY_FREE_FROM && (
                    <div style={{
                        marginBottom: '1.25rem',
                        padding: '1rem 1.25rem',
                        borderRadius: '1rem',
                        border: `1px solid ${recovery.isFree ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.25)'}`,
                        backgroundColor: recovery.isFree ? 'rgba(52,211,153,0.07)' : 'rgba(251,191,36,0.06)',
                        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', justifyContent: 'space-between',
                    }}>
                        <div style={{ minWidth: 0 }}>
                            <p style={{
                                margin: 0, fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em',
                                textTransform: 'uppercase', color: recovery.isFree ? '#34d399' : '#fbbf24',
                            }}>
                                {recovery.isFree
                                    ? `Held at no cost — ${recovery.shares} shares free`
                                    : `${recovery.rawPct.toFixed(0)}% of cost recovered`}
                            </p>
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                                {formatCurrency(recovery.invested)} went in; {formatCurrency(recovery.recovered)} has come
                                back{recovery.dividends > 0 ? `, including ${formatCurrency(recovery.dividends)} in dividends` : ''}.
                                {recovery.isFree
                                    ? ` Everything you put in is out, with ${formatCurrency(recovery.surplus)} to spare — the shares above cost you nothing, whatever the average price says.`
                                    : ` ${formatCurrency(recovery.outstandingCost)} of your own money is still in this position — about ${formatCurrency(recovery.netCostPerShare)} a share.`}
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 800, color: '#71717a' }}>
                                {recovery.isFree ? 'Free value' : 'Still at risk'}
                            </p>
                            <p style={{
                                margin: '0.15rem 0 0', fontFamily: 'monospace', fontWeight: 900, fontSize: '1.35rem',
                                color: recovery.isFree ? '#34d399' : '#fbbf24',
                            }}>
                                {formatCurrency(recovery.isFree ? recovery.value : recovery.outstandingCost)}
                            </p>
                        </div>
                    </div>
                )}

                <div style={styles.statGrid}>
                    <div style={styles.glassCard()}>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: '#71717a', fontWeight: '800', marginBottom: '0.25rem', margin: 0 }}>Quantity Held</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{stock.shares}</p>
                    </div>
                    <div style={styles.glassCard()}>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: '#71717a', fontWeight: '800', marginBottom: '0.25rem', margin: 0 }}>Avg Price</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(stock.avgPrice ?? stock.avgCost ?? 0)}</p>
                    </div>
                    <div style={styles.glassCard()}>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: '#71717a', fontWeight: '800', marginBottom: '0.25rem', margin: 0 }}>Current Price</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(stock.currentPrice)}</p>
                    </div>
                    <div style={styles.glassCard('rgba(99, 102, 241, 0.05)', 'rgba(99, 102, 241, 0.15)')}>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: '#818cf8', fontWeight: '800', marginBottom: '0.25rem', margin: 0 }}>Current Value</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(metrics.currentValue)}</p>
                    </div>
                    <div style={styles.glassCard()}>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: '#71717a', fontWeight: '800', marginBottom: '0.25rem', margin: 0 }}>Total Invested</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(metrics.totalInvested)}</p>
                    </div>
                    <div style={styles.glassCard(
                        metrics.unrealizedPL >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                        metrics.unrealizedPL >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'
                    )}>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: metrics.unrealizedPL >= 0 ? '#34d399' : '#f87171', fontWeight: '800', marginBottom: '0.25rem', margin: 0 }}>Unrealized P/L</p>
                        <div style={{ fontSize: '1.25rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'monospace', color: metrics.unrealizedPL >= 0 ? '#34d399' : '#f87171', margin: 0 }}>
                            {metrics.unrealizedPL >= 0 ? '+' : ''}{formatCurrency(metrics.unrealizedPL)}
                        </div>
                    </div>
                    <div style={styles.glassCard(
                        metrics.isProfit ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                        metrics.isProfit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'
                    )}>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: metrics.isProfit ? '#34d399' : '#f87171', fontWeight: '800', marginBottom: '0.25rem', margin: 0 }}>Whole P/L</p>
                        <div style={{ fontSize: '1.25rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'monospace', color: metrics.isProfit ? '#34d399' : '#f87171', margin: 0 }}>
                            {metrics.isProfit ? '+' : ''}{formatCurrency(metrics.wholePL)}
                        </div>
                    </div>
                    <div style={styles.glassCard()}>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: '#71717a', fontWeight: '800', marginBottom: '0.25rem', margin: 0 }}>Net Invested</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(metrics.totalBuyValue - metrics.totalSellValue)}</p>
                    </div>
                    <div style={styles.glassCard('rgba(13, 148, 136, 0.05)', 'rgba(13, 148, 136, 0.15)')}>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: '#2dd4bf', fontWeight: '800', marginBottom: '0.25rem', margin: 0 }}>Dividends</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: '#2dd4bf', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(metrics.dividendEarned)}</p>
                        {dividendInfo?.everPaid && dividendInfo.pct > 0 && (
                            <p style={{ margin: '0.3rem 0 0', fontSize: '0.6rem', color: '#71717a', fontWeight: 700 }}>
                                {dividendInfo.pct.toFixed(1)}% yield on cost
                            </p>
                        )}
                    </div>
                    {dividendInfo?.everPaid && (
                        <div style={styles.glassCard(
                            dividendInfo.lapsed ? 'rgba(251, 191, 36, 0.05)' : 'rgba(13, 148, 136, 0.05)',
                            dividendInfo.lapsed ? 'rgba(251, 191, 36, 0.18)' : 'rgba(13, 148, 136, 0.15)'
                        )}>
                            <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: dividendInfo.lapsed ? '#fbbf24' : '#2dd4bf', fontWeight: '800', marginBottom: '0.25rem', margin: 0 }}>Payout Record</p>
                            <p style={{ fontSize: '1.25rem', fontWeight: '900', color: dividendInfo.lapsed ? '#fbbf24' : 'white', fontFamily: 'monospace', margin: 0 }}>
                                {dividendInfo.paidYears}/{dividendInfo.spanYears} yrs
                            </p>
                            <p style={{ margin: '0.3rem 0 0', fontSize: '0.6rem', color: '#71717a', fontWeight: 700 }}>
                                {dividendInfo.payments} payment{dividendInfo.payments === 1 ? '' : 's'}
                                {dividendInfo.lapsed ? ` · none since ${dividendInfo.lastPaid}` : ''}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div style={styles.tableContainer}>
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

                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th('left')}>Date</th>
                            <th style={styles.th('left')}>Type</th>
                            <th style={styles.th('right')}>Quantity</th>
                            <th style={styles.th('right')}>Price</th>
                            <th style={styles.th('right')}>Total Value</th>
                            <th style={styles.th('right')}>P/L (Live)</th>
                            <th style={styles.th('center')}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedTransactions.length === 0 ? (
                            <tr><td colSpan={7} style={{ ...styles.td('center'), color: '#71717a', padding: '3rem' }}>No transactions found for the selected period.</td></tr>
                        ) : (
                            paginatedTransactions.map(tx => (
                                <tr key={tx.id} style={{ transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <td style={styles.td('left', false, '#d4d4d8')}>
                                        {formatDate(tx.date)}
                                        {tx.id === 'synthetic-initial' && <span style={{ marginLeft: '0.5rem', fontSize: '10px', color: '#fbbf24', fontWeight: 'bold' }}>(Auto-generated)</span>}
                                    </td>
                                    <td style={styles.td('left')}>
                                        <span style={{
                                            px: '0.5rem',
                                            py: '0.125rem',
                                            borderRadius: '0.375rem',
                                            fontSize: '10px',
                                            fontWeight: '800',
                                            padding: '0.25rem 0.5rem',
                                            letterSpacing: '0.05em',
                                            backgroundColor: ['buy', 'ipo', 'bonus', 'split'].includes(tx.type) ? 'rgba(16, 185, 129, 0.12)' :
                                                ['sell', 'buyback'].includes(tx.type) ? 'rgba(239, 68, 68, 0.12)' :
                                                    tx.type === 'demerger' ? 'rgba(245, 158, 11, 0.12)' :
                                                        'rgba(59, 130, 246, 0.12)',
                                            color: ['buy', 'ipo', 'bonus', 'split'].includes(tx.type) ? '#34d399' :
                                                ['sell', 'buyback'].includes(tx.type) ? '#f87171' :
                                                    tx.type === 'demerger' ? '#fbbf24' :
                                                        '#60a5fa',
                                            border: `1px solid ${
                                                ['buy', 'ipo', 'bonus', 'split'].includes(tx.type) ? 'rgba(16, 185, 129, 0.2)' :
                                                ['sell', 'buyback'].includes(tx.type) ? 'rgba(239, 68, 68, 0.2)' :
                                                tx.type === 'demerger' ? 'rgba(245, 158, 11, 0.2)' :
                                                'rgba(59, 130, 246, 0.2)'
                                            }`
                                        }}>
                                            {tx.type.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={styles.td('right', false, 'white')}>
                                        <span style={{ fontFamily: 'monospace' }}>
                                            {tx.type === 'dividend' || tx.type === 'demerger' ? '-' :
                                                tx.type === 'split' && tx.splitFrom && tx.splitTo ? `${tx.splitFrom}:${tx.splitTo}` :
                                                    tx.quantity}
                                        </span>
                                    </td>
                                    <td style={styles.td('right', false, 'white')}>
                                        <span style={{ fontFamily: 'monospace' }}>
                                            {['dividend', 'bonus', 'split'].includes(tx.type) ? '-' : formatCurrency(tx.price)}
                                        </span>
                                    </td>
                                    <td style={styles.td('right', true, 'white')}>
                                        <span style={{ fontFamily: 'monospace' }}>
                                            {tx.type === 'dividend' ? formatCurrency(tx.price) :
                                                ['bonus', 'split'].includes(tx.type) ? '-' :
                                                    tx.type === 'demerger' ? 'Adjusted' :
                                                        formatCurrency(tx.quantity * tx.price)}
                                        </span>
                                    </td>
                                    <td style={styles.td('right')}>
                                        {(() => {
                                            // Two different questions, one column.
                                            //
                                            // For shares still held, P/L is what they
                                            // would fetch today. For a sell or buyback the
                                            // shares are gone, so the live price is
                                            // irrelevant — what matters is what the
                                            // disposal actually banked against the average
                                            // cost at that moment. Showing a dash there hid
                                            // the only rows that booked real money.
                                            const booked = realisedByTx[String(tx.id)];
                                            if (booked) {
                                                const up = booked.realised >= 0;
                                                return (
                                                    <div style={{ lineHeight: 1.3 }}>
                                                        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: up ? '#34d399' : '#f87171' }}>
                                                            {up ? '+' : ''}{formatCurrency(booked.realised)}
                                                        </span>
                                                        <div style={{ fontSize: '9px', color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                            booked vs {formatCurrency(booked.avgCostAtSale)}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            if (tx.type === 'buy' || tx.type === 'ipo') {
                                                const pl = (stock.currentPrice - tx.price) * tx.quantity;
                                                const up = pl >= 0;
                                                return (
                                                    <span style={{ fontFamily: 'monospace', fontWeight: '700', color: up ? '#34d399' : '#f87171' }}>
                                                        {up ? '+' : ''}{formatCurrency(pl)}
                                                    </span>
                                                );
                                            }
                                            return <span style={{ color: '#71717a' }}>-</span>;
                                        })()}
                                    </td>
                                    <td style={styles.td('center')}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                            <button onClick={() => {
                                                if (tx.id === 'synthetic-initial') {
                                                    setEditingTx({ ...tx, id: undefined, date: new Date().toISOString().split('T')[0] });
                                                } else {
                                                    setEditingTx(tx);
                                                }
                                                setIsModalOpen(true);
                                            }} style={styles.actionBtnCell('#60a5fa')} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.12)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}>
                                                <Edit2 size={14} />
                                            </button>
                                            {tx.id !== 'synthetic-initial' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteTransaction(tx.id);
                                                    }}
                                                    style={styles.actionBtnCell('#f87171')}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

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

            {/* Yearly Dividend History Bar Chart */}
            <div style={{
                marginTop: '2.5rem',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRadius: '1.25rem',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '1.5rem',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', margin: 0, letterSpacing: '-0.01em' }}>
                            Yearly Dividend History
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: '#a1a1aa', margin: '0.25rem 0 0 0' }}>
                            Click on any bar or bar card to edit dividend amount
                        </p>
                    </div>

                    <span style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        color: '#2dd4bf',
                        backgroundColor: 'rgba(45, 212, 191, 0.1)',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '9999px',
                        border: '1px solid rgba(45, 212, 191, 0.2)'
                    }}>
                        Total Dividends: {formatCurrency(Object.values(stock.dividends || {}).reduce((a, b) => Number(a) + Number(b), 0))}
                    </span>
                </div>

                <div style={{ width: '100%', height: '240px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dividendChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="year" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#e4e4e7' }} />
                            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} tick={{ fill: '#a1a1aa' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#121225', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                                itemStyle={{ color: '#2dd4bf', fontWeight: 'bold' }}
                                formatter={(value) => [formatCurrency(value), 'Dividend Earned']}
                                labelStyle={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '4px' }}
                                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                            />
                            <Bar
                                dataKey="amount"
                                radius={[6, 6, 0, 0]}
                                maxBarSize={45}
                                name="Dividend Earned"
                                onClick={(entry) => setEditingDividend({ year: entry.year, amount: entry.amount })}
                                style={{ cursor: 'pointer' }}
                            >
                                {dividendChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill="#2dd4bf" opacity={0.85} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Edit Dividend Modal */}
            {editingDividend && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1100,
                    backdropFilter: 'blur(4px)'
                }} onClick={() => setEditingDividend(null)}>
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.95) 0%, rgba(10, 10, 15, 0.95) 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '1.25rem',
                        padding: '1.5rem',
                        width: '100%',
                        maxWidth: '24rem',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'white', marginBottom: '1rem', marginTop: 0 }}>Edit {editingDividend.year} Dividend</h3>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveDividend(editingDividend.year, e.target.amount.value);
                        }}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Amount</label>
                                <input
                                    name="amount"
                                    type="number"
                                    step="0.01"
                                    defaultValue={editingDividend.amount}
                                    autoFocus
                                    style={{
                                        width: '100%',
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '0.75rem',
                                        padding: '0.625rem 1rem',
                                        color: 'white',
                                        outline: 'none',
                                        fontSize: '0.875rem'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button type="button" onClick={() => setEditingDividend(null)} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', color: '#a1a1aa', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', backgroundColor: '#4f46e5', border: 'none', color: 'white', fontWeight: '700', cursor: 'pointer' }}>Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveTransaction}
                initialData={editingTx}
            />

            <StockTransactionModal
                isOpen={isEditStockModalOpen}
                onClose={() => setIsEditStockModalOpen(false)}
                onSave={handleUpdateStock}
                initialData={stock}
                customColumns={market.customColumns || []}
            />

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setTxToDelete(null);
                }}
                onConfirm={confirmDeleteTransaction}
                title="Delete Transaction"
                message="Are you sure you want to delete this transaction? This will automatically recalculate your stock metrics."
                confirmText="Delete"
            />
        </div>
    );
};

const TransactionModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState('buy');
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [splitFrom, setSplitFrom] = useState('');
    const [splitTo, setSplitTo] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setDate(initialData.date);
                setType(initialData.type);
                setQuantity(initialData.quantity || '');
                setPrice(initialData.price || '');
                setSplitFrom(initialData.splitFrom || '');
                setSplitTo(initialData.splitTo || '');
            } else {
                setDate(new Date().toISOString().split('T')[0]);
                setType('buy');
                setQuantity('');
                setPrice('');
                setSplitFrom('');
                setSplitTo('');
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            id: initialData?.id,
            date,
            type,
            quantity: Number(quantity),
            price: Number(price),
            splitFrom: type === 'split' ? Number(splitFrom) : undefined,
            splitTo: type === 'split' ? Number(splitTo) : undefined
        });
    };

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }} onClick={onClose}>
            <div style={{
                background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.95) 0%, rgba(10, 10, 15, 0.95) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '1.25rem',
                padding: '1.5rem',
                width: '100%',
                maxWidth: '24rem',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'white', margin: 0 }}>{initialData ? 'Edit' : 'Add'} Transaction</h3>
                    <button onClick={onClose} style={{ color: '#a1a1aa', border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Date</label>
                        <input type="date" required value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '0.75rem', padding: '0.625rem 1rem', color: 'white', outline: 'none', fontSize: '0.875rem' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Type</label>
                        <select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', backgroundColor: '#18181b', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '0.75rem', padding: '0.625rem 1rem', color: 'white', outline: 'none', fontSize: '0.875rem' }}>
                            <option value="buy">Buy</option>
                            <option value="sell">Sell</option>
                            <option value="dividend">Dividend</option>
                            <option value="bonus">Bonus</option>
                            <option value="split">Split</option>
                            <option value="ipo">IPO</option>
                            <option value="buyback">Buyback</option>
                            <option value="demerger">Demerger</option>
                        </select>
                    </div>
                    {type === 'split' ? (
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Ratio From</label>
                                <input type="number" required={type === 'split'} value={splitFrom} onChange={e => setSplitFrom(e.target.value)} style={{ width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '0.75rem', padding: '0.625rem 1rem', color: 'white', outline: 'none', fontSize: '0.875rem' }} placeholder="1" />
                            </div>
                            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#71717a', marginTop: '1.25rem' }}>:</span>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Ratio To</label>
                                <input type="number" required={type === 'split'} value={splitTo} onChange={e => setSplitTo(e.target.value)} style={{ width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '0.75rem', padding: '0.625rem 1rem', color: 'white', outline: 'none', fontSize: '0.875rem' }} placeholder="10" />
                            </div>
                        </div>
                    ) : (type !== 'dividend') && (
                        <div>
                            <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
                                {type === 'demerger' ? 'Shares Received' : 'Quantity'}
                            </label>
                            <input type="number" required value={quantity} onChange={e => setQuantity(e.target.value)} style={{ width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '0.75rem', padding: '0.625rem 1rem', color: 'white', outline: 'none', fontSize: '0.875rem' }} placeholder="0" />
                        </div>
                    )}
                    {['buy', 'sell', 'ipo', 'buyback', 'dividend', 'demerger'].includes(type) && (
                        <div>
                            <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
                                {type === 'dividend' ? 'Total Dividend Amount' : type === 'demerger' ? 'New Average Price' : 'Price per share'}
                            </label>
                            <input type="number" step="0.01" required value={price} onChange={e => setPrice(e.target.value)} style={{ width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '0.75rem', padding: '0.625rem 1rem', color: 'white', outline: 'none', fontSize: '0.875rem' }} placeholder="0.00" />
                        </div>
                    )}
                    <button type="submit" style={{ width: '100%', backgroundColor: '#4f46e5', color: 'white', fontWeight: '700', padding: '0.75rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', marginTop: '0.5rem' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4338ca'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}>
                        Save Transaction
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default StockDetails;
