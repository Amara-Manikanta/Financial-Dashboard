import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { getLastWorkingDayOfMonth } from '../utils/dateUtils';
import { CATEGORY_MAP } from '../utils/categories';


const FinanceContext = createContext();


const API_URL = 'http://127.0.0.1:3000';

export const DEFAULT_GROCERY_CATEGORIES = {
    'Milk Products': ['Milk', 'Paneer', 'Curd', 'Cheese', 'Butter', 'Ghee'],
    'Vegetables': ['Onion', 'Potato', 'Tomato', 'Carrot', 'Beans', 'Cabbage', 'Cauliflower', 'Capsicum', 'Green Chilli', 'Garlic', 'Ginger', 'Coriander', 'Lemon'],
    'Fruits': ['Apple', 'Banana', 'Mango', 'Grapes', 'Orange', 'Papaya', 'Watermelon'],
    'Dals/Pulses': ['Toor Dal', 'Moong Dal', 'Urad Dal', 'Chana Dal', 'Masoor Dal', 'Rajma', 'Kabuli Chana'],
    'Rice/Atta': ['Sona Masoori Rice', 'Basmati Rice', 'Brown Rice', 'Wheat Atta', 'Maida', 'Besan', 'Suji/Rava'],
    'Oils/Ghee': ['Sunflower Oil', 'Groundnut Oil', 'Mustard Oil', 'Olive Oil', 'Sesame Oil'],
    'Snacks': ['Biscuits', 'Chips', 'Namkeen', 'Chocolates', 'Cookies'],
    'Cleaning Supplies': ['Detergent Powder', 'Dishwash Liquid', 'Floor Cleaner', 'Toilet Cleaner', 'Glass Cleaner', 'Scrub Pad'],
    'Personal Care': ['Soap', 'Shampoo', 'Toothpaste', 'Toothbrush', 'Body Wash', 'Face Wash', 'Deodorant', 'Hair Oil'],
    'Eggs': ['Eggs'],
    'Others': ['Sugar', 'Salt', 'Tea Powder', 'Coffee Powder', 'Jaggery']
};

const MONTHLY_EARNINGS_KEYS = ['basicSalary', 'hra', 'conveyanceAllowance', 'flexibleAllowance', 'performanceBonus', 'foodWallet',
    'holidayAllowance', 'compensatoryAllowance', 'engagementPb', 'annualFlexiBasket', 'internetAllowance', 'cfPfMonthly'];
const MONTHLY_DEDUCTIONS_KEYS = ['epf', 'profTax', 'incomeTax', 'otherRecoveries', 'medicalPremRecoverable', 'cfPfMonthly'];

const calculateSalaryStats = (expensesData, salaryDetailsData = []) => {
    const stats = {};
    if (!expensesData || typeof expensesData !== 'object') return stats;

    // First pass: pull from expense transactions (salary received category)
    Object.entries(expensesData).forEach(([year, months]) => {
        if (!stats[year]) stats[year] = { total: 0, months: {} };
        Object.entries(months).forEach(([month, data]) => {
            if (!data) return;
            const categories = data.categories || data;
            const salary = categories['salary received'] || categories['salary'] || 0;
            if (salary > 0) {
                stats[year].total += salary;
                stats[year].months[month] = salary;
            }
        });
    });

    // Second pass: fill in from salaryDetails for any months not covered above
    if (Array.isArray(salaryDetailsData)) {
        salaryDetailsData.forEach(record => {
            if (!record.year || !record.month || record.month === 'Annual') return;
            const yr = record.year;
            const mo = record.month;

            // If already populated from a transaction, don't override
            if (stats[yr]?.months[mo] > 0) return;

            // Compute net salary: sum earnings minus deductions
            let gross = 0;
            MONTHLY_EARNINGS_KEYS.forEach(k => {
                if (k !== 'cfPfMonthly') gross += Number(record[k]) || 0;
            });
            // Also add any custom fields that are positive numbers
            Object.entries(record).forEach(([k, v]) => {
                if (!['id', 'year', 'month', 'type', ...MONTHLY_EARNINGS_KEYS, ...MONTHLY_DEDUCTIONS_KEYS].includes(k)) {
                    const num = Number(v);
                    if (!isNaN(num) && num > 0) gross += num;
                }
            });

            let deductions = 0;
            MONTHLY_DEDUCTIONS_KEYS.forEach(k => {
                if (k !== 'cfPfMonthly') deductions += Math.abs(Number(record[k]) || 0);
            });

            const net = gross - deductions;
            if (net > 0) {
                if (!stats[yr]) stats[yr] = { total: 0, months: {} };
                stats[yr].months[mo] = net;
                stats[yr].total += net;
            }
        });
    }

    return stats;
};

