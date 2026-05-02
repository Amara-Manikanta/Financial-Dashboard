import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Landmark, Plus, Edit2, Trash2 } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import PFTransactionModal from '../components/PFTransactionModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const PFDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem } = useFinance();
    const [selectedYear, setSelectedYear] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);

    const pf = savings.find(s => s.id === id);

    if (!pf) return <div>ID not found</div>;

    const getFinancialYear = (dateStr) => {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 1-indexed
        return month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
    };

    const recalculateBalances = (details) => {
        const sorted = [...details].sort((a, b) => new Date(a.date) - new Date(b.date));
        let runningBalance = Number(pf.amount || 0); // Starting opening balance
        return sorted.map(item => {
            const txAmount = (Number(item.employeeContribution) || 0) + (Number(item.employerContribution) || 0) + (Number(item.interestEarned) || 0);
            runningBalance += txAmount;
            return { ...item, balance: runningBalance };
        });
    };

    const handleSaveTx = (txData) => {
        let updatedDetails = [...(pf.details || [])];
        if (editingIndex !== null) {
            updatedDetails[editingIndex] = txData;
        } else {
            updatedDetails.push(txData);
        }

        const detailsWithBalances = recalculateBalances(updatedDetails);
        updateItem('savings', { ...pf, details: detailsWithBalances });
        setIsModalOpen(false);
        setEditingTx(null);
        setEditingIndex(null);
    };

    const handleDeleteTx = (originalIndex) => {
        if (window.confirm('Delete this transaction?')) {
            const updatedDetails = (pf.details || []).filter((_, i) => i !== originalIndex);
            const detailsWithBalances = recalculateBalances(updatedDetails);
            updateItem('savings', { ...pf, details: detailsWithBalances });
        }
    };

    const details = pf.details || [];
    const years = ['All', ...new Set(details.map(item => getFinancialYear(item.date)))].sort((a, b) => b.localeCompare(a));
    const filteredDetails = selectedYear === 'All'
        ? [...details].sort((a, b) => new Date(b.date) - new Date(a.date))
        : details.filter(item => getFinancialYear(item.date) === selectedYear).sort((a, b) => new Date(b.date) - new Date(a.date));

    const itemsPerPage = 6;
    const totalPages = Math.ceil(filteredDetails.length / itemsPerPage);
    const paginatedDetails = filteredDetails.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    
    const openingBalance = Number(pf.amount || 0);
    const totalInterest = details.reduce((sum, item) => sum + (Number(item.interestEarned) || 0), 0);
    const totalEmployeeContrib = details.reduce((sum, item) => sum + (Number(item.employeeContribution) || 0), 0);
    const totalEmployerContrib = details.reduce((sum, item) => sum + (Number(item.employerContribution) || 0), 0);
    const totalBalance = details.length > 0 ? recalculateBalances(details).slice(-1)[0].balance : openingBalance;
    
    const yearlyInterest = details.reduce((acc, item) => {
        if (item.type === 'Interest' || Number(item.interestEarned) > 0) {
            const fy = getFinancialYear(item.date);
            acc[fy] = (acc[fy] || 0) + (Number(item.interestEarned) || 0);
        }
        return acc;
    }, {});

    const chartData = Object.entries(yearlyInterest)
        .map(([year, amount]) => ({ year, amount }))
        .sort((a, b) => a.year.localeCompare(b.year));

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
                        <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                            <Landmark className="text-indigo-400" size={32} />
                        </div>
                        {pf.title}
                    </h2>
                    <p className="text-secondary font-medium">Opening Balance: {formatCurrency(openingBalance)} | Started: {formatDate(pf.date)}</p>
                </div>
                <button
                    onClick={() => { setEditingTx(null); setEditingIndex(null); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-8 rounded-2xl flex items-center gap-2 transition-all shadow-2xl shadow-indigo-900/40 text-xs uppercase tracking-widest active:scale-95"
                >
                    <Plus size={20} />
                    Add Transaction
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <div className="card bg-gradient-to-br from-indigo-500/10 to-transparent border-white/5 p-6">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Total Balance</p>
                    <p className="text-3xl font-black text-white">{formatCurrency(totalBalance)}</p>
                </div>
                <div className="card bg-gradient-to-br from-blue-500/10 to-transparent border-white/5 p-6">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">My Contribution</p>
                    <p className="text-3xl font-black text-blue-400">{formatCurrency(totalEmployeeContrib)}</p>
                </div>
                <div className="card bg-gradient-to-br from-teal-500/10 to-transparent border-white/5 p-6">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Employer Contribution</p>
                    <p className="text-3xl font-black text-teal-400">{formatCurrency(totalEmployerContrib)}</p>
                </div>
                <div className="card bg-gradient-to-br from-emerald-500/10 to-transparent border-white/5 p-6">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Total Interest</p>
                    <p className="text-3xl font-black text-emerald-400">{formatCurrency(totalInterest)}</p>
                </div>
            </div>

            <div className="card border-white/5 p-6 mb-10 bg-white/[0.02]">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-6 px-1">Interest Earned By Year</h3>
                {chartData.length > 0 ? (
                    <div style={{ width: '100%', height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <XAxis dataKey="year" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                                    itemStyle={{ color: '#34d399', fontWeight: 'bold' }}
                                    formatter={(value) => formatCurrency(value)}
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                />
                                <Bar dataKey="amount" fill="#34d399" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-48 w-full flex items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No interest recorded yet</p>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-2 mb-6 border-b border-white/5 pb-4">
                {years.map(year => (
                    <button
                        key={year}
                        onClick={() => { setSelectedYear(year); setCurrentPage(1); }}
                        className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedYear === year
                            ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40'
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
                                <th className="py-5 px-6 text-right">Amount</th>
                                <th className="py-5 px-8 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {paginatedDetails.map((item, index) => {
                                const originalIndex = details.indexOf(item);
                                const isInterest = item.type === 'Interest';
                                const txAmount = (Number(item.employeeContribution) || 0) + (Number(item.employerContribution) || 0) + (Number(item.interestEarned) || 0);
                                
                                return (
                                    <tr key={index} className="hover:bg-white/[0.03] transition-colors group">
                                        <td className="py-6 px-8 text-sm font-bold text-gray-300">{formatDate(item.date)}</td>
                                        <td className="py-6 px-6">
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${isInterest
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                                }`}>
                                                {item.type || 'Contribution'}
                                            </span>
                                        </td>
                                        <td className={`py-6 px-6 text-right font-black text-sm ${isInterest ? 'text-emerald-400' : 'text-gray-200'}`}>
                                            {isInterest ? `+${formatCurrency(txAmount)}` : formatCurrency(txAmount)}
                                        </td>
                                        <td className="py-6 px-8 text-center">
                                            <div className="flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => { setEditingTx(item); setEditingIndex(originalIndex); setIsModalOpen(true); }} className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all transform hover:scale-110"><Edit2 size={16} /></button>
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
                            <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${currentPage === i + 1 ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-600 hover:bg-white/10'}`}>{i + 1}</button>
                        ))}
                    </div>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-6 py-3 rounded-xl bg-white/5 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all">Next</button>
                </div>
            </div>

            <PFTransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveTx} initialData={editingTx} />
        </div>
    );
};

export default PFDetails;
