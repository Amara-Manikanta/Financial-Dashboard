import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Wallet, TrendingDown, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, MoreHorizontal, Plus, ChevronLeft, ChevronRight, ChevronDown, MessageSquare, Edit2, Trash2, Tag, Home, Utensils, ShoppingBag, Car, Smartphone, PiggyBank, Film, Gift, Wifi, Zap, CreditCard, Check } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, Tooltip, YAxis, AreaChart, Area, CartesianGrid, LineChart, Line } from 'recharts';
import TransactionModal from '../components/TransactionModal';
import ConfirmModal from '../components/ConfirmModal';

const COLORS = ['#FF8C00', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B'];

const SummaryCard = ({ title, subtitle, amount, percentage, color }) => (
    <div style={{
        backgroundColor: '#18181b',
        border: `1px solid ${color}20`,
        borderRadius: '1.25rem',
        padding: '1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: `0 10px 15px -3px ${color}05`,
        position: 'relative',
        overflow: 'hidden'
    }}>
        <div>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#71717a', margin: '0 0 0.25rem 0' }}>{title}</h3>
            <p style={{ fontSize: '0.625rem', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem 0', fontWeight: 'bold' }}>{subtitle}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>{amount}</p>
        </div>

        <div style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '1rem',
            border: `2px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color,
            backgroundColor: `${color}08`,
            boxShadow: `0 0 15px ${color}15`
        }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '900' }}>{percentage}</span>
        </div>
    </div>
);

const TransactionItem = ({ item, formatCurrency, onEdit, onDelete, compact = false, showActions = true, hideDate = false, onClick, isHighlighted = false, isDimmed = false }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const IconComponent = CATEGORY_ICONS[item.category?.toLowerCase()] || Tag;

    const fullCategoryString = item.mainCategory && item.category 
        ? `${item.mainCategory} • ${item.category}` 
        : item.category;

    const subtitleParts = [];
    if (fullCategoryString) {
        subtitleParts.push(fullCategoryString);
    }
    if (!hideDate) subtitleParts.push(new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    if (showActions) {
        const type = item.isCredited ? 'Credit' : 'Debit';
        let paymentType = '';
        if (item.paymentMode === 'credit_card') {
            paymentType = 'Card';
        } else if (item.paymentMode === 'direct' || item.paymentMode === 'upi') {
            paymentType = 'UPI';
        } else if (item.paymentMode) {
            paymentType = item.paymentMode;
        }
        
        if (paymentType) {
            subtitleParts.push(`${type} • ${paymentType}`);
        } else {
            subtitleParts.push(type);
        }
    }

    const subtitle = subtitleParts.join(' • ');
    const isCredit = item.isCredited;
    const catColor = COLORS[Math.abs((item.category || '').length) % COLORS.length];

    return (
        <div 
            id={`tx-${item.id}`}
            onClick={onClick}
            style={{
                display: 'flex',
                flexDirection: 'column',
                padding: compact ? '0.75rem' : '1rem',
                borderRadius: '1rem',
                backgroundColor: 'rgba(24, 24, 27, 0.4)',
                border: isHighlighted 
                    ? '1px solid rgba(16, 185, 129, 0.3)' 
                    : `1px solid rgba(255, 255, 255, 0.05)`,
                opacity: isDimmed ? 0.3 : 1,
                cursor: onClick ? 'pointer' : 'default',
                position: 'relative',
                boxShadow: isHighlighted ? '0 4px 15px rgba(16, 185, 129, 0.05)' : 'none',
                gap: '0.5rem'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden', flex: 1 }}>
                    <div style={{
                        padding: compact ? '0.375rem' : '0.5rem',
                        borderRadius: '0.5rem',
                        backgroundColor: `${catColor}20`,
                        color: catColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <IconComponent size={compact ? 14 : 18} />
                    </div>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                        <h4 style={{ fontSize: compact ? '0.75rem' : '0.875rem', fontWeight: 'bold', color: 'white', textTransform: 'capitalize', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.title || fullCategoryString || 'Untitled'}
                        </h4>
                        {subtitle && (
                            <p style={{ fontSize: '9px', color: '#71717a', margin: '0.125rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                {subtitle}
                                {showActions && (
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isCredit ? '#10b981' : '#ef4444' }}></span>
                                )}
                            </p>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                    {showActions && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                                style={{
                                    padding: '0.25rem',
                                    borderRadius: '0.375rem',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: '#71717a',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                title="Edit"
                            >
                                <Edit2 size={12} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                style={{
                                    padding: '0.25rem',
                                    borderRadius: '0.375rem',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: '#71717a',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                title="Delete"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    )}

                    <div style={{ textAlign: 'right' }}>
                        <p style={{
                            fontSize: compact ? '0.75rem' : '0.875rem',
                            fontWeight: 'bold',
                            color: showActions && isCredit ? '#10b981' : 'white',
                            fontFamily: 'monospace',
                            margin: 0
                        }}>
                            {isCredit ? '+' : ''}{formatCurrency(item.amount)}
                        </p>
                    </div>
                </div>
            </div>

            {item.groceryItems && item.groceryItems.length > 0 && isExpanded && (
                <div style={{
                    marginTop: '0.5rem',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                }}>
                    <h5 style={{ fontSize: '8px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981', margin: '0 0 0.25rem 0' }}>Detailed Receipt</h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        {item.groceryItems.map((gi, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: 'white', fontWeight: 'medium' }}>
                                        {gi.name} <span style={{ color: '#71717a', fontSize: '9px', marginLeft: '0.25rem' }}>({gi.quantity || gi.customQuantity})</span>
                                    </span>
                                    {(gi.brand || gi.flavour) && (
                                        <span style={{ color: '#52525b', fontSize: '8px' }}>
                                            {gi.brand} {gi.brand && gi.flavour ? '•' : ''} {gi.flavour}
                                        </span>
                                    )}
                                </div>
                                <span style={{ color: '#a1a1aa', fontFamily: 'monospace' }}>₹{Number(gi.price || 0).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {item.groceryItems && item.groceryItems.length > 0 && (
                <button
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                    style={{
                        position: 'absolute',
                        bottom: '-0.625rem',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#18181b',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '50%',
                        width: '1.25rem',
                        height: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#71717a',
                        cursor: 'pointer',
                        padding: 0,
                        zIndex: 10
                    }}
                >
                    <ChevronDown size={10} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
            )}
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
    const { expenses, formatCurrency, salaryStats, addItem, deleteItem, updateItem, creditCards } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentMainPage, setCurrentMainPage] = useState(1);
    const [currentSubPage, setCurrentSubPage] = useState(1);
    const [graphType, setGraphType] = useState('bar');
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [statementPage, setStatementPage] = useState(1);
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null });
    const [selectedCategoryHighlight, setSelectedCategoryHighlight] = useState(null);
    const ITEMS_PER_PAGE = 12;
    const STATEMENT_ITEMS_PER_PAGE = 10;

    const location = useLocation();
    const highlightTxId = new URLSearchParams(location.search).get('highlightTxId');

    const defaultModalDate = useMemo(() => {
        const today = new Date();
        const targetMonthDate = new Date(`${month} 1, ${year}`);
        if (today.getMonth() !== targetMonthDate.getMonth() || today.getFullYear() !== targetMonthDate.getFullYear()) {
            return targetMonthDate;
        }
        return today;
    }, [month, year]);

    const monthDetails = useMemo(() => {
        const monthData = expenses[year]?.[month] || {};
        const categories = monthData.categories || monthData;

        // Calculate category totals from transactions dynamically
        const categoryTotals = {};
        const categoryDeductibles = {}; // To track what counts for totalNetExpenses

        const mainCategoryTotals = {};
        const mainCategoryDeductibles = {};

        // Initialize with existing categories from DB just in case, but rely on transactions for accuracy
        Object.entries(categories).forEach(([cat, val]) => {
            if (cat !== 'salary received' && cat !== 'salary' && cat !== 'income' && cat !== 'transactions') {
                categoryTotals[cat] = Number(val);
                categoryDeductibles[cat] = Number(val); // Default to deductible if from DB map
            }
        });

        // Re-aggregate from transactions to handle mixed deductible states correctly
        const activeTransactions = (monthData.transactions || []);
        if (activeTransactions.length > 0) {
            // Reset to 0 to rebuild strictly from transactions if they exist
            Object.keys(categoryTotals).forEach(k => { categoryTotals[k] = 0; categoryDeductibles[k] = 0; });

            activeTransactions.forEach(t => {
                const cat = t.category || 'others';

                // Skip income categories from expense calculation
                if (['salary received', 'salary', 'income'].includes(cat.toLowerCase())) return;

                const amt = Number(t.amount) || 0;
                // Logic: isCredited ? -amt : amt
                const effective = t.isCredited ? -amt : amt;

                // Case insensitive matching
                const targetKey = Object.keys(categoryTotals).find(k => k.toLowerCase() === cat.toLowerCase()) || cat;
                categoryTotals[targetKey] = (categoryTotals[targetKey] || 0) + effective;

                const mainCat = t.mainCategory || 'Miscellaneous';
                mainCategoryTotals[mainCat] = (mainCategoryTotals[mainCat] || 0) + effective;

                if (t.deductFromSalary !== false) {
                    categoryDeductibles[targetKey] = (categoryDeductibles[targetKey] || 0) + effective;
                    mainCategoryDeductibles[mainCat] = (mainCategoryDeductibles[mainCat] || 0) + effective;
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

        const mainItems = Object.entries(mainCategoryTotals)
            .filter(([_, amount]) => amount !== 0)
            .map(([category, amount], index) => ({
                id: `${year}-${month}-main-${category}-${index}`,
                date: new Date(`${month} 1, ${year}`).toISOString(),
                category: category,
                amount: amount,
                deductibleAmount: mainCategoryDeductibles[category] || 0,
                type: 'monthly-main'
            })).sort((a, b) => b.amount - a.amount);

        // Calculate totalNetExpenses using ONLY the deductible amounts
        const totalNetExpenses = items.reduce((sum, item) => sum + item.deductibleAmount, 0);
        // Calculate totalGrossExpenses using ALL amounts (deductible + non-deductible)
        const totalGrossExpenses = items.reduce((sum, item) => sum + item.amount, 0);

        const findSalary = (obj) => {
            if (!obj) return 0;
            const key = Object.keys(obj).find(k => ['salary received', 'salary', 'income'].includes(k.toLowerCase()));
            return key ? Number(obj[key]) : 0;
        };

        // Get configured salary from salaryStats first, fallback to categories
        let salary = salaryStats[year]?.months[month] || 0;
        if (salary === 0) {
            salary = findSalary(categories);
            if (salary === 0 && monthData['salary received']) {
                salary = Number(monthData['salary received']);
            }
        }

        // Add manual incomes from transactions
        if (activeTransactions.length > 0) {
            const hasSalaryTx = activeTransactions.some(t => ['salary received', 'salary'].includes((t.category || '').toLowerCase()));
            const baseSalary = hasSalaryTx ? 0 : salary; 
            
            const manualIncome = activeTransactions
                .filter(t => t.isCredited && (t.mainCategory === 'Income' || ['salary received', 'salary'].includes((t.category || '').toLowerCase())))
                .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                
            salary = baseSalary + manualIncome;
        }

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
                const txDate = new Date(t.date);
                let day = txDate.getDate();
                
                // If the transaction was shifted from a previous month due to the cutoff rule,
                // plot it on the 1st of the current viewed month so it doesn't wrongly appear at the end of the month.
                const viewedMonthIndex = new Date(`${month} 1, ${year}`).getMonth();
                if (txDate.getMonth() !== viewedMonthIndex) {
                    day = 1;
                }

                acc[day] = (acc[day] || 0) + Number(t.amount);
                return acc;
            }, {});

        const totalTransactionAmount = rawTransactions.filter(t => !t.isCredited).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const unaccounted = Math.max(0, totalGrossExpenses - totalTransactionAmount);

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
                if (t.category && (t.category.toLowerCase() === 'credit card bill' || t.category.toLowerCase() === 'credit card payment')) {
                    return sum;
                }
                const amount = Number(t.amount) || 0;
                
                // Do not subtract wallet loads or incomes from spends
                if (t.isCredited) {
                    if (t.category && ['food wallet', 'wallet load', 'deposit', 'income'].includes(t.category.toLowerCase())) {
                        return sum; 
                    }
                    return sum - amount; // Regular refund
                }
                
                return sum + amount;
            }, 0);

        const creditCardStats = {};
        const walletStats = {};
        
        const wallets = (creditCards || []).filter(c => c.type === 'wallet');
        
        wallets.forEach(w => {
            walletStats[w.name] = 0;
            const targetMonthDate = new Date(`${month} 1, ${year}`);
            Object.entries(expenses).forEach(([y, yData]) => {
                Object.entries(yData).forEach(([m, mData]) => {
                    const mDate = new Date(`${m} 1, ${y}`);
                    if (mDate <= targetMonthDate && mData.transactions) {
                        mData.transactions.forEach(t => {
                            if (t.paymentMode === 'credit_card' && t.creditCardName?.trim() === w.name.trim()) {
                                if (t.isCredited) {
                                    walletStats[w.name] += Number(t.amount) || 0;
                                } else {
                                    walletStats[w.name] -= Number(t.amount) || 0;
                                }
                            }
                        });
                    }
                });
            });
        });

        rawTransactions
            .filter(t => t.paymentMode === 'credit_card' && t.creditCardName)
            .forEach(t => {
                const card = t.creditCardName;
                if (wallets.some(w => w.name.trim() === card.trim())) return;

                if (t.category && (t.category.toLowerCase() === 'credit card bill' || t.category.toLowerCase() === 'credit card payment')) {
                    return;
                }
                const amount = Number(t.amount) || 0;
                const current = creditCardStats[card] || 0;
                
                if (t.isCredited) {
                    if (t.category && ['food wallet', 'wallet load', 'deposit', 'income'].includes(t.category.toLowerCase())) {
                        creditCardStats[card] = current; 
                    } else {
                        creditCardStats[card] = current - amount;
                    }
                } else {
                    creditCardStats[card] = current + amount;
                }
            });

        const carryForwardCCStats = {};
        const targetMonthDate = new Date(`${month} 1, ${year}`);

        // Build a map of card baselines for quick lookup
        const cardBaselineMap = {};
        creditCards.forEach(c => {
            if (c.carryForwardBaseline) {
                const [bm, by] = c.carryForwardBaseline.split('/');
                cardBaselineMap[c.name] = new Date(`${bm} 1, ${by}`);
            }
        });

        Object.entries(expenses).forEach(([y, yData]) => {
            Object.entries(yData).forEach(([m, mData]) => {
                const mDate = new Date(`${m} 1, ${y}`);
                if (mDate < targetMonthDate && mData.transactions) {
                    mData.transactions.forEach(t => {
                        if (t.paymentMode === 'credit_card' && t.creditCardName) {
                            const card = t.creditCardName;
                            if (wallets.some(w => w.name.trim() === card.trim())) return;

                            // Skip if before this card's baseline
                            const baseline = cardBaselineMap[card];
                            if (baseline && mDate < baseline) return;

                            const amount = Number(t.amount) || 0;
                            if (!carryForwardCCStats[card]) carryForwardCCStats[card] = 0;

                            if (t.category && (t.category.toLowerCase() === 'credit card bill' || t.category.toLowerCase() === 'credit card payment')) {
                                carryForwardCCStats[card] -= amount;
                                return;
                            }

                            if (t.isCredited) {
                                if (t.category && ['food wallet', 'wallet load', 'deposit', 'income'].includes(t.category.toLowerCase())) {
                                    // Ignored
                                } else {
                                    carryForwardCCStats[card] -= amount;
                                }
                            } else {
                                carryForwardCCStats[card] += amount;
                            }
                        }
                    });
                }
            });
        });

        // Clean up 0s
        Object.keys(carryForwardCCStats).forEach(card => {
            if (Math.abs(carryForwardCCStats[card]) < 1) delete carryForwardCCStats[card];
        });

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
            creditCardStats,
            carryForwardCCStats,
            walletStats,
            mainItems
        };
    }, [expenses, creditCards, year, month, salaryStats]);

    React.useEffect(() => {
        if (highlightTxId && monthDetails?.rawTransactions) {
            // Find which page the transaction is on
            const activeTxs = monthDetails.rawTransactions.filter(t => 
                selectedCategoryHighlight ? t.category === selectedCategoryHighlight : true
            );
            const index = activeTxs.findIndex(tx => tx.id === highlightTxId);
            if (index !== -1) {
                const targetPage = Math.floor(index / STATEMENT_ITEMS_PER_PAGE) + 1;
                setStatementPage(targetPage);
                
                setTimeout(() => {
                    const el = document.getElementById(`tx-${highlightTxId}`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            }
        }
    }, [highlightTxId, monthDetails?.rawTransactions, selectedCategoryHighlight]);

    const displayTransactions = useMemo(() => {
        let txs = monthDetails.rawTransactions;
        if (selectedCategoryHighlight) {
            txs = txs.filter(t => 
                selectedCategoryHighlight.type === 'main' 
                    ? (t.mainCategory || 'Miscellaneous') === selectedCategoryHighlight.name 
                    : (t.category || 'others') === selectedCategoryHighlight.name
            );
        }
        return txs;
    }, [monthDetails.rawTransactions, selectedCategoryHighlight]);

    // Reset pagination and filters on route change
    React.useEffect(() => {
        setStatementPage(1);
        setCurrentMainPage(1);
        setCurrentSubPage(1);
        setSelectedCategoryHighlight(null);
    }, [year, month]);

    // Reset statement page when filter changes
    React.useEffect(() => {
        setStatementPage(1);
    }, [selectedCategoryHighlight]);

    const handleSaveTransaction = (transaction) => {
        if (transaction.id) updateItem('expense', transaction);
        else addItem('expense', transaction);
        setEditingTransaction(null);
    };

    const handleDeleteTransaction = (id) => {
        setDeleteConfirm({ isOpen: true, id });
    };

    const confirmDelete = () => {
        if (deleteConfirm.id) {
            deleteItem('expense', deleteConfirm.id);
        }
        setDeleteConfirm({ isOpen: false, id: null });
    };

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonthIndex = MONTHS.indexOf(month);
    
    let prevMonth = '', prevYear = year;
    let nextMonth = '', nextYear = year;

    if (currentMonthIndex > 0) {
        prevMonth = MONTHS[currentMonthIndex - 1];
    } else {
        prevMonth = MONTHS[11];
        prevYear = String(Number(year) - 1);
    }

    if (currentMonthIndex < 11) {
        nextMonth = MONTHS[currentMonthIndex + 1];
    } else {
        nextMonth = MONTHS[0];
        nextYear = String(Number(year) + 1);
    }

    const handlePrevMonth = () => navigate(`/expenses/${prevYear}/${prevMonth}`);
    const handleNextMonth = () => navigate(`/expenses/${nextYear}/${nextMonth}`);

    if (!expenses[year] || !expenses[year][month]) {
        return (
            <div className="container min-h-[60vh] flex flex-col items-center justify-center text-center">
                <Calendar size={48} className="text-gray-600 mb-6" />
                <h2 className="text-2xl font-bold mb-2">Month {month} {year} not found</h2>
                <div className="flex items-center gap-4 mt-6">
                    <button onClick={handlePrevMonth} className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2">
                        <ChevronLeft size={16} /> Previous
                    </button>
                    <button onClick={() => navigate('/expenses')} className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">Go Back</button>
                    <button onClick={handleNextMonth} className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2">
                        Next <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                <button
                    onClick={() => navigate('/expenses')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: '#71717a',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        padding: 0
                    }}
                >
                    ← All Expenses
                </button>

                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1.5rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
                            {month} <span style={{ color: '#71717a' }}>{year}</span>
                        </h2>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={handlePrevMonth}
                                style={{
                                    padding: '0.5rem',
                                    borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    color: '#71717a',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                title={`Go to ${prevMonth} ${prevYear}`}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={handleNextMonth}
                                style={{
                                    padding: '0.5rem',
                                    borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    color: '#71717a',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                title={`Go to ${nextMonth} ${nextYear}`}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '1rem',
                            backgroundColor: '#eab308',
                            color: 'black',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            cursor: 'pointer',
                            border: 'none',
                            boxShadow: '0 4px 10px -2px rgba(234, 179, 8, 0.2)'
                        }}
                    >
                        <Plus size={16} /> Add Expense
                    </button>
                </div>
            </div>

            {/* Summaries */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                <SummaryCard title="Monthly Salary" subtitle="Income Source" amount={formatCurrency(monthDetails.salary)} percentage="100%" color="#10B981" />
                <SummaryCard title="Total Spends" subtitle={`${monthDetails.expenseCount} Categories`} amount={formatCurrency(monthDetails.totalGrossExpenses)} percentage={`-${monthDetails.expensePercentage}%`} color="#ef4444" />
                <SummaryCard title="Net Savings" subtitle="Current Balance" amount={formatCurrency(monthDetails.balance)} percentage={`${monthDetails.balancePercentage}%`} color="#3b82f6" />
            </div>

            {/* Content Body Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '2rem'
            }} className="lg:grid-cols-12">
                {/* Main Content Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} className="lg:col-span-8">
                    {/* Spending Velocity */}
                    <div style={{
                        backgroundColor: 'rgba(24, 24, 27, 0.4)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '2rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        padding: '1.5rem',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: '0 0 0.25rem 0' }}>Spending Velocity</h3>
                                <p style={{ fontSize: '0.75rem', color: '#71717a', margin: 0 }}>Daily simulation of your spending habits</p>
                            </div>
                            <div style={{
                                display: 'flex',
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '0.75rem',
                                padding: '2px'
                            }}>
                                <button
                                    onClick={() => setGraphType('bar')}
                                    style={{
                                        padding: '0.375rem 0.75rem',
                                        fontSize: '9px',
                                        fontWeight: '900',
                                        letterSpacing: '0.05em',
                                        borderRadius: '0.5rem',
                                        border: 'none',
                                        backgroundColor: graphType === 'bar' ? '#eab308' : 'transparent',
                                        color: graphType === 'bar' ? 'black' : '#71717a',
                                        cursor: 'pointer'
                                    }}
                                >
                                    BAR
                                </button>
                                <button
                                    onClick={() => setGraphType('line')}
                                    style={{
                                        padding: '0.375rem 0.75rem',
                                        fontSize: '9px',
                                        fontWeight: '900',
                                        letterSpacing: '0.05em',
                                        borderRadius: '0.5rem',
                                        border: 'none',
                                        backgroundColor: graphType === 'line' ? '#eab308' : 'transparent',
                                        color: graphType === 'line' ? 'black' : '#71717a',
                                        cursor: 'pointer'
                                    }}
                                >
                                    LINE
                                </button>
                            </div>
                        </div>

                        <div style={{ width: '100%', height: 320, position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                {graphType === 'bar' ? (
                                    <BarChart key={`bar-${monthDetails.totalExpenses}`} data={monthDetails.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 10 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `₹${v / 1000}k` : `₹${v}`} domain={[0, 'auto']} />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: 'white' }}
                                        />
                                        <Bar dataKey="amount" fill="#eab308" radius={[4, 4, 0, 0]} barSize={16} />
                                    </BarChart>
                                ) : (
                                    <LineChart key={`line-${monthDetails.totalExpenses}`} data={monthDetails.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 10 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `₹${v / 1000}k` : `₹${v}`} domain={[0, 'auto']} />
                                        <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: 'white' }} />
                                        <Line type="monotone" dataKey="cumulative" stroke="#eab308" strokeWidth={3} dot={false} activeDot={{ r: 4, fill: '#eab308' }} />
                                    </LineChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Main Category Breakdown Area */}
                    <div style={{
                        backgroundColor: 'rgba(24, 24, 27, 0.4)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '2rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        padding: '1.5rem',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                    }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: '0 0 1.5rem 0' }}>Main Category Breakdown</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                            {monthDetails.mainItems
                                .slice((currentMainPage - 1) * ITEMS_PER_PAGE, currentMainPage * ITEMS_PER_PAGE)
                                .map((item) => (
                                    <TransactionItem
                                        key={item.id}
                                        item={item}
                                        formatCurrency={formatCurrency}
                                        showActions={false}
                                        hideDate={true}
                                        onClick={() => setSelectedCategoryHighlight(
                                            selectedCategoryHighlight?.name === item.category && selectedCategoryHighlight?.type === 'main'
                                                ? null 
                                                : { type: 'main', name: item.category }
                                        )}
                                        isHighlighted={selectedCategoryHighlight?.type === 'main' && selectedCategoryHighlight?.name === item.category}
                                        isDimmed={selectedCategoryHighlight && (selectedCategoryHighlight.type !== 'main' || selectedCategoryHighlight.name !== item.category)}
                                    />
                                ))
                            }
                        </div>

                        {/* Pagination */}
                        {monthDetails.mainItems.length > ITEMS_PER_PAGE && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '11px', color: '#71717a' }}>Page {currentMainPage} of {Math.ceil(monthDetails.mainItems.length / ITEMS_PER_PAGE)}</span>
                                <div style={{ display: 'flex', gap: '0.375rem' }}>
                                    <button onClick={() => setCurrentMainPage(p => Math.max(1, p - 1))} disabled={currentMainPage === 1} style={{ padding: '0.375rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
                                    <button onClick={() => setCurrentMainPage(p => Math.min(Math.ceil(monthDetails.mainItems.length / ITEMS_PER_PAGE), p + 1))} disabled={currentMainPage === Math.ceil(monthDetails.mainItems.length / ITEMS_PER_PAGE)} style={{ padding: '0.375rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer' }}><ChevronRight size={16} /></button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sub Category Breakdown Area */}
                    <div style={{
                        backgroundColor: 'rgba(24, 24, 27, 0.4)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '2rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        padding: '1.5rem',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                    }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: '0 0 1.5rem 0' }}>Sub Category Breakdown</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                            {monthDetails.items
                                .slice((currentSubPage - 1) * ITEMS_PER_PAGE, currentSubPage * ITEMS_PER_PAGE)
                                .map((item) => (
                                    <TransactionItem
                                        key={item.id}
                                        item={item}
                                        formatCurrency={formatCurrency}
                                        showActions={false}
                                        hideDate={true}
                                        onClick={() => setSelectedCategoryHighlight(
                                            selectedCategoryHighlight?.name === item.category && selectedCategoryHighlight?.type === 'sub'
                                                ? null 
                                                : { type: 'sub', name: item.category }
                                        )}
                                        isHighlighted={selectedCategoryHighlight?.type === 'sub' && selectedCategoryHighlight?.name === item.category}
                                        isDimmed={selectedCategoryHighlight && (selectedCategoryHighlight.type !== 'sub' || selectedCategoryHighlight.name !== item.category)}
                                    />
                                ))
                            }
                        </div>

                        {/* Pagination */}
                        {monthDetails.items.length > ITEMS_PER_PAGE && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '11px', color: '#71717a' }}>Page {currentSubPage} of {Math.ceil(monthDetails.items.length / ITEMS_PER_PAGE)}</span>
                                <div style={{ display: 'flex', gap: '0.375rem' }}>
                                    <button onClick={() => setCurrentSubPage(p => Math.max(1, p - 1))} disabled={currentSubPage === 1} style={{ padding: '0.375rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
                                    <button onClick={() => setCurrentSubPage(p => Math.min(Math.ceil(monthDetails.items.length / ITEMS_PER_PAGE), p + 1))} disabled={currentSubPage === Math.ceil(monthDetails.items.length / ITEMS_PER_PAGE)} style={{ padding: '0.375rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer' }}><ChevronRight size={16} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} className="lg:col-span-4">
                    {/* Statement Info Ledger */}
                    <div style={{
                        backgroundColor: 'rgba(99, 102, 241, 0.03)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '2rem',
                        border: '1px solid rgba(99, 102, 241, 0.1)',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    padding: '0.5rem',
                                    borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                    color: '#818cf8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <CreditCard size={18} />
                                </div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: 0 }}>Statement Info</h3>
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#818cf8', backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem' }}>
                                {displayTransactions.length} Total
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '300px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <p style={{ fontSize: '8px', fontWeight: '950', color: 'rgba(129, 140, 248, 0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Latest Transactions</p>
                                {selectedCategoryHighlight && (
                                    <button 
                                        onClick={() => setSelectedCategoryHighlight(null)}
                                        style={{ fontSize: '9px', fontWeight: 'bold', border: 'none', backgroundColor: 'rgba(16,185,129,0.1)', color: '#34d399', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', cursor: 'pointer' }}
                                    >
                                        Clear Filter
                                    </button>
                                )}
                            </div>

                            {displayTransactions.length > 0 ? (
                                displayTransactions
                                    .slice((statementPage - 1) * STATEMENT_ITEMS_PER_PAGE, statementPage * STATEMENT_ITEMS_PER_PAGE)
                                    .map((item, index) => (
                                        <TransactionItem
                                            key={item.id || index}
                                            item={item}
                                            formatCurrency={formatCurrency}
                                            compact={true}
                                            showActions={true}
                                            onEdit={(i) => { setEditingTransaction(i); setIsModalOpen(true); }}
                                            onDelete={handleDeleteTransaction}
                                            isHighlighted={item.id === highlightTxId}
                                        />
                                    ))
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                    <p style={{ fontSize: '11px', color: '#71717a', margin: 0 }}>No transactions match selection.</p>
                                </div>
                            )}
                        </div>

                        {/* Statement Pagination */}
                        {displayTransactions.length > STATEMENT_ITEMS_PER_PAGE && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(99, 102, 241, 0.1)' }}>
                                <button
                                    onClick={() => setStatementPage(p => Math.max(1, p - 1))}
                                    disabled={statementPage === 1}
                                    style={{ padding: '0.375rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(99, 102, 241, 0.05)', color: '#818cf8', cursor: 'pointer', opacity: statementPage === 1 ? 0.3 : 1 }}
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 'bold' }}>
                                    Page {statementPage} of {Math.ceil(displayTransactions.length / STATEMENT_ITEMS_PER_PAGE)}
                                </span>
                                <button
                                    onClick={() => setStatementPage(p => Math.min(Math.ceil(displayTransactions.length / STATEMENT_ITEMS_PER_PAGE), p + 1))}
                                    disabled={statementPage === Math.ceil(displayTransactions.length / STATEMENT_ITEMS_PER_PAGE)}
                                    style={{ padding: '0.375rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(99, 102, 241, 0.05)', color: '#818cf8', cursor: 'pointer', opacity: statementPage === Math.ceil(displayTransactions.length / STATEMENT_ITEMS_PER_PAGE) ? 0.3 : 1 }}
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Credit Card Summary */}
                    {(Object.keys(monthDetails.creditCardStats).length > 0 || Object.keys(monthDetails.carryForwardCCStats || {}).length > 0) && (
                        <div style={{
                            backgroundColor: 'rgba(168, 85, 247, 0.03)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '2rem',
                            border: '1px solid rgba(168, 85, 247, 0.1)',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.5rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    padding: '0.5rem',
                                    borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                                    color: '#c084fc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <CreditCard size={18} />
                                </div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: 0 }}>Credit Card Summary</h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {Array.from(new Set([...Object.keys(monthDetails.creditCardStats), ...Object.keys(monthDetails.carryForwardCCStats || {})])).map(cardName => {
                                    const currentSpend = monthDetails.creditCardStats[cardName] || 0;
                                    const carryForward = monthDetails.carryForwardCCStats?.[cardName] || 0;
                                    const totalDue = currentSpend + carryForward;
                                    
                                    return (
                                        <div key={cardName} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', borderRadius: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '1rem', color: 'white', fontWeight: 'bold' }}>{cardName}</span>
                                                <span style={{ fontSize: '1.125rem', color: 'white', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatCurrency(totalDue)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Current Spends</span>
                                                    <span style={{ fontSize: '0.875rem', color: '#e4e4e7', fontFamily: 'monospace' }}>{formatCurrency(currentSpend)}</span>
                                                </div>
                                                {carryForward > 0 && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                        <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Carry Forward Due</span>
                                                        <span style={{ fontSize: '0.875rem', color: '#fcd34d', fontFamily: 'monospace' }}>{formatCurrency(carryForward)}</span>
                                                    </div>
                                                )}
                                                {carryForward < 0 && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                        <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Overpaid</span>
                                                        <span style={{ fontSize: '0.875rem', color: '#34d399', fontFamily: 'monospace' }}>{formatCurrency(Math.abs(carryForward))}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(168, 85, 247, 0.1)' }}>
                                    <span style={{ fontSize: '9px', fontWeight: '900', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Current Spends</span>
                                    <span style={{ fontSize: '1.125rem', color: 'white', fontWeight: '950', fontFamily: 'monospace' }}>{formatCurrency(monthDetails.totalCreditCardSpend)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Wallet Summary */}
                    {Object.keys(monthDetails.walletStats).length > 0 && (
                        <div style={{
                            backgroundColor: 'rgba(16, 185, 129, 0.03)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '2rem',
                            border: '1px solid rgba(16, 185, 129, 0.1)',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.5rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    padding: '0.5rem',
                                    borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                    color: '#34d399',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Wallet size={18} />
                                </div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: 0 }}>Wallets Summary</h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {Object.entries(monthDetails.walletStats).map(([walletName, amount]) => (
                                    <div key={walletName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <span style={{ fontSize: '0.875rem', color: '#a1a1aa', fontWeight: 'bold' }}>{walletName}</span>
                                        <span style={{ fontSize: '0.875rem', color: '#34d399', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatCurrency(amount)}</span>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                    <span style={{ fontSize: '9px', fontWeight: '900', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Wallet Value</span>
                                    <span style={{ fontSize: '1.125rem', color: 'white', fontWeight: '950', fontFamily: 'monospace' }}>
                                        {formatCurrency(Object.values(monthDetails.walletStats).reduce((a, b) => a + b, 0))}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Financial Tasks */}
                    <div style={{
                        backgroundColor: 'rgba(24, 24, 27, 0.4)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '2rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        padding: '1.5rem',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                                padding: '0.5rem',
                                borderRadius: '0.75rem',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                color: '#34d399',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <MessageSquare size={18} />
                            </div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: 0 }}>Financial Tasks</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <ReminderItem title="Review Monthly Budget" />
                            <ReminderItem title="Update Savings Target" />
                            <ReminderItem title="Pay House Rent" />
                            <ReminderItem title="Renew Subscription" />
                            <ReminderItem title="Invest in Stocks" />
                        </div>
                    </div>
                </div>
            </div>


            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
                onConfirm={confirmDelete}
                title="Delete Transaction"
                message="Are you sure you want to delete this transaction? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                type="danger"
            />

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
                onAdd={handleSaveTransaction}
                initialData={editingTransaction}
                defaultDate={defaultModalDate}
            />
        </div>
    );
};

export default ExpenseDetails;
