import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ALL_BENCHMARK_STOCKS } from '../utils/nifty50Data';
import { readComposition } from '../utils/fundComposition';
import { sectorFor, capFor } from '../utils/sectors';
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
  AlertCircle,
  PieChart as PieChartIcon2,
  Sparkles,
  Zap
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
  Cell,
  PieChart,
  Pie
} from 'recharts';

const Nifty50Exposure = () => {
  const navigate = useNavigate();
  const { savings, formatCurrency, calculateItemCurrentValue, calculateItemInvestedValue } = useFinance();

  const [valuationMode, setValuationMode] = useState('current'); // 'current' or 'invested'
  const [selectedFundView, setSelectedFundView] = useState('all'); // 'all', 'nippon_nifty50', 'icici_next50', 'hdfc_flexicap', 'sbi_smallcap'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCap, setFilterCap] = useState('all'); // 'all', 'Large Cap', 'Mid Cap', 'Small Cap'
  const [filterHolding, setFilterHolding] = useState('all'); // 'all', 'held', 'direct', 'indirect'
  const [selectedSector, setSelectedSector] = useState('all');
  const [sortBy, setSortBy] = useState('total_val'); // 'total_val', 'direct_val', 'indirect_val', 'name'
  const [sortOrder, setSortOrder] = useState('desc');

  // 1. Filter active holdings
  const activeSavings = useMemo(() => savings.filter(s => !s.isArchived), [savings]);
  
  const stockAccounts = useMemo(() => activeSavings.filter(s => s.type === 'stock_market'), [activeSavings]);
  const mfAccounts = useMemo(() => activeSavings.filter(s => s.type === 'mutual_fund'), [activeSavings]);

  // Identify specific Funds
  const nipponNifty50Fund = useMemo(() => {
    return mfAccounts.find(m => (m.title || '').toLowerCase().includes('nippon') && (m.title || '').toLowerCase().includes('nifty 50'));
  }, [mfAccounts]);

  const iciciNext50Fund = useMemo(() => {
    return mfAccounts.find(m => (m.title || '').toLowerCase().includes('icici') && (m.title || '').toLowerCase().includes('next 50'));
  }, [mfAccounts]);

  const hdfcFlexiFund = useMemo(() => {
    return mfAccounts.find(m => (m.title || '').toLowerCase().includes('hdfc flexi'));
  }, [mfAccounts]);

  const sbiSmallCapFund = useMemo(() => {
    return mfAccounts.find(m => (m.title || '').toLowerCase().includes('sbi small'));
  }, [mfAccounts]);

  // Fund Values
  const nipponVal = useMemo(() => nipponNifty50Fund ? (valuationMode === 'current' ? calculateItemCurrentValue(nipponNifty50Fund) : calculateItemInvestedValue(nipponNifty50Fund)) : 0, [nipponNifty50Fund, valuationMode, calculateItemCurrentValue, calculateItemInvestedValue]);
  const iciciNext50Val = useMemo(() => iciciNext50Fund ? (valuationMode === 'current' ? calculateItemCurrentValue(iciciNext50Fund) : calculateItemInvestedValue(iciciNext50Fund)) : 0, [iciciNext50Fund, valuationMode, calculateItemCurrentValue, calculateItemInvestedValue]);
  const hdfcFlexiVal = useMemo(() => hdfcFlexiFund ? (valuationMode === 'current' ? calculateItemCurrentValue(hdfcFlexiFund) : calculateItemInvestedValue(hdfcFlexiFund)) : 0, [hdfcFlexiFund, valuationMode, calculateItemCurrentValue, calculateItemInvestedValue]);
  const sbiSmallCapVal = useMemo(() => sbiSmallCapFund ? (valuationMode === 'current' ? calculateItemCurrentValue(sbiSmallCapFund) : calculateItemInvestedValue(sbiSmallCapFund)) : 0, [sbiSmallCapFund, valuationMode, calculateItemCurrentValue, calculateItemInvestedValue]);

  // Direct Stock Value
  const totalStockValue = useMemo(() => {
    return stockAccounts.reduce((sum, acc) => {
      return sum + (valuationMode === 'current' ? calculateItemCurrentValue(acc) : calculateItemInvestedValue(acc));
    }, 0);
  }, [stockAccounts, valuationMode, calculateItemCurrentValue, calculateItemInvestedValue]);

  const totalEquityMfValue = nipponVal + iciciNext50Val + hdfcFlexiVal + sbiSmallCapVal;
  const totalPortfolioValue = totalStockValue + totalEquityMfValue;

  // 2. Direct Stock Mapping
  const directStockMap = useMemo(() => {
    const map = {};

    stockAccounts.forEach(acc => {
      (acc.stocks || []).forEach(stock => {
        if (stock.isArchived) return;
        const shares = Number(stock.shares || 0);
        if (shares <= 0) return;

        const currentPrice = Number(stock.currentPrice || 0);
        const avgCost = Number(stock.avgCost || 0);

        const val = valuationMode === 'current' ? (shares * currentPrice) : (shares * avgCost);
        const cleanName = (str) => {
          return (str || '')
            .toLowerCase()
            .replace(/\blimited\b|\bltd\b|\bcorp\b|\bcorporation\b/g, '')
            .replace(/[^a-z0-9&]/g, ' ')
            .trim();
        };

        const rawTitle = (stock.name || stock.title || stock.symbol || '').trim().toLowerCase();
        const rawClean = cleanName(rawTitle);

        let matched = ALL_BENCHMARK_STOCKS.find(s => {
          if (!s || !s.symbol) return false;
          const stockSym = (stock.symbol || '').trim().toUpperCase();
          if (stockSym && stockSym === s.symbol.toUpperCase()) return true;

          const benchmarkSymClean = cleanName(s.symbol);
          const benchmarkNameClean = cleanName(s.name);

          if (rawClean === benchmarkSymClean || rawClean === benchmarkNameClean) return true;

          const aliases = s.aliases || [];
          return aliases.some(alias => {
            const cleanAlias = cleanName(alias);
            if (!cleanAlias || cleanAlias.length < 3) return false;
            return rawClean === cleanAlias || rawClean.startsWith(cleanAlias + ' ') || rawClean.endsWith(' ' + cleanAlias);
          });
        });

        const key = matched ? matched.symbol : rawTitle;

        if (!map[key]) {
          map[key] = {
            symbol: matched ? matched.symbol : rawTitle.toUpperCase(),
            name: matched ? matched.name : (stock.name || stock.title || stock.symbol),
            // The stock's own sector and cap win. Reading only the benchmark
            // table filed every non-index holding under "Other" — nine of the
            // thirty-four held here — even though each had a sector set on its
            // own record.
            sector: sectorFor(stock.sector, matched && matched.sector),
            cap: capFor(stock.marketCap, matched && matched.cap),
            shares: 0,
            value: 0
          };
        }

        map[key].shares += shares;
        map[key].value += val;
      });
    });

    return map;
  }, [stockAccounts, valuationMode]);

  // 3. Consolidated Multi-Fund Indirect Exposure Calculation
  const consolidatedExposures = useMemo(() => {
    const stockMap = {};

    // Helper to register stock
    const ensureStock = (symbol, name, sector, cap) => {
      if (!stockMap[symbol]) {
        stockMap[symbol] = {
          symbol,
          name,
          sector,
          cap: cap || 'Mid Cap',
          directVal: 0,
          directShares: 0,
          nipponVal: 0,
          iciciNext50Val: 0,
          hdfcFlexiVal: 0,
          sbiSmallCapVal: 0,
          totalIndirectVal: 0,
          totalVal: 0
        };
      }
      return stockMap[symbol];
    };

    // Populate Direct Stock Holdings
    Object.values(directStockMap).forEach(d => {
      const entry = ensureStock(d.symbol, d.name, d.sector, d.cap);
      entry.directVal = d.value;
      entry.directShares = d.shares;
    });

    // Indirect exposure, one fund at a time.
    //
    // Each fund's weights come from readComposition, which prefers a
    // composition recorded on the fund record and falls back to the built-in
    // table only while none has been entered. The four blocks that used to
    // read NIFTY_50_STOCKS and friends directly are gone: a composition edited
    // on the fund's own page has to change these figures, or the two screens
    // disagree about the same fund.
    const applyFund = (fund, fundValue, field, defaultCap) => {
      if (!fund || fundValue <= 0) return;
      const { holdings } = readComposition(fund);
      holdings.forEach(h => {
        // Only equity contributes to a stock overlap. A debt fund's issuers are
        // credit exposure, not shares, and must never be added to a share count.
        if (h.assetClass !== 'equity') return;
        const known = ALL_BENCHMARK_STOCKS.find(s => s.symbol === h.symbol);
        const entry = ensureStock(
          h.symbol,
          h.name || (known ? known.name : h.symbol),
          sectorFor(h.sector, known && known.sector),
          capFor(null, known && known.cap, defaultCap)
        );
        entry[field] = fundValue * (h.weight / 100);
      });
    };

    if (selectedFundView === 'all' || selectedFundView === 'nippon_nifty50') {
      applyFund(nipponNifty50Fund, nipponVal, 'nipponVal', 'Large Cap');
    }
    if (selectedFundView === 'all' || selectedFundView === 'icici_next50') {
      applyFund(iciciNext50Fund, iciciNext50Val, 'iciciNext50Val', 'Mid Cap');
    }
    if (selectedFundView === 'all' || selectedFundView === 'hdfc_flexicap') {
      applyFund(hdfcFlexiFund, hdfcFlexiVal, 'hdfcFlexiVal', 'Large Cap');
    }
    if (selectedFundView === 'all' || selectedFundView === 'sbi_smallcap') {
      applyFund(sbiSmallCapFund, sbiSmallCapVal, 'sbiSmallCapVal', 'Small Cap');
    }

    // Sum totals & calculate percentages
    return Object.values(stockMap).map(stock => {
      const totalIndirectVal = stock.nipponVal + stock.iciciNext50Val + stock.hdfcFlexiVal + stock.sbiSmallCapVal;
      const totalVal = stock.directVal + totalIndirectVal;

      const totalPctOfPortfolio = totalPortfolioValue > 0 ? (totalVal / totalPortfolioValue) * 100 : 0;
      const directPctOfPortfolio = totalPortfolioValue > 0 ? (stock.directVal / totalPortfolioValue) * 100 : 0;
      const indirectPctOfPortfolio = totalPortfolioValue > 0 ? (totalIndirectVal / totalPortfolioValue) * 100 : 0;

      let status = 'none';
      if (stock.directVal > 0 && totalIndirectVal > 0) status = 'both';
      else if (stock.directVal > 0) status = 'direct_only';
      else if (totalIndirectVal > 0) status = 'indirect_only';

      return {
        ...stock,
        totalIndirectVal,
        totalVal,
        totalPctOfPortfolio,
        directPctOfPortfolio,
        indirectPctOfPortfolio,
        status
      };
    }).filter(s => s.totalVal > 0);
  }, [directStockMap, nipponNifty50Fund, iciciNext50Fund, hdfcFlexiFund, sbiSmallCapFund,
      nipponVal, iciciNext50Val, hdfcFlexiVal, sbiSmallCapVal, totalPortfolioValue, selectedFundView]);

  // Market Cap Distribution Breakdown
  const marketCapDistribution = useMemo(() => {
    let large = 0, mid = 0, small = 0;
    consolidatedExposures.forEach(s => {
      if (s.cap === 'Large Cap') large += s.totalVal;
      else if (s.cap === 'Small Cap') small += s.totalVal;
      else mid += s.totalVal;
    });

    const total = large + mid + small;
    return [
      { name: 'Large Cap (Nifty 50 & Top 100)', value: large, pct: total > 0 ? (large / total) * 100 : 0, color: '#818cf8' },
      { name: 'Mid Cap (Nifty Next 50)', value: mid, pct: total > 0 ? (mid / total) * 100 : 0, color: '#f59e0b' },
      { name: 'Small Cap (SBI Small Cap & Direct)', value: small, pct: total > 0 ? (small / total) * 100 : 0, color: '#ec4899' }
    ];
  }, [consolidatedExposures]);

  // Sector Analytics Breakdown
  const sectorAnalytics = useMemo(() => {
    const sectorMap = {};
    consolidatedExposures.forEach(s => {
      if (!sectorMap[s.sector]) {
        sectorMap[s.sector] = {
          sector: s.sector,
          directVal: 0,
          indirectVal: 0,
          totalVal: 0,
          count: 0
        };
      }
      sectorMap[s.sector].directVal += s.directVal;
      sectorMap[s.sector].indirectVal += s.totalIndirectVal;
      sectorMap[s.sector].totalVal += s.totalVal;
      sectorMap[s.sector].count += 1;
    });

    return Object.values(sectorMap).map(sec => ({
      ...sec,
      pctOfPortfolio: totalPortfolioValue > 0 ? (sec.totalVal / totalPortfolioValue) * 100 : 0,
      shortName: sec.sector.length > 15 ? sec.sector.substring(0, 15) + '...' : sec.sector
    })).sort((a, b) => b.totalVal - a.totalVal);
  }, [consolidatedExposures, totalPortfolioValue]);

  // One colour per sector, with none repeating. The list held 11 while the
  // portfolio spans 17 sectors, and the index wraps — so once the chart stopped
  // truncating, two different slices would have shared a colour and the legend
  // could no longer identify them.
  const SECTOR_COLORS = [
    '#818cf8', '#34d399', '#f59e0b', '#ec4899', '#3b82f6',
    '#84cc16', '#f97316', '#06b6d4', '#a855f7', '#ef4444', '#64748b',
    '#facc15', '#2dd4bf', '#c084fc', '#fb7185', '#4ade80', '#38bdf8',
    '#e879f9', '#fbbf24', '#94a3b8', '#f472b6'
  ];

  // Sectors list
  const allSectors = useMemo(() => {
    const sectors = new Set(consolidatedExposures.map(s => s.sector));
    return ['all', ...Array.from(sectors).sort()];
  }, [consolidatedExposures]);

  // Filtered & Sorted List
  const filteredStocks = useMemo(() => {
    return consolidatedExposures.filter(stock => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || stock.name.toLowerCase().includes(q) || stock.symbol.toLowerCase().includes(q) || stock.sector.toLowerCase().includes(q);
      const matchesSector = selectedSector === 'all' || stock.sector === selectedSector;
      const matchesCap = filterCap === 'all' || stock.cap === filterCap;

      let matchesHolding = true;
      if (filterHolding === 'held') matchesHolding = stock.status !== 'none';
      else if (filterHolding === 'direct') matchesHolding = stock.directVal > 0;
      else if (filterHolding === 'indirect') matchesHolding = stock.totalIndirectVal > 0;

      return matchesSearch && matchesSector && matchesCap && matchesHolding;
    }).sort((a, b) => {
      let result = 0;
      if (sortBy === 'total_val') result = b.totalVal - a.totalVal;
      else if (sortBy === 'direct_val') result = b.directVal - a.directVal;
      else if (sortBy === 'indirect_val') result = b.totalIndirectVal - a.totalIndirectVal;
      else if (sortBy === 'name') result = a.name.localeCompare(b.name);

      return sortOrder === 'desc' ? result : -result;
    });
  }, [consolidatedExposures, searchTerm, selectedSector, filterCap, filterHolding, sortBy, sortOrder]);

  // Top Stock & Metrics
  const topStock = useMemo(() => [...consolidatedExposures].sort((a, b) => b.totalVal - a.totalVal)[0], [consolidatedExposures]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <BackButton label="Back to Investments" to="/investments" style={{ marginBottom: 0 }} />

      {/* Main Header Banner */}
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
              Consolidated Stock & Multi-MF Overlap
            </h1>
            <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '11px', fontWeight: 'bold' }}>
              Multi-Fund Overlap Engine
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#a1a1aa', margin: 0 }}>
            Consolidated exposure across your <strong>Direct Stocks</strong> + <strong>Nippon India Nifty 50</strong> + <strong>ICICI Nifty Next 50</strong> + <strong>HDFC Flexi Cap</strong> + <strong>SBI Small Cap Fund</strong>.
          </p>
        </div>

        {/* Valuation Toggle */}
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
      </div>

      {/* Active Fund Selection Pills */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>View Fund Focus:</span>
        <button
          onClick={() => setSelectedFundView('all')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.75rem',
            fontSize: '11px',
            fontWeight: 'bold',
            border: selectedFundView === 'all' ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
            backgroundColor: selectedFundView === 'all' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.02)',
            color: selectedFundView === 'all' ? 'white' : '#a1a1aa',
            cursor: 'pointer'
          }}
        >
          All 4 Funds Combined ({formatCurrency(totalEquityMfValue)})
        </button>
        <button
          onClick={() => setSelectedFundView('nippon_nifty50')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.75rem',
            fontSize: '11px',
            fontWeight: 'bold',
            border: selectedFundView === 'nippon_nifty50' ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.08)',
            backgroundColor: selectedFundView === 'nippon_nifty50' ? 'rgba(129, 140, 248, 0.2)' : 'rgba(255,255,255,0.02)',
            color: selectedFundView === 'nippon_nifty50' ? 'white' : '#a1a1aa',
            cursor: 'pointer'
          }}
        >
          Nippon Nifty 50 ({formatCurrency(nipponVal)})
        </button>
        <button
          onClick={() => setSelectedFundView('icici_next50')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.75rem',
            fontSize: '11px',
            fontWeight: 'bold',
            border: selectedFundView === 'icici_next50' ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.08)',
            backgroundColor: selectedFundView === 'icici_next50' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255,255,255,0.02)',
            color: selectedFundView === 'icici_next50' ? 'white' : '#a1a1aa',
            cursor: 'pointer'
          }}
        >
          ICICI Nifty Next 50 ({formatCurrency(iciciNext50Val)})
        </button>
        <button
          onClick={() => setSelectedFundView('hdfc_flexicap')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.75rem',
            fontSize: '11px',
            fontWeight: 'bold',
            border: selectedFundView === 'hdfc_flexicap' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)',
            backgroundColor: selectedFundView === 'hdfc_flexicap' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.02)',
            color: selectedFundView === 'hdfc_flexicap' ? 'white' : '#a1a1aa',
            cursor: 'pointer'
          }}
        >
          HDFC Flexi Cap ({formatCurrency(hdfcFlexiVal)})
        </button>
        <button
          onClick={() => setSelectedFundView('sbi_smallcap')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.75rem',
            fontSize: '11px',
            fontWeight: 'bold',
            border: selectedFundView === 'sbi_smallcap' ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.08)',
            backgroundColor: selectedFundView === 'sbi_smallcap' ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255,255,255,0.02)',
            color: selectedFundView === 'sbi_smallcap' ? 'white' : '#a1a1aa',
            cursor: 'pointer'
          }}
        >
          SBI Small Cap ({formatCurrency(sbiSmallCapVal)})
        </button>
      </div>

      {/* Executive Overview Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* Total Analyzed */}
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
            Total Equity Portfolio Analyzed
          </p>
          <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: 0 }}>
            {formatCurrency(totalPortfolioValue)}
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#a1a1aa', marginTop: '1rem' }}>
            <span>Direct Stocks: <strong style={{ color: '#34d399' }}>{formatCurrency(totalStockValue)}</strong></span>
            <span>4 MFs: <strong style={{ color: '#818cf8' }}>{formatCurrency(totalEquityMfValue)}</strong></span>
          </div>
        </div>


        {/* Market Cap Distribution */}
        <div style={{
          backgroundColor: '#18181b',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '1.5rem',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800', color: '#818cf8', margin: '0 0 0.5rem 0' }}>
            Market Cap Exposure Mix
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {marketCapDistribution.map(mc => (
              <div key={mc.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a1a1aa' }}>
                <span style={{ color: mc.color, fontWeight: 'bold' }}>{mc.name.split(' ')[0]} Cap</span>
                <span style={{ fontFamily: 'monospace', color: 'white', fontWeight: 'bold' }}>{mc.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sector Analytics Visual Panel (Bar Chart & Pie Chart) */}
      {sectorAnalytics.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* Sector Bar Chart (Direct vs Indirect) */}
          <div style={{
            backgroundColor: 'rgba(24, 24, 27, 0.4)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '2rem',
            padding: '1.75rem',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
          }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'white', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={16} style={{ color: '#818cf8' }} /> Sector Exposure Breakdown (₹ Value)
            </h4>
            {/* Every sector, not the top 8. Truncating a breakdown hides the
                long tail without saying so — the chart looked complete while a
                third of the portfolio was missing from it. Height grows with
                the count so the angled labels stay readable. */}
            <div style={{ height: Math.max(300, 140 + sectorAnalytics.length * 26), width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectorAnalytics} layout="vertical" margin={{ top: 10, right: 20, left: 45, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis type="number" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val >= 100000 ? (val / 100000).toFixed(1) + 'L' : val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} />
                  <YAxis type="category" dataKey="shortName" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} interval={0} width={110} />
                  <RechartsTooltip 
                    formatter={(val, name) => [formatCurrency(val), name]} 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', color: '#ffffff' }} 
                    itemStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                    labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
                  {/* Bars run horizontally now, so only the outer end of the stack is rounded. */}
                  <Bar dataKey="directVal" name="Direct Stocks" fill="#34d399" stackId="a" />
                  <Bar dataKey="indirectVal" name="Indirect MFs" fill="#818cf8" radius={[0, 4, 4, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sector Allocation Pie Chart */}
          <div style={{
            backgroundColor: 'rgba(24, 24, 27, 0.4)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '2rem',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
          }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'white', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PieChartIcon2 size={16} style={{ color: '#34d399' }} /> Sector Portfolio Allocation (%)
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.5rem', height: '100%' }}>
              <div style={{ width: '200px', height: '200px', flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart key={JSON.stringify(sectorAnalytics.map(s => s.totalVal))}>
                    <Pie
                      data={sectorAnalytics}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="totalVal"
                      nameKey="sector"
                      stroke="#18181b"
                      strokeWidth={2}
                    >
                      {sectorAnalytics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={SECTOR_COLORS[index % SECTOR_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(val, name) => [formatCurrency(val), name]} 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', color: '#ffffff' }} 
                      itemStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                      labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: '180px', maxHeight: '210px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {sectorAnalytics.map((sec, index) => (
                  <div key={sec.sector} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: SECTOR_COLORS[index % SECTOR_COLORS.length] }}></span>
                      {sec.shortName}
                    </span>
                    <span style={{ fontFamily: 'monospace', color: '#a1a1aa', fontWeight: 'bold' }}>
                      {sec.pctOfPortfolio.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
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

        {/* Filter Cap & Holding Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterCap('all')}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 'bold',
              border: 'none',
              backgroundColor: filterCap === 'all' ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: filterCap === 'all' ? 'white' : '#71717a',
              cursor: 'pointer'
            }}
          >
            All Caps
          </button>
          <button
            onClick={() => setFilterCap('Large Cap')}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 'bold',
              border: 'none',
              backgroundColor: filterCap === 'Large Cap' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              color: filterCap === 'Large Cap' ? '#818cf8' : '#71717a',
              cursor: 'pointer'
            }}
          >
            Large Cap (Nifty 50)
          </button>
          <button
            onClick={() => setFilterCap('Mid Cap')}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 'bold',
              border: 'none',
              backgroundColor: filterCap === 'Mid Cap' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              color: filterCap === 'Mid Cap' ? '#fbbf24' : '#71717a',
              cursor: 'pointer'
            }}
          >
            Mid Cap (Nifty Next 50)
          </button>
          <button
            onClick={() => setFilterCap('Small Cap')}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 'bold',
              border: 'none',
              backgroundColor: filterCap === 'Small Cap' ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
              color: filterCap === 'Small Cap' ? '#ec4899' : '#71717a',
              cursor: 'pointer'
            }}
          >
            Small Cap (SBI Small Cap)
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
            <option value="direct_val">Sort: Direct Holding (₹)</option>
            <option value="indirect_val">Sort: Indirect MF Holding (₹)</option>
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
          >
            <ArrowUpDown size={14} />
          </button>
        </div>
      </div>

      {/* Consolidated Stocks Table */}
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
                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stock & Symbol</th>
                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Market Cap / Sector</th>
                <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Direct Stock Holding</th>
                <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Indirect MF Breakdown</th>
                <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Consolidated Total Exposure</th>
                <th style={{ textAlign: 'center', padding: '1rem 1.5rem', fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Holding Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((stock) => {
                const hasDirect = stock.directVal > 0;
                const hasIndirect = stock.totalIndirectVal > 0;

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

                    {/* Sector & Cap */}
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 'bold' }}>
                          {stock.sector}
                        </span>
                        <span style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', backgroundColor: stock.cap === 'Large Cap' ? 'rgba(129, 140, 248, 0.15)' : stock.cap === 'Small Cap' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: stock.cap === 'Large Cap' ? '#818cf8' : stock.cap === 'Small Cap' ? '#ec4899' : '#fbbf24' }}>
                          {stock.cap}
                        </span>
                      </div>
                    </td>

                    {/* Direct Holding */}
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      {hasDirect ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ color: '#34d399', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.875rem' }}>
                            {formatCurrency(stock.directVal)}
                          </span>
                          <span style={{ fontSize: '10px', color: '#71717a' }}>
                            {stock.directShares} shares ({stock.directPctOfPortfolio.toFixed(2)}% portfolio)
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#52525b', fontSize: '0.875rem' }}>—</span>
                      )}
                    </td>

                    {/* Indirect MF Breakdown */}
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      {hasIndirect ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem' }}>
                          <span style={{ color: '#fbbf24', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.875rem' }}>
                            {formatCurrency(stock.totalIndirectVal)}
                          </span>
                          <div style={{ fontSize: '9px', color: '#a1a1aa', display: 'flex', gap: '0.375rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {stock.nipponVal > 0 && <span title="Nippon Nifty 50">Nippon: {formatCurrency(stock.nipponVal)}</span>}
                            {stock.iciciNext50Val > 0 && <span title="ICICI Next 50">ICICI: {formatCurrency(stock.iciciNext50Val)}</span>}
                            {stock.hdfcFlexiVal > 0 && <span title="HDFC Flexi Cap">HDFC: {formatCurrency(stock.hdfcFlexiVal)}</span>}
                            {stock.sbiSmallCapVal > 0 && <span title="SBI Small Cap">SBI: {formatCurrency(stock.sbiSmallCapVal)}</span>}
                          </div>
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
                          {stock.totalPctOfPortfolio.toFixed(2)}% of Portfolio
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
                          MF Only
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredStocks.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: '#71717a', fontSize: '0.875rem' }}>
                    No stocks match your filter criteria.
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
