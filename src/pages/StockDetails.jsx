import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, Plus, Edit2, Trash2, X, Save, TrendingDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import StockTransactionModal from '../components/StockTransactionModal';
import ConfirmModal from '../components/ConfirmModal';

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
                price: Number(stock.avgCost),
                remarks: 'Initial Balance (Legacy Data)'
            });
        }
        return txList;
    }, [transactions, stock]);

    // Sorting transactions by date descending
    const sortedTransactions = useMemo(() => {
        return [...effectiveTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [effectiveTransactions]);

    if (!market || !stock) {
        return <div className="p-8 text-white">Stock not found.</div>;
    }

    const recalculateStockMetrics = (txList) => {
        let currentShares = 0;
        let totalCost = 0; // Keeping track of total cost basis
        let calculatedDividends = {};

        // Sort by date ascending for accurate history replay
        const chronologicalTx = [...txList].sort((a, b) => new Date(a.date) - new Date(b.date));

        chronologicalTx.forEach(tx => {
            const qty = Number(tx.quantity) || 0;
            const price = Number(tx.price) || 0;

            if (tx.type === 'buy' || tx.type === 'ipo') {
                if (currentShares === 0) {
                    totalCost = qty * price;
                } else {
                    totalCost += (qty * price);
                }
                currentShares += qty;
            } else if (tx.type === 'sell' || tx.type === 'buyback') {
                const avgCost = currentShares > 0 ? totalCost / currentShares : 0;
                currentShares = Math.max(0, currentShares - qty);
                totalCost = currentShares * avgCost;
            } else if (tx.type === 'bonus') {
                currentShares += qty;
            } else if (tx.type === 'split') {
                if (tx.splitFrom && tx.splitTo) {
                    currentShares = currentShares * (tx.splitTo / tx.splitFrom);
                } else {
                    currentShares += qty;
                }
            } else if (tx.type === 'demerger') {
                currentShares += qty;
                totalCost = currentShares * price;
            } else if (tx.type === 'dividend') {
                const year = new Date(tx.date).getFullYear().toString();
                calculatedDividends[year] = (calculatedDividends[year] || 0) + price;
            }
        });

        const finalAvgCost = currentShares > 0 ? totalCost / currentShares : 0;
        return { shares: currentShares, avgCost: finalAvgCost, dividends: calculatedDividends };
    };

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
                    avgCost,
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
                avgCost,
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

    // Summary Calculations optimized via useMemo
    const metrics = useMemo(() => {
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

        const totalInvested = stock.shares * stock.avgCost;
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

    const currentYear = new Date().getFullYear();
    const dividendYears = useMemo(() => Array.from({ length: 5 }, (_, i) => (currentYear - i).toString()), [currentYear]);

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

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <button
                onClick={() => navigate(-1)}
                style={styles.breadcrumb}
                onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#a1a1aa'}
            >
                <ArrowLeft size={16} /> Back to Market
            </button>

            <div style={styles.headerPanel}>
                <div style={styles.titleContainer}>
                    <h2 style={styles.titleText}>
                        <span style={styles.titleIcon}>
                            <TrendingUp size={24} />
                        </span>
                        {stock.name} <span style={{ color: '#71717a', fontSize: '1.25rem', fontWeight: '500', marginLeft: '0.25rem' }}>({stock.ticker})</span>
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

                <div style={styles.statGrid}>
                    <div style={styles.glassCard()}>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: '#71717a', fontWeight: '800', marginBottom: '0.25rem', margin: 0 }}>Quantity Held</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{stock.shares}</p>
                    </div>
                    <div style={styles.glassCard()}>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: '#71717a', fontWeight: '800', marginBottom: '0.25rem', margin: 0 }}>Avg Price</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(stock.avgCost)}</p>
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
                    </div>
                </div>
            </div>

            <div style={styles.tableContainer}>
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
                        {sortedTransactions.length === 0 ? (
                            <tr><td colSpan={7} style={{ ...styles.td('center'), color: '#71717a', padding: '3rem' }}>No transactions recorded.</td></tr>
                        ) : (
                            sortedTransactions.map(tx => (
                                <tr key={tx.id} style={{ transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <td style={styles.td('left', false, '#d4d4d8')}>
                                        {new Date(tx.date).toLocaleDateString()}
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
                                        {tx.type === 'buy' ? (
                                            (() => {
                                                const pl = (stock.currentPrice - tx.price) * tx.quantity;
                                                const isProfitable = pl >= 0;
                                                return (
                                                    <span style={{ fontFamily: 'monospace', fontWeight: '700', color: isProfitable ? '#34d399' : '#f87171' }}>
                                                        {isProfitable ? '+' : ''}{formatCurrency(pl)}
                                                    </span>
                                                );
                                            })()
                                        ) : (
                                            <span style={{ color: '#71717a' }}>-</span>
                                        )}
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
            </div>

            <div style={{ marginTop: '2.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'white', marginBottom: '1rem', paddingLeft: '0.25rem' }}>Dividends History</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                    {dividendYears.map(year => (
                        <div
                            key={year}
                            style={{
                                ...styles.glassCard(),
                                padding: '1rem',
                                cursor: 'pointer',
                                transition: 'all 0.3s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                            }}
                            onClick={() => setEditingDividend({ year, amount: stock.dividends?.[year] || 0 })}
                        >
                            <p style={{ fontSize: '0.825rem', color: '#a1a1aa', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                {year}
                                <Edit2 size={12} style={{ color: '#818cf8', opacity: 0.5 }} />
                            </p>
                            <p style={{ fontSize: '1.125rem', fontWeight: '900', color: '#2dd4bf', fontFamily: 'monospace', margin: 0 }}>
                                {formatCurrency(stock.dividends?.[year] || 0)}
                            </p>
                        </div>
                    ))}
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
