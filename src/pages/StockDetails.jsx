import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, Plus, Edit2, Trash2, X, Save, TrendingDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import StockTransactionModal from '../components/StockTransactionModal';
import ConfirmModal from '../components/ConfirmModal';

const StockDetails = () => {
    const { id, stockId } = useParams();
    const navigate = useNavigate();
    const { savings, updateItem, formatCurrency } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [isEditStockModalOpen, setIsEditStockModalOpen] = useState(false);
    const [editingDividend, setEditingDividend] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [txToDelete, setTxToDelete] = useState(null);

    // Find Market and Stock
    const market = savings.find(s => s.id.toString() === id);
    const stock = market?.stocks?.find(s => s.id.toString() === stockId);

    if (!market || !stock) {
        return <div className="p-8 text-white">Stock not found.</div>;
    }

    const transactions = stock.transactions || [];

    // Synthetic Initial Transaction for Legacy Data
    // If no transactions exist but we have shares, show an "Initial Balance" entry
    const effectiveTransactions = [...transactions];
    if (effectiveTransactions.length === 0 && stock.shares > 0) {
        effectiveTransactions.push({
            id: 'synthetic-initial',
            date: '2020-01-01', // Fallback date
            type: 'buy',
            quantity: Number(stock.shares),
            price: Number(stock.avgCost),
            remarks: 'Initial Balance (Legacy Data)'
        });
    }

    // Sorting transactions by date descending
    const sortedTransactions = [...effectiveTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    const recalculateStockMetrics = (txList) => {
        let currentShares = 0;
        let totalCost = 0; // Keeping track of total cost basis
        let calculatedDividends = {};

        // Sort by date ascending for accurate history replay
        const chronologicalTx = [...txList].sort((a, b) => new Date(a.date) - new Date(b.date));

        chronologicalTx.forEach(tx => {
            const qty = Number(tx.quantity) || 0;
            const price = Number(tx.price) || 0;

            if (tx.type === 'buy' || tx.type === 'ipo') {
                // Buy/IPO: Increase shares and total cost
                if (currentShares === 0) {
                    totalCost = qty * price;
                } else {
                    totalCost += (qty * price);
                }
                currentShares += qty;
            } else if (tx.type === 'sell' || tx.type === 'buyback') {
                // Sell/Buyback: Decrease shares, reduce total cost proportionally
                const avgCost = currentShares > 0 ? totalCost / currentShares : 0;
                currentShares = Math.max(0, currentShares - qty);
                totalCost = currentShares * avgCost;
            } else if (tx.type === 'bonus') {
                // Bonus: Shares increase by quantity
                currentShares += qty;
            } else if (tx.type === 'split') {
                // Split: Apply ratio if available, else add quantity
                if (tx.splitFrom && tx.splitTo) {
                    currentShares = currentShares * (tx.splitTo / tx.splitFrom);
                } else {
                    currentShares += qty;
                }
            } else if (tx.type === 'demerger') {
                // Demerger: Add shares (if any) and reset the Cost Basis to (Shares * New Price)
                currentShares += qty;
                totalCost = currentShares * price;
            } else if (tx.type === 'dividend') {
                const year = new Date(tx.date).getFullYear().toString();
                calculatedDividends[year] = (calculatedDividends[year] || 0) + price;
            }
        });

        const finalAvgCost = currentShares > 0 ? totalCost / currentShares : 0;
        return { shares: currentShares, avgCost: finalAvgCost, dividends: calculatedDividends };
    };

    const handleSaveTransaction = async (txData) => {
        const updatedTransactions = editingTx
            ? transactions.map(t => t.id === txData.id ? txData : t)
            : [...transactions, { ...txData, id: Date.now().toString() }];

        const { shares, avgCost, dividends } = recalculateStockMetrics(updatedTransactions);

        // Update Stock
        const updatedStocks = market.stocks.map(s => {
            if (s.id.toString() === stockId) {
                return {
                    ...s,
                    transactions: updatedTransactions,
                    shares,
                    avgCost,
                    dividends: { ...s.dividends, ...dividends } // Merge to keep manual edits if needed, or strictly replace? Prioritizing calc.
                    // Actually, let's strictly replace the calculated years to prevent drift, but keep others?
                    // User asked for "automatic update". Let's assume transactions are source of truth for these years.
                    // But we have 5 years. Let's merge carefully.
                    // If we want FULL automation, we should replace S.dividends with calculatedDividends for those years.
                    // For now, let's merge: calculated overrides existing for those years.
                };
            }
            return s;
        });

        const updatedMarket = { ...market, stocks: updatedStocks };
        await updateItem('savings', updatedMarket);
        setIsModalOpen(false);
        setEditingTx(null);
    };

    const handleDeleteTransaction = async (txId) => {
        setTxToDelete(txId);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteTransaction = async () => {
        if (!txToDelete) return;
        const updatedTransactions = transactions.filter(t => String(t.id) !== String(txToDelete));

        const { shares, avgCost, dividends } = recalculateStockMetrics(updatedTransactions);

        const updatedStocks = market.stocks.map(s => {
            if (String(s.id) === String(stockId)) return {
                ...s,
                transactions: updatedTransactions,
                shares,
                avgCost,
                dividends: { ...s.dividends, ...dividends }
            };
            return s;
        });
        const updatedMarket = { ...market, stocks: updatedStocks };
        await updateItem('savings', updatedMarket);
        setTxToDelete(null);
    };

    const handleUpdateStock = async (updatedStockData) => {
        const updatedStocks = market.stocks.map(s => {
            if (s.id.toString() === stockId) {
                // Preserve transactions while updating other details
                return { ...updatedStockData, transactions: s.transactions };
            }
            return s;
        });
        const updatedMarket = { ...market, stocks: updatedStocks };
        await updateItem('savings', updatedMarket);
        setIsEditStockModalOpen(false);
        setIsEditStockModalOpen(false);
    };

    const handleSaveDividend = async (year, amount) => {
        const currentDividends = stock.dividends || {};
        const updatedDividends = { ...currentDividends, [year]: parseFloat(amount) };

        const updatedStock = { ...stock, dividends: updatedDividends };

        const updatedStocks = market.stocks.map(s => {
            if (s.id.toString() === stockId) return updatedStock;
            return s;
        });

        const updatedMarket = { ...market, stocks: updatedStocks };
        await updateItem('savings', updatedMarket);
        setEditingDividend(null);
    };

    // Summary Calculations
    const totalBuyValue = transactions.reduce((sum, tx) => {
        if (['buy', 'ipo', 'demerger'].includes(tx.type)) {
            return sum + (Number(tx.quantity) * Number(tx.price));
        }
        return sum;
    }, 0);

    const totalSellValue = transactions.reduce((sum, tx) => {
        if (['sell', 'buyback'].includes(tx.type)) {
            return sum + (Number(tx.quantity) * Number(tx.price));
        }
        return sum;
    }, 0);

    const totalInvested = stock.shares * stock.avgCost;
    const currentValue = stock.shares * stock.currentPrice;
    const unrealizedPL = currentValue - totalInvested;
    const wholePL = (currentValue + totalSellValue) - totalBuyValue;
    const isProfit = wholePL >= 0;
    const dividendEarned = Object.values(stock.dividends || {}).reduce((sum, val) => sum + val, 0);

    const currentYear = new Date().getFullYear();
    const dividendYears = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 hover:text-primary transition-colors mb-6 text-white"
            >
                <ArrowLeft size={20} /> Back to Market
            </button>

            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <TrendingUp className="text-accent-primary" size={32} />
                        {stock.name} <span className="text-gray-500 text-lg">({stock.ticker})</span>
                    </h2>
                    <div className="flex gap-4 mt-4">
                        <div className="card p-4 min-w-[150px]">
                            <p className="text-xs text-secondary uppercase font-bold">Quantity Held</p>
                            <p className="text-xl font-bold">{stock.shares}</p>
                        </div>
                        <div className="card p-4 min-w-[150px]">
                            <p className="text-xs text-secondary uppercase font-bold">Avg Price</p>
                            <p className="text-xl font-bold">{formatCurrency(stock.avgCost)}</p>
                        </div>
                        <div className="card p-4 min-w-[150px]">
                            <p className="text-xs text-secondary uppercase font-bold">Current Price</p>
                            <p className="text-xl font-bold">{formatCurrency(stock.currentPrice)}</p>
                        </div>
                        <div className="card p-4 min-w-[150px]">
                            <p className="text-xs text-secondary uppercase font-bold">Current Value</p>
                            <p className="text-xl font-bold text-accent-primary">{formatCurrency(currentValue)}</p>
                        </div>
                        <div className="card p-4 min-w-[150px]">
                            <p className="text-xs text-secondary uppercase font-bold">Total Invested</p>
                            <p className="text-xl font-bold">{formatCurrency(totalInvested)}</p>
                        </div>
                        <div className="card p-4 min-w-[150px]">
                            <p className="text-xs text-secondary uppercase font-bold">Unrealized P/L</p>
                            <div className={`text-xl font-bold flex items-center gap-1 ${unrealizedPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {unrealizedPL >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                {formatCurrency(Math.abs(unrealizedPL))}
                            </div>
                        </div>
                        <div className="card p-4 min-w-[150px]">
                            <p className="text-xs text-secondary uppercase font-bold">Whole P/L</p>
                            <div className={`text-xl font-bold flex items-center gap-1 ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                {isProfit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                {formatCurrency(Math.abs(wholePL))}
                            </div>
                        </div>
                        <div className="card p-4 min-w-[150px]">
                            <p className="text-xs text-secondary uppercase font-bold">Net Invested</p>
                            <p className="text-xl font-bold">{formatCurrency(totalBuyValue - totalSellValue)}</p>
                        </div>
                        <div className="card p-4 min-w-[150px]">
                            <p className="text-xs text-secondary uppercase font-bold">Dividends Earned</p>
                            <p className="text-xl font-bold text-green-500">{formatCurrency(dividendEarned)}</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsEditStockModalOpen(true)}
                        className="px-4 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-all flex items-center gap-2"
                    >
                        <Edit2 size={18} /> Edit Details
                    </button>
                    <button
                        onClick={() => { setEditingTx(null); setIsModalOpen(true); }}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all flex items-center gap-2"
                    >
                        <Plus size={18} /> Add Transaction
                    </button>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                            <th className="p-4 text-left text-white">Date</th>
                            <th className="p-4 text-left text-white">Type</th>
                            <th className="p-4 text-right text-white">Quantity</th>
                            <th className="p-4 text-right text-white">Price</th>
                            <th className="p-4 text-right text-white">Total Value</th>
                            <th className="p-4 text-right text-white">P/L</th>
                            <th className="p-4 text-center text-white">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedTransactions.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-500">No transactions recorded.</td></tr>
                        ) : (
                            sortedTransactions.map(tx => (
                                <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                    <td className="p-4 text-gray-300">
                                        {new Date(tx.date).toLocaleDateString()}
                                        {tx.id === 'synthetic-initial' && <span className="ml-2 text-xs text-yellow-500">(Auto-generated)</span>}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${['buy', 'ipo', 'bonus', 'split'].includes(tx.type) ? 'bg-green-500/20 text-green-400' :
                                            ['sell', 'buyback'].includes(tx.type) ? 'bg-red-500/20 text-red-400' :
                                                tx.type === 'demerger' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {tx.type.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-mono">
                                        {tx.type === 'dividend' || tx.type === 'demerger' ? '-' :
                                            tx.type === 'split' && tx.splitFrom && tx.splitTo ? `${tx.splitFrom}:${tx.splitTo}` :
                                                tx.quantity}
                                    </td>
                                    <td className="p-4 text-right font-mono">{['dividend', 'bonus', 'split'].includes(tx.type) ? '-' : formatCurrency(tx.price)}</td>
                                    <td className="p-4 text-right font-mono font-bold">
                                        {tx.type === 'dividend' ? formatCurrency(tx.price) :
                                            ['bonus', 'split'].includes(tx.type) ? '-' :
                                                tx.type === 'demerger' ? 'Adjusted' :
                                                    formatCurrency(tx.quantity * tx.price)}
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold">
                                        {tx.type === 'buy' ? (
                                            (() => {
                                                const pl = (stock.currentPrice - tx.price) * tx.quantity;
                                                const isProfitable = pl >= 0;
                                                return (
                                                    <span className={isProfitable ? 'text-green-500' : 'text-red-500'}>
                                                        {formatCurrency(pl)}
                                                    </span>
                                                );
                                            })()
                                        ) : (
                                            <span className="text-gray-500">-</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => {
                                                // If editing synthetic, we treat it as adding a new one filled with data
                                                if (tx.id === 'synthetic-initial') {
                                                    setEditingTx({ ...tx, id: undefined, date: new Date().toISOString().split('T')[0] });
                                                } else {
                                                    setEditingTx(tx);
                                                }
                                                setIsModalOpen(true);
                                            }} className="p-1.5 rounded hover:bg-white/10 text-blue-400">
                                                <Edit2 size={16} />
                                            </button>
                                            {tx.id !== 'synthetic-initial' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteTransaction(tx.id);
                                                    }}
                                                    className="p-1.5 rounded hover:bg-white/10 text-red-400"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>


            <div className="mt-8">
                <h3 className="text-2xl font-bold mb-4 text-white">Dividends History</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {dividendYears.map(year => (
                        <div
                            key={year}
                            className="card p-4 bg-[#1e1e1e] border border-white/5 cursor-pointer hover:bg-white/10 transition-all group relative"
                            onClick={() => setEditingDividend({ year, amount: stock.dividends?.[year] || 0 })}
                        >
                            <p className="text-sm text-gray-400 mb-1 flex justify-between items-center">
                                {year}
                                <Edit2 size={12} className="opacity-0 group-hover:opacity-100 text-indigo-400" />
                            </p>
                            <p className="text-lg font-bold text-green-400">{formatCurrency(stock.dividends?.[year] || 0)}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit Dividend Modal */}
            {editingDividend && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1100,
                    backdropFilter: 'blur(4px)'
                }} onClick={() => setEditingDividend(null)}>
                    <div className="bg-[#18181b] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-4">Edit {editingDividend.year} Dividend</h3>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            // If we switch to transaction-based dividends, this manual override might conflict or be overwritten.
                            // But user asked for "Add Transactions", so we should encourage that. 
                            // However, let's keep this manual edit for quick fixes, maybe treating it as a 'correction' or just updating the source?
                            // If we update here, next recalculate will overwrite it unless we also ADD a transaction!
                            // Creating a manual correction transaction might be clever?
                            // For simplicty, let's just update the db.json directly like before, acknowledging it might be reset if a transaction is added later.
                            handleSaveDividend(editingDividend.year, e.target.amount.value);
                        }}>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Amount</label>
                                <input
                                    name="amount"
                                    type="number"
                                    step="0.01"
                                    defaultValue={editingDividend.amount}
                                    autoFocus
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setEditingDividend(null)} className="flex-1 py-2 rounded-lg bg-gray-700 text-white font-medium hover:bg-gray-600">Cancel</button>
                                <button type="submit" className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveTransaction}
                initialData={editingTx}
            />

            <StockTransactionModal
                isOpen={isEditStockModalOpen}
                onClose={() => setIsEditStockModalOpen(false)}
                onSave={handleUpdateStock}
                initialData={stock}
                customColumns={market.customColumns || []}
            />

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setTxToDelete(null);
                }}
                onConfirm={confirmDeleteTransaction}
                title="Delete Transaction"
                message="Are you sure you want to delete this transaction? This will automatically recalculate your stock metrics."
                confirmText="Delete"
            />
        </div>
    );
};

const TransactionModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState('buy');
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [splitFrom, setSplitFrom] = useState('');
    const [splitTo, setSplitTo] = useState('');

    React.useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setDate(initialData.date);
                setType(initialData.type);
                setQuantity(initialData.quantity);
                setPrice(initialData.price);
                setSplitFrom(initialData.splitFrom || '');
                setSplitTo(initialData.splitTo || '');
            } else {
                setDate(new Date().toISOString().split('T')[0]);
                setType('buy');
                setQuantity('');
                setPrice('');
                setSplitFrom('');
                setSplitTo('');
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            id: initialData?.id,
            date,
            type,
            quantity: Number(quantity),
            price: Number(price),
            splitFrom: type === 'split' ? Number(splitFrom) : undefined,
            splitTo: type === 'split' ? Number(splitTo) : undefined
        });
    };

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }} onClick={onClose}>
            <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">{initialData ? 'Edit' : 'Add'} Transaction</h3>
                    <button onClick={onClose}><X className="text-gray-400 hover:text-white" size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Date</label>
                        <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Type</label>
                        <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500">
                            <option value="buy">Buy</option>
                            <option value="sell">Sell</option>
                            <option value="dividend">Dividend</option>
                            <option value="bonus">Bonus</option>
                            <option value="split">Split</option>
                            <option value="ipo">IPO</option>
                            <option value="buyback">Buyback</option>
                            <option value="demerger">Demerger</option>
                        </select>
                    </div>
                    {type === 'split' ? (
                        <div className="flex gap-4 items-center">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ratio From.</label>
                                <input type="number" required={type === 'split'} value={splitFrom} onChange={e => setSplitFrom(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" placeholder="1" />
                            </div>
                            <span className="text-xl font-bold text-gray-400 mt-4">:</span>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ratio To.</label>
                                <input type="number" required={type === 'split'} value={splitTo} onChange={e => setSplitTo(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" placeholder="10" />
                            </div>
                        </div>
                    ) : (type !== 'dividend') && (
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                                {type === 'demerger' ? 'Shares Received' : 'Quantity'}
                            </label>
                            <input type="number" required value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" placeholder="0" />
                        </div>
                    )}
                    {['buy', 'sell', 'ipo', 'buyback', 'dividend', 'demerger'].includes(type) && (
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                                {type === 'dividend' ? 'Total Dividend Amount' : type === 'demerger' ? 'New Average Price' : 'Price per share'}
                            </label>
                            <input type="number" step="0.01" required value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" placeholder="0.00" />
                        </div>
                    )}
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors mt-2">
                        Save Transaction
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default StockDetails;
