import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getLastWorkingDayOfMonth } from '../utils/dateUtils';


const FinanceContext = createContext();


export function FinanceProvider({ children }) {
    const calculateSalaryStats = (expensesData) => {
        const stats = {};
        if (!expensesData || typeof expensesData !== 'object') return stats;

        Object.entries(expensesData).forEach(([year, months]) => {
            if (!stats[year]) stats[year] = { total: 0, months: {} };

            Object.entries(months).forEach(([month, data]) => {
                if (!data) return;
                const categories = data.categories || data;
                const salary = categories['salary received'] || 0;
                if (salary > 0) {
                    stats[year].total += salary;
                    stats[year].months[month] = salary;
                }
            });
        });
        return stats;
    };



    const API_URL = 'http://127.0.0.1:3000';

    const [expenses, setExpenses] = useState({});
    const [savings, setSavings] = useState([]);
    const [metals, setMetals] = useState({ gold: [], silver: [] });
    const [assets, setAssets] = useState([]);
    const [lents, setLents] = useState([]);
    const [categories, setCategories] = useState([]);
    const [creditCards, setCreditCards] = useState([]);
    const [salaryStats, setSalaryStats] = useState({});
    const [snapshots, setSnapshots] = useState([]);
    const [categoryBudgets, setCategoryBudgets] = useState({});
    const [metalRates, setMetalRates] = useState({ gold: 0, silver: 0 });
    const [manualMetalRates, setManualMetalRates] = useState({ gold: 0, silver: 0 });

    const { user, isGuest } = useAuth();

    useEffect(() => {
        setSalaryStats(calculateSalaryStats(expenses));
    }, [expenses]);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            if (isGuest) {
                // ... (existing guest logic)
                const guestLents = []; // Guest mode placeholder
                const guestCreditCards = []; // Guest mode placeholder

                setExpenses(guestExpenses);
                setSavings(guestSavings);
                setMetals({ gold: [], silver: [] });
                setAssets(guestAssets);
                setLents(guestLents);
                setCreditCards(guestCreditCards);
                setBudgets([]); // Removed
                setCategoryBudgets({});
                setCategories(["salary received", "house rent", "groceries", "others"]);
                setSalaryStats({});
                setSnapshots([]);
                return;
            }
            try {
                const [expRes, savRes, metRes, assRes, appRes, snapRes, lentRes, ccRes] = await Promise.all([
                    fetch(`${API_URL}/expenses?_t=${Date.now()}`),
                    fetch(`${API_URL}/savings?_t=${Date.now()}`),
                    fetch(`${API_URL}/metals?_t=${Date.now()}`),
                    fetch(`${API_URL}/assets?_t=${Date.now()}`),
                    fetch(`${API_URL}/appData?_t=${Date.now()}`),
                    fetch(`${API_URL}/snapshots?_t=${Date.now()}`),
                    fetch(`${API_URL}/lents?_t=${Date.now()}`),
                    fetch(`${API_URL}/creditCards?_t=${Date.now()}`)
                ]);

                const expData = await expRes.json();
                const savData = await savRes.json();
                const metData = await metRes.json();
                const assData = await assRes.json();
                const appData = await appRes.json();
                const snapData = await snapRes.json();
                const lentData = await lentRes.json();
                const ccData = await ccRes.json();

                setExpenses(expData);
                setSavings(savData);
                setMetals(metData);
                setAssets(assData);
                setLents(lentData || []);
                setCreditCards(ccData || []);
                setCategoryBudgets(appData.categoryBudgets || {});
                setCategories(appData.categories || []);
                setManualMetalRates(appData.manualMetalRates || { gold: 0, silver: 0 });
                setSnapshots(snapData || []);

            } catch (error) {
                console.error("Failed to fetch data:", error);
            }
        };
        fetchData();
        fetchData();
        fetchMetalRates();
    }, [user, isGuest]);

    const fetchMetalRates = async () => {
        try {
            const res = await fetch('https://data-asg.goldprice.org/dbXRates/INR');
            const data = await res.json();
            if (data.items && data.items.length > 0) {
                const item = data.items[0];
                // Prices are per Ounce (31.1035 g)
                const goldPerGram = item.xauPrice / 31.1034768;
                const silverPerGram = item.xagPrice / 31.1034768;
                setMetalRates({ gold: goldPerGram, silver: silverPerGram });
            }
        } catch (error) {
            console.error("Failed to fetch metal rates:", error);
        }
    };

    const updateManualRates = async (rates) => {
        setManualMetalRates(rates);
        try {
            // Fetch current appData to merge correctly
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();

            const updatedAppData = {
                ...currentAppData,
                manualMetalRates: rates
            };

            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedAppData)
            });
        } catch (error) {
            console.error("Failed to save manual rates:", error);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(amount);
    };

    const saveExpenses = async (updatedExpenses) => {
        setExpenses(updatedExpenses);
        try {
            await fetch(`${API_URL}/expenses`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedExpenses)
            });
        } catch (error) {
            console.error("Failed to save expenses:", error);
        }
    };

    const updateCategoryBudget = async (category, amount) => {
        const updatedBudgets = { ...categoryBudgets, [category]: Number(amount) };
        setCategoryBudgets(updatedBudgets);

        try {
            // Fetch current appData first (safer approach)
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();

            const payload = {
                ...currentAppData,
                categoryBudgets: updatedBudgets
            };

            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error("Failed to update category budget:", error);
        }
    };

    const addItem = async (type, item) => {
        if (type === 'expense') {
            const dateObj = new Date(item.date);
            // Scapia billing cycle adjustment: 25th onwards counts as next month
            if (item.paymentMode === 'credit_card' && item.creditCardName && item.creditCardName.includes('Scapia') && dateObj.getDate() > 24) {
                dateObj.setMonth(dateObj.getMonth() + 1, 1);
            } else {
                // Month-End Cutoff Rule: Last Working Day onwards counts as next month
                const curYear = dateObj.getFullYear();
                const curMonth = dateObj.getMonth();
                const lastWorkingDay = getLastWorkingDayOfMonth(curYear, curMonth);
                if (dateObj.getDate() >= lastWorkingDay) {
                    dateObj.setMonth(dateObj.getMonth() + 1, 1);
                }
            }
            const year = dateObj.getFullYear().toString();
            const month = dateObj.toLocaleString('default', { month: 'long' });
            const amount = Number(item.amount) || 0;
            const category = item.category.toLowerCase();

            // Check and add new category
            if (category && !categories.some(c => c.toLowerCase() === category)) {
                const newCategories = [...categories, category];
                setCategories(newCategories);

                // Safe updated of appData
                const res = await fetch(`${API_URL}/appData`);
                const currentAppData = await res.json();

                fetch(`${API_URL}/appData`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...currentAppData, categories: newCategories })
                });
            }

            const isIncomeCategory = ['salary received', 'income'].includes(category);


            const newExpenses = { ...expenses };
            if (!newExpenses[year]) newExpenses[year] = {};
            if (!newExpenses[year][month]) newExpenses[year][month] = { categories: {}, transactions: [] };

            const monthData = newExpenses[year][month];
            const target = monthData.categories || monthData;

            // Sum up into category (case-insensitive)
            const targetKey = Object.keys(target).find(k => k.toLowerCase() === category.toLowerCase());
            const finalKey = targetKey || category;

            let effectiveAmount = 0;
            if (isIncomeCategory) {
                effectiveAmount = item.isCredited ? amount : -amount;
            } else {
                effectiveAmount = item.isCredited ? -amount : amount;
            }

            if (item.deductFromSalary !== false) {
                target[finalKey] = Math.max(0, (target[finalKey] || 0) + effectiveAmount);
            }

            if (!monthData.transactions) monthData.transactions = [];
            monthData.transactions.push({
                id: Date.now().toString(),
                title: item.title,
                amount: amount,
                category: category,
                date: item.date,
                paymentMode: item.paymentMode,
                creditCardName: item.creditCardName,
                isCredited: item.isCredited,
                transactionType: item.transactionType,
                deductFromSalary: item.deductFromSalary
            });

            await saveExpenses(newExpenses);
            return;
        }

        let endpoint = type === 'savings' ? 'savings' : type === 'asset' ? 'assets' : type === 'lents' ? 'lents' : type === 'creditCards' ? 'creditCards' : '';
        if (!endpoint) return;

        try {
            const res = await fetch(`${API_URL}/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            const savedItem = await res.json();
            if (type === 'savings') setSavings(prev => [...prev, savedItem]);
            if (type === 'asset') setAssets(prev => [...prev, savedItem]);
            if (type === 'lents') setLents(prev => [...prev, savedItem]);
            if (type === 'creditCards') setCreditCards(prev => [...prev, savedItem]);
        } catch (error) {
            console.error("Error adding item:", error);
        }
    };

    const addMetal = async (type, item) => {
        const newItem = { ...item, id: Date.now() };
        const updated = { ...metals, [type]: [...metals[type], newItem] };
        setMetals(updated);
        try {
            await fetch(`${API_URL}/metals`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
            });
        } catch (error) {
            console.error("Error adding metal:", error);
        }
    };

    const updateMetal = async (type, item) => {
        const updated = {
            ...metals,
            [type]: metals[type].map(i => i.id === item.id ? item : i)
        };
        setMetals(updated);
        try {
            await fetch(`${API_URL}/metals`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
            });
        } catch (error) {
            console.error("Error updating metal:", error);
        }
    };

    const deleteMetal = async (type, id) => {
        const updated = {
            ...metals,
            [type]: metals[type].filter(i => i.id !== id)
        };
        setMetals(updated);
        try {
            await fetch(`${API_URL}/metals`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
            });
        } catch (error) {
            console.error("Error deleting metal:", error);
        }
    };

    const deleteItem = async (type, id) => {
        if (type === 'expense') {
            const newExpenses = { ...expenses };
            // Individual transaction delete
            if (typeof id === 'string' && !id.includes('-')) {
                let found = false;
                Object.values(newExpenses).forEach(months => {
                    Object.values(months).forEach(monthData => {
                        if (found || !monthData.transactions) return;
                        const txIndex = monthData.transactions.findIndex(t => t.id === id);
                        if (txIndex !== -1) {
                            const tx = monthData.transactions[txIndex];
                            const target = monthData.categories || monthData;
                            const catKey = Object.keys(target).find(k => k.toLowerCase() === tx.category.toLowerCase());
                            if (catKey && tx.deductFromSalary !== false) {
                                const isIncome = ['salary received', 'income'].includes(catKey.toLowerCase());
                                let effectiveAmount = 0;
                                if (isIncome) {
                                    // removing a credit reduces total
                                    effectiveAmount = tx.isCredited ? -tx.amount : tx.amount;
                                } else {
                                    // removing a debit reduces total (which means adding back the credited amount? no wait)
                                    // In expenses: 
                                    // Add: debit (+amount), credit (-amount)
                                    // Delete: debit (-amount), credit (+amount)
                                    effectiveAmount = tx.isCredited ? tx.amount : -tx.amount;
                                }
                                // We want to SUBTRACT the original effect.
                                // Original effect for expense: Credit(-), Debit(+)
                                // So to remove: Credit(+), Debit(-)

                                // Original effect for income: Credit(+), Debit(-)
                                // So to remove: Credit(-), Debit(+)

                                // The code below was:
                                // const effectiveAmount = tx.isCredited ? -tx.amount : tx.amount;
                                // target[catKey] = Math.max(0, (target[catKey] || 0) - effectiveAmount);

                                // If I use that same logic:
                                // Income Credit: eff = +amount.  Target - (+amount) = Correct.
                                // Income Debit: eff = -amount. Target - (-amount) = Correct.

                                // So I just need to define effectiveAmount correctly as per the Add logic.

                                const val = isIncome
                                    ? (tx.isCredited ? tx.amount : -tx.amount)
                                    : (tx.isCredited ? -tx.amount : tx.amount);

                                target[catKey] = Math.max(0, (target[catKey] || 0) - val);
                            }
                            monthData.transactions.splice(txIndex, 1);
                            found = true;
                        }
                    });
                });
                if (found) await saveExpenses(newExpenses);
                return;
            }

            // Category-level delete
            const parts = typeof id === 'string' ? id.split('-') : [];
            if (parts.length >= 3) {
                const [year, month] = parts.slice(0, 2);
                const catName = parts.slice(2, parts.length - 1).join('-');
                if (newExpenses[year] && newExpenses[year][month]) {
                    const data = newExpenses[year][month];
                    const target = data.categories || data;
                    const targetKey = Object.keys(target).find(k => k.toLowerCase() === catName.toLowerCase());
                    if (targetKey) delete target[targetKey];
                    if (data.transactions) {
                        data.transactions = data.transactions.filter(t => t.category.toLowerCase() !== catName.toLowerCase());
                    }
                    await saveExpenses(newExpenses);
                }
            }
            return;
        }

        let endpoint = type === 'savings' ? 'savings' : type === 'asset' ? 'assets' : type === 'lents' ? 'lents' : type === 'creditCards' ? 'creditCards' : '';
        if (!endpoint) return;
        try {
            await fetch(`${API_URL}/${endpoint}/${id}`, { method: 'DELETE' });
            if (type === 'savings') setSavings(prev => prev.filter(i => i.id != id));
            if (type === 'asset') setAssets(prev => prev.filter(i => i.id != id));
            if (type === 'lents') setLents(prev => prev.filter(i => i.id != id));
            if (type === 'creditCards') setCreditCards(prev => prev.filter(i => i.id != id));
        } catch (error) {
            console.error("Error deleting item:", error);
        }
    };



    const processedMetals = React.useMemo(() => {
        // Prefer manual rates if set (> 0), else fallback to API
        const manualGold = Number(manualMetalRates?.gold);
        const manualSilver = Number(manualMetalRates?.silver);

        const GOLD_RATE_24K = manualGold > 0 ? manualGold : (metalRates.gold || 7600);
        // If API is used, it calculates 22k from 24K. If manual is used, we assume manual is 24K standard?
        // Let's assume manual rate entered is for standard 24K. 22K is derived.
        // OR we can ask user for both. For now, derived is safer simple UX.
        const GOLD_RATE_22K = GOLD_RATE_24K * (22 / 24);

        const SILVER_RATE = manualSilver > 0 ? manualSilver : (metalRates.silver || 95);

        return {
            gold: metals.gold.map(item => {
                if (item.currentValue > 0) return item;
                const rate = item.purity === 24 ? GOLD_RATE_24K : GOLD_RATE_22K;
                return { ...item, currentValue: item.weightGm * rate };
            }),
            silver: metals.silver.map(item => {
                if (item.currentValue > 0) return item;
                return { ...item, currentValue: item.weightGm * SILVER_RATE };
            })
        };
    }, [metals, metalRates, manualMetalRates]);

    const calculateItemCurrentValue = (item) => {
        if (!item) return 0;

        switch (item.type) {
            case 'stock_market':
                return (item.stocks || []).reduce((sum, s) => sum + (Number(s.shares || 0) * Number(s.currentPrice || 0)), 0);

            case 'mutual_fund':
                let totalUnits = 0;
                (item.transactions || []).forEach(tx => {
                    const type = tx.type || (tx.remarks && tx.remarks.toLowerCase().includes('sip') ? 'sip' : 'buy');
                    if (type === 'buy' || type === 'sip') totalUnits += Number(tx.units || 0);
                    if (type === 'sell' || type === 'withdraw') totalUnits -= Number(tx.units || 0);
                });
                return totalUnits * (item.currentNav || 0);

            case 'fixed_deposit':
                return (item.deposits || []).reduce((sum, dep) => sum + (Number(dep.currentValue) || 0), 0);

            case 'ppf':
                return (item.details || []).slice(-1)[0]?.balance || 0;

            case 'nps':
                // NPS current value is the sum of holdings
                return (item.holdings || []).reduce((sum, h) => sum + (Number(h.totalunits || 0) * Number(h.nav || 0)), 0);

            case 'sgb':
                return (item.holdings || []).reduce((sum, h) => sum + (Number(h.units || 0) * Number(h.currentPrice || 0)), 0);

            case 'policy':
            case 'Policy':
                const paid = (item.premiums || []).filter(p => p.status === 'Paid').reduce((sum, p) => sum + Number(p.amount || 0), 0);
                const received = (item.premiums || []).filter(p => p.status === 'Received Back' || p.status === 'Received').reduce((sum, p) => sum + Number(p.amount || 0), 0);
                return paid - received;

            case 'savings_account':
                return (item.transactions || []).reduce((sum, t) => {
                    const val = Number(t.amount) || 0;
                    const type = (t.type || '').toLowerCase();
                    if (type === 'deposit' || type === 'monnies_redeemed') return sum + val;
                    if (type === 'withdraw') return sum - val;
                    return sum;
                }, 0);

            default:
                return Number(item.amount || 0);
        }
    };

    const calculateItemInvestedValue = (item) => {
        if (!item) return 0;

        switch (item.type) {
            case 'stock_market':
                return (item.stocks || []).reduce((sum, s) => sum + (Number(s.shares || 0) * Number(s.avgCost || 0)), 0);

            case 'mutual_fund':
                let runningUnits = 0;
                let runningCost = 0;
                (item.transactions || []).forEach(tx => {
                    const isSell = tx.type === 'sell' || tx.type === 'withdraw';
                    const txAmount = Number(tx.amount || 0);
                    const txUnits = Number(tx.units || 0);
                    if (isSell) {
                        const avgCostAtSale = runningUnits > 0 ? runningCost / runningUnits : 0;
                        const costOfSoldUnits = avgCostAtSale * txUnits;
                        runningUnits -= txUnits;
                        runningCost -= costOfSoldUnits;
                    } else {
                        runningUnits += txUnits;
                        runningCost += txAmount;
                    }
                });
                return runningCost;

            case 'fixed_deposit':
                return (item.deposits || []).reduce((sum, dep) => sum + (Number(dep.originalAmount) || 0), 0);

            case 'ppf':
                return (item.details || []).reduce((sum, d) => sum + Number(d.deposit || 0), 0);

            case 'nps':
                return (item.transactions || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);

            case 'sgb':
                return (item.holdings || []).reduce((sum, h) => sum + (Number(h.units || 0) * Number(h.issuePrice || 0)), 0);

            default:
                return Number(item.investedAmount || item.amount || 0);
        }
    };

    const updateItem = async (type, item) => {
        if (type === 'expense') {
            const newExpenses = { ...expenses };
            const dateObj = new Date(item.date);
            // Scapia billing cycle adjustment: 25th onwards counts as next month
            if (item.paymentMode === 'credit_card' && item.creditCardName && item.creditCardName.includes('Scapia') && dateObj.getDate() > 24) {
                dateObj.setMonth(dateObj.getMonth() + 1, 1);
            } else {
                // Month-End Cutoff Rule: Last Working Day onwards counts as next month
                const curYear = dateObj.getFullYear();
                const curMonth = dateObj.getMonth();
                const lastWorkingDay = getLastWorkingDayOfMonth(curYear, curMonth);
                if (dateObj.getDate() >= lastWorkingDay) {
                    dateObj.setMonth(dateObj.getMonth() + 1, 1);
                }
            }
            const newYear = dateObj.getFullYear().toString();
            const newMonth = dateObj.toLocaleString('default', { month: 'long' });
            const newCategory = item.category;
            const newAmount = Number(item.amount) || 0;

            if (typeof item.id === 'string' && !item.id.includes('-')) {
                let foundLocation = null;
                // Find where the transaction is currently stored
                Object.entries(newExpenses).forEach(([y, months]) => {
                    Object.entries(months).forEach(([m, monthData]) => {
                        if (foundLocation || !monthData.transactions) return;
                        const txIndex = monthData.transactions.findIndex(t => t.id === item.id);
                        if (txIndex !== -1) {
                            foundLocation = { year: y, month: m, index: txIndex, data: monthData };
                        }
                    });
                });

                if (foundLocation) {
                    const { year: oldYear, month: oldMonth, index: txIndex, data: oldMonthData } = foundLocation;
                    const oldTx = oldMonthData.transactions[txIndex];
                    const oldTarget = oldMonthData.categories || oldMonthData;

                    // Subtract old amount from old category totals
                    const oldKey = Object.keys(oldTarget).find(k => k.toLowerCase() === oldTx.category?.toLowerCase());
                    if (oldKey && oldTx.deductFromSalary !== false) {
                        const isIncome = ['salary received', 'income'].includes(oldKey.toLowerCase());
                        const oldEffective = isIncome
                            ? (oldTx.isCredited ? oldTx.amount : -oldTx.amount)
                            : (oldTx.isCredited ? -oldTx.amount : oldTx.amount);

                        oldTarget[oldKey] = Math.max(0, (oldTarget[oldKey] || 0) - oldEffective);
                    }

                    // Check if we need to move the transaction to a different month/year
                    if (oldYear !== newYear || oldMonth !== newMonth) {
                        // Remove from old location
                        oldMonthData.transactions.splice(txIndex, 1);

                        // Ensure new location exists
                        if (!newExpenses[newYear]) newExpenses[newYear] = {};
                        if (!newExpenses[newYear][newMonth]) newExpenses[newYear][newMonth] = { categories: {}, transactions: [] };

                        const newMonthData = newExpenses[newYear][newMonth];
                        const newTarget = newMonthData.categories || newMonthData;

                        // Add to new category totals
                        const newKey = Object.keys(newTarget).find(k => k.toLowerCase() === newCategory.toLowerCase()) || newCategory;
                        const isIncome = ['salary received', 'income'].includes(newKey.toLowerCase());
                        const newEffective = isIncome
                            ? (item.isCredited ? newAmount : -newAmount)
                            : (item.isCredited ? -newAmount : newAmount);

                        if (item.deductFromSalary !== false) {
                            newTarget[newKey] = Math.max(0, (newTarget[newKey] || 0) + newEffective);
                        }

                        // Add to new transactions list
                        if (!newMonthData.transactions) newMonthData.transactions = [];
                        newMonthData.transactions.push({ ...oldTx, ...item, amount: newAmount, category: newCategory, deductFromSalary: item.deductFromSalary });

                    } else {
                        // Same month/year: Update in place
                        const newKey = Object.keys(oldTarget).find(k => k.toLowerCase() === newCategory.toLowerCase()) || newCategory;
                        const isIncome = ['salary received', 'income'].includes(newKey.toLowerCase());
                        const newEffective = isIncome
                            ? (item.isCredited ? newAmount : -newAmount)
                            : (item.isCredited ? -newAmount : newAmount);

                        if (item.deductFromSalary !== false) {
                            oldTarget[newKey] = Math.max(0, (oldTarget[newKey] || 0) + newEffective);
                        }

                        oldMonthData.transactions[txIndex] = { ...oldTx, ...item, amount: newAmount, category: newCategory, deductFromSalary: item.deductFromSalary };
                    }

                    await saveExpenses(newExpenses);
                }
                return;
            }

            const parts = typeof item.id === 'string' ? item.id.split('-') : [];
            if (parts.length >= 3) {
                const [oldYear, oldMonth] = parts.slice(0, 2);
                const oldCategory = parts.slice(2, parts.length - 1).join('-');
                if (newExpenses[oldYear] && newExpenses[oldYear][oldMonth]) {
                    const oldData = newExpenses[oldYear][oldMonth];
                    const oldTarget = oldData.categories || oldData;
                    const targetKey = Object.keys(oldTarget).find(k => k.toLowerCase() === oldCategory.toLowerCase());
                    if (targetKey && (oldYear !== newYear || oldMonth !== newMonth || oldCategory !== newCategory)) {
                        delete oldTarget[targetKey];
                    }
                }
                if (!newExpenses[newYear]) newExpenses[newYear] = {};
                if (!newExpenses[newYear][newMonth]) newExpenses[newYear][newMonth] = { categories: {}, transactions: [] };
                const newTarget = newExpenses[newYear][newMonth].categories || newExpenses[newYear][newMonth];
                const targetKey = Object.keys(newTarget).find(k => k.toLowerCase() === newCategory.toLowerCase()) || newCategory;
                newTarget[targetKey] = newAmount;
                await saveExpenses(newExpenses);
            }
            return;
        }

        let endpoint = type === 'savings' ? 'savings' : type === 'asset' ? 'assets' : type === 'lents' ? 'lents' : type === 'creditCards' ? 'creditCards' : '';
        if (!endpoint || !item.id) return;
        try {
            const res = await fetch(`${API_URL}/${endpoint}/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            const updatedItem = await res.json();
            if (type === 'savings') setSavings(prev => prev.map(i => i.id == item.id ? updatedItem : i));
            if (type === 'asset') setAssets(prev => prev.map(i => i.id == item.id ? updatedItem : i));
            if (type === 'lents') setLents(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            if (type === 'creditCards') setCreditCards(prev => prev.map(i => i.id == item.id ? updatedItem : i));
        } catch (error) {
            console.error("Error updating item:", error);
        }
    };

    const addNewYear = async (year) => {
        if (expenses[year]) {
            throw new Error(`Year ${year} already exists.`);
        }

        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        const newYearData = {};
        months.forEach(month => {
            const monthCats = {};
            categories.forEach(cat => {
                monthCats[cat] = 0;
            });
            newYearData[month] = {
                categories: monthCats,
                transactions: []
            };
        });

        const updatedExpenses = { ...expenses, [year]: newYearData };
        setExpenses(updatedExpenses);

        try {
            await fetch(`${API_URL}/expenses`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedExpenses)
            });
        } catch (error) {
            console.error("Failed to add new year:", error);
            // Revert local state on failure? 
            // For now just logging.
        }
    };

    const takeSnapshot = async (date) => {
        const breakdown = {
            savings: savings.filter(s => s.type !== 'ppf' && s.type !== 'nps' && s.type !== 'fixed_deposit').reduce((sum, s) => sum + calculateItemCurrentValue(s), 0),
            ppf: savings.filter(s => s.type === 'ppf').reduce((sum, s) => sum + calculateItemCurrentValue(s), 0),
            fixed_deposit: savings.filter(s => s.type === 'fixed_deposit').reduce((sum, s) => sum + calculateItemCurrentValue(s), 0),
            metals: processedMetals.gold.reduce((sum, m) => sum + m.currentValue, 0) + processedMetals.silver.reduce((sum, m) => sum + m.currentValue, 0),
            assets: assets.reduce((sum, cat) => sum + (cat.items?.reduce((s, i) => s + (i.currentValue || 0), 0) || 0), 0),
            nps: savings.filter(s => s.type === 'nps').reduce((sum, s) => sum + calculateItemCurrentValue(s), 0)
        };

        const totalValue = Object.values(breakdown).reduce((a, b) => a + b, 0);

        const newSnapshot = {
            id: Date.now().toString(),
            date,
            totalValue,
            breakdown
        };

        const updatedSnapshots = [...snapshots, newSnapshot].sort((a, b) => new Date(a.date) - new Date(b.date));
        setSnapshots(updatedSnapshots);

        try {
            await fetch(`${API_URL}/snapshots`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSnapshot)
            });
        } catch (error) {
            console.error("Failed to save snapshot:", error);
        }
    };

    const refreshStockPrices = async (marketId) => {
        if (isGuest) return { success: false, message: 'Guest mode: Cannot refresh prices' };

        const market = savings.find(s => s.id.toString() === marketId);
        if (!market || !market.stocks) return { success: false, message: 'Market data not found' };

        try {
            const updatedStocks = await Promise.all(market.stocks.map(async (stock) => {
                const ticker = stock.ticker.includes('.') ? stock.ticker : `${stock.ticker}.NS`;
                try {
                    // Using api.allorigins.win to bypass CORS for Yahoo Finance
                    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query2.finance.yahoo.com/v8/finance/chart/${ticker}`)}`;
                    const response = await fetch(proxyUrl);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();

                    const result = data.chart?.result?.[0];
                    if (result && result.meta?.regularMarketPrice) {
                        return { ...stock, currentPrice: result.meta.regularMarketPrice };
                    }
                    return stock;
                } catch (err) {
                    console.warn(`Failed to fetch price for ${ticker}:`, err);
                    return stock; // Fallback to existing price
                }
            }));

            const updatedMarket = { ...market, stocks: updatedStocks };
            await updateItem('savings', updatedMarket);
            return { success: true };
        } catch (error) {
            console.error("Error refreshing stock prices:", error);
            return { success: false, message: 'Refresh failed' };
        }
    };

    const refreshMutualFundNAV = async (fundId) => {
        if (isGuest) return { success: false, message: 'Guest mode: Cannot refresh NAV' };

        const fund = savings.find(s => s.id.toString() === fundId);
        if (!fund || !fund.schemeCode) return { success: false, message: 'Scheme Code not found. Please edit fund and add it.' };

        try {
            // Using api.allorigins.win as a fallback/proxy for consistency, although mfapi.in has CORS
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.mfapi.in/mf/${fund.schemeCode}`)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (data.data && data.data[0]) {
                const latestNav = Math.round(parseFloat(data.data[0].nav) * 10000) / 10000;
                const updatedFund = { ...fund, currentNav: latestNav };

                // Use centralized calculation to update amount
                updatedFund.amount = calculateItemCurrentValue(updatedFund);

                await updateItem('savings', updatedFund);
                return { success: true, nav: latestNav };
            }
            return { success: false, message: 'Invalid data from API' };
        } catch (error) {
            console.error("Error refreshing mutual fund NAV:", error);
            return { success: false, message: 'Refresh failed' };
        }
    };

    const value = {
        expenses, savings, metals: processedMetals, assets, creditCards, lents, salaryStats, categories, snapshots, categoryBudgets,
        addItem, addMetal, deleteItem, deleteMetal, updateItem, updateMetal,
        addNewYear, takeSnapshot, updateCategoryBudget,
        formatCurrency,
        calculateItemCurrentValue,
        calculateItemInvestedValue,
        refreshStockPrices,
        refreshMutualFundNAV,
        metalRates,
        fetchMetalRates,
        manualMetalRates,
        updateManualRates
    };

    return (
        <FinanceContext.Provider value={value}>
            {children}
        </FinanceContext.Provider>
    );
}

export function useFinance() {
    const context = useContext(FinanceContext);
    if (context === undefined) {
        throw new Error('useFinance must be used within a FinanceProvider');
    }
    return context;
}
