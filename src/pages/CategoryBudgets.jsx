import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { calculateBudgetStatus, generateBudgetSuggestions } from '../utils/budgetUtils';
import { Target, TrendingUp, AlertTriangle, CheckCircle2, Sparkles, ChevronDown, ChevronUp, Save, RotateCcw, ShieldAlert, Zap, Wallet, Info } from 'lucide-react';

const CategoryBudgets = () => {
    const { expenses, categoryBudgets, updateCategoryBudget, saveCategoryBudgets, mergedCategoryMap, formatCurrency } = useFinance();

    // Year and Month selection for comparing budget vs actuals
    const availableYears = useMemo(() => Object.keys(expenses || {}).sort().reverse(), [expenses]);
    const currentYearStr = new Date().getFullYear().toString();
    const [selectedYear, setSelectedYear] = useState(availableYears.includes(currentYearStr) ? currentYearStr : (availableYears[0] || currentYearStr));

    const monthsInYear = useMemo(() => {
        if (!expenses?.[selectedYear]) return [];
        return Object.keys(expenses[selectedYear]);
    }, [expenses, selectedYear]);

    const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
    const [selectedMonth, setSelectedMonth] = useState(() => {
        if (monthsInYear.includes(currentMonthName)) return currentMonthName;
        return monthsInYear[monthsInYear.length - 1] || currentMonthName;
    });

    // Local state for editing budget limits before persisting
    const [localBudgets, setLocalBudgets] = useState({ ...categoryBudgets });
    const [expandedCategories, setExpandedCategories] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Keep localBudgets synced if categoryBudgets updates externally
    React.useEffect(() => {
        setLocalBudgets({ ...categoryBudgets });
    }, [categoryBudgets]);

    // Categories to display (exclude Income, Transfers, Investments, Loans from spending targets)
    const EXCLUDED_MAIN_CATEGORIES = ['Income', 'Transfers', 'Investments', 'Loans'];
    
    const displayMainCategories = useMemo(() => {
        return Object.keys(mergedCategoryMap).filter(cat => !EXCLUDED_MAIN_CATEGORIES.includes(cat));
    }, [mergedCategoryMap]);

    // Calculate actual spending per category & sub-category for the selected month
    const actualSpending = useMemo(() => {
        const monthData = expenses?.[selectedYear]?.[selectedMonth];
        const subCatSpend = {};
        const mainCatSpend = {};

        if (monthData?.transactions) {
            monthData.transactions.forEach(tx => {
                // Ignore income / credit transactions for spending
                if (tx.isCredited || tx.transactionType === 'credit') return;

                const cat = tx.category || 'Miscellaneous';
                const mainCat = tx.mainCategory || 'Miscellaneous';
                const amt = Number(tx.amount) || 0;

                subCatSpend[cat] = (subCatSpend[cat] || 0) + amt;
                mainCatSpend[mainCat] = (mainCatSpend[mainCat] || 0) + amt;
            });
        }
        return { subCatSpend, mainCatSpend };
    }, [expenses, selectedYear, selectedMonth]);

    // Calculate historical spending data per category for Smart Suggestions
    const getCategoryHistory = (catName) => {
        const history = [];
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        Object.keys(expenses || {}).sort().forEach(year => {
            monthNames.forEach(month => {
                if (expenses[year]?.[month]?.transactions) {
                    let total = 0;
                    expenses[year][month].transactions.forEach(tx => {
                        if (tx.isCredited || tx.transactionType === 'credit') return;
                        if (tx.category === catName || tx.mainCategory === catName) {
                            total += Number(tx.amount) || 0;
                        }
                    });
                    if (total > 0) {
                        history.push({ month: `${year}-${month}`, amount: total });
                    }
                }
            });
        });
        return history;
    };

    const handleBudgetChange = (catKey, value) => {
        const numVal = value === '' ? 0 : Math.max(0, Number(value));
        setLocalBudgets(prev => ({
            ...prev,
            [catKey]: numVal
        }));
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        await saveCategoryBudgets(localBudgets);
        setIsSaving(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
    };

    const handleApplySuggestion = (catKey) => {
        const history = getCategoryHistory(catKey);
        const suggestion = generateBudgetSuggestions(history, catKey);
        if (suggestion.suggestedBudget > 0) {
            handleBudgetChange(catKey, suggestion.suggestedBudget);
        }
    };

    const handleApplyAllSuggestions = () => {
        const newBudgets = { ...localBudgets };
        displayMainCategories.forEach(mainCat => {
            const subCats = mergedCategoryMap[mainCat] || [];
            subCats.forEach(sub => {
                const history = getCategoryHistory(sub);
                const sug = generateBudgetSuggestions(history, sub);
                if (sug.suggestedBudget > 0) {
                    newBudgets[sub] = sug.suggestedBudget;
                }
            });
            const mainHistory = getCategoryHistory(mainCat);
            const mainSug = generateBudgetSuggestions(mainHistory, mainCat);
            if (mainSug.suggestedBudget > 0) {
                newBudgets[mainCat] = mainSug.suggestedBudget;
            }
        });
        setLocalBudgets(newBudgets);
    };

    const toggleExpand = (mainCat) => {
        setExpandedCategories(prev => ({ ...prev, [mainCat]: !prev[mainCat] }));
    };

    // Calculate Summary Stats
    const stats = useMemo(() => {
        let totalTarget = 0;
        let totalActual = 0;
        let overBudgetCount = 0;
        let warningCount = 0;
        let safeCount = 0;
        let totalTrackedCategories = 0;

        displayMainCategories.forEach(mainCat => {
            const subCats = mergedCategoryMap[mainCat] || [];
            subCats.forEach(subCat => {
                const target = Number(localBudgets[subCat]) || 0;
                const actual = actualSpending.subCatSpend[subCat] || 0;
                
                if (target > 0) {
                    totalTarget += target;
                    totalTrackedCategories++;
                    const statusInfo = calculateBudgetStatus(target, actual);
                    if (statusInfo.status === 'overspent') overBudgetCount++;
                    else if (statusInfo.status === 'warning') warningCount++;
                    else safeCount++;
                }
                totalActual += actual;
            });
        });

        const healthScore = totalTrackedCategories > 0 
            ? Math.round(((totalTrackedCategories - overBudgetCount) / totalTrackedCategories) * 100) 
            : 100;

        return { totalTarget, totalActual, overBudgetCount, warningCount, safeCount, totalTrackedCategories, healthScore };
    }, [displayMainCategories, mergedCategoryMap, localBudgets, actualSpending]);

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header Section */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Target style={{ color: '#10b981' }} size={32} /> Category Budget Limits
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', margin: '0.25rem 0 0 0' }}>Set monthly spending targets for categories & sub-categories to keep your finances on track</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Month & Year Filter */}
                    <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '4px', gap: '4px' }}>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            style={{ backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '12px', fontWeight: 'bold', padding: '0.375rem 0.75rem', outline: 'none', cursor: 'pointer' }}
                        >
                            {availableYears.map(y => <option key={y} value={y} style={{ backgroundColor: '#18181b' }}>{y}</option>)}
                        </select>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            style={{ backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '12px', fontWeight: 'bold', padding: '0.375rem 0.75rem', outline: 'none', cursor: 'pointer' }}
                        >
                            {monthsInYear.map(m => <option key={m} value={m} style={{ backgroundColor: '#18181b' }}>{m}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={handleApplyAllSuggestions}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.625rem 1.25rem',
                            borderRadius: '1rem',
                            backgroundColor: 'rgba(139, 92, 246, 0.15)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            color: '#c084fc',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        className="hover:bg-purple-500/20"
                    >
                        <Sparkles size={16} />
                        <span>Auto-Suggest All</span>
                    </button>

                    <button
                        onClick={handleSaveAll}
                        disabled={isSaving}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.625rem 1.5rem',
                            borderRadius: '1rem',
                            backgroundColor: saveSuccess ? '#10b981' : '#2563eb',
                            border: 'none',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
                        }}
                    >
                        <Save size={16} />
                        <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save All Targets'}</span>
                    </button>
                </div>
            </div>

            {/* Summary Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.25rem' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
                        Total Target Budget
                    </div>
                    <div style={{ fontSize: '1.625rem', fontWeight: '950', color: 'white', fontFamily: 'monospace' }}>
                        {formatCurrency(stats.totalTarget)}
                    </div>
                    <div style={{ fontSize: '10px', color: '#71717a', marginTop: '0.375rem' }}>
                        {stats.totalTrackedCategories} categories with targets
                    </div>
                </div>

                <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.25rem' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
                        Actual Spend ({selectedMonth})
                    </div>
                    <div style={{ fontSize: '1.625rem', fontWeight: '950', color: stats.totalActual > stats.totalTarget && stats.totalTarget > 0 ? '#ef4444' : '#34d399', fontFamily: 'monospace' }}>
                        {formatCurrency(stats.totalActual)}
                    </div>
                    <div style={{ fontSize: '10px', color: '#71717a', marginTop: '0.375rem' }}>
                        {selectedMonth} {selectedYear} total
                    </div>
                </div>

                <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.4)', backdropFilter: 'blur(10px)', border: `1px solid ${stats.overBudgetCount > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.2)'}`, borderRadius: '1.25rem', padding: '1.25rem' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        {stats.overBudgetCount > 0 ? <AlertTriangle size={14} style={{ color: '#f87171' }} /> : <CheckCircle2 size={14} style={{ color: '#34d399' }} />}
                        Over Budget
                    </div>
                    <div style={{ fontSize: '1.625rem', fontWeight: '950', color: stats.overBudgetCount > 0 ? '#ef4444' : '#34d399' }}>
                        {stats.overBudgetCount} <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#71717a' }}>Categories</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#71717a', marginTop: '0.375rem' }}>
                        {stats.warningCount} near limit (≥80%)
                    </div>
                </div>

                <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.25rem' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
                        Budget Health Score
                    </div>
                    <div style={{ fontSize: '1.625rem', fontWeight: '950', color: stats.healthScore >= 80 ? '#34d399' : stats.healthScore >= 50 ? '#fbbf24' : '#ef4444' }}>
                        {stats.healthScore}%
                    </div>
                    <div style={{ fontSize: '10px', color: '#71717a', marginTop: '0.375rem' }}>
                        {stats.safeCount} categories under limit
                    </div>
                </div>
            </div>

            {/* Categories List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {displayMainCategories.map(mainCat => {
                    const subCats = mergedCategoryMap[mainCat] || [];
                    const isExpanded = expandedCategories[mainCat] !== false; // Default expanded

                    // Main Category calculations
                    const mainTarget = Number(localBudgets[mainCat]) || 0;
                    const subTargetsSum = subCats.reduce((sum, sub) => sum + (Number(localBudgets[sub]) || 0), 0);
                    const effectiveMainTarget = mainTarget > 0 ? mainTarget : subTargetsSum;
                    const mainActual = actualSpending.mainCatSpend[mainCat] || 0;
                    const mainStatus = calculateBudgetStatus(effectiveMainTarget, mainActual);

                    const isMainOver = mainStatus.status === 'overspent';
                    const isMainWarn = mainStatus.status === 'warning';
                    const mainPct = Math.min(100, Math.round(mainStatus.percentageUsed));

                    return (
                        <div
                            key={mainCat}
                            style={{
                                backgroundColor: 'rgba(24, 24, 27, 0.4)',
                                backdropFilter: 'blur(10px)',
                                border: `1px solid ${isMainOver ? 'rgba(239, 68, 68, 0.3)' : isMainWarn ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                                borderRadius: '1.5rem',
                                padding: '1.5rem',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {/* Main Category Header Row */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', cursor: 'pointer' }} onClick={() => toggleExpand(mainCat)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '1rem',
                                        backgroundColor: isMainOver ? 'rgba(239, 68, 68, 0.15)' : isMainWarn ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                        color: isMainOver ? '#f87171' : isMainWarn ? '#fbbf24' : '#34d399',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: '900'
                                    }}>
                                        <Wallet size={20} />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: 0 }}>{mainCat}</h3>
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: '800',
                                                padding: '0.125rem 0.5rem',
                                                borderRadius: '0.375rem',
                                                backgroundColor: isMainOver ? 'rgba(239, 68, 68, 0.2)' : isMainWarn ? 'rgba(245, 158, 11, 0.2)' : effectiveMainTarget > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                                                color: isMainOver ? '#f87171' : isMainWarn ? '#fbbf24' : effectiveMainTarget > 0 ? '#34d399' : '#71717a',
                                                textTransform: 'uppercase'
                                            }}>
                                                {isMainOver ? '🔴 Over Budget' : isMainWarn ? '🟡 Near Limit' : effectiveMainTarget > 0 ? '🟢 Under Budget' : '⚪ No Target'}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '11px', color: '#71717a', margin: '0.125rem 0 0 0' }}>
                                            Actual: <strong style={{ color: 'white', fontFamily: 'monospace' }}>{formatCurrency(mainActual)}</strong>
                                            {effectiveMainTarget > 0 && <> / Target: <span style={{ color: '#a1a1aa', fontFamily: 'monospace' }}>{formatCurrency(effectiveMainTarget)}</span> ({mainPct}%)</>}
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }} onClick={(e) => e.stopPropagation()}>
                                    {/* Main Category Direct Budget Input */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 'bold' }}>Category Cap: ₹</span>
                                        <input
                                            type="number"
                                            placeholder={subTargetsSum > 0 ? `Sub-sum: ${subTargetsSum}` : "Set Cap"}
                                            value={localBudgets[mainCat] || ''}
                                            onChange={(e) => handleBudgetChange(mainCat, e.target.value)}
                                            style={{
                                                width: '120px',
                                                backgroundColor: 'rgba(0,0,0,0.4)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '0.75rem',
                                                padding: '0.4rem 0.75rem',
                                                color: 'white',
                                                fontSize: '0.875rem',
                                                fontFamily: 'monospace',
                                                fontWeight: 'bold',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>

                                    <button
                                        onClick={() => toggleExpand(mainCat)}
                                        style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '0.25rem' }}
                                    >
                                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </button>
                                </div>
                            </div>

                            {/* Main Category Progress Bar */}
                            {effectiveMainTarget > 0 && (
                                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginTop: '1rem', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${mainPct}%`,
                                        height: '100%',
                                        backgroundColor: isMainOver ? '#ef4444' : isMainWarn ? '#f59e0b' : '#10b981',
                                        borderRadius: '3px',
                                        transition: 'width 0.3s ease'
                                    }} />
                                </div>
                            )}

                            {/* Sub-Categories Accordion Content */}
                            {isExpanded && subCats.length > 0 && (
                                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                                        Sub-Category Limits ({subCats.length})
                                    </div>

                                    {subCats.map(subCat => {
                                        const subTarget = Number(localBudgets[subCat]) || 0;
                                        const subActual = actualSpending.subCatSpend[subCat] || 0;
                                        const subStatus = calculateBudgetStatus(subTarget, subActual);

                                        const isSubOver = subStatus.status === 'overspent';
                                        const isSubWarn = subStatus.status === 'warning';
                                        const subPct = Math.min(100, Math.round(subStatus.percentageUsed));

                                        return (
                                            <div
                                                key={subCat}
                                                style={{
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '0.875rem',
                                                    backgroundColor: 'rgba(0,0,0,0.2)',
                                                    borderRadius: '1rem',
                                                    padding: '0.75rem 1rem',
                                                    border: `1px solid ${isSubOver ? 'rgba(239, 68, 68, 0.2)' : isSubWarn ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.03)'}`
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1', minWidth: '180px' }}>
                                                    {/* Status Dot */}
                                                    <div style={{
                                                        width: '10px',
                                                        height: '10px',
                                                        borderRadius: '50%',
                                                        backgroundColor: isSubOver ? '#ef4444' : isSubWarn ? '#f59e0b' : subTarget > 0 ? '#10b981' : '#52525b',
                                                        boxShadow: isSubOver ? '0 0 8px rgba(239, 68, 68, 0.5)' : isSubWarn ? '0 0 8px rgba(245, 158, 11, 0.5)' : subTarget > 0 ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none'
                                                    }} />

                                                    <div>
                                                        <div style={{ fontSize: '0.875rem', fontWeight: '800', color: 'white' }}>{subCat}</div>
                                                        <div style={{ fontSize: '11px', color: '#71717a' }}>
                                                            Spent: <strong style={{ color: 'white', fontFamily: 'monospace' }}>{formatCurrency(subActual)}</strong>
                                                            {subTarget > 0 && (
                                                                <span style={{ marginLeft: '0.5rem', color: isSubOver ? '#f87171' : isSubWarn ? '#fbbf24' : '#34d399' }}>
                                                                    ({isSubOver ? `+${formatCurrency(subActual - subTarget)} over` : `${formatCurrency(subTarget - subActual)} left`})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <button
                                                        onClick={() => handleApplySuggestion(subCat)}
                                                        title="Auto-suggest limit based on 3-month spending average"
                                                        style={{
                                                            padding: '0.375rem 0.625rem',
                                                            borderRadius: '0.625rem',
                                                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                                            border: '1px solid rgba(139, 92, 246, 0.25)',
                                                            color: '#c084fc',
                                                            fontSize: '10px',
                                                            fontWeight: '800',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.25rem'
                                                        }}
                                                    >
                                                        <Sparkles size={12} /> Suggest
                                                    </button>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                        <span style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: 'bold' }}>Limit: ₹</span>
                                                        <input
                                                            type="number"
                                                            placeholder="0"
                                                            value={localBudgets[subCat] || ''}
                                                            onChange={(e) => handleBudgetChange(subCat, e.target.value)}
                                                            style={{
                                                                width: '100px',
                                                                backgroundColor: 'rgba(0,0,0,0.5)',
                                                                border: '1px solid rgba(255,255,255,0.1)',
                                                                borderRadius: '0.625rem',
                                                                padding: '0.35rem 0.625rem',
                                                                color: 'white',
                                                                fontSize: '0.8125rem',
                                                                fontFamily: 'monospace',
                                                                fontWeight: 'bold',
                                                                outline: 'none'
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CategoryBudgets;
