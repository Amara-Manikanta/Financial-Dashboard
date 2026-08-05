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

    // Flatten all grocery items from all transactions (itemized + general grocery expenses)
    const allGroceries = useMemo(() => {
        const items = [];
        if (!expenses) return items;
        
        Object.entries(expenses).forEach(([year, months]) => {
            Object.entries(months).forEach(([month, data]) => {
                if (data.transactions) {
                    data.transactions.forEach(tx => {
                        const cat = (tx.category || '').toLowerCase();
                        const sub = (tx.subCategory || '').toLowerCase();
                        const title = (tx.title || '').toLowerCase();
                        const isGroceryTx = cat.includes('groc') || sub.includes('groc') || title.includes('groc') || title.includes('dmart') || title.includes('blinkit') || title.includes('zepto') || title.includes('instamart') || title.includes('bigbasket') || title.includes('supermarket');

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
                                    subcategory: gi.subcategory || 'General Groceries',
                                    name: gi.name || tx.title || 'Grocery Item',
                                    brand: gi.brand || '',
                                    flavour: gi.flavour || '',
                                    price: Number(gi.price) || 0,
                                    quantity: gi.quantity === 'Custom' ? gi.customQuantity : (gi.quantity || '1 unit')
                                });
                            });
                        } else if (isGroceryTx) {
                            items.push({
                                id: tx.id,
                                name: tx.title || 'Grocery Store Purchase',
                                subcategory: 'General Groceries',
                                brand: tx.creditCardName || (tx.paymentMode ? tx.paymentMode.replace('_', ' ') : 'Grocery Store'),
                                flavour: '',
                                price: Math.abs(Number(tx.amount) || 0),
                                quantity: '1 order',
                                date: new Date(tx.date),
                                timestamp: new Date(tx.date).getTime(),
                                transactionId: tx.id,
                                month,
                                year
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
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {/* Header */}
            <div>
                <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ShoppingBag style={{ color: '#10b981' }} size={32} /> Grocery Analytics
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#71717a', margin: '0.25rem 0 0 0' }}>Track prices and purchase history of your groceries</p>
            </div>

            {/* Filters */}
            <div style={{
                backgroundColor: 'rgba(24, 24, 27, 0.4)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '2rem',
                padding: '1.5rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.5rem'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</label>
                    <select
                        value={selectedCategory}
                        onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            setSelectedItem('All');
                            setSelectedBrand('All');
                            setSelectedFlavour('All');
                        }}
                        style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1rem', color: 'white', fontSize: '0.875rem', outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="All" style={{ backgroundColor: '#18181b' }}>All Categories</option>
                        {filterOptions.categories.map(c => <option key={c} value={c} style={{ backgroundColor: '#18181b' }}>{c}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product</label>
                    <select
                        value={selectedItem}
                        onChange={(e) => {
                            setSelectedItem(e.target.value);
                            setSelectedBrand('All');
                            setSelectedFlavour('All');
                        }}
                        style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1rem', color: 'white', fontSize: '0.875rem', outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="All" style={{ backgroundColor: '#18181b' }}>All Products</option>
                        {filterOptions.items.map(i => <option key={i} value={i} style={{ backgroundColor: '#18181b' }}>{i}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Brand</label>
                    <select
                        value={selectedBrand}
                        onChange={(e) => {
                            setSelectedBrand(e.target.value);
                            setSelectedFlavour('All');
                        }}
                        disabled={filterOptions.brands.length === 0}
                        style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1rem', color: 'white', fontSize: '0.875rem', outline: 'none', cursor: 'pointer', opacity: filterOptions.brands.length === 0 ? 0.3 : 1 }}
                    >
                        <option value="All" style={{ backgroundColor: '#18181b' }}>All Brands</option>
                        {filterOptions.brands.map(b => <option key={b} value={b} style={{ backgroundColor: '#18181b' }}>{b}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Flavour / Variant</label>
                    <select
                        value={selectedFlavour}
                        onChange={(e) => setSelectedFlavour(e.target.value)}
                        disabled={filterOptions.flavours.length === 0}
                        style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1rem', color: 'white', fontSize: '0.875rem', outline: 'none', cursor: 'pointer', opacity: filterOptions.flavours.length === 0 ? 0.3 : 1 }}
                    >
                        <option value="All" style={{ backgroundColor: '#18181b' }}>All Flavours</option>
                        {filterOptions.flavours.map(f => <option key={f} value={f} style={{ backgroundColor: '#18181b' }}>{f}</option>)}
                    </select>
                </div>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.03)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(16, 185, 129, 0.1)',
                    borderRadius: '2rem',
                    padding: '1.5rem',
                    boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{
                            padding: '0.5rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            color: '#34d399',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <ShoppingBag size={18} />
                        </div>
                        <span style={{ fontSize: '9px', fontWeight: '900', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Spent</span>
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>
                        {formatCurrency(stats.totalSpent)}
                    </p>
                </div>

                <div style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.03)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(59, 130, 246, 0.1)',
                    borderRadius: '2rem',
                    padding: '1.5rem',
                    boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{
                            padding: '0.5rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            color: '#60a5fa',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Package size={18} />
                        </div>
                        <span style={{ fontSize: '9px', fontWeight: '900', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items Bought</span>
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>
                        {stats.totalItems}
                    </p>
                </div>

                <div style={{
                    backgroundColor: 'rgba(168, 85, 247, 0.03)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(168, 85, 247, 0.1)',
                    borderRadius: '2rem',
                    padding: '1.5rem',
                    boxShadow: '0 10px 15px -3px rgba(168, 85, 247, 0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{
                            padding: '0.5rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(168, 85, 247, 0.1)',
                            color: '#c084fc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Tags size={18} />
                        </div>
                        <span style={{ fontSize: '9px', fontWeight: '900', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg. Price / Item</span>
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>
                        {formatCurrency(stats.avgPrice)}
                    </p>
                </div>
            </div>

            {/* Price History Chart */}
            <div style={{
                backgroundColor: 'rgba(24, 24, 27, 0.4)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '2rem',
                padding: '1.5rem',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
            }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: '0 0 1.5rem 0' }}>Price History</h3>
                <div style={{ height: 300, width: '100%' }}>
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
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                                <RechartsTooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                                <Area type="monotone" dataKey="Total Price" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" activeDot={{ r: 6, fill: '#10b981', stroke: '#09090b', strokeWidth: 2 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontSize: '0.875rem' }}>
                            <TrendingUp size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                            <p style={{ margin: 0 }}>Not enough data to chart price history.</p>
                        </div>
                    )}
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
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: 0 }}>Purchase Log</h3>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item Details</th>
                                <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quantity</th>
                                <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.map((gi, idx) => (
                                <tr key={`${gi.transactionId}-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }} onClick={() => navigate(`/expenses/${gi.year}/${gi.month}?highlightTxId=${gi.transactionId}`)}>
                                    <td style={{ padding: '1rem 1.5rem', color: '#a1a1aa', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Calendar size={12} style={{ color: '#71717a' }} />
                                            <span>{gi.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <div style={{ color: 'white', fontWeight: 'bold', fontSize: '0.875rem' }}>{gi.name}</div>
                                        <div style={{ fontSize: '9px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>
                                            {gi.subcategory}
                                            {gi.brand && ` • ${gi.brand}`}
                                            {gi.flavour && ` • ${gi.flavour}`}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right', color: 'white', fontSize: '0.875rem', fontWeight: 'bold' }}>
                                        {gi.quantity}
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                        <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'white', backgroundColor: 'rgba(255,255,255,0.03)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            {formatCurrency(gi.price)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {paginatedData.length === 0 && (
                                <tr>
                                    <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: '#71717a', fontSize: '0.875rem' }}>
                                        <ShoppingBag size={24} style={{ color: '#71717a', marginBottom: '1rem', opacity: 0.5 }} />
                                        <p style={{ margin: 0 }}>No grocery items found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '11px', color: '#71717a' }}>
                            Showing {filteredData.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length} entries
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ fontSize: '11px', color: '#71717a' }}>Rows:</span>
                            <select
                                value={rowsPerPage}
                                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                                style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '0.5rem', padding: '0.25rem', outline: 'none', cursor: 'pointer' }}
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
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer', opacity: currentPage === 1 ? 0.3 : 1, fontSize: '10px', fontWeight: 'bold' }}>Prev</button>
                            <span style={{ fontSize: '11px', color: '#71717a', fontFamily: 'monospace', padding: '0 0.5rem' }}>
                                {currentPage} / {totalPages}
                            </span>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer', opacity: currentPage === totalPages ? 0.3 : 1, fontSize: '10px', fontWeight: 'bold' }}>Next</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GroceryAnalytics;