export function FinanceProvider({ children }) {
    const [expenses, setExpenses] = useState({});
    const [savings, setSavings] = useState([]);
    const [metals, setMetals] = useState({ gold: [], silver: [], antique_coins: [], currencies: [] });
    const [assets, setAssets] = useState([]);
    const [lents, setLents] = useState([]);
    const [categories, setCategories] = useState([]);
    const [creditCards, setCreditCards] = useState([]);
    const [taxes, setTaxes] = useState([]);
    const [salaryDetails, setSalaryDetails] = useState([]);
    const [salaryStats, setSalaryStats] = useState({});
    const [snapshots, setSnapshots] = useState([]);
    const [categoryBudgets, setCategoryBudgets] = useState({});
    const [customCategoryMap, setCustomCategoryMap] = useState({});
    const [customGroceryItems, setCustomGroceryItems] = useState({});
    const [groceryBrands, setGroceryBrands] = useState({});
    const [groceryFlavours, setGroceryFlavours] = useState({});
    const [groceryItemBrandMap, setGroceryItemBrandMap] = useState({});
    const [groceryItemFlavourMap, setGroceryItemFlavourMap] = useState({});
    const [metalRates, setMetalRates] = useState({ gold: 0, silver: 0 });
    const [manualMetalRates, setManualMetalRates] = useState({ gold: 0, silver: 0 });
    const [customSalaryFields, setCustomSalaryFields] = useState({ annual: [], monthlyEarnings: [], monthlyDeductions: [] });
    const [hiddenSalaryFields, setHiddenSalaryFields] = useState([]);
    const [employments, setEmployments] = useState([]);
    const [categoryRules, setCategoryRules] = useState({});
    const [groceryCategories, setGroceryCategories] = useState(DEFAULT_GROCERY_CATEGORIES);
    const [isLoading, setIsLoading] = useState(true);
    const [dataError, setDataError] = useState(null);

    const { user, isGuest } = useAuth();

    useEffect(() => {
        setSalaryStats(calculateSalaryStats(expenses, salaryDetails));
    }, [expenses, salaryDetails]);

    // Defined before the useEffect that calls it to avoid temporal dead zone
    const fetchMetalRates = async () => {
        try {
            const res = await fetch('/api/goldprice/dbXRates/INR');
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            if (data.items && data.items.length > 0) {
                const item = data.items[0];
                const goldPerGram = item.xauPrice / 31.1034768;
                const silverPerGram = item.xagPrice / 31.1034768;
                setMetalRates({ gold: goldPerGram, silver: silverPerGram });
            }
        } catch (error) {
            console.error("Failed to fetch metal rates:", error);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            if (isGuest) {
                // Guest mode placeholder data
                const guestExpenses = {};
                const guestSavings = [];
                const guestAssets = [];
                const guestLents = [];
                const guestCreditCards = [];

                setExpenses(guestExpenses);
                setSavings(guestSavings);
                setMetals({ gold: [], silver: [], antique_coins: [], currencies: [] });
                setAssets(guestAssets);
                setLents(guestLents);
                setCreditCards(guestCreditCards);
                setTaxes([]);
                setCategoryBudgets({});
                setCategories(["salary received", "house rent", "groceries", "others"]);
                setSalaryStats({});
                setSalaryDetails([]);
                setSnapshots([]);
                setCustomSalaryFields({ annual: [], monthlyEarnings: [], monthlyDeductions: [] });
                setHiddenSalaryFields([]);
                setCustomCategoryMap({});
                setCustomGroceryItems({});
                setGroceryBrands({});
                setGroceryFlavours({});
                setGroceryItemBrandMap({});
                setGroceryItemFlavourMap({});
                return;
            }
            try {
                const [expRes, savRes, metRes, assRes, appRes, snapRes, lentRes, ccRes, taxRes, salRes] = await Promise.all([
                    fetch(`${API_URL}/expenses`),
                    fetch(`${API_URL}/savings`),
                    fetch(`${API_URL}/metals`),
                    fetch(`${API_URL}/assets`),
                    fetch(`${API_URL}/appData`),
                    fetch(`${API_URL}/snapshots`),
                    fetch(`${API_URL}/lents`),
                    fetch(`${API_URL}/creditCards`),
                    fetch(`${API_URL}/taxes`).then(res => res.ok ? res : { json: () => [] }).catch(() => ({ json: () => [] })),
                    fetch(`${API_URL}/salaryDetails`).then(res => res.ok ? res : { json: () => [] }).catch(() => ({ json: () => [] })) // Fallback if endpoint doesn't exist yet
                ]);

                const expData = await expRes.json();
                const savData = await savRes.json();
                const metData = await metRes.json();
                const assData = await assRes.json();
                const appData = await appRes.json();
                const snapData = await snapRes.json();
                const lentData = await lentRes.json();
                const ccData = await ccRes.json();
                const taxesData = await taxRes.json();
                const salaryDetailsData = await salRes.json();

                const modifiedExpenses = JSON.parse(JSON.stringify(expData)); // deep-clone to avoid mutating fetched object
                let isModified = false;
                const wallets = (ccData || []).filter(c => c.type === 'wallet' && c.autoCredit);
                
                wallets.forEach(wallet => {
                    const { amount, dayOfMonth, startYear, startMonth } = wallet.autoCredit;
                    const currentDate = new Date();
                    
                    let date = new Date(startYear, startMonth - 1, 1);
                    while (date <= currentDate) {
                        const y = date.getFullYear().toString();
                        const m = date.toLocaleString('default', { month: 'long' });
                        
                        const transactions = modifiedExpenses[y]?.[m]?.transactions || [];
                        const hasCredit = transactions.some(t => 
                            t.paymentMode === 'credit_card' && 
                            t.creditCardName === wallet.name && 
                            t.isCredited === true && 
                            (t.category || '').toLowerCase().includes('wallet')
                        );
                        
                        if (!hasCredit) {
                            const txDate = new Date(date.getFullYear(), date.getMonth(), dayOfMonth);
                            // Set txDate to current local time if we want to bypass exact timezone boundary issues, but Date() works fine.
                            if (txDate <= currentDate) {
                                if (!modifiedExpenses[y]) modifiedExpenses[y] = {};
                                if (!modifiedExpenses[y][m]) modifiedExpenses[y][m] = { categories: {}, transactions: [] };
                                
                                modifiedExpenses[y][m].transactions.push({
                                    id: `auto-${wallet.id}-${y}-${m}`,
                                    title: "Wallet Auto-Load",
                                    amount: amount,
                                    category: "food wallet",
                                    date: txDate.toISOString().split('T')[0],
                                    paymentMode: "credit_card",
                                    creditCardName: wallet.name,
                                    mainCategory: "Income",
                                    isCredited: true,
                                    transactionType: "credit",
                                    deductFromSalary: false,
                                    type: "monthly"
                                });
                                isModified = true;
                            }
                        }
                        date.setMonth(date.getMonth() + 1);
                    }
                });

                if (isModified) {
                    await fetch(`${API_URL}/expenses`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(modifiedExpenses)
                    });
                }
                
                setExpenses(modifiedExpenses);
                setSavings(savData);
                setMetals(metData);
                setAssets(assData);
                setLents(lentData || []);
                setCreditCards(ccData || []);
                setTaxes(taxesData || []);
                setCategoryBudgets(appData.categoryBudgets || {});
                setCategories(appData.categories || []);
                setCategoryRules(appData.categoryRules || {});
                setManualMetalRates(appData.manualMetalRates || { gold: 0, silver: 0 });
                setCustomSalaryFields(appData.customSalaryFields || { annual: [], monthlyEarnings: [], monthlyDeductions: [] });
                setHiddenSalaryFields(appData.hiddenSalaryFields || []);
                setEmployments(appData.employments || JSON.parse(localStorage.getItem('employments') || '[]'));
                setCustomCategoryMap(appData.customCategoryMap || {});
                setCustomGroceryItems(appData.customGroceryItems || {});
                // Handle old flat array if present
                const loadedBrands = appData.groceryBrands || {};
                setGroceryBrands(Array.isArray(loadedBrands) ? {} : loadedBrands);
                
                const loadedFlavours = appData.groceryFlavours || {};
                setGroceryFlavours(Array.isArray(loadedFlavours) ? {} : loadedFlavours);
                
                setGroceryItemBrandMap(appData.groceryItemBrandMap || {});
                setGroceryItemFlavourMap(appData.groceryItemFlavourMap || {});
                
                // Load custom grocery categories or use default
                setGroceryCategories(appData.groceryCategories && Object.keys(appData.groceryCategories).length > 0 ? appData.groceryCategories : DEFAULT_GROCERY_CATEGORIES);
                
                setSnapshots(snapData || []);
                setSalaryDetails(salaryDetailsData || []);

            } catch (error) {
                console.error("Failed to fetch data:", error);
                setDataError(error.message || 'Failed to load data');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
        fetchMetalRates();
    }, [user, isGuest]);


    const updateManualRates = async (rates) => {
        setManualMetalRates(rates);
        if (isGuest) return;
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

    const updateCategoryRules = async (newRules) => {
        setCategoryRules(newRules);
        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, categoryRules: newRules })
            });
        } catch (error) {
            console.error("Failed to save category rules:", error);
        }
    };

    const saveGroceryCategories = async (newCategories) => {
        setGroceryCategories(newCategories);
        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, groceryCategories: newCategories })
            });
        } catch (error) {
            console.error("Failed to save grocery categories:", error);
        }
    };

    const mergeGroceryItem = async (category, oldItemName, newItemName) => {
        if (!category || !oldItemName || !newItemName || oldItemName === newItemName) return;

        // 1. Update Master Categories
        const newCategories = { ...groceryCategories };
        if (newCategories[category]) {
            newCategories[category] = newCategories[category].filter(i => i !== oldItemName);
            if (!newCategories[category].includes(newItemName)) {
                newCategories[category].push(newItemName);
            }
            newCategories[category].sort();
        }

        // 2. Update Brand/Flavour Maps
        const newBrandMap = { ...groceryItemBrandMap };
        if (newBrandMap[category] && newBrandMap[category][oldItemName]) {
            const oldBrands = newBrandMap[category][oldItemName];
            if (!newBrandMap[category][newItemName]) newBrandMap[category][newItemName] = [];
            newBrandMap[category][newItemName] = Array.from(new Set([...newBrandMap[category][newItemName], ...oldBrands])).sort();
            delete newBrandMap[category][oldItemName];
        }

        const newFlavourMap = { ...groceryItemFlavourMap };
        if (newFlavourMap[category] && newFlavourMap[category][oldItemName]) {
            const oldFlavours = newFlavourMap[category][oldItemName];
            if (!newFlavourMap[category][newItemName]) newFlavourMap[category][newItemName] = [];
            newFlavourMap[category][newItemName] = Array.from(new Set([...newFlavourMap[category][newItemName], ...oldFlavours])).sort();
            delete newFlavourMap[category][oldItemName];
        }

        // 3. Update Expenses
        const newExpenses = { ...expenses };
        let expensesChanged = false;
        Object.keys(newExpenses).forEach(year => {
            Object.keys(newExpenses[year]).forEach(month => {
                if (newExpenses[year][month] && newExpenses[year][month].transactions) {
                    newExpenses[year][month].transactions = newExpenses[year][month].transactions.map(tx => {
                        if (tx.groceryItems) {
                            let txChanged = false;
                            const newGroceryItems = tx.groceryItems.map(gi => {
                                if (gi.subcategory === category && gi.name === oldItemName) {
                                    txChanged = true;
                                    expensesChanged = true;
                                    return { ...gi, name: newItemName };
                                }
                                return gi;
                            });
                            if (txChanged) return { ...tx, groceryItems: newGroceryItems };
                        }
                        return tx;
                    });
                }
            });
        });

        // Update state synchronously
        setGroceryCategories(newCategories);
        setGroceryItemBrandMap(newBrandMap);
        setGroceryItemFlavourMap(newFlavourMap);
        if (expensesChanged) setExpenses(newExpenses);

        if (isGuest) return;

        // Persist to backend
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...currentAppData, 
                    groceryCategories: newCategories,
                    groceryItemBrandMap: newBrandMap,
                    groceryItemFlavourMap: newFlavourMap
                })
            });

            if (expensesChanged) {
                await fetch(`${API_URL}/expenses`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newExpenses)
                });
            }
        } catch (error) {
            console.error("Failed to merge grocery item:", error);
        }
    };

    const addCustomGroceryItem = async (category, itemName) => {
        if (!category || !itemName) return;
        const currentList = customGroceryItems[category] || [];
        if (currentList.includes(itemName)) return;
        
        const newCustomItems = { 
            ...customGroceryItems, 
            [category]: [...currentList, itemName].sort() 
        };
        setCustomGroceryItems(newCustomItems);
        
        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, customGroceryItems: newCustomItems })
            });
        } catch (error) {
            console.error("Failed to save custom grocery item:", error);
        }
    };

    const saveGroceryBrands = async (newBrandsObj) => {
        setGroceryBrands(newBrandsObj);
        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, groceryBrands: newBrandsObj })
            });
        } catch (error) {
            console.error("Failed to save grocery brands:", error);
        }
    };

    const saveGroceryFlavours = async (newFlavoursObj) => {
        setGroceryFlavours(newFlavoursObj);
        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, groceryFlavours: newFlavoursObj })
            });
        } catch (error) {
            console.error("Failed to save grocery flavours:", error);
        }
    };

    const addGroceryBrand = async (category, brandName) => {
        if (!category || !brandName) return;
        const currentList = Array.isArray(groceryBrands) ? [] : (groceryBrands[category] || []);
        if (currentList.includes(brandName)) return;

        const newBrandsObj = {
            ...groceryBrands,
            [category]: [...currentList, brandName].sort()
        };
        // Clean up if it was a flat array previously
        if (Array.isArray(newBrandsObj)) return; 
        
        setGroceryBrands(newBrandsObj);

        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, groceryBrands: newBrandsObj })
            });
        } catch (error) {
            console.error("Failed to save grocery brand:", error);
        }
    };

    const addGroceryFlavour = async (category, flavourName) => {
        if (!category || !flavourName) return;
        const currentList = Array.isArray(groceryFlavours) ? [] : (groceryFlavours[category] || []);
        if (currentList.includes(flavourName)) return;

        const newFlavoursObj = {
            ...groceryFlavours,
            [category]: [...currentList, flavourName].sort()
        };
        if (Array.isArray(newFlavoursObj)) return; 
        
        setGroceryFlavours(newFlavoursObj);

        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, groceryFlavours: newFlavoursObj })
            });
        } catch (error) {
            console.error("Failed to save grocery flavour:", error);
        }
    };

    const removeCustomGroceryItem = async (category, itemName) => {
        if (!category || !itemName) return;
        const currentList = customGroceryItems[category] || [];
        const newCustomItems = { 
            ...customGroceryItems, 
            [category]: currentList.filter(i => i !== itemName) 
        };
        setCustomGroceryItems(newCustomItems);
        
        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, customGroceryItems: newCustomItems })
            });
        } catch (error) {
            console.error("Failed to remove custom grocery item:", error);
        }
    };

    const removeGroceryBrand = async (category, brandName) => {
        if (!category || !brandName) return;
        const currentList = Array.isArray(groceryBrands) ? [] : (groceryBrands[category] || []);
        const newBrandsObj = {
            ...groceryBrands,
            [category]: currentList.filter(b => b !== brandName)
        };
        setGroceryBrands(newBrandsObj);

        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, groceryBrands: newBrandsObj })
            });
        } catch (error) {
            console.error("Failed to remove grocery brand:", error);
        }
    };

    const removeGroceryFlavour = async (category, flavourName) => {
        if (!category || !flavourName) return;
        const currentList = Array.isArray(groceryFlavours) ? [] : (groceryFlavours[category] || []);
        if (!currentList.includes(flavourName)) return;

        const newFlavoursObj = {
            ...groceryFlavours,
            [category]: currentList.filter(f => f !== flavourName)
        };
        
        setGroceryFlavours(newFlavoursObj);

        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, groceryFlavours: newFlavoursObj })
            });
        } catch (error) {
            console.error("Failed to save grocery flavour:", error);
        }
    };

    const saveGroceryItemBrandMap = async (newMap) => {
        setGroceryItemBrandMap(newMap);
        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, groceryItemBrandMap: newMap })
            });
        } catch (error) {
            console.error("Failed to save grocery item brand map:", error);
        }
    };

    const saveGroceryItemFlavourMap = async (newMap) => {
        setGroceryItemFlavourMap(newMap);
        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, groceryItemFlavourMap: newMap })
            });
        } catch (error) {
            console.error("Failed to save grocery item flavour map:", error);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(Number(amount) || 0);
    };

    const updateSalaryFieldsConfig = async (newCustomFields, newHiddenFields) => {
        setCustomSalaryFields(newCustomFields);
        setHiddenSalaryFields(newHiddenFields);
        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            
            const payload = {
                ...currentAppData,
                customSalaryFields: newCustomFields,
                hiddenSalaryFields: newHiddenFields
            };
            
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error("Failed to save salary fields config:", error);
        }
    };

    const updateEmploymentsConfig = async (newEmployments) => {
        setEmployments(newEmployments);
        if (isGuest) {
            localStorage.setItem('employments', JSON.stringify(newEmployments));
            return;
        }
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            
            const payload = {
                ...currentAppData,
                employments: newEmployments
            };
            
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error("Failed to save employments config:", error);
            localStorage.setItem('employments', JSON.stringify(newEmployments));
        }
    };

    const saveExpenses = async (updatedExpenses) => {
        const sanitizedExpenses = JSON.parse(JSON.stringify(updatedExpenses));
        Object.values(sanitizedExpenses).forEach(yearData => {
            Object.values(yearData).forEach(monthData => {
                if (!monthData.transactions) return;
                const newCategories = {};
                monthData.transactions.forEach(tx => {
                    if (tx.deductFromSalary === false) return;
                    
                    const cat = (tx.category || '').toLowerCase();
                    if (!cat) return;
                    
                    const isIncome = ['salary received', 'salary', 'income'].includes(cat);
                    const amount = Number(tx.amount) || 0;
                    
                    let effective = 0;
                    if (isIncome) {
                        effective = tx.isCredited ? amount : -amount;
                    } else {
                        effective = tx.isCredited ? -amount : amount;
                    }
                    
                    newCategories[cat] = (newCategories[cat] || 0) + effective;
                });
                
                // Keep Math.max for backward compatibility with UI expecting no negative categories
                Object.keys(newCategories).forEach(k => {
                    newCategories[k] = Math.max(0, newCategories[k]);
                });
                monthData.categories = newCategories;
            });
        });

        setExpenses(sanitizedExpenses);
        if (isGuest) return;
        try {
            await fetch(`${API_URL}/expenses`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sanitizedExpenses)
            });
        } catch (error) {
            console.error("Failed to save expenses:", error);
        }
    };

    const updateCategoryBudget = async (category, amount) => {
        const updatedBudgets = { ...categoryBudgets, [category]: Number(amount) };
        setCategoryBudgets(updatedBudgets);
        if (isGuest) return;

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
            localStorage.setItem('categoryBudgets', JSON.stringify(updatedBudgets));
        }
    };

    const saveCategoryBudgets = async (updatedBudgets) => {
        setCategoryBudgets(updatedBudgets);
        if (isGuest) {
            localStorage.setItem('categoryBudgets', JSON.stringify(updatedBudgets));
            return;
        }

        try {
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
            console.error("Failed to save category budgets:", error);
            localStorage.setItem('categoryBudgets', JSON.stringify(updatedBudgets));
        }
    };

    const mergedCategoryMap = useMemo(() => {
        if (customCategoryMap && Object.keys(customCategoryMap).length > 0) {
            return customCategoryMap;
        }
        return CATEGORY_MAP;
    }, [customCategoryMap]);

    const saveCustomCategoryMap = async (newMap) => {
        setCustomCategoryMap(newMap);
        if (isGuest) return;

        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, customCategoryMap: newMap })
            });
        } catch (error) {
            console.error("Failed to save custom category map:", error);
        }
    };

    const addCustomCategory = async (mainCategory, subCategory) => {
        if (isGuest) return;

        const newMap = Object.keys(customCategoryMap).length > 0 
            ? JSON.parse(JSON.stringify(customCategoryMap))
            : JSON.parse(JSON.stringify(CATEGORY_MAP));
            
        if (!newMap[mainCategory]) newMap[mainCategory] = [];
        
        if (subCategory && !newMap[mainCategory].includes(subCategory)) {
            const subExists = newMap[mainCategory].some(s => s.toLowerCase() === subCategory.toLowerCase());
            if (!subExists) {
                newMap[mainCategory] = [...newMap[mainCategory], subCategory];
            }
        }

        await saveCustomCategoryMap(newMap);
    };

    const renameCategoryInTransactions = async (oldName, newName, isMainCategory = false) => {
        const newExpenses = JSON.parse(JSON.stringify(expenses));
        let changed = false;

        Object.entries(newExpenses).forEach(([year, months]) => {
            Object.entries(months).forEach(([month, monthData]) => {
                if (monthData.transactions) {
                    monthData.transactions.forEach(tx => {
                        if (isMainCategory) {
                            if (tx.mainCategory && tx.mainCategory.toLowerCase() === oldName.toLowerCase()) {
                                tx.mainCategory = newName;
                                changed = true;
                            }
                        } else {
                            if (tx.category && tx.category.toLowerCase() === oldName.toLowerCase()) {
                                tx.category = newName;
                                changed = true;
                            }
                        }
                    });
                }
                if (monthData.categories) {
                    const oldKey = Object.keys(monthData.categories).find(k => k.toLowerCase() === oldName.toLowerCase());
                    if (oldKey) {
                        const val = monthData.categories[oldKey];
                        delete monthData.categories[oldKey];
                        monthData.categories[newName] = val;
                        changed = true;
                    }
                }
            });
        });

        if (changed) {
            setExpenses(newExpenses);
            if (!isGuest) {
                try {
                    await fetch(`${API_URL}/expenses`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newExpenses)
                    });
                } catch (err) {
                    console.error("Failed to save updated transactions after category rename:", err);
                }
            }
        }
    };

    const addItem = async (type, item) => {
        if (type === 'expense') {
            const dateObj = new Date(item.date);
            const year = dateObj.getFullYear().toString();
            const month = dateObj.toLocaleString('default', { month: 'long' });
            const amount = Number(item.amount) || 0;
            const category = item.category.toLowerCase();

            // Check and add new category
            if (category && !categories.some(c => c.toLowerCase() === category)) {
                const newCategories = [...categories, category];
                setCategories(newCategories);

                try {
                    const res = await fetch(`${API_URL}/appData`);
                    const currentAppData = await res.json();
                    await fetch(`${API_URL}/appData`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...currentAppData, categories: newCategories })
                    });
                } catch (catErr) {
                    console.error('Failed to persist new category:', catErr);
                }
            }

            const isIncomeCategory = ['salary received', 'income'].includes(category);


            const newExpenses = { ...expenses };
            if (!newExpenses[year]) newExpenses[year] = {};
            if (!newExpenses[year][month]) newExpenses[year][month] = { categories: {}, transactions: [] };
            // Deep clone the specific month to avoid mutating live state
            newExpenses[year] = { ...newExpenses[year] };
            newExpenses[year][month] = JSON.parse(JSON.stringify(newExpenses[year][month]));

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

            const expenseId = Date.now().toString();
            if (!monthData.transactions) monthData.transactions = [];
            monthData.transactions.push({
                ...item,
                id: expenseId,
                title: item.title,
                amount: amount,
                category: category,
                date: item.date,
                paymentMode: item.paymentMode,
                creditCardName: item.creditCardName,
                isCredited: item.isCredited,
                transactionType: item.transactionType,
                deductFromSalary: item.deductFromSalary,
                investmentData: item.investmentData || null
            });

            await saveExpenses(newExpenses);

            // Handle Investment Sync
            if (item.investmentData && !item.skipInvestmentSync) {
                await syncExpenseToInvestment(item.investmentData, item.date, item.title, expenseId);
            }

            // Handle Credit Card Bill Payment
            const isCreditCardBill = category === 'credit card bill' || category === 'credit card payment';
            if (isCreditCardBill && item.creditCardName) {
                // Find the matching credit card
                const cardToUpdate = creditCards.find(c =>
                    c.name.toLowerCase().trim() === item.creditCardName.toLowerCase().trim()
                );

                if (cardToUpdate) {
                    // 1. Debit from Salary (if applicable)
                    // We need to find the "salary received" for this month and reduce it
                    if (newExpenses[year] && newExpenses[year][month]) {
                        const salaryCategory = 'salary received';
                        const currentSalary = newExpenses[year][month].categories[salaryCategory] || 0;

                        // Check if we have enough salary balance (optional, but good for data integrity)
                        // For now, we just subtract. If it goes negative, it indicates deficit.
                        // However, usually "salary received" tracks income, so reducing it might be wrong semantically 
                        // if we want to track "remaining salary". 
                        // But the user specifically asked to "debit from salary". 
                        // In this app's context, "categories" usually stores the total spent/received.
                        // If "salary received" stores the TOTAL incoming, we shouldn't reduce it.
                        // BUT, if the user wants to see "Remaining Salary", then we should.
                        // Given the user request "debit from salary", we will reduce the 'salary received' category value.

                        // Actually, looking at the code, 'salary received' is likely an INCOME category.
                        // If we reduce it, we are effectively saying "we received less salary".
                        // A better approach might be to treat this bill payment as an EXPENSE (which it already is),
                        // and the "Deficit/Surplus" calculation handles the rest.
                        // BUT, if the user explicitly wants to see the 'salary received' number go down, we do this:

                        // WAIT: If we treat it as an expense, it's already done above (lines 256-258).
                        // item.deductFromSalary is likely true.
                        // If item.deductFromSalary is true, the amount is ADDED to the expense category.
                        // And usually Net = Income - Expense.
                        // If the user wants to "debit from salary", maybe they mean they want to see the available fund source reduce?
                        // "Debit from salary" typically means "Pay using salary". 
                        // The existing logic `if (item.deductFromSalary !== false)` (lines 256-258) already adds it to the category total.
                        // If the category is 'credit card bill', it's an expense.
                        // So the "Debit from Salary" part is arguably ALREADY HANDLED by the general expense logic 
                        // (Expenses go up, so Net Income goes down).

                        // However, if the user insists on "debit from salary", they might imply a specific "Cash/Bank" asset 
                        // that represents salary. But we don't have a "Bank" asset derived from salary here.
                        // Let's assume the standard expense recording is what "debit from salary" implies in this context 
                        // (i.e. it counts against the salary).
                    }

                    // 2. Credit back to card limit (Scapia specific or general)
                    // We need to increase the available limit.
                    // Assuming 'limit' is the max limit and 'utilization' or 'currentBalance' tracks usage.
                    // Or maybe 'availableLimit' is a field?
                    // Let's look at a credit card object structure. 
                    // Based on previous reads, cards have 'monthlyData'. 
                    // We need to check if there's an 'availableLimit' or 'outstandingAmount' field.
                    // If we don't see one, we can't update it. 
                    // Let's blindly assume there might be a 'usage' or 'limit' we can adjust if the model supports it.
                    // If the card model is simple (just static metadata + monthlyData), then "Crediting to limit" 
                    // might just mean adding the payment record so the *calculated* outstanding drops.

                    // The user said "credit to bill limit". 
                    // If we add a payment record, a smart getters would calculate: 
                    // Outstanding = Total Spends - Total Payments.
                    // So adding a payment record *is* crediting the limit effectively.

                    // Let's adhere to the plan: Update the card object specifically.

                    const updatedMonthlyData = [...(cardToUpdate.monthlyData || [])];
                    // Find the most recent unpaid bill (not just the first/oldest)
                    const unpaidBillIndex = updatedMonthlyData.reduce((best, m, i) =>
                        (!m.isPaid && m.billAmount > 0 &&
                         (best === -1 || new Date(m.date || `${m.year}-${m.month}-01`) > new Date(updatedMonthlyData[best].date || `${updatedMonthlyData[best].year}-${updatedMonthlyData[best].month}-01`)))
                            ? i : best, -1);
                    if (unpaidBillIndex !== -1) {
                        updatedMonthlyData[unpaidBillIndex] = {
                            ...updatedMonthlyData[unpaidBillIndex],
                            isPaid: true,
                            paidDate: item.date,
                            remarks: updatedMonthlyData[unpaidBillIndex].remarks 
                                ? updatedMonthlyData[unpaidBillIndex].remarks + ' (Paid)'
                                : `Paid on ${item.date}`
                        };
                    }

                    const updatedCard = {
                        ...cardToUpdate,
                        monthlyData: updatedMonthlyData
                    };

                    // Save updated credit card
                    setCreditCards(prev => prev.map(c =>
                        String(c.id) === String(updatedCard.id) ? updatedCard : c
                    ));
                    if (isGuest) return;
                    try {
                        await fetch(`${API_URL}/creditCards/${updatedCard.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updatedCard)
                        });
                    } catch (error) {
                        console.error("Error updating credit card after bill payment:", error);
                    }
                }
            }

            return;
        }

        let endpoint = type === 'savings' ? 'savings' : type === 'asset' ? 'assets' : type === 'lents' ? 'lents' : type === 'creditCards' ? 'creditCards' : type === 'salaryDetail' ? 'salaryDetails' : type === 'taxes' ? 'taxes' : '';

        if (!endpoint) return;

        if (isGuest) {
            const savedItem = { ...item, id: Date.now().toString() };
            if (type === 'savings') setSavings(prev => [...prev, savedItem]);
            if (type === 'asset') setAssets(prev => [...prev, savedItem]);
            if (type === 'lents') setLents(prev => [...prev, savedItem]);
            if (type === 'creditCards') setCreditCards(prev => [...prev, savedItem]);
            if (type === 'salaryDetail') setSalaryDetails(prev => [...prev, savedItem]);
            if (type === 'taxes') setTaxes(prev => [...prev, savedItem]);
            return;
        }

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
            if (type === 'salaryDetail') setSalaryDetails(prev => [...prev, savedItem]);
            if (type === 'taxes') setTaxes(prev => [...prev, savedItem]);
        } catch (error) {
            console.error("Error adding item:", error);
        }
    };

    const syncExpenseDeleteToInvestment = async (invData, expenseId) => {
        if (isGuest) return;
        const { type, assetId } = invData;
        
        if (type === 'mutual_fund') {
            const fund = savings.find(s => s.id.toString() === assetId.toString());
            if (fund && fund.transactions) {
                const updatedTransactions = fund.transactions.filter(t => t.id !== expenseId);
                
                let totalUnits = 0;
                updatedTransactions.forEach(t => {
                    const tType = t.type || (t.remarks && t.remarks.toLowerCase().includes('sip') ? 'sip' : 'buy');
                    if (tType === 'buy' || tType === 'sip') totalUnits += Number(t.units);
                    if (tType === 'sell' || tType === 'withdraw') totalUnits -= Number(t.units);
                });
                if (totalUnits < 0.0001) totalUnits = 0;
                
                const newAmount = totalUnits * (fund.currentNav || 0);
                const updatedFund = { ...fund, transactions: updatedTransactions, amount: newAmount };
                
                setSavings(prev => prev.map(s => String(s.id) === String(fund.id) ? updatedFund : s));
                try {
                    await fetch(`${API_URL}/savings/${fund.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedFund)
                    });
                } catch (e) { console.error(e); }
            }
        } else if (type === 'stock') {
            const [marketId, stockId] = assetId.split('|');
            const market = savings.find(s => s.id.toString() === marketId);
            if (market && market.stocks) {
                const stockIndex = market.stocks.findIndex(s => s.id.toString() === stockId);
                if (stockIndex !== -1) {
                    const stock = market.stocks[stockIndex];
                    if (!stock.transactions) return;
                    
                    const updatedTransactions = stock.transactions.filter(t => t.id !== expenseId);
                    
                    let currentShares = 0;
                    let totalInvested = 0;
                    updatedTransactions.forEach(t => {
                        const q = Number(t.quantity);
                        const p = Number(t.price);
                        if (t.type === 'buy') {
                            totalInvested += (q * p);
                            currentShares += q;
                        } else if (t.type === 'sell') {
                            const avgCost = currentShares > 0 ? totalInvested / currentShares : 0;
                            totalInvested -= (q * avgCost);
                            currentShares -= q;
                        }
                    });
                    
                    if (currentShares < 0.0001) { currentShares = 0; totalInvested = 0; }
                    const newAvgCost = currentShares > 0 ? totalInvested / currentShares : 0;
                    
                    const updatedStock = {
                        ...stock,
                        transactions: updatedTransactions,
                        shares: currentShares,
                        avgCost: newAvgCost
                    };
                    
                    const updatedStocks = [...market.stocks];
                    updatedStocks[stockIndex] = updatedStock;
                    
                    const updatedMarket = { ...market, stocks: updatedStocks };
                    setSavings(prev => prev.map(s => String(s.id) === String(market.id) ? updatedMarket : s));
                    
                    try {
                        await fetch(`${API_URL}/savings/${market.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updatedMarket)
                        });
                    } catch (e) { console.error(e); }
                }
            }
        }
    };

    const syncExpenseToInvestment = async (invData, date, title, expenseId) => {
        if (isGuest) return;
        const { type, assetId, action } = invData;
        
        if (type === 'mutual_fund') {
            const fund = savings.find(s => s.id.toString() === assetId.toString());
            if (fund) {
                const updatedTransactions = [...(fund.transactions || [])];
                updatedTransactions.push({
                    id: expenseId, // link IDs
                    date: date,
                    type: action,
                    units: invData.units,
                    nav: invData.nav,
                    remarks: invData.remarks || title || 'Expense Sync'
                });
                
                let totalUnits = 0;
                updatedTransactions.forEach(t => {
                    const tType = t.type || (t.remarks && t.remarks.toLowerCase().includes('sip') ? 'sip' : 'buy');
                    if (tType === 'buy' || tType === 'sip') totalUnits += Number(t.units);
                    if (tType === 'sell' || tType === 'withdraw') totalUnits -= Number(t.units);
                });
                if (totalUnits < 0.0001) totalUnits = 0;
                
                const newAmount = totalUnits * (fund.currentNav || 0);
                const updatedFund = { ...fund, transactions: updatedTransactions, amount: newAmount };
                
                setSavings(prev => prev.map(s => String(s.id) === String(fund.id) ? updatedFund : s));
                try {
                    await fetch(`${API_URL}/savings/${fund.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedFund)
                    });
                } catch (e) { console.error(e); }
            }
        } else if (type === 'stock') {
            const [marketId, stockId] = assetId.split('|');
            const market = savings.find(s => s.id.toString() === marketId);
            if (market && market.stocks) {
                const stockIndex = market.stocks.findIndex(s => s.id.toString() === stockId);
                if (stockIndex !== -1) {
                    const stock = market.stocks[stockIndex];
                    const updatedTransactions = [...(stock.transactions || [])];
                    updatedTransactions.push({
                        id: expenseId,
                        date: date,
                        type: action,
                        quantity: invData.quantity,
                        price: invData.price,
                        remarks: title || 'Expense Sync'
                    });
                    
                    let currentShares = 0;
                    let totalInvested = 0;
                    updatedTransactions.forEach(t => {
                        const q = Number(t.quantity);
                        const p = Number(t.price);
                        if (t.type === 'buy') {
                            totalInvested += (q * p);
                            currentShares += q;
                        } else if (t.type === 'sell') {
                            const avgCost = currentShares > 0 ? totalInvested / currentShares : 0;
                            totalInvested -= (q * avgCost);
                            currentShares -= q;
                        }
                    });
                    
                    if (currentShares < 0.0001) { currentShares = 0; totalInvested = 0; }
                    const newAvgCost = currentShares > 0 ? totalInvested / currentShares : 0;
                    
                    const updatedStock = {
                        ...stock,
                        transactions: updatedTransactions,
                        shares: currentShares,
                        avgCost: newAvgCost
                    };
                    
                    const updatedStocks = [...market.stocks];
                    updatedStocks[stockIndex] = updatedStock;
                    
                    const updatedMarket = { ...market, stocks: updatedStocks };
                    setSavings(prev => prev.map(s => String(s.id) === String(market.id) ? updatedMarket : s));
                    
                    try {
                        await fetch(`${API_URL}/savings/${market.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updatedMarket)
                        });
                    } catch (e) { console.error(e); }
                }
            }
        }
    };

    const addMetal = async (type, item) => {
        const newItem = { ...item, id: Date.now() };
        const updated = { ...metals, [type]: [...metals[type], newItem] };
        setMetals(updated);
        if (isGuest) return;
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
        if (isGuest) return;
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
        if (isGuest) return;
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
                outer: for (const year of Object.keys(newExpenses)) {
                    for (const mth of Object.keys(newExpenses[year] || {})) {
                        const mData = newExpenses[year][mth];
                        if (!mData?.transactions) continue;
                        const txIndex = mData.transactions.findIndex(t => t.id === id);
                        if (txIndex === -1) continue;

                        // Deep clone this month before mutating
                        newExpenses[year] = { ...newExpenses[year] };
                        newExpenses[year][mth] = JSON.parse(JSON.stringify(mData));
                        const monthData = newExpenses[year][mth];
                        const tx = monthData.transactions[txIndex];
                        const target = monthData.categories || monthData;
                        const catKey = Object.keys(target).find(k => k.toLowerCase() === (tx.category || '').toLowerCase());

                        if (catKey && tx.deductFromSalary !== false) {
                            const isIncome = ['salary received', 'income'].includes(catKey.toLowerCase());
                            const val = isIncome
                                ? (tx.isCredited ? tx.amount : -tx.amount)
                                : (tx.isCredited ? -tx.amount : tx.amount);
                            target[catKey] = Math.max(0, (target[catKey] || 0) - val);
                        }

                        if (tx.investmentData) {
                            syncExpenseDeleteToInvestment(tx.investmentData, id);
                        }

                        monthData.transactions.splice(txIndex, 1);
                        found = true;

                        // Handle Credit Card Bill deletion - normalise dates before comparing
                        const isCreditCardBill = ['credit card bill', 'credit card payment'].includes((tx.category || '').toLowerCase());
                        if (isCreditCardBill && tx.creditCardName) {
                            const cardToUpdate = creditCards.find(c =>
                                c.name.toLowerCase().trim() === tx.creditCardName.toLowerCase().trim()
                            );
                            if (cardToUpdate) {
                                let updatedCard = { ...cardToUpdate, monthlyData: [...(cardToUpdate.monthlyData || [])] };
                                const txDateNorm = (tx.date || '').replace(/-/g, '/').split('/').map(p => p.padStart(2,'0')).join('-');
                                const recordIndex = updatedCard.monthlyData.findIndex(m => {
                                    if (!m.isPaid) return false;
                                    const paidNorm = (m.paidDate || '').replace(/-/g, '/').split('/').map(p => p.padStart(2,'0')).join('-');
                                    return paidNorm === txDateNorm || Number(m.billAmount) === Number(tx.amount);
                                });
                                if (recordIndex !== -1) {
                                    if (updatedCard.monthlyData[recordIndex].points === 0 &&
                                        String(updatedCard.monthlyData[recordIndex].remarks || '').includes('Bill payment')) {
                                        updatedCard.monthlyData.splice(recordIndex, 1);
                                    } else {
                                        updatedCard.monthlyData[recordIndex] = {
                                            ...updatedCard.monthlyData[recordIndex],
                                            isPaid: false,
                                            paidDate: null,
                                            remarks: (updatedCard.monthlyData[recordIndex].remarks || '').replace(' (Paid)', '')
                                        };
                                    }
                                    fetch(`${API_URL}/creditCards/${updatedCard.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(updatedCard)
                                    }).then(() => {
                                        setCreditCards(prev => prev.map(c =>
                                            String(c.id) === String(updatedCard.id) ? updatedCard : c
                                        ));
                                    }).catch(error => {
                                        console.error("Error updating credit card after bill payment deletion:", error);
                                    });
                                }
                            }
                        }
                        break outer;
                    }
                }
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

        let endpoint = type === 'savings' ? 'savings' : type === 'asset' ? 'assets' : type === 'lents' ? 'lents' : type === 'creditCards' ? 'creditCards' : type === 'salaryDetail' ? 'salaryDetails' : type === 'taxes' ? 'taxes' : '';
        if (!endpoint) return;
        if (isGuest) return;
        try {
            await fetch(`${API_URL}/${endpoint}/${id}`, { method: 'DELETE' });
            if (type === 'savings') setSavings(prev => prev.filter(i => String(i.id) !== String(id)));
            if (type === 'asset') setAssets(prev => prev.filter(i => String(i.id) !== String(id)));
            if (type === 'lents') setLents(prev => prev.filter(i => String(i.id) !== String(id)));
            if (type === 'creditCards') setCreditCards(prev => prev.filter(i => String(i.id) !== String(id)));
            if (type === 'salaryDetail') setSalaryDetails(prev => prev.filter(i => String(i.id) !== String(id)));
            if (type === 'taxes') setTaxes(prev => prev.filter(i => String(i.id) !== String(id)));
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
            }),
            antique_coins: metals.antique_coins || [],
            currencies: metals.currencies || []
        };
    }, [metals, metalRates, manualMetalRates]);

    const calculateItemCurrentValue = (item) => {
        if (!item) return 0;

        switch (item.type) {
            case 'stock_market':
                return (item.stocks || [])
                    .filter(s => !s.isArchived && Number(s.shares || 0) > 0)
                    .reduce((sum, s) => sum + (Number(s.shares || 0) * Number(s.currentPrice || 0)), 0);

            case 'mutual_fund':
                let totalUnits = 0;
                (item.transactions || []).forEach(tx => {
                    const isSell = tx.type === 'sell' || tx.type === 'withdraw';
                    const txUnits = Number(tx.units || 0);
                    if (isSell) totalUnits -= txUnits;
                    else totalUnits += txUnits;
                });
                return Math.max(0, totalUnits) * Number(item.currentNav || 0);

            case 'fixed_deposit':
                return (item.deposits || []).reduce((sum, dep) => sum + (Number(dep.currentValue) || 0), 0);

            case 'recurring_deposit':
                return (item.recurringDeposits || []).reduce((sum, rd) => sum + (rd.installments || []).reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0), 0);

            case 'ppf':
                return (item.details || []).slice(-1)[0]?.balance || 0;

            case 'pf':
                // For PF, item.amount is the base balance. details tracks additional contributions.
                // Only sum details entries (do NOT add item.amount again to avoid double-counting
                // if the opening balance is also present as the first details entry).
                return (item.details || []).reduce((sum, d) => sum + Number(d.amount || 0), 0) || Number(item.amount || 0);

            case 'nps':
                return (item.holdings || []).reduce((sum, h) => {
                    if (h.transactions && h.transactions.length > 0) {
                        const hUnits = h.transactions.reduce((acc, tx) => {
                            const u = Number(tx.units || 0);
                            // Billing and sell/withdraw reduce units; contribution adds
                            if (tx.type === 'billing' || tx.type === 'sell' || tx.type === 'withdraw') {
                                return acc + u; // units are already stored as negative for billing/sell
                            }
                            return acc + u;
                        }, 0);
                        return sum + (hUnits * Number(h.nav || 0));
                    }
                    return sum + Number(h.amount || 0);
                }, 0);

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
                return (item.stocks || [])
                    .filter(s => !s.isArchived && Number(s.shares || 0) > 0)
                    .reduce((sum, s) => sum + (Number(s.shares || 0) * Number(s.avgCost || 0)), 0);

            case 'mutual_fund': {
                let runningUnits = 0;
                let runningCost = 0;
                const sortedTxs = [...(item.transactions || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
                sortedTxs.forEach(tx => {
                    const isSell = tx.type === 'sell' || tx.type === 'withdraw';
                    const txAmount = Number(tx.amount || 0) || (Number(tx.units || 0) * Number(tx.nav || 0));
                    const txUnits = Number(tx.units || 0);
                    if (isSell) {
                        const avgCostAtSale = runningUnits > 0 ? runningCost / runningUnits : 0;
                        const costOfSoldUnits = avgCostAtSale * txUnits;
                        runningUnits -= txUnits;
                        runningCost -= costOfSoldUnits;
                        if (runningUnits < 0) runningUnits = 0;
                        if (runningCost < 0) runningCost = 0;
                    } else {
                        runningUnits += txUnits;
                        runningCost += txAmount;
                    }
                });
                return Math.max(0, runningCost);
            }

            case 'fixed_deposit':
                return (item.deposits || []).reduce((sum, dep) => sum + (Number(dep.originalAmount) || 0), 0);

            case 'recurring_deposit':
                return (item.recurringDeposits || []).reduce((sum, rd) => sum + (rd.installments || []).reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0), 0);

            case 'ppf':
                return (item.details || []).reduce((sum, d) => sum + Number(d.deposit || 0), 0);

            case 'pf':
                return (item.details || []).reduce((sum, d) => sum + (d.type !== 'Interest' ? Number(d.amount || 0) : 0), Number(item.amount || 0));

            case 'nps': {
                let hasAnyTx = false;
                const txInvested = (item.holdings || []).reduce((sum, h) => {
                    if (h.transactions && h.transactions.length > 0) {
                        hasAnyTx = true;
                        return sum + h.transactions.reduce((acc, tx) => acc + (tx.type === 'billing' ? 0 : Number(tx.amount || 0)), 0);
                    }
                    return sum;
                }, 0);
                return hasAnyTx ? txInvested : Number(item.investedAmount || 0);
            }

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
            const newYear = dateObj.getFullYear().toString();
            const newMonth = dateObj.toLocaleString('default', { month: 'long' });
            const newCategory = item.category;
            const newAmount = Number(item.amount) || 0;

            if (item.id && !String(item.id).includes('-')) {
                let foundLocation = null;
                // Find where the transaction is currently stored
                Object.entries(newExpenses).forEach(([y, months]) => {
                    Object.entries(months).forEach(([m, monthData]) => {
                        if (foundLocation || !monthData.transactions) return;
                        const txIndex = monthData.transactions.findIndex(t => String(t.id) === String(item.id));
                        if (txIndex !== -1) {
                            foundLocation = { year: y, month: m, index: txIndex, data: monthData };
                        }
                    });
                });

                if (foundLocation) {
                    const { year: oldYear, month: oldMonth, index: txIndex } = foundLocation;
                    // Deep clone old month before any mutation
                    newExpenses[oldYear] = { ...newExpenses[oldYear] };
                    newExpenses[oldYear][oldMonth] = JSON.parse(JSON.stringify(foundLocation.data));
                    const oldMonthData = newExpenses[oldYear][oldMonth];
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

                        // Ensure new location exists and deep clone it
                        if (!newExpenses[newYear]) newExpenses[newYear] = {};
                        if (!newExpenses[newYear][newMonth]) newExpenses[newYear][newMonth] = { categories: {}, transactions: [] };
                        newExpenses[newYear] = { ...newExpenses[newYear] };
                        newExpenses[newYear][newMonth] = JSON.parse(JSON.stringify(newExpenses[newYear][newMonth]));

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

                        oldMonthData.transactions[txIndex] = { ...oldTx, ...item, amount: newAmount, category: newCategory, deductFromSalary: item.deductFromSalary, investmentData: item.investmentData || null };
                    }

                    await saveExpenses(newExpenses);
                    
                    // Handle Investment Sync on Edit
                    if (!item.skipInvestmentSync) {
                        if (oldTx.investmentData) {
                            await syncExpenseDeleteToInvestment(oldTx.investmentData, oldTx.id);
                        }
                        if (item.investmentData) {
                            await syncExpenseToInvestment(item.investmentData, item.date, item.title, item.id);
                        }
                    }

                    // Handle Credit Card Bill update
                    const wasOldCreditCardBill = ['credit card bill', 'credit card payment'].includes(oldTx.category?.toLowerCase());
                    const isNewCreditCardBill = ['credit card bill', 'credit card payment'].includes(newCategory.toLowerCase());

                    // Remove old payment record if category changed FROM credit card bill
                    if (wasOldCreditCardBill && oldTx.creditCardName) {
                        const oldCard = creditCards.find(c =>
                            c.name.toLowerCase().trim() === oldTx.creditCardName.toLowerCase().trim()
                        );

                        if (oldCard) {
                            const updatedMonthlyData = [...(oldCard.monthlyData || [])];
                            const recordIndex = updatedMonthlyData.findIndex(m => 
                                m.isPaid && 
                                (m.paidDate === oldTx.date || (Number(m.billAmount) === Number(oldTx.amount) && String(m.remarks || '').includes('Bill payment')))
                            );
                            
                            if (recordIndex !== -1) {
                                if (updatedMonthlyData[recordIndex].points === 0 && String(updatedMonthlyData[recordIndex].remarks || '').includes('Bill payment')) {
                                    updatedMonthlyData.splice(recordIndex, 1);
                                } else {
                                    updatedMonthlyData[recordIndex] = {
                                        ...updatedMonthlyData[recordIndex],
                                        isPaid: false,
                                        paidDate: null,
                                        remarks: (updatedMonthlyData[recordIndex].remarks || '').replace(' (Paid)', '')
                                    };
                                }

                                const updatedCard = { ...oldCard, monthlyData: updatedMonthlyData };
                                try {
                                    await fetch(`${API_URL}/creditCards/${updatedCard.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(updatedCard)
                                    });
                                    setCreditCards(prev => prev.map(c =>
                                        String(c.id) === String(updatedCard.id) ? updatedCard : c
                                    ));
                                } catch (error) {
                                    console.error("Error removing old credit card payment record:", error);
                                }
                            }
                        }
                    }

                    // Add new payment record if category changed TO credit card bill
                    if (isNewCreditCardBill && item.creditCardName) {
                        const newCard = creditCards.find(c =>
                            c.name.toLowerCase().trim() === item.creditCardName.toLowerCase().trim()
                        );

                        if (newCard) {
                            const updatedMonthlyData = [...(newCard.monthlyData || [])];
                            // Use most-recent unpaid bill strategy (consistent with addItem)
                            const unpaidBillIndex = updatedMonthlyData.reduce((best, m, i) =>
                                (!m.isPaid && m.billAmount > 0 &&
                                 (best === -1 || new Date(m.date || `${m.year}-${m.month}-01`) > new Date(updatedMonthlyData[best].date || `${updatedMonthlyData[best].year}-${updatedMonthlyData[best].month}-01`)))
                                    ? i : best, -1);
                            
                            if (unpaidBillIndex !== -1) {
                                updatedMonthlyData[unpaidBillIndex] = {
                                    ...updatedMonthlyData[unpaidBillIndex],
                                    isPaid: true,
                                    paidDate: item.date,
                                    remarks: updatedMonthlyData[unpaidBillIndex].remarks 
                                        ? updatedMonthlyData[unpaidBillIndex].remarks + ' (Paid)'
                                        : `Paid on ${item.date}`
                                };

                                const updatedCard = { ...newCard, monthlyData: updatedMonthlyData };
                                try {
                                    await fetch(`${API_URL}/creditCards/${updatedCard.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(updatedCard)
                                    });
                                    setCreditCards(prev => prev.map(c =>
                                        String(c.id) === String(updatedCard.id) ? updatedCard : c
                                    ));
                                } catch (error) {
                                    console.error("Error adding new credit card payment record:", error);
                                }
                            }
                        }
                    }

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

        let endpoint = type === 'savings' ? 'savings' : type === 'asset' ? 'assets' : type === 'lents' ? 'lents' : type === 'creditCards' ? 'creditCards' : type === 'salaryDetail' ? 'salaryDetails' : type === 'taxes' ? 'taxes' : '';
        if (!endpoint || !item.id) return;
        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/${endpoint}/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            const updatedItem = await res.json();
            if (type === 'savings') setSavings(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            if (type === 'asset') setAssets(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            if (type === 'lents') setLents(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            if (type === 'creditCards') setCreditCards(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            if (type === 'salaryDetail') setSalaryDetails(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            if (type === 'taxes') setTaxes(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            return { success: true };
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
        if (isGuest) return;

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
        if (isGuest) return;

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

        // 1. Fetch current prices (takes time)
        // We use the local state 'savings' just to get the list of stocks to refresh
        const initialMarket = savings.find(s => s.id.toString() === marketId);
        if (!initialMarket || !initialMarket.stocks) return { success: false, message: 'Market data not found' };

        try {
            const updatedStockPrices = await Promise.all(initialMarket.stocks.map(async (stock) => {
                const ticker = stock.ticker.includes('.') ? stock.ticker : `${stock.ticker}.NS`;
                try {
                    // Using api.allorigins.win to bypass CORS for Yahoo Finance
                    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query2.finance.yahoo.com/v8/finance/chart/${ticker}`)}`;
                    const response = await fetch(proxyUrl);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();

                    const result = data.chart?.result?.[0];
                    if (result && result.meta?.regularMarketPrice) {
                        return { id: stock.id, currentPrice: result.meta.regularMarketPrice };
                    }
                    return { id: stock.id, currentPrice: stock.currentPrice };
                } catch (err) {
                    console.warn(`Failed to fetch price for ${ticker}:`, err);
                    return { id: stock.id, currentPrice: stock.currentPrice };
                }
            }));

            // 2. CRITICAL FIX: Fetch latest data from server just before saving
            // This prevents overwriting changes made (like adding a stock) while prices were being fetched
            const res = await fetch(`${API_URL}/savings/${marketId}`);
            if (!res.ok) throw new Error('Failed to fetch latest market data');
            const latestMarket = await res.json();

            // 3. Merge new prices into latest data
            const mergedStocks = latestMarket.stocks.map(stock => {
                const newPriceData = updatedStockPrices.find(p => p.id === stock.id);
                if (newPriceData) {
                    return { ...stock, currentPrice: newPriceData.currentPrice };
                }
                return stock;
            });

            // 4. Save the merged result
            const finalMarket = { ...latestMarket, stocks: mergedStocks };

            // We use updateItem here which updates local state and sends PUT to server
            // But since we already have the latest object and just want to save it, 
            // calling updateItem acts as the "Save" step. 
            // NOTE: updateItem calculates 'savings' state update based on previous state in setter,
            // which is good. But we should pass the object that INCLUDES the changes we just found 
            // (which might include other user added stocks) + our price updates.

            await updateItem('savings', finalMarket);
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
        expenses, savings, metals: processedMetals, assets, creditCards, lents, taxes, salaryStats, categories, snapshots, categoryBudgets, salaryDetails, categoryRules,
        addItem, addMetal, deleteItem, deleteMetal, updateItem, updateMetal, saveExpenses, updateCategoryRules,
        addNewYear, takeSnapshot, updateCategoryBudget, saveCategoryBudgets,
        formatCurrency,
        calculateItemCurrentValue,
        calculateItemInvestedValue,
        refreshMutualFundNAV,
        refreshStockPrices,
        customSalaryFields,
        hiddenSalaryFields,
        updateSalaryFieldsConfig,
        employments,
        updateEmploymentsConfig,
        metalRates,
        fetchMetalRates,
        manualMetalRates,
        updateManualRates,
        mergedCategoryMap,
        addCustomCategory,
        saveCustomCategoryMap,
        renameCategoryInTransactions,
        customGroceryItems,
        addCustomGroceryItem,
        removeCustomGroceryItem,
        groceryBrands,
        addGroceryBrand,
        removeGroceryBrand,
        saveGroceryBrands,
        groceryFlavours,
        addGroceryFlavour,
        removeGroceryFlavour,
        saveGroceryFlavours,
        groceryItemBrandMap,
        groceryItemFlavourMap,
        saveGroceryItemBrandMap,
        saveGroceryItemFlavourMap,
        groceryCategories,
        saveGroceryCategories,
        mergeGroceryItem,
        dataError,
        isLoading
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
