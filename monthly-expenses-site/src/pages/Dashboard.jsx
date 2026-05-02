import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { Wallet, TrendingDown, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const { expenses, salaryStats, formatCurrency, isLoading } = useFinance();
    const navigate = useNavigate();

    // Calculate quick stats
    const currentYear = new Date().getFullYear().toString();
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });

    let currentMonthSalary = 0;
    let currentMonthExpenses = 0;

    if (salaryStats[currentYear] && salaryStats[currentYear].months[currentMonth]) {
        currentMonthSalary = salaryStats[currentYear].months[currentMonth];
    }

    if (expenses[currentYear] && expenses[currentYear][currentMonth]) {
        const monthData = expenses[currentYear][currentMonth];
        const cats = monthData.categories || monthData;
        
        Object.entries(cats).forEach(([cat, val]) => {
            if (cat !== 'salary received' && cat !== 'income') {
                currentMonthExpenses += Number(val || 0);
            }
        });
    }

    const currentMonthDeficit = currentMonthSalary - currentMonthExpenses;

    if (isLoading) {
        return <div className="p-8 flex justify-center text-gray-500">Syncing with GitHub...</div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-4xl font-black text-white tracking-tight mb-2">Welcome Back!</h1>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Here is your {currentMonth} {currentYear} overview</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                            <Wallet size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Income</p>
                            <h3 className="text-2xl font-black text-white">{formatCurrency(currentMonthSalary)}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                            <TrendingDown size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Expenses</p>
                            <h3 className="text-2xl font-black text-white">{formatCurrency(currentMonthExpenses)}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <LayoutDashboard size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Balance</p>
                            <h3 className={`text-2xl font-black ${currentMonthDeficit < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {formatCurrency(Math.abs(currentMonthDeficit))}
                                {currentMonthDeficit < 0 ? ' (Deficit)' : ' (Saved)'}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <button 
                    onClick={() => navigate('/expenses')}
                    className="py-4 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest transition-all"
                >
                    View All Expenses
                </button>
            </div>
        </div>
    );
};

export default Dashboard;
