import React, { useMemo } from 'react';
import { Treemap, Tooltip, ResponsiveContainer } from 'recharts';
import { useFinance } from '../context/FinanceContext';
import { TrendingUp, BarChart as BarChartIcon } from 'lucide-react';

const StockTreemapContent = (props) => {
    const { depth, x, y, width, height, ticker, name, percentage } = props;

    // Only render depth 1 which are the actual data nodes since there is only 1 level
    if (depth !== 1) return null;
    if (width < 2 || height < 2) return null;

    let fillColor = '#1e1e1e';
    if (percentage > 0) {
        if (percentage > 10) fillColor = '#14532d';
        else if (percentage > 5) fillColor = '#166534';
        else if (percentage > 2) fillColor = '#15803d';
        else fillColor = '#22c55e';
    } else if (percentage < 0) {
        const abs = Math.abs(percentage);
        if (abs > 10) fillColor = '#7f1d1d';
        else if (abs > 5) fillColor = '#991b1b';
        else if (abs > 2) fillColor = '#b91c1c';
        else fillColor = '#ef4444';
    } else {
        fillColor = '#3f3f46';
    }

    const showTicker = width > 45 && height > 20;
    const showPercentage = width > 55 && height > 35;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={fillColor}
                stroke="#18181b"
                strokeWidth={2}
                style={{ transition: 'all 0.3s ease' }}
            />
            {showTicker && (
                <text x={x + 4} y={y + 16} fill="#ffffff" fontSize={11} fontWeight="600" style={{ pointerEvents: 'none' }}>
                    {ticker || name}
                </text>
            )}
            {showPercentage && percentage !== undefined && (
                <text x={x + 4} y={y + 30} fill="#ffffff" fontSize={10} fillOpacity={0.9} style={{ pointerEvents: 'none' }}>
                    {percentage > 0 ? '+' : ''}{percentage.toFixed(2)}%
                </text>
            )}
        </g>
    );
};

const DividendTreemapContent = (props) => {
    const { depth, x, y, width, height, index, name, ticker, value } = props;

    if (depth !== 1) return null;
    if (width < 2 || height < 2) return null;

    const colors = ['#059669', '#10b981', '#34d399', '#047857'];
    const fillColor = colors[index % colors.length];

    const showTicker = width > 45 && height > 20;
    const showValue = width > 60 && height > 35;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={fillColor}
                stroke="#18181b"
                strokeWidth={2}
                style={{ transition: 'all 0.3s ease' }}
            />
            {showTicker && (
                <text x={x + 4} y={y + 16} fill="#ffffff" fontSize={11} fontWeight="600" style={{ pointerEvents: 'none' }}>
                    {ticker || name}
                </text>
            )}
            {showValue && (
                <text x={x + 4} y={y + 30} fill="#ffffff" fontSize={10} fillOpacity={0.9} style={{ pointerEvents: 'none' }}>
                    ₹{value.toLocaleString('en-IN')}
                </text>
            )}
        </g>
    );
};

const InvestmentsHeatmap = () => {
    const { savings } = useFinance();

    const heatmapsData = useMemo(() => {
        const allActiveStocks = [];
        
        // Gather all active stocks across all stock market accounts
        savings.filter(item => item.type === 'stock_market').forEach(market => {
            if (market.stocks) {
                market.stocks.forEach(stock => {
                    if (stock.shares > 0) {
                        const investedValue = stock.shares * stock.avgCost;
                        const currentValue = stock.shares * stock.currentPrice;
                        const unrealisedPL = currentValue - investedValue;
                        const unrealisedPercent = investedValue > 0 ? (unrealisedPL / investedValue) * 100 : 0;
                        
                        allActiveStocks.push({
                            ...stock,
                            currentValue,
                            unrealisedPercent
                        });
                    }
                });
            }
        });

        const stockTreemapData = allActiveStocks.map(stock => ({
            name: stock.name,
            ticker: stock.ticker,
            value: stock.currentValue,
            percentage: stock.unrealisedPercent
        })).filter(item => item.value > 0);

        const dividendTreemapData = allActiveStocks.map(stock => {
            const stockDividends = stock.dividends || {};
            const totalStockDividend = Object.values(stockDividends).reduce((sum, amount) => sum + Number(amount), 0);
            return {
                name: stock.name,
                ticker: stock.ticker,
                value: totalStockDividend
            };
        }).filter(item => item.value > 0);

        return { stockTreemapData, dividendTreemapData };
    }, [savings]);

    if (heatmapsData.stockTreemapData.length === 0 && heatmapsData.dividendTreemapData.length === 0) {
        return null;
    }

    return (
        <div className="mb-12 mt-8">
            <h3 className="text-xl font-bold text-gray-400 flex items-center gap-2 mb-6">
                <TrendingUp className="text-blue-500" size={24} />
                Global Stock Markets Heatmap
            </h3>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Current Stocks Heatmap */}
                {heatmapsData.stockTreemapData.length > 0 && (
                    <div className="card bg-[#1e1e1e] border border-white/5 h-[400px] w-full p-4 flex flex-col">
                        <p className="text-sm text-gray-500 uppercase font-bold mb-4">Stocks by Current Value</p>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <Treemap
                                    data={heatmapsData.stockTreemapData}
                                    dataKey="value"
                                    aspectRatio={4 / 3}
                                    stroke="#fff"
                                    fill="#8884d8"
                                    content={<StockTreemapContent />}
                                >
                                    <Tooltip
                                        formatter={(value, name, props) => [
                                            `₹${value.toLocaleString('en-IN')}`, 
                                            props.payload.ticker || props.payload.name
                                        ]}
                                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', color: '#fff' }}
                                    />
                                </Treemap>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Dividend Heatmap */}
                {heatmapsData.dividendTreemapData.length > 0 && (
                    <div className="card bg-[#1e1e1e] border border-white/5 h-[400px] w-full p-4 flex flex-col">
                        <p className="text-sm text-gray-500 uppercase font-bold mb-4 flex justify-between items-center">
                            <span>Stocks by Total Dividends</span>
                            <BarChartIcon className="text-emerald-500" size={18} />
                        </p>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <Treemap
                                    data={heatmapsData.dividendTreemapData}
                                    dataKey="value"
                                    aspectRatio={4 / 3}
                                    stroke="#fff"
                                    fill="#10b981"
                                    content={<DividendTreemapContent />}
                                >
                                    <Tooltip
                                        formatter={(value, name, props) => [
                                            `₹${value.toLocaleString('en-IN')}`, 
                                            props.payload.ticker || props.payload.name
                                        ]}
                                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', color: '#fff' }}
                                    />
                                </Treemap>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InvestmentsHeatmap;
