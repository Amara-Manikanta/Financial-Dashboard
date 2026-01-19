import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Wallet, TrendingDown, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, MoreHorizontal, Plus, ChevronLeft, ChevronRight, ChevronDown, MessageSquare, Edit2, Trash2, Tag, Home, Utensils, ShoppingBag, Car, Smartphone, PiggyBank, Film, Gift, Wifi, Zap, CreditCard, Check } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, YAxis, AreaChart, Area, CartesianGrid, LineChart, Line } from 'recharts';
import TransactionModal from '../components/TransactionModal';

const COLORS = ['#FF8C00', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B'];

const SummaryCard = ({ title, subtitle, amount, percentage, color }) => (
    <div className="card relative overflow-hidden flex items-center justify-between p-4 group hover:bg-white/5 transition-colors duration-300">
        <div className="flex flex-col">
            <h3 className="text-gray-300 text-sm font-medium mb-1">{title}</h3>
            <p className="text-[10px] text-gray-500 mb-2 font-medium">{subtitle}</p>
            <p className="text-2xl font-bold text-white tracking-tight">{amount}</p>
        </div>

        <div
            className="flex items-center justify-center w-14 h-14 rounded-xl transition-transform duration-300 group-hover:scale-105"
            style={{
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: color,
                color: color,
                boxShadow: `0 0 15px ${color}15`,
                backgroundColor: `${color}08`
            }}
        >
            <span className="text-[10px] font-black">{percentage}</span>
        </div>
    </div>
);

const TransactionItem = ({ item, formatCurrency, onEdit, onDelete, compact = false, showActions = true, hideDate = false }) => {
    const IconComponent = CATEGORY_ICONS[item.category?.toLowerCase()] || Tag;

    // Construct subtitle parts based on what is available and requested
    const subtitleParts = [];
    if (item.title) subtitleParts.push(item.category); // Show category if title is the main header
    if (!hideDate) subtitleParts.push(new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    // For Statement Info (showActions=true), explicitly add Credit/Debit
    if (showActions) {
        const type = item.isCredited ? 'Credit' : 'Debit';
        subtitleParts.push(type);
    }

    // Join with bullet point
    const subtitle = subtitleParts.join(' • ');

    const isCredit = item.isCredited;

    return (
        <div className={`group flex items-center justify-between ${compact ? 'p-2' : 'p-3'} rounded-xl hover:bg-white/5 transition-all duration-200 border border-transparent hover:border-white/5 relative`}>
            <div className="flex items-center gap-3 overflow-hidden flex-1">
                <div className={`${compact ? 'p-1.5' : 'p-2'} rounded-lg bg-opacity-20 flex-shrink-0 flex items-center justify-center`} style={{ backgroundColor: `${COLORS[Math.abs((item.category || '').length) % COLORS.length]}20`, color: COLORS[Math.abs((item.category || '').length) % COLORS.length] }}>
                    <IconComponent size={compact ? 14 : 18} />
                </div>
                <div className="overflow-hidden flex-1 min-w-0">
                    <h4 className={`text-white font-medium ${compact ? 'text-xs' : 'text-sm'} capitalize truncate`}>
                        {item.title || item.category || 'Untitled'}
                    </h4>
                    {subtitle && (
                        <p className="text-gray-500 text-[10px] mt-0.5 truncate flex items-center gap-1">
                            {subtitle}
                            {showActions && (
                                <span className={`w-1.5 h-1.5 rounded-full ${isCredit ? 'bg-emerald-500' : 'bg-red-500/50'}`}></span>
                            )}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                {/* Actions - Always visible on larger screens or cleaner hover effect */}
                {showActions && (
                    <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-200">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                            title="Edit"
                        >
                            <Edit2 size={12} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}

                <div className="text-right">
                    <p className={`font-bold ${compact ? 'text-xs' : 'text-sm'} ${showActions && isCredit ? 'text-emerald-400' : 'text-white'}`}>
                        {isCredit ? '+' : ''}{formatCurrency(item.amount)}
                    </p>
                </div>
            </div>
        </div>
    );
};

const ReminderItem = ({ title }) => {
    const [checked, setChecked] = useState(false);
    return (
        <div
            className={`flex items-center justify-between p-2.5 hover:bg-white/5 rounded-lg transition-colors group cursor-pointer ${checked ? 'opacity-50' : ''}`}
            onClick={() => setChecked(!checked)}
        >
            <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-emerald-500/30 group-hover:border-emerald-500'}`}>
                    {checked && <Check size={10} className="text-white" />}
                </div>
                <span className={`text-xs font-medium transition-colors ${checked ? 'text-gray-500 line-through' : 'text-gray-300 group-hover:text-white'}`}>{title}</span>
            </div>
        </div>
    );
};

const CATEGORY_ICONS = {
    'house rent': Home,
    'groceries': ShoppingBag,
    'vegetables/fruits': ShoppingBag,
    'travel tickets': Car,
    'movies': Film,
    'fuels': Car,
    'stocks': TrendingUp,
    'clothes': ShoppingBag,
    'zomato/swiggy': Utensils,
    'food': Utensils,
    'savings': PiggyBank,
    'shopping': ShoppingBag,
    'others': MoreHorizontal,
    'bills': Zap,
    'credit card bill': CreditCard,
    'cabs': Car,
    'flowers': Gift,
    'premiums': Wallet,
    'salary received': Wallet
};

const ExpenseDetails = () => {
    const { year, month } = useParams();
    const navigate = useNavigate();
    const { expenses, formatCurrency, salaryStats, addItem, deleteItem, updateItem } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [graphType, setGraphType] = useState('bar');
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [statementPage, setStatementPage] = useState(1);
    const ITEMS_PER_PAGE = 12;
    const STATEMENT_ITEMS_PER_PAGE = 10;

    const monthDetails = useMemo(() => {
        const monthData = expenses[year]?.[month] || {};
        const categories = monthData.categories || monthData;

        // Calculate category totals from transactions dynamically
        // This ensures we can show non-deducted transactions in the breakdown even if they don't count towards the 'salary' balance
        const categoryTotals = {};
        const categoryDeductibles = {}; // To track what counts for totalNetExpenses

        // Initialize with existing categories from DB just in case, but rely on transactions for accuracy
        Object.entries(categories).forEach(([cat, val]) => {
            if (cat !== 'salary received' && cat !== 'income' && cat !== 'transactions') {
                categoryTotals[cat] = Number(val);
                categoryDeductibles[cat] = Number(val); // Default to deductible if from DB map
            }
        });

        // Re-aggregate from transactions to handle mixed deductible states correctly
        const activeTransactions = (monthData.transactions || []);
        if (activeTransactions.length > 0) {
            // Reset to 0 to rebuild strictly from transactions if they exist
            // This avoids double counting if DB is sync but enables mixed states
            Object.keys(categoryTotals).forEach(k => { categoryTotals[k] = 0; categoryDeductibles[k] = 0; });

            activeTransactions.forEach(t => {
                const cat = t.category || 'others';

                // Skip income categories from expense calculation
                if (['salary received', 'income'].includes(cat.toLowerCase())) return;

                const amt = Number(t.amount) || 0;
                // Logic: isCredited ? -amt : amt
                const effective = t.isCredited ? -amt : amt;

                // Case insensitive matching
                const targetKey = Object.keys(categoryTotals).find(k => k.toLowerCase() === cat.toLowerCase()) || cat;

                categoryTotals[targetKey] = (categoryTotals[targetKey] || 0) + effective;

                if (t.deductFromSalary !== false) {
                    categoryDeductibles[targetKey] = (categoryDeductibles[targetKey] || 0) + effective;
                }
            });
        }

        const items = Object.entries(categoryTotals)
            .filter(([_, amount]) => amount !== 0) // Filter empty categories
            .map(([category, amount], index) => ({
                id: `${year}-${month}-${category}-${index}`,
                date: new Date(`${month} 1, ${year}`).toISOString(),
                category: category,
                amount: amount,
                deductibleAmount: categoryDeductibles[category] || 0,
                type: 'monthly'
            })).sort((a, b) => b.amount - a.amount);

        // Calculate totalNetExpenses using ONLY the deductible amounts
        const totalNetExpenses = items.reduce((sum, item) => sum + item.deductibleAmount, 0);
        // Calculate totalGrossExpenses using ALL amounts (deductible + non-deductible)
        const totalGrossExpenses = items.reduce((sum, item) => sum + item.amount, 0);

        // Direct lookup for salary to ensure reactivity
        // We check both the nested categories object and the root month object to handle different DB structures
        const findSalary = (obj) => {
            if (!obj) return 0;
            const key = Object.keys(obj).find(k => ['salary received', 'salary', 'income'].includes(k.toLowerCase()));
            return key ? Number(obj[key]) : 0;
        };

        let salary = findSalary(categories);
        if (salary === 0 && monthData['salary received']) {
            salary = Number(monthData['salary received']);
        }

        console.log('Debug - Salary Calculation:', { categories, salary }); // Debug log
        const balance = salary - totalNetExpenses;
        const expensePercentage = salary > 0 ? Math.round((totalNetExpenses / salary) * 100) : 0;
        const balancePercentage = salary > 0 ? Math.round((balance / salary) * 100) : 0;

        // Spending Trend Data
        const daysInMonth = new Date(year, new Date(`${month} 1, ${year}`).getMonth() + 1, 0).getDate();

        // Extract individual transactions
        const rawTransactions = (monthData.transactions || [])
            .filter(t => t.id && (t.amount || t.category))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        // Group actual transactions by day
        const transactionsByDay = rawTransactions
            .filter(t => !t.isCredited)
            .reduce((acc, t) => {
                const day = new Date(t.date).getDate();
                acc[day] = (acc[day] || 0) + Number(t.amount);
                return acc;
            }, {});

        const totalTransactionAmount = rawTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const unaccounted = Math.max(0, totalNetExpenses - totalTransactionAmount);

        let runningTotal = 0;
        const trendData = Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1;
            let dailyAmount = 0;

            // Add actual transactions for this day
            dailyAmount += transactionsByDay[dayNum] || 0;

            // Add unaccounted expenses to the 1st of the month (default date for category-level items)
            if (dayNum === 1 && unaccounted > 0) {
                dailyAmount += unaccounted;
            }

            runningTotal += dailyAmount;
            return {
                day: dayNum,
                amount: Math.round(dailyAmount),
                cumulative: Math.round(runningTotal)
            };
        });

        const totalCreditCardSpend = rawTransactions
            .filter(t => t.paymentMode === 'credit_card')
            .reduce((sum, t) => {
                const amount = Number(t.amount) || 0;
                return t.isCredited ? sum - amount : sum + amount;
            }, 0);

        const creditCardStats = rawTransactions
            .filter(t => t.paymentMode === 'credit_card' && t.creditCardName)
            .reduce((acc, t) => {
                const card = t.creditCardName;
                const amount = Number(t.amount) || 0;
                const current = acc[card] || 0;
                acc[card] = t.isCredited ? current - amount : current + amount;
                return acc;
            }, {});

        return {
            items,
            rawTransactions,
            totalExpenses: totalNetExpenses,
            totalGrossExpenses, // Export gross expenses
            salary,
            balance,
            expenseCount: items.length,
            expensePercentage,
            balancePercentage,
            trendData,
            totalCreditCardSpend,
            creditCardStats
        };
    }, [expenses, year, month, salaryStats]);

    const handleSaveTransaction = (transaction) => {
        if (transaction.id) updateItem('expense', transaction);
        else addItem('expense', transaction);
        setEditingTransaction(null);
    };

    if (!expenses[year] || !expenses[year][month]) {
        return (
            <div className="container min-h-[60vh] flex flex-col items-center justify-center text-center">
                <Calendar size={48} className="text-gray-600 mb-6" />
                <h2 className="text-2xl font-bold mb-2">Month {month} {year} not found</h2>
                <button onClick={() => navigate(-1)} className="mt-4 px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">Go Back</button>
            </div>
        );
    }

    return (
        <div className="container pb-12 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 mt-4">
                <div>
                    <button onClick={() => navigate('/expenses')} className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-2 text-sm">
                        <ArrowLeft size={14} /> All Expenses
                    </button>
                    <h1 className="text-4xl font-black tracking-tight">{month} <span className="opacity-30">{year}</span></h1>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="px-6 py-3 rounded-2xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-all shadow-xl shadow-orange-500/20 flex items-center gap-2">
                    <Plus size={20} /> Add Expense
                </button>
            </div>

            {/* Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <SummaryCard title="Monthly Salary" subtitle="Income Source" amount={formatCurrency(monthDetails.salary)} percentage="100%" color="#10B981" />
                <SummaryCard title="Total Spends" subtitle={`${monthDetails.expenseCount} Categories`} amount={formatCurrency(monthDetails.totalGrossExpenses)} percentage={`-${monthDetails.expensePercentage}%`} color="#EF4444" />
                <SummaryCard title="Net Savings" subtitle="Current Balance" amount={formatCurrency(monthDetails.balance)} percentage={`${monthDetails.balancePercentage}%`} color="#3B82F6" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-8 flex flex-col gap-8">
                    {/* Graphs Section */}
                    <div className="card !bg-slate-900/50 border border-white/5">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-xl font-bold">Spending Velocity</h3>
                                <p className="text-xs text-gray-500 mt-1">Daily simulation of your spending habits</p>
                            </div>
                            <div className="flex bg-slate-800 rounded-xl p-1 border border-white/5">
                                <button onClick={() => setGraphType('bar')} className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${graphType === 'bar' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400'}`}>BAR</button>
                                <button onClick={() => setGraphType('line')} className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${graphType === 'line' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400'}`}>LINE</button>
                            </div>
                        </div>

                        <div className="w-full mt-4 relative" style={{ height: 320 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                {graphType === 'bar' ? (
                                    <BarChart key={`bar-${monthDetails.totalExpenses}`} data={monthDetails.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `₹${v / 1000}k` : `₹${v}`} domain={[0, 'auto']} />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                        />
                                        <Bar dataKey="amount" fill="#f97316" radius={[4, 4, 0, 0]} barSize={16} />
                                    </BarChart>
                                ) : (
                                    <LineChart key={`line-${monthDetails.totalExpenses}`} data={monthDetails.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `₹${v / 1000}k` : `₹${v}`} domain={[0, 'auto']} />
                                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                                        <Line type="monotone" dataKey="cumulative" stroke="#f97316" strokeWidth={3} dot={false} activeDot={{ r: 4, fill: '#f97316' }} />
                                    </LineChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Category Breakdown Area */}
                    <div className="card border border-white/5">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-bold">Category Breakdown</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {monthDetails.items
                                .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                                .map((item, index) => (
                                    <TransactionItem
                                        key={index}
                                        item={item}
                                        formatCurrency={formatCurrency}
                                        showActions={false}
                                        hideDate={true}
                                    />
                                ))
                            }
                        </div>

                        {/* Pagination */}
                        {monthDetails.items.length > ITEMS_PER_PAGE && (
                            <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/5">
                                <span className="text-xs font-medium text-gray-500">Page {currentPage} of {Math.ceil(monthDetails.items.length / ITEMS_PER_PAGE)}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-20 transition-all"><ChevronLeft size={18} /></button>
                                    <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(monthDetails.items.length / ITEMS_PER_PAGE), p + 1))} disabled={currentPage === Math.ceil(monthDetails.items.length / ITEMS_PER_PAGE)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-20 transition-all"><ChevronRight size={18} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar */}
                <div className="lg:col-span-4 flex flex-col gap-8">
                    {/* Statement Info Ledger */}
                    {/* Statement Info Ledger */}
                    <div className="card bg-indigo-500/5 border border-indigo-500/10 flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                                <CreditCard size={20} />
                            </div>
                            <div className="flex-1 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-white">Statement Info</h3>
                                <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-lg">
                                    {monthDetails.rawTransactions.length} Total
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 space-y-2 min-h-[300px]">
                            <p className="text-[10px] font-black text-indigo-400/50 uppercase tracking-widest mb-4 ml-1">Latest Transactions</p>
                            {monthDetails.rawTransactions.length > 0 ? (
                                monthDetails.rawTransactions
                                    .slice((statementPage - 1) * STATEMENT_ITEMS_PER_PAGE, statementPage * STATEMENT_ITEMS_PER_PAGE)
                                    .map((item, index) => (
                                        <TransactionItem
                                            key={item.id || index}
                                            item={item}
                                            formatCurrency={formatCurrency}
                                            compact={true}
                                            showActions={true}
                                            onEdit={(i) => { setEditingTransaction(i); setIsModalOpen(true); }}
                                            onDelete={(id) => window.confirm('Delete entry?') && deleteItem('expense', id)}
                                        />
                                    ))
                            ) : (
                                <div className="py-8 text-center">
                                    <p className="text-xs text-gray-600">No individual transactions recorded.</p>
                                </div>
                            )}
                        </div>

                        {/* Statement Pagination */}
                        {monthDetails.rawTransactions.length > STATEMENT_ITEMS_PER_PAGE && (
                            <div className="mt-6 pt-4 border-t border-indigo-500/10 flex justify-between items-center">
                                <button
                                    onClick={() => setStatementPage(p => Math.max(1, p - 1))}
                                    disabled={statementPage === 1}
                                    className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-xs font-bold text-indigo-300">
                                    Page {statementPage} of {Math.ceil(monthDetails.rawTransactions.length / STATEMENT_ITEMS_PER_PAGE)}
                                </span>
                                <button
                                    onClick={() => setStatementPage(p => Math.min(Math.ceil(monthDetails.rawTransactions.length / STATEMENT_ITEMS_PER_PAGE), p + 1))}
                                    disabled={statementPage === Math.ceil(monthDetails.rawTransactions.length / STATEMENT_ITEMS_PER_PAGE)}
                                    className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Credit Card Summary */}
                    {Object.keys(monthDetails.creditCardStats).length > 0 && (
                        <div className="card bg-purple-500/5 border border-purple-500/10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                                    <CreditCard size={20} />
                                </div>
                                <h3 className="text-lg font-bold text-white">Credit Card Summary</h3>
                            </div>
                            <div className="space-y-4">
                                {Object.entries(monthDetails.creditCardStats).map(([cardName, amount]) => (
                                    <div key={cardName} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-5 rounded bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center">
                                                <div className="w-4 h-3 bg-white/10 rounded-sm" />
                                            </div>
                                            <span className="text-sm font-medium text-gray-300">{cardName}</span>
                                        </div>
                                        <span className="text-sm font-black text-white">{formatCurrency(amount)}</span>
                                    </div>
                                ))}
                                <div className="pt-4 border-t border-purple-500/10 flex justify-between items-center">
                                    <span className="text-xs text-purple-400 font-bold uppercase tracking-wider">Total Credit</span>
                                    <span className="text-lg font-black text-white">{formatCurrency(monthDetails.totalCreditCardSpend)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Financial Tasks */}
                    <div className="card border border-white/5">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                                <MessageSquare size={20} />
                            </div>
                            <h3 className="text-lg font-bold">Financial Tasks</h3>
                        </div>
                        <div className="space-y-2">
                            <ReminderItem title="Review Monthly Budget" />
                            <ReminderItem title="Update Savings Target" />
                            <ReminderItem title="Pay House Rent" />
                            <ReminderItem title="Renew Subscription" />
                            <ReminderItem title="Invest in Stocks" />
                        </div>
                    </div>
                </div>
            </div>

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
                onAdd={handleSaveTransaction}
                initialData={editingTransaction}
            />
        </div>
    );
};

export default ExpenseDetails;
