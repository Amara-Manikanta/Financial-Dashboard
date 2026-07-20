import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { Calendar, ChevronDown, ChevronUp, BarChart3, Plus, X, Upload, Loader2 } from 'lucide-react';
import { processBankStatement, mergeTransactionsIntoExpenses } from '../utils/importUtils';

const Expenses = () => {
    const { expenses, formatCurrency, salaryStats, addNewYear, categoryRules, updateCategoryRules, saveExpenses, mergedCategoryMap } = useFinance();
    const navigate = useNavigate();
    const [expandedYears, setExpandedYears] = useState(new Set());
    const [isAddYearModalOpen, setIsAddYearModalOpen] = useState(false);
    const [newYear, setNewYear] = useState(new Date().getFullYear() + 1);
    const fileInputRef = React.useRef(null);
    const [isImporting, setIsImporting] = useState(false);
    const [notification, setNotification] = useState(null);

    React.useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const handleImportStatement = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const { newTransactions, updatedRules } = await processBankStatement(file, categoryRules);
            
            // Only update rules if we learned new ones
            if (Object.keys(updatedRules).length > Object.keys(categoryRules).length) {
                await updateCategoryRules(updatedRules);
            }

            const { updatedExpenses, addedCount } = mergeTransactionsIntoExpenses(expenses, newTransactions);
            
            if (addedCount > 0) {
                await saveExpenses(updatedExpenses);
                setNotification({ type: 'success', message: `Successfully imported ${addedCount} new transactions!` });
            } else {
                setNotification({ type: 'info', message: 'No new transactions found in the file.' });
            }
        } catch (error) {
            console.error("Failed to import statement:", error);
            setNotification({ type: 'error', message: 'Failed to read the statement. Ensure it is a valid Excel file.' });
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const expenseGroups = useMemo(() => {
        const groups = {};
        const getMainCategory = (subCatName) => {
            const lowerSub = (subCatName || '').toLowerCase();
            for (const [main, subs] of Object.entries(mergedCategoryMap || {})) {
                if (subs.some(s => s.toLowerCase() === lowerSub)) {
                    return main;
                }
            }
            const matchingKey = Object.keys(mergedCategoryMap || {}).find(k => k.toLowerCase() === lowerSub);
            if (matchingKey) return matchingKey;
            return 'Miscellaneous';
        };

        const SAVINGS_MAIN_CATEGORIES = ['Investments', 'Transfers', 'Loans'];

        if (Array.isArray(expenses)) {
            expenses.forEach(item => {
                const date = new Date(item.date);
                const year = date.getFullYear();
                const monthIndex = date.getMonth();
                const monthName = date.toLocaleString('default', { month: 'long' });

                if (!groups[year]) groups[year] = {};
                if (!groups[year][monthIndex]) {
                    groups[year][monthIndex] = {
                        name: monthName,
                        year: year,
                        total: 0,
                        invested: 0,
                        count: 0,
                        investedCount: 0
                    };
                }
                if (item.deductFromSalary !== false) {
                    const cat = (item.category || '').toLowerCase();
                    const isCreditCardBill = cat.includes('credit card bill') || cat.includes('credit card payment');
                    const isCCSpend = item.paymentMode === 'credit_card' && !isCreditCardBill;
                    
                    if (!isCCSpend) {
                        const mainCat = item.mainCategory || getMainCategory(item.category);
                        if (SAVINGS_MAIN_CATEGORIES.includes(mainCat)) {
                            groups[year][monthIndex].invested += item.amount;
                            groups[year][monthIndex].investedCount += 1;
                        } else {
                            groups[year][monthIndex].total += item.amount;
                            groups[year][monthIndex].count += 1;
                        }
                    }
                }
            });
        } else if (typeof expenses === 'object' && expenses !== null) {
            Object.entries(expenses).forEach(([year, months]) => {
                if (!groups[year]) groups[year] = {};

                Object.entries(months).forEach(([monthName, data]) => {
                    const date = new Date(`${monthName} 1, ${year}`);
                    const monthIndex = date.getMonth();

                    if (isNaN(monthIndex)) return;

                    let total = 0;
                    let invested = 0;
                    let count = 0;
                    let investedCount = 0;
                    const categories = data.categories || data;

                    if (data.transactions && data.transactions.length > 0) {
                        const uniqueCats = new Set();
                        const uniqueInvestedCats = new Set();
                        
                        data.transactions.forEach(t => {
                            const cat = (t.category || 'others').toLowerCase();
                            if (['salary received', 'income', 'salary'].includes(cat)) return;

                            const amt = Number(t.amount) || 0;
                            const effective = t.isCredited ? -amt : amt;

                            if (t.deductFromSalary !== false && !t.isRewardPoints) {
                                const mainCat = t.mainCategory || getMainCategory(t.category);
                                const isCreditCardBill = cat.includes('credit card bill') || cat.includes('credit card payment');
                                const isCCSpend = t.paymentMode === 'credit_card' && !isCreditCardBill;

                                if (!isCCSpend) {
                                    if (SAVINGS_MAIN_CATEGORIES.includes(mainCat)) {
                                        invested += effective;
                                        uniqueInvestedCats.add(cat);
                                    } else {
                                        total += effective;
                                        uniqueCats.add(cat);
                                    }
                                }
                            }
                        });
                        count = uniqueCats.size;
                        investedCount = uniqueInvestedCats.size;
                    } else if (typeof categories === 'object' && categories !== null) {
                        Object.entries(categories).forEach(([cat, val]) => {
                            if (['salary received', 'income', 'salary'].includes(cat.toLowerCase())) return;

                            const value = Number(val) || 0;
                            const mainCat = getMainCategory(cat);

                            if (SAVINGS_MAIN_CATEGORIES.includes(mainCat)) {
                                invested += value;
                                investedCount++;
                            } else {
                                total += value;
                                count++;
                            }
                        });
                    }

                    groups[year][monthIndex] = {
                        name: monthName,
                        year: year,
                        total: total,
                        invested: invested,
                        count: count,
                        investedCount: investedCount,
                        details: categories
                    };
                });
            });
        }
        return groups;
    }, [expenses, mergedCategoryMap]);

    const years = useMemo(() => {
        const expenseYears = Object.keys(expenseGroups);
        const salaryYears = Object.keys(salaryStats);
        const allYears = new Set([...expenseYears, ...salaryYears]);
        return Array.from(allYears).sort((a, b) => b - a);
    }, [expenseGroups, salaryStats]);

    const toggleYear = (year) => {
        setExpandedYears(prev => {
            const newSet = new Set(prev);
            if (newSet.has(year)) {
                newSet.delete(year);
            } else {
                newSet.add(year);
            }
            return newSet;
        });
    };

    const handleAddYear = async (e) => {
        e.preventDefault();
        const yearNum = Number(newYear);
        if (!newYear || isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
            setNotification({ type: 'error', message: 'Please enter a valid year between 2000 and 2100' });
            return;
        }
        try {
            await addNewYear(yearNum.toString());
            setIsAddYearModalOpen(false);
            setNewYear(new Date().getFullYear() + 1);
            setNotification({ type: 'success', message: `Year ${yearNum} initialized successfully!` });
        } catch (error) {
            setNotification({ type: 'error', message: error.message });
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', position: 'relative' }}>
            {notification && (
                <div style={{
                    position: 'fixed',
                    top: '2rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 50,
                    padding: '0.75rem 1.5rem',
                    borderRadius: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                    backgroundColor: notification.type === 'error' ? 'rgba(239,68,68,0.1)' : notification.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                    border: notification.type === 'error' ? '1px solid rgba(239,68,68,0.2)' : notification.type === 'success' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(59,130,246,0.2)',
                    color: notification.type === 'error' ? '#f87171' : notification.type === 'success' ? '#34d399' : '#60a5fa'
                }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.875rem', letterSpacing: '0.025em' }}>{notification.message}</span>
                    <button onClick={() => setNotification(null)} style={{ opacity: 0.5, border: 'none', backgroundColor: 'transparent', color: 'currentColor', cursor: 'pointer', padding: 0 }}>
                        <X size={16} />
                    </button>
                </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem' }}>
                    <div>
                        <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: '0 0 0.5rem 0' }}>Expenses History</h2>
                        <p style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>Track and analyze your spending over time</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            onChange={handleImportStatement} 
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={isImporting}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '1rem',
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                opacity: isImporting ? 0.5 : 1
                            }}
                        >
                            {isImporting ? <Loader2 size={16} className="animate-spin text-gray-400" /> : <Upload size={16} className="text-emerald-400" />}
                            <span>{isImporting ? 'Importing...' : 'Import Statement'}</span>
                        </button>

                        <button
                            onClick={() => setIsAddYearModalOpen(true)}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '1rem',
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer'
                            }}
                        >
                            <Plus size={16} className="text-blue-400" />
                            <span>Add Year</span>
                        </button>

                        <button
                            onClick={() => navigate('/analytics')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '1rem',
                                backgroundColor: '#2563eb',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                border: 'none',
                                boxShadow: '0 4px 10px -2px rgba(37, 99, 235, 0.2)'
                            }}
                        >
                            <BarChart3 size={16} />
                            <span>Analytics</span>
                        </button>
                    </div>
                </div>
            </div>

            {years.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem 1.5rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '1.5rem',
                    border: '1px dashed rgba(255, 255, 255, 0.1)'
                }}>
                    <Calendar size={48} style={{ color: '#71717a', marginBottom: '1rem' }} />
                    <p style={{ fontSize: '0.875rem', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>No expenses recorded yet</p>
                </div>
            ) : (
                years.map(year => {
                    const isCollapsed = !expandedYears.has(year);
                    const yearlyTotalExpenses = expenseGroups[year]
                        ? Object.values(expenseGroups[year]).reduce((acc, month) => acc + month.total, 0)
                        : 0;
                    const yearlyTotalInvested = expenseGroups[year]
                        ? Object.values(expenseGroups[year]).reduce((acc, month) => acc + month.invested, 0)
                        : 0;
                    const yearlySalary = salaryStats[year]?.total || 0;

                    return (
                        <div key={year} style={{ marginBottom: '2.5rem' }}>
                            <div
                                onClick={() => toggleYear(year)}
                                style={{
                                    backgroundColor: 'rgba(24, 24, 27, 0.4)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    borderRadius: '1.5rem',
                                    padding: '1.25rem 1.5rem',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    marginBottom: '1.5rem',
                                    boxShadow: '0 4px 20px -2px rgba(0,0,0,0.3)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{
                                        padding: '0.5rem',
                                        borderRadius: '0.75rem',
                                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                        color: isCollapsed ? '#71717a' : '#2563eb',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                    </div>
                                    <h3 style={{ fontSize: '2rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>{year}</h3>
                                </div>

                                <div style={{ display: 'flex', gap: '2rem' }}>
                                    <div>
                                        <p style={{ fontSize: '8px', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.125rem 0' }}>Income</p>
                                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: '#10b981', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(yearlySalary)}</p>
                                    </div>
                                    <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.05)', paddingLeft: '2rem' }}>
                                        <p style={{ fontSize: '8px', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.125rem 0' }}>Expenses</p>
                                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: '#ef4444', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(yearlyTotalExpenses)}</p>
                                    </div>
                                    <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.05)', paddingLeft: '2rem' }}>
                                        <p style={{ fontSize: '8px', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.125rem 0' }}>Invested</p>
                                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: '#c084fc', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(yearlyTotalInvested)}</p>
                                    </div>
                                </div>
                            </div>

                            {!isCollapsed && (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                    gap: '1.5rem',
                                    padding: '0 0.5rem'
                                }}>
                                    {(!expenseGroups[year] || Object.keys(expenseGroups[year]).length === 0) ? (
                                        <div style={{
                                            gridColumn: '1 / -1',
                                            padding: '3rem 1.5rem',
                                            textAlign: 'center',
                                            border: '1px dashed rgba(255, 255, 255, 0.05)',
                                            borderRadius: '1.5rem',
                                            backgroundColor: 'rgba(255, 255, 255, 0.01)'
                                        }}>
                                            <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>No data for this year</p>
                                        </div>
                                    ) : Object.entries(expenseGroups[year])
                                        .sort(([a], [b]) => Number(a) - Number(b))
                                        .map(([index, data]) => {
                                            const monthlySalary = salaryStats[year]?.months[data.name] || 0;
                                            const balance = monthlySalary - data.total - data.invested;
                                            const isDeficit = balance < 0;

                                            const maxAmount = Math.max(monthlySalary, data.total, data.invested, 1);
                                            const incomePercent = Math.min((monthlySalary / maxAmount) * 100, 100);
                                            const expensePercent = Math.min((data.total / maxAmount) * 100, 100);
                                            const investedPercent = Math.min((data.invested / maxAmount) * 100, 100);

                                            return (
                                                <div
                                                    key={index}
                                                    onClick={() => navigate(`/expenses/${year}/${data.name}`)}
                                                    style={{
                                                        backgroundColor: 'rgba(24, 24, 27, 0.4)',
                                                        backdropFilter: 'blur(10px)',
                                                        borderRadius: '1.5rem',
                                                        border: isDeficit ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(16, 185, 129, 0.15)',
                                                        padding: '1.25rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'space-between',
                                                        height: '270px',
                                                        boxShadow: isDeficit ? '0 4px 20px -2px rgba(239, 68, 68, 0.02)' : '0 4px 20px -2px rgba(16, 185, 129, 0.02)'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                        <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: 0 }}>{data.name}</h3>
                                                        <div style={{ color: isDeficit ? '#ef4444' : '#10b981' }}>
                                                            <Calendar size={18} />
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717a', marginBottom: '0.125rem' }}>
                                                                <span>Income</span>
                                                                <span style={{ color: '#10b981', fontFamily: 'monospace' }}>{formatCurrency(monthlySalary)}</span>
                                                            </div>
                                                            <div style={{ width: '100%', height: '3px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '1.5px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${incomePercent}%`, backgroundColor: '#10b981' }}></div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717a', marginBottom: '0.125rem' }}>
                                                                <span>Expense</span>
                                                                <span style={{ color: '#ef4444', fontFamily: 'monospace' }}>{formatCurrency(data.total)}</span>
                                                            </div>
                                                            <div style={{ width: '100%', height: '3px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '1.5px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${expensePercent}%`, backgroundColor: '#ef4444' }}></div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717a', marginBottom: '0.125rem' }}>
                                                                <span>Invested</span>
                                                                <span style={{ color: '#c084fc', fontFamily: 'monospace' }}>{formatCurrency(data.invested)}</span>
                                                            </div>
                                                            <div style={{ width: '100%', height: '3px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '1.5px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${investedPercent}%`, backgroundColor: '#c084fc' }}></div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.25rem' }}>
                                                        <div>
                                                            <p style={{ fontSize: '8px', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.125rem 0' }}>
                                                                {isDeficit ? 'Deficit' : 'Net Balance'}
                                                            </p>
                                                            <p style={{ fontSize: '1.125rem', fontWeight: '950', color: isDeficit ? '#ef4444' : '#10b981', fontFamily: 'monospace', margin: 0 }}>
                                                                {formatCurrency(Math.abs(balance))}
                                                            </p>
                                                        </div>
                                                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                            {data.count + data.investedCount} categories
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            )}
                        </div>
                    );
                })
            )}

            {isAddYearModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#121214] border border-white/5 w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight">Initialize Year</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Set up a new financial year</p>
                            </div>
                            <button onClick={() => setIsAddYearModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleAddYear} className="p-8 space-y-8">
                            <div className="space-y-4">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Financial Year</label>
                                <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-3xl p-4">
                                    <button 
                                        type="button" 
                                        onClick={() => setNewYear(prev => prev === '' ? new Date().getFullYear() : Number(prev) - 1)}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-95"
                                    >
                                        <div className="w-4 h-[2px] bg-current rounded-full" />
                                    </button>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={newYear}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setNewYear(val === '' ? '' : parseInt(val));
                                        }}
                                        className="w-48 bg-transparent border-none text-center text-5xl font-black text-white tracking-tighter focus:outline-none focus:ring-0 p-0 m-0"
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setNewYear(prev => prev === '' ? new Date().getFullYear() : Number(prev) + 1)}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-95 relative"
                                    >
                                        <div className="w-4 h-[2px] bg-current rounded-full absolute" />
                                        <div className="w-[2px] h-4 bg-current rounded-full absolute" />
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-600 italic px-2 text-center mt-4">
                                    This will create all 12 months with your current expense categories initialized to zero.
                                </p>
                            </div>
                            <button
                                type="submit"
                                className="w-full py-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest transition-all shadow-2xl shadow-blue-900/40 active:scale-95"
                            >
                                Initialize Year {newYear}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Expenses;
