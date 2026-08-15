import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { Search, Filter, Calendar, ArrowUpCircle, ArrowDownCircle, ChevronLeft, ChevronRight, Download, X, Edit2, Trash2, CheckSquare, Square, Tag, ChevronDown } from 'lucide-react';
import { ISSUE_FILTERS, matchesIssue } from '../utils/dataHealth';
import * as XLSX from 'xlsx';
import TransactionModal from '../components/TransactionModal';
import ConfirmModal from '../components/ConfirmModal';
import { CATEGORY_MAP } from '../utils/categories';

const AllTransactions = () => {
    const { expenses, formatCurrency, updateItem, deleteItem, bulkUpdateExpenses, bulkDeleteExpenses, mergedCategoryMap } = useFinance();
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [typeFilter, setTypeFilter] = useState('all'); // all, credit, debit
    const [yearFilter, setYearFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [subCategoryFilter, setSubCategoryFilter] = useState('all');
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);
    const navigate = useNavigate();

    // Edit/Delete state
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null });

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkMode, setBulkMode] = useState(false);
    const [bulkEditOpen, setBulkEditOpen] = useState(false);
    const [bulkTitle, setBulkTitle] = useState('');
    const [bulkMainCategory, setBulkMainCategory] = useState('');
    const [bulkSubCategory, setBulkSubCategory] = useState('');
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

    // Data Health links here with ?issue=... so a finding can be worked
    // through, instead of only being counted on that page.
    const issue = searchParams.get('issue');
    const clearIssue = () => {
        const next = new URLSearchParams(searchParams);
        next.delete('issue');
        setSearchParams(next, { replace: true });
    };

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

    // Extract unique categories for filter
    const uniqueCategories = useMemo(() => {
        const cats = new Set();
        allTransactions.forEach(t => {
            if (t.category) cats.add(t.category.toLowerCase());
        });
        return [...cats].sort();
    }, [allTransactions]);

    // Get sub-categories for the selected main category filter
    const filterSubCategories = useMemo(() => {
        if (categoryFilter === 'all') return [];
        return mergedCategoryMap[categoryFilter] || [];
    }, [categoryFilter, mergedCategoryMap]);

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
            const matchesTheIssue = issue ? matchesIssue(issue, t) : true;

            // Category filter: match by mainCategory or by sub-category
            let matchesCategory = true;
            if (categoryFilter !== 'all') {
                const mainCatSubs = (mergedCategoryMap[categoryFilter] || []).map(s => s.toLowerCase());
                if (subCategoryFilter !== 'all') {
                    matchesCategory = (t.category || '').toLowerCase() === subCategoryFilter.toLowerCase();
                } else {
                    matchesCategory = t.mainCategory === categoryFilter ||
                        mainCatSubs.includes((t.category || '').toLowerCase());
                }
            }

            return matchesSearch && matchesType && matchesYear && matchesMonth && matchesTheIssue && matchesCategory;
        });
    }, [allTransactions, searchTerm, typeFilter, yearFilter, monthFilter, issue, categoryFilter, subCategoryFilter, mergedCategoryMap]);

    // Reset to page 1 whenever any filter changes
    useEffect(() => { setCurrentPage(1); }, [searchTerm, typeFilter, yearFilter, monthFilter, categoryFilter, subCategoryFilter, itemsPerPage, issue]);

    const handleClearFilters = () => {
        setSearchTerm('');
        setTypeFilter('all');
        setYearFilter('all');
        setMonthFilter('all');
        setCategoryFilter('all');
        setSubCategoryFilter('all');
    };
    const hasActiveFilters = searchTerm || typeFilter !== 'all' || yearFilter !== 'all' || monthFilter !== 'all' || categoryFilter !== 'all';

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

    // --- Edit / Delete handlers ---
    const handleSaveTransaction = (transaction) => {
        if (transaction.id) updateItem('expense', transaction);
        setEditingTransaction(null);
        setIsModalOpen(false);
    };

    const handleDeleteTransaction = (id) => {
        setDeleteConfirm({ isOpen: true, id });
    };

    const confirmDelete = () => {
        if (deleteConfirm.id) {
            deleteItem('expense', deleteConfirm.id);
        }
        setDeleteConfirm({ isOpen: false, id: null });
    };

    // --- Bulk selection handlers ---
    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        const pageIds = displayedTransactions.filter(t => t.id).map(t => t.id);
        const allSelected = pageIds.every(id => selectedIds.has(id));
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allSelected) {
                pageIds.forEach(id => next.delete(id));
            } else {
                pageIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const exitBulkMode = () => {
        setBulkMode(false);
        setSelectedIds(new Set());
    };

    const bulkSubCategories = bulkMainCategory ? (mergedCategoryMap[bulkMainCategory] || []) : [];

    const handleBulkCategoryUpdate = async () => {
        if (selectedIds.size === 0) return;
        if (!bulkSubCategory && !bulkTitle.trim()) return;

        const patch = {};
        if (bulkMainCategory && bulkSubCategory) {
            patch.mainCategory = bulkMainCategory;
            patch.category = bulkSubCategory.toLowerCase();
        }
        if (bulkTitle.trim()) {
            patch.title = bulkTitle.trim();
        }

        const updates = [...selectedIds].map(id => ({ id, patch }));
        await bulkUpdateExpenses(updates);

        setBulkEditOpen(false);
        setBulkMainCategory('');
        setBulkSubCategory('');
        setBulkTitle('');
        setSelectedIds(new Set());
        setBulkMode(false);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        await bulkDeleteExpenses([...selectedIds]);
        setBulkDeleteConfirm(false);
        setSelectedIds(new Set());
        setBulkMode(false);
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {issue && ISSUE_FILTERS[issue] && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                            Showing only: {ISSUE_FILTERS[issue]}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            {filteredTransactions.length.toLocaleString()} transactions need fixing &middot; from Data Health
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={clearIssue}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                    >
                        <X size={12} /> Show everything
                    </button>
                </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>Transaction History</h2>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', margin: '0.25rem 0 0 0' }}>
                        {filteredTransactions.length.toLocaleString()} Total Transactions
                        {bulkMode && selectedIds.size > 0 && (
                            <span style={{ color: '#eab308', marginLeft: '0.5rem' }}>• {selectedIds.size} selected</span>
                        )}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {bulkMode ? (
                        <>
                            <button
                                onClick={() => setBulkEditOpen(true)}
                                disabled={selectedIds.size === 0}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: selectedIds.size > 0 ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${selectedIds.size > 0 ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.08)'}`,
                                    color: selectedIds.size > 0 ? '#818cf8' : '#71717a',
                                    fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase',
                                    letterSpacing: '0.05em', cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', gap: '0.375rem'
                                }}
                            >
                                <Tag size={14} /> Bulk Edit Category
                            </button>
                            <button
                                onClick={() => setBulkDeleteConfirm(true)}
                                disabled={selectedIds.size === 0}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: selectedIds.size > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${selectedIds.size > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.08)'}`,
                                    color: selectedIds.size > 0 ? '#f87171' : '#71717a',
                                    fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase',
                                    letterSpacing: '0.05em', cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', gap: '0.375rem'
                                }}
                            >
                                <Trash2 size={14} /> Delete Selected
                            </button>
                            <button
                                onClick={exitBulkMode}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: '#a1a1aa', fontWeight: 'bold', fontSize: '0.75rem',
                                    textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setBulkMode(true)}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                                    border: '1px solid rgba(234, 179, 8, 0.2)',
                                    color: '#eab308', fontWeight: 'bold', fontSize: '0.75rem',
                                    textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '0.375rem'
                                }}
                            >
                                <CheckSquare size={14} /> Bulk Edit
                            </button>
                            {hasActiveFilters && (
                                <button
                                    onClick={handleClearFilters}
                                    style={{
                                        padding: '0.5rem 1rem', borderRadius: '0.75rem',
                                        backgroundColor: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        color: '#a1a1aa', fontWeight: 'bold', fontSize: '0.75rem',
                                        textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer'
                                    }}
                                >
                                    Clear Filters
                                </button>
                            )}
                            <button
                                onClick={handleExport}
                                disabled={filteredTransactions.length === 0}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                    color: '#34d399', fontWeight: 'bold', fontSize: '0.75rem',
                                    textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                                    opacity: filteredTransactions.length === 0 ? 0.3 : 1
                                }}
                            >
                                <Download size={14} /> Export to Excel
                            </button>
                        </>
                    )}
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
                        <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
                        <select
                            value={categoryFilter}
                            onChange={(e) => { setCategoryFilter(e.target.value); setSubCategoryFilter('all'); }}
                            style={{ backgroundColor: 'transparent', border: 'none', color: categoryFilter !== 'all' ? '#eab308' : '#a1a1aa', fontSize: '11px', fontWeight: 'bold', padding: '0.5rem', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="all" style={{ backgroundColor: '#18181b' }}>All Categories</option>
                            {Object.keys(mergedCategoryMap).sort().map(cat => <option key={cat} value={cat} style={{ backgroundColor: '#18181b' }}>{cat}</option>)}
                        </select>
                        {categoryFilter !== 'all' && filterSubCategories.length > 0 && (
                            <>
                                <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
                                <select
                                    value={subCategoryFilter}
                                    onChange={(e) => setSubCategoryFilter(e.target.value)}
                                    style={{ backgroundColor: 'transparent', border: 'none', color: subCategoryFilter !== 'all' ? '#eab308' : '#a1a1aa', fontSize: '11px', fontWeight: 'bold', padding: '0.5rem', outline: 'none', cursor: 'pointer' }}
                                >
                                    <option value="all" style={{ backgroundColor: '#18181b' }}>All Sub-Categories</option>
                                    {filterSubCategories.map(s => <option key={s} value={s} style={{ backgroundColor: '#18181b' }}>{s}</option>)}
                                </select>
                            </>
                        )}
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
                                {bulkMode && (
                                    <th style={{ padding: '1rem 0.75rem 1rem 1.5rem', width: '40px' }}>
                                        <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', display: 'flex', alignItems: 'center' }}>
                                            {displayedTransactions.filter(t => t.id).every(t => selectedIds.has(t.id)) && displayedTransactions.filter(t => t.id).length > 0
                                                ? <CheckSquare size={16} style={{ color: '#eab308' }} />
                                                : <Square size={16} />
                                            }
                                        </button>
                                    </th>
                                )}
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Details</th>
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Mode</th>
                                <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                                {!bulkMode && <th style={{ padding: '1rem 1.5rem', width: '90px', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {displayedTransactions.length > 0 ? (
                                displayedTransactions.map((t) => (
                                    <tr 
                                        key={t.id || `${t.date}-${t.amount}-${t.title}`} 
                                        onClick={() => {
                                            if (bulkMode && t.id) {
                                                toggleSelect(t.id);
                                            } else if (t.id) {
                                                navigate(`/expenses/${t.year}/${t.month}?highlightTxId=${t.id}`);
                                            }
                                        }}
                                        style={{ 
                                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                                            cursor: t.id ? 'pointer' : 'default',
                                            transition: 'background-color 0.2s ease',
                                            backgroundColor: selectedIds.has(t.id) ? 'rgba(234, 179, 8, 0.06)' : 'transparent'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (t.id && !selectedIds.has(t.id)) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (t.id) e.currentTarget.style.backgroundColor = selectedIds.has(t.id) ? 'rgba(234, 179, 8, 0.06)' : 'transparent';
                                        }}
                                        title={bulkMode ? (t.id ? 'Click to select' : '') : (t.id ? 'Click to view in Monthly Statement' : '')}
                                    >
                                        {bulkMode && (
                                            <td style={{ padding: '1rem 0.75rem 1rem 1.5rem', width: '40px' }}>
                                                {t.id && (
                                                    selectedIds.has(t.id)
                                                        ? <CheckSquare size={16} style={{ color: '#eab308' }} />
                                                        : <Square size={16} style={{ color: '#71717a' }} />
                                                )}
                                            </td>
                                        )}
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
                                        {!bulkMode && (
                                            <td style={{ padding: '1rem 1rem 1rem 0.5rem' }}>
                                                {t.id && (
                                                    <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingTransaction(t); setIsModalOpen(true); }}
                                                            style={{
                                                                padding: '0.375rem', borderRadius: '0.5rem', border: 'none',
                                                                backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8',
                                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            title="Edit"
                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.25)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.1)'}
                                                        >
                                                            <Edit2 size={13} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(t.id); }}
                                                            style={{
                                                                padding: '0.375rem', borderRadius: '0.5rem', border: 'none',
                                                                backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171',
                                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            title="Delete"
                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={bulkMode ? 7 : 7} style={{ padding: '3rem', textAlign: 'center', color: '#71717a', fontSize: '0.875rem' }}>
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

            {/* Bulk Edit Category Modal */}
            {bulkEditOpen && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 2147483647,
                        padding: '1rem', backdropFilter: 'blur(4px)'
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) setBulkEditOpen(false); }}
                >
                    <div
                        style={{
                            width: '100%', maxWidth: '480px', backgroundColor: '#18181b',
                            border: '1px solid #27272a', borderRadius: '1.5rem',
                            overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <h3 style={{ margin: 0, color: 'white', fontWeight: '900', fontSize: '1.25rem' }}>
                                Bulk Edit Transactions
                            </h3>
                            <p style={{ margin: '0.375rem 0 0 0', color: '#71717a', fontSize: '0.8rem' }}>
                                Modify {selectedIds.size} selected transaction{selectedIds.size > 1 ? 's' : ''}
                            </p>
                        </div>
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '900', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Title / Description (Optional)</label>
                                <input
                                    type="text"
                                    value={bulkTitle}
                                    onChange={(e) => setBulkTitle(e.target.value)}
                                    placeholder="Leave blank to keep existing title..."
                                    style={{
                                        width: '100%', height: '3rem', backgroundColor: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem',
                                        color: 'white', padding: '0 1rem', fontSize: '0.875rem',
                                        fontWeight: 'bold', outline: 'none'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '900', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Main Category (Optional)</label>
                                <div style={{ position: 'relative' }}>
                                    <select
                                        value={bulkMainCategory}
                                        onChange={(e) => { setBulkMainCategory(e.target.value); setBulkSubCategory(''); }}
                                        style={{
                                            width: '100%', height: '3rem', backgroundColor: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem',
                                            color: 'white', padding: '0 1rem', fontSize: '0.875rem',
                                            fontWeight: 'bold', appearance: 'none', outline: 'none', cursor: 'pointer'
                                        }}
                                    >
                                        <option value="" style={{ backgroundColor: '#18181b' }}>Select Main Category (Keep Existing)</option>
                                        {Object.keys(mergedCategoryMap).map(cat => (
                                            <option key={cat} value={cat} style={{ backgroundColor: '#18181b' }}>{cat}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#71717a', pointerEvents: 'none' }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '900', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Sub Category (Optional)</label>
                                <div style={{ position: 'relative' }}>
                                    <select
                                        value={bulkSubCategory}
                                        onChange={(e) => setBulkSubCategory(e.target.value)}
                                        disabled={!bulkMainCategory}
                                        style={{
                                            width: '100%', height: '3rem', backgroundColor: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem',
                                            color: 'white', padding: '0 1rem', fontSize: '0.875rem',
                                            fontWeight: 'bold', appearance: 'none', outline: 'none',
                                            cursor: bulkMainCategory ? 'pointer' : 'not-allowed',
                                            opacity: bulkMainCategory ? 1 : 0.4
                                        }}
                                    >
                                        <option value="" style={{ backgroundColor: '#18181b' }}>Select Sub Category</option>
                                        {bulkSubCategories.map(cat => (
                                            <option key={cat} value={cat} style={{ backgroundColor: '#18181b' }}>{cat}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#71717a', pointerEvents: 'none' }} />
                                </div>
                            </div>
                            {/* Preview of selected transactions */}
                            <div style={{ maxHeight: '160px', overflowY: 'auto', borderRadius: '0.75rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.75rem' }}>
                                <p style={{ margin: '0 0 0.5rem 0', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Transactions</p>
                                {allTransactions.filter(t => selectedIds.has(t.id)).slice(0, 10).map(t => (
                                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <span style={{ color: '#a1a1aa', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{t.title}</span>
                                        <span style={{ color: '#71717a', fontSize: '0.7rem', textTransform: 'capitalize' }}>{t.category}</span>
                                    </div>
                                ))}
                                {selectedIds.size > 10 && (
                                    <p style={{ color: '#71717a', fontSize: '0.7rem', margin: '0.5rem 0 0 0' }}>...and {selectedIds.size - 10} more</p>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <button
                                onClick={() => { setBulkEditOpen(false); setBulkMainCategory(''); setBulkSubCategory(''); setBulkTitle(''); }}
                                style={{
                                    padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.1)',
                                    backgroundColor: 'transparent', color: 'white', fontWeight: 'bold',
                                    fontSize: '0.875rem', cursor: 'pointer'
                                }}
                            >Cancel</button>
                            <button
                                onClick={handleBulkCategoryUpdate}
                                disabled={!bulkSubCategory && !bulkTitle.trim()}
                                style={{
                                    padding: '0.75rem', borderRadius: '0.75rem', border: 'none',
                                    backgroundColor: (bulkSubCategory || bulkTitle.trim()) ? '#6366f1' : 'rgba(99, 102, 241, 0.3)',
                                    color: 'white', fontWeight: 'bold', fontSize: '0.875rem',
                                    cursor: (bulkSubCategory || bulkTitle.trim()) ? 'pointer' : 'not-allowed'
                                }}
                            >Apply to {selectedIds.size}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Transaction Modal */}
            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
                onAdd={handleSaveTransaction}
                initialData={editingTransaction}
            />

            {/* Delete Confirm Modal */}
            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
                onConfirm={confirmDelete}
                title="Delete Transaction"
                message="Are you sure you want to delete this transaction? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                type="danger"
            />

            {/* Bulk Delete Confirm Modal */}
            <ConfirmModal
                isOpen={bulkDeleteConfirm}
                onClose={() => setBulkDeleteConfirm(false)}
                onConfirm={handleBulkDelete}
                title="Delete Selected Transactions"
                message={`Are you sure you want to delete ${selectedIds.size} selected transaction${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.`}
                confirmText={`Delete ${selectedIds.size}`}
                cancelText="Cancel"
                type="danger"
            />
        </div>
    );
};

export default AllTransactions;
