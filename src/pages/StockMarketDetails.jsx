import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, TrendingUp, TrendingDown, Edit2, Trash2, Plus, Search, Settings, ChevronUp, ChevronDown, X, RefreshCw, BarChart as BarChartIcon, PieChart as PieChartIcon, Archive, LayoutGrid, Table, Info, AlertCircle, Award, ArrowUpRight, Layers } from 'lucide-react';
import { resolveMarketCap } from '../utils/nifty50Data';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Treemap } from 'recharts';
import StockTransactionModal from '../components/StockTransactionModal';
import BackButton from '../components/BackButton';
import ConfirmModal from '../components/ConfirmModal';
import StockAnalyticsPanels from '../components/StockAnalyticsPanels';

const StockTreemapContent = (props) => {
    const { depth, x, y, width, height, index, name, ticker, percentage, value } = props;

    // Only render leaf nodes (those without children)
    if (props.children) return null;
    if (width < 1 || height < 1) return null;

    let fillColor = '#1e1e1e';
    if (percentage > 0) {
        if (percentage > 10) fillColor = 'rgba(16, 185, 129, 0.45)';
        else if (percentage > 5) fillColor = 'rgba(16, 185, 129, 0.35)';
        else if (percentage > 2) fillColor = 'rgba(16, 185, 129, 0.25)';
        else fillColor = 'rgba(16, 185, 129, 0.15)';
    } else if (percentage < 0) {
        const abs = Math.abs(percentage);
        if (abs > 10) fillColor = 'rgba(239, 68, 68, 0.45)';
        else if (abs > 5) fillColor = 'rgba(239, 68, 68, 0.35)';
        else if (abs > 2) fillColor = 'rgba(239, 68, 68, 0.25)';
        else fillColor = 'rgba(239, 68, 68, 0.15)';
    } else {
        fillColor = 'rgba(63, 63, 70, 0.2)';
    }

    const showText = width > 30 && height > 20;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={fillColor}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth={1}
                rx={4}
                ry={4}
                style={{ transition: 'all 0.3s ease' }}
            />
            {showText && (
                <foreignObject x={x + 4} y={y + 4} width={Math.max(0, width - 8)} height={Math.max(0, height - 8)} style={{ pointerEvents: 'none' }}>
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ color: '#ffffff', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ticker || name}
                        </span>
                        {percentage !== undefined && height > 35 && (
                            <span style={{ color: percentage >= 0 ? '#34d399' : '#f87171', fontSize: '9px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {percentage > 0 ? '+' : ''}{percentage.toFixed(2)}%
                            </span>
                        )}
                    </div>
                </foreignObject>
            )}
        </g>
    );
};

const DividendTreemapContent = (props) => {
    const { depth, x, y, width, height, index, name, ticker, value } = props;

    // Only render leaf nodes
    if (props.children) return null;
    if (width < 1 || height < 1) return null;

    const colors = [
        'rgba(13, 148, 136, 0.4)',
        'rgba(20, 184, 166, 0.3)',
        'rgba(45, 212, 191, 0.2)',
        'rgba(13, 148, 136, 0.2)'
    ];
    const fillColor = colors[index % colors.length];

    const showText = width > 30 && height > 20;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={fillColor}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth={1}
                rx={4}
                ry={4}
                style={{ transition: 'all 0.3s ease' }}
            />
            {showText && (
                <foreignObject x={x + 4} y={y + 4} width={Math.max(0, width - 8)} height={Math.max(0, height - 8)} style={{ pointerEvents: 'none' }}>
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ color: '#ffffff', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ticker || name}
                        </span>
                        {value !== undefined && height > 35 && (
                            <span style={{ color: '#2dd4bf', fontSize: '9px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                ₹{value.toLocaleString('en-IN')}
                            </span>
                        )}
                    </div>
                </foreignObject>
            )}
        </g>
    );
};

const OFFICIAL_SECTORS = [
    { name: 'Information Technology', icon: '💻', color: '#3b82f6' },
    { name: 'Financials', icon: '🏦', color: '#10b981' },
    { name: 'Health Care', icon: '🩺', color: '#ec4899' },
    { name: 'Consumer Discretionary', icon: '🛍️', color: '#f59e0b' },
    { name: 'Consumer Staples', icon: '🛒', color: '#84cc16' },
    { name: 'Industrials', icon: '⚙️', color: '#6366f1' },
    { name: 'Communication Services', icon: '📡', color: '#8b5cf6' },
    { name: 'Energy', icon: '⚡', color: '#ef4444' },
    { name: 'Utilities', icon: '🚰', color: '#06b6d4' },
    { name: 'Materials', icon: '🏗️', color: '#d97706' },
    { name: 'Real Estate', icon: '🏢', color: '#14b8a6' }
];

// A stock that has paid a dividend before is assumed to expect one again,
// unless expectsDividends says otherwise. Requiring the flag outright meant
// the count was always zero, because no record has ever carried it.
const expectsDividends = (stock) => {
    if (!stock) return false;
    if (typeof stock.expectsDividends === 'boolean') return stock.expectsDividends;
    return Object.values(stock.dividends || {}).some(v => Number(v) > 0);
};


/**
 * "12 minutes ago" rather than a timestamp.
 *
 * The question a price staleness label answers is "can I trust this number",
 * and elapsed time answers it directly where a formatted date makes the reader
 * do the arithmetic. The exact time is kept in the tooltip for when it matters.
 */
