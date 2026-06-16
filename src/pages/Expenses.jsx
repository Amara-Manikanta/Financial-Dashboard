import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { Calendar, ChevronDown, ChevronUp, BarChart3, Plus, X, Upload, Loader2 } from 'lucide-react';
import { processBankStatement, mergeTransactionsIntoExpenses } from '../utils/importUtils';

const Expenses = () => {
    const { expenses, formatCurrency, salaryStats, addNewYear, categoryRules, updateCategoryRules, saveExpenses } = useFinance();
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
        // ... (existing logic remains the same, but let's ensure it's properly closed)
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
                        count: 0
                    };
                }
                if (item.deductFromSalary !== false) {
                    groups[year][monthIndex].total += item.amount;
                }
                groups[year][monthIndex].count += 1;
            });
        } else if (typeof expenses === 'object' && expenses !== null) {
            Object.entries(expenses).forEach(([year, months]) => {
                if (!groups[year]) groups[year] = {};

                Object.entries(months).forEach(([monthName, data]) => {
                    const date = new Date(`${monthName} 1, ${year}`);
                    const monthIndex = date.getMonth();

                    if (isNaN(monthIndex)) return;

                    let total = 0;
                    let count = 0;
                    const categories = data.categories || data;

                    if (typeof categories === 'object' && categories !== null) {
                        Object.entries(categories).forEach(([cat, val]) => {
                            if (cat !== 'salary received' && cat !== 'income') {
                                total += (Number(val) || 0);
                                count++;
                            }
                        });
                    }

                    groups[year][monthIndex] = {
                        name: monthName,
                        year: year,
                        total: total,
                        count: count,
                        details: categories
                    };
                });
            });
        }
        return groups;
    }, [expenses]);

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
        <div className="p-8 max-w-[1600px] mx-auto relative">
            {notification && (
                <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl animate-in slide-in-from-top-4 ${
                    notification.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                    notification.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                    'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                }`}>
                    <span className="font-bold text-sm tracking-wide">{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="opacity-50 hover:opacity-100 transition-opacity">
                        <X size={16} />
                    </button>
                </div>
            )}
            
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-12 gap-6">
                <div>
                    <h2 className="text-5xl font-black text-white tracking-tighter mb-4">Expenses History</h2>
                    <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-xs">Track and analyze your spending over time</p>
                </div>
                <div className="flex items-center gap-4 w-full lg:w-auto">
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
                        className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-white/[0.03] hover:bg-white/[0.08] text-white font-black py-4 px-8 rounded-2xl border border-white/5 transition-all active:scale-95 text-xs uppercase tracking-widest disabled:opacity-50"
                    >
                        {isImporting ? <Loader2 size={18} className="animate-spin text-gray-400" /> : <Upload size={18} className="text-emerald-400" />}
                        <span>{isImporting ? 'Importing...' : 'Import Statement'}</span>
                    </button>
                    <button
                        onClick={() => setIsAddYearModalOpen(true)}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-white/[0.03] hover:bg-white/[0.08] text-white font-black py-4 px-8 rounded-2xl border border-white/5 transition-all active:scale-95 text-xs uppercase tracking-widest"
                    >
                        <Plus size={18} className="text-blue-400" />
                        <span>Add Year</span>
                    </button>
                    <button
                        onClick={() => navigate('/analytics')}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-8 rounded-2xl border border-blue-500 transition-all shadow-2xl shadow-blue-900/20 active:scale-95 text-xs uppercase tracking-widest"
                    >
                        <BarChart3 size={18} />
                        <span>Analytics</span>
                    </button>
                </div>
            </div>

            {years.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/[0.02] border border-dashed border-white/10 rounded-3xl">
                    <Calendar size={48} className="text-gray-700 mb-4" />
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No expenses recorded yet</p>
                </div>
            ) : (
                years.map(year => {
                    const isCollapsed = !expandedYears.has(year);
                    const yearlyTotalExpenses = expenseGroups[year]
                        ? Object.values(expenseGroups[year]).reduce((acc, month) => acc + month.total, 0)
                        : 0;
                    const yearlySalary = salaryStats[year]?.total || 0;

                    return (
                        <div key={year} className="mb-10">
                            <div
                                onClick={() => toggleYear(year)}
                                className="group flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:bg-white/[0.04] transition-all cursor-pointer mb-6"
                            >
                                <div className="flex items-center gap-6 mb-4 md:mb-0">
                                    <div className="flex items-center justify-center w-12 h-12 bg-white/5 rounded-2xl group-hover:bg-blue-600/10 transition-colors">
                                        {isCollapsed ? <ChevronDown size={20} className="text-gray-500" /> : <ChevronUp size={20} className="text-blue-400" />}
                                    </div>
                                    <h3 className="text-4xl font-black text-white tracking-tighter">{year}</h3>
                                </div>
                                <div className="flex gap-8 w-full md:w-auto">
                                    <div className="flex-1 md:flex-none">
                                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Income</p>
                                        <p className="text-xl font-black text-emerald-400 tracking-tight">{formatCurrency(yearlySalary)}</p>
                                    </div>
                                    <div className="flex-1 md:flex-none border-l border-white/5 pl-8">
                                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Expenses</p>
                                        <p className="text-xl font-black text-rose-400 tracking-tight">{formatCurrency(yearlyTotalExpenses)}</p>
                                    </div>
                                </div>
                            </div>

                            {!isCollapsed && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-2">
                                    {(!expenseGroups[year] || Object.keys(expenseGroups[year]).length === 0) ? (
                                        <div className="col-span-full py-12 text-center border border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
                                            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No data for this year</p>
                                        </div>
                                    ) : Object.entries(expenseGroups[year])
                                        .sort(([a], [b]) => Number(a) - Number(b))
                                        .map(([index, data]) => {
                                            const monthlySalary = salaryStats[year]?.months[data.name] || 0;
                                            const balance = monthlySalary - data.total;
                                            const isDeficit = balance < 0;

                                            const maxAmount = Math.max(monthlySalary, data.total, 1);
                                            const incomePercent = Math.min((monthlySalary / maxAmount) * 100, 100);
                                            const expensePercent = Math.min((data.total / maxAmount) * 100, 100);

                                            return (
                                                <div
                                                    key={index}
                                                    className="group relative overflow-hidden p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer active:scale-[0.98]"
                                                    onClick={() => navigate(`/expenses/${year}/${data.name}`)}
                                                >
                                                    <div className="flex justify-between items-center mb-6">
                                                        <h3 className="text-xl font-black text-white tracking-tight group-hover:text-blue-400 transition-colors">{data.name}</h3>
                                                        <div className="p-2 bg-white/5 rounded-xl text-gray-500 group-hover:text-blue-400 transition-colors">
                                                            <Calendar size={16} />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div>
                                                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                                                                <span>Income</span>
                                                                <span className="text-emerald-400">{formatCurrency(monthlySalary)}</span>
                                                            </div>
                                                            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                                                <div 
                                                                    className="bg-emerald-500 h-full transition-all duration-1000" 
                                                                    style={{ width: `${incomePercent}%` }} 
                                                                />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                                                                <span>Expense</span>
                                                                <span className="text-rose-400">{formatCurrency(data.total)}</span>
                                                            </div>
                                                            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                                                <div
                                                                    className="bg-rose-500 h-full transition-all duration-1000"
                                                                    style={{ width: `${expensePercent}%` }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="pt-4 border-t border-white/5 flex justify-between items-end">
                                                            <div>
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">
                                                                    {isDeficit ? 'Deficit' : 'Savings'}
                                                                </p>
                                                                <p className={`text-lg font-black tracking-tight ${isDeficit ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                                    {formatCurrency(Math.abs(balance))}
                                                                </p>
                                                            </div>
                                                            <span className="text-[10px] font-black text-gray-600 bg-white/5 px-2 py-1 rounded-lg uppercase">
                                                                {data.count} Categories
                                                            </span>
                                                        </div>
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

            {/* Add Year Modal */}
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
