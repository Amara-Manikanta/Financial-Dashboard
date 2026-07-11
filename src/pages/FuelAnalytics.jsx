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
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#18181b] to-orange-900/10 border border-white/10 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-3">
                            <Fuel className="text-orange-500" size={36} />
                            Fuel Analytics
                        </h1>
                        <p className="text-gray-400">Track your vehicle's mileage, fuel consumption, and expenses.</p>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            value={selectedYear}
                            onChange={(e) => {
                                setSelectedYear(e.target.value);
                                setSelectedMonth('All');
                            }}
                            className="h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-white font-bold text-sm focus:outline-none focus:border-orange-500/50 focus:bg-[#2c2c2e] transition-all cursor-pointer"
                        >
                            <option value="All" className="bg-[#18181b]">All Years</option>
                            {availableYears.map(year => (
                                <option key={year} value={year} className="bg-[#18181b]">{year}</option>
                            ))}
                        </select>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            disabled={selectedYear === 'All'}
                            className="h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-white font-bold text-sm focus:outline-none focus:border-orange-500/50 focus:bg-[#2c2c2e] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="All" className="bg-[#18181b]">All Months</option>
                            {availableMonths.map(month => (
                                <option key={month} value={month} className="bg-[#18181b]">{month}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Vehicle Tabs */}
                <div className="flex gap-2 mt-8 relative z-10 p-1 bg-black/40 rounded-2xl w-max border border-white/5">
                    {['scooty', 'bike', 'car', 'other'].map(vType => (
                        <button
                            key={vType}
                            onClick={() => setSelectedVehicle(vType)}
                            className={`px-6 py-2.5 rounded-xl font-bold text-sm capitalize transition-all ${
                                selectedVehicle === vType
                                    ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {vType}
                        </button>
                    ))}
                </div>
            </div>

            {filteredTransactions.length === 0 ? (
                <div className="text-center p-12 bg-[#18181b] rounded-3xl border border-white/5">
                    <Fuel size={48} className="mx-auto text-gray-600 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No fuel data for {selectedVehicle}</h3>
                    <p className="text-gray-400">Add expenses under the 'Fuel' category and select '{selectedVehicle}' to see analytics here.</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-[#18181b] rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Car size={48} />
                            </div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Total Distance</p>
                            <p className="text-3xl font-black text-white font-mono">{analyticsData.totalDistance.toLocaleString()} <span className="text-lg text-gray-500">km</span></p>
                        </div>
                        <div className="bg-[#18181b] rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Droplets size={48} />
                            </div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Total Fuel</p>
                            <p className="text-3xl font-black text-white font-mono">{analyticsData.totalLiters.toFixed(1)} <span className="text-lg text-gray-500">L</span></p>
                        </div>
                        <div className="bg-[#18181b] rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 text-orange-500 group-hover:opacity-20 transition-opacity">
                                <Gauge size={48} />
                            </div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Avg. Mileage</p>
                            <p className="text-3xl font-black text-orange-400 font-mono">{analyticsData.avgMileage.toFixed(1)} <span className="text-lg text-orange-400/50">kmpl</span></p>
                        </div>
                        <div className="bg-[#18181b] rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <TrendingUp size={48} />
                            </div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Avg. Fuel Price</p>
                            <p className="text-3xl font-black text-white font-mono">{formatCurrency(analyticsData.avgPrice)}<span className="text-lg text-gray-500">/L</span></p>
                        </div>
                    </div>

                    {/* Charts */}
                    {analyticsData.chartData.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Mileage Trend */}
                            <div className="bg-[#18181b] rounded-3xl p-6 border border-white/5">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <TrendingUp size={18} className="text-orange-400" />
                                    Mileage Trend
                                </h3>
                                <div className="h-[300px]">
                                    {analyticsData.validMileageData.length > 1 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={analyticsData.validMileageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorMileage" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                <XAxis dataKey="displayDate" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
                                                <RechartsTooltip content={<CustomTooltip formatCurrency={formatCurrency} />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                                                <Area type="monotone" dataKey="mileage" name="Mileage (kmpl)" stroke="#f97316" strokeWidth={3} fill="url(#colorMileage)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                                            <Gauge size={32} className="mb-2 opacity-50" />
                                            <p>Not enough data for mileage trend</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Price Trend */}
                            <div className="bg-[#18181b] rounded-3xl p-6 border border-white/5">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <TrendingDown size={18} className="text-emerald-400" />
                                    Fuel Price Trend
                                </h3>
                                <div className="h-[300px]">
                                    {analyticsData.chartData.filter(d => d.pricePerLiter).length > 1 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={analyticsData.chartData.filter(d => d.pricePerLiter)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                <XAxis dataKey="displayDate" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                                                <RechartsTooltip content={<CustomTooltip formatCurrency={formatCurrency} />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                                                <Area type="monotone" dataKey="pricePerLiter" name="Price/L" stroke="#34d399" strokeWidth={3} fill="url(#colorPrice)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                                            <Droplets size={32} className="mb-2 opacity-50" />
                                            <p>Not enough data for price trend</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Transactions Table */}
                    <div className="bg-[#18181b] rounded-3xl border border-white/5 overflow-hidden">
                        <div className="p-6 border-b border-white/5">
                            <h3 className="text-lg font-bold text-white">Fill-up History</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-black/20">
                                    <tr>
                                        <th className="px-6 py-4 rounded-tl-lg">Date</th>
                                        <th className="px-6 py-4">Station / Reference</th>
                                        <th className="px-6 py-4 text-right">Odometer</th>
                                        <th className="px-6 py-4 text-right">Distance</th>
                                        <th className="px-6 py-4 text-right">Quantity</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4 text-right text-orange-400">Mileage</th>
                                        <th className="px-6 py-4 text-right rounded-tr-lg text-emerald-400">Price/L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...analyticsData.chartData].reverse().slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((tx, idx) => (
                                        <tr 
                                            key={tx.id} 
                                            className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                                            onClick={() => navigate(`/expenses/${tx.year}/${tx.monthName}?highlightTxId=${tx.id}`)}
                                        >
                                            <td className="px-6 py-4 text-gray-300 font-medium whitespace-nowrap">
                                                {tx.displayDate}
                                            </td>
                                            <td className="px-6 py-4 text-white">
                                                {tx.title}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-400">
                                                {tx.km ? `${tx.km.toLocaleString()} km` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-400">
                                                {tx.distance ? `+${tx.distance} km` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-white">
                                                {tx.liters ? `${tx.liters} L` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-white font-bold">
                                                {formatCurrency(tx.amount)}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-orange-400 font-bold">
                                                {tx.mileage ? `${tx.mileage.toFixed(1)} kmpl` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-emerald-400 font-bold">
                                                {tx.pricePerLiter ? formatCurrency(tx.pricePerLiter) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        {analyticsData.chartData.length > 0 && (
                            <div className="p-4 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-400 bg-black/20">
                                <div className="flex items-center gap-2">
                                    <span>Show</span>
                                    <select
                                        value={rowsPerPage}
                                        onChange={(e) => {
                                            setRowsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="bg-white/5 border border-white/5 rounded-xl px-3 py-1 text-white font-bold text-sm focus:outline-none focus:border-orange-500/50 focus:bg-[#2c2c2e] transition-all cursor-pointer"
                                    >
                                        <option value={10} className="bg-[#18181b]">10</option>
                                        <option value={20} className="bg-[#18181b]">20</option>
                                        <option value={30} className="bg-[#18181b]">30</option>
                                    </select>
                                    <span>entries</span>
                                </div>
                                <div className="flex items-center gap-2 font-bold">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all"
                                    >
                                        Prev
                                    </button>
                                    <span className="px-2 font-mono">
                                        {currentPage} / {Math.ceil(analyticsData.chartData.length / rowsPerPage)}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(analyticsData.chartData.length / rowsPerPage), p + 1))}
                                        disabled={currentPage === Math.ceil(analyticsData.chartData.length / rowsPerPage)}
                                        className="px-4 py-2 bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all"
                                    >
                                        Next
                                    </button>
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
