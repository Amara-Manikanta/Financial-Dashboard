import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getLastWorkingDayOfMonth } from '../utils/dateUtils';
import { CATEGORY_MAP } from '../utils/categories';
import { countsAsSpending } from '../utils/payrollDeductions';
import { totalAccruedValue, totalPrincipal } from '../utils/fdAccrual';
import {
    normaliseLegs,
    legToInvestmentTx,
    belongsToExpense,
    detachExpense,
    findAdoptable,
    adoptTransaction,
    recomputeStockMetrics,
    recomputeFundAmount
} from '../utils/investmentSync';
import { readHolding as readSgbHolding } from '../utils/sgb';
// NOTE: db.json is deliberately NOT imported here.
// Vite inlines a JSON import at build time, producing a snapshot that never
// refreshes (vite.config.js also excludes db.json from the watcher). Seeding
// React state from that snapshot meant a failed fetch could load months-old
// data into state, and the next save would write it back over the live DB —
// which is how uploaded metal images reverted to their original seed paths.
// All data must come from the server at runtime.


const FinanceContext = createContext();


// Defaults to the API beside the app. `VITE_API_URL` points the whole client at
// a different instance, which is what makes it possible to exercise the real UI
// — including saves — against an isolated copy of the database instead of the
// live one. Without it, any end-to-end check writes to the real records.
const API_URL = import.meta.env?.VITE_API_URL
    || (typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname || 'localhost'}:3000`
        : 'http://localhost:3000');

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
    'Non-Veg': ['Chicken', 'Mutton', 'Fish', 'Prawns', 'Eggs', 'Chicken Boneless', 'Egg Tray (30)'],
    'Others': ['Sugar', 'Salt', 'Tea Powder', 'Coffee Powder', 'Jaggery']
};

export const DEFAULT_CATEGORY_BUDGETS = {
    'Groceries': 15000,
    'Fuel': 5000,
    'Food & Dining': 8000,
    'Bills & Utilities': 12000,
    'Shopping': 10000,
    'Healthcare': 5000,
    'Travel': 10000,
    'Entertainment': 5000,
    'Housing': 25000,
    'Miscellaneous': 5000
};

const MONTHLY_EARNINGS_KEYS = ['basicSalary', 'hra', 'conveyanceAllowance', 'flexibleAllowance', 'performanceBonus', 'foodWallet',
    'holidayAllowance', 'compensatoryAllowance', 'engagementPb', 'annualFlexiBasket', 'internetAllowance', 'cfPfMonthly'];
// `vpf` is listed here deliberately. Any numeric payslip key that is in neither
// list gets added to GROSS by the catch-all below, so leaving a deduction out
// does not merely ignore it — it flips its sign and counts it as earnings.
const MONTHLY_DEDUCTIONS_KEYS = ['epf', 'vpf', 'profTax', 'incomeTax', 'otherRecoveries', 'medicalPremRecoverable', 'cfPfMonthly'];

const calculateSalaryStats = (expensesData, salaryDetailsData = []) => {
    const stats = {};
    if (!expensesData || typeof expensesData !== 'object') return stats;

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // 1. Pass 1: Parse explicit salary slips from salaryDetailsData
    const slipMap = {};
    if (Array.isArray(salaryDetailsData)) {
        salaryDetailsData.forEach(record => {
            if (!record.year || !record.month || record.month === 'Annual') return;
            const yr = String(record.year);
            const mo = String(record.month);

            let gross = 0;
            MONTHLY_EARNINGS_KEYS.forEach(k => {
                if (k !== 'cfPfMonthly') gross += Number(record[k]) || 0;
            });
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
                if (!slipMap[yr]) slipMap[yr] = {};
                slipMap[yr][mo] = net;
            }
        });
    }

    // 2. Pass 2: Calculate actual income for every year & month in expensesData
    Object.entries(expensesData).forEach(([year, months]) => {
        if (!stats[year]) stats[year] = { total: 0, months: {} };
        if (!months || typeof months !== 'object') return;

        Object.entries(months).forEach(([month, data]) => {
            if (!data) return;

            let salary = 0;

            // A. Check if explicit salary slip exists in slipMap
            if (slipMap[year] && slipMap[year][month]) {
                salary = slipMap[year][month];
            }

            // B. Check if salary transactions exist in data.transactions
            if (data.transactions && Array.isArray(data.transactions)) {
                let txIncomeSum = 0;
                data.transactions.forEach(t => {
                    const cat = (t.category || '').toLowerCase();
                    const title = (t.title || '').toLowerCase();
                    if (['salary received', 'salary', 'income'].includes(cat) || cat.includes('salary') || title.includes('salary received') || t.isIncome) {
                        txIncomeSum += Number(t.amount) || 0;
                    }
                });
                if (txIncomeSum > 0) {
                    salary = txIncomeSum;
                }
            }

            // C. Check categories object for legacy data format
            if (salary === 0) {
                const categories = data.categories || (typeof data === 'object' ? data : {});
                salary = Number(categories['salary received'] || categories['salary'] || categories['income'] || 0);
            }

            stats[year].months[month] = salary;
            stats[year].total += salary;
        });
    });

    return stats;
};

// The complete set of metal categories. Anything outside this list is a bug,
// not a new category — adding one means updating this constant deliberately.
/**
 * True when a policy is pure protection — it pays out only on a claim and
 * returns nothing at maturity, so its premiums are an expense rather than
 * savings. Motor, health and term cover (including PMJJBY) are protection.
 * Endowment and money-back life plans are not, and do belong in savings.
 *
 * An explicit isProtectionOnly flag on the record always wins; the category
 * is only a fallback for policies recorded before the flag existed.
 */
export const isProtectionOnlyPolicy = (policy) => {
    if (!policy) return false;
    if (typeof policy.isProtectionOnly === 'boolean') return policy.isProtectionOnly;
    const category = (policy.policyDetails?.category || '').toLowerCase();
    return ['bike', 'car', 'health', 'home'].includes(category);
};

export const METAL_CATEGORIES = ['gold', 'silver', 'platinum', 'antique_coins', 'currencies'];

export function FinanceProvider({ children }) {
    const [expenses, setExpenses] = useState({});
    const [savings, setSavings] = useState([]);
    const [metals, setMetals] = useState({ gold: [], silver: [], platinum: [], antique_coins: [], currencies: [] });
    const [assets, setAssets] = useState([]);
    const [lents, setLents] = useState([]);
    const [categories, setCategories] = useState([]);
    const [creditCards, setCreditCards] = useState([]);
    const [taxes, setTaxes] = useState([]);
    const [salaryDetails, setSalaryDetails] = useState([]);
    const [goals, setGoals] = useState([]);
    const [ipoApplications, setIpoApplications] = useState([]);
    const [loans, setLoans] = useState([]);
    const [insuranceProfile, setInsuranceProfile] = useState({ age: 30, dependents: 2, annualIncome: 1800000, liabilities: 4300000 });
    const [salaryStats, setSalaryStats] = useState({});
    // True when the wallet auto-credit backfill produced rows that exist in memory
    // but have deliberately not been written to the DB. See applyWalletAutoCredits.
    const [pendingWalletCredits, setPendingWalletCredits] = useState(false);
    const [snapshots, setSnapshots] = useState([]);
    const [categoryBudgets, setCategoryBudgets] = useState({});
    const [customCategoryMap, setCustomCategoryMap] = useState({});
    const [deletedCategories, setDeletedCategories] = useState([]);
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
    const [recurringOverrides, setRecurringOverrides] = useState({});
    const [groceryCategories, setGroceryCategories] = useState(DEFAULT_GROCERY_CATEGORIES);
    const [isLoading, setIsLoading] = useState(true);
    // Set when the initial load failed. State is empty in that situation, so
    // saving would write emptiness over real records — writes are refused until
    // a successful load has actually populated state.
    const [loadError, setLoadError] = useState(null);

    // Set whenever a write does not reach the database. Rendered as a banner, so
    // a lost write is visible immediately rather than being discovered on the
    // next reload, when the record is already gone.
    const [saveError, setSaveError] = useState(null);

    // The version of `expenses` this tab last read. Sent with every save; the
    // server refuses the write if the collection has moved on since. A whole
    // collection is written on each save, so without this a second tab — or the
    // same tab left open — silently erases everything it never loaded.
    const expensesVersion = useRef(null);
    // null = not yet probed, true = server has per-row writes, false = fall back
    // to whole-collection saves. Probed once on first use.
    const perRowWrites = useRef(null);

    /** Guard every write: never persist state that was never successfully loaded. */
    const canWrite = () => {
        if (loadError) {
            console.error('[FinanceContext] Save refused: initial data load failed, so in-memory state is not a valid basis for a write. Reload once the API server is reachable.');
            return false;
        }
        return true;
    };
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
            console.warn("Metal rates API currently unavailable, using cached rates.");
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [expRes, savRes, metRes, assRes, appRes, snapRes, lentRes, ccRes, taxRes, salRes, goalsRes, loansRes, ipoRes] = await Promise.all([
                    fetch(`${API_URL}/expenses`),
                    fetch(`${API_URL}/savings`),
                    fetch(`${API_URL}/metals`),
                    fetch(`${API_URL}/assets`),
                    fetch(`${API_URL}/appData`),
                    fetch(`${API_URL}/snapshots`).then(res => res.ok ? res : { json: () => [] }).catch(() => ({ json: () => [] })),
                    fetch(`${API_URL}/lents`),
                    fetch(`${API_URL}/creditCards`),
                    fetch(`${API_URL}/taxes`).then(res => res.ok ? res : { json: () => [] }).catch(() => ({ json: () => [] })),
                    fetch(`${API_URL}/salaryDetails`).then(res => res.ok ? res : { json: () => [] }).catch(() => ({ json: () => [] })),
                    fetch(`${API_URL}/goals`).then(res => res.ok ? res : { json: () => [] }).catch(() => ({ json: () => [] })),
                    fetch(`${API_URL}/loans`).then(res => res.ok ? res : { json: () => [] }).catch(() => ({ json: () => [] })),
                    // Last, matching its position in the destructure above. These
                    // are positional: inserting a fetch anywhere but the end shifts
                    // every response after it onto the wrong variable.
                    // Tolerates a 404 so an older database without the collection
                    // still loads; it is created on first save.
                    fetch(`${API_URL}/ipoApplications`).then(res => res.ok ? res : { json: () => [] }).catch(() => ({ json: () => [] }))
                ]);

                // Remember which version of expenses this tab is working from, so
                // a save can be refused if something else wrote in the meantime
                // rather than overwriting it.
                expensesVersion.current = expRes.headers?.get?.('X-DB-Version') || null;

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
                const goalsData = await goalsRes.json();
                const ipoData = await ipoRes.json();
                const loansData = await loansRes.json();

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

                // The wallet auto-credit backfill used to PUT the whole expense tree
                // on every app load. That made a bug in any newly added feature able
                // to overwrite ten years of records before the user clicked anything.
                // The backfill now stays in memory only; persisting it is an explicit
                // action (see applyWalletAutoCredits) so a boot can never rewrite data.
                if (isModified) {
                    setPendingWalletCredits(true);
                    console.warn('[FinanceContext] Wallet auto-credits are pending. They are shown in the UI but not saved. Call applyWalletAutoCredits() to persist them.');
                } else {
                    setPendingWalletCredits(false);
                }

                setExpenses(modifiedExpenses);
                setSavings(savData);
                // Guarantee every category exists. A category the database has
                // not seen yet (platinum, until the first item is added) would
                // otherwise be undefined, and adding to it would spread undefined.
                setMetals({ gold: [], silver: [], platinum: [], antique_coins: [], currencies: [], ...metData });
                setAssets(assData);
                setLents(lentData || []);
                setCreditCards(ccData || []);
                setTaxes(taxesData || []);
                const savedBudgets = (appData.categoryBudgets && Object.keys(appData.categoryBudgets).length > 0)
                    ? appData.categoryBudgets
                    : (JSON.parse(localStorage.getItem('categoryBudgets') || 'null') || DEFAULT_CATEGORY_BUDGETS);
                setCategoryBudgets(savedBudgets);
                setCategories(appData.categories || []);
                setCategoryRules(appData.categoryRules || {});
                setRecurringOverrides(appData.recurringOverrides || {});
                setManualMetalRates(appData.manualMetalRates || { gold: 0, silver: 0 });
                setCustomSalaryFields(appData.customSalaryFields || { annual: [], monthlyEarnings: [], monthlyDeductions: [] });
                setHiddenSalaryFields(appData.hiddenSalaryFields || []);
                setEmployments(appData.employments || JSON.parse(localStorage.getItem('employments') || '[]'));
                setCustomCategoryMap(appData.customCategoryMap || {});
                setDeletedCategories(appData.deletedCategories || []);
                setCustomGroceryItems(appData.customGroceryItems || {});
                // Handle old flat array if present
                const loadedBrands = appData.groceryBrands || {};
                setGroceryBrands(Array.isArray(loadedBrands) ? {} : loadedBrands);
                
                const loadedFlavours = appData.groceryFlavours || {};
                setGroceryFlavours(Array.isArray(loadedFlavours) ? {} : loadedFlavours);
                
                setGroceryItemBrandMap(appData.groceryItemBrandMap || {});
                setGroceryItemFlavourMap(appData.groceryItemFlavourMap || {});
                
                // Load custom grocery categories merged with default categories (ensuring Non-Veg is always present)
                const loadedCategories = appData.groceryCategories && Object.keys(appData.groceryCategories).length > 0 ? appData.groceryCategories : {};
                setGroceryCategories({ ...DEFAULT_GROCERY_CATEGORIES, ...loadedCategories });
                
                const DEFAULT_GOALS = [
                    { id: 'goal_1', name: 'House Down Payment', targetAmount: 1000000, deadline: '2027-12-31', fundingSource: 'all_savings', priority: 'high', manualProgress: 0, notes: '10L target for 2BHK down payment' },
                    { id: 'goal_2', name: 'Emergency Buffer Fund', targetAmount: 500000, deadline: '2026-12-31', fundingSource: 'emergency_fund', priority: 'high', manualProgress: 0, notes: '6 months living expenses' },
                    { id: 'goal_3', name: 'Long-term Equity Wealth', targetAmount: 2500000, deadline: '2030-12-31', fundingSource: 'all_investments', priority: 'medium', manualProgress: 0, notes: 'Compounding equity portfolio' }
                ];

                const DEFAULT_LOANS = [
                    { id: 'loan_1', name: 'SBI Home Loan', type: 'home', lender: 'SBI Bank', accountNumber: 'HL-98765432', principalAmount: 3500000, interestRate: 8.5, tenureMonths: 240, startDate: '2024-01-15', emiAmount: 30374, notes: 'Primary residence home loan' },
                    { id: 'loan_2', name: 'HDFC Car Loan', type: 'car', lender: 'HDFC Bank', accountNumber: 'AUTO-456789', principalAmount: 800000, interestRate: 9.25, tenureMonths: 60, startDate: '2025-06-01', emiAmount: 16701, notes: 'Car loan for SUV' }
                ];

                setSnapshots(snapData || []);
                setSalaryDetails(salaryDetailsData || []);
                setGoals((goalsData && goalsData.length > 0) ? goalsData : DEFAULT_GOALS);
                setIpoApplications(Array.isArray(ipoData) ? ipoData : []);
                setLoans((loansData && loansData.length > 0) ? loansData : DEFAULT_LOANS);
                setInsuranceProfile(appData?.insuranceProfile || { age: 30, dependents: 2, annualIncome: 1800000, liabilities: 4300000 });

            } catch (error) {
                // Previously this fell back to a bundled snapshot of db.json. That
                // snapshot was frozen at build time, so a transient fetch failure
                // (most often the API server restarting after a code change) put
                // stale records into state — and the next save wrote them back,
                // silently reverting real data. Leaving state empty and surfacing
                // the failure is the only safe response: better to show nothing
                // than to show old data the user might then overwrite good data with.
                console.error("Failed to fetch data from the API:", error);
                setLoadError(error?.message || 'Could not reach the data server.');
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
                method: 'PATCH',
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
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, categoryRules: newRules })
            });
        } catch (error) {
            console.error("Failed to save category rules:", error);
        }
    };

    // User overrides on top of the computed active/stopped status. Kept separate
    // from detection so the underlying maths stays deterministic, and so a
    // charge arriving after you marked something cancelled is still visible
    // rather than being silently hidden by the override.
    const saveRecurringOverrides = async (nextOverrides) => {
        const previous = recurringOverrides;
        setRecurringOverrides(nextOverrides);
        if (isGuest) {
            setSaveError('Signed in as guest — nothing you change is being saved. Sign in as admin to keep it.');
            return;
        }
        try {
            const res = await fetch(`${API_URL}/appData`);
            if (!res.ok) throw new Error(`could not read appData (${res.status})`);
            const currentAppData = await res.json();
            const write = await fetch(`${API_URL}/appData`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, recurringOverrides: nextOverrides })
            });
            if (!write.ok) throw new Error(`server returned ${write.status}`);
            setSaveError(null);
        } catch (error) {
            // Never let a failed write look successful: roll the UI back and say so.
            setRecurringOverrides(previous);
            setSaveError(`Could not save the subscription status: ${error.message}. Your change was not kept.`);
        }
    };

    const saveGroceryCategories = async (newCategories) => {
        setGroceryCategories(newCategories);
        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PATCH',
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
                method: 'PATCH',
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
                    method: 'PATCH',
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
                method: 'PATCH',
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
                method: 'PATCH',
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
                method: 'PATCH',
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
                method: 'PATCH',
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
                method: 'PATCH',
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
                method: 'PATCH',
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
                method: 'PATCH',
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
                method: 'PATCH',
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
                method: 'PATCH',
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
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, groceryItemFlavourMap: newMap })
            });
        } catch (error) {
            console.error("Failed to save grocery item flavour map:", error);
        }
    };

    const formatNumber = (amount, decimals = 0) => {
        const num = Number(amount);
        if (isNaN(num)) return '0';
        return new Intl.NumberFormat('en-IN', {
            maximumFractionDigits: decimals,
            minimumFractionDigits: decimals,
        }).format(num);
    };

    const formatCurrency = (amount) => {
        const num = Number(amount) || 0;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: num % 1 === 0 ? 0 : 2,
        }).format(num);
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
                method: 'PATCH',
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
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error("Failed to save employments config:", error);
            localStorage.setItem('employments', JSON.stringify(newEmployments));
        }
    };

    // The per-month `categories` aggregate, derived from that month's
    // transactions. Extracted so the per-row write path can produce exactly the
    // same numbers — sqliteWrites.js recomputes this server-side using the same
    // formula, and the two must not drift.
    const withRecomputedCategories = (updatedExpenses) => {
        const sanitizedExpenses = JSON.parse(JSON.stringify(updatedExpenses));
        Object.values(sanitizedExpenses).forEach(yearData => {
            Object.values(yearData).forEach(monthData => {
                if (!monthData.transactions) return;
                const newCategories = {};
                monthData.transactions.forEach(tx => {
                    if (!countsAsSpending(tx)) return;

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
        return sanitizedExpenses;
    };

    /**
     * Write a single transaction instead of the whole expenses collection.
     *
     * This is the fix for the lost-update problem: a whole-collection save is
     * built from one tab's snapshot, so whichever tab saves last erases the
     * other's rows. A per-row write touches only what changed.
     *
     * Returns 'saved' | 'unavailable' | { failed: reason }. 'unavailable' means
     * the server has per-row writes switched off (the default), and the caller
     * must fall back to saveExpenses — the app has to keep working either way.
     */
    const writeTransactionRow = async (method, { transaction, id, patch } = {}) => {
        if (isGuest) return { failed: 'Signed in as guest — nothing you enter is being saved.' };
        if (perRowWrites.current === false) return 'unavailable';

        const url = id ? `${API_URL}/api/tx/${encodeURIComponent(id)}` : `${API_URL}/api/tx`;
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                // A plain DELETE carries nothing, but the bulk category delete
                // needs its year/month/category in the body.
                body: (method === 'DELETE' && !patch)
                    ? undefined
                    : JSON.stringify(transaction ? { transaction } : (patch || {})),
            });

            // 503 is the server saying the feature is off; 404 means an older
            // server without the route. Neither is an error the user caused.
            if (res.status === 503 || res.status === 404) {
                perRowWrites.current = false;
                return 'unavailable';
            }
            if (!res.ok) {
                const info = await res.json().catch(() => ({}));
                return { failed: info.reason || info.error || `server returned ${res.status}` };
            }
            perRowWrites.current = true;
            return 'saved';
        } catch (err) {
            // Network or route problem: fall back rather than lose the entry.
            perRowWrites.current = false;
            return 'unavailable';
        }
    };

    const saveExpenses = async (updatedExpenses) => {
        const sanitizedExpenses = withRecomputedCategories(updatedExpenses);

        setExpenses(sanitizedExpenses);

        // A save that fails must never look like a save that worked. React state
        // has already been updated above, so the row is on screen either way —
        // if the write does not land, the only thing standing between the user
        // and silent data loss is this banner.
        if (isGuest) {
            setSaveError('Signed in as guest — nothing you enter is being saved. Sign in as admin and re-enter it.');
            return false;
        }
        try {
            const res = await fetch(`${API_URL}/expenses`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    // Only write on top of the version this tab actually read.
                    ...(expensesVersion.current ? { 'If-Match': expensesVersion.current } : {})
                },
                body: JSON.stringify(sanitizedExpenses)
            });

            if (res.status === 409) {
                const info = await res.json().catch(() => ({}));
                setSaveError(
                    info.reason
                    || 'Another tab saved first. Reload this page before saving, or your change would erase theirs.'
                );
                return false;
            }
            if (!res.ok) {
                const detail = await res.text().catch(() => '');
                throw new Error(`server returned ${res.status}. ${detail.slice(0, 300)}`);
            }

            expensesVersion.current = res.headers?.get?.('X-DB-Version') || null;
            setSaveError(null);
            return true;
        } catch (error) {
            console.error('Failed to save expenses:', error);
            setSaveError(`This did not save: ${error.message}. It is only on screen — do not reload until it is fixed.`);
            return false;
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
                method: 'PATCH',
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
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error("Failed to save category budgets:", error);
            localStorage.setItem('categoryBudgets', JSON.stringify(updatedBudgets));
        }
    };

    const mergedCategoryMap = useMemo(() => {
        const merged = { ...CATEGORY_MAP };
        
        // 1. Merge custom additions
        for (const [main, subs] of Object.entries(customCategoryMap)) {
            if (!merged[main]) {
                merged[main] = [...subs];
            } else {
                merged[main] = [...new Set([...merged[main], ...subs])];
            }
        }

        // 2. Filter out deleted categories / sub-categories
        const finalMap = {};
        const deletedSet = new Set(deletedCategories);

        for (const [main, subs] of Object.entries(merged)) {
            if (deletedSet.has(main)) continue;
            const validSubs = subs.filter(sub => !deletedSet.has(`${main}:${sub}`));
            finalMap[main] = validSubs;
        }

        return finalMap;
    }, [customCategoryMap, deletedCategories]);

    const saveCustomCategoryMap = async (newMap) => {
        setCustomCategoryMap(newMap);
        if (isGuest) return;

        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, customCategoryMap: newMap })
            });
        } catch (error) {
            console.error("Failed to save custom category map:", error);
        }
    };

    const deleteCategoryFromMap = async (mainCategory, subCategory = null) => {
        const itemToDelete = subCategory ? `${mainCategory}:${subCategory}` : mainCategory;
        const newDeletedList = deletedCategories.includes(itemToDelete)
            ? deletedCategories
            : [...deletedCategories, itemToDelete];

        const newCustomMap = { ...customCategoryMap };
        if (subCategory) {
            if (newCustomMap[mainCategory]) {
                newCustomMap[mainCategory] = newCustomMap[mainCategory].filter(s => s !== subCategory);
            }
        } else {
            delete newCustomMap[mainCategory];
        }

        setDeletedCategories(newDeletedList);
        setCustomCategoryMap(newCustomMap);

        if (isGuest) return;

        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...currentAppData, 
                    deletedCategories: newDeletedList,
                    customCategoryMap: newCustomMap
                })
            });
        } catch (error) {
            console.error("Failed to save category deletion:", error);
        }
    };

    const addCustomCategory = async (mainCategory, subCategory) => {
        if (isGuest) return;

        // If it was previously in deletedCategories, remove it from deleted list
        const itemKey = subCategory ? `${mainCategory}:${subCategory}` : mainCategory;
        const newDeletedList = deletedCategories.filter(item => item !== itemKey);
        if (newDeletedList.length !== deletedCategories.length) {
            setDeletedCategories(newDeletedList);
        }

        const newMap = { ...customCategoryMap };
        if (!newMap[mainCategory]) newMap[mainCategory] = [];
        
        if (subCategory) {
            const baseSubs = CATEGORY_MAP[mainCategory] || [];
            const allExisting = [...baseSubs, ...newMap[mainCategory]];
            const subExists = allExisting.some(s => s.toLowerCase() === subCategory.toLowerCase());
            if (!subExists) {
                newMap[mainCategory] = [...newMap[mainCategory], subCategory];
            }
        }

        setCustomCategoryMap(newMap);

        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...currentAppData, 
                    deletedCategories: newDeletedList,
                    customCategoryMap: newMap 
                })
            });
        } catch (error) {
            console.error("Failed to save custom category map:", error);
        }
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
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newExpenses)
                    });
                } catch (err) {
                    console.error("Failed to save updated transactions after category rename:", err);
                }
            }
        }
    };

    /**
     * Undo the side effects a deleted expense had elsewhere.
     *
     * Deleting an expense row is never just one write: a linked SIP also holds
     * units in a fund, and a bill payment also marks a card's statement paid.
     * Single and bulk deletes both come through here so they cannot diverge —
     * bulk delete previously did neither, leaving phantom units in a fund and
     * a card still showing as paid.
     *
     * Called only AFTER the expense delete has persisted. Unwinding first would
     * strip a holding while the transaction that paid for it still exists.
     * Returns a message when something did not unwind, never silence.
     */
    const unwindDeletedExpenses = async (rows) => {
        const problems = [];

        for (const tx of rows) {
            if (!tx?.investmentData) continue;
            const invError = await syncExpenseDeleteToInvestment(tx.investmentData, tx.id);
            if (invError) problems.push(invError);
        }

        // Cards are rebuilt from one working copy so two bill payments on the
        // same card cannot overwrite each other.
        const cardBills = rows.filter(tx =>
            ['credit card bill', 'credit card payment'].includes((tx?.category || '').toLowerCase())
            && tx.creditCardName
        );
        if (cardBills.length) {
            const working = new Map();
            const norm = (d) => (d || '').replace(/-/g, '/').split('/').map(p => p.padStart(2, '0')).join('-');

            cardBills.forEach((tx) => {
                const card = creditCards.find(c =>
                    (c.name || '').toLowerCase().trim() === tx.creditCardName.toLowerCase().trim()
                );
                if (!card) return;
                const key = String(card.id);
                if (!working.has(key)) {
                    working.set(key, { ...card, monthlyData: [...(card.monthlyData || [])] });
                }
                const updated = working.get(key);
                const at = updated.monthlyData.findIndex(m => {
                    if (!m.isPaid) return false;
                    return norm(m.paidDate) === norm(tx.date) || Number(m.billAmount) === Number(tx.amount);
                });
                if (at === -1) return;
                // A record the bill payment itself created is removed; a real
                // statement is only marked unpaid again.
                if (updated.monthlyData[at].points === 0
                    && String(updated.monthlyData[at].remarks || '').includes('Bill payment')) {
                    updated.monthlyData.splice(at, 1);
                } else {
                    updated.monthlyData[at] = {
                        ...updated.monthlyData[at],
                        isPaid: false,
                        paidDate: null,
                        remarks: (updated.monthlyData[at].remarks || '').replace(' (Paid)', '')
                    };
                }
            });

            for (const card of working.values()) {
                try {
                    const res = await fetch(`${API_URL}/creditCards/${card.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(card)
                    });
                    if (!res.ok) problems.push(`${card.name} (HTTP ${res.status})`);
                    else setCreditCards(prev => prev.map(c => (String(c.id) === String(card.id) ? card : c)));
                } catch (e) {
                    problems.push(`${card.name} (${e.message})`);
                }
            }
        }

        return problems.length ? `Not fully unwound: ${problems.join('; ')}` : null;
    };

    const bulkUpdateExpenses = async (updates) => {
        if (!updates || updates.length === 0) return;
        
        const newExpenses = JSON.parse(JSON.stringify(expenses));
        let changed = false;
        
        const updateMap = new Map();
        updates.forEach(u => updateMap.set(String(u.id), u.patch || u));

        Object.entries(newExpenses).forEach(([year, months]) => {
            Object.entries(months).forEach(([month, monthData]) => {
                if (monthData.transactions) {
                    monthData.transactions.forEach((tx, idx) => {
                        const patch = updateMap.get(String(tx.id));
                        if (patch) {
                            changed = true;
                            const updatedTx = { ...tx, ...patch };
                            if (patch.category) updatedTx.category = patch.category.toLowerCase();
                            monthData.transactions[idx] = updatedTx;
                            // The month's `categories` aggregate is not adjusted by
                            // hand here: withRecomputedCategories below rebuilds it
                            // from the transactions, so any arithmetic done at this
                            // point is discarded. One formula, one place.
                        }
                    });
                }
            });
        });

        if (changed) {
            const recomputed = withRecomputedCategories(newExpenses);
            setExpenses(recomputed);
            await saveExpenses(recomputed);
        }
    };

    const bulkDeleteExpenses = async (ids) => {
        if (!ids || ids.length === 0) return;
        const idSet = new Set(ids.map(id => String(id)));
        const newExpenses = JSON.parse(JSON.stringify(expenses));
        let changed = false;

        // Kept so their side effects can be undone once the delete has landed.
        // A deleted SIP still holds units in a fund and a deleted bill payment
        // still marks a statement paid; dropping the rows without these leaves
        // holdings nobody can trace back to anything.
        const removed = [];

        Object.entries(newExpenses).forEach(([year, months]) => {
            Object.entries(months).forEach(([month, monthData]) => {
                if (monthData.transactions) {
                    const remaining = [];
                    monthData.transactions.forEach(tx => {
                        if (idSet.has(String(tx.id))) {
                            changed = true;
                            removed.push(tx);
                        } else {
                            remaining.push(tx);
                        }
                    });
                    monthData.transactions = remaining;
                }
            });
        });

        if (!changed) return;

        const recomputed = withRecomputedCategories(newExpenses);
        setExpenses(recomputed);
        const saved = await saveExpenses(recomputed);

        // Only unwind what really went away. Doing it after the save means a
        // refused write leaves the holdings exactly as they were.
        if (saved) {
            const problem = await unwindDeletedExpenses(removed);
            if (problem) setSaveError(`${problem}. The transactions were deleted; these were not updated.`);
        }
    };


    const parseLocalDate = (dateStr) => {
        if (!dateStr) return new Date();
        if (dateStr instanceof Date) return dateStr;
        const parts = String(dateStr).split('T')[0].split('-').map(Number);
        if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        return new Date(dateStr);
    };

    const addItem = async (type, item) => {
        if (type === 'expense') {
            const dateObj = parseLocalDate(item.date);
            const year = dateObj.getFullYear().toString();
            const month = dateObj.toLocaleString('default', { month: 'long' });
            const amount = Number(item.amount) || 0;
            const category = (item.category || 'others').toLowerCase();

            // Check and add new category
            if (category && !categories.some(c => c.toLowerCase() === category)) {
                const newCategories = [...categories, category];
                setCategories(newCategories);

                try {
                    const res = await fetch(`${API_URL}/appData`);
                    const currentAppData = await res.json();
                    await fetch(`${API_URL}/appData`, {
                        method: 'PATCH',
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
            const newTransaction = {
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
            };
            monthData.transactions.push(newTransaction);

            // Prefer a per-row write: it cannot erase rows this tab never
            // loaded. Falls back to the whole-collection save when the server
            // has that path switched off, which is still the default.
            const rowResult = await writeTransactionRow('POST', { transaction: newTransaction });
            if (rowResult === 'saved') {
                // The server recomputed the month's categories with the same
                // formula, so mirroring it locally keeps the UI in step without
                // a second write.
                setExpenses(withRecomputedCategories(newExpenses));
                setSaveError(null);
            } else if (rowResult && rowResult.failed) {
                setExpenses(withRecomputedCategories(newExpenses));
                setSaveError(`This did not save: ${rowResult.failed}`);
            } else {
                await saveExpenses(newExpenses);
            }

            // Handle Investment Sync. The expense itself is already saved by
            // this point, so a failure here means the two pages disagree — that
            // has to reach the screen rather than the console.
            if (item.investmentData && !item.skipInvestmentSync) {
                const invError = await syncExpenseToInvestment(item.investmentData, item.date, item.title, expenseId);
                if (invError) setSaveError(`${invError}. The expense saved; the holding did not.`);
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

        let endpoint = type === 'savings' ? 'savings' : type === 'asset' ? 'assets' : type === 'lents' ? 'lents' : type === 'creditCards' ? 'creditCards' : type === 'salaryDetail' ? 'salaryDetails' : type === 'taxes' ? 'taxes' : type === 'goals' ? 'goals' : type === 'loans' ? 'loans' : type === 'ipoApplications' ? 'ipoApplications' : '';

        if (!endpoint) return;

        if (isGuest) {
            const savedItem = { ...item, id: Date.now().toString() };
            if (type === 'savings') setSavings(prev => [...prev, savedItem]);
            if (type === 'asset') setAssets(prev => [...prev, savedItem]);
            if (type === 'lents') setLents(prev => [...prev, savedItem]);
            if (type === 'creditCards') setCreditCards(prev => [...prev, savedItem]);
            if (type === 'salaryDetail') setSalaryDetails(prev => [...prev, savedItem]);
            if (type === 'taxes') setTaxes(prev => [...prev, savedItem]);
            if (type === 'goals') setGoals(prev => [...prev, savedItem]);
            if (type === 'ipoApplications') setIpoApplications(prev => [...prev, savedItem]);
            if (type === 'loans') setLoans(prev => [...prev, savedItem]);
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
            if (type === 'goals') setGoals(prev => [...prev, savedItem]);
            if (type === 'ipoApplications') setIpoApplications(prev => [...prev, savedItem]);
            if (type === 'loans') setLoans(prev => [...prev, savedItem]);
        } catch (error) {
            console.error("Error adding item:", error);
        }
    };

    /**
     * Push an expense row's investment legs into the savings collection.
     *
     * One expense can fund several holdings — a single ₹5,000 debit leaving the
     * bank is often five SIPs — so this takes a list of legs, not one asset.
     * Create, edit and delete all come through here, because all three have to
     * do the same work: remove whatever this expense previously wrote, add
     * whatever it says now, recompute each touched holding with the shared
     * formula, and persist.
     *
     * Two details that look incidental and are not:
     *
     *  - Every affected savings row is collected and mutated on ONE working
     *    snapshot before anything is written. Two SIPs into the same fund live
     *    in the same row; issuing two sequential PUTs each built from the
     *    original snapshot would silently discard the first.
     *  - Rows that used to carry legs for this expense are cleaned even when
     *    they are absent from the new list, so editing a split from two funds
     *    down to one does not strand units in the fund that was dropped.
     *
     * Returns null on success, or a message naming what failed to save. It must
     * never return null for a write that did not happen — a silent failure here
     * is how the two pages drift apart in the first place.
     */
    const applyInvestmentLegs = async (legs, { expenseId, date, title, remove }) => {
        if (isGuest) return null;
        const wanted = remove ? [] : (legs || []);

        // One deep-cloned snapshot per savings row, so legs compose onto each
        // other. Whatever this expense wrote previously is stripped once, when
        // the row is first touched — never per leg. Filtering per leg would make
        // the second SIP into a fund delete the first, since both legs match the
        // same expense id. That is a silent half-save, so it is tested.
        const working = new Map();
        const rowFor = (rowId) => {
            const key = String(rowId);
            if (!working.has(key)) {
                const row = savings.find(s => String(s.id) === key);
                const clone = row ? JSON.parse(JSON.stringify(row)) : null;
                if (clone && clone.type === 'mutual_fund') {
                    clone.transactions = detachExpense(clone.transactions, expenseId);
                } else if (clone && clone.type === 'stock_market') {
                    (clone.stocks || []).forEach((st) => {
                        st.transactions = detachExpense(st.transactions, expenseId);
                    });
                }
                working.set(key, clone);
            }
            return working.get(key);
        };

        // Pull in every row that already holds legs from this expense, so a leg
        // that was moved or deleted gets cleaned up rather than left behind.
        savings.forEach((row) => {
            if (row.type === 'mutual_fund') {
                if ((row.transactions || []).some(t => belongsToExpense(t, expenseId))) rowFor(row.id);
            } else if (row.type === 'stock_market') {
                if ((row.stocks || []).some(st => (st.transactions || []).some(t => belongsToExpense(t, expenseId)))) rowFor(row.id);
            }
        });

        const problems = [];

        // Adopt before creating. The investment pages hold the more accurate
        // record, so the purchase this expense describes is usually already
        // there; pushing a second copy would double the position.
        const attachLeg = (txList, leg, index) => {
            const existing = findAdoptable(txList, leg, date, expenseId);
            if (existing) {
                const at = txList.indexOf(existing);
                txList[at] = adoptTransaction(existing, expenseId);
                return;
            }
            txList.push(legToInvestmentTx(leg, { expenseId, index, date, title }));
        };

        wanted.forEach((leg, index) => {
            if (leg.assetType === 'stock') {
                const [marketId, stockId] = String(leg.assetId).split('|');
                const market = rowFor(marketId);
                const stock = market && (market.stocks || []).find(s => String(s.id) === String(stockId));
                if (!stock) { problems.push(`stock ${leg.assetId} no longer exists`); return; }
                attachLeg(stock.transactions, leg, index);
            } else {
                const fund = rowFor(leg.assetId);
                if (!fund) { problems.push(`fund ${leg.assetId} no longer exists`); return; }
                attachLeg(fund.transactions, leg, index);
            }
        });

        // Recompute every touched holding once, after all legs have landed.
        working.forEach((row) => {
            if (!row) return;
            if (row.type === 'mutual_fund') {
                row.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
                row.amount = recomputeFundAmount(row, row.transactions);
            } else if (row.type === 'stock_market') {
                (row.stocks || []).forEach((st) => {
                    const { shares, avgCost, dividends } = recomputeStockMetrics(st.transactions || []);
                    st.shares = shares;
                    st.avgCost = avgCost;
                    st.dividends = dividends;
                });
            }
        });

        const rows = [...working.values()].filter(Boolean);
        if (!rows.length) return problems.length ? problems.join('; ') : null;

        // Per-item paths: json-server stores these correctly, so no PATCH merge
        // is involved. A non-2xx here is a real refusal (the guard answers 409)
        // and has to be reported, not just logged.
        const failed = [];
        for (const row of rows) {
            try {
                const res = await fetch(`${API_URL}/savings/${row.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(row)
                });
                if (!res.ok) failed.push(`${row.title || row.id} (HTTP ${res.status})`);
            } catch (e) {
                failed.push(`${row.title || row.id} (${e.message})`);
            }
        }

        // Only reflect rows that actually persisted, so the screen cannot show
        // a holding the database does not have.
        const savedIds = new Set(
            rows.filter(r => !failed.some(f => f.startsWith(`${r.title || r.id} `))).map(r => String(r.id))
        );
        if (savedIds.size) {
            setSavings(prev => prev.map(s => (
                savedIds.has(String(s.id)) ? rows.find(r => String(r.id) === String(s.id)) : s
            )));
        }

        const all = [...problems, ...failed];
        return all.length ? `Investment not updated: ${all.join('; ')}` : null;
    };

    /** Mirror an expense row's legs into the investment pages. */
    const syncExpenseToInvestment = async (invData, date, title, expenseId) => (
        applyInvestmentLegs(normaliseLegs(invData), { expenseId, date, title, remove: false })
    );

    /** Remove everything an expense row wrote into the investment pages. */
    const syncExpenseDeleteToInvestment = async (invData, expenseId) => (
        applyInvestmentLegs(normaliseLegs(invData), { expenseId, remove: true })
    );

    /**
     * Persist a single metal category (gold, silver, ...).
     * PATCH sends only the category that changed, so editing a gold item can no
     * longer rewrite — or lose — the silver array. A whole-collection PUT here
     * is what previously reverted uploaded item images across every category.
     */
    const saveMetalCategory = async (type, items) => {
        if (isGuest || !canWrite()) return;

        // Refuse to write anything but a known category holding an array.
        // A bad call once wrote the entire metals object under a stray key,
        // which nested the real categories out of reach on every save.
        if (!METAL_CATEGORIES.includes(type) || !Array.isArray(items)) {
            console.error(`[FinanceContext] Refusing to save metals: type "${type}" is not a known category, or the payload is not an array.`);
            return;
        }
        try {
            const res = await fetch(`${API_URL}/metals`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [type]: items })
            });
            if (!res.ok) {
                const detail = await res.json().catch(() => ({}));
                console.error(`[FinanceContext] Save of metals.${type} was rejected:`, detail.reason || res.status);
            }
        } catch (error) {
            console.error(`Error saving metals.${type}:`, error);
        }
    };

    const addMetal = async (type, item) => {
        const newItem = { ...item, id: Date.now() };
        const nextItems = [...(metals[type] || []), newItem];
        setMetals({ ...metals, [type]: nextItems });
        await saveMetalCategory(type, nextItems);
    };

    const updateMetal = async (type, item) => {
        const nextItems = (metals[type] || []).map(i => i.id === item.id ? item : i);
        setMetals({ ...metals, [type]: nextItems });
        await saveMetalCategory(type, nextItems);
    };

    const deleteMetal = async (type, id) => {
        const nextItems = (metals[type] || []).filter(i => i.id !== id);
        setMetals({ ...metals, [type]: nextItems });
        await saveMetalCategory(type, nextItems);
    };

    const deleteItem = async (type, id) => {
        if (type === 'expense') {
            const newExpenses = { ...expenses };
            // Individual transaction delete
            if (id) {
                let found = false;
                // The row itself, kept so its side effects can be undone once
                // the delete has persisted. Shared with the bulk path.
                let removedRow = null;
                outer: for (const year of Object.keys(newExpenses)) {
                    for (const mth of Object.keys(newExpenses[year] || {})) {
                        const mData = newExpenses[year][mth];
                        if (!mData?.transactions) continue;
                        const txIndex = mData.transactions.findIndex(t => String(t.id) === String(id));
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

                        // Held until the expense delete has actually persisted.
                        // Unwinding first would strip units from a fund while the
                        // transaction that paid for them survives.
                        removedRow = tx;

                        monthData.transactions.splice(txIndex, 1);
                        found = true;
                        break outer;
                    }
                }
                if (found) {
                    // Per-row delete removes one row instead of replacing the
                    // whole collection, so a concurrent edit in another tab
                    // survives. Falls back when the server has it switched off.
                    const rowResult = await writeTransactionRow('DELETE', { id });
                    let deleted = true;
                    if (rowResult === 'saved') {
                        setExpenses(withRecomputedCategories(newExpenses));
                        setSaveError(null);
                    } else if (rowResult && rowResult.failed) {
                        setExpenses(withRecomputedCategories(newExpenses));
                        setSaveError(`This delete did not save: ${rowResult.failed}`);
                        deleted = false;
                    } else {
                        await saveExpenses(newExpenses);
                    }

                    // Only now unwind, and only if the expense really went away.
                    if (deleted && removedRow) {
                        const problem = await unwindDeletedExpenses([removedRow]);
                        if (problem) setSaveError(`${problem}. The expense was deleted; these were not updated.`);
                    }
                }
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

                    // Removing a whole category is many rows, so it goes as one
                    // bulk statement rather than N per-row calls — each of those
                    // would rebuild and rewrite the entire database.
                    const rowResult = await writeTransactionRow('DELETE', {
                        id: 'by-category',
                        patch: { year, month, category: catName },
                    });
                    if (rowResult === 'saved') {
                        setExpenses(withRecomputedCategories(newExpenses));
                        setSaveError(null);
                    } else if (rowResult && rowResult.failed) {
                        setExpenses(withRecomputedCategories(newExpenses));
                        setSaveError(`This delete did not save: ${rowResult.failed}`);
                    } else {
                        await saveExpenses(newExpenses);
                    }
                }
            }
            return;
        }

        let endpoint = type === 'savings' ? 'savings' : type === 'asset' ? 'assets' : type === 'lents' ? 'lents' : type === 'creditCards' ? 'creditCards' : type === 'salaryDetail' ? 'salaryDetails' : type === 'taxes' ? 'taxes' : type === 'goals' ? 'goals' : type === 'loans' ? 'loans' : type === 'ipoApplications' ? 'ipoApplications' : '';
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
            if (type === 'goals') setGoals(prev => prev.filter(i => String(i.id) !== String(id)));
            if (type === 'ipoApplications') setIpoApplications(prev => prev.filter(i => String(i.id) !== String(id)));
            if (type === 'loans') setLoans(prev => prev.filter(i => String(i.id) !== String(id)));
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
            // Platinum has no live rate feed, so its value is whatever was
            // entered manually on the item.
            platinum: metals.platinum || [],
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
                // Accrued as of today, not the `currentValue` frozen at the last
                // save — that field is only right on the day it was written.
                return totalAccruedValue(item.deposits);

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
                    let lastTxNav = 0;
                    if (h.transactions && h.transactions.length > 0) {
                        const txWithNav = [...h.transactions].reverse().find(t => Number(t.nav || 0) > 0);
                        if (txWithNav) lastTxNav = Number(txWithNav.nav);
                    }
                    const nav = Number(h.nav || h.currentPrice || lastTxNav || 0);
                    let units = 0;
                    if (h.transactions && h.transactions.length > 0) {
                        units = h.transactions.reduce((acc, tx) => acc + Number(tx.units || 0), 0);
                    } else {
                        units = Number(h.totalunits !== undefined ? h.totalunits : (h.totalUnits !== undefined ? h.totalUnits : (h.units || 0)));
                    }
                    return sum + (units * nav);
                }, 0) || Number(item.amount || 0);

            case 'sgb':
                // Via readHolding, because the stored shape and the shape the UI
                // uses disagree on three field names (see utils/sgb.js).
                return (item.holdings || []).reduce((sum, h) => {
                    const holding = readSgbHolding(h);
                    return sum + (holding.units * holding.currentPrice);
                }, 0);

            case 'policy':
            case 'Policy':
                // Protection-only cover returns nothing at maturity, so its
                // premiums are an expense, not savings. Counting them inflated
                // net worth with motor and term policies that hold no value.
                if (isProtectionOnlyPolicy(item)) return 0;
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
                // Same archived rule as the value side, or an archived deposit
                // would count as cost with no matching value and show as a loss.
                return totalPrincipal(item.deposits);

            case 'recurring_deposit':
                return (item.recurringDeposits || []).reduce((sum, rd) => sum + (rd.installments || []).reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0), 0);

            case 'ppf':
                // Rows carry `amount`, never `deposit`, so this summed nothing and
                // the balance read as 100% gain. Interest rows are excluded the
                // same way the pf case does it; they also carry amount 0, but
                // relying on that would break the day one is entered properly.
                return (item.details || []).reduce(
                    (sum, d) => sum + (String(d.type).toLowerCase() === 'interest' ? 0 : Number(d.amount || 0)),
                    0
                );

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
                // The cost side read `issuePrice`, which no stored holding has —
                // it is `purchasePrice` on disk. Invested came out as zero, so
                // the whole current value showed as pure profit.
                return (item.holdings || []).reduce((sum, h) => {
                    const holding = readSgbHolding(h);
                    return sum + (holding.units * holding.issuePrice);
                }, 0);

            default:
                return Number(item.investedAmount || item.amount || 0);
        }
    };

    const updateItem = async (type, item) => {
        if (type === 'expense') {
            const newExpenses = { ...expenses };
            const dateObj = parseLocalDate(item.date);
            const newYear = dateObj.getFullYear().toString();
            const newMonth = dateObj.toLocaleString('default', { month: 'long' });
            const newCategory = item.category;
            const newAmount = Number(item.amount) || 0;

            if (item.id) {
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
                    // Set by whichever branch below applies the edit, then sent
                    // as a per-row patch instead of the whole collection.
                    let mergedTransaction = null;
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
                        mergedTransaction = { ...oldTx, ...item, amount: newAmount, category: newCategory, deductFromSalary: item.deductFromSalary };
                        newMonthData.transactions.push(mergedTransaction);

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

                        mergedTransaction = { ...oldTx, ...item, amount: newAmount, category: newCategory, deductFromSalary: item.deductFromSalary, investmentData: item.investmentData || null };
                        oldMonthData.transactions[txIndex] = mergedTransaction;
                    }

                    // Per-row update. The server merges the patch onto the
                    // stored row and moves it to another month bucket itself if
                    // the date changed, so sending the merged object is enough.
                    const rowResult = mergedTransaction
                        ? await writeTransactionRow('PATCH', { id: oldTx.id, patch: mergedTransaction })
                        : 'unavailable';
                    if (rowResult === 'saved') {
                        setExpenses(withRecomputedCategories(newExpenses));
                        setSaveError(null);
                    } else if (rowResult && rowResult.failed) {
                        setExpenses(withRecomputedCategories(newExpenses));
                        setSaveError(`This edit did not save: ${rowResult.failed}`);
                    } else {
                        await saveExpenses(newExpenses);
                    }
                    
                    // Handle Investment Sync on Edit. Applying the new legs also
                    // clears the old ones, so the delete is only needed when the
                    // edit removed the investment link altogether.
                    if (!item.skipInvestmentSync) {
                        let invError = null;
                        if (item.investmentData) {
                            invError = await syncExpenseToInvestment(item.investmentData, item.date, item.title, item.id);
                        } else if (oldTx.investmentData) {
                            invError = await syncExpenseDeleteToInvestment(oldTx.investmentData, oldTx.id);
                        }
                        if (invError) setSaveError(`${invError}. The expense saved; the holding did not.`);
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

        let endpoint = type === 'savings' ? 'savings' : type === 'asset' ? 'assets' : type === 'lents' ? 'lents' : type === 'creditCards' ? 'creditCards' : type === 'salaryDetail' ? 'salaryDetails' : type === 'taxes' ? 'taxes' : type === 'goals' ? 'goals' : type === 'loans' ? 'loans' : type === 'ipoApplications' ? 'ipoApplications' : '';
        if (!endpoint || !item.id) return;
        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/${endpoint}/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            // A refused write must never look like one that worked. Without this
            // check a 409 from the guard was parsed as if it were the saved
            // record and written straight into state, so the row on screen
            // silently became `{error, reason}` and the function still reported
            // success. The guard is only half a safeguard if its refusal is
            // invisible — see §2 of CLAUDE.md.
            if (!res.ok) {
                const info = await res.json().catch(() => ({}));
                const detail = info.reason || info.error || `server returned ${res.status}`;
                setSaveError(
                    res.status === 409
                        ? `${detail} Nothing was saved — reload before trying again.`
                        : `This did not save: ${detail}. It is only on screen — do not reload until it is fixed.`
                );
                return { success: false, reason: detail };
            }

            const updatedItem = await res.json();
            setSaveError(null);
            if (type === 'savings') setSavings(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            if (type === 'asset') setAssets(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            if (type === 'lents') setLents(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            if (type === 'creditCards') setCreditCards(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            if (type === 'salaryDetail') setSalaryDetails(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            if (type === 'taxes') setTaxes(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            if (type === 'goals') setGoals(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            if (type === 'ipoApplications') setIpoApplications(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            if (type === 'loans') setLoans(prev => prev.map(i => String(i.id) === String(item.id) ? updatedItem : i));
            return { success: true };
        } catch (error) {
            console.error("Error updating item:", error);
            setSaveError(`This did not save: ${error.message}. It is only on screen — do not reload until it is fixed.`);
            return { success: false, reason: error.message };
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
                method: 'PATCH',
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
            // One request to our own proxy instead of one per stock through a
            // public CORS relay. That relay (api.allorigins.win) began returning
            // 500 for every ticker, and because each failure fell back to the
            // stored price, a total outage looked exactly like a successful
            // refresh. Failures are now named and surfaced.
            const refreshable = initialMarket.stocks.filter(s => s && s.ticker && !s.isArchived);
            const symbolFor = (stock) => (stock.ticker.includes('.') ? stock.ticker : `${stock.ticker}.NS`);
            const symbols = refreshable.map(symbolFor);

            const quoteRes = await fetch(`${API_URL}/api/quote?symbols=${encodeURIComponent(symbols.join(','))}`);
            if (!quoteRes.ok) throw new Error(`quote service returned ${quoteRes.status}`);
            const { quotes = {}, failed = [] } = await quoteRes.json();

            const updated = [];
            const notUpdated = [];
            refreshable.forEach((stock) => {
                const price = quotes[symbolFor(stock)];
                if (typeof price === 'number' && price > 0) {
                    updated.push({ id: stock.id, currentPrice: price });
                } else {
                    notUpdated.push(stock.name || stock.ticker);
                }
            });

            if (updated.length === 0) {
                const why = failed.length > 0
                    ? `no price came back for any of ${failed.length} symbols`
                    : 'no prices were returned';
                setSaveError(`Prices could not be refreshed: ${why}. The figures on screen are unchanged, not current.`);
                return { success: false, message: 'No prices were returned — nothing was changed.' };
            }

            const updatedStockPrices = updated;

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

            // 4. Save the merged result, stamped with when the prices were
            // actually fetched. Without it there is no way to tell a price
            // pulled a minute ago from one that has been sitting there for
            // weeks — they render identically.
            const finalMarket = {
                ...latestMarket,
                stocks: mergedStocks,
                pricesUpdatedAt: new Date().toISOString(),
            };

            // We use updateItem here which updates local state and sends PUT to server
            // But since we already have the latest object and just want to save it, 
            // calling updateItem acts as the "Save" step. 
            // NOTE: updateItem calculates 'savings' state update based on previous state in setter,
            // which is good. But we should pass the object that INCLUDES the changes we just found 
            // (which might include other user added stocks) + our price updates.

            await updateItem('savings', finalMarket);

            if (notUpdated.length > 0) {
                // Partial success is still a partial failure, and the holdings
                // that kept a stale price have to be named — otherwise the page
                // shows old numbers beside new ones with nothing to tell them apart.
                setSaveError(
                    `Updated ${updated.length} of ${refreshable.length} prices. No quote for: `
                    + `${notUpdated.slice(0, 6).join(', ')}${notUpdated.length > 6 ? ` and ${notUpdated.length - 6} more` : ''}`
                    + ' — those still show their previous price.'
                );
            }

            return {
                success: true,
                updated: updated.length,
                total: refreshable.length,
                notUpdated,
            };
        } catch (error) {
            console.error("Error refreshing stock prices:", error);
            setSaveError(`Prices could not be refreshed: ${error.message}. The figures on screen are unchanged, not current.`);
            return { success: false, message: `Refresh failed: ${error.message}` };
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

    const updateInsuranceProfile = async (profile) => {
        setInsuranceProfile(profile);
        if (isGuest) return;
        try {
            const res = await fetch(`${API_URL}/appData`);
            const currentAppData = await res.json();
            await fetch(`${API_URL}/appData`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...currentAppData, insuranceProfile: profile })
            });
        } catch (error) {
            console.error('Error updating insurance profile:', error);
        }
    };

    /**
     * Persist the wallet auto-credit rows that the loader computed in memory.
     * This is deliberately manual: it rewrites the whole expense tree, so it
     * should happen when the user asks for it, not silently on every boot.
     */
    const applyWalletAutoCredits = async () => {
        if (isGuest || !pendingWalletCredits) return { applied: false };
        try {
            const res = await fetch(`${API_URL}/expenses`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expenses)
            });
            if (!res.ok) {
                // The SafetyGuard proxy rejects writes that would lose records.
                const detail = await res.json().catch(() => ({}));
                console.error('[FinanceContext] Wallet auto-credit save was rejected:', detail.reason || res.status);
                return { applied: false, reason: detail.reason || `HTTP ${res.status}` };
            }
            setPendingWalletCredits(false);
            return { applied: true };
        } catch (error) {
            console.error('[FinanceContext] Failed to apply wallet auto-credits:', error);
            return { applied: false, reason: error.message };
        }
    };

    const value = {
        expenses, savings, metals: processedMetals, assets, creditCards, lents, taxes, salaryStats, categories, snapshots, categoryBudgets, salaryDetails, categoryRules,
        recurringOverrides, saveRecurringOverrides,
        goals, loans, ipoApplications, insuranceProfile,
        pendingWalletCredits, applyWalletAutoCredits,
        loadError,
        addItem, addMetal, deleteItem, deleteMetal, updateItem, updateMetal, saveExpenses, updateCategoryRules,
        addNewYear, takeSnapshot, updateCategoryBudget, saveCategoryBudgets,
        formatCurrency,
        formatNumber,
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
        updateInsuranceProfile,
        mergedCategoryMap,
        addCustomCategory,
        saveCustomCategoryMap,
        deleteCategoryFromMap,
        renameCategoryInTransactions,
        bulkUpdateExpenses,
        bulkDeleteExpenses,
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
        saveError,
        dismissSaveError: () => setSaveError(null),
        isLoading
    };

    return (
        <FinanceContext.Provider value={value}>
            {(saveError || loadError) && (
                <div
                    role="alert"
                    className="fixed inset-x-0 top-0 z-[100] bg-rose-600 text-white px-4 py-3 shadow-lg shadow-rose-900/40"
                >
                    <div className="max-w-4xl mx-auto flex items-start gap-3">
                        <span className="font-black text-sm shrink-0">NOT SAVED</span>
                        <p className="text-xs font-medium leading-relaxed flex-1">
                            {saveError || `Could not load your data (${loadError}). Nothing you enter now will be saved.`}
                        </p>
                        {saveError && (
                            <button
                                onClick={() => setSaveError(null)}
                                className="shrink-0 text-xs font-bold underline underline-offset-2 hover:opacity-80"
                            >
                                Dismiss
                            </button>
                        )}
                    </div>
                </div>
            )}
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
