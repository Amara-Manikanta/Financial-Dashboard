import React from 'react';

/**
 * Custom PNG icons that need to drop into the same slots lucide-react icons
 * do — `<NavItem icon={X} />` and `<X size={18} />` both call the icon as a
 * component and pass `size`, so each of these matches that shape rather than
 * being rendered as a plain `<img>` at the call site.
 *
 * Source images live in public/icons/, alongside the existing goal icons
 * (see utils/goalIcons.jsx) — root-relative so they work the same whether
 * served by Vite or by the packaged Electron app's static server.
 */
export const SalaryIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/salary.png"
        alt="Salary"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const TaxIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/tax.png"
        alt="Tax"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const FinancialGoalsIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/goals.png"
        alt="Financial Goals"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const GoalIcon = FinancialGoalsIcon;

export const ExpensesIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/expenses.png"
        alt="Expenses"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const TransactionsIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/transactions.png"
        alt="Transactions"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const MoneyFlowIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/money_flow.png"
        alt="Money Flow"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const CardsIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/cards.png"
        alt="Cards"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const FuelIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/fuel.png"
        alt="Fuel"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const GroceryIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/grocery.png"
        alt="Grocery"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const DataHealthIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/data_health.png"
        alt="Data Health"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const SavingsIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/savings.png"
        alt="Savings"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const NpsIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/nps.png"
        alt="NPS"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const RetirementIcon = NpsIcon;

export const DepositIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/deposit.png"
        alt="Deposit"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const FixedDepositIcon = DepositIcon;
export const RecurringDepositIcon = DepositIcon;

export const PfIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/pf.png"
        alt="PF / Pension"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const PensionIcon = PfIcon;

export const GratuityIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/gratuity.png"
        alt="Gratuity"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const StockMarketIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/stock_market.png"
        alt="Stock Market"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const StocksIcon = StockMarketIcon;

export const KuberaIcon = ({ size = 24, className = '', style = {} }) => (
    <img
        src="/icons/kubera.png"
        alt="Kubera"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', ...style }}
    />
);

export const AppLogo = KuberaIcon;
