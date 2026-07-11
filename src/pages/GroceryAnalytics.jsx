import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ShoppingBag, TrendingDown, TrendingUp, Search, Calendar, Tags, Package } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label, formatCurrency }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#18181b] border border-white/10 p-3 rounded-xl shadow-xl">
                <p className="text-white font-bold mb-2">{label}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex justify-between items-center gap-4 text-sm mb-1">
                        <span style={{ color: entry.color }}>{entry.name}</span>
                        <span className="font-mono text-white">
                            {entry.name === 'Total Price' ? formatCurrency(entry.value) : entry.value}
                        </span>
                    </div>
                ))}
                {payload[0]?.payload?.quantity && (
                    <div className="flex justify-between items-center gap-4 text-xs mt-2 text-gray-500">
                        <span>Quantity</span>
                        <span className="font-mono">{payload[0].payload.quantity}</span>
                    </div>
                )}
            </div>
        );
    }
    return null;
};

const GroceryAnalytics = () => {
    const { expenses, formatCurrency } = useFinance();
    const navigate = useNavigate();
    
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedItem, setSelectedItem] = useState('All');
    const [selectedBrand, setSelectedBrand] = useState('All');
    const [selectedFlavour, setSelectedFlavour] = useState('All');
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, selectedItem, selectedBrand, selectedFlavour, rowsPerPage]);

    // Flatten all grocery items from all transactions
    const allGroceries = useMemo(() => {
        const items = [];
        if (!expenses) return items;
        
        Object.entries(expenses).forEach(([year, months]) => {
            Object.entries(months).forEach(([month, data]) => {
                if (data.transactions) {
                    data.transactions.forEach(tx => {
                        if (tx.groceryItems && tx.groceryItems.length > 0) {
                            tx.groceryItems.forEach(gi => {
                                if (gi.name === 'GST / Carry Bag') return;
                                
                                items.push({
                                    ...gi,
                                    date: new Date(tx.date),
                                    timestamp: new Date(tx.date).getTime(),
                                    transactionId: tx.id,
                                    month,
                                    year,
                                    // ensure properties exist to avoid undefined
                                    subcategory: gi.subcategory || 'Uncategorized',
                                    name: gi.name || 'Unknown Item',
                                    brand: gi.brand || '',
                                    flavour: gi.flavour || '',
                                    price: Number(gi.price) || 0,
                                    quantity: gi.quantity === 'Custom' ? gi.customQuantity : gi.quantity
                                });
                            });
                        }
                    });
                }
            });
        });
        
        return items.sort((a, b) => b.timestamp - a.timestamp);
    }, [expenses]);

    // Derived options for filters based on actual data
    const filterOptions = useMemo(() => {
        const categories = new Set();
        const items = new Set();
        const brands = new Set();
        const flavours = new Set();

        allGroceries.forEach(gi => {
            categories.add(gi.subcategory);
            
            // Only add to child filters if parent filter matches
            if (selectedCategory === 'All' || gi.subcategory === selectedCategory) {
                items.add(gi.name);
            }
            
            if ((selectedCategory === 'All' || gi.subcategory === selectedCategory) && 
                (selectedItem === 'All' || gi.name === selectedItem)) {
                if (gi.brand) brands.add(gi.brand);
            }
            
            if ((selectedCategory === 'All' || gi.subcategory === selectedCategory) && 
                (selectedItem === 'All' || gi.name === selectedItem) &&
                (selectedBrand === 'All' || gi.brand === selectedBrand)) {
                if (gi.flavour) flavours.add(gi.flavour);
            }
        });

        return {
            categories: Array.from(categories).sort(),
            items: Array.from(items).sort(),
            brands: Array.from(brands).sort(),
            flavours: Array.from(flavours).sort()
        };
    }, [allGroceries, selectedCategory, selectedItem, selectedBrand]);

    // Filtered data for display
    const filteredData = useMemo(() => {
        return allGroceries.filter(gi => {
            const matchCat = selectedCategory === 'All' || gi.subcategory === selectedCategory;
            const matchItem = selectedItem === 'All' || gi.name === selectedItem;
            const matchBrand = selectedBrand === 'All' || gi.brand === selectedBrand;
            const matchFlavour = selectedFlavour === 'All' || gi.flavour === selectedFlavour;
            return matchCat && matchItem && matchBrand && matchFlavour;
        });
    }, [allGroceries, selectedCategory, selectedItem, selectedBrand, selectedFlavour]);

    // Stats calculation
    const stats = useMemo(() => {
        let totalSpent = 0;
        let totalItems = 0;
        
        filteredData.forEach(gi => {
            totalSpent += gi.price;
            totalItems += 1;
        });
        
        return {
            totalSpent,
            totalItems,
            avgPrice: totalItems > 0 ? totalSpent / totalItems : 0
        };
    }, [filteredData]);

    // Chart Data mapping
    const chartData = useMemo(() => {
        // Reverse to show chronological order
        return [...filteredData].reverse().map(gi => ({
            date: gi.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            'Total Price': gi.price,
            quantity: gi.quantity
        }));
    }, [filteredData]);

    // Pagination limits
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const paginatedData = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                        <ShoppingBag className="text-emerald-500" size={28} />
                        Grocery Analytics
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">Track prices and purchase history of your groceries</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-[#18181b] border border-white/5 p-4 rounded-3xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Category</label>
                    <select
                        value={selectedCategory}
                        onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            setSelectedItem('All');
                            setSelectedBrand('All');
                            setSelectedFlavour('All');
                        }}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm font-medium text-white focus:border-emerald-500/50 focus:outline-none transition-colors appearance-none cursor-pointer"
                    >
                        <option value="All">All Categories</option>
                        {filterOptions.categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Product</label>
                    <select
                        value={selectedItem}
                        onChange={(e) => {
                            setSelectedItem(e.target.value);
                            setSelectedBrand('All');
                            setSelectedFlavour('All');
                        }}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm font-medium text-white focus:border-emerald-500/50 focus:outline-none transition-colors appearance-none cursor-pointer"
                    >
                        <option value="All">All Products</option>
                        {filterOptions.items.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Brand</label>
                    <select
                        value={selectedBrand}
                        onChange={(e) => {
                            setSelectedBrand(e.target.value);
                            setSelectedFlavour('All');
                        }}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm font-medium text-white focus:border-emerald-500/50 focus:outline-none transition-colors appearance-none cursor-pointer disabled:opacity-50"
                        disabled={filterOptions.brands.length === 0}
                    >
                        <option value="All">All Brands</option>
                        {filterOptions.brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Flavour / Variant</label>
                    <select
                        value={selectedFlavour}
                        onChange={(e) => setSelectedFlavour(e.target.value)}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm font-medium text-white focus:border-emerald-500/50 focus:outline-none transition-colors appearance-none cursor-pointer disabled:opacity-50"
                        disabled={filterOptions.flavours.length === 0}
                    >
                        <option value="All">All Flavours</option>
                        {filterOptions.flavours.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#18181b] border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
                        <ShoppingBag size={64} className="text-emerald-500" />
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Spent</p>
                    <p className="text-3xl font-black text-white">{formatCurrency(stats.totalSpent)}</p>
                </div>
                <div className="bg-[#18181b] border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
                        <Package size={64} className="text-blue-500" />
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Items Bought</p>
                    <p className="text-3xl font-black text-white">{stats.totalItems}</p>
                </div>
                <div className="bg-[#18181b] border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
                        <Tags size={64} className="text-purple-500" />
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Avg. Price / Item</p>
                    <p className="text-3xl font-black text-white">{formatCurrency(stats.avgPrice)}</p>
                </div>
            </div>

            {/* Price History Chart */}
            <div className="bg-[#18181b] border border-white/5 p-6 rounded-3xl">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-lg font-bold text-white">Price History</h3>
                        <p className="text-sm text-gray-400 mt-1">Cost trend over time for selected items</p>
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    {chartData.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#ffffff40" 
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis 
                                    stroke="#ffffff40" 
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => `₹${val}`}
                                />
                                <RechartsTooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                                <Area 
                                    type="monotone" 
                                    dataKey="Total Price" 
                                    stroke="#10b981" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorPrice)" 
                                    activeDot={{ r: 6, fill: '#10b981', stroke: '#09090b', strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                            <TrendingUp size={48} className="mb-4 opacity-20" />
                            <p className="font-medium">Not enough data to chart price history.</p>
                            <p className="text-sm mt-1">Try selecting a broader filter or add more transactions.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-[#18181b] border border-white/5 rounded-3xl overflow-hidden mt-6">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white">Purchase Log</h3>
                        <p className="text-sm text-gray-400 mt-1">Detailed history of selected groceries</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-300">
                        <thead className="text-xs uppercase bg-black/40 text-gray-500">
                            <tr>
                                <th className="px-6 py-4 font-black tracking-widest">Date</th>
                                <th className="px-6 py-4 font-black tracking-widest">Item Details</th>
                                <th className="px-6 py-4 font-black tracking-widest text-right">Quantity</th>
                                <th className="px-6 py-4 font-black tracking-widest text-right">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.map((gi, idx) => (
                                <tr key={`${gi.transactionId}-${idx}`} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => navigate(`/expenses/${gi.year}/${gi.month}?highlightTxId=${gi.transactionId}`)}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} className="text-gray-500" />
                                            <span className="font-medium">{gi.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-white">{gi.name}</div>
                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">
                                            {gi.subcategory}
                                            {gi.brand && ` • ${gi.brand}`}
                                            {gi.flavour && ` • ${gi.flavour}`}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium">
                                        {gi.quantity}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-bold text-white bg-white/10 px-2 py-1 rounded-lg">
                                            {formatCurrency(gi.price)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {paginatedData.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                                        <ShoppingBag size={32} className="mx-auto mb-3 opacity-20" />
                                        <p className="font-medium">No grocery items found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-black/20">
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">
                            Showing <span className="font-bold text-white">{filteredData.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}</span> to <span className="font-bold text-white">{Math.min(currentPage * rowsPerPage, filteredData.length)}</span> of <span className="font-bold text-white">{filteredData.length}</span> entries
                        </span>
                        
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Rows:</span>
                            <select
                                value={rowsPerPage}
                                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm font-medium text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={30}>30</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>
                    
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 text-sm font-medium transition-colors text-white"
                            >
                                Prev
                            </button>
                            <span className="text-sm text-gray-400 font-medium px-2">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 text-sm font-medium transition-colors text-white"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GroceryAnalytics;
