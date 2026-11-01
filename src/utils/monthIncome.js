/**
 * One month's income, counted the same way wherever it is shown.
 *
 * The Expenses list and the month page used to disagree: the list counted only
 * rows categorised salary/income (via `calculateSalaryStats`), while the month
 * page counted every income-type row. A ₹41,520 ITR refund filed under the
 * Income main category therefore made the same month read ₹33,510 left on one
 * screen and -₹8,010 on the other. This is the single copy of the month page's
 * rule; the list and the iPhone app (`MonthCategories` in Swift) use it too.
 */

const KNOWN_INCOME_CATS = [
    'salary received', 'salary', 'income', 'bonus', 'freelance',
    'interest income', 'bank interest', 'dividend', 'stocks sell',
    'company claims', 'rental income', 'mutual fund redemption', 'other income',
];

/** A row counts as income when filed under the Income main category or a known income category. */
export const isIncomeTx = (t) => {
    if (!t) return false;
    const cat = (t.category || '').toLowerCase();
    const mainCat = (t.mainCategory || '').toLowerCase();
    if (mainCat === 'income') return true;
    return KNOWN_INCOME_CATS.some((k) => cat === k || cat.startsWith(k));
};

/**
 * Income of one month node.
 *
 * Every income row counts, by category. When no row is a salary, the month's
 * configured salary (payslip, or the legacy category total) is added so a
 * month with only a payslip is not shown as having no income.
 *
 * @param monthData        `expenses[year][month]`
 * @param configuredSalary `salaryStats[year].months[month]`, or 0
 * @returns {{ incomeTotals: Object<string, number>, total: number }}
 */
export const monthIncome = (monthData, configuredSalary = 0) => {
    const data = monthData || {};
    const categories = data.categories || data;
    const incomeTotals = {};
    let total = 0;

    (data.transactions || []).forEach((t) => {
        if (isIncomeTx(t)) {
            const catName = t.category || 'Salary';
            const amt = Number(t.amount) || 0;
            incomeTotals[catName] = (incomeTotals[catName] || 0) + amt;
            total += amt;
        }
    });

    const findSalary = (obj) => {
        if (!obj) return 0;
        const key = Object.keys(obj).find((k) => ['salary received', 'salary', 'income'].includes(k.toLowerCase()));
        return key ? Number(obj[key]) : 0;
    };

    let base = Number(configuredSalary) || 0;
    if (base === 0) {
        base = findSalary(categories);
        if (base === 0 && data['salary received']) base = Number(data['salary received']);
    }

    const hasSalary = Object.keys(incomeTotals).some((k) => ['salary received', 'salary'].includes(k.toLowerCase()));
    if (!hasSalary && base > 0) {
        incomeTotals.Salary = base;
        total += base;
    }
    return { incomeTotals, total };
};
