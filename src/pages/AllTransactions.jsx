import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Search, Filter, Calendar, ArrowUpCircle, ArrowDownCircle, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const AllTransactions = () => {
    const { expenses, formatCurrency } = useFinance();
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all'); // all, credit, debit
    const [yearFilter, setYearFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('all');
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);

    // Flatten transactions
    const allTransactions = useMemo(() => {
        const flattened = [];
        if (!expenses) return flattened;

        Object.entries(expenses).forEach(([year, months]) => {
            Object.entries(months).forEach(([month, data]) => {
                if (data.transactions && Array.isArray(data.transactions)) {
                    data.transactions.forEach(t => {
                        flattened.push({
                            ...t,
                            year,
                            month,
                            originalDate: new Date(t.date)
                        });
                    });
                }
            });
        });

        return flattened.sort((a, b) => b.originalDate - a.originalDate);
    }, [expenses]);

    // Extract unique years and months for filters
    const years = useMemo(() => [...new Set(allTransactions.map(t => t.year))].sort().reverse(), [allTransactions]);
    const months = useMemo(() => [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ], []);

    // Filter and Search
    const filteredTransactions = useMemo(() => {
        return allTransactions.filter(t => {
            const matchesSearch = (t.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (t.category?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            const matchesType = typeFilter === 'all'
                ? true
                : typeFilter === 'credit' ? t.isCredited
                    : !t.isCredited;
            const matchesYear = yearFilter === 'all' ? true : t.year === yearFilter;
            const matchesMonth = monthFilter === 'all' ? true : t.month === monthFilter;

            return matchesSearch && matchesType && matchesYear && matchesMonth;
        });
    }, [allTransactions, searchTerm, typeFilter, yearFilter, monthFilter]);

    // Pagination
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    const displayedTransactions = filteredTransactions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleExport = () => {
        const exportData = filteredTransactions.map(t => ({
            Date: new Date(t.date).toLocaleDateString(),
            Title: t.title,
            Category: t.category,
            Amount: t.amount,
            Type: t.isCredited ? 'Credit' : 'Debit',
            PaymentMode: t.paymentMode,
            CreditCard: t.creditCardName || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transactions");
        XLSX.writeFile(wb, "Transactions.xlsx");
    };

    return (
        <div className="container pb-12 animate-fade-in mx-auto max-w-7xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight mb-2">Transaction History</h1>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
                        {filteredTransactions.length} Total Transactions
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    className="px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl font-bold flex items-center gap-2 transition-all border border-emerald-500/20"
                >
                    <Download size={18} />
                    Export to Excel
                </button>
            </div>

            {/* Filters Bar */}
            <div className="bg-[#121214] border border-white/5 p-4 rounded-2xl mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search by title or category..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#0c0c0e] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white font-medium focus:outline-none focus:border-orange-500/50 transition-all placeholder:text-gray-600"
                    />
                </div>

                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <div className="relative group">
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="appearance-none bg-[#0c0c0e] border border-white/10 rounded-xl px-4 py-3 pr-10 text-white font-bold text-sm focus:outline-none focus:border-orange-500/50 cursor-pointer min-w-[120px]"
                        >
                            <option value="all" className="bg-[#0c0c0e] text-white">All Types</option>
                            <option value="credit" className="bg-[#0c0c0e] text-white">Credit (Income)</option>
                            <option value="debit" className="bg-[#0c0c0e] text-white">Debit (Expense)</option>
                        </select>
                        <ArrowDownCircle size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>

                    <div className="relative group">
                        <select
                            value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                            className="appearance-none bg-[#0c0c0e] border border-white/10 rounded-xl px-4 py-3 pr-10 text-white font-bold text-sm focus:outline-none focus:border-orange-500/50 cursor-pointer min-w-[100px]"
                        >
                            <option value="all" className="bg-[#0c0c0e] text-white">All Years</option>
                            {years.map(y => <option key={y} value={y} className="bg-[#0c0c0e] text-white">{y}</option>)}
                        </select>
                        <Calendar size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>

                    <div className="relative group">
                        <select
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            className="appearance-none bg-[#0c0c0e] border border-white/10 rounded-xl px-4 py-3 pr-10 text-white font-bold text-sm focus:outline-none focus:border-orange-500/50 cursor-pointer min-w-[120px]"
                        >
                            <option value="all" className="bg-[#0c0c0e] text-white">All Months</option>
                            {months.map(m => <option key={m} value={m} className="bg-[#0c0c0e] text-white">{m}</option>)}
                        </select>
                        <Filter size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-[#121214] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5">
                                <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-black text-gray-500">Date</th>
                                <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-black text-gray-500">Details</th>
                                <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-black text-gray-500">Category</th>
                                <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-black text-gray-500">Payment Mode</th>
                                <th className="text-right py-4 px-6 text-[10px] uppercase tracking-widest font-black text-gray-500">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {displayedTransactions.length > 0 ? (
                                displayedTransactions.map((t, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="py-4 px-6 whitespace-nowrap">
                                            <div className="font-bold text-white text-sm">
                                                {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                            <div className="text-[10px] text-gray-500 uppercase font-bold mt-1">{t.month}</div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="font-bold text-white text-sm">{t.title}</div>
                                            {t.creditCardName && (
                                                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/20">
                                                    {t.creditCardName}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-white/5 text-gray-300 uppercase tracking-wider border border-white/5 group-hover:border-white/10 transition-colors">
                                                {t.category}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                {t.paymentMode === 'credit_card' ? (
                                                    <div className="w-8 h-5 rounded bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg">
                                                        <div className="w-5 h-0.5 bg-white/30 rounded-full" />
                                                    </div>
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                                        <span className="text-[10px] font-black text-emerald-500">UPI</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className={`font-black text-lg ${t.isCredited ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {t.isCredited ? '+' : '-'} {formatCurrency(t.amount)}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="py-12 text-center text-gray-500 font-medium">
                                        No transactions found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-white/5 flex items-center justify-between bg-black/20">
                        <div className="text-xs font-bold text-gray-500">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} results
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-white"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="flex items-center px-4 rounded-lg bg-white/5 text-xs font-bold text-white">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-white"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AllTransactions;
