import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, TrendingDown, Edit2, Trash2, Plus, Search, Settings, ChevronUp, ChevronDown, X, RefreshCw } from 'lucide-react';
import StockTransactionModal from '../components/StockTransactionModal';

const StockMarketDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem, refreshStockPrices } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshMessage, setRefreshMessage] = useState({ type: '', text: '' });
    const [editingStock, setEditingStock] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc' | null
    const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
    const [isManageColumnsModalOpen, setIsManageColumnsModalOpen] = useState(false);
    const [newColumnName, setNewColumnName] = useState('');

    const market = savings.find(s => s.id.toString() === id);

    if (!market) {
        return (
            <div style={{ padding: 'var(--spacing-lg)' }}>
                <p>Stock Market account not found.</p>
                <button
                    onClick={() => navigate(-1)}
                    className="text-primary hover:underline mt-4"
                >
                    Back to Savings
                </button>
            </div>
        );
    }

    const stocks = market.stocks || [];
    const customColumns = market.customColumns || [];

    // Filter stocks based on search term
    const filteredStocks = stocks.filter(stock =>
        stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.ticker.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Calculate aggregate stats
    let totalInvested = 0;
    let currentTotalValue = 0;
    let totalDividends = 0;

    const currentYear = new Date().getFullYear();
    const dividendYears = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

    const stockRows = filteredStocks.map(stock => {
        const investedValue = stock.shares * stock.avgCost;
        const currentValue = stock.shares * stock.currentPrice;
        const unrealisedPL = currentValue - investedValue;
        const unrealisedPercent = investedValue > 0 ? (unrealisedPL / investedValue) * 100 : 0;

        // Sum dividends
        const dividendsEarned = Object.values(stock.dividends || {}).reduce((sum, val) => sum + val, 0);

        totalInvested += investedValue;
        currentTotalValue += currentValue;
        totalDividends += dividendsEarned;

        return {
            ...stock,
            investedValue,
            currentValue,
            unrealisedPL,
            unrealisedPercent,
            dividendsEarned
        };
    });

    const totalProfitLoss = currentTotalValue - totalInvested;
    const isTotalProfit = totalProfitLoss >= 0;

    // Sort rows based on profit
    const sortedStockRows = [...stockRows].sort((a, b) => {
        if (!sortOrder) return 0;
        return sortOrder === 'desc'
            ? b.unrealisedPL - a.unrealisedPL
            : a.unrealisedPL - b.unrealisedPL;
    });

    const handleSaveStock = async (stockData) => {
        let updatedStocks;
        const existingStockIndex = stocks.findIndex(s => s.id === stockData.id);

        if (existingStockIndex >= 0) {
            updatedStocks = [...stocks];
            // Preserve existing transactions when editing
            updatedStocks[existingStockIndex] = {
                ...stockData,
                transactions: stocks[existingStockIndex].transactions || []
            };
        } else {
            // New stock: Create initial transaction if shares > 0
            let initialTransactions = [];
            if (stockData.shares > 0) {
                initialTransactions.push({
                    id: Date.now().toString(),
                    date: new Date().toISOString().split('T')[0],
                    type: 'buy',
                    quantity: Number(stockData.shares),
                    price: Number(stockData.avgCost),
                    remarks: 'Initial Balance'
                });
            }
            updatedStocks = [...stocks, { ...stockData, transactions: initialTransactions }];
        }

        const updatedMarket = { ...market, stocks: updatedStocks };
        await updateItem('savings', updatedMarket);
        setIsModalOpen(false);
        setEditingStock(null);
    };

    const handleDeleteStock = async (stockId) => {
        if (window.confirm('Are you sure you want to delete this stock?')) {
            const updatedStocks = stocks.filter(s => s.id !== stockId);
            const updatedMarket = { ...market, stocks: updatedStocks };
            await updateItem('savings', updatedMarket);
        }
    };

    const handleAddColumn = async (e) => {
        e.preventDefault();
        if (!newColumnName.trim()) return;

        const updatedColumns = [...customColumns, newColumnName.trim()];
        const updatedMarket = { ...market, customColumns: updatedColumns };
        await updateItem('savings', updatedMarket);

        setNewColumnName('');
        setIsAddColumnModalOpen(false);
        setIsAddColumnModalOpen(false);
    };

    const handleMoveColumn = async (index, direction) => {
        if (index + direction < 0 || index + direction >= customColumns.length) return;

        const newColumns = [...customColumns];
        const temp = newColumns[index];
        newColumns[index] = newColumns[index + direction];
        newColumns[index + direction] = temp;

        const updatedMarket = { ...market, customColumns: newColumns };
        await updateItem('savings', updatedMarket);
    };

    const handleDeleteCustomColumn = async (index) => {
        if (window.confirm(`Delete column "${customColumns[index]}"? This will hide the data.`)) {
            const newColumns = customColumns.filter((_, i) => i !== index);
            const updatedMarket = { ...market, customColumns: newColumns };
            await updateItem('savings', updatedMarket);
        }
    };
    const handleRefreshPrices = async () => {
        setIsRefreshing(true);
        setRefreshMessage({ type: '', text: '' });
        const result = await refreshStockPrices(id);
        setIsRefreshing(false);
        if (result.success) {
            setRefreshMessage({ type: 'success', text: 'Prices updated successfully!' });
            setTimeout(() => setRefreshMessage({ type: '', text: '' }), 3000);
        } else {
            setRefreshMessage({ type: 'error', text: result.message || 'Failed to refresh prices' });
            setTimeout(() => setRefreshMessage({ type: '', text: '' }), 5000);
        }
    };

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 hover:text-primary transition-colors mb-6"
                style={{ cursor: 'pointer', marginBottom: 'var(--spacing-lg)', color: 'white' }}
            >
                <ArrowLeft size={20} /> Back to Savings
            </button>

            <div className="mb-8 flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                    <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <TrendingUp className="text-accent-primary" size={32} />
                        {market.title}
                    </h2>
                    <p className="text-secondary">Portfolio Performance Overview</p>
                </div>

                <div className="flex gap-4 items-center">
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="Search stocks..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white/5 border border-white/10 text-white px-4 py-2 pl-10 rounded-lg focus:outline-none focus:border-indigo-500 w-64 transition-all"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    </div>

                    <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                        <button
                            onClick={() => setIsManageColumnsModalOpen(true)}
                            className="px-3 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Manage Columns"
                        >
                            <Settings size={16} />
                        </button>
                        <div className="w-[1px] bg-white/10 my-1 mx-1"></div>
                        <button
                            onClick={() => setSortOrder('desc')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${sortOrder === 'desc' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                        >
                            <TrendingUp size={16} />
                        </button>
                        <button
                            onClick={() => setSortOrder('asc')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${sortOrder === 'asc' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                        >
                            <TrendingDown size={16} />
                        </button>
                    </div>

                    <button
                        onClick={() => setIsAddColumnModalOpen(true)}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                    >
                        <Plus size={18} />
                        <span>Add Column</span>
                    </button>

                    <button
                        onClick={handleRefreshPrices}
                        disabled={isRefreshing}
                        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${isRefreshing ? 'bg-gray-700 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20'}`}
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                        <span>{isRefreshing ? 'Refreshing...' : 'Refresh Prices'}</span>
                    </button>

                    <button
                        onClick={() => {
                            setEditingStock(null);
                            setIsModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                    >
                        <Plus size={18} />
                        <span>Add Stock</span>
                    </button>
                </div>
            </div>

            {refreshMessage.text && (
                <div style={{
                    position: 'fixed',
                    top: '80px',
                    right: '2rem',
                    padding: '1rem 1.5rem',
                    borderRadius: '12px',
                    backgroundColor: refreshMessage.type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    zIndex: 100,
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    {refreshMessage.type === 'success' ? <TrendingUp size={20} /> : <X size={20} onClick={() => setRefreshMessage({ type: '', text: '' })} style={{ cursor: 'pointer' }} />}
                    <span className="font-medium">{refreshMessage.text}</span>
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                <div className="card">
                    <p className="text-white text-sm mb-1">Total Invested Amount</p>
                    <p className="font-bold text-lg">{formatCurrency(totalInvested)}</p>
                </div>
                <div className="card">
                    <p className="text-white text-sm mb-1">Current Value</p>
                    <p className="font-bold text-lg">{formatCurrency(currentTotalValue)}</p>
                </div>
                <div className="card">
                    <p className="text-white text-sm mb-1">Total Profit/Loss</p>
                    <div className={`font-bold text-lg flex items-center gap-2 ${isTotalProfit ? 'text-success' : 'text-danger'}`}>
                        {isTotalProfit ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                        {formatCurrency(Math.abs(totalProfitLoss))}
                    </div>
                </div>
                <div className="card">
                    <p className="text-white text-sm mb-1">Total Dividends Recd</p>
                    <div className="font-bold text-lg flex items-center gap-2 text-success">
                        {formatCurrency(totalDividends)}
                    </div>
                </div>
            </div>


            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1500px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'white' }}>Company Name</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'white' }}>Ticker</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'white' }}>Shares Held</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'white' }}>Avg Cost</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'white' }}>Invested Value</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'white' }}>Current Price</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'white' }}>Current Value</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'white' }}>Unrealised P/L</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'white' }}>Unrealised %</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'white' }}>Dividends Earned</th>
                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'white' }}>Remarks</th>
                            {/* Dividend Years */}
                            {dividendYears.map((year, idx) => (
                                <th key={year} style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'white' }}>
                                    {year === currentYear.toString() ? year : `Div ${year}`}
                                </th>
                            ))}

                            {/* Custom Columns Headers */}
                            {customColumns.map((col, idx) => (
                                <th key={idx} style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: '#a78bfa' }}>{col}</th>
                            ))}

                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'white', position: 'sticky', right: 0, backgroundColor: '#1e1e1e', zIndex: 10 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedStockRows.map((stock) => {
                            const isProfit = stock.unrealisedPL >= 0;
                            return (
                                <tr key={stock.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                    <td
                                        style={{ padding: 'var(--spacing-md)', color: 'var(--text-primary)', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => navigate(`/savings/stock-market/${id}/stock/${stock.id}`)}
                                    >
                                        {stock.name}
                                    </td>
                                    <td style={{ padding: 'var(--spacing-md)', fontFamily: 'monospace' }}>{stock.ticker}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>{stock.shares}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(stock.avgCost)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(stock.investedValue)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(stock.currentPrice)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{formatCurrency(stock.currentValue)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace', color: isProfit ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                        {formatCurrency(stock.unrealisedPL)}
                                    </td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace', color: isProfit ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                        {stock.unrealisedPercent.toFixed(2)}%
                                    </td>
                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-success)' }}>{formatCurrency(stock.dividendsEarned)}</td>
                                    <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>{stock.remarks}</td>

                                    {dividendYears.map(year => (
                                        <td key={year} style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontFamily: 'monospace' }}>
                                            {formatCurrency(stock.dividends?.[year] || 0)}
                                        </td>
                                    ))}

                                    {/* Custom Columns Cells */}
                                    {customColumns.map((col, idx) => (
                                        <td key={idx} style={{ padding: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
                                            {stock.customValues?.[col] || '-'}
                                        </td>
                                    ))}

                                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'center', position: 'sticky', right: 0, backgroundColor: '#1e1e1e', boxShadow: '-5px 0 10px rgba(0,0,0,0.1)' }}>
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingStock(stock);
                                                    setIsModalOpen(true);
                                                }}
                                                className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteStock(stock.id)}
                                                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {sortedStockRows.length === 0 && (
                            <tr>
                                <td colSpan={17} className="text-center py-8 text-gray-500">
                                    No stocks found. Add one to get started!
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <StockTransactionModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingStock(null);
                }}
                onSave={handleSaveStock}
                initialData={editingStock}
                customColumns={customColumns}
            />

            {/* Add Column Modal */}
            {isAddColumnModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 100
                }}>
                    <div className="bg-[#18181b] p-6 rounded-2xl border border-white/10 w-96 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Add Custom Column</h3>
                        <form onSubmit={handleAddColumn}>
                            <input
                                type="text"
                                placeholder="Column Name (e.g. PE Ratio)"
                                value={newColumnName}
                                onChange={(e) => setNewColumnName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white mb-4 focus:outline-none focus:border-indigo-500"
                                autoFocus
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddColumnModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-gray-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                                >
                                    Add Column
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manage Columns Modal */}
            {isManageColumnsModalOpen && createPortal(
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 2147483647,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div className="bg-[#18181b] rounded-2xl border border-white/10 w-96 shadow-2xl flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                            <h3 className="text-xl font-bold text-white">Manage Columns</h3>
                            <button onClick={() => setIsManageColumnsModalOpen(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                            {customColumns.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">No custom columns added.</p>
                            ) : (
                                <div className="space-y-2">
                                    {customColumns.map((col, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                            <span className="text-white font-medium">{col}</span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleMoveColumn(idx, -1)}
                                                    disabled={idx === 0}
                                                    className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30"
                                                >
                                                    <ChevronUp size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleMoveColumn(idx, 1)}
                                                    disabled={idx === customColumns.length - 1}
                                                    className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30"
                                                >
                                                    <ChevronDown size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCustomColumn(idx)}
                                                    className="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 ml-2"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default StockMarketDetails;

