import { Briefcase, Compass, Coins, Car, BarChart3, ShieldCheck, Gauge, CalendarClock, Repeat, FolderCheck, Image as ImageIcon, ArrowUpRight } from 'lucide-react';
import { SalaryIcon, TaxIcon, FinancialGoalsIcon, ExpensesIcon, TransactionsIcon, MoneyFlowIcon, CardsIcon, FuelIcon, GroceryIcon, DataHealthIcon } from '../utils/customIcons';

/**
 * Every grouped destination in the app, in one place. The desktop header turns
 * each group into a dropdown and the phone's "More" sheet lists them all, so a
 * page added here shows up in both. Top-level items (Dashboard, Savings,
 * Investments, Loans & Lents) are listed separately because the desktop bar
 * renders them as plain links rather than menus.
 */
export const NAV_GROUPS = [
    {
        key: 'income', label: 'Income', icon: Briefcase,
        items: [
            { to: '/salary', label: 'Salary', icon: SalaryIcon },
            { to: '/taxes', label: 'Taxes', icon: TaxIcon },
        ],
    },
    {
        key: 'planning', label: 'Planning', icon: Compass,
        items: [
            { to: '/goals', label: 'Financial Goals', icon: FinancialGoalsIcon },
            { to: '/insurance-analysis', label: 'Insurance Gap Analysis', icon: ShieldCheck },
            { to: '/docusetu', label: 'DocuSetu — Documents & Claims', icon: FolderCheck },
            { to: '/cashflow', label: 'Cashflow Forecast', icon: CalendarClock },
            { to: '/net-worth', label: 'Net Worth Over Time', icon: BarChart3 },
        ],
    },
    {
        key: 'expenses', label: 'Expenses', icon: ExpensesIcon,
        items: [
            { to: '/expenses', label: 'All Expenses', icon: ExpensesIcon },
            { to: '/all-transactions', label: 'All Transactions', icon: TransactionsIcon },
            { to: '/money-flow', label: 'Money Flow', icon: MoneyFlowIcon },
            { to: '/analytics', label: 'Spending Analysis', icon: BarChart3 },
            { to: '/credit-cards', label: 'Cards', icon: CardsIcon },
            { to: '/credit-cards/intelligence', label: 'Card Intelligence', icon: Gauge },
            { to: '/category-budgets', label: 'Budget Limits', icon: FinancialGoalsIcon },
            { to: '/recurring', label: 'Recurring & Subscriptions', icon: Repeat },
            { to: '/fuel', label: 'Fuel Analytics', icon: FuelIcon },
            { to: '/grocery-analytics', label: 'Grocery Analytics', icon: GroceryIcon },
            { to: '/grocery-master-list', label: 'Grocery Builder', icon: GroceryIcon },
            { to: '/data-health', label: 'Data Health', icon: DataHealthIcon },
        ],
    },
    {
        key: 'metals', label: 'Gold & Silver', icon: Coins,
        items: [
            { to: '/metals', label: 'All Metals', icon: Coins },
            { to: '/metals/gallery', label: 'Ornament Gallery', icon: ImageIcon },
        ],
    },
    {
        key: 'assets', label: 'Assets', icon: Car,
        items: [
            { to: '/assets', label: 'All Assets', icon: Car },
            { to: '/warranties', label: 'Warranties & Receipts', icon: ShieldCheck },
        ],
    },
];

export const NAV_LOANS = { to: '/lents-loans', label: 'Loans & Lents', icon: ArrowUpRight };
