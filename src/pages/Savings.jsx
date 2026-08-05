import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance, isProtectionOnlyPolicy } from '../context/FinanceContext';
import { Plus, Target, TrendingUp, TrendingDown, Landmark, Shield, ScrollText, RefreshCcw, Trash2, Edit2, ArrowUpRight, Info, Award, Archive, ArchiveRestore } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import SavingsItemModal from '../components/SavingsItemModal';
import ConfirmModal from '../components/ConfirmModal';

const Savings = () => {
    const { savings, formatCurrency, calculateItemCurrentValue, calculateItemInvestedValue, addItem, updateItem, deleteItem, salaryDetails, employments } = useFinance();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [showArchived, setShowArchived] = useState(false);

    const handleDeleteClick = (e, item) => {
        e.stopPropagation();
        setItemToDelete(item);
        setIsDeleteModalOpen(true);
    };

    const handleEditClick = (e, item) => {
        e.stopPropagation();
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleSaveItem = async (itemData) => {
        if (editingItem) {
            await updateItem('savings', itemData);
        } else {
            await addItem('savings', itemData);
        }
        setEditingItem(null);
        setIsModalOpen(false);
    };

    const handleArchiveClick = async (e, item) => {
        e.stopPropagation();
        await updateItem('savings', { ...item, isArchived: !item.isArchived });
    };

    const confirmDelete = async () => {
        if (itemToDelete) {
            // The type in savings array matches the type expected by deleteItem's switch/endpoints
            // except for capitalisation sometimes.
            // deleteItem expects: 'savings', 'asset', 'lents', 'creditCards' OR 'expense'
            // Wait, the deleteItem function in FinanceContext has specific logic.
            // Let's check deleteItem in FinanceContext again.
            // It accepts (type, id).
            // types: 'savings', 'asset', 'lents', 'creditCards'.
            // The items in `savings` array in FinanceContext come from `/savings` endpoint.
            // So the type passed to deleteItem should be 'savings'.
            await deleteItem('savings', itemToDelete.id);
            setIsDeleteModalOpen(false);
            setItemToDelete(null);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'pf': return <Landmark size={64} />;
            case 'savings_account': return <Landmark size={64} />;
            case 'fixed_deposit': return <Landmark size={64} />;
            case 'recurring_deposit': return <RefreshCcw size={64} />;
            case 'Policy': return <Shield size={64} />;
            case 'stock_market':
            case 'mutual_fund': return <TrendingUp size={64} />;
            case 'sgb': return <ScrollText size={64} />;
            default: return <Target size={64} />;
        }
    };

    const getStyle = (type) => {
        switch (type) {
            case 'pf':
                return { bg: 'bg-indigo-500/20', text: 'text-indigo-400', bar: 'bg-indigo-500' };
            case 'stock_market':
            case 'mutual_fund':
                return { bg: 'bg-purple-500/20', text: 'text-purple-400', bar: 'bg-purple-500' };
            case 'savings_account':
            case 'fixed_deposit':
            case 'recurring_deposit':
                return { bg: 'bg-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-500' };
            case 'Policy':
            case 'policy':
                return { bg: 'bg-orange-500/20', text: 'text-orange-400', bar: 'bg-orange-500' };
            default:
                return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500' };
        }
    };

    // Protection-only insurance (motor, health, term) returns nothing at
    // maturity, so it is not savings. Those policies live on the Insurance
    // page; only policies that pay money back — the endowment and money-back
    // LIC plans — are listed and valued here.
    const savingsOnly = savings.filter(item =>
        item.type !== 'mutual_fund' &&
        item.type !== 'stock_market' &&
        item.type !== 'sgb' &&
        !isProtectionOnlyPolicy(item)
    );
    const activeSavings = savingsOnly.filter(item => !item.isArchived);
    const archivedSavings = savingsOnly.filter(item => item.isArchived);

    const totalPortfolioValueFromItems = activeSavings.reduce((sum, item) => sum + calculateItemCurrentValue(item), 0);
    const totalInvestedValue = activeSavings.reduce((sum, item) => sum + calculateItemInvestedValue(item), 0);
    
    // Calculate Total Gratuity Till Now from Salary & Company Tenures
    const totalGratuityTillNow = useMemo(() => {
        let total = 0;
        if (employments && employments.length > 0) {
            employments.forEach(emp => {
                const start = emp.startDate ? new Date(emp.startDate) : null;
                const end = emp.isCurrent || !emp.endDate ? new Date() : new Date(emp.endDate);
                let totalYears = 0;
                let fullYears = 0;

                if (start && !isNaN(start.getTime())) {
                    const diffTime = Math.max(0, end.getTime() - start.getTime());
                    totalYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
                    fullYears = Math.floor(totalYears);
                }

                const isFiveYearEligible = totalYears >= 5.0;
                let status = emp.status || 'active';

                if (!emp.isCurrent && !isFiveYearEligible && status === 'active') {
                    status = 'forfeited';
                }

                if (status === 'forfeited' || status === 'claimed') {
                    return;
                }

                let amt = 0;
                if (Number(emp.lastDrawnBasic) > 0 && fullYears > 0) {
                    amt = (15 * Number(emp.lastDrawnBasic) * fullYears) / 26;
                } else {
                    const startYr = start ? start.getFullYear() : 0;
                    const endYr = end ? end.getFullYear() : 9999;
                    (salaryDetails || []).forEach(s => {
                        if (s.month === 'Annual') {
                            const yr = Number(s.year);
                            if (yr >= startYr && yr <= endYr) {
                                amt += (Number(s.gratuity) || 0);
                            }
                        }
                    });
                }
                total += amt;
            });
        } else {
            (salaryDetails || []).forEach(s => {
                if (s.month === 'Annual') {
                    total += (Number(s.gratuity) || 0);
                }
            });
        }
        return total;
    }, [employments, salaryDetails]);

    const totalPortfolioValue = totalPortfolioValueFromItems + totalGratuityTillNow;
    const totalProfitLoss = totalPortfolioValueFromItems - totalInvestedValue;
    const isTotalProfit = totalProfitLoss >= 0;

    let pieData = [];
    activeSavings.forEach(item => {
        const val = calculateItemCurrentValue(item);
        if (val > 0) {
            pieData.push({ name: item.title || item.type.replace('_', ' '), value: val });
        }
    });
    if (totalGratuityTillNow > 0) {
        pieData.push({ name: 'Employee Gratuity', value: totalGratuityTillNow });
    }
    pieData.sort((a,b) => b.value - a.value);

    const PIE_COLORS = [
        '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', 
        '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#f97316'
    ];

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        if (percent * 100 < 5) return null;
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
            <div style={{ marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>Savings & Assets</h2>
                <p style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>Track your savings accounts, fixed deposits, and policies</p>
            </div>

            {/* Modern Premium Stat Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                {/* Total Valuation */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(24, 24, 27, 0.9) 100%)',
                    border: '1px solid rgba(59, 130, 246, 0.15)',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.05)'
                }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.75rem', opacity: 0.1, color: '#60a5fa' }}>
                        <Landmark size={48} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#60a5fa', marginBottom: '0.25rem', margin: 0 }}>Total Savings Valuation</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(totalPortfolioValue)}</h3>
                    </div>
                    <p style={{ fontSize: '0.625rem', color: '#a1a1aa', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', margin: 0 }}>
                        <Info size={12} /> Combined value of all savings accounts & deposits
                    </p>
                </div>

                {/* Total Interest / Yield */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(24, 24, 27, 0.9) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.15)',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.05)'
                }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.75rem', opacity: 0.1, color: '#34d399' }}>
                        <TrendingUp size={48} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#34d399', marginBottom: '0.25rem', margin: 0 }}>Accumulated Growth / Interest</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#34d399', fontFamily: 'monospace', margin: 0 }}>
                            {totalProfitLoss >= 0 ? '+' : ''}{formatCurrency(totalProfitLoss)}
                        </h3>
                    </div>
                    <p style={{ fontSize: '0.625rem', color: '#a1a1aa', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', margin: 0 }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                        {totalInvestedValue > 0 ? ((totalProfitLoss / totalInvestedValue) * 100).toFixed(2) : '0.00'}% ROI on invested principal
                    </p>
                </div>

                {/* Holdings Summary */}
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
                        <Shield size={48} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#71717a', marginBottom: '0.25rem', margin: 0 }}>Active Savings Holdings</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', margin: 0 }}>{activeSavings.length} Accounts / Deposits</h3>
                    </div>
                    <p style={{ fontSize: '0.625rem', color: '#a1a1aa', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', margin: 0 }}>
                        <Award size={12} /> Diversified low-risk assets portfolio
                    </p>
                </div>

                {/* Add Savings Account Card */}
                <div style={{
                    backgroundColor: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '1rem',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                }}>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        style={{
                            width: '100%',
                            padding: '0.875rem',
                            borderRadius: '0.75rem',
                            backgroundColor: '#2563eb',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
                        }}
                    >
                        <Plus size={16} />
                        <span>Add Savings Account</span>
                    </button>
                </div>
            </div>

            {/* Split Allocation Panel */}
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
                        <h4 style={{ fontSize: '0.875rem', fontWeight: '800', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Asset Value Allocation</h4>
                        {pieData.map((entry, index) => {
                            const percentage = ((entry.value / totalPortfolioValue) * 100).toFixed(1);
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

            {/* Savings Accounts Listings */}
            {activeSavings.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem 1.5rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '1.5rem',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    marginBottom: '2rem'
                }}>
                    <Target style={{ color: '#71717a', marginBottom: '1.5rem' }} size={48} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', marginBottom: '0.5rem' }}>No Active Savings Yet</h3>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>Start tracking your financial goals by adding your first savings account or deposit.</p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        style={{
                            padding: '0.625rem 1.5rem',
                            borderRadius: '0.75rem',
                            backgroundColor: '#2563eb',
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
                    {/* Gratuity Benefit Card (Auto-Synced from Salary) */}
                    <div
                        onClick={() => navigate('/salary')}
                        style={{
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(24, 24, 27, 0.6) 100%)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '1.5rem',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '1.5rem',
                            position: 'relative',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            height: '220px',
                            boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.1)'
                        }}
                        className="hover:scale-[1.02] transition-transform"
                    >
                        <div style={{ position: 'absolute', top: 0, right: 0, padding: '1.5rem', opacity: 0.08, color: '#34d399' }}>
                            <Award size={64} />
                        </div>

                        <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
                                        Employee Gratuity
                                    </h3>
                                    <ArrowUpRight size={18} style={{ color: '#34d399' }} />
                                </div>
                                <span style={{
                                    fontSize: '9px',
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '9999px',
                                    fontWeight: '800',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    width: 'fit-content',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                    color: '#34d399'
                                }}>
                                    Retirement Benefit
                                </span>
                            </div>

                            <div style={{ marginTop: 'auto' }}>
                                <p style={{ fontSize: '10px', color: '#a1a1aa', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em', margin: '0 0 0.125rem 0' }}>
                                    Accumulated Gratuity (Till Now)
                                </p>
                                <p style={{ fontSize: '1.75rem', fontWeight: '950', color: '#34d399', fontFamily: 'monospace', margin: 0 }}>
                                    {formatCurrency(totalGratuityTillNow)}
                                </p>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem', fontSize: '10px', fontWeight: '900', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <Award size={14} />
                                    <span>Synced with Salary &amp; Company Tenures</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {activeSavings.map(item => {
                        const progress = item.goal > 0 ? Math.min((item.amount / item.goal) * 100, 100) : 0;
                        const isStockMarket = item.type === 'stock_market';
                        const isMutualFund = item.type === 'mutual_fund';
                        const isFixedDeposit = item.type === 'fixed_deposit';
                        const isSavingsAccount = item.type === 'savings_account';
                        const isRecurringDeposit = item.type === 'recurring_deposit';
                        const isPolicy = item.type === 'policy' || item.type === 'Policy';
                        const isPPF = item.type === 'ppf';
                        const isNPS = item.type === 'nps';
                        const isSGB = item.type === 'sgb';
                        const isLiquid = item.type === 'liquid';
                        const isPF = item.type === 'pf';

                        const style = getStyle(item.type);
                        const displayAmount = calculateItemCurrentValue(item);
                        const showProgress = item.goal > 0 && !isStockMarket && !isPolicy && !isFixedDeposit && !isLiquid && !isPPF && !isNPS && !isSGB && !isSavingsAccount && !isRecurringDeposit && !isPF;

                        const handleClick = () => {
                            if (isMutualFund) { navigate(`/savings/mutual-fund/${item.id}`); }
                            else if (isFixedDeposit) { navigate(`/savings/fixed-deposit/${item.id}`); }
                            else if (isPolicy) { navigate(`/savings/policy/${item.id}`); }
                            else if (isStockMarket) { navigate(`/savings/stock-market/${item.id}`); }
                            else if (isPPF) { navigate(`/savings/ppf/${item.id}`); }
                            else if (isNPS) { navigate(`/savings/nps/${item.id}`); }
                            else if (isSGB) { navigate(`/savings/sgb/${item.id}`); }
                            else if (isLiquid) { navigate(`/savings/emergency-fund/${item.id}`); }
                            else if (isSavingsAccount) { navigate(`/savings/savings-account/${item.id}`); }
                            else if (isRecurringDeposit) { navigate(`/savings/recurring-deposit/${item.id}`); }
                            else if (isPF) { navigate(`/savings/pf/${item.id}`); }
                        };

                        // Decide border color based on category
                        let borderStyle = '1px solid rgba(255, 255, 255, 0.05)';
                        if (isPF || isPPF || isNPS) { borderStyle = '1px solid rgba(99, 102, 241, 0.15)'; } // indigo
                        else if (isFixedDeposit || isRecurringDeposit || isSavingsAccount) { borderStyle = '1px solid rgba(59, 130, 246, 0.15)'; } // blue
                        else if (isPolicy) { borderStyle = '1px solid rgba(245, 158, 11, 0.15)'; } // orange
                        else { borderStyle = '1px solid rgba(16, 185, 129, 0.15)'; } // green

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
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
                                }}
                            >
                                <div style={{ position: 'absolute', top: 0, right: 0, padding: '1.5rem', opacity: 0.05, color: '#a1a1aa' }}>
                                    {getIcon(item.type)}
                                </div>

                                <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
                                                {item.title || item.name}
                                            </h3>
                                            <Edit2 
                                                size={13} 
                                                style={{ color: '#818cf8', opacity: 0.6, cursor: 'pointer' }}
                                                onClick={(e) => handleEditClick(e, item)}
                                                title="Edit Account Name"
                                            />
                                        </div>
                                        <span style={{
                                            fontSize: '9px',
                                            padding: '0.125rem 0.5rem',
                                            borderRadius: '9999px',
                                            fontWeight: '800',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em',
                                            width: 'fit-content',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                            color: '#a1a1aa'
                                        }}>
                                            {item.type.replace('_', ' ')}
                                        </span>
                                    </div>

                                    <div style={{ marginTop: 'auto' }}>
                                        <p style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em', margin: '0 0 0.125rem 0' }}>Current Balance</p>
                                        <p style={{ fontSize: '1.75rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(displayAmount)}</p>

                                        {/* Profit/Loss or Interest Display */}
                                        {(isStockMarket || isMutualFund || isFixedDeposit || isPPF || isNPS || isSGB || isSavingsAccount || isRecurringDeposit || isPF) && (
                                            (() => {
                                                if (isFixedDeposit || isRecurringDeposit || isPPF || isSavingsAccount) {
                                                    const invested = calculateItemInvestedValue(item);
                                                    const totalInterest = displayAmount - invested;
                                                    return (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem', fontSize: '10px', fontWeight: '900', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                            <TrendingUp size={14} />
                                                            <span>{formatCurrency(totalInterest)} Interest</span>
                                                        </div>
                                                    );
                                                }

                                                const invested = calculateItemInvestedValue(item);
                                                const pl = displayAmount - invested;
                                                const isProfit = pl >= 0;
                                                const plPercent = invested > 0 ? (pl / invested) * 100 : 0;

                                                return (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem', fontSize: '10px', fontWeight: '900', color: isProfit ? '#10b981' : '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                        <span>{formatCurrency(Math.abs(pl))} ({plPercent.toFixed(1)}%)</span>
                                                    </div>
                                                );
                                            })()
                                        )}

                                        {showProgress && (
                                            <div style={{ marginTop: '0.75rem' }}>
                                                <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${progress}%`, backgroundColor: '#3b82f6' }}></div>
                                                </div>
                                                <div style={{ marginTop: '0.25rem', fontSize: '9px', fontWeight: 'bold', color: '#71717a', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    {progress.toFixed(1)}% Goal
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', gap: '0.375rem', zIndex: 20 }}>
                                    <button
                                        onClick={(e) => handleEditClick(e, item)}
                                        style={{
                                            padding: '0.5rem',
                                            borderRadius: '0.5rem',
                                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                            color: '#60a5fa',
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                        title="Edit Account Name & Details"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => handleArchiveClick(e, item)}
                                        style={{
                                            padding: '0.5rem',
                                            borderRadius: '0.5rem',
                                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                            color: '#fbbf24',
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                        title="Archive Account"
                                    >
                                        <Archive size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDeleteClick(e, item)}
                                        style={{
                                            padding: '0.5rem',
                                            borderRadius: '0.5rem',
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                            color: '#f87171',
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                        title="Delete Account"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Archived Savings Accounts */}
            {archivedSavings.length > 0 && (
                <div style={{ marginTop: '3.5rem', paddingTop: '2rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#71717a', letterSpacing: '-0.025em', margin: 0 }}>Archived Accounts</h3>
                            <p style={{ fontSize: '10px', color: '#52525b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.25rem', margin: 0 }}>Hidden from main savings valuation</p>
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
                            {showArchived ? 'Hide Archived' : 'Show Archived'} ({archivedSavings.length})
                        </button>
                    </div>

                    {showArchived && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '1.5rem',
                            opacity: 0.6
                        }}>
                            {archivedSavings.map(item => {
                                const displayAmount = calculateItemCurrentValue(item);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => {
                                            if (item.type === 'fixed_deposit') navigate(`/savings/fixed-deposit/${item.id}`);
                                            else if (item.type === 'policy') navigate(`/savings/policy/${item.id}`);
                                            else if (item.type === 'ppf') navigate(`/savings/ppf/${item.id}`);
                                            else if (item.type === 'nps') navigate(`/savings/nps/${item.id}`);
                                            else if (item.type === 'savings_account') navigate(`/savings/savings-account/${item.id}`);
                                            else if (item.type === 'recurring_deposit') navigate(`/savings/recurring-deposit/${item.id}`);
                                            else if (item.type === 'pf') navigate(`/savings/pf/${item.id}`);
                                        }}
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
                                                    Archived {item.type.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#a1a1aa', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(displayAmount)}</p>
                                            </div>
                                        </div>
                                        <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', gap: '0.375rem', zIndex: 20 }}>
                                            <button
                                                onClick={(e) => handleArchiveClick(e, item)}
                                                style={{
                                                    padding: '0.375rem',
                                                    borderRadius: '0.375rem',
                                                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                                    color: '#fbbf24',
                                                    border: 'none',
                                                    cursor: 'pointer'
                                                }}
                                                title="Unarchive Account"
                                            >
                                                <ArchiveRestore size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteClick(e, item)}
                                                style={{
                                                    padding: '0.375rem',
                                                    borderRadius: '0.375rem',
                                                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                                    color: '#f87171',
                                                    border: 'none',
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

            <SavingsItemModal
                isOpen={isModalOpen}
                initialData={editingItem}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingItem(null);
                }}
                onSave={handleSaveItem}
            />

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setItemToDelete(null);
                }}
                onConfirm={confirmDelete}
                title="Delete Savings Account"
                message={`Are you sure you want to delete "${itemToDelete?.title}"? This action cannot be undone.`}
                confirmText="Delete"
            />
        </div >
    );
};

export default Savings;
