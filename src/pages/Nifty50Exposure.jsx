import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { NIFTY_50_STOCKS } from '../utils/nifty50Data';
import BackButton from '../components/BackButton';
import { 
  TrendingUp, 
  PieChart as PieChartIcon, 
  Search, 
  Filter, 
  Layers, 
  Info, 
  Award, 
  BarChart3, 
  Building2, 
  SlidersHorizontal,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Legend,
  Cell
} from 'recharts';

const Nifty50Exposure = () => {
  const navigate = useNavigate();
  const { savings, formatCurrency, calculateItemCurrentValue, calculateItemInvestedValue } = useFinance();

  const [valuationMode, setValuationMode] = useState('current'); // 'current' or 'invested'
  const [mfScope, setMfScope] = useState('index_only'); // 'index_only' or 'all_equity'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterHolding, setFilterHolding] = useState('all'); // 'all', 'held', 'direct', 'indirect'
  const [selectedSector, setSelectedSector] = useState('all');
  const [sortBy, setSortBy] = useState('total_val'); // 'total_val', 'index_weight', 'direct_val', 'indirect_val', 'name'
  const [sortOrder, setSortOrder] = useState('desc');

  // 1. Separate Active Stocks and Mutual Funds
  const activeSavings = useMemo(() => savings.filter(s => !s.isArchived), [savings]);
  
  const stockAccounts = useMemo(() => activeSavings.filter(s => s.type === 'stock_market'), [activeSavings]);
  const mfAccounts = useMemo(() => activeSavings.filter(s => s.type === 'mutual_fund'), [activeSavings]);

  // 2. Identify Index Funds (specifically Nippon India Index Fund Nifty 50 or general Nifty 50 funds)
  const nifty50MfAccounts = useMemo(() => {
    if (mfScope === 'all_equity') return mfAccounts;
    return mfAccounts.filter(m => {
      const title = (m.title || '').toLowerCase();
      const cat = (m.category || '').toLowerCase();
      return title.includes('nifty 50') || title.includes('nifty50') || title.includes('index fund') || cat.includes('index');
    });
  }, [mfAccounts, mfScope]);

  // Calculate Total Values
  const totalStockValue = useMemo(() => {
    return stockAccounts.reduce((sum, acc) => {
      return sum + (valuationMode === 'current' ? calculateItemCurrentValue(acc) : calculateItemInvestedValue(acc));
    }, 0);
  }, [stockAccounts, valuationMode, calculateItemCurrentValue, calculateItemInvestedValue]);

  const totalNifty50MfValue = useMemo(() => {
    return nifty50MfAccounts.reduce((sum, acc) => {
      return sum + (valuationMode === 'current' ? calculateItemCurrentValue(acc) : calculateItemInvestedValue(acc));
    }, 0);
  }, [nifty50MfAccounts, valuationMode, calculateItemCurrentValue, calculateItemInvestedValue]);

  const totalPortfolioValue = totalStockValue + totalNifty50MfValue;

  // 3. Extract and match Direct Stock Holdings across all Stock Market Accounts
  const directStockMap = useMemo(() => {
    const map = {}; // stockSymbol/alias -> { totalValue, shares, totalInvested, totalCurrent }

    stockAccounts.forEach(acc => {
      (acc.stocks || []).forEach(stock => {
        if (stock.isArchived) return;
        const shares = Number(stock.shares || 0);
        if (shares <= 0) return;

        const currentPrice = Number(stock.currentPrice || 0);
        const avgCost = Number(stock.avgCost || 0);

        const currentVal = shares * currentPrice;
        const investedVal = shares * avgCost;
        const val = valuationMode === 'current' ? currentVal : investedVal;

        const rawTitle = (stock.name || stock.title || stock.symbol || '').trim().toLowerCase();

        // Match against Nifty 50 list
        let matchedStock = NIFTY_50_STOCKS.find(nifty => {
          if (nifty.symbol.toLowerCase() === rawTitle) return true;
          return nifty.aliases.some(alias => rawTitle.includes(alias) || alias.includes(rawTitle));
        });

        const key = matchedStock ? matchedStock.symbol : rawTitle;

        if (!map[key]) {
          map[key] = {
            rawTitle,
            symbol: matchedStock ? matchedStock.symbol : rawTitle,
            matchedSymbol: matchedStock ? matchedStock.symbol : null,
            shares: 0,
            value: 0,
            investedVal: 0,
            currentVal: 0
          };
        }

        map[key].shares += shares;
        map[key].value += val;
        map[key].investedVal += investedVal;
        map[key].currentVal += currentVal;
      });
    });

    return map;
  }, [stockAccounts, valuationMode]);

  // 4. Calculate Combined Direct + Indirect Exposure for all 50 Nifty 50 Stocks
  const stockExposures = useMemo(() => {
    return NIFTY_50_STOCKS.map(nifty => {
      // Direct Exposure
      const directMatch = directStockMap[nifty.symbol];
      const directVal = directMatch ? directMatch.value : 0;
      const directShares = directMatch ? directMatch.shares : 0;

      // Indirect Exposure via Nifty 50 Index Funds (Nippon India Index Fund, etc.)
      const indirectVal = totalNifty50MfValue * (nifty.weight / 100);

      // Total Combined
      const totalVal = directVal + indirectVal;

      // Percentages
      const totalPctOfPortfolio = totalPortfolioValue > 0 ? (totalVal / totalPortfolioValue) * 100 : 0;
      const directPctOfPortfolio = totalPortfolioValue > 0 ? (directVal / totalPortfolioValue) * 100 : 0;
      const indirectPctOfPortfolio = totalPortfolioValue > 0 ? (indirectVal / totalPortfolioValue) * 100 : 0;

      // Status
      let status = 'none';
      if (directVal > 0 && indirectVal > 0) status = 'both';
      else if (directVal > 0) status = 'direct_only';
      else if (indirectVal > 0) status = 'indirect_only';

      return {
        ...nifty,
        directVal,
        directShares,
        indirectVal,
        totalVal,
        totalPctOfPortfolio,
        directPctOfPortfolio,
        indirectPctOfPortfolio,
        status
      };
    });
  }, [directStockMap, totalNifty50MfValue, totalPortfolioValue]);

  // Sectors list for filter dropdown
  const allSectors = useMemo(() => {
    const sectors = new Set(NIFTY_50_STOCKS.map(s => s.sector));
    return ['all', ...Array.from(sectors).sort()];
  }, []);

  // Filtered & Sorted Stocks List
  const filteredStocks = useMemo(() => {
    return stockExposures.filter(stock => {
      // Search match
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || stock.name.toLowerCase().includes(q) || stock.symbol.toLowerCase().includes(q) || stock.sector.toLowerCase().includes(q);

      // Sector match
      const matchesSector = selectedSector === 'all' || stock.sector === selectedSector;

      // Holding filter
      let matchesHolding = true;
      if (filterHolding === 'held') matchesHolding = stock.status !== 'none';
      else if (filterHolding === 'direct') matchesHolding = stock.directVal > 0;
      else if (filterHolding === 'indirect') matchesHolding = stock.indirectVal > 0;

      return matchesSearch && matchesSector && matchesHolding;
    }).sort((a, b) => {
      let result = 0;
      if (sortBy === 'total_val') result = b.totalVal - a.totalVal;
      else if (sortBy === 'index_weight') result = b.weight - a.weight;
      else if (sortBy === 'direct_val') result = b.directVal - a.directVal;
      else if (sortBy === 'indirect_val') result = b.indirectVal - a.indirectVal;
      else if (sortBy === 'name') result = a.name.localeCompare(b.name);

      return sortOrder === 'desc' ? result : -result;
    });
  }, [stockExposures, searchTerm, selectedSector, filterHolding, sortBy, sortOrder]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const directOwnedCount = stockExposures.filter(s => s.directVal > 0).length;
    const totalExposureVal = stockExposures.reduce((sum, s) => sum + s.totalVal, 0);
    const topStock = [...stockExposures].sort((a, b) => b.totalVal - a.totalVal)[0];

    return {
      directOwnedCount,
      totalExposureVal,
      topStock
    };
  }, [stockExposures]);

  // Sector Breakdown Chart Data (Top 7 Sectors)
  const sectorChartData = useMemo(() => {
    const sectorMap = {};
    stockExposures.forEach(s => {
      if (!sectorMap[s.sector]) {
        sectorMap[s.sector] = { sector: s.sector, directVal: 0, indirectVal: 0, totalVal: 0 };
      }
      sectorMap[s.sector].directVal += s.directVal;
      sectorMap[s.sector].indirectVal += s.indirectVal;
      sectorMap[s.sector].totalVal += s.totalVal;
    });

    return Object.values(sectorMap)
      .sort((a, b) => b.totalVal - a.totalVal)
      .slice(0, 7)
      .map(s => ({
        ...s,
        name: s.sector.length > 15 ? s.sector.substring(0, 15) + '...' : s.sector
      }));
  }, [stockExposures]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <BackButton label="Back to Investments" to="/investments" style={{ marginBottom: 0 }} />

      {/* Header Banner */}
      <div style={{
        backgroundColor: 'rgba(24, 24, 27, 0.4)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '2rem',
        padding: '2rem',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1.5rem',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
              Nifty 50 Direct & Indirect Exposure
            </h1>
            <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8', fontSize: '11px', fontWeight: 'bold' }}>
              Index Overlap Analyzer
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#a1a1aa', margin: 0 }}>
            Every investment in index funds like <strong>Nippon India Index Fund Nifty 50</strong> indirectly buys all 50 Nifty stocks. See your combined percentage holding here.
          </p>
        </div>

        {/* Valuation Mode & Scope Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1rem', padding: '0.25rem' }}>
            <button
              onClick={() => setValuationMode('current')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.75rem',
                border: 'none',
                backgroundColor: valuationMode === 'current' ? '#6366f1' : 'transparent',
                color: valuationMode === 'current' ? 'white' : '#71717a',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Current Market Value
            </button>
            <button
              onClick={() => setValuationMode('invested')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.75rem',
                border: 'none',
                backgroundColor: valuationMode === 'invested' ? '#6366f1' : 'transparent',
                color: valuationMode === 'invested' ? 'white' : '#71717a',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Invested Cost Basis
            </button>
          </div>

          <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1rem', padding: '0.25rem' }}>
            <button
              onClick={() => setMfScope('index_only')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.75rem',
                border: 'none',
                backgroundColor: mfScope === 'index_only' ? '#10b981' : 'transparent',
                color: mfScope === 'index_only' ? 'white' : '#71717a',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Includes Nippon India Index Fund Nifty 50 & Nifty 50 funds"
            >
              Nifty 50 Index Funds
            </button>
            <button
              onClick={() => setMfScope('all_equity')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.75rem',
                border: 'none',
                backgroundColor: mfScope === 'all_equity' ? '#10b981' : 'transparent',
                color: mfScope === 'all_equity' ? 'white' : '#71717a',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Includes all active Mutual Funds"
            >
              All Mutual Funds
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* Card 1: Total Portfolio */}
        <div style={{
          backgroundColor: '#18181b',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '1.5rem',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#71717a', margin: '0 0 0.5rem 0' }}>
            Combined Portfolio Analyzed
          </p>
          <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>
            {formatCurrency(totalPortfolioValue)}
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#a1a1aa', marginTop: '1rem' }}>
            <span>Direct Stocks: <strong style={{ color: 'white' }}>{formatCurrency(totalStockValue)}</strong></span>
            <span>MF Funds: <strong style={{ color: 'white' }}>{formatCurrency(totalNifty50MfValue)}</strong></span>
          </div>
        </div>

        {/* Card 2: Nifty 50 Index Fund Holdings */}
        <div style={{
          backgroundColor: '#18181b',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '1.5rem',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#34d399', margin: '0 0 0.5rem 0' }}>
            Indirect Exposure (Index Funds)
          </p>
          <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#34d399', fontFamily: 'monospace', margin: 0 }}>
            {formatCurrency(totalNifty50MfValue)}
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#a1a1aa', margin: '1rem 0 0 0' }}>
            Spread proportionally across all 50 Nifty weightages
          </p>
        </div>

        {/* Card 3: Stock Coverage */}
        <div style={{
          backgroundColor: '#18181b',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '1.5rem',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <p style={{ fontSize: '0.625rem', textTransform: 'uppercase letterSpacing', fontWeight: '800', color: '#818cf8', margin: '0 0 0.5rem 0' }}>
            Direct Holdings Count
          </p>
          <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>
            {summaryMetrics.directOwnedCount} <span style={{ fontSize: '1rem', color: '#71717a' }}>/ 50 Stocks</span>
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#a1a1aa', margin: '1rem 0 0 0' }}>
            {((summaryMetrics.directOwnedCount / 50) * 100).toFixed(0)}% of Nifty 50 stocks held directly in stock account
          </p>
        </div>

        {/* Card 4: Top Exposure Stock */}
        <div style={{
          backgroundColor: '#18181b',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '1.5rem',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#fbbf24', margin: '0 0 0.5rem 0' }}>
            Highest Combined Exposure
          </p>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: 0 }}>
            {summaryMetrics.topStock?.name || 'N/A'}
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.75rem', fontFamily: 'monospace', fontWeight: 'bold' }}>
            <span>{formatCurrency(summaryMetrics.topStock?.totalVal || 0)}</span>
            <span>{(summaryMetrics.topStock?.totalPctOfPortfolio || 0).toFixed(1)}% of Portfolio</span>
          </div>
        </div>
      </div>

      {/* Sector Allocation Chart */}
      {sectorChartData.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(24, 24, 27, 0.4)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '2rem',
          padding: '1.5rem',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
        }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'white', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={16} style={{ color: '#818cf8' }} /> Top Sector Exposure Breakdown (Direct vs Indirect)
          </h4>
          <div style={{ height: 260, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`} />
                <RechartsTooltip formatter={(value) => formatCurrency(value)} contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
                <Bar dataKey="directVal" name="Direct Stocks" fill="#818cf8" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="indirectVal" name="Indirect MF (Nippon)" fill="#34d399" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Controls & Filter Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        backgroundColor: 'rgba(24, 24, 27, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '1.5rem',
        padding: '1rem 1.5rem'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
          <input
            type="text"
            placeholder="Search stock name, symbol or sector..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem 0.5rem 2.25rem',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'white',
              fontSize: '12px',
              outline: 'none'
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterHolding('all')}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 'bold',
              border: 'none',
              backgroundColor: filterHolding === 'all' ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: filterHolding === 'all' ? 'white' : '#71717a',
              cursor: 'pointer'
            }}
          >
            All 50
          </button>
          <button
            onClick={() => setFilterHolding('held')}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 'bold',
              border: 'none',
              backgroundColor: filterHolding === 'held' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              color: filterHolding === 'held' ? '#818cf8' : '#71717a',
              cursor: 'pointer'
            }}
          >
            Held Only
          </button>
          <button
            onClick={() => setFilterHolding('direct')}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 'bold',
              border: 'none',
              backgroundColor: filterHolding === 'direct' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              color: filterHolding === 'direct' ? '#34d399' : '#71717a',
              cursor: 'pointer'
            }}
          >
            Directly Held
          </button>
          <button
            onClick={() => setFilterHolding('indirect')}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 'bold',
              border: 'none',
              backgroundColor: filterHolding === 'indirect' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              color: filterHolding === 'indirect' ? '#fbbf24' : '#71717a',
              cursor: 'pointer'
            }}
          >
            Indirect Only
          </button>
        </div>

        {/* Sector & Sort Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            style={{
              backgroundColor: '#18181b',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'white',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.75rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Sectors</option>
            {allSectors.filter(s => s !== 'all').map(sec => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              backgroundColor: '#18181b',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'white',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.75rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="total_val">Sort: Total Exposure (₹)</option>
            <option value="index_weight">Sort: Nifty Weight (%)</option>
            <option value="direct_val">Sort: Direct Holding (₹)</option>
            <option value="indirect_val">Sort: Indirect Holding (₹)</option>
            <option value="name">Sort: Stock Name (A-Z)</option>
          </select>

          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            style={{
              padding: '0.5rem',
              borderRadius: '0.75rem',
              border: '1px solid rgba(255,255,255,0.08)',
              backgroundColor: 'rgba(255,255,255,0.03)',
              color: 'white',
              cursor: 'pointer'
            }}
            title="Toggle Sort Direction"
          >
            <ArrowUpDown size={14} />
          </button>
        </div>
      </div>

      {/* Stocks Table */}
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
                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Company & Ticker</th>
                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sector</th>
                <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nifty Weight</th>
                <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Direct Stock Holding</th>
                <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Indirect MF Holding</th>
                <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Combined Exposure</th>
                <th style={{ textAlign: 'center', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Holding Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((stock) => {
                const hasDirect = stock.directVal > 0;
                const hasIndirect = stock.indirectVal > 0;

                return (
                  <tr key={stock.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background-color 0.15s ease' }} className="hover:bg-white/5">
                    {/* Stock Symbol & Name */}
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'white', fontWeight: '900', fontSize: '0.875rem' }}>
                          {stock.name}
                        </span>
                        <span style={{ fontSize: '10px', color: '#818cf8', fontWeight: 'bold', fontFamily: 'monospace' }}>
                          {stock.symbol}
                        </span>
                      </div>
                    </td>

                    {/* Sector */}
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{ display: 'inline-flex', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', fontSize: '10px', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.03)', color: '#a1a1aa' }}>
                        {stock.sector}
                      </span>
                    </td>

                    {/* Index Weight */}
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.875rem', color: '#a1a1aa' }}>
                      {stock.weight.toFixed(2)}%
                    </td>

                    {/* Direct Holding */}
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      {hasDirect ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ color: '#34d399', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.875rem' }}>
                            {formatCurrency(stock.directVal)}
                          </span>
                          <span style={{ fontSize: '10px', color: '#71717a' }}>
                            {stock.directShares} shares ({stock.directPctOfPortfolio.toFixed(2)}% of portfolio)
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#52525b', fontSize: '0.875rem' }}>—</span>
                      )}
                    </td>

                    {/* Indirect MF Holding */}
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      {hasIndirect ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ color: '#fbbf24', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.875rem' }}>
                            {formatCurrency(stock.indirectVal)}
                          </span>
                          <span style={{ fontSize: '10px', color: '#71717a' }}>
                            {stock.indirectPctOfPortfolio.toFixed(2)}% of portfolio
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#52525b', fontSize: '0.875rem' }}>—</span>
                      )}
                    </td>

                    {/* Total Combined Exposure */}
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ color: 'white', fontFamily: 'monospace', fontWeight: '900', fontSize: '0.875rem' }}>
                          {formatCurrency(stock.totalVal)}
                        </span>
                        <span style={{ fontSize: '10px', color: '#818cf8', fontWeight: 'bold' }}>
                          {stock.totalPctOfPortfolio.toFixed(2)}% of portfolio
                        </span>
                      </div>
                    </td>

                    {/* Holding Status Badge */}
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                      {stock.status === 'both' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '10px', fontWeight: 'bold', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          <CheckCircle2 size={10} /> Direct + MF
                        </span>
                      )}
                      {stock.status === 'direct_only' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontSize: '10px', fontWeight: 'bold', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                          Direct Stock
                        </span>
                      )}
                      {stock.status === 'indirect_only' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontSize: '10px', fontWeight: 'bold', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                          MF Only (Nippon)
                        </span>
                      )}
                      {stock.status === 'none' && (
                        <span style={{ color: '#52525b', fontSize: '11px' }}>Not Held</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredStocks.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#71717a', fontSize: '0.875rem' }}>
                    No Nifty 50 stocks match your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Nifty50Exposure;
