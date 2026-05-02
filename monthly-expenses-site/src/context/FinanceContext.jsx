import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { getLastWorkingDayOfMonth } from '../utils/dateUtils';

const FinanceContext = createContext();

export function FinanceProvider({ children }) {
    const { credentials, isAuthenticated } = useAuth();
    
    const [expenses, setExpenses] = useState({});
    const [categories, setCategories] = useState(["salary received", "house rent", "groceries", "others"]);
    const [categoryBudgets, setCategoryBudgets] = useState({});
    const [salaryStats, setSalaryStats] = useState({});
    const [fileSha, setFileSha] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const calculateSalaryStats = (expensesData) => {
        const stats = {};
        if (!expensesData || typeof expensesData !== 'object') return stats;
        Object.entries(expensesData).forEach(([year, months]) => {
            if (!stats[year]) stats[year] = { total: 0, months: {} };
            Object.entries(months).forEach(([month, data]) => {
                if (!data) return;
                const cats = data.categories || data;
                const salary = cats['salary received'] || 0;
                if (salary > 0) {
                    stats[year].total += salary;
                    stats[year].months[month] = salary;
                }
            });
        });
        return stats;
    };

    useEffect(() => {
        setSalaryStats(calculateSalaryStats(expenses));
    }, [expenses]);

    const fetchConfig = useCallback(() => {
        if (!credentials) return null;
        return {
            headers: {
                Authorization: `token ${credentials.token}`,
                Accept: 'application/vnd.github.v3+json'
            }
        };
    }, [credentials]);

    const apiUrl = credentials 
        ? `https://api.github.com/repos/${credentials.owner}/${credentials.repo}/contents/data.json`
        : null;

    useEffect(() => {
        if (!isAuthenticated || !apiUrl) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await axios.get(apiUrl, fetchConfig());
                const data = response.data;
                setFileSha(data.sha);
                
                // Decode base64 content
                const contentStr = decodeURIComponent(escape(atob(data.content)));
                const parsedData = JSON.parse(contentStr);
                
                setExpenses(parsedData.expenses || {});
                if (parsedData.categories) setCategories(parsedData.categories);
                if (parsedData.categoryBudgets) setCategoryBudgets(parsedData.categoryBudgets);
            } catch (error) {
                console.error("Failed to fetch data from GitHub. If the repo is empty, it will be initialized upon first save.", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [isAuthenticated, apiUrl, fetchConfig]);

    const saveToGitHub = async (updatedData) => {
        if (!isAuthenticated || !apiUrl) return;
        setIsLoading(true);
        try {
            // Re-fetch sha to minimize conflicts
            let currentSha = fileSha;
            try {
                const metaRes = await axios.get(apiUrl, fetchConfig());
                currentSha = metaRes.data.sha;
            } catch(e) {
                // File might not exist yet, which is fine
            }

            const contentString = JSON.stringify(updatedData, null, 2);
            // safe btoa for unicode
            const base64Content = btoa(unescape(encodeURIComponent(contentString)));

            const payload = {
                message: `Update expenses data ${new Date().toISOString()}`,
                content: base64Content,
                ...(currentSha && { sha: currentSha })
            };

            const response = await axios.put(apiUrl, payload, fetchConfig());
            setFileSha(response.data.content.sha);
        } catch (error) {
            console.error("Failed to save to GitHub:", error);
            alert("Error saving data to GitHub. Check your token permissions and repository.");
        } finally {
            setIsLoading(false);
        }
    };

    const updateFullData = (newExpenses = expenses, newCategories = categories, newBudgets = categoryBudgets) => {
        setExpenses(newExpenses);
        setCategories(newCategories);
        setCategoryBudgets(newBudgets);
        saveToGitHub({ expenses: newExpenses, categories: newCategories, categoryBudgets: newBudgets });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(amount);
    };

    const addNewYear = async (yearStr) => {
        const newExpenses = { ...expenses };
        if (newExpenses[yearStr]) throw new Error('Year already exists!');
        
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        newExpenses[yearStr] = {};
        months.forEach(month => {
            const initialCategories = {};
            categories.forEach(cat => {
                if(cat !== 'salary received' && cat !== 'income') {
                    initialCategories[cat] = 0;
                }
            });
            initialCategories['salary received'] = 0;
            newExpenses[yearStr][month] = { categories: initialCategories, transactions: [] };
        });

        updateFullData(newExpenses, categories, categoryBudgets);
    };

    const addItem = async (type, item) => {
        if (type !== 'expense') return;

        const dateObj = new Date(item.date);
        if (item.paymentMode === 'credit_card' && item.creditCardName && item.creditCardName.includes('Scapia') && dateObj.getDate() > 24) {
            dateObj.setMonth(dateObj.getMonth() + 1, 1);
        } else {
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

        let newCategories = [...categories];
        if (category && !categories.some(c => c.toLowerCase() === category)) {
            newCategories.push(category);
        }

        const isIncomeCategory = ['salary received', 'income'].includes(category);

        const newExpenses = { ...(expenses || {}) };
        if (!newExpenses[year]) newExpenses[year] = {};
        if (!newExpenses[year][month]) newExpenses[year][month] = { categories: {}, transactions: [] };

        const monthData = newExpenses[year][month];
        const target = monthData.categories || monthData;

        const targetKey = Object.keys(target).find(k => k.toLowerCase() === category.toLowerCase());
        const finalKey = targetKey || category;

        let effectiveAmount = isIncomeCategory ? (item.isCredited ? amount : -amount) : (item.isCredited ? -amount : amount);

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
            isCredited: !!item.isCredited,
            transactionType: item.transactionType,
            deductFromSalary: item.deductFromSalary !== false
        });

        updateFullData(newExpenses, newCategories, categoryBudgets);
    };

    const updateItem = async (type, item) => {
         if (type !== 'expense') return;
         
         const newExpenses = { ...expenses };
         const dateObj = new Date(item.date);
         
         if (item.paymentMode === 'credit_card' && item.creditCardName && item.creditCardName.includes('Scapia') && dateObj.getDate() > 24) {
             dateObj.setMonth(dateObj.getMonth() + 1, 1);
         } else {
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

         let foundLocation = null;
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

             const oldKey = Object.keys(oldTarget).find(k => k.toLowerCase() === oldTx.category?.toLowerCase());
             if (oldKey && oldTx.deductFromSalary !== false) {
                 const isIncome = ['salary received', 'income'].includes(oldKey.toLowerCase());
                 const oldEffective = isIncome
                     ? (oldTx.isCredited ? oldTx.amount : -oldTx.amount)
                     : (oldTx.isCredited ? -oldTx.amount : oldTx.amount);

                 oldTarget[oldKey] = Math.max(0, (oldTarget[oldKey] || 0) - oldEffective);
             }

             if (oldYear !== newYear || oldMonth !== newMonth) {
                 oldMonthData.transactions.splice(txIndex, 1);
                 if (!newExpenses[newYear]) newExpenses[newYear] = {};
                 if (!newExpenses[newYear][newMonth]) newExpenses[newYear][newMonth] = { categories: {}, transactions: [] };
                 const newMonthData = newExpenses[newYear][newMonth];
                 const newTarget = newMonthData.categories || newMonthData;
                 const newKey = Object.keys(newTarget).find(k => k.toLowerCase() === newCategory.toLowerCase()) || newCategory;
                 
                 const isIncome = ['salary received', 'income'].includes(newKey.toLowerCase());
                 const newEffective = isIncome ? (item.isCredited ? newAmount : -newAmount) : (item.isCredited ? -newAmount : newAmount);

                 if (item.deductFromSalary !== false) {
                     newTarget[newKey] = Math.max(0, (newTarget[newKey] || 0) + newEffective);
                 }

                 if (!newMonthData.transactions) newMonthData.transactions = [];
                 newMonthData.transactions.push({ ...oldTx, ...item, amount: newAmount, category: newCategory });
             } else {
                 const newKey = Object.keys(oldTarget).find(k => k.toLowerCase() === newCategory.toLowerCase()) || newCategory;
                 const isIncome = ['salary received', 'income'].includes(newKey.toLowerCase());
                 const newEffective = isIncome ? (item.isCredited ? newAmount : -newAmount) : (item.isCredited ? -newAmount : newAmount);

                 if (item.deductFromSalary !== false) {
                     oldTarget[newKey] = Math.max(0, (oldTarget[newKey] || 0) + newEffective);
                 }
                 oldMonthData.transactions[txIndex] = { ...oldTx, ...item, amount: newAmount, category: newCategory };
             }
             updateFullData(newExpenses, categories, categoryBudgets);
         }
    };

    const deleteItem = async (type, id) => {
        if (type !== 'expense') return;
        const newExpenses = { ...expenses };

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
            if (found) updateFullData(newExpenses, categories, categoryBudgets);
        } else {
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
                    updateFullData(newExpenses, categories, categoryBudgets);
                }
            }
        }
    };

    return (
        <FinanceContext.Provider value={{ 
            expenses, 
            categories, 
            categoryBudgets, 
            salaryStats, 
            formatCurrency, 
            addItem, 
            updateItem, 
            deleteItem, 
            addNewYear,
            isLoading 
        }}>
            {children}
        </FinanceContext.Provider>
    );
}

export const useFinance = () => useContext(FinanceContext);
