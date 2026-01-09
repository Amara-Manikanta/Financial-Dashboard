import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, PiggyBank, Plus, Edit2, Trash2 } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import PPFTransactionModal from '../components/PPFTransactionModal';

const PPFDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();
    const [selectedYear, setSelectedYear] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);

    const ppf = savings.find(s => s.id === id);

    if (!ppf) return <div>ID not found</div>;

    const getFinancialYear = (dateStr) => {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 1-indexed
        return month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
    };

    const calculateYearlyInterest = (fy) => {
        const [startYear] = fy.split('-').map(Number);
        const startDate = new Date(`${startYear}-04-01`);
        const endDate = new Date(`${startYear + 1}-03-31`);
        const rate = 0.071; // Standard PPF Rate

        // 1. Get all transactions up to the end of the financial year, sorted by date
        const sortedAll = [...ppf.details]
            .filter(d => d.type !== 'interest' || new Date(d.date) < startDate) // Exclude current FY interest
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const monthlyInterests = [];

        // 2. Iterate through each month of the financial year (April to March)
        for (let m = 0; m < 12; m++) {
            const currentMonth = (3 + m) % 12; // April is 3
            const currentYear = startYear + (m >= 9 ? 1 : 0);

            // Monthly min balance rule: Lowest balance between 5th and end of month
            // We need the balance *after* all transactions up to the 5th
            const monthEndDate = new Date(currentYear, currentMonth + 1, 0);
            const cutoffDate = new Date(currentYear, currentMonth, 5);

            let balanceOn5th = 0;
            const txsUpTo5th = ppf.details.filter(d => new Date(d.date) <= cutoffDate);
            balanceOn5th = txsUpTo5th.reduce((sum, d) => sum + (d.amount || 0) + (d.interestEarned || 0), 0);

            // Monthly interest = min balance * rate / 12
            monthlyInterests.push(Math.floor(balanceOn5th * rate / 12));
        }

        return monthlyInterests.reduce((a, b) => a + b, 0);
    };

    const recalculateBalances = (details) => {
        const sorted = [...details].sort((a, b) => new Date(a.date) - new Date(b.date));
        let runningBalance = 0;
        return sorted.map(item => {
            runningBalance += (item.amount || 0) + (item.interestEarned || 0);
            return { ...item, balance: runningBalance };
        });
    };

    const handleSaveTx = (txData) => {
        let updatedDetails = [...ppf.details];
        if (editingIndex !== null) {
            updatedDetails[editingIndex] = txData;
        } else {
            updatedDetails.push(txData);
        }

        const detailsWithBalances = recalculateBalances(updatedDetails);
        const finalBalance = detailsWithBalances.length > 0 ? detailsWithBalances[detailsWithBalances.length - 1].balance : 0;

        updateItem('savings', { ...ppf, details: detailsWithBalances, amount: finalBalance });
        setIsModalOpen(false);
        setEditingTx(null);
        setEditingIndex(null);
    };

    const handleAddInterest = (fy) => {
        const amount = calculateYearlyInterest(fy);
        const [startYear] = fy.split('-').map(Number);
        const date = `${startYear + 1}-03-31`;
        const existingIndex = ppf.details.findIndex(d => d.type === 'interest' && d.date === date);
        const txData = {
            id: existingIndex !== -1 ? ppf.details[existingIndex].id : Date.now(),
            date,
            type: 'interest',
            amount: 0,
            interestEarned: amount
        };
        if (existingIndex !== -1) {
            setEditingIndex(existingIndex);
            handleSaveTx(txData);
        } else {
            setEditingIndex(null);
            handleSaveTx(txData);
        }
    };

    const handleDeleteTx = (originalIndex) => {
        if (window.confirm('Delete this transaction?')) {
            const updatedDetails = ppf.details.filter((_, i) => i !== originalIndex);
            const detailsWithBalances = recalculateBalances(updatedDetails);
            const finalBalance = detailsWithBalances.length > 0 ? detailsWithBalances[detailsWithBalances.length - 1].balance : 0;
            updateItem('savings', { ...ppf, details: detailsWithBalances, amount: finalBalance });
        }
    };

    const [showFYSelector, setShowFYSelector] = useState(false);

    const generatePossibleFYs = () => {
        const currentYear = new Date().getFullYear();
        const fys = [];
        for (let i = -5; i <= 1; i++) {
            const y = currentYear + i;
            fys.push(`${y}-${(y + 1).toString().slice(-2)}`);
        }
        return fys;
    };

    // Extract unique financial years
    const years = ['All', ...new Set(ppf.details.map(item => getFinancialYear(item.date)))].sort((a, b) => b.localeCompare(a));
    const filteredDetails = selectedYear === 'All'
        ? [...ppf.details].sort((a, b) => new Date(b.date) - new Date(a.date))
        : ppf.details.filter(item => getFinancialYear(item.date) === selectedYear).sort((a, b) => new Date(b.date) - new Date(a.date));

    const itemsPerPage = 6;
    const totalPages = Math.ceil(filteredDetails.length / itemsPerPage);
    const paginatedDetails = filteredDetails.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalInterest = ppf.details.reduce((sum, item) => sum + (item.interestEarned || 0), 0);
    const totalBalance = ppf.details.length > 0 ? recalculateBalances(ppf.details).slice(-1)[0].balance : 0;
    const yearlyInterest = ppf.details.reduce((acc, item) => {
        const fy = getFinancialYear(item.date);
        acc[fy] = (acc[fy] || 0) + (item.interestEarned || 0);
        return acc;
    }, {});

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 hover:text-primary transition-colors mb-6 text-sm font-bold uppercase tracking-widest text-gray-500"
                style={{ cursor: 'pointer' }}
            >
                <ArrowLeft size={16} /> Back to Savings
            </button>

            <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h2 className="text-4xl font-black mb-2 flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                            <PiggyBank className="text-blue-400" size={32} />
                        </div>
                        {ppf.name}
                    </h2>
                    <p className="text-secondary font-medium">Account: {ppf.accountNo} | Bank: {ppf.bank}</p>
                </div>
                <button
                    onClick={() => { setEditingTx(null); setEditingIndex(null); setIsModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-8 rounded-2xl flex items-center gap-2 transition-all shadow-2xl shadow-blue-900/40 text-xs uppercase tracking-widest active:scale-95"
                >
                    <Plus size={20} />
                    Add Transaction
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="card bg-gradient-to-br from-blue-500/10 to-transparent border-white/5 p-6">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Portfolio Balance</p>
                    <p className="text-3xl font-black text-white">{formatCurrency(totalBalance)}</p>
                </div>
                <div className="card bg-gradient-to-br from-emerald-500/10 to-transparent border-white/5 p-6">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Accumulated Interest</p>
                    <p className="text-3xl font-black text-emerald-400">{formatCurrency(totalInterest)}</p>
                </div>
            </div>

            <div className="mb-10">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-4 px-1">Yearly Interest Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Object.entries(yearlyInterest).sort((a, b) => b[0].localeCompare(a[0])).map(([year, interest]) => (
                        <div key={year} className="card border-white/5 p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors relative group">
                            <p className="text-[9px] font-black text-gray-600 uppercase mb-1">{year}</p>
                            <p className="text-sm font-bold text-emerald-500">{formatCurrency(interest)}</p>
                            <button
                                onClick={() => handleAddInterest(year)}
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-white/5 rounded-md hover:bg-emerald-500/20 text-emerald-400 transition-all border border-white/10"
                                title="Recalculate Interest"
                            >
                                <Plus size={12} />
                            </button>
                        </div>
                    ))}
                    <div className="relative">
                        <button
                            onClick={() => setShowFYSelector(!showFYSelector)}
                            className="card border-dashed border-white/10 p-4 bg-transparent hover:bg-white/5 transition-colors flex flex-col items-center justify-center text-gray-500 hover:text-white group w-full h-full"
                        >
                            <Plus size={16} className="mb-1 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-black uppercase">Add Interest</span>
                        </button>
                        {showFYSelector && (
                            <div className="absolute top-full left-0 mt-2 w-48 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl z-50 p-2 max-h-48 overflow-y-auto custom-scrollbar">
                                {generatePossibleFYs().map(fy => (
                                    <button
                                        key={fy}
                                        onClick={() => { handleAddInterest(fy); setShowFYSelector(false); }}
                                        className="w-full text-left px-4 py-2 text-xs font-bold text-gray-400 hover:bg-white/5 hover:text-white rounded-lg transition-colors"
                                    >
                                        FY {fy}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6 border-b border-white/5 pb-4">
                {years.map(year => (
                    <button
                        key={year}
                        onClick={() => { setSelectedYear(year); setCurrentPage(1); }}
                        className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedYear === year
                            ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40'
                            : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'
                            }`}
                    >
                        {year}
                    </button>
                ))}
            </div>

            <div className="card border-white/5 p-0 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Transactions</h3>
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Page {currentPage} of {totalPages || 1}</span>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-gray-500 text-[10px] font-black uppercase tracking-widest bg-white/[0.02]">
                                <th className="py-5 px-8">Date</th>
                                <th className="py-5 px-6">Entry Type</th>
                                <th className="py-5 px-6 text-right">Contribution</th>
                                <th className="py-5 px-6 text-right">Yield</th>
                                <th className="py-5 px-6 text-right">Balance</th>
                                <th className="py-5 px-8 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {paginatedDetails.map((item, index) => {
                                const originalIndex = ppf.details.indexOf(item);
                                return (
                                    <tr key={index} className="hover:bg-white/[0.03] transition-colors group">
                                        <td className="py-6 px-8 text-sm font-bold text-gray-300">{formatDate(item.date)}</td>
                                        <td className="py-6 px-6">
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${item.type === 'interest'
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                }`}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="py-6 px-6 text-right font-black text-sm text-gray-200">{item.amount > 0 ? formatCurrency(item.amount) : '—'}</td>
                                        <td className="py-6 px-6 text-right text-emerald-400 font-black text-sm">{item.interestEarned > 0 ? `+${formatCurrency(item.interestEarned)}` : '—'}</td>
                                        <td className="py-6 px-6 text-right font-black text-base text-white tracking-tight">{formatCurrency(item.balance)}</td>
                                        <td className="py-6 px-8 text-center">
                                            <div className="flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => { setEditingTx(item); setEditingIndex(originalIndex); setIsModalOpen(true); }} className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all transform hover:scale-110"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDeleteTx(originalIndex)} className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all transform hover:scale-110"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredDetails.length === 0 && <div className="text-center py-20 bg-white/[0.02]"><p className="text-gray-500 font-medium tracking-wide">No transactions identified for the selected interval.</p></div>}
                <div className="p-6 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-6 py-3 rounded-xl bg-white/5 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all">Previous</button>
                    <div className="flex gap-2">
                        {[...Array(totalPages)].map((_, i) => (
                            <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-600 hover:bg-white/10'}`}>{i + 1}</button>
                        ))}
                    </div>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-6 py-3 rounded-xl bg-white/5 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all">Next</button>
                </div>
            </div>

            <PPFTransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveTx} initialData={editingTx} />
        </div>
    );
};

export default PPFDetails;
