import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { calculateBudgetStatus, generateBudgetSuggestions } from '../utils/budgetUtils';
import { Target, TrendingUp, AlertTriangle, CheckCircle2, Sparkles, ChevronDown, ChevronUp, Save, RotateCcw, ShieldAlert, Zap, Wallet, Info, Edit2, Trash2, Check, X, Plus, PiggyBank, BarChart3, HelpCircle } from 'lucide-react';

const CategoryBudgets = () => {
    const { 
        expenses, 
        categoryBudgets, 
        saveCategoryBudgets, 
        mergedCategoryMap, 
        saveCustomCategoryMap,
        deleteCategoryFromMap,
        renameCategoryInTransactions,
        formatCurrency 
    } = useFinance();

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

    // Local states
    const [localBudgets, setLocalBudgets] = useState({ ...categoryBudgets });
    const [expandedCategories, setExpandedCategories] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Saving Mode: 'normal' (average-based), 'saver' (10% lower), 'super' (20% lower)
    const [savingStrategy, setSavingStrategy] = useState('saver');

    // Editing Categories State
    const [editingKey, setEditingKey] = useState(null); // { type: 'main'|'sub', mainCat: string, subCat?: string }
    const [editValue, setEditValue] = useState('');
    const [newMainCategoryName, setNewMainCategoryName] = useState('');
    const [newSubCategoryNames, setNewSubCategoryNames] = useState({}); // mainCat -> name
    const [showAddMainForm, setShowAddMainForm] = useState(false);

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

    const getAdjustedSuggestion = (catKey) => {
        const history = getCategoryHistory(catKey);
        const suggestion = generateBudgetSuggestions(history, catKey);
        let baseVal = suggestion.suggestedBudget;
        
        if (baseVal <= 0) return 0;

        // Apply savings strategy discount
        if (savingStrategy === 'saver') {
            baseVal = baseVal * 0.90; // 10% savings target
        } else if (savingStrategy === 'super') {
            baseVal = baseVal * 0.80; // 20% savings target
        }

        return Math.ceil(baseVal / 100) * 100;
    };

    const handleApplySuggestion = (catKey) => {
        const adjustedVal = getAdjustedSuggestion(catKey);
        if (adjustedVal > 0) {
            handleBudgetChange(catKey, adjustedVal);
        }
    };

    const handleApplyAllSuggestions = () => {
        const newBudgets = { ...localBudgets };
        displayMainCategories.forEach(mainCat => {
            const subCats = mergedCategoryMap[mainCat] || [];
            subCats.forEach(sub => {
                const adjustedSub = getAdjustedSuggestion(sub);
                if (adjustedSub > 0) {
                    newBudgets[sub] = adjustedSub;
                }
            });
            const adjustedMain = getAdjustedSuggestion(mainCat);
            if (adjustedMain > 0) {
                newBudgets[mainCat] = adjustedMain;
            }
        });
        setLocalBudgets(newBudgets);
    };

    const toggleExpand = (mainCat) => {
        setExpandedCategories(prev => ({ ...prev, [mainCat]: !prev[mainCat] }));
    };

    // Category Map CRUD Actions
    const startEditing = (type, mainCat, subCat = null) => {
        setEditingKey({ type, mainCat, subCat });
        setEditValue(subCat || mainCat);
    };

    const cancelEditing = () => {
        setEditingKey(null);
        setEditValue('');
    };

    const confirmRename = async () => {
        if (!editValue.trim() || !editingKey) return;

        const newMap = { ...mergedCategoryMap };
        const { type, mainCat, subCat } = editingKey;
        const oldName = subCat || mainCat;
        const newName = editValue.trim();

        if (oldName === newName) {
            cancelEditing();
            return;
        }

        if (type === 'main') {
            // Rename key in map
            newMap[newName] = newMap[mainCat];
            delete newMap[mainCat];
        } else {
            // Rename inside sub-categories array
            newMap[mainCat] = newMap[mainCat].map(sub => sub === subCat ? newName : sub);
        }

        // Rename budget limits associated with this category
        const updatedBudgets = { ...localBudgets };
        if (updatedBudgets[oldName] !== undefined) {
            updatedBudgets[newName] = updatedBudgets[oldName];
            delete updatedBudgets[oldName];
            setLocalBudgets(updatedBudgets);
            await saveCategoryBudgets(updatedBudgets);
        }

        await saveCustomCategoryMap(newMap);
        cancelEditing();

        // Ask or notify about updating historical records
        if (window.confirm(`Do you want to rename "${oldName}" to "${newName}" in your historical transaction records too for consistency?`)) {
            await renameCategoryInTransactions(oldName, newName, type === 'main');
        }
    };

    const handleDeleteCategory = async (type, mainCat, subCat = null) => {
        const categoryName = subCat || mainCat;
        const msg = type === 'main' 
            ? `Are you sure you want to delete the main category "${mainCat}" and all of its sub-categories? Historical transaction data won't be deleted, but this category won't show in lists.` 
            : `Are you sure you want to delete the sub-category "${subCat}" under "${mainCat}"?`;

        if (!window.confirm(msg)) return;

        // Clean up budgets
        const updatedBudgets = { ...localBudgets };
        delete updatedBudgets[categoryName];
        setLocalBudgets(updatedBudgets);
        await saveCategoryBudgets(updatedBudgets);

        // Delete from category map state and persist to database
        await deleteCategoryFromMap(mainCat, subCat);
    };

    const handleAddMainCategory = async () => {
        if (!newMainCategoryName.trim()) return;
        const name = newMainCategoryName.trim();
        
        if (mergedCategoryMap[name]) {
            alert('Main category already exists!');
            return;
        }

        const newMap = { ...mergedCategoryMap, [name]: [] };
        await saveCustomCategoryMap(newMap);
        setNewMainCategoryName('');
        setShowAddMainForm(false);
    };

    const handleAddSubCategory = async (mainCat) => {
        const subName = newSubCategoryNames[mainCat]?.trim();
        if (!subName) return;

        const newMap = { ...mergedCategoryMap };
        if (!newMap[mainCat]) newMap[mainCat] = [];

        if (newMap[mainCat].includes(subName)) {
            alert('Sub-category already exists in this group!');
            return;
        }

        newMap[mainCat] = [...newMap[mainCat], subName];
        await saveCustomCategoryMap(newMap);
        
        setNewSubCategoryNames(prev => ({ ...prev, [mainCat]: '' }));
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

        // Calculate potential savings based on average spend vs proposed target
        let totalHistoricalAvg = 0;
        displayMainCategories.forEach(mainCat => {
            const history = getCategoryHistory(mainCat);
            if (history.length > 0) {
                const sum = history.reduce((acc, h) => acc + h.amount, 0);
                totalHistoricalAvg += sum / history.length;
            }
        });

        const projectedSavings = totalHistoricalAvg > totalTarget ? (totalHistoricalAvg - totalTarget) : 0;
        const healthScore = totalTrackedCategories > 0 
            ? Math.round(((totalTrackedCategories - overBudgetCount) / totalTrackedCategories) * 100) 
            : 100;

        return { 
            totalTarget, 
            totalActual, 
            overBudgetCount, 
            warningCount, 
            safeCount, 
            totalTrackedCategories, 
            healthScore,
            totalHistoricalAvg,
            projectedSavings
        };
    }, [displayMainCategories, mergedCategoryMap, localBudgets, actualSpending]);

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Header Section */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '950', color: 'white', letterSpacing: '-0.025em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Target style={{ color: '#10b981' }} size={32} /> Budget Targets & Category Manager
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', margin: '0.25rem 0 0 0' }}>Manage category mappings and budget limits to optimize your financial habits.</p>
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
                        onClick={() => setShowAddMainForm(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.625rem 1.25rem',
                            borderRadius: '1rem',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer',
                        }}
                    >
                        <Plus size={14} /> Add Category
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
                        <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Targets'}</span>
                    </button>
                </div>
            </div>

            {/* Smart Savings Optimization Control */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(217, 70, 239, 0.05) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '1.5rem',
                padding: '1.5rem',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '1rem',
                        backgroundColor: 'rgba(139, 92, 246, 0.2)',
                        color: '#c084fc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <PiggyBank size={24} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: '900', color: 'white', margin: 0 }}>🛡️ Optimize Saving Strategy</h4>
                        <p style={{ fontSize: '0.8125rem', color: '#a1a1aa', margin: '0.125rem 0 0 0' }}>Analyze transaction history to automatically set targets that help you save.</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', backgroundColor: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <button
                            onClick={() => setSavingStrategy('normal')}
                            style={{
                                padding: '0.375rem 0.875rem',
                                borderRadius: '0.5rem',
                                border: 'none',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: savingStrategy === 'normal' ? 'white' : '#71717a',
                                backgroundColor: savingStrategy === 'normal' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                cursor: 'pointer'
                            }}
                        >
                            Balanced
                        </button>
                        <button
                            onClick={() => setSavingStrategy('saver')}
                            style={{
                                padding: '0.375rem 0.875rem',
                                borderRadius: '0.5rem',
                                border: 'none',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: savingStrategy === 'saver' ? '#c084fc' : '#71717a',
                                backgroundColor: savingStrategy === 'saver' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                                cursor: 'pointer'
                            }}
                        >
                            Saver (-10%)
                        </button>
                        <button
                            onClick={() => setSavingStrategy('super')}
                            style={{
                                padding: '0.375rem 0.875rem',
                                borderRadius: '0.5rem',
                                border: 'none',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: savingStrategy === 'super' ? '#f472b6' : '#71717a',
                                backgroundColor: savingStrategy === 'super' ? 'rgba(219, 39, 119, 0.2)' : 'transparent',
                                cursor: 'pointer'
                            }}
                        >
                            Super Saver (-20%)
                        </button>
                    </div>

                    <button
                        onClick={handleApplyAllSuggestions}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1.25rem',
                            borderRadius: '0.75rem',
                            backgroundColor: '#8b5cf6',
                            border: 'none',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)'
                        }}
                    >
                        <Sparkles size={14} /> Calculate & Pre-populate
                    </button>
                </div>
            </div>

            {/* Main KPI Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.25rem' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Target Budget</span>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: '950', color: 'white', margin: '0.25rem 0', fontFamily: 'monospace' }}>
                        {formatCurrency(stats.totalTarget)}
                    </h3>
                    <span style={{ fontSize: '11px', color: '#71717a' }}>{stats.totalTrackedCategories} categories customized</span>
                </div>

                <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.25rem' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actual Spend ({selectedMonth})</span>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: '950', color: stats.totalActual > stats.totalTarget && stats.totalTarget > 0 ? '#ef4444' : '#34d399', margin: '0.25rem 0', fontFamily: 'monospace' }}>
                        {formatCurrency(stats.totalActual)}
                    </h3>
                    <span style={{ fontSize: '11px', color: '#71717a' }}>
                        {stats.totalTarget > 0 ? `${Math.round((stats.totalActual / stats.totalTarget) * 100)}% of limit spent` : 'No limits configured'}
                    </span>
                </div>

                <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.25rem' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Projected Savings</span>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: '950', color: '#c084fc', margin: '0.25rem 0', fontFamily: 'monospace' }}>
                        {formatCurrency(stats.projectedSavings)}
                    </h3>
                    <span style={{ fontSize: '11px', color: '#71717a' }}>Compared to past spending average</span>
                </div>

                <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', padding: '1.25rem' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Budget Health Score</span>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: '950', color: stats.healthScore >= 80 ? '#34d399' : stats.healthScore >= 50 ? '#fbbf24' : '#ef4444', margin: '0.25rem 0' }}>
                        {stats.healthScore}%
                    </h3>
                    <span style={{ fontSize: '11px', color: '#71717a' }}>{stats.overBudgetCount} overspent categories</span>
                </div>
            </div>

            {/* Inline Add Main Category Form */}
            {showAddMainForm && (
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.6)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '1.25rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    maxWidth: '400px'
                }}>
                    <h4 style={{ margin: 0, color: 'white', fontSize: '0.875rem', fontWeight: 'bold' }}>Create New Main Category</h4>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            placeholder="Category Name"
                            value={newMainCategoryName}
                            onChange={(e) => setNewMainCategoryName(e.target.value)}
                            style={{
                                flex: 1,
                                backgroundColor: 'rgba(0,0,0,0.4)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '0.75rem',
                                padding: '0.5rem 0.75rem',
                                color: 'white',
                                outline: 'none'
                            }}
                        />
                        <button
                            onClick={handleAddMainCategory}
                            style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#10b981',
                                border: 'none',
                                color: 'white',
                                borderRadius: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Create
                        </button>
                        <button
                            onClick={() => { setShowAddMainForm(false); setNewMainCategoryName(''); }}
                            style={{
                                padding: '0.5rem',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                border: 'none',
                                color: 'white',
                                borderRadius: '0.75rem',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Categories List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {displayMainCategories.map(mainCat => {
                    const subCats = mergedCategoryMap[mainCat] || [];
                    const isExpanded = expandedCategories[mainCat] !== false;

                    // Main Category calculations
                    const mainTarget = Number(localBudgets[mainCat]) || 0;
                    const subTargetsSum = subCats.reduce((sum, sub) => sum + (Number(localBudgets[sub]) || 0), 0);
                    const effectiveMainTarget = mainTarget > 0 ? mainTarget : subTargetsSum;
                    const mainActual = actualSpending.mainCatSpend[mainCat] || 0;
                    const mainStatus = calculateBudgetStatus(effectiveMainTarget, mainActual);

                    const isMainOver = mainStatus.status === 'overspent';
                    const isMainWarn = mainStatus.status === 'warning';
                    const mainPct = Math.min(100, Math.round(mainStatus.percentageUsed));

                    const isEditingMain = editingKey?.type === 'main' && editingKey?.mainCat === mainCat;

                    return (
                        <div
                            key={mainCat}
                            style={{
                                backgroundColor: 'rgba(24, 24, 27, 0.4)',
                                backdropFilter: 'blur(10px)',
                                border: `1px solid ${isMainOver ? 'rgba(239, 68, 68, 0.3)' : isMainWarn ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                                borderRadius: '1.5rem',
                                padding: '1.5rem',
                            }}
                        >
                            {/* Main Category Header Row */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', cursor: 'pointer' }} onClick={() => toggleExpand(mainCat)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: 1, minWidth: '300px' }}>
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
                                    <div style={{ flex: 1 }} onClick={(e) => isEditingMain && e.stopPropagation()}>
                                        {isEditingMain ? (
                                            <div style={{ display: 'flex', gap: '0.375rem', maxWidth: '240px' }}>
                                                <input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    style={{
                                                        backgroundColor: 'rgba(0,0,0,0.6)',
                                                        border: '1px solid rgba(255,255,255,0.2)',
                                                        color: 'white',
                                                        fontSize: '0.875rem',
                                                        borderRadius: '0.5rem',
                                                        padding: '0.25rem 0.5rem',
                                                        outline: 'none',
                                                        width: '100%'
                                                    }}
                                                />
                                                <button onClick={confirmRename} style={{ border: 'none', background: '#10b981', color: 'white', borderRadius: '0.375rem', padding: '0.25rem' }}><Check size={14} /></button>
                                                <button onClick={cancelEditing} style={{ border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '0.375rem', padding: '0.25rem' }}><X size={14} /></button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                                                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: 0 }}>{mainCat}</h3>
                                                
                                                {/* Edit/Delete Actions */}
                                                <div className="flex gap-1 items-center" onClick={(e) => e.stopPropagation()}>
                                                    <button 
                                                        onClick={() => startEditing('main', mainCat)} 
                                                        style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '0.25rem' }}
                                                        title="Rename Category"
                                                    >
                                                        <Edit2 size={12} className="hover:text-white" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteCategory('main', mainCat)} 
                                                        style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '0.25rem' }}
                                                        title="Delete Category"
                                                    >
                                                        <Trash2 size={12} className="hover:text-red-400" />
                                                    </button>
                                                </div>

                                                <span style={{
                                                    fontSize: '9px',
                                                    fontWeight: '800',
                                                    padding: '0.125rem 0.5rem',
                                                    borderRadius: '0.375rem',
                                                    backgroundColor: isMainOver ? 'rgba(239, 68, 68, 0.2)' : isMainWarn ? 'rgba(245, 158, 11, 0.2)' : effectiveMainTarget > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                                                    color: isMainOver ? '#f87171' : isMainWarn ? '#fbbf24' : effectiveMainTarget > 0 ? '#34d399' : '#71717a',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {isMainOver ? '🔴 Over' : isMainWarn ? '🟡 Warning' : effectiveMainTarget > 0 ? '🟢 Safe' : '⚪ No Target'}
                                                </span>
                                            </div>
                                        )}
                                        <p style={{ fontSize: '11px', color: '#71717a', margin: '0.125rem 0 0 0' }}>
                                            Actual spend: <strong style={{ color: 'white', fontFamily: 'monospace' }}>{formatCurrency(mainActual)}</strong>
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
                            {isExpanded && (
                                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Sub-Category Limits ({subCats.length})</span>
                                    </div>

                                    {subCats.map(subCat => {
                                        const subTarget = Number(localBudgets[subCat]) || 0;
                                        const subActual = actualSpending.subCatSpend[subCat] || 0;
                                        const subStatus = calculateBudgetStatus(subTarget, subActual);

                                        const isSubOver = subStatus.status === 'overspent';
                                        const isSubWarn = subStatus.status === 'warning';
                                        
                                        const isEditingSub = editingKey?.type === 'sub' && editingKey?.mainCat === mainCat && editingKey?.subCat === subCat;

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
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1', minWidth: '220px' }}>
                                                    {/* Status Dot */}
                                                    <div style={{
                                                        width: '10px',
                                                        height: '10px',
                                                        borderRadius: '50%',
                                                        backgroundColor: isSubOver ? '#ef4444' : isSubWarn ? '#f59e0b' : subTarget > 0 ? '#10b981' : '#52525b',
                                                        boxShadow: isSubOver ? '0 0 8px rgba(239, 68, 68, 0.5)' : isSubWarn ? '0 0 8px rgba(245, 158, 11, 0.5)' : subTarget > 0 ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none'
                                                    }} />

                                                    <div style={{ flex: 1 }}>
                                                        {isEditingSub ? (
                                                            <div style={{ display: 'flex', gap: '0.375rem', maxWidth: '200px' }}>
                                                                <input
                                                                    type="text"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    style={{
                                                                        backgroundColor: 'rgba(0,0,0,0.6)',
                                                                        border: '1px solid rgba(255,255,255,0.2)',
                                                                        color: 'white',
                                                                        fontSize: '0.8125rem',
                                                                        borderRadius: '0.5rem',
                                                                        padding: '0.2rem 0.5rem',
                                                                        outline: 'none',
                                                                        width: '100%'
                                                                    }}
                                                                />
                                                                <button onClick={confirmRename} style={{ border: 'none', background: '#10b981', color: 'white', borderRadius: '0.375rem', padding: '0.2rem' }}><Check size={12} /></button>
                                                                <button onClick={cancelEditing} style={{ border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '0.375rem', padding: '0.2rem' }}><X size={12} /></button>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <span style={{ fontSize: '0.875rem', fontWeight: '800', color: 'white' }}>{subCat}</span>
                                                                
                                                                {/* Edit/Delete Sub Category Actions */}
                                                                <div className="flex gap-1 items-center">
                                                                    <button 
                                                                        onClick={() => startEditing('sub', mainCat, subCat)} 
                                                                        style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', padding: '0.125rem' }}
                                                                        title="Rename Sub-category"
                                                                    >
                                                                        <Edit2 size={10} className="hover:text-white" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleDeleteCategory('sub', mainCat, subCat)} 
                                                                        style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', padding: '0.125rem' }}
                                                                        title="Delete Sub-category"
                                                                    >
                                                                        <Trash2 size={10} className="hover:text-red-400" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

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
                                                        title="Auto-suggest target based on historical average & savings mode"
                                                        style={{
                                                            padding: '0.375rem 0.625rem',
                                                            borderRadius: '0.625rem',
                                                            backgroundColor: 'rgba(139, 92, 246, 0.15)',
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

                                    {/* Add Sub Category Form */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '0.5rem',
                                        backgroundColor: 'rgba(255,255,255,0.02)',
                                        border: '1px dashed rgba(255,255,255,0.08)',
                                        borderRadius: '1rem',
                                        padding: '0.5rem 1rem',
                                        alignItems: 'center',
                                        maxWidth: '320px'
                                    }}>
                                        <input
                                            type="text"
                                            placeholder="Add sub-category..."
                                            value={newSubCategoryNames[mainCat] || ''}
                                            onChange={(e) => setNewSubCategoryNames(prev => ({ ...prev, [mainCat]: e.target.value }))}
                                            style={{
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                color: 'white',
                                                fontSize: '0.75rem',
                                                outline: 'none',
                                                flex: 1
                                            }}
                                        />
                                        <button
                                            onClick={() => handleAddSubCategory(mainCat)}
                                            style={{
                                                backgroundColor: 'rgba(255,255,255,0.05)',
                                                border: 'none',
                                                borderRadius: '0.375rem',
                                                padding: '0.25rem 0.5rem',
                                                color: 'white',
                                                fontSize: '10px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Add
                                        </button>
                                    </div>
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
