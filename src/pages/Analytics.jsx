import React, { useMemo, useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ArrowLeft, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Analytics = () => {
    const { expenses, formatCurrency, snapshots, takeSnapshot } = useFinance();
    const navigate = useNavigate();

    const [selectedYear, setSelectedYear] = useState('All');
    const [selectedMonth, setSelectedMonth] = useState('All');

    // New state for the second plot
    const [trendYear, setTrendYear] = useState(new Date().getFullYear().toString());
    const [trendCategory, setTrendCategory] = useState('');
    const [ccTrendYear, setCcTrendYear] = useState(new Date().getFullYear().toString());

    const flattenedExpenses = useMemo(() => {
        const flat = [];
        if (!expenses || typeof expenses !== 'object') return flat;

        Object.entries(expenses).forEach(([year, months]) => {
            if (typeof months !== 'object') return;
            Object.entries(months).forEach(([month, data]) => {
                if (!data) return;

                // Aggregation bucket for this month
                const monthlyCategories = {};
                const transactions = data.transactions || [];

                if (transactions.length > 0) {
                    // Aggregate from transactions (Includes Tax/Gross expenses)
                    transactions.forEach(t => {
                        const cat = t.category || 'others';
                        if (['salary received', 'income'].includes(cat.toLowerCase())) return;

                        const amt = Number(t.amount) || 0;
                        const effective = t.isCredited ? -amt : amt; // Expense is positive

                        monthlyCategories[cat] = (monthlyCategories[cat] || 0) + effective;
                    });
                } else {
                    // Fallback to categories map
                    const categories = data.categories || data;
                    if (typeof categories === 'object' && !Array.isArray(categories)) {
                        Object.entries(categories).forEach(([title, amount]) => {
                            if (title !== 'salary received' && title !== 'income' && title !== 'transactions') {
                                monthlyCategories[title] = Number(amount) || 0;
                            }
                        });
                    }
                }

                // Push to flat array
                Object.entries(monthlyCategories).forEach(([title, amount]) => {
                    flat.push({
                        title,
                        amount,
                        date: new Date(`${month} 1, ${year}`),
                        year,
                        month
                    });
                });
            });
        });
        return flat;
    }, [expenses]);

    // Extract available years
    const availableYears = useMemo(() => {
        if (!expenses || typeof expenses !== 'object') return [];
        return Object.keys(expenses).sort((a, b) => b - a);
    }, [expenses]);

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Extract all unique categories
    const allCategories = useMemo(() => {
        const categories = new Set(flattenedExpenses.map(item => item.title));
        return Array.from(categories).sort();
    }, [flattenedExpenses]);

    // Initialize trendCategory
    useEffect(() => {
        if (allCategories.length > 0 && !trendCategory) {
            setTrendCategory(allCategories[0]);
        }
    }, [allCategories, trendCategory]);

    // Data for the first plot (Monthly Expenses / Category Breakdown)
    const isSpecificMonthSelected = selectedYear !== 'All' && selectedMonth !== 'All';

    const data = useMemo(() => {
        const groups = {};

        flattenedExpenses.forEach(item => {
            const date = item.date;
            const year = date.getFullYear();
            const monthIndex = date.getMonth();
            const monthName = date.toLocaleString('default', { month: 'short' });

            // Filter logic
            if (selectedYear !== 'All' && year !== parseInt(selectedYear)) return;
            if (selectedMonth !== 'All' && monthIndex !== parseInt(selectedMonth)) return;

            let key, sortKey;

            if (isSpecificMonthSelected) {
                // Group by Category
                key = item.title;
            } else {
                // Group by Month Year
                key = `${monthName} ${year}`;
                sortKey = date.getTime();
            }

            if (!groups[key]) {
                groups[key] = {
                    name: key,
                    amount: 0,
                    sortKey: sortKey
                };
            }
            groups[key].amount += item.amount;
        });

        let result = Object.values(groups);

        if (isSpecificMonthSelected) {
            return result.sort((a, b) => b.amount - a.amount);
        } else {
            // Sort by date for time view
            return result.sort((a, b) => a.sortKey - b.sortKey);
        }
    }, [flattenedExpenses, selectedYear, selectedMonth, isSpecificMonthSelected]);

    // Data for the second plot (Category Trend)
    const trendData = useMemo(() => {
        if (!trendCategory || !trendYear) return [];

        const groups = {};
        // Initialize all months with 0
        months.forEach((m, idx) => {
            // Use index as key to sort easily
            groups[idx] = {
                name: m.substring(0, 3), // Short name
                fullName: m,
                amount: 0,
                sortKey: idx
            };
        });

        flattenedExpenses.forEach(item => {
            const date = item.date;
            const year = date.getFullYear();
            const monthIndex = date.getMonth();

            if (year.toString() === trendYear.toString() && item.title === trendCategory) {
                groups[monthIndex].amount += item.amount;
            }
        });

        return Object.values(groups).sort((a, b) => a.sortKey - b.sortKey);
    }, [flattenedExpenses, trendYear, trendCategory]);

    // Data for the third plot (Credit Card Trends)
    const creditCardData = useMemo(() => {
        const groups = {};
        // Initialize all months with 0
        months.forEach((m, idx) => {
            groups[idx] = {
                name: m.substring(0, 3), // Short name
                fullName: m,
                amount: 0,
                sortKey: idx
            };
        });

        if (expenses && typeof expenses === 'object') {
            const yearData = expenses[ccTrendYear];
            if (yearData && typeof yearData === 'object') {
                Object.entries(yearData).forEach(([monthName, data]) => {
                    const monthIndex = months.indexOf(monthName);
                    if (monthIndex === -1) return;

                    const transactions = data.transactions || [];
                    const monthlyTotal = transactions
                        .filter(t => t.paymentMode === 'credit_card')
                        .reduce((sum, t) => {
                            const amount = Number(t.amount) || 0;
                            return t.isCredited ? sum - amount : sum + amount;
                        }, 0);

                    groups[monthIndex].amount = monthlyTotal;
                });
            }
        }

        return Object.values(groups).sort((a, b) => a.sortKey - b.sortKey);
    }, [expenses, ccTrendYear]);


    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{
                    backgroundColor: 'var(--bg-card)',
                    padding: 'var(--spacing-md)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 'var(--radius-sm)',
                }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>{label}</p>
                    <p style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                        {formatCurrency(payload[0].value)}
                    </p>
                </div>
            );
        }
        return null;
    };

    const getChartTitle = () => {
        if (isSpecificMonthSelected) {
            return `Category Breakdown - ${months[parseInt(selectedMonth)]} ${selectedYear}`;
        }
        return "Monthly Expenses";
    };

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-secondary hover:text-primary transition-colors mb-6"
                style={{ cursor: 'pointer', marginBottom: 'var(--spacing-lg)', background: 'none', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
                <ArrowLeft size={20} /> Back to Expenses
            </button>

            {/* First Plot Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h2 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Data Analytics</h2>

                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-lg">
                    <div className="flex items-center gap-2 text-secondary">
                        <Filter size={16} />
                        <span className="text-sm font-medium">Filters:</span>
                    </div>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="bg-transparent text-white border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.5rem' }}
                    >
                        <option value="All">All Years</option>
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>

                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent text-white border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.5rem' }}
                    >
                        <option value="All">All Months</option>
                        {months.map((month, index) => (
                            <option key={index} value={index}>{month}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="card" style={{ height: '400px', padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-xl)' }}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">{getChartTitle()}</h3>
                    {data.length === 0 && <p className="text-danger italic">No data found for selected filters</p>}
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout={isSpecificMonthSelected ? "vertical" : "horizontal"}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={isSpecificMonthSelected} vertical={!isSpecificMonthSelected} />
                        {isSpecificMonthSelected ? (
                            <>
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={100}
                                    stroke="var(--text-secondary)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                            </>
                        ) : (
                            <>
                                <XAxis
                                    dataKey="name"
                                    stroke="var(--text-secondary)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="var(--text-secondary)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `₹${value / 1000}k`}
                                />
                            </>
                        )}
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar
                            dataKey="amount"
                            fill="var(--accent-primary)"
                            radius={isSpecificMonthSelected ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                            barSize={isSpecificMonthSelected ? 20 : 40}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Second Plot Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4" style={{ marginTop: 'var(--spacing-xl)' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Category Trends</h2>

                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-lg">
                    <div className="flex items-center gap-2 text-secondary">
                        <Filter size={16} />
                        <span className="text-sm font-medium">Trend Filters:</span>
                    </div>

                    <select
                        value={trendYear}
                        onChange={(e) => setTrendYear(e.target.value)}
                        className="bg-transparent text-white border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.5rem' }}
                    >
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>

                    <select
                        value={trendCategory}
                        onChange={(e) => setTrendCategory(e.target.value)}
                        className="bg-transparent text-white border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.5rem', maxWidth: '200px' }}
                    >
                        {allCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="card" style={{ height: '400px', padding: 'var(--spacing-lg)' }}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">{trendCategory} Trend in {trendYear}</h3>
                    {trendData.every(d => d.amount === 0) && <p className="text-secondary italic">No spending in this category for {trendYear}</p>}
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                        <XAxis
                            dataKey="name"
                            stroke="var(--text-secondary)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="var(--text-secondary)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `₹${value / 1000}k`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar
                            dataKey="amount"
                            fill="var(--accent-secondary)"
                            radius={[4, 4, 0, 0]}
                            barSize={40}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Third Plot Section: Credit Card Spends */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4" style={{ marginTop: 'var(--spacing-xl)' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Credit Card Spending</h2>

                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-lg">
                    <div className="flex items-center gap-2 text-secondary">
                        <Filter size={16} />
                        <span className="text-sm font-medium">Year:</span>
                    </div>

                    <select
                        value={ccTrendYear}
                        onChange={(e) => setCcTrendYear(e.target.value)}
                        className="bg-transparent text-white border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.5rem' }}
                    >
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="card" style={{ height: '400px', padding: 'var(--spacing-lg)' }}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Credit Card Spends in {ccTrendYear}</h3>
                    {creditCardData.every(d => d.amount === 0) && <p className="text-secondary italic">No credit card usage recorded for {ccTrendYear}</p>}
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={creditCardData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                        <XAxis
                            dataKey="name"
                            stroke="var(--text-secondary)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="var(--text-secondary)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `₹${value / 1000}k`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar
                            dataKey="amount"
                            fill="#8B5CF6" // Violet color for credit cards
                            radius={[4, 4, 0, 0]}
                            barSize={40}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Portfolio History Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4" style={{ marginTop: 'var(--spacing-xl)' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Portfolio Growth</h2>
                <button
                    onClick={() => {
                        const date = prompt("Enter snapshot date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
                        if (date) takeSnapshot(date);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-xs uppercase tracking-widest transition-all"
                >
                    Capture Snapshot
                </button>
            </div>

            <div className="card" style={{ height: '400px', padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-xl)' }}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Net Worth Evolution</h3>
                    {snapshots.length === 0 && <p className="text-secondary italic">No snapshots captured yet</p>}
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={snapshots}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="var(--text-secondary)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(str) => new Date(str).getFullYear()}
                        />
                        <YAxis
                            stroke="var(--text-secondary)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `₹${value / 100000}L`}
                        />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div style={{
                                            backgroundColor: 'var(--bg-card)',
                                            padding: 'var(--spacing-md)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: 'var(--radius-sm)',
                                            minWidth: '200px'
                                        }}>
                                            <p className="text-gray-500 text-[10px] font-black uppercase mb-2">{label}</p>
                                            <p className="text-xl font-bold text-white mb-3">{formatCurrency(data.totalValue)}</p>
                                            <div className="space-y-1">
                                                {Object.entries(data.breakdown).map(([key, val]) => (
                                                    <div key={key} className="flex justify-between text-[10px] uppercase font-bold">
                                                        <span className="text-gray-500">{key.replace('_', ' ')}</span>
                                                        <span className="text-gray-300">{formatCurrency(val)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="totalValue"
                            stroke="var(--accent-primary)"
                            strokeWidth={3}
                            dot={{ r: 6, fill: 'var(--accent-primary)', strokeWidth: 2, stroke: 'var(--bg-card)' }}
                            activeDot={{ r: 8, strokeWidth: 0 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default Analytics;