const timeAgo = (iso) => {
    if (!iso) return null;
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return null;
    const mins = Math.floor((Date.now() - then.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
};

/** Older than a trading day: the figures are almost certainly out of date. */
const STALE_AFTER_HOURS = 24;
const isStale = (iso) => {
    if (!iso) return true;
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return true;
    return (Date.now() - then.getTime()) > STALE_AFTER_HOURS * 3600000;
};

const StockMarketDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { savings, formatCurrency, updateItem, refreshStockPrices } = useFinance();
    const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
    const [refreshNote, setRefreshNote] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStock, setEditingStock] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc' | null
    const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
    const [isManageColumnsModalOpen, setIsManageColumnsModalOpen] = useState(false);
    const [newColumnName, setNewColumnName] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [stockToDelete, setStockToDelete] = useState(null);
    const [isDeleteColumnModalOpen, setIsDeleteColumnModalOpen] = useState(false);
    const [columnToDelete, setColumnToDelete] = useState(null);
    const [activeTab, setActiveTab] = useState('holdings'); // 'holdings' | 'analytics' | 'archive'
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
    const [showPendingOnly, setShowPendingOnly] = useState(false);
    const [capFilter, setCapFilter] = useState('All'); // 'All' | 'Large Cap' | 'Mid Cap' | 'Small Cap' | 'Unclassified'
    const [sectorFilter, setSectorFilter] = useState('All');

    const market = useMemo(() => savings.find(s => s.id.toString() === id), [savings, id]);

    const stocks = useMemo(() => market?.stocks || [], [market]);
    const customColumns = useMemo(() => market?.customColumns || [], [market]);

    // Filter and Separating Stocks
    const filteredStocks = useMemo(() => {
        return stocks.filter(stock =>
            (stock.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (stock.ticker || stock.symbol || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [stocks, searchTerm]);

    const activeStocks = useMemo(() => filteredStocks.filter(stock => !stock.isArchived && Number(stock.shares || 0) > 0), [filteredStocks]);
    const archivedStocks = useMemo(() => filteredStocks.filter(stock => stock.isArchived || Number(stock.shares || 0) === 0), [filteredStocks]);

    const currentYear = new Date().getFullYear();

    // Calculate aggregate stats and processed rows
    const { stockRows, totalInvested, currentTotalValue } = useMemo(() => {
        let invested = 0;
        let currentVal = 0;

        const rows = activeStocks.map(stock => {
            const sharesCount = Number(stock.shares || 0);
            const avgCostPrice = Number(stock.avgCost || stock.avgPrice || 0);
            const currentMktPrice = Number(stock.currentPrice || 0);

            const investedValue = sharesCount * avgCostPrice;
            const currentValue = sharesCount * currentMktPrice;
            const unrealisedPL = currentValue - investedValue;
            const unrealisedPercent = investedValue > 0 ? (unrealisedPL / investedValue) * 100 : 0;

            invested += investedValue;
            currentVal += currentValue;

            return {
                ...stock,
                ticker: stock.ticker || stock.symbol || stock.name,
                investedValue,
                currentValue,
                unrealisedPL,
                unrealisedPercent
            };
        });

        return {
            stockRows: rows,
            totalInvested: invested,
            currentTotalValue: currentVal
        };
    }, [activeStocks]);

    // Filter display rows based on pending dividend status, cap filter, and sector filter
    const displayStockRows = useMemo(() => {
        return stockRows.filter(stock => {
            if (capFilter !== 'All') {
                const stockCap = resolveMarketCap(stock);
                if (stockCap !== capFilter) return false;
            }
            if (sectorFilter !== 'All') {
                const stockSector = stock.sector || 'Unclassified';
                if (stockSector !== sectorFilter) return false;
            }
            if (showPendingOnly) {
                const isDividendPending = expectsDividends(stock) && (!stock.dividends || !stock.dividends[currentYear] || Number(stock.dividends[currentYear]) === 0);
                if (!isDividendPending) return false;
            }
            return true;
        });
    }, [stockRows, showPendingOnly, currentYear, capFilter, sectorFilter]);

    // Market Cap Performance Metrics
    const capMetrics = useMemo(() => {
        const caps = ['Large Cap', 'Mid Cap', 'Small Cap', 'Unclassified'];
        const metrics = {};
        let totalPortfolioValue = 0;

        caps.forEach(cap => {
            metrics[cap] = { invested: 0, currentValue: 0, pl: 0, count: 0, stocks: [] };
        });

        stockRows.forEach(stock => {
            const cap = resolveMarketCap(stock);
            if (!metrics[cap]) {
                metrics[cap] = { invested: 0, currentValue: 0, pl: 0, count: 0, stocks: [] };
            }
            metrics[cap].invested += stock.investedValue;
            metrics[cap].currentValue += stock.currentValue;
            metrics[cap].pl += stock.unrealisedPL;
            metrics[cap].count += 1;
            metrics[cap].stocks.push(stock.ticker || stock.symbol || stock.name);
            totalPortfolioValue += stock.currentValue;
        });

        caps.forEach(cap => {
            metrics[cap].percentAllocation = totalPortfolioValue > 0
                ? (metrics[cap].currentValue / totalPortfolioValue) * 100
                : 0;
            metrics[cap].plPercent = metrics[cap].invested > 0
                ? (metrics[cap].pl / metrics[cap].invested) * 100
                : 0;
        });

        return { metrics, totalPortfolioValue };
    }, [stockRows]);

    // Sector Performance Metrics
    const sectorMetrics = useMemo(() => {
        const metrics = {};
        let totalPortfolioValue = 0;

        OFFICIAL_SECTORS.forEach(sec => {
            metrics[sec.name] = { ...sec, invested: 0, currentValue: 0, pl: 0, count: 0, stocks: [] };
        });
        metrics['Unclassified'] = { name: 'Unclassified', icon: '📁', color: '#71717a', invested: 0, currentValue: 0, pl: 0, count: 0, stocks: [] };

        stockRows.forEach(stock => {
            const secName = stock.sector || 'Unclassified';
            if (!metrics[secName]) {
                metrics[secName] = { name: secName, icon: '📊', color: '#a1a1aa', invested: 0, currentValue: 0, pl: 0, count: 0, stocks: [] };
            }
            metrics[secName].invested += stock.investedValue;
            metrics[secName].currentValue += stock.currentValue;
            metrics[secName].pl += stock.unrealisedPL;
            metrics[secName].count += 1;
            metrics[secName].stocks.push(stock.ticker || stock.symbol || stock.name);
            totalPortfolioValue += stock.currentValue;
        });

        Object.keys(metrics).forEach(secName => {
            metrics[secName].percentAllocation = totalPortfolioValue > 0
                ? (metrics[secName].currentValue / totalPortfolioValue) * 100
                : 0;
            metrics[secName].plPercent = metrics[secName].invested > 0
                ? (metrics[secName].pl / metrics[secName].invested) * 100
                : 0;
        });

        const activeSectorList = Object.values(metrics).filter(m => m.count > 0);

        return { metrics, totalPortfolioValue, activeSectorList };
    }, [stockRows]);

    const totalProfitLoss = useMemo(() => currentTotalValue - totalInvested, [currentTotalValue, totalInvested]);
    const isTotalProfit = totalProfitLoss >= 0;

    const sortedStockRows = useMemo(() => {
        return [...displayStockRows].sort((a, b) => {
            if (!sortOrder) return 0;
            return sortOrder === 'desc'
                ? b.unrealisedPL - a.unrealisedPL
                : a.unrealisedPL - b.unrealisedPL;
        });
    }, [displayStockRows, sortOrder]);

    const pendingDividendsCount = useMemo(() => {
        return activeStocks.filter(stock => {
            if (!expectsDividends(stock)) return false;
            return !stock.dividends || !stock.dividends[currentYear] || Number(stock.dividends[currentYear]) === 0;
        }).length;
    }, [activeStocks, currentYear]);

    const activeDividendsData = useMemo(() => {
        const data = filteredStocks.reduce((acc, stock) => {
            const stockDividends = stock.dividends || {};
            Object.entries(stockDividends).forEach(([year, amount]) => {
                acc.total += Number(amount);
                acc.yearly[year] = (acc.yearly[year] || 0) + Number(amount);
            });
            return acc;
        }, { total: 0, yearly: {} });

        data.total = Number(data.total.toFixed(2));
        return data;
    }, [filteredStocks]);

    const dividendGraphData = useMemo(() => {
        return Object.entries(activeDividendsData.yearly)
            .map(([year, amount]) => ({ year, amount: Number(amount.toFixed(2)) }))
            .sort((a, b) => a.year.localeCompare(b.year));
    }, [activeDividendsData]);

    const stockTreemapData = useMemo(() => {
        return stockRows.map(stock => ({
            name: stock.name,
            ticker: stock.ticker || stock.symbol || stock.name,
            value: stock.currentValue,
            percentage: stock.unrealisedPercent
        })).filter(item => item.value > 0);
    }, [stockRows]);

    const dividendTreemapData = useMemo(() => {
        return filteredStocks.map(stock => {
            const stockDividends = stock.dividends || {};
            const totalStockDividend = Object.values(stockDividends).reduce((sum, amount) => sum + Number(amount), 0);
            return {
                name: stock.name,
                ticker: stock.ticker || stock.symbol || stock.name,
                value: totalStockDividend
            };
        }).filter(item => item.value > 0);
    }, [filteredStocks]);

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
            const stockToSave = {
                ...stockData,
                manualInvestedAmount: stockData.manualInvestedAmount,
                realisedPL: stockData.realisedPL
            };

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
            updatedStocks = [...stocks, { ...stockToSave, transactions: initialTransactions }];
        }

        const updatedMarket = { ...market, stocks: updatedStocks };
        await updateItem('savings', updatedMarket);
        setIsModalOpen(false);
        setEditingStock(null);
    };

    const handleDeleteStock = async (stockId) => {
        setStockToDelete(stockId);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteStock = async () => {
        if (!stockToDelete) return;
        const updatedStocks = stocks.filter(s => String(s.id) !== String(stockToDelete));
        const updatedMarket = { ...market, stocks: updatedStocks };
        await updateItem('savings', updatedMarket);
        setStockToDelete(null);
        setIsDeleteModalOpen(false);
    };

    const handleArchiveToggle = async (stockId, archiveStatus) => {
        const updatedStocks = stocks.map(s => {
            if (s.id === stockId) {
                return { ...s, isArchived: archiveStatus };
            }
            return s;
        });
        const updatedMarket = { ...market, stocks: updatedStocks };
        await updateItem('savings', updatedMarket);
    };

    const handleAddColumn = async (e) => {
        e.preventDefault();
        if (!newColumnName.trim()) return;

        const updatedColumns = [...customColumns, newColumnName.trim()];
        const updatedMarket = { ...market, customColumns: updatedColumns };
        await updateItem('savings', updatedMarket);

        setNewColumnName('');
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
        setColumnToDelete(index);
        setIsDeleteColumnModalOpen(true);
    };

    const confirmDeleteColumn = async () => {
        if (columnToDelete === null) return;
        const newColumns = customColumns.filter((_, i) => i !== columnToDelete);
        const updatedMarket = { ...market, customColumns: newColumns };
        await updateItem('savings', updatedMarket);
        setColumnToDelete(null);
        setIsDeleteColumnModalOpen(false);
    };

    // Premium CSS styles for glassmorphism
    const styles = {
        breadcrumb: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#a1a1aa',
            fontSize: '0.825rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'color 0.2s',
            background: 'none',
            border: 'none',
            padding: 0
        },
        headerContainer: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '1rem'
        },
        titleIcon: {
            padding: '0.5rem',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            color: '#818cf8',
            display: 'flex',
            alignItems: 'center',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.1)'
        },
        statGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2rem'
        },
        glassCard: (gradientColor = 'rgba(255, 255, 255, 0.03)', borderColor = 'rgba(255, 255, 255, 0.08)', shadowColor = 'rgba(0, 0, 0, 0.25)') => ({
            background: `linear-gradient(135deg, ${gradientColor} 0%, rgba(255, 255, 255, 0.01) 100%)`,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '1.25rem',
            padding: '1.5rem',
            border: `1px solid ${borderColor}`,
            boxShadow: `0 8px 32px 0 ${shadowColor}`,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.3s, box-shadow 0.3s'
        }),
        tabBar: {
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '1.5rem',
            gap: '1.5rem',
            position: 'relative',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
        },
        tabButton: (isActive) => ({
            paddingBottom: '0.875rem',
            paddingLeft: '0.5rem',
            paddingRight: '0.5rem',
            fontWeight: '700',
            fontSize: '0.875rem',
            cursor: 'pointer',
            position: 'relative',
            color: isActive ? '#818cf8' : '#71717a',
            border: 'none',
            background: 'none',
            borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
            transition: 'color 0.3s, border-color 0.3s'
        }),
        filterPanel: {
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginBottom: '1.5rem',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '1.25rem',
            borderRadius: '1.25rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
        },
        controlsWrapper: {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.75rem',
            justifyContent: 'space-between'
        },
        inputWrapper: {
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
        },
        searchInput: {
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: 'white',
            padding: '0.5rem 1rem 0.5rem 2.25rem',
            borderRadius: '0.75rem',
            outline: 'none',
            width: '240px',
            fontSize: '0.875rem',
            transition: 'border-color 0.3s, box-shadow 0.3s'
        },
        checkboxLabel: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: '#d4d4d8',
            cursor: 'pointer',
            backgroundColor: 'rgba(16, 185, 129, 0.04)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            padding: '0.5rem 0.875rem',
            borderRadius: '0.75rem',
            userSelect: 'none',
            transition: 'background-color 0.2s, border-color 0.2s'
        },
        toggleGroup: {
            display: 'flex',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '0.75rem',
            padding: '0.2rem',
            border: '1px solid rgba(255, 255, 255, 0.08)'
        },
        toggleButton: (isActive) => ({
            padding: '0.375rem 0.5rem',
            borderRadius: '0.5rem',
            backgroundColor: isActive ? '#4f46e5' : 'transparent',
            color: isActive ? 'white' : '#a1a1aa',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.2s, color 0.2s',
            border: 'none'
        }),
        actionButton: (bg = '#4f46e5', hoverBg = '#4338ca') => ({
            padding: '0.5rem 1rem',
            borderRadius: '0.75rem',
            backgroundColor: bg,
            color: 'white',
            fontWeight: '700',
            fontSize: '0.825rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            cursor: 'pointer',
            transition: 'background-color 0.2s, transform 0.2s, box-shadow 0.2s',
            border: 'none',
            boxShadow: `0 4px 12px ${bg}25`
        }),
        iconButton: (bg = 'rgba(255, 255, 255, 0.03)', color = '#a1a1aa', border = 'rgba(255, 255, 255, 0.08)') => ({
            padding: '0.5rem',
            borderRadius: '0.75rem',
            backgroundColor: bg,
            border: `1px solid ${border}`,
            color: color,
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.2s, color 0.2s, border-color 0.2s',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }),
        tableContainer: {
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '1.25rem',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
            overflow: 'auto',
            padding: 0
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: '1500px'
        },
        th: (align = 'left', stickyRight = false) => ({
            padding: '1rem var(--spacing-md)',
            textAlign: align,
            color: 'rgba(255, 255, 255, 0.6)',
            fontWeight: '700',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
            backgroundColor: stickyRight ? '#121225' : 'rgba(255, 255, 255, 0.02)',
            position: stickyRight ? 'sticky' : 'static',
            right: stickyRight ? 0 : 'auto',
            zIndex: stickyRight ? 10 : 1
        }),
        td: (align = 'left', isBold = false, color = 'var(--text-primary)', stickyRight = false, isDividendPending = false) => ({
            padding: '1rem var(--spacing-md)',
            textAlign: align,
            color: color,
            fontWeight: isBold ? '700' : '500',
            fontSize: '13px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            backgroundColor: stickyRight ? '#121225' : (isDividendPending ? 'rgba(16, 185, 129, 0.03)' : 'transparent'),
            position: stickyRight ? 'sticky' : 'static',
            right: stickyRight ? 0 : 'auto',
            boxShadow: stickyRight ? '-5px 0 10px rgba(0,0,0,0.15)' : 'none',
            zIndex: stickyRight ? 9 : 1
        }),
        actionBtnCell: {
            padding: '0.375rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'background-color 0.2s, color 0.2s'
        }
    };

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <BackButton label="Back to Investments" />

            {/* Dashboard Title Panel */}
            <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h2 style={{
                    fontSize: '2rem',
                    fontWeight: '900',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    margin: 0,
                    letterSpacing: '-0.02em'
                }}>
                    <span style={styles.titleIcon}>
                        <TrendingUp size={24} />
                    </span>
                    {market.title}
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#a1a1aa', margin: 0 }}>Portfolio overview, custom tracking & real-time analytics</p>
            </div>

            {/* Modern Premium Stat Cards */}
            <div style={styles.statGrid}>
                {/* Total Invested */}
                <div style={styles.glassCard('rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.06)')}
                     onMouseEnter={(e) => {
                         e.currentTarget.style.transform = 'translateY(-2px)';
                         e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                     }}
                     onMouseLeave={(e) => {
                         e.currentTarget.style.transform = 'translateY(0)';
                         e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                     }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.75rem', opacity: 0.05, color: 'white' }}>
                        <ArrowUpRight size={48} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#71717a', marginBottom: '0.25rem', margin: 0 }}>Total Invested</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(totalInvested)}</h3>
                    </div>
                    <p style={{ fontSize: '0.625rem', color: '#a1a1aa', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem', margin: 0 }}>
                        <Info size={12} style={{ color: '#71717a' }} /> Live cost basis of active positions
                    </p>
                </div>

                {/* Current Value */}
                <div style={styles.glassCard('rgba(99, 102, 241, 0.05)', 'rgba(99, 102, 241, 0.15)', 'rgba(99, 102, 241, 0.15)')}
                     onMouseEnter={(e) => {
                         e.currentTarget.style.transform = 'translateY(-2px)';
                         e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.25)';
                     }}
                     onMouseLeave={(e) => {
                         e.currentTarget.style.transform = 'translateY(0)';
                         e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.15)';
                     }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.75rem', opacity: 0.1, color: '#818cf8' }}>
                        <TrendingUp size={48} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#818cf8', marginBottom: '0.25rem', margin: 0 }}>Current Value</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(currentTotalValue)}</h3>
                    </div>
                    <p style={{ fontSize: '0.625rem', color: '#a1a1aa', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.375rem', margin: 0 }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
                        Live market portfolio evaluation
                    </p>
                </div>

                {/* Total Profit/Loss */}
                <div style={styles.glassCard(
                    isTotalProfit ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                    isTotalProfit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    isTotalProfit ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'
                )}
                     onMouseEnter={(e) => {
                         e.currentTarget.style.transform = 'translateY(-2px)';
                         e.currentTarget.style.borderColor = isTotalProfit ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
                     }}
                     onMouseLeave={(e) => {
                         e.currentTarget.style.transform = 'translateY(0)';
                         e.currentTarget.style.borderColor = isTotalProfit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
                     }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.75rem', opacity: 0.1, color: isTotalProfit ? '#34d399' : '#f87171' }}>
                        {isTotalProfit ? <TrendingUp size={48} /> : <TrendingDown size={48} />}
                    </div>
                    <div>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: isTotalProfit ? '#34d399' : '#f87171', marginBottom: '0.25rem', margin: 0 }}>
                            Total Unrealised P/L
                        </p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: isTotalProfit ? '#34d399' : '#f87171', fontFamily: 'monospace', margin: 0 }}>
                            {isTotalProfit ? '+' : ''}{formatCurrency(totalProfitLoss)}
                        </h3>
                    </div>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.625rem',
                        fontWeight: 'bold',
                        marginTop: '1rem',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '0.375rem',
                        width: 'fit-content',
                        backgroundColor: isTotalProfit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: isTotalProfit ? '#34d399' : '#f87171',
                        border: isTotalProfit ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                    }}>
                        {isTotalProfit ? '▲' : '▼'} {totalInvested > 0 ? ((totalProfitLoss / totalInvested) * 100).toFixed(2) : '0.00'}% Net Return
                    </span>
                </div>

                {/* Dividends Summary */}
                <div style={styles.glassCard('rgba(13, 148, 136, 0.05)', 'rgba(13, 148, 136, 0.15)', 'rgba(13, 148, 136, 0.1)')}
                     onMouseEnter={(e) => {
                         e.currentTarget.style.transform = 'translateY(-2px)';
                         e.currentTarget.style.borderColor = 'rgba(13, 148, 136, 0.25)';
                     }}
                     onMouseLeave={(e) => {
                         e.currentTarget.style.transform = 'translateY(0)';
                         e.currentTarget.style.borderColor = 'rgba(13, 148, 136, 0.15)';
                     }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.75rem', opacity: 0.1, color: '#2dd4bf' }}>
                        <Award size={48} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#2dd4bf', marginBottom: '0.25rem', margin: 0 }}>Dividends (Total)</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#2dd4bf', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(activeDividendsData.total)}</h3>
                    </div>
                    <p style={{ fontSize: '0.625rem', color: '#a1a1aa', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.375rem', margin: 0 }}>
                        {pendingDividendsCount > 0 ? (
                            <>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }}></span>
                                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{pendingDividendsCount} pending this year</span>
                            </>
                        ) : (
                            <>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0d9488' }}></span>
                                <span>No pending dividends for {currentYear}</span>
                            </>
                        )}
                    </p>
                </div>
            </div>

            {/* Dashboard Tabs Switched Controls */}
            <div style={styles.tabBar}>
                <button
                    onClick={() => setActiveTab('holdings')}
                    style={styles.tabButton(activeTab === 'holdings')}
                >
                    Active Holdings ({activeStocks.length})
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    style={styles.tabButton(activeTab === 'analytics')}
                >
                    Analytics & Allocations
                </button>
                <button
                    onClick={() => setActiveTab('archive')}
                    style={styles.tabButton(activeTab === 'archive')}
                >
                    Archive / History ({archivedStocks.length})
                </button>
            </div>

            {/* TABS RENDER */}

            {/* 1. HOLDINGS TAB */}
            {activeTab === 'holdings' && (
                <div>
                    {/* Modern Filter Panel */}
                    <div style={styles.filterPanel}>
                        <div style={styles.controlsWrapper}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                                {/* Search */}
                                <div style={styles.inputWrapper}>
                                    <input
                                        type="text"
                                        placeholder="Search stock or ticker..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={styles.searchInput}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                                            e.currentTarget.style.boxShadow = '0 0 10px rgba(99, 102, 241, 0.15)';
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    />
                                    <Search style={{ position: 'absolute', left: '0.75rem', color: '#71717a' }} size={16} />
                                </div>

                                {/* Pending Dividends Quick Filter */}
                                <label
                                    style={styles.checkboxLabel}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
                                        e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.04)';
                                        e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.15)';
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={showPendingOnly}
                                        onChange={(e) => setShowPendingOnly(e.target.checked)}
                                        style={{ cursor: 'pointer', accentColor: '#10b981' }}
                                    />
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: '700', color: '#34d399' }}>
                                        <AlertCircle size={14} /> Pending Dividends ({pendingDividendsCount})
                                    </span>
                                </label>

                                {/* Market Cap Filter */}
                                <div style={styles.toggleGroup}>
                                    {['All', 'Large Cap', 'Mid Cap', 'Small Cap'].map(cap => (
                                        <button
                                            key={cap}
                                            onClick={() => setCapFilter(cap)}
                                            style={{
                                                ...styles.toggleButton(capFilter === cap),
                                                fontSize: '0.7rem',
                                                fontWeight: '700',
                                                padding: '0.375rem 0.625rem',
                                                borderRadius: '0.5rem',
                                                gap: '0.25rem',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <Layers size={12} />
                                            {cap === 'All' ? 'All Caps' : cap}
                                        </button>
                                    ))}
                                </div>

                                {/* Sector Filter Dropdown */}
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <select
                                        value={sectorFilter}
                                        onChange={(e) => setSectorFilter(e.target.value)}
                                        style={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            color: sectorFilter !== 'All' ? '#60a5fa' : '#d4d4d8',
                                            padding: '0.4rem 1rem 0.4rem 2rem',
                                            borderRadius: '0.75rem',
                                            outline: 'none',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="All" style={{ backgroundColor: '#18181b', color: '#fff' }}>All Sectors</option>
                                        {OFFICIAL_SECTORS.map(sec => (
                                            <option key={sec.name} value={sec.name} style={{ backgroundColor: '#18181b', color: '#fff' }}>
                                                {sec.icon} {sec.name}
                                            </option>
                                        ))}
                                    </select>
                                    <PieChartIcon size={14} style={{ position: 'absolute', left: '0.625rem', color: '#818cf8', pointerEvents: 'none' }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                                {/* View Mode Toggle */}
                                <div style={styles.toggleGroup}>
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        style={styles.toggleButton(viewMode === 'grid')}
                                        title="Grid View"
                                    >
                                        <LayoutGrid size={16} />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('table')}
                                        style={styles.toggleButton(viewMode === 'table')}
                                        title="Table View"
                                    >
                                        <Table size={16} />
                                    </button>
                                </div>

                                {/* Sort Actions */}
                                <div style={styles.toggleGroup}>
                                    <button
                                        onClick={() => setSortOrder('desc')}
                                        style={{
                                            ...styles.toggleButton(sortOrder === 'desc'),
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            padding: '0.375rem 0.75rem',
                                            borderRadius: '0.5rem'
                                        }}
                                    >
                                        Profit High
                                    </button>
                                    <button
                                        onClick={() => setSortOrder('asc')}
                                        style={{
                                            ...styles.toggleButton(sortOrder === 'asc'),
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            padding: '0.375rem 0.75rem',
                                            borderRadius: '0.5rem'
                                        }}
                                    >
                                        Profit Low
                                    </button>
                                </div>

                                {/* Manage Columns */}
                                <button
                                    onClick={() => setIsManageColumnsModalOpen(true)}
                                    style={styles.iconButton()}
                                    title="Manage Columns"
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                                        e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                                        e.currentTarget.style.color = '#a1a1aa';
                                    }}
                                >
                                    <Settings size={16} />
                                </button>

                                {/* Add Column */}
                                <button
                                    onClick={() => setIsAddColumnModalOpen(true)}
                                    style={styles.actionButton('#059669', '#047857')}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#047857';
                                        e.currentTarget.style.transform = 'scale(1.02)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#059669';
                                        e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                >
                                    <Plus size={16} />
                                    <span>Add Column</span>
                                </button>

                                {/* Refresh Prices.
                                    refreshStockPrices has existed in the context all
                                    along with nothing calling it — there was no way to
                                    update prices from the interface at all. */}
                                <button
                                    disabled={isRefreshingPrices}
                                    onClick={async () => {
                                        setIsRefreshingPrices(true);
                                        setRefreshNote(null);
                                        const r = await refreshStockPrices(String(market.id));
                                        setIsRefreshingPrices(false);
                                        setRefreshNote(r.success
                                            ? `Updated ${r.updated} of ${r.total} prices${r.notUpdated?.length ? ` · no quote for ${r.notUpdated.length}` : ''}`
                                            : (r.message || 'Refresh failed'));
                                    }}
                                    style={{
                                        ...styles.actionButton('#0d9488', '#0f766e'),
                                        opacity: isRefreshingPrices ? 0.6 : 1,
                                        cursor: isRefreshingPrices ? 'wait' : 'pointer',
                                    }}
                                >
                                    <RefreshCw size={16} className={isRefreshingPrices ? 'animate-spin' : ''} />
                                    <span>{isRefreshingPrices ? 'Fetching…' : 'Refresh Prices'}</span>
                                </button>

                                {/* Add Stock */}
                                <button
                                    onClick={() => {
                                        setEditingStock(null);
                                        setIsModalOpen(true);
                                    }}
                                    style={styles.actionButton('#4f46e5', '#4338ca')}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#4338ca';
                                        e.currentTarget.style.transform = 'scale(1.02)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#4f46e5';
                                        e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                >
                                    <Plus size={16} />
                                    <span>Add Stock</span>
                                </button>
                                {(refreshNote || market.pricesUpdatedAt) && (
                                    <span
                                        title={market.pricesUpdatedAt ? new Date(market.pricesUpdatedAt).toLocaleString() : undefined}
                                        style={{
                                            fontSize: '11px', alignSelf: 'center', fontWeight: 600,
                                            color: refreshNote ? '#a1a1aa'
                                                : isStale(market.pricesUpdatedAt) ? '#fbbf24' : '#71717a',
                                        }}
                                    >
                                        {refreshNote || `Prices updated ${timeAgo(market.pricesUpdatedAt)}`}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Market Cap Performance Breakdown */}
                    {stockRows.length > 0 && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            {/* Cap Category KPI Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                {[{cap: 'Large Cap', color: '#818cf8', bgColor: 'rgba(99, 102, 241, 0.08)', borderColor: 'rgba(99, 102, 241, 0.2)', icon: '🏢'},
                                  {cap: 'Mid Cap', color: '#fbbf24', bgColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.2)', icon: '🏗️'},
                                  {cap: 'Small Cap', color: '#22d3ee', bgColor: 'rgba(6, 182, 212, 0.08)', borderColor: 'rgba(6, 182, 212, 0.2)', icon: '🚀'}
                                ].map(({ cap, color, bgColor, borderColor, icon }) => {
                                    const m = capMetrics.metrics[cap];
                                    if (m.count === 0) return null;
                                    const isProfit = m.pl >= 0;
                                    return (
                                        <div
                                            key={cap}
                                            onClick={() => setCapFilter(capFilter === cap ? 'All' : cap)}
                                            style={{
                                                background: `linear-gradient(135deg, ${bgColor} 0%, rgba(255,255,255,0.01) 100%)`,
                                                border: `1px solid ${capFilter === cap ? color : borderColor}`,
                                                borderRadius: '1rem',
                                                padding: '1.25rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                position: 'relative',
                                                overflow: 'hidden',
                                                boxShadow: capFilter === cap ? `0 0 20px ${bgColor}` : 'none'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                <div>
                                                    <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: color }}>
                                                        {icon} {cap}
                                                    </span>
                                                    <div style={{ fontSize: '0.6rem', color: '#71717a', marginTop: '0.125rem' }}>
                                                        {m.count} stock{m.count !== 1 ? 's' : ''} · {m.percentAllocation.toFixed(1)}% of portfolio
                                                    </div>
                                                </div>
                                                <span style={{
                                                    padding: '0.125rem 0.5rem',
                                                    borderRadius: '0.375rem',
                                                    fontSize: '0.625rem',
                                                    fontWeight: '800',
                                                    fontFamily: 'monospace',
                                                    backgroundColor: isProfit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                                    color: isProfit ? '#34d399' : '#f87171',
                                                    border: `1px solid ${isProfit ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                                                }}>
                                                    {isProfit ? '▲' : '▼'} {m.plPercent.toFixed(2)}%
                                                </span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.575rem', color: '#71717a', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Invested</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#d4d4d8', fontFamily: 'monospace' }}>{formatCurrency(m.invested)}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.575rem', color: '#71717a', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Current</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'white', fontFamily: 'monospace' }}>{formatCurrency(m.currentValue)}</div>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: '0.625rem', fontSize: '0.75rem', fontWeight: '700', fontFamily: 'monospace', color: isProfit ? '#34d399' : '#f87171' }}>
                                                {isProfit ? '+' : ''}{formatCurrency(m.pl)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Stacked Allocation Bar */}
                            {capMetrics.totalPortfolioValue > 0 && (
                                <div style={{
                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '1rem',
                                    padding: '1rem 1.25rem'
                                }}>
                                    <div style={{ fontSize: '0.625rem', fontWeight: '800', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>
                                        Portfolio Allocation by Market Cap
                                    </div>
                                    <div style={{ display: 'flex', borderRadius: '0.5rem', overflow: 'hidden', height: '12px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                                        {[{cap: 'Large Cap', color: '#818cf8'}, {cap: 'Mid Cap', color: '#fbbf24'}, {cap: 'Small Cap', color: '#22d3ee'}, {cap: 'Unclassified', color: '#71717a'}]
                                            .filter(({cap}) => capMetrics.metrics[cap].percentAllocation > 0)
                                            .map(({cap, color}) => (
                                            <div
                                                key={cap}
                                                style={{
                                                    width: `${capMetrics.metrics[cap].percentAllocation}%`,
                                                    backgroundColor: color,
                                                    transition: 'width 0.5s ease',
                                                    opacity: 0.75
                                                }}
                                                title={`${cap}: ${capMetrics.metrics[cap].percentAllocation.toFixed(1)}%`}
                                            />
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.625rem' }}>
                                        {[{cap: 'Large Cap', color: '#818cf8'}, {cap: 'Mid Cap', color: '#fbbf24'}, {cap: 'Small Cap', color: '#22d3ee'}, {cap: 'Unclassified', color: '#71717a'}]
                                            .filter(({cap}) => capMetrics.metrics[cap].count > 0)
                                            .map(({cap, color}) => (
                                            <div key={cap} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.675rem', color: '#a1a1aa' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: color, display: 'inline-block' }} />
                                                <span style={{ fontWeight: '700', color: color }}>{cap}</span>
                                                <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{capMetrics.metrics[cap].percentAllocation.toFixed(1)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Sector Performance & Allocation Breakdown */}
                            {sectorMetrics.activeSectorList.length > 0 && (
                                <div style={{ marginTop: '1.5rem' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <PieChartIcon size={16} className="text-indigo-400" />
                                        Official 11 Market Sectors Performance Breakdown
                                    </div>

                                    {/* Sector KPI Cards Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                        {sectorMetrics.activeSectorList.map((sec) => {
                                            const isProfit = sec.pl >= 0;
                                            const isSelected = sectorFilter === sec.name;

                                            return (
                                                <div
                                                    key={sec.name}
                                                    onClick={() => setSectorFilter(isSelected ? 'All' : sec.name)}
                                                    style={{
                                                        background: `linear-gradient(135deg, ${sec.color}15 0%, rgba(255,255,255,0.01) 100%)`,
                                                        border: `1px solid ${isSelected ? sec.color : sec.color + '33'}`,
                                                        borderRadius: '1rem',
                                                        padding: '1.25rem',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s ease',
                                                        position: 'relative',
                                                        overflow: 'hidden',
                                                        boxShadow: isSelected ? `0 0 20px ${sec.color}33` : 'none'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                        <div>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: sec.color, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                                <span>{sec.icon}</span> {sec.name}
                                                            </span>
                                                            <div style={{ fontSize: '0.6rem', color: '#71717a', marginTop: '0.125rem' }}>
                                                                {sec.count} stock{sec.count !== 1 ? 's' : ''} · {sec.percentAllocation.toFixed(1)}% of portfolio
                                                            </div>
                                                        </div>
                                                        <span style={{
                                                            padding: '0.125rem 0.5rem',
                                                            borderRadius: '0.375rem',
                                                            fontSize: '0.625rem',
                                                            fontWeight: '800',
                                                            fontFamily: 'monospace',
                                                            backgroundColor: isProfit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                                            color: isProfit ? '#34d399' : '#f87171',
                                                            border: `1px solid ${isProfit ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                                                        }}>
                                                            {isProfit ? '▲' : '▼'} {sec.plPercent.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.575rem', color: '#71717a', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Invested</div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#d4d4d8', fontFamily: 'monospace' }}>{formatCurrency(sec.invested)}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.575rem', color: '#71717a', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Current</div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'white', fontFamily: 'monospace' }}>{formatCurrency(sec.currentValue)}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ marginTop: '0.625rem', fontSize: '0.75rem', fontWeight: '700', fontFamily: 'monospace', color: isProfit ? '#34d399' : '#f87171' }}>
                                                        {isProfit ? '+' : ''}{formatCurrency(sec.pl)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Sector Allocation Stacked Bar */}
                                    {sectorMetrics.totalPortfolioValue > 0 && (
                                        <div style={{
                                            background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '1rem',
                                            padding: '1rem 1.25rem'
                                        }}>
                                            <div style={{ fontSize: '0.625rem', fontWeight: '800', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>
                                                Portfolio Allocation by Sector
                                            </div>
                                            <div style={{ display: 'flex', borderRadius: '0.5rem', overflow: 'hidden', height: '12px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                                                {sectorMetrics.activeSectorList
                                                    .filter(sec => sec.percentAllocation > 0)
                                                    .map(sec => (
                                                        <div
                                                            key={sec.name}
                                                            style={{
                                                                width: `${sec.percentAllocation}%`,
                                                                backgroundColor: sec.color,
                                                                transition: 'width 0.5s ease',
                                                                opacity: 0.8
                                                            }}
                                                            title={`${sec.name}: ${sec.percentAllocation.toFixed(1)}%`}
                                                        />
                                                    ))}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.625rem' }}>
                                                {sectorMetrics.activeSectorList
                                                    .filter(sec => sec.count > 0)
                                                    .map(sec => (
                                                        <div key={sec.name} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.675rem', color: '#a1a1aa' }}>
                                                            <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: sec.color, display: 'inline-block' }} />
                                                            <span style={{ fontWeight: '700', color: sec.color }}>{sec.icon} {sec.name}</span>
                                                            <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{sec.percentAllocation.toFixed(1)}%</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stock list empty state or content */}
                    {sortedStockRows.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '4rem 1.5rem',
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                            backdropFilter: 'blur(12px)',
                            borderRadius: '1.25rem',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            margin: '1.5rem 0'
                        }}>
                            <Info style={{ margin: '0 auto 0.75rem auto', color: '#71717a' }} size={40} />
                            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', marginBottom: '0.25rem' }}>No active positions matching your criteria</h3>
                            <p style={{ fontSize: '0.75rem', color: '#71717a' }}>Check search text, dividend filters, or add a new stock to your portfolio.</p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        /* GRID VIEW */
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '1.25rem'
                        }}>
                            {sortedStockRows.map((stock) => {
                                const isProfit = stock.unrealisedPL >= 0;
                                const isDividendPending = expectsDividends(stock) && (!stock.dividends || !stock.dividends[currentYear] || Number(stock.dividends[currentYear]) === 0);

                                return (
                                    <div
                                        key={stock.id}
                                        style={{
                                            position: 'relative',
                                            background: isDividendPending 
                                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%)' 
                                                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                                            backdropFilter: 'blur(16px)',
                                            WebkitBackdropFilter: 'blur(16px)',
                                            borderRadius: '1.25rem',
                                            border: isDividendPending ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                                            boxShadow: isDividendPending ? '0 8px 32px rgba(16, 185, 129, 0.05), inset 0 0 16px rgba(16, 185, 129, 0.03)' : '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            overflow: 'hidden',
                                            transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.3s',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-3px)';
                                            e.currentTarget.style.borderColor = isDividendPending ? 'rgba(16, 185, 129, 0.4)' : 'rgba(99, 102, 241, 0.25)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.borderColor = isDividendPending ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.06)';
                                        }}
                                    >
                                        {/* Pending Div Tag */}
                                        {isDividendPending && (
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                right: 0,
                                                backgroundColor: 'rgba(16, 185, 129, 0.25)',
                                                color: '#34d399',
                                                borderLeft: '1px solid rgba(16, 185, 129, 0.3)',
                                                borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '0 0 0 0.75rem',
                                                fontSize: '9px',
                                                fontWeight: '900',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em'
                                            }}>
                                                Pending Div
                                            </div>
                                        )}

                                        <div style={{ padding: '1.25rem', flex: 1 }}>
                                            {/* Header */}
                                            <div style={{ marginBottom: '1rem' }}>
                                                <span style={{
                                                    padding: '0.125rem 0.5rem',
                                                    borderRadius: '0.375rem',
                                                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                                    color: '#818cf8',
                                                    fontFamily: 'monospace',
                                                    fontSize: '10px',
                                                    fontWeight: '800',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.1em',
                                                    border: '1px solid rgba(99, 102, 241, 0.2)'
                                                }}>
                                                    {stock.ticker || stock.symbol || '-'}
                                                </span>
                                                {resolveMarketCap(stock) !== 'Unclassified' && (
                                                    <span style={{
                                                        padding: '0.125rem 0.5rem',
                                                        borderRadius: '0.375rem',
                                                        fontSize: '9px',
                                                        fontWeight: '800',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.08em',
                                                        marginLeft: '0.375rem',
                                                        backgroundColor: resolveMarketCap(stock) === 'Large Cap' ? 'rgba(99, 102, 241, 0.12)' : resolveMarketCap(stock) === 'Mid Cap' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(6, 182, 212, 0.12)',
                                                        color: resolveMarketCap(stock) === 'Large Cap' ? '#818cf8' : resolveMarketCap(stock) === 'Mid Cap' ? '#fbbf24' : '#22d3ee',
                                                        border: `1px solid ${resolveMarketCap(stock) === 'Large Cap' ? 'rgba(99, 102, 241, 0.25)' : resolveMarketCap(stock) === 'Mid Cap' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(6, 182, 212, 0.25)'}`
                                                    }}>
                                                        {resolveMarketCap(stock) === 'Large Cap' ? 'LC' : resolveMarketCap(stock) === 'Mid Cap' ? 'MC' : 'SC'}
                                                    </span>
                                                )}
                                                {stock.sector && (
                                                    <span style={{
                                                        padding: '0.125rem 0.5rem',
                                                        borderRadius: '0.375rem',
                                                        fontSize: '9px',
                                                        fontWeight: '800',
                                                        letterSpacing: '0.04em',
                                                        marginLeft: '0.375rem',
                                                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                                        color: '#e4e4e7',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)'
                                                    }}>
                                                        {OFFICIAL_SECTORS.find(s => s.name === stock.sector)?.icon || '📊'} {stock.sector}
                                                    </span>
                                                )}
                                                <h4
                                                    onClick={() => navigate(`/savings/stock-market/${id}/stock/${stock.id}`)}
                                                    style={{
                                                        fontSize: '1.05rem',
                                                        fontWeight: '700',
                                                        color: 'white',
                                                        marginTop: '0.5rem',
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        textDecoration: 'none',
                                                        transition: 'color 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.color = '#818cf8'}
                                                    onMouseLeave={(e) => e.currentTarget.style.color = '#white'}
                                                >
                                                    {stock.name}
                                                </h4>
                                            </div>

                                            {/* Values */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                                <div>
                                                    <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em', display: 'block', marginBottom: '0.125rem' }}>Current Value</span>
                                                    <span style={{ fontSize: '0.875rem', fontWeight: '900', color: 'white', fontFamily: 'monospace' }}>{formatCurrency(stock.currentValue)}</span>
                                                </div>
                                                <div>
                                                    <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em', display: 'block', marginBottom: '0.125rem' }}>Invested Value</span>
                                                    <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#d4d4d8', fontFamily: 'monospace' }}>{formatCurrency(stock.investedValue)}</span>
                                                </div>
                                            </div>

                                            {/* Details Info bar */}
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                backgroundColor: 'rgba(0,0,0,0.2)',
                                                borderRadius: '0.75rem',
                                                padding: '0.5rem 0.75rem',
                                                fontSize: '0.75rem',
                                                color: '#a1a1aa',
                                                marginBottom: '1rem',
                                                border: '1px solid rgba(255,255,255,0.06)'
                                            }}>
                                                <div>Shares: <span style={{ fontWeight: '700', color: 'white', fontFamily: 'monospace' }}>{stock.shares}</span></div>
                                                <div>Avg: <span style={{ fontWeight: '700', color: 'white', fontFamily: 'monospace' }}>{formatCurrency(stock.avgCost)}</span></div>
                                                {/* The traded price itself. The card showed what the holding is
                                                    worth and what it cost, but never the number those are derived
                                                    from — so there was no way to see the price without opening the
                                                    stock. Coloured against average cost, which is the comparison
                                                    that makes a price mean something. */}
                                                <div>
                                                    LTP:{' '}
                                                    <span style={{
                                                        fontWeight: '700',
                                                        fontFamily: 'monospace',
                                                        color: !(Number(stock.currentPrice) > 0)
                                                            ? '#fbbf24'
                                                            : Number(stock.currentPrice) >= Number(stock.avgCost || 0)
                                                                ? '#34d399'
                                                                : '#f87171',
                                                    }}>
                                                        {Number(stock.currentPrice) > 0 ? formatCurrency(stock.currentPrice) : 'no price'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* P&L Status Indicator */}
                                            <div style={{ marginBottom: '1rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#71717a', marginBottom: '0.25rem' }}>
                                                    <span>Unrealised P&L</span>
                                                    <span style={{ fontWeight: '700', color: isProfit ? '#10b981' : '#ef4444' }}>
                                                        {isProfit ? '+' : ''}{stock.unrealisedPercent.toFixed(2)}%
                                                    </span>
                                                </div>
                                                <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
                                                    <div
                                                        style={{
                                                            height: '100%',
                                                            borderRadius: '9999px',
                                                            background: isProfit ? 'linear-gradient(to right, #10b981, #34d399)' : 'linear-gradient(to right, #ef4444, #f87171)',
                                                            width: `${Math.min(100, Math.max(8, (stock.currentValue / Math.max(1, stock.investedValue)) * 50))}%`
                                                        }}
                                                    />
                                                </div>
                                                <span style={{ fontSize: '11px', fontWeight: '700', display: 'block', marginTop: '0.375rem', fontFamily: 'monospace', color: isProfit ? '#34d399' : '#f87171' }}>
                                                    {isProfit ? '+' : ''}{formatCurrency(stock.unrealisedPL)}
                                                </span>
                                            </div>

                                            {/* Custom Columns Values */}
                                            {customColumns.length > 0 && (
                                                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.75rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                                    {customColumns.map(col => (
                                                        <div key={col} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                            <span style={{ color: '#71717a' }}>{col}</span>
                                                            <span style={{ fontWeight: '600', color: '#d4d4d8' }}>{stock.customValues?.[col] || '-'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Card Actions Footer */}
                                        <div style={{ padding: '0.75rem 1.25rem', backgroundColor: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingStock(stock);
                                                    setIsModalOpen(true);
                                                }}
                                                style={{
                                                    ...styles.actionBtnCell,
                                                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                                    color: '#60a5fa'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.25)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.12)'}
                                                title="Edit"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleArchiveToggle(stock.id, true);
                                                }}
                                                style={{
                                                    ...styles.actionBtnCell,
                                                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                                    color: '#fbbf24'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.25)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.12)'}
                                                title="Archive Stock"
                                            >
                                                <Archive size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteStock(stock.id);
                                                }}
                                                style={{
                                                    ...styles.actionBtnCell,
                                                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                                    color: '#f87171'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)'}
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* TABLE VIEW (SLEEK REFACTOR) */
                        <div style={styles.tableContainer}>
                            <table style={styles.table}>
                                <thead>
                                    <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.015)' }}>
                                        <th style={styles.th('left')}>Company Name</th>
                                        <th style={styles.th('left')}>Ticker</th>
                                        <th style={styles.th('center')}>Cap</th>
                                        <th style={styles.th('left')}>Sector</th>
                                        <th style={styles.th('right')}>Shares Held</th>
                                        <th style={styles.th('right')}>Avg Cost</th>
                                        <th style={styles.th('right')}>Invested Value</th>
                                        <th style={styles.th('right')}>Current Price</th>
                                        <th style={styles.th('right')}>Current Value</th>
                                        <th style={styles.th('right')}>Unrealised P/L</th>
                                        <th style={styles.th('right')}>Unrealised %</th>

                                        {/* Custom Columns Headers */}
                                        {customColumns.map((col, idx) => (
                                            <th key={idx} style={styles.th('left')}>{col}</th>
                                        ))}

                                        <th style={styles.th('center', true)}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedStockRows.map((stock) => {
                                        const isProfit = stock.unrealisedPL >= 0;
                                        const isDividendPending = expectsDividends(stock) && (!stock.dividends || !stock.dividends[currentYear] || Number(stock.dividends[currentYear]) === 0);

                                        return (
                                            <tr 
                                                key={stock.id} 
                                                style={{ 
                                                    backgroundColor: isDividendPending ? 'rgba(16, 185, 129, 0.03)' : 'transparent',
                                                    transition: 'background-color 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = isDividendPending ? 'rgba(16, 185, 129, 0.06)' : 'rgba(255, 255, 255, 0.02)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = isDividendPending ? 'rgba(16, 185, 129, 0.03)' : 'transparent';
                                                }}
                                            >
                                                <td
                                                    style={styles.td('left', true, 'var(--text-primary)', false, isDividendPending)}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span 
                                                            onClick={() => navigate(`/savings/stock-market/${id}/stock/${stock.id}`)}
                                                            style={{ textDecoration: 'underline', cursor: 'pointer' }}
                                                        >
                                                            {stock.name}
                                                        </span>
                                                        {isDividendPending && (
                                                            <span style={{
                                                                padding: '0.125rem 0.375rem',
                                                                borderRadius: '0.25rem',
                                                                fontSize: '9px',
                                                                fontWeight: '900',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.15em',
                                                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                                                color: '#34d399',
                                                                border: '1px solid rgba(16, 185, 129, 0.3)'
                                                            }} title={`Pending dividend for ${currentYear}`}>
                                                                Pending Div
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={styles.td('left', false, 'var(--text-secondary)', false, isDividendPending)}>
                                                    <span style={{
                                                        padding: '0.125rem 0.375rem',
                                                        borderRadius: '0.25rem',
                                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                                        color: '#d4d4d8',
                                                        fontSize: '0.725rem',
                                                        fontWeight: '700',
                                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                                        fontFamily: 'monospace'
                                                    }}>
                                                        {stock.ticker || stock.symbol || '-'}
                                                    </span>
                                                </td>
                                                <td style={styles.td('center', false, 'var(--text-secondary)', false, isDividendPending)}>
                                                    {resolveMarketCap(stock) !== 'Unclassified' ? (
                                                        <span style={{
                                                            padding: '0.125rem 0.5rem',
                                                            borderRadius: '0.375rem',
                                                            fontSize: '9px',
                                                            fontWeight: '800',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.08em',
                                                            backgroundColor: resolveMarketCap(stock) === 'Large Cap' ? 'rgba(99, 102, 241, 0.12)' : resolveMarketCap(stock) === 'Mid Cap' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(6, 182, 212, 0.12)',
                                                            color: resolveMarketCap(stock) === 'Large Cap' ? '#818cf8' : resolveMarketCap(stock) === 'Mid Cap' ? '#fbbf24' : '#22d3ee',
                                                            border: `1px solid ${resolveMarketCap(stock) === 'Large Cap' ? 'rgba(99, 102, 241, 0.25)' : resolveMarketCap(stock) === 'Mid Cap' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(6, 182, 212, 0.25)'}`
                                                        }}>
                                                            {resolveMarketCap(stock) === 'Large Cap' ? 'LC' : resolveMarketCap(stock) === 'Mid Cap' ? 'MC' : 'SC'}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#52525b', fontSize: '10px' }}>—</span>
                                                    )}
                                                </td>
                                                <td style={styles.td('left', false, 'var(--text-secondary)', false, isDividendPending)}>
                                                    {stock.sector ? (
                                                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#d4d4d8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <span>{OFFICIAL_SECTORS.find(s => s.name === stock.sector)?.icon || '📊'}</span> {stock.sector}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#52525b', fontSize: '10px' }}>—</span>
                                                    )}
                                                </td>
                                                <td style={styles.td('right', false, 'var(--text-primary)', false, isDividendPending)}>
                                                    <span style={{ fontFamily: 'monospace' }}>{stock.shares}</span>
                                                </td>
                                                <td style={styles.td('right', false, 'var(--text-primary)', false, isDividendPending)}>
                                                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(stock.avgCost)}</span>
                                                </td>
                                                <td style={styles.td('right', false, 'var(--text-primary)', false, isDividendPending)}>
                                                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(stock.investedValue)}</span>
                                                </td>
                                                <td style={styles.td('right', false, 'var(--text-primary)', false, isDividendPending)}>
                                                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(stock.currentPrice)}</span>
                                                </td>
                                                <td style={styles.td('right', true, 'var(--text-primary)', false, isDividendPending)}>
                                                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(stock.currentValue)}</span>
                                                </td>
                                                <td style={styles.td('right', true, isProfit ? 'var(--color-success)' : 'var(--color-danger)', false, isDividendPending)}>
                                                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(stock.unrealisedPL)}</span>
                                                </td>
                                                <td style={styles.td('right', true, isProfit ? 'var(--color-success)' : 'var(--color-danger)', false, isDividendPending)}>
                                                    <span style={{ fontFamily: 'monospace' }}>{stock.unrealisedPercent.toFixed(2)}%</span>
                                                </td>

                                                {/* Custom Columns Cells */}
                                                {customColumns.map((col, idx) => (
                                                    <td key={idx} style={styles.td('left', false, 'var(--text-secondary)', false, isDividendPending)}>
                                                        {stock.customValues?.[col] || '-'}
                                                    </td>
                                                ))}

                                                <td style={styles.td('center', false, 'var(--text-primary)', true, isDividendPending)}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingStock(stock);
                                                                setIsModalOpen(true);
                                                            }}
                                                            style={{
                                                                ...styles.actionBtnCell,
                                                                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                                                color: '#60a5fa'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.25)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.12)'}
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleArchiveToggle(stock.id, true);
                                                            }}
                                                            style={{
                                                                ...styles.actionBtnCell,
                                                                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                                                color: '#fbbf24'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.25)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.12)'}
                                                            title="Archive Stock"
                                                        >
                                                            <Archive size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteStock(stock.id);
                                                            }}
                                                            style={{
                                                                ...styles.actionBtnCell,
                                                                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                                                color: '#f87171'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)'}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* 2. ANALYTICS & ALLOCATIONS TAB */}
            {activeTab === 'analytics' && (
                <div>
                    {activeStocks.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '4rem 1.5rem',
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                            backdropFilter: 'blur(12px)',
                            borderRadius: '1.25rem',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            margin: '1.5rem 0'
                        }}>
                            <Info style={{ margin: '0 auto 0.75rem auto', color: '#71717a' }} size={40} />
                            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', marginBottom: '0.25rem' }}>No active stocks for analytics</h3>
                            <p style={{ fontSize: '0.75rem', color: '#71717a' }}>Analytics will generate automatically once you add holdings.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {/* Return, dividends, concentration and the gaps that
                                distort them — all derived from the transaction
                                history rather than the stored summary fields. */}
                            <StockAnalyticsPanels
                                stocks={stocks}
                                formatCurrency={formatCurrency}
                            />

                            {/* Dividend Performance Section */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                {/* Dividend Overview Summary Card */}
                                <div style={{
                                    ...styles.glassCard('rgba(13, 148, 136, 0.06)', 'rgba(13, 148, 136, 0.15)', 'rgba(13, 148, 136, 0.15)'),
                                    minHeight: '220px'
                                }}>
                                    <div>
                                        <p style={{ fontSize: '10px', color: '#2dd4bf', textTransform: 'uppercase', fontWeight: '900', letterSpacing: '0.05em', marginBottom: '0.5rem', margin: 0 }}>Dividend Portfolio Earnings</p>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                            <h3 style={{ fontSize: '2.25rem', fontWeight: '900', color: '#2dd4bf', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(activeDividendsData.total)}</h3>
                                            <span style={{ fontSize: '0.75rem', color: '#71717a' }}>lifetime</span>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#a1a1aa', lineHeight: 1.5, margin: 0 }}>
                                            This metric aggregates all recorded dividend payments for stocks currently active in your portfolio. To add new dividends, add a transaction to the stock's page.
                                        </p>
                                    </div>
                                </div>

                                {/* Dividends by Year Bar Chart */}
                                <div style={{
                                    ...styles.glassCard('rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.06)'),
                                    height: '320px',
                                    gridColumn: 'span 2'
                                }}>
                                    <p style={{ fontSize: '10px', color: '#a1a1aa', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em', marginBottom: '1.25rem', margin: 0 }}>Dividends History by Calendar Year</p>
                                    <div style={{ width: '100%', height: '85%' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={dividendGraphData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                                <XAxis
                                                    dataKey="year"
                                                    tick={{ fill: '#71717a', fontSize: 11 }}
                                                    axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    tick={{ fill: '#71717a', fontSize: 11 }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tickFormatter={(value) => `₹${value}`}
                                                />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#121225', borderColor: 'rgba(255,255,255,0.08)', color: '#fff', borderRadius: '12px' }}
                                                    itemStyle={{ color: '#fff' }}
                                                    formatter={(value) => [`₹${value}`, 'Dividends']}
                                                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                                />
                                                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                                    {dividendGraphData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill="#0d9488" />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Treemap Allocations (Side-by-side) */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '2rem' }}>
                                {/* Stocks by Value Allocation */}
                                {stockTreemapData.length > 0 && (
                                    <div style={{
                                        ...styles.glassCard('rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.06)'),
                                        height: '420px'
                                    }}>
                                        <p style={{ fontSize: '10px', color: '#a1a1aa', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em', marginBottom: '1.25rem', margin: 0 }}>Portfolio Allocation (Current Value)</p>
                                        <div style={{ width: '100%', height: '85%' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <Treemap
                                                    data={stockTreemapData}
                                                    dataKey="value"
                                                    aspectRatio={4 / 3}
                                                    stroke="#121225"
                                                    fill="#4f46e5"
                                                    content={<StockTreemapContent />}
                                                >
                                                    <Tooltip
                                                        formatter={(value, name, props) => [
                                                            `₹${value.toLocaleString('en-IN')}`, 
                                                            props.payload.ticker || props.payload.name
                                                        ]}
                                                        contentStyle={{ backgroundColor: '#121225', borderColor: 'rgba(255,255,255,0.08)', color: '#fff', borderRadius: '12px' }}
                                                        itemStyle={{ color: '#fff' }}
                                                    />
                                                </Treemap>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                                {/* Stocks by Total Dividends Allocation */}
                                {dividendTreemapData.length > 0 && (
                                    <div style={{
                                        ...styles.glassCard('rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.06)'),
                                        height: '420px'
                                    }}>
                                        <p style={{ fontSize: '10px', color: '#a1a1aa', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em', marginBottom: '1.25rem', margin: 0 }}>Dividends Received Allocation</p>
                                        <div style={{ width: '100%', height: '85%' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <Treemap
                                                    data={dividendTreemapData}
                                                    dataKey="value"
                                                    aspectRatio={4 / 3}
                                                    stroke="#121225"
                                                    fill="#0d9488"
                                                    content={<DividendTreemapContent />}
                                                >
                                                    <Tooltip
                                                        formatter={(value, name, props) => [
                                                            `₹${value.toLocaleString('en-IN')}`, 
                                                            props.payload.ticker || props.payload.name
                                                        ]}
                                                        contentStyle={{ backgroundColor: '#121225', borderColor: 'rgba(255,255,255,0.08)', color: '#fff', borderRadius: '12px' }}
                                                        itemStyle={{ color: '#fff' }}
                                                    />
                                                </Treemap>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 3. ARCHIVE TAB */}
            {activeTab === 'archive' && (
                <div>
                    {archivedStocks.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '4rem 1.5rem',
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                            backdropFilter: 'blur(12px)',
                            borderRadius: '1.25rem',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            margin: '1.5rem 0'
                        }}>
                            <Info style={{ margin: '0 auto 0.75rem auto', color: '#71717a' }} size={40} />
                            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', marginBottom: '0.25rem' }}>Archive is empty</h3>
                            <p style={{ fontSize: '0.75rem', color: '#71717a' }}>Fully sold out positions or manually archived stocks will show up here.</p>
                        </div>
                    ) : (() => {
                        // Calculate Archived Totals
                        const archivedTotals = archivedStocks.reduce((totals, stock) => {
                            const transactions = stock.transactions || [];
                            let invested = 0;
                            let pl = 0;

                            if (transactions.length > 0) {
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

                                invested = totalBuyValue;
                                pl = totalSellValue - totalBuyValue;
                            } else {
                                invested = stock.manualInvestedAmount || 0;
                                pl = stock.realisedPL || 0;
                            }

                            return {
                                invested: totals.invested + invested,
                                pl: totals.pl + pl
                            };
                        }, { invested: 0, pl: 0 });

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                                    <div style={styles.glassCard('rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.06)')}>
                                        <p style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: '900', letterSpacing: '0.05em', marginBottom: '0.25rem', margin: 0 }}>Total Archived Invested Capital</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(archivedTotals.invested)}</p>
                                    </div>
                                    <div style={styles.glassCard(
                                        archivedTotals.pl >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                                        archivedTotals.pl >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'
                                    )}>
                                        <p style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: '900', letterSpacing: '0.05em', marginBottom: '0.25rem', margin: 0 }}>Total P/L Booked (Realised)</p>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '950', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace', color: archivedTotals.pl >= 0 ? '#34d399' : '#f87171', margin: 0 }}>
                                            {archivedTotals.pl >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
                                            {formatCurrency(Math.abs(archivedTotals.pl))}
                                        </div>
                                    </div>
                                </div>

                                <div style={styles.tableContainer}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.015)' }}>
                                                <th style={styles.th('left')}>Company Name</th>
                                                <th style={styles.th('left')}>Ticker</th>
                                                <th style={styles.th('right')}>Invested Value</th>
                                                <th style={styles.th('right')}>Profit/Loss Booked</th>
                                                <th style={styles.th('center', true)}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {archivedStocks.map((stock) => {
                                                const transactions = stock.transactions || [];
                                                let calculatedInvested = 0;
                                                let calculatedPL = 0;
                                                let hasTransactions = transactions.length > 0;

                                                if (hasTransactions) {
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

                                                    calculatedInvested = totalBuyValue;
                                                    calculatedPL = totalSellValue - totalBuyValue;
                                                }

                                                const finalInvested = hasTransactions ? calculatedInvested : (stock.manualInvestedAmount || 0);
                                                const finalPL = hasTransactions ? calculatedPL : (stock.realisedPL || 0);
                                                const isProfit = finalPL >= 0;

                                                return (
                                                    <tr key={stock.id} style={{ opacity: 0.8, transition: 'background-color 0.2s' }}>
                                                        <td
                                                            style={styles.td('left', true, 'var(--text-secondary)')}
                                                        >
                                                            <span 
                                                                onClick={() => navigate(`/savings/stock-market/${id}/stock/${stock.id}`)}
                                                                style={{ textDecoration: 'underline', cursor: 'pointer' }}
                                                            >
                                                                {stock.name}
                                                            </span>
                                                        </td>
                                                        <td style={styles.td('left', false, '#71717a')}><span style={{ fontFamily: 'monospace' }}>{stock.ticker || stock.symbol || '-'}</span></td>
                                                        <td style={styles.td('right', false, '#71717a')}>
                                                            <span style={{ fontFamily: 'monospace' }}>{formatCurrency(finalInvested)}</span>
                                                            {hasTransactions && <span style={{ marginLeft: '0.25rem', fontSize: '9px', color: '#60a5fa' }} title="Calculated from transactions">(Auto)</span>}
                                                        </td>
                                                        <td style={styles.td('right', true, isProfit ? 'var(--color-success)' : 'var(--color-danger)')}>
                                                            <span style={{ fontFamily: 'monospace' }}>{formatCurrency(finalPL)}</span>
                                                        </td>
                                                        <td style={styles.td('center', false, 'var(--text-primary)', true)}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingStock(stock);
                                                                        setIsModalOpen(true);
                                                                    }}
                                                                    style={{
                                                                        ...styles.actionBtnCell,
                                                                        backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                                                        color: '#60a5fa'
                                                                    }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.25)'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.12)'}
                                                                    title="Edit Details"
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                                {stock.isArchived && stock.shares > 0 && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleArchiveToggle(stock.id, false);
                                                                        }}
                                                                        style={{
                                                                            ...styles.actionBtnCell,
                                                                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                                                            color: '#34d399'
                                                                        }}
                                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.25)'}
                                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.12)'}
                                                                        title="Unarchive Stock"
                                                                    >
                                                                        <RefreshCw size={14} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteStock(stock.id);
                                                                    }}
                                                                    style={{
                                                                        ...styles.actionBtnCell,
                                                                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                                                        color: '#f87171'
                                                                    }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)'}
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            <StockTransactionModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingStock(null);
                }}
                onSave={handleSaveStock}
                initialData={editingStock}
                customColumns={customColumns}
                allStocks={stocks}
            />

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => { setIsDeleteModalOpen(false); setStockToDelete(null); }}
                onConfirm={confirmDeleteStock}
                title="Delete Stock"
                message="Are you sure you want to delete this stock? This action cannot be undone."
                confirmText="Delete"
            />

            <ConfirmModal
                isOpen={isDeleteColumnModalOpen}
                onClose={() => { setIsDeleteColumnModalOpen(false); setColumnToDelete(null); }}
                onConfirm={confirmDeleteColumn}
                title="Delete Column"
                message={`Delete column "${customColumns[columnToDelete]}"? This will hide the data.`}
                confirmText="Delete"
            />

            {/* Add Column Modal */}
            {
                isAddColumnModalOpen && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 100,
                        backdropFilter: 'blur(4px)'
                    }}>
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.95) 0%, rgba(10, 10, 15, 0.95) 100%)',
                            padding: '1.5rem',
                            borderRadius: '1.25rem',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            width: '24rem',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                        }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'white', marginBottom: '1rem' }}>Add Custom Column</h3>
                            <form onSubmit={handleAddColumn}>
                                <input
                                    type="text"
                                    placeholder="Column Name (e.g. PE Ratio)"
                                    value={newColumnName}
                                    onChange={(e) => setNewColumnName(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '0.75rem',
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: 'white',
                                        marginBottom: '1rem',
                                        outline: 'none',
                                        fontSize: '0.875rem'
                                    }}
                                    autoFocus
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddColumnModalOpen(false)}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            borderRadius: '0.5rem',
                                            color: '#a1a1aa',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            fontSize: '0.875rem',
                                            border: 'none',
                                            background: 'none'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        style={{
                                            padding: '0.5rem 1rem',
                                            borderRadius: '0.5rem',
                                            backgroundColor: '#10b981',
                                            color: 'white',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            fontSize: '0.875rem',
                                            border: 'none'
                                        }}
                                    >
                                        Add Column
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Manage Columns Modal */}
            {
                isManageColumnsModalOpen && createPortal(
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 2147483647,
                        backdropFilter: 'blur(4px)'
                    }}>
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.95) 0%, rgba(10, 10, 15, 0.95) 100%)',
                            borderRadius: '1.25rem',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            width: '24rem',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            maxHeight: '80vh'
                        }} onClick={(e) => e.stopPropagation()}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '1.5rem',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                            }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'white', margin: 0 }}>Manage Columns</h3>
                                <button onClick={() => setIsManageColumnsModalOpen(false)} style={{ color: '#a1a1aa', cursor: 'pointer', border: 'none', background: 'none' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                                {customColumns.length === 0 ? (
                                    <p style={{ color: '#71717a', textAlign: 'center', padding: '1rem 0', margin: 0 }}>No custom columns added.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {customColumns.map((col, idx) => (
                                            <div key={idx} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '0.75rem',
                                                borderRadius: '0.5rem',
                                                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                                border: '1px solid rgba(255, 255, 255, 0.05)'
                                            }}>
                                                <span style={{ color: 'white', fontWeight: '500' }}>{col}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <button
                                                        onClick={() => handleMoveColumn(idx, -1)}
                                                        disabled={idx === 0}
                                                        style={{
                                                            padding: '0.25rem',
                                                            borderRadius: '0.25rem',
                                                            color: '#a1a1aa',
                                                            cursor: 'pointer',
                                                            opacity: idx === 0 ? 0.3 : 1,
                                                            border: 'none',
                                                            background: 'none'
                                                        }}
                                                    >
                                                        <ChevronUp size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleMoveColumn(idx, 1)}
                                                        disabled={idx === customColumns.length - 1}
                                                        style={{
                                                            padding: '0.25rem',
                                                            borderRadius: '0.25rem',
                                                            color: '#a1a1aa',
                                                            cursor: 'pointer',
                                                            opacity: idx === customColumns.length - 1 ? 0.3 : 1,
                                                            border: 'none',
                                                            background: 'none'
                                                        }}
                                                    >
                                                        <ChevronDown size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCustomColumn(idx)}
                                                        style={{
                                                            padding: '0.25rem',
                                                            borderRadius: '0.25rem',
                                                            color: '#f87171',
                                                            cursor: 'pointer',
                                                            marginLeft: '0.5rem',
                                                            border: 'none',
                                                            background: 'none'
                                                        }}
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
                )
            }
        </div >
    );
};

export default StockMarketDetails;
