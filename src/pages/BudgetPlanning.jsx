import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { calculateBudgetStatus, generateBudgetSuggestions } from '../utils/budgetUtils';
import { ArrowLeft, Edit2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Save } from 'lucide-react';

const BudgetPlanning = () => {
    const { expenses, categoryBudgets, updateCategoryBudget, categories, formatCurrency } = useFinance();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [editMode, setEditMode] = useState({}); // { [category]: boolean }
    const [tempBudget, setTempBudget] = useState({}); // { [category]: number }

    // Helper to get actual spend for a category in the selected month
    const getActualSpend = (category) => {
        const [year, monthNum] = selectedMonth.split('-');
        const monthName = new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long' });

        const monthData = expenses[year]?.[monthName];
        if (!monthData) return 0;

        const target = monthData.categories || monthData;
        const key = Object.keys(target).find(k => k.toLowerCase() === category.toLowerCase()) || category;
        return target[key] || 0;
    };

    // Calculate details for all categories
    const budgetData = useMemo(() => {
        return categories.map(cat => {
            const planned = categoryBudgets[cat] || 0;
            const actual = getActualSpend(cat);
            const status = calculateBudgetStatus(planned, actual);

            // Get history for suggestion (previous 6 months)
            // This is computationally expensive if datasets are huge, but fine for personal finance size
            const history = [];
            for (let i = 1; i <= 6; i++) {
                const d = new Date(selectedMonth + '-01');
                d.setMonth(d.getMonth() - i);
                const y = d.getFullYear().toString();
                const m = d.toLocaleString('default', { month: 'long' });
                const mData = expenses[y]?.[m];
                if (mData) {
                    const t = mData.categories || mData;
                    const k = Object.keys(t).find(key => key.toLowerCase() === cat.toLowerCase());
                    if (k && t[k] > 0) {
                        history.push({ month: `${y}-${m}`, amount: t[k] });
                    }
                }
            }
            // Reverse to be chronological if needed, but suggestion logic handles it.
            // Actually suggestion logic assumes chronological? 
            // "Last month" logic in utils assumes last element is latest.
            // My loop goes backwards (i=1 is last month). So history[0] is last month.
            // I should reverse it to match generic expectation [oldest ... newest].
            history.reverse();

            const suggestion = generateBudgetSuggestions(history, cat);

            return {
                category: cat,
                ...status,
                suggestion
            };
        });
    }, [categories, expenses, categoryBudgets, selectedMonth]);

    const handleSave = (category, amount) => {
        updateCategoryBudget(category, Number(amount));
        setEditMode(prev => ({ ...prev, [category]: false }));
    };

    const handleEditClick = (category, currentAmount) => {
        setTempBudget(prev => ({ ...prev, [category]: currentAmount }));
        setEditMode(prev => ({ ...prev, [category]: true }));
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto text-white">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-4xl font-black tracking-tighter mb-2">Budget Planning</h2>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Manage your global category limits</p>
                </div>
                <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white font-bold outline-none focus:border-blue-500"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {budgetData.map(item => (
                    <div key={item.category} className="card bg-white/[0.02] border border-white/5 p-6 rounded-2xl relative group hover:bg-white/[0.04] transition-all">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-black capitalize">{item.category}</h3>
                            {item.status === 'overspent' && <AlertTriangle className="text-red-500" size={20} />}
                            {item.status === 'warning' && <AlertTriangle className="text-amber-500" size={20} />}
                            {item.status === 'safe' && <CheckCircle className="text-emerald-500" size={20} />}
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-4">
                            <div className="flex justify-between text-xs font-bold text-gray-400 mb-1">
                                <span>{formatCurrency(item.actual)}</span>
                                <span>{formatCurrency(item.planned)}</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${item.status === 'overspent' ? 'bg-red-500' :
                                        item.status === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                                        }`}
                                    style={{ width: `${Math.min(item.percentageUsed, 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* Budget Edit Section */}
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-widest text-gray-500">Budget</span>
                                {editMode[item.category] ? (
                                    <div className="flex items-center gap-2 mt-1">
                                        <input
                                            type="number"
                                            value={tempBudget[item.category]}
                                            onChange={(e) => setTempBudget({ ...tempBudget, [item.category]: e.target.value })}
                                            className="w-24 bg-black/40 border border-white/20 rounded px-2 py-1 text-sm font-bold outline-none"
                                        />
                                        <button
                                            onClick={() => handleSave(item.category, tempBudget[item.category])}
                                            className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500 hover:text-white transition-colors"
                                        >
                                            <Save size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-lg font-black">{formatCurrency(item.planned)}</span>
                                )}
                            </div>
                            {!editMode[item.category] && (
                                <button
                                    onClick={() => handleEditClick(item.category, item.planned)}
                                    className="p-2 text-gray-500 hover:text-white transition-colors"
                                >
                                    <Edit2 size={16} />
                                </button>
                            )}
                        </div>

                        {/* Smart Suggestion */}
                        {item.suggestion.suggestedBudget > 0 && Math.abs(item.suggestion.suggestedBudget - item.planned) > 100 && (
                            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <div className="flex items-center gap-2 mb-1">
                                    <TrendingUp size={14} className="text-blue-400" />
                                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Suggestion</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <p className="text-[10px] text-gray-400 leading-tight w-2/3">{item.suggestion.reason}</p>
                                    <button
                                        onClick={() => handleSave(item.category, item.suggestion.suggestedBudget)}
                                        className="text-xs font-black text-blue-400 hover:text-white transition-colors bg-blue-500/20 px-2 py-1 rounded-lg"
                                    >
                                        Apply {formatCurrency(item.suggestion.suggestedBudget)}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BudgetPlanning;
