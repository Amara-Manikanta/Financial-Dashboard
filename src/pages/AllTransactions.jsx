import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    const navigate = useNavigate();

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

        return flattened
            .filter(t => !isNaN(t.originalDate))
            .sort((a, b) => b.originalDate - a.originalDate);
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

    // Reset to page 1 whenever any filter changes
    useEffect(() => { setCurrentPage(1); }, [searchTerm, typeFilter, yearFilter, monthFilter, itemsPerPage]);

    const handleClearFilters = () => {
        setSearchTerm('');
        setTypeFilter('all');
        setYearFilter('all');
        setMonthFilter('all');
    };
    const hasActiveFilters = searchTerm || typeFilter !== 'all' || yearFilter !== 'all' || monthFilter !== 'all';

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
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>Transaction History</h2>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', margin: '0.25rem 0 0 0' }}>
                        {filteredTransactions.length.toLocaleString()} Total Transactions
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {hasActiveFilters && (
                        <button
                            onClick={handleClearFilters}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '0.75rem',
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: '#a1a1aa',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                cursor: 'pointer'
                            }}
                        >
                            Clear Filters
                        </button>
                    )}
                    <button
                        onClick={handleExport}
                        disabled={filteredTransactions.length === 0}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            color: '#34d399',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            opacity: filteredTransactions.length === 0 ? 0.3 : 1
                        }}
                    >
                        <Download size={14} /> Export to Excel
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div style={{
                backgroundColor: 'rgba(24, 24, 27, 0.4)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '2rem',
                padding: '1.5rem',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1.5rem'
            }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
                    <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} size={16} />
                    <input
                        type="text"
                        placeholder="Search by title or category..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', color: 'white', fontSize: '0.875rem', outline: 'none' }}
                    />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{
                        display: 'flex',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '1rem',
                        padding: '2px',
                        gap: '2px'
                    }}>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            style={{ backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '11px', fontWeight: 'bold', padding: '0.5rem', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="all" style={{ backgroundColor: '#18181b' }}>All Types</option>
                            <option value="credit" style={{ backgroundColor: '#18181b' }}>Credit (Income)</option>
                            <option value="debit" style={{ backgroundColor: '#18181b' }}>Debit (Expense)</option>
                        </select>
                        <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
                        <select
                            value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                            style={{ backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '11px', fontWeight: 'bold', padding: '0.5rem', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="all" style={{ backgroundColor: '#18181b' }}>All Years</option>
                            {years.map(y => <option key={y} value={y} style={{ backgroundColor: '#18181b' }}>{y}</option>)}
                        </select>
                        <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
                        <select
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            style={{ backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '11px', fontWeight: 'bold', padding: '0.5rem', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="all" style={{ backgroundColor: '#18181b' }}>All Months</option>
                            {months.map(m => <option key={m} value={m} style={{ backgroundColor: '#18181b' }}>{m}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div style={{
                backgroundColor: 'rgba(24, 24, 27, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '2rem',
                overflow: 'hidden',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
            }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Details</th>
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Mode</th>
                                <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedTransactions.length > 0 ? (
                                displayedTransactions.map((t) => (
                                    <tr 
                                        key={t.id || `${t.date}-${t.amount}-${t.title}`} 
                                        onClick={() => {
                                            if (t.id) {
                                                navigate(`/expenses/${t.year}/${t.month}?highlightTxId=${t.id}`);
                                            }
                                        }}
                                        style={{ 
                                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                                            cursor: t.id ? 'pointer' : 'default',
                                            transition: 'background-color 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (t.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (t.id) e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                        title={t.id ? "Click to view in Monthly Statement" : ""}
                                    >
                                        <td style={{ padding: '1rem 1.5rem', color: '#a1a1aa', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                                            <div style={{ color: 'white', fontWeight: 'bold' }}>
                                                {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                            <div style={{ fontSize: '9px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>{t.month}</div>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <div style={{ color: 'white', fontWeight: 'bold', fontSize: '0.875rem' }}>{t.title}</div>
                                            {t.creditCardName && (
                                                <span style={{ display: 'inline-flex', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '9px', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)', marginTop: '0.25rem' }}>
                                                    {t.creditCardName}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <span style={{ display: 'inline-flex', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.03)', color: '#a1a1aa' }}>
                                                {t.mainCategory ? `${t.mainCategory} • ${t.category}` : t.category}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                {t.paymentMode === 'credit_card' ? (
                                                    <span style={{ display: 'inline-flex', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '9px', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(129, 140, 248, 0.1)', color: '#818cf8', border: '1px solid rgba(129, 140, 248, 0.2)' }}>CARD</span>
                                                ) : t.paymentMode === 'direct' || t.paymentMode === 'upi' ? (
                                                    <span style={{ display: 'inline-flex', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '9px', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)' }}>UPI</span>
                                                ) : t.paymentMode === 'cash' ? (
                                                    <span style={{ display: 'inline-flex', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '9px', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)' }}>CASH</span>
                                                ) : t.paymentMode === 'bank_transfer' || t.paymentMode === 'neft' || t.paymentMode === 'imps' ? (
                                                    <span style={{ display: 'inline-flex', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '9px', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)' }}>BANK</span>
                                                ) : (
                                                    <span style={{ display: 'inline-flex', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '9px', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(255,255,255,0.03)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.05)' }}>{(t.paymentMode || 'N/A').toUpperCase()}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold', color: t.isCredited ? '#34d399' : '#f87171' }}>
                                            {t.isCredited ? '+' : '-'} {formatCurrency(t.amount)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: '#71717a', fontSize: '0.875rem' }}>
                                        No transactions found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ fontSize: '11px', color: '#71717a' }}>
                                Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span style={{ fontSize: '11px', color: '#71717a' }}>Rows:</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '0.5rem', padding: '0.25rem', outline: 'none', cursor: 'pointer' }}
                                >
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer', opacity: currentPage === 1 ? 0.3 : 1, fontSize: '10px', fontWeight: 'bold' }}>Prev</button>
                            <span style={{ fontSize: '11px', color: '#71717a', fontFamily: 'monospace', padding: '0 0.5rem' }}>
                                Page {currentPage} / {totalPages}
                            </span>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer', opacity: currentPage === totalPages ? 0.3 : 1, fontSize: '10px', fontWeight: 'bold' }}>Next</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AllTransactions;
