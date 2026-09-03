import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { Plus, Target, TrendingUp, TrendingDown, Layout, RefreshCcw, Trash2, ArrowUpRight, Info, Award, ScrollText, Layers, Archive, ArchiveRestore, Gift, Coins, Ticket, Eye } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import InvestmentsItemModal from '../components/InvestmentsItemModal';
import ConfirmModal from '../components/ConfirmModal';

const Investments = () => {
    const { savings, formatCurrency, calculateItemCurrentValue, calculateItemInvestedValue, addItem, updateItem, deleteItem } = useFinance();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [showArchived, setShowArchived] = useState(false);

    // Filter only investments (mutual funds, stocks, and SGB)
    const investments = savings.filter(item => item.type === 'mutual_fund' || item.type === 'stock_market' || item.type === 'sgb');
    const activeInvestments = investments.filter(item => !item.isArchived);
    const archivedInvestments = investments.filter(item => item.isArchived);

    const handleArchiveClick = async (e, item) => {
        e.stopPropagation();
        await updateItem('savings', { ...item, isArchived: !item.isArchived });
    };

    const handleDeleteClick = (e, item) => {
        e.stopPropagation();
        setItemToDelete(item);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (itemToDelete) {
            await deleteItem('savings', itemToDelete.id);
            setIsDeleteModalOpen(false);
            setItemToDelete(null);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'stock_market': return <Layout size={64} />;
            case 'mutual_fund': return <TrendingUp size={64} />;
            case 'sgb': return <ScrollText size={64} />;
            default: return <Target size={64} />;
        }
    };

    const getStyle = (type) => {
        switch (type) {
            case 'stock_market': return { bg: 'bg-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-500' };
            case 'mutual_fund': return { bg: 'bg-purple-500/20', text: 'text-purple-400', bar: 'bg-purple-500' };
            case 'sgb': return { bg: 'bg-amber-500/20', text: 'text-amber-400', bar: 'bg-amber-500' };
            default: return { bg: 'bg-gray-500/20', text: 'text-gray-400', bar: 'bg-gray-500' };
        }
    };

    const totalPortfolioValue = activeInvestments.reduce((sum, item) => sum + calculateItemCurrentValue(item), 0);
    const totalInvestedValue = activeInvestments.reduce((sum, item) => sum + calculateItemInvestedValue(item), 0);
    const totalProfitLoss = totalPortfolioValue - totalInvestedValue;
    const isTotalProfit = totalProfitLoss >= 0;

    const pieData = React.useMemo(() => {
        let data = [];

        // Aggregate Stock Market accounts
        const stockMarketVal = activeInvestments
            .filter(i => i.type === 'stock_market')
            .reduce((sum, item) => sum + calculateItemCurrentValue(item), 0);

        if (stockMarketVal > 0) {
            data.push({ name: 'Stock Market', value: stockMarketVal });
        }

        // Individual Gold Bonds (SGB)
        activeInvestments.filter(i => i.type === 'sgb').forEach(sgb => {
            const val = calculateItemCurrentValue(sgb);
            if (val > 0) {
                data.push({ name: sgb.title || 'Gold Bonds (SGB)', value: val });
            }
        });

        // Individual Mutual Funds
        activeInvestments.filter(i => i.type === 'mutual_fund').forEach(fund => {
            const val = calculateItemCurrentValue(fund);
            if (val > 0) {
                data.push({ name: fund.title || 'Mutual Fund', value: val });
            }
        });

        return data.sort((a, b) => b.value - a.value);
    }, [activeInvestments, calculateItemCurrentValue]);

    const PIE_COLORS = [
        '#8b5cf6', // Purple
        '#ec4899', // Pink
        '#3b82f6', // Blue
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ef4444', // Red
        '#06b6d4', // Cyan
        '#84cc16', // Lime
        '#f97316'  // Orange
    ];

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="black">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    const handleSaveNewItem = async (newItem) => {
        await addItem('savings', newItem);
        setIsModalOpen(false);
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header Title Panel */}
            <div style={{ marginBottom: '2.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>Investments</h2>
                    <p style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0.25rem 0 0 0' }}>Track your mutual funds and stocks</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => navigate('/investments/watchlist')}
                        style={{
                            padding: '0.625rem 1.25rem', borderRadius: '0.875rem',
                            backgroundColor: 'rgba(96, 165, 250, 0.15)', border: '1px solid rgba(96, 165, 250, 0.3)',
                            color: '#60a5fa', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s ease'
                        }}
                    >
                        <Eye size={16} /> Watchlist
                    </button>
                    <button
                        onClick={() => navigate('/investments/ipos')}
                        style={{
                            padding: '0.625rem 1.25rem',
                            borderRadius: '0.875rem',
                            backgroundColor: 'rgba(129, 140, 248, 0.15)',
                            border: '1px solid rgba(129, 140, 248, 0.3)',
                            color: '#818cf8',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Ticket size={16} /> IPO Applications
                    </button>
                    <button
                        onClick={() => navigate('/investments/free-holdings')}
                        style={{
                            padding: '0.625rem 1.25rem',
                            borderRadius: '0.875rem',
                            backgroundColor: 'rgba(52, 211, 153, 0.15)',
                            border: '1px solid rgba(52, 211, 153, 0.3)',
                            color: '#34d399',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Gift size={16} /> Free Holdings
                    </button>
                    <button
                        onClick={() => navigate('/investments/dividend-income')}
                        style={{
                            padding: '0.625rem 1.25rem',
                            borderRadius: '0.875rem',
                            backgroundColor: 'rgba(45, 212, 191, 0.15)',
                            border: '1px solid rgba(45, 212, 191, 0.3)',
                            color: '#2dd4bf',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Coins size={16} /> Dividend Income
                    </button>
                    <button
                        onClick={() => navigate('/investments/nifty50-exposure')}
                        style={{
                            padding: '0.625rem 1.25rem',
                            borderRadius: '0.875rem',
                            backgroundColor: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            color: '#818cf8',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Layers size={16} /> Nifty 50 Direct & MF Overlap
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        style={{
                            padding: '0.625rem 1.25rem',
                            borderRadius: '0.875rem',
                            backgroundColor: '#6366f1',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Plus size={16} /> Add Account
                    </button>
                </div>
            </div>

            {/* Modern Premium Stat Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                {/* Total Invested */}
                <div style={{
                    backgroundColor: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.75rem', opacity: 0.1, color: 'white' }}>
                        <ArrowUpRight size={48} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#71717a', marginBottom: '0.25rem', margin: 0 }}>Total Invested</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(totalInvestedValue)}</h3>
                    </div>
                    <p style={{ fontSize: '0.625rem', color: '#a1a1aa', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', margin: 0 }}>
                        <Info size={12} /> Cost basis of all active holdings
                    </p>
                </div>

                {/* Current Value */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(24, 24, 27, 0.9) 100%)',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.05)'
                }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.75rem', opacity: 0.1, color: '#818cf8' }}>
                        <TrendingUp size={48} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#818cf8', marginBottom: '0.25rem', margin: 0 }}>Current Value</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(totalPortfolioValue)}</h3>
                    </div>
                    <p style={{ fontSize: '0.625rem', color: '#a1a1aa', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', margin: 0 }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
                        Live evaluated portfolio worth
                    </p>
                </div>

                {/* Total Return */}
                <div style={{
                    background: isTotalProfit 
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(24, 24, 27, 0.9) 100%)' 
                        : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(24, 24, 27, 0.9) 100%)',
                    border: isTotalProfit ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: isTotalProfit ? '0 10px 15px -3px rgba(16, 185, 129, 0.05)' : '0 10px 15px -3px rgba(239, 68, 68, 0.05)'
                }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.75rem', opacity: 0.1, color: isTotalProfit ? '#34d399' : '#f87171' }}>
                        {isTotalProfit ? <TrendingUp size={48} /> : <TrendingDown size={48} />}
                    </div>
                    <div>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: isTotalProfit ? '#34d399' : '#f87171', marginBottom: '0.25rem', margin: 0 }}>Total Return</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: isTotalProfit ? '#34d399' : '#f87171', fontFamily: 'monospace', margin: 0 }}>
                            {isTotalProfit ? '+' : ''}{formatCurrency(totalProfitLoss)}
                        </h3>
                    </div>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.625rem',
                        fontWeight: 'bold',
                        marginTop: '0.75rem',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '0.375rem',
                        width: 'fit-content',
                        backgroundColor: isTotalProfit ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: isTotalProfit ? '#34d399' : '#f87171'
                    }}>
                        {isTotalProfit ? '▲' : '▼'} {totalInvestedValue > 0 ? ((totalProfitLoss / totalInvestedValue) * 100).toFixed(2) : '0.00'}% Return
                    </span>
                </div>

                {/* Quick Action Account Card */}
                <div style={{
                    backgroundColor: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '1rem',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    position: 'relative'
                }}>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        style={{
                            width: '100%',
                            padding: '0.875rem',
                            borderRadius: '0.75rem',
                            backgroundColor: '#6366f1',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.2)'
                        }}
                    >
                        <Plus size={16} />
                        <span>Add Investment Account</span>
                    </button>
                </div>
            </div>

            {/* Split Allocation visual Card */}
            {pieData.length > 0 && (
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '1.5rem',
                    padding: '2rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3rem',
                    marginBottom: '2.5rem'
                }}>
                    {/* Pie Chart Column */}
                    <div style={{ width: '260px', height: '260px', position: 'relative', flexShrink: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart key={JSON.stringify(pieData)}>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    dataKey="value"
                                    stroke="#18181b"
                                    strokeWidth={2}
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    formatter={(value) => formatCurrency(value)} 
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Progress Indicator Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, minWidth: '280px' }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: '800', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Portfolio Asset Allocation</h4>
                        {pieData.map((entry, index) => {
                            const percentage = totalPortfolioValue > 0 ? ((entry.value / totalPortfolioValue) * 100).toFixed(1) : '0.0';
                            return (
                                <div key={entry.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                        <span style={{ fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></span>
                                            {entry.name}
                                        </span>
                                        <span style={{ fontFamily: 'monospace', color: '#a1a1aa' }}>
                                            {formatCurrency(entry.value)} ({percentage}%)
                                        </span>
                                    </div>
                                    <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${percentage}%`, backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Investments Accounts Listing */}
            {activeInvestments.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem 1.5rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '1.5rem',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    marginBottom: '2rem'
                }}>
                    <Target style={{ color: '#71717a', marginBottom: '1.5rem' }} size={48} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', marginBottom: '0.5rem' }}>No Investments Yet</h3>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>Start tracking your mutual funds and stocks by adding your first investment account.</p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        style={{
                            padding: '0.625rem 1.5rem',
                            borderRadius: '0.75rem',
                            backgroundColor: '#6366f1',
                            color: 'white',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Add Account
                    </button>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '2rem'
                }}>
                    {activeInvestments.map(item => {
                        const isStockMarket = item.type === 'stock_market';
                        const isMutualFund = item.type === 'mutual_fund';
                        const isSGB = item.type === 'sgb';
                        const style = getStyle(item.type);

                        const displayAmount = calculateItemCurrentValue(item);
                        const invested = calculateItemInvestedValue(item);
                        const pl = displayAmount - invested;
                        const isProfit = pl >= 0;
                        const plPercent = invested > 0 ? (pl / invested) * 100 : 0;

                        const handleClick = () => {
                            if (isMutualFund) { navigate(`/savings/mutual-fund/${item.id}`); }
                            else if (isStockMarket) { navigate(`/savings/stock-market/${item.id}`); }
                            else if (isSGB) { navigate(`/savings/sgb/${item.id}`); }
                        };

                        const borderStyle = isStockMarket 
                            ? '1px solid rgba(59, 130, 246, 0.15)' 
                            : isSGB 
                                ? '1px solid rgba(245, 158, 11, 0.2)' 
                                : '1px solid rgba(167, 139, 250, 0.15)';
                        const shadowStyle = isStockMarket 
                            ? '0 10px 15px -3px rgba(59, 130, 246, 0.02)' 
                            : isSGB 
                                ? '0 10px 15px -3px rgba(245, 158, 11, 0.02)' 
                                : '0 10px 15px -3px rgba(167, 139, 250, 0.02)';
                        const badgeBg = isStockMarket 
                            ? 'rgba(59, 130, 246, 0.1)' 
                            : isSGB 
                                ? 'rgba(245, 158, 11, 0.1)' 
                                : 'rgba(167, 139, 250, 0.1)';
                        const badgeBorder = isStockMarket 
                            ? '1px solid rgba(59, 130, 246, 0.2)' 
                            : isSGB 
                                ? '1px solid rgba(245, 158, 11, 0.2)' 
                                : '1px solid rgba(167, 139, 250, 0.2)';
                        const badgeText = isStockMarket 
                            ? '#60a5fa' 
                            : isSGB 
                                ? '#fbbf24' 
                                : '#c084fc';

                        return (
                            <div
                                key={item.id}
                                onClick={handleClick}
                                style={{
                                    backgroundColor: 'rgba(24, 24, 27, 0.4)',
                                    backdropFilter: 'blur(10px)',
                                    borderRadius: '1.5rem',
                                    border: borderStyle,
                                    padding: '1.5rem',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    height: '220px',
                                    boxShadow: shadowStyle
                                }}
                            >
                                <div style={{ position: 'absolute', top: 0, right: 0, padding: '1.5rem', opacity: 0.05, color: isStockMarket ? '#3b82f6' : isSGB ? '#fbbf24' : '#a78bfa' }}>
                                    {getIcon(item.type)}
                                </div>

                                <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: '0 0 0.5rem 0' }}>{item.title}</h3>
                                        <span style={{
                                            fontSize: '9px',
                                            padding: '0.125rem 0.5rem',
                                            borderRadius: '9999px',
                                            fontWeight: '800',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em',
                                            border: badgeBorder,
                                            backgroundColor: badgeBg,
                                            color: badgeText
                                        }}>
                                            {item.type === 'sgb' ? 'SGB' : item.type.replace('_', ' ')}
                                        </span>
                                    </div>

                                    <div>
                                        <p style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em', margin: '0 0 0.125rem 0' }}>Current Value</p>
                                        <p style={{ fontSize: '1.75rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(displayAmount)}</p>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.375rem',
                                            marginTop: '0.5rem',
                                            fontSize: '10px',
                                            fontWeight: '900',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            color: isProfit ? '#10b981' : '#ef4444'
                                        }}>
                                            {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                            <span>{formatCurrency(Math.abs(pl))} ({plPercent.toFixed(1)}%)</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', gap: '0.5rem', zIndex: 20 }}>
                                    <button
                                        onClick={(e) => handleArchiveClick(e, item)}
                                        style={{
                                            padding: '0.4rem 0.5rem',
                                            borderRadius: '0.5rem',
                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            color: '#a1a1aa',
                                            cursor: 'pointer'
                                        }}
                                        title="Archive Account"
                                    >
                                        <Archive size={15} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDeleteClick(e, item)}
                                        style={{
                                            padding: '0.4rem 0.5rem',
                                            borderRadius: '0.5rem',
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.2)',
                                            color: '#f87171',
                                            cursor: 'pointer'
                                        }}
                                        title="Delete Account"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Archived Investment Accounts */}
            {archivedInvestments.length > 0 && (
                <div style={{ marginTop: '3.5rem', paddingTop: '2rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#71717a', letterSpacing: '-0.025em', margin: 0 }}>Archived Accounts</h3>
                            <p style={{ fontSize: '10px', color: '#52525b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.25rem', margin: 0 }}>Hidden from main portfolio view</p>
                        </div>
                        <button 
                            onClick={() => setShowArchived(!showArchived)}
                            style={{
                                fontSize: '10px',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                color: '#71717a',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '0.75rem',
                                backgroundColor: 'rgba(255,255,255,0.02)',
                                padding: '0.5rem 1rem',
                                cursor: 'pointer'
                            }}
                        >
                            {showArchived ? 'Hide Archived' : 'Show Archived'} ({archivedInvestments.length})
                        </button>
                    </div>

                    {showArchived && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '1.5rem',
                            opacity: 0.8
                        }}>
                            {archivedInvestments.map(item => {
                                const isStockMarket = item.type === 'stock_market';
                                const isMutualFund = item.type === 'mutual_fund';
                                const isSGB = item.type === 'sgb';
                                const displayAmount = calculateItemCurrentValue(item);
                                const handleClick = () => {
                                    if (isMutualFund) { navigate(`/savings/mutual-fund/${item.id}`); }
                                    else if (isStockMarket) { navigate(`/savings/stock-market/${item.id}`); }
                                    else if (isSGB) { navigate(`/savings/sgb/${item.id}`); }
                                };

                                return (
                                    <div
                                        key={item.id}
                                        onClick={handleClick}
                                        style={{
                                            backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                            borderRadius: '1rem',
                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                            padding: '1.25rem',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            height: '160px'
                                        }}
                                    >
                                        <div style={{ position: 'absolute', top: 0, right: 0, padding: '1.25rem', opacity: 0.05, color: '#71717a' }}>
                                            {getIcon(item.type)}
                                        </div>
                                        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                                            <div>
                                                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#a1a1aa', margin: '0 0 0.375rem 0' }}>{item.title}</h3>
                                                <span style={{
                                                    fontSize: '8px',
                                                    padding: '0.125rem 0.375rem',
                                                    borderRadius: '9999px',
                                                    fontWeight: '800',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    color: '#71717a'
                                                }}>
                                                    Archived
                                                </span>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#a1a1aa', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(displayAmount)}</p>
                                            </div>
                                        </div>

                                        <div style={{ position: 'absolute', bottom: '0.85rem', right: '0.85rem', display: 'flex', gap: '0.4rem', zIndex: 20 }}>
                                            <button
                                                onClick={(e) => handleArchiveClick(e, item)}
                                                style={{
                                                    padding: '0.35rem 0.5rem',
                                                    borderRadius: '0.4rem',
                                                    backgroundColor: 'rgba(52, 211, 153, 0.1)',
                                                    border: '1px solid rgba(52, 211, 153, 0.25)',
                                                    color: '#34d399',
                                                    cursor: 'pointer'
                                                }}
                                                title="Unarchive Account"
                                            >
                                                <ArchiveRestore size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteClick(e, item)}
                                                style={{
                                                    padding: '0.35rem 0.5rem',
                                                    borderRadius: '0.4rem',
                                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                                    color: '#f87171',
                                                    cursor: 'pointer'
                                                }}
                                                title="Delete Account"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <InvestmentsItemModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveNewItem}
            />

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setItemToDelete(null);
                }}
                onConfirm={confirmDelete}
                title="Delete Investment Account"
                message={`Are you sure you want to delete "${itemToDelete?.title}"? This action cannot be undone.`}
                confirmText="Delete"
            />
        </div >
    );
};

export default Investments;
