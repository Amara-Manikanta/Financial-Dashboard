import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { Fuel, TrendingDown, TrendingUp, Droplets, Gauge, Car } from 'lucide-react';
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
                            {entry.name === 'Mileage (kmpl)' ? `${entry.value.toFixed(1)} kmpl` : 
                             entry.name === 'Price/L' ? formatCurrency(entry.value) : 
                             entry.name === 'Distance' ? `${entry.value} km` :
                             entry.name === 'Quantity' ? `${entry.value} L` :
                             formatCurrency(entry.value)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const FuelAnalytics = () => {
    const { expenses, formatCurrency } = useFinance();
    const navigate = useNavigate();
    const [selectedVehicle, setSelectedVehicle] = useState('scooty');
    const [selectedYear, setSelectedYear] = useState('All');
    const [selectedMonth, setSelectedMonth] = useState('All');
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [selectedVehicle, selectedYear, selectedMonth]);

    const fuelTransactions = useMemo(() => {
        const txs = [];
        if (!expenses) return txs;
        
        Object.entries(expenses).forEach(([year, months]) => {
            Object.entries(months).forEach(([month, data]) => {
                if (data.transactions) {
                    data.transactions.forEach(tx => {
                        if (tx.category && tx.category.toLowerCase().includes('fuel')) {
                            txs.push({
                                ...tx,
                                year: parseInt(year),
                                monthName: month,
                                parsedDate: new Date(tx.date)
                            });
                        }
                    });
                }
            });
        });
        
        return txs.sort((a, b) => a.parsedDate - b.parsedDate);
    }, [expenses]);

    const availableYears = useMemo(() => {
        return [...new Set(fuelTransactions.filter(tx => (tx.vehicleType || 'bike') === selectedVehicle).map(tx => tx.year))].sort((a,b) => b-a);
    }, [fuelTransactions, selectedVehicle]);

    const availableMonths = useMemo(() => {
        if (selectedYear === 'All') return [];
        return [...new Set(fuelTransactions.filter(tx => (tx.vehicleType || 'bike') === selectedVehicle && tx.year === parseInt(selectedYear)).map(tx => tx.monthName))];
    }, [fuelTransactions, selectedVehicle, selectedYear]);

    const filteredTransactions = useMemo(() => {
        return fuelTransactions.filter(tx => {
            const matchVehicle = (tx.vehicleType || 'bike') === selectedVehicle;
            const matchYear = selectedYear === 'All' || tx.year === parseInt(selectedYear);
            const matchMonth = selectedMonth === 'All' || tx.monthName === selectedMonth;
            return matchVehicle && matchYear && matchMonth;
        });
    }, [fuelTransactions, selectedVehicle, selectedYear, selectedMonth]);

    const analyticsData = useMemo(() => {
        let totalSpent = 0;
        let totalLiters = 0;
        let totalDistance = 0;
        
        const chartData = [];
        let previousKm = null;

        let totalSpentWithLiters = 0;

        filteredTransactions.forEach((tx) => {
            const amt = Number(tx.amount) || 0;
            const l = Number(tx.liters) || null;
            const k = Number(tx.km) || null;
            
            totalSpent += amt;
            
            let mileage = null;
            let pricePerLiter = null;
            let distance = null;

            if (l && l > 0) {
                totalLiters += l;
                totalSpentWithLiters += amt;
                pricePerLiter = amt / l;
            }

            if (k) {
                if (previousKm && k > previousKm) {
                    distance = k - previousKm;
                    totalDistance += distance;
                    if (l && l > 0) {
                        mileage = distance / l;
                    }
                }
                previousKm = k;
            } else if (!tx.isCredited) {
                // If a regular fuel expense is logged without an odometer reading, 
                // we must break the continuous chain so we don't calculate an invalid, 
                // inflated distance/mileage on the next transaction.
                previousKm = null;
            }

            chartData.push({
                id: tx.id,
                year: tx.year,
                monthName: tx.monthName,
                date: tx.date,
                title: tx.title,
                amount: amt,
                liters: l,
                km: k,
                distance: distance,
                mileage: mileage,
                pricePerLiter: pricePerLiter,
                displayDate: new Date(tx.date).toLocaleDateString('default', { day: 'numeric', month: 'short', year: '2-digit' })
            });
        });

        // Filter out extreme anomalies for chart (e.g. forgot to log a fill-up, so mileage is 200kmpl)
        const validMileageData = chartData.filter(d => d.mileage && d.mileage > 0 && d.mileage < 150);
        const avgMileage = validMileageData.length > 0 
            ? validMileageData.reduce((acc, curr) => acc + curr.mileage, 0) / validMileageData.length 
            : 0;

        const avgPrice = totalLiters > 0 ? totalSpentWithLiters / totalLiters : 0;

        return {
            totalSpent,
            totalLiters,
            totalDistance,
            avgMileage,
            avgPrice,
            chartData,
            validMileageData
        };
    }, [filteredTransactions]);

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {/* Header */}
            <div style={{
                backgroundColor: 'rgba(24, 24, 27, 0.4)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(234, 179, 8, 0.1)',
                borderRadius: '2rem',
                padding: '2rem',
                boxShadow: '0 10px 25px -5px rgba(234, 179, 8, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem'
            }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                    <div>
                        <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Fuel style={{ color: '#eab308' }} size={32} /> Fuel Analytics
                        </h2>
                        <p style={{ fontSize: '0.875rem', color: '#71717a', margin: '0.25rem 0 0 0' }}>Track your vehicle's mileage, fuel consumption, and expenses.</p>
                    </div>

                    {/* Filters */}
                    <div style={{
                        display: 'flex',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '1rem',
                        padding: '2px',
                        gap: '2px'
                    }}>
                        <select
                            value={selectedYear}
                            onChange={(e) => {
                                setSelectedYear(e.target.value);
                                setSelectedMonth('All');
                            }}
                            style={{ backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '11px', fontWeight: 'bold', padding: '0.5rem', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="All" style={{ backgroundColor: '#18181b' }}>All Years</option>
                            {availableYears.map(year => (
                                <option key={year} value={year} style={{ backgroundColor: '#18181b' }}>{year}</option>
                            ))}
                        </select>
                        <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            disabled={selectedYear === 'All'}
                            style={{ backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '11px', fontWeight: 'bold', padding: '0.5rem', outline: 'none', cursor: 'pointer', opacity: selectedYear === 'All' ? 0.3 : 1 }}
                        >
                            <option value="All" style={{ backgroundColor: '#18181b' }}>All Months</option>
                            {availableMonths.map(month => (
                                <option key={month} value={month} style={{ backgroundColor: '#18181b' }}>{month}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Vehicle Tabs */}
                <div style={{
                    display: 'flex',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '1rem',
                    padding: '2px',
                    width: 'max-content',
                    gap: '2px'
                }}>
                    {['scooty', 'bike', 'car', 'other'].map(vType => (
                        <button
                            key={vType}
                            onClick={() => setSelectedVehicle(vType)}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '9px',
                                fontWeight: '900',
                                letterSpacing: '0.05em',
                                borderRadius: '0.75rem',
                                border: 'none',
                                backgroundColor: selectedVehicle === vType ? '#eab308' : 'transparent',
                                color: selectedVehicle === vType ? 'black' : '#71717a',
                                cursor: 'pointer',
                                textTransform: 'uppercase'
                            }}
                        >
                            {vType}
                        </button>
                    ))}
                </div>
            </div>

            {filteredTransactions.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem 2rem',
                    border: '1px dashed rgba(255,255,255,0.08)',
                    borderRadius: '2rem',
                    backgroundColor: 'rgba(255,255,255,0.01)'
                }}>
                    <Fuel size={36} style={{ color: '#71717a', marginBottom: '1.5rem' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: '0 0 0.5rem 0' }}>No fuel data for {selectedVehicle}</h3>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', margin: 0 }}>Add expenses under the 'Fuel' category and select '{selectedVehicle}' to see analytics here.</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Distance</span>
                            <p style={{ fontSize: '1.75rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>{analyticsData.totalDistance.toLocaleString()} <span style={{ fontSize: '0.875rem', color: '#71717a', fontFamily: 'sans-serif' }}>km</span></p>
                        </div>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Fuel</span>
                            <p style={{ fontSize: '1.75rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>{analyticsData.totalLiters.toFixed(1)} <span style={{ fontSize: '0.875rem', color: '#71717a', fontFamily: 'sans-serif' }}>L</span></p>
                        </div>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(234, 179, 8, 0.1)', borderRadius: '1.5rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 4px 15px -3px rgba(234, 179, 8, 0.05)' }}>
                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg. Mileage</span>
                            <p style={{ fontSize: '1.75rem', fontWeight: '950', color: '#eab308', fontFamily: 'monospace', margin: 0 }}>{analyticsData.avgMileage.toFixed(1)} <span style={{ fontSize: '0.875rem', color: 'rgba(234, 179, 8, 0.5)', fontFamily: 'sans-serif' }}>kmpl</span></p>
                        </div>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg. Fuel Price</span>
                            <p style={{ fontSize: '1.75rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(analyticsData.avgPrice)}<span style={{ fontSize: '0.875rem', color: '#71717a', fontFamily: 'sans-serif' }}>/L</span></p>
                        </div>
                    </div>

                    {/* Charts */}
                    {analyticsData.chartData.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                            {/* Mileage Trend */}
                            <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '2rem', padding: '1.5rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Gauge size={16} style={{ color: '#eab308' }} /> Mileage Trend
                                </h3>
                                <div style={{ height: 300 }}>
                                    {analyticsData.validMileageData.length > 1 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={analyticsData.validMileageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorMileage" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                <XAxis dataKey="displayDate" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
                                                <RechartsTooltip content={<CustomTooltip formatCurrency={formatCurrency} />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                                                <Area type="monotone" dataKey="mileage" name="Mileage (kmpl)" stroke="#eab308" strokeWidth={3} fill="url(#colorMileage)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontSize: '0.875rem' }}>
                                            <Gauge size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                                            <p style={{ margin: 0 }}>Not enough data for mileage trend</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Price Trend */}
                            <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '2rem', padding: '1.5rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <TrendingUp size={16} style={{ color: '#10b981' }} /> Fuel Price Trend
                                </h3>
                                <div style={{ height: 300 }}>
                                    {analyticsData.chartData.filter(d => d.pricePerLiter).length > 1 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={analyticsData.chartData.filter(d => d.pricePerLiter)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                <XAxis dataKey="displayDate" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                                                <RechartsTooltip content={<CustomTooltip formatCurrency={formatCurrency} />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                                                <Area type="monotone" dataKey="pricePerLiter" name="Price/L" stroke="#10b981" strokeWidth={3} fill="url(#colorPrice)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontSize: '0.875rem' }}>
                                            <Droplets size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                                            <p style={{ margin: 0 }}>Not enough data for price trend</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Transactions Table */}
                    <div style={{
                        backgroundColor: 'rgba(24, 24, 27, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '2rem',
                        overflow: 'hidden',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: 0 }}>Fill-up History</h3>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Station / Reference</th>
                                        <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Odometer</th>
                                        <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distance</th>
                                        <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quantity</th>
                                        <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                                        <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mileage</th>
                                        <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price/L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...analyticsData.chartData].reverse().slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((tx) => (
                                        <tr 
                                            key={tx.id} 
                                            style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }}
                                            onClick={() => navigate(`/expenses/${tx.year}/${tx.monthName}?highlightTxId=${tx.id}`)}
                                        >
                                            <td style={{ padding: '1rem 1.5rem', color: '#a1a1aa', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                                                {tx.displayDate}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', color: 'white', fontWeight: 'bold', fontSize: '0.875rem' }}>
                                                {tx.title}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontFamily: 'monospace', color: '#71717a', fontSize: '0.875rem' }}>
                                                {tx.km ? `${tx.km.toLocaleString()} km` : '-'}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontFamily: 'monospace', color: '#71717a', fontSize: '0.875rem' }}>
                                                {tx.distance ? `+${tx.distance} km` : '-'}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontFamily: 'monospace', color: 'white', fontSize: '0.875rem' }}>
                                                {tx.liters ? `${tx.liters} L` : '-'}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontFamily: 'monospace', color: 'white', fontWeight: 'bold', fontSize: '0.875rem' }}>
                                                {formatCurrency(tx.amount)}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontFamily: 'monospace', color: '#eab308', fontWeight: 'bold', fontSize: '0.875rem' }}>
                                                {tx.mileage ? `${tx.mileage.toFixed(1)} kmpl` : '-'}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontFamily: 'monospace', color: '#34d399', fontWeight: 'bold', fontSize: '0.875rem' }}>
                                                {tx.pricePerLiter ? formatCurrency(tx.pricePerLiter) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        {analyticsData.chartData.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '11px', color: '#71717a' }}>Show:</span>
                                    <select
                                        value={rowsPerPage}
                                        onChange={(e) => {
                                            setRowsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '0.5rem', padding: '0.25rem', outline: 'none', cursor: 'pointer' }}
                                    >
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={30}>30</option>
                                    </select>
                                    <span style={{ fontSize: '11px', color: '#71717a' }}>entries</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{ fontSize: '11px', color: '#71717a', fontFamily: 'monospace' }}>
                                        {currentPage} / {Math.ceil(analyticsData.chartData.length / rowsPerPage)}
                                    </span>
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer', opacity: currentPage === 1 ? 0.3 : 1, fontSize: '10px', fontWeight: 'bold' }}>Prev</button>
                                        <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(analyticsData.chartData.length / rowsPerPage), p + 1))} disabled={currentPage === Math.ceil(analyticsData.chartData.length / rowsPerPage)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', cursor: 'pointer', opacity: currentPage === Math.ceil(analyticsData.chartData.length / rowsPerPage) ? 0.3 : 1, fontSize: '10px', fontWeight: 'bold' }}>Next</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default FuelAnalytics;
