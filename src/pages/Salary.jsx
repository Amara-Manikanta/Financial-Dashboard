import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Briefcase, ChevronDown, Copy, Plus, X as XIcon, EyeOff, Award, Wallet, ShieldCheck, Info } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ANNUAL_FIELDS_DEFAULT = [
    { key: 'basicSalary', label: 'Basic Salary', category: 'Base' },
    { key: 'hra', label: 'HRA', category: 'Base' },
    { key: 'conveyanceAllowance', label: 'Conveyance Allowance', category: 'Base' },
    { key: 'flexibleAllowance', label: 'Flexible Allowance', category: 'Base' },
    { key: 'performanceBonus', label: 'Performance Bonus', category: 'Base' },
    { key: 'foodWallet', label: 'Food Wallet', category: 'Allowances' },
    { key: 'annualFlexiBasket', label: 'Annual Flexi Basket', category: 'Allowances' },
    { key: 'pf', label: 'PF', category: 'Retirement' },
    { key: 'gratuity', label: 'Gratuity', category: 'Retirement' },
    { key: 'medicalInsurance', label: 'Medical Insurance', category: 'Insurance & Limits' },
    { key: 'hospitalizationLimit', label: 'Hospitalization Limit', category: 'Insurance & Limits' },
    { key: 'termLifeInsurance', label: 'Term Life Insurance', category: 'Insurance & Limits' },
    { key: 'disabilityCover', label: 'Disability Cover', category: 'Insurance & Limits' },
];

const MONTHLY_EARNINGS_DEFAULT = [
    { key: 'basicSalary', label: 'Basic Salary' },
    { key: 'hra', label: 'HRA' },
    { key: 'conveyanceAllowance', label: 'Conveyance Allowance' },
    { key: 'flexibleAllowance', label: 'Flexible Allowance' },
    { key: 'performanceBonus', label: 'Performance Bonus' },
];

const MONTHLY_DEDUCTIONS_DEFAULT = [
    { key: 'epf', label: 'EPF' },
    { key: 'profTax', label: 'Professional Tax' },
    { key: 'incomeTax', label: 'Income Tax' },
    { key: 'otherRecoveries', label: 'Other Recoveries' },
];

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#EAB308', '#6366F1', '#14B8A6'];

const MultiSelectDropdown = ({ options, selected, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative z-50" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-white/10 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-all w-64"
            >
                <span>{label} ({selected.length})</span>
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div style={{ maxHeight: '300px', whiteSpace: 'nowrap' }} className="absolute right-0 top-full mt-2 min-w-full bg-[#121214] border border-white/10 rounded-xl shadow-2xl p-2 overflow-y-auto custom-scrollbar">
                    {options.map(opt => {
                        const isSelected = selected.includes(opt.key);
                        return (
                            <label key={opt.key} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    onChange={() => {
                                        if (isSelected) onChange(selected.filter(k => k !== opt.key));
                                        else onChange([...selected, opt.key]);
                                    }}
                                    className="accent-blue-500 w-4 h-4 cursor-pointer"
                                />
                                <span className="text-white text-xs font-bold uppercase tracking-wider">{opt.label}</span>
                            </label>
                        )
                    })}
                </div>
            )}
        </div>
    );
};

const Salary = () => {
    const { salaryDetails, addItem, updateItem, formatCurrency, customSalaryFields, hiddenSalaryFields, updateSalaryFieldsConfig } = useFinance();
    
    // View state
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [entryMode, setEntryMode] = useState('Monthly'); // 'Monthly' or 'Annual'
    const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
    
    // Form state
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});


    // Filter state
    const [activeAnnualFieldsFilter, setActiveAnnualFieldsFilter] = useState(['basicSalary', 'hra', 'performanceBonus', 'pf']);
    const [activeMonthlyFieldsFilter, setActiveMonthlyFieldsFilter] = useState(['Gross', 'Deductions', 'Net']);
    
    // Dynamic Fields Logic
    const activeAnnualFields = useMemo(() => {
        const combined = [...ANNUAL_FIELDS_DEFAULT, ...(customSalaryFields?.annual || [])];
        return combined.filter(f => !hiddenSalaryFields.includes(f.key));
    }, [customSalaryFields, hiddenSalaryFields]);

    const activeMonthlyEarnings = useMemo(() => {
        const combined = [...MONTHLY_EARNINGS_DEFAULT, ...(customSalaryFields?.monthlyEarnings || [])];
        return combined.filter(f => !hiddenSalaryFields.includes(f.key));
    }, [customSalaryFields, hiddenSalaryFields]);

    const activeMonthlyDeductions = useMemo(() => {
        const combined = [...MONTHLY_DEDUCTIONS_DEFAULT, ...(customSalaryFields?.monthlyDeductions || [])];
        return combined.filter(f => !hiddenSalaryFields.includes(f.key));
    }, [customSalaryFields, hiddenSalaryFields]);

    const MONTHLY_ALL_TOGGLES = useMemo(() => [
        { key: 'Gross', label: 'Total Gross' },
        { key: 'Deductions', label: 'Total Deductions' },
        { key: 'Net', label: 'Net Take Home' },
        ...activeMonthlyEarnings,
        ...activeMonthlyDeductions
    ], [activeMonthlyEarnings, activeMonthlyDeductions]);
    
    // Find current record
    const currentRecord = useMemo(() => {
        const targetMonth = entryMode === 'Annual' ? 'Annual' : selectedMonth;
        return salaryDetails.find(s => s.year === selectedYear && s.month === targetMonth);
    }, [salaryDetails, selectedYear, selectedMonth, entryMode]);

    React.useEffect(() => {
        if (currentRecord) {
            setFormData({ ...currentRecord });
        } else {
            setFormData({});
        }
    }, [currentRecord, isEditing]);

    const handleSave = async () => {
        const targetMonth = entryMode === 'Annual' ? 'Annual' : selectedMonth;
        
        const processedFormData = {};
        for(let key in formData) {
            if(['id', 'year', 'month', 'type'].includes(key)) {
                processedFormData[key] = formData[key];
            } else {
                processedFormData[key] = parseFloat(formData[key]) || 0;
            }
        }

        if (currentRecord) {
            await updateItem('salaryDetail', { ...currentRecord, ...processedFormData });
        } else {
            await addItem('salaryDetail', {
                id: Date.now().toString(),
                year: selectedYear,
                month: targetMonth,
                type: entryMode.toLowerCase(),
                ...processedFormData
            });
        }
        setIsEditing(false);
    };

    const handleCopyPreviousMonth = () => {
        const currentIndex = MONTHS.indexOf(selectedMonth);
        if (currentIndex > 0) {
            const prevMonth = MONTHS[currentIndex - 1];
            const prevRecord = salaryDetails.find(s => s.year === selectedYear && s.month === prevMonth);
            if (prevRecord) {
                const copiedData = { ...prevRecord };
                delete copiedData.id;
                delete copiedData.month;
                setFormData(copiedData);
                setIsEditing(true);
            } else {
                alert("No data found for the previous month.");
            }
        }
    };

    const handleHideField = async (key) => {
        if(window.confirm(`Are you sure you want to hide this field? You can't undo this easily yet.`)) {
            const newHidden = [...hiddenSalaryFields, key];
            await updateSalaryFieldsConfig(customSalaryFields, newHidden);
        }
    };

    const handleAddCustomField = async (categoryKey, annualCategory) => {
        const inputName = window.prompt("Enter new field name (e.g. Internet Allowance):");
        if (!inputName || !inputName.trim()) return;
        
        try {
            let key = inputName.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(Boolean).map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
            if(!key) key = 'customField' + Date.now();

            const newField = { key, label: inputName.trim(), category: entryMode === 'Annual' ? (annualCategory || 'Custom') : 'Custom' };
            const newCustom = JSON.parse(JSON.stringify(customSalaryFields || { annual: [], monthlyEarnings: [], monthlyDeductions: [] }));
            
            if(!newCustom[categoryKey]) newCustom[categoryKey] = [];
            
            // Prevent duplicate keys
            if (!newCustom[categoryKey].find(f => f.key === key)) {
                newCustom[categoryKey].push(newField);
                await updateSalaryFieldsConfig(newCustom, hiddenSalaryFields || []);
            } else {
                alert("A field with a similar name already exists!");
            }
        } catch (error) {
            console.error("Error adding custom field:", error);
            alert("Error adding custom field.");
        }
    };

    const annualData = useMemo(() => {
        const yearMap = {};
        salaryDetails.forEach(record => {
            if (record.month === 'Annual') {
                if (!yearMap[record.year]) {
                    yearMap[record.year] = { year: record.year };
                    activeAnnualFields.forEach(f => yearMap[record.year][f.key] = 0);
                }
                
                activeAnnualFields.forEach(field => {
                    yearMap[record.year][field.key] = Number(record[field.key]) || 0;
                });
            }
        });
        return Object.values(yearMap).sort((a, b) => a.year.localeCompare(b.year));
    }, [salaryDetails, activeAnnualFields]);

    const monthlyData = useMemo(() => {
        const records = salaryDetails.filter(s => s.year === selectedYear && s.month !== 'Annual');
        return MONTHS.map(month => {
            const record = records.find(r => r.month === month) || {};
            let monthData = { month: month.substring(0, 3) };
            
            [...activeMonthlyEarnings, ...activeMonthlyDeductions].forEach(f => {
                monthData[f.key] = Number(record[f.key]) || 0;
            });
            
            let gross = 0;
            activeMonthlyEarnings.forEach(f => gross += (monthData[f.key] || 0));
            
            let deductions = 0;
            activeMonthlyDeductions.forEach(f => deductions += (monthData[f.key] || 0));

            monthData.Gross = gross;
            monthData.Deductions = deductions;
            monthData.Net = gross - deductions;

            // Preserve known keys for aggregates
            if (record.incomeTax) monthData.incomeTax = Number(record.incomeTax);
            if (record.epf) monthData.epf = Number(record.epf);

            return monthData;
        });
    }, [salaryDetails, selectedYear, activeMonthlyEarnings, activeMonthlyDeductions]);

    const hasMonthlyData = useMemo(() => monthlyData.some(m => m.Gross > 0 || m.Deductions > 0), [monthlyData]);

    const monthlyAggregates = useMemo(() => {
        let totalGross = 0;
        let totalNet = 0;
        let totalIncomeTax = 0;
        let totalEpf = 0;

        monthlyData.forEach(m => {
            totalGross += (m.Gross || 0);
            totalNet += (m.Net || 0);
            totalIncomeTax += (m.incomeTax || 0);
            totalEpf += (m.epf || 0);
        });

        return { totalGross, totalNet, totalIncomeTax, totalEpf };
    }, [monthlyData]);

    const annualRecordForSelectedYear = useMemo(() => {
        return salaryDetails.find(s => s.year === selectedYear && s.month === 'Annual') || null;
    }, [salaryDetails, selectedYear]);

    const comparisonData = useMemo(() => {
        if (!annualRecordForSelectedYear) return null;
        
        const differences = {};
        activeMonthlyEarnings.forEach(field => {
            const annualTarget = Number(annualRecordForSelectedYear[field.key]) || 0;
            let monthlySum = 0;
            monthlyData.forEach(m => {
                monthlySum += (m[field.key] || 0);
            });
            differences[field.key] = {
                target: annualTarget,
                received: monthlySum,
                difference: monthlySum - annualTarget
            };
        });
        return differences;
    }, [annualRecordForSelectedYear, monthlyData, activeMonthlyEarnings]);

    const years = useMemo(() => {
        const ys = new Set(salaryDetails.map(s => s.year));
        const currentYear = new Date().getFullYear();
        for (let i = 0; i < 10; i++) {
            ys.add((currentYear - i).toString());
        }
        return Array.from(ys).sort((a, b) => b.localeCompare(a));
    }, [salaryDetails]);

    // Calculate Total Gratuity Till Now (sum of annual gratuity across all annual CTC records)
    const gratuityStats = useMemo(() => {
        let totalGratuityTillNow = 0;
        let selectedYearGratuity = 0;
        const yearBreakdown = [];

        salaryDetails.forEach(s => {
            if (s.month === 'Annual') {
                const amt = Number(s.gratuity) || 0;
                totalGratuityTillNow += amt;
                if (s.year === selectedYear) {
                    selectedYearGratuity = amt;
                }
                if (amt > 0) {
                    yearBreakdown.push({ year: s.year, amount: amt });
                }
            }
        });

        yearBreakdown.sort((a, b) => b.year.localeCompare(a.year));

        return { totalGratuityTillNow, selectedYearGratuity, yearBreakdown };
    }, [salaryDetails, selectedYear]);

    const annualTotalForSelectedYear = useMemo(() => {
        if (!annualRecordForSelectedYear) return 0;
        return activeAnnualFields.reduce((sum, f) => sum + (Number(annualRecordForSelectedYear[f.key]) || 0), 0);
    }, [annualRecordForSelectedYear, activeAnnualFields]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-black/90 border border-white/10 p-4 rounded-xl shadow-2xl backdrop-blur-md">
                    <p className="text-white font-bold mb-2">{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex justify-between gap-6 text-sm mb-1">
                            <span style={{ color: entry.color }}>{entry.name}</span>
                            <span className="font-bold text-white">{formatCurrency(entry.value)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    const renderFieldInput = (field) => {
        const val = formData[field.key] !== undefined ? formData[field.key] : 0;
        return (
            <div key={field.key} className="flex justify-between items-center py-2.5 border-b border-white/5 hover:bg-white/5 px-3 rounded-lg transition-colors group">
                <div className="flex items-center gap-3">
                    {isEditing && (
                        <button onClick={() => handleHideField(field.key)} className="text-gray-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Hide this field">
                            <XIcon size={14} />
                        </button>
                    )}
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{field.label}</span>
                </div>
                {isEditing ? (
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">₹</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={val}
                            onChange={(e) => {
                                let valStr = e.target.value.replace(/[^0-9.-]/g, '');
                                const hasMinus = valStr.indexOf('-') === 0;
                                valStr = valStr.replace(/-/g, '');
                                if (hasMinus) {
                                    valStr = '-' + valStr;
                                }
                                const parts = valStr.split('.');
                                const finalStr = parts[0] + (parts.length > 1 ? '.' + parts[1] : '');
                                setFormData(prev => ({ ...prev, [field.key]: finalStr }));
                            }}
                            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                            className="w-36 border border-white/10 rounded-lg py-1.5 pl-7 pr-3 text-right text-sm font-black text-white focus:outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                ) : (
                    <span className="text-sm font-black text-white">{formatCurrency(Number(val) || 0)}</span>
                )}
            </div>
        );
    };

    // Calculate current totals for the payslip header
    const currentGross = activeMonthlyEarnings.reduce((sum, f) => sum + (parseFloat(formData[f.key]) || 0), 0);
    const currentDeductions = activeMonthlyDeductions.reduce((sum, f) => sum + (parseFloat(formData[f.key]) || 0), 0);
    const currentNet = currentGross - currentDeductions;

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Briefcase style={{ color: '#3b82f6' }} size={32} /> Salary Dashboard
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', margin: '0.25rem 0 0 0' }}>Track your CTC, Payslips, and Benefits</p>
                </div>
                
                <div style={{
                    display: 'flex',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '1rem',
                    padding: '2px'
                }}>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        style={{ backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '11px', fontWeight: 'bold', padding: '0.5rem 1.5rem', outline: 'none', cursor: 'pointer' }}
                    >
                        {years.map(y => <option key={y} value={y} style={{ backgroundColor: '#121214' }}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* Top Summary Card featuring Gratuity */}
            <div>
                {/* Total Gratuity Card */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(24, 24, 27, 0.7) 100%)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '1.5rem',
                    padding: '1.5rem',
                    boxShadow: '0 8px 32px rgba(16, 185, 129, 0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1, color: '#34d399' }}>
                        <Award size={100} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ padding: '0.375rem', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                                <Award size={18} />
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: '900', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Total Gratuity (Till Now)
                            </span>
                        </div>
                        <span style={{ fontSize: '9px', fontWeight: '800', padding: '0.125rem 0.5rem', borderRadius: '0.375rem', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                            Cumulative
                        </span>
                    </div>
                    <h3 style={{ fontSize: '1.875rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: 0, letterSpacing: '-0.02em' }}>
                        {formatCurrency(gratuityStats.totalGratuityTillNow)}
                    </h3>
                    <div style={{ marginTop: '0.875rem', fontSize: '11px', color: '#a1a1aa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.625rem' }}>
                        <span>Year {selectedYear}: <strong style={{ color: '#34d399', fontFamily: 'monospace' }}>{formatCurrency(gratuityStats.selectedYearGratuity)}</strong></span>
                        <span style={{ fontSize: '10px', color: '#71717a' }}>{gratuityStats.yearBreakdown.length} Yrs Annual CTC</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', lg: { gridTemplateColumns: 'repeat(12, 1fr)' }, gap: '2rem' }}>
                {/* Inputs Column */}
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.4)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(59, 130, 246, 0.1)',
                    borderRadius: '2rem',
                    padding: '2rem',
                    boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem'
                }}>
                    <div style={{
                        display: 'flex',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '1rem',
                        padding: '2px',
                        gap: '2px'
                    }}>
                        <button
                            onClick={() => { setEntryMode('Monthly'); setIsEditing(false); }}
                            style={{
                                flex: 1,
                                padding: '0.5rem 1rem',
                                fontSize: '9px',
                                fontWeight: '900',
                                letterSpacing: '0.05em',
                                borderRadius: '0.75rem',
                                border: 'none',
                                backgroundColor: entryMode === 'Monthly' ? '#3b82f6' : 'transparent',
                                color: entryMode === 'Monthly' ? 'white' : '#71717a',
                                cursor: 'pointer',
                                textTransform: 'uppercase'
                            }}
                        >
                            Monthly Payslip
                        </button>
                        <button
                            onClick={() => { setEntryMode('Annual'); setIsEditing(false); }}
                            style={{
                                flex: 1,
                                padding: '0.5rem 1rem',
                                fontSize: '9px',
                                fontWeight: '900',
                                letterSpacing: '0.05em',
                                borderRadius: '0.75rem',
                                border: 'none',
                                backgroundColor: entryMode === 'Annual' ? '#3b82f6' : 'transparent',
                                color: entryMode === 'Annual' ? 'white' : '#71717a',
                                cursor: 'pointer',
                                textTransform: 'uppercase'
                            }}
                        >
                            Annual CTC
                        </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: 0 }}>{entryMode} Data</h3>
                            <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.25rem' }}>
                                {entryMode === 'Annual' ? `For Year ${selectedYear}` : 'Select month below'}
                            </p>
                        </div>
                        {entryMode === 'Monthly' && (
                            <div style={{
                                display: 'flex',
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '1rem',
                                padding: '2px'
                            }}>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => { setSelectedMonth(e.target.value); setIsEditing(false); }}
                                    style={{ backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '11px', fontWeight: 'bold', padding: '0.5rem 1rem', outline: 'none', cursor: 'pointer' }}
                                >
                                    {MONTHS.map(m => <option key={m} value={m} style={{ backgroundColor: '#121214' }}>{m}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {entryMode === 'Annual' ? (
                            <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                                    <h4 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: 0 }}>ANNUAL CTC STRUCTURE</h4>
                                    <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.25rem' }}>Financial Year {selectedYear}</p>
                                </div>
                                
                                {['Base', 'Allowances', 'Retirement', 'Insurance & Limits', 'Custom'].map(category => {
                                    const fields = activeAnnualFields.filter(f => (f.category || 'Custom') === category);
                                    if(fields.length === 0 && !isEditing) return null;
                                    if(fields.length === 0 && isEditing && category !== 'Custom') return null;

                                    return (
                                        <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <h5 style={{ fontSize: '9px', fontWeight: '900', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(59, 130, 246, 0.1)', paddingBottom: '0.25rem', margin: 0 }}>{category}</h5>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {fields.map(renderFieldInput)}
                                            </div>
                                            {isEditing && (
                                                <button onClick={() => handleAddCustomField('annual', category)} style={{ width: '100%', padding: '0.5rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '0.5rem', backgroundColor: 'transparent', color: '#71717a', fontSize: '9px', fontWeight: '900', letterSpacing: '0.05em', cursor: 'pointer', textTransform: 'uppercase' }}>
                                                    + Add {category} Field
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.5rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                                    <div>
                                        <h4 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: 0 }}>SALARY SLIP</h4>
                                        <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.25rem' }}>{selectedMonth} {selectedYear}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <h4 style={{ fontSize: '1.5rem', fontWeight: '950', color: '#10b981', fontFamily: 'monospace', margin: 0 }}>{formatCurrency(currentNet)}</h4>
                                        <p style={{ fontSize: '8px', fontWeight: '900', color: 'rgba(16, 185, 129, 0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem', margin: 0 }}>Net Take Home</p>
                                    </div>
                                </div>
                                
                                {isEditing && selectedMonth !== 'January' && (
                                    <button onClick={handleCopyPreviousMonth} style={{ width: '100%', padding: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '0.5rem', color: '#60a5fa', fontSize: '9px', fontWeight: '900', letterSpacing: '0.05em', cursor: 'pointer', textTransform: 'uppercase' }}>
                                        Copy from Previous Month
                                    </button>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(16, 185, 129, 0.1)', paddingBottom: '0.25rem', marginBottom: '0.75rem' }}>
                                            <h5 style={{ fontSize: '9px', fontWeight: '900', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Earnings</h5>
                                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#34d399', fontFamily: 'monospace' }}>{formatCurrency(currentGross)}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {activeMonthlyEarnings.map(renderFieldInput)}
                                        </div>
                                        {isEditing && (
                                            <button onClick={() => handleAddCustomField('monthlyEarnings', null)} style={{ width: '100%', padding: '0.5rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '0.5rem', backgroundColor: 'transparent', color: '#71717a', fontSize: '9px', fontWeight: '900', letterSpacing: '0.05em', cursor: 'pointer', textTransform: 'uppercase', marginTop: '0.75rem' }}>
                                                + Add Earning
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(239, 68, 68, 0.1)', paddingBottom: '0.25rem', marginBottom: '0.75rem' }}>
                                            <h5 style={{ fontSize: '9px', fontWeight: '900', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Deductions</h5>
                                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#f87171', fontFamily: 'monospace' }}>{formatCurrency(currentDeductions)}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {activeMonthlyDeductions.map(renderFieldInput)}
                                        </div>
                                        {isEditing && (
                                            <button onClick={() => handleAddCustomField('monthlyDeductions', null)} style={{ width: '100%', padding: '0.5rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '0.5rem', backgroundColor: 'transparent', color: '#71717a', fontSize: '9px', fontWeight: '900', letterSpacing: '0.05em', cursor: 'pointer', textTransform: 'uppercase', marginTop: '0.75rem' }}>
                                                + Add Deduction
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem', marginTop: 'auto' }}>
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                style={{ width: '100%', padding: '1rem', borderRadius: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'white', fontSize: '11px', fontWeight: '900', letterSpacing: '0.05em', cursor: 'pointer', textTransform: 'uppercase' }}
                            >
                                {currentRecord ? 'Edit Record' : 'Add Record'}
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setFormData(currentRecord ? { ...currentRecord } : {});
                                    }}
                                    style={{ flex: 1, padding: '1rem', borderRadius: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'white', fontSize: '11px', fontWeight: '900', letterSpacing: '0.05em', cursor: 'pointer', textTransform: 'uppercase' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    style={{ flex: 1, padding: '1rem', borderRadius: '1rem', backgroundColor: '#3b82f6', border: 'none', color: 'white', fontSize: '11px', fontWeight: '900', letterSpacing: '0.05em', cursor: 'pointer', textTransform: 'uppercase' }}
                                >
                                    Save Record
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Charts Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Monthly Trend Chart */}
                    <div style={{
                        backgroundColor: 'rgba(24, 24, 27, 0.4)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '2rem',
                        padding: '1.5rem',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: 0 }}>Payslip Analysis</h3>
                                <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.25rem' }}>Select fields to compare across {selectedYear}</p>
                            </div>
                            {hasMonthlyData && (
                                <MultiSelectDropdown 
                                    label="Filter Fields" 
                                    options={MONTHLY_ALL_TOGGLES} 
                                    selected={activeMonthlyFieldsFilter} 
                                    onChange={setActiveMonthlyFieldsFilter} 
                                />
                            )}
                        </div>

                        {hasMonthlyData ? (
                            <>
                                <div style={{ overflowX: 'auto', width: '100%', paddingBottom: '1rem' }}>
                                    <div style={{ minWidth: '800px', height: 400 }}>
                                        <BarChart width={800} height={400} data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                            <XAxis dataKey="month" stroke="#71717a" axisLine={false} tickLine={false} fontSize={10} dy={10} />
                                            <YAxis stroke="#71717a" axisLine={false} tickLine={false} fontSize={10} tickFormatter={val => `₹${val/1000}k`} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff02' }} />
                                            {activeMonthlyFieldsFilter.map((fieldKey, idx) => {
                                                const field = MONTHLY_ALL_TOGGLES.find(f => f.key === fieldKey);
                                                if(!field) return null;
                                                return <Bar key={fieldKey} dataKey={fieldKey} name={field.label} fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={60} />
                                            })}
                                        </BarChart>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem', marginTop: '1rem' }}>
                                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1rem', padding: '1rem' }}>
                                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Year Gross</span>
                                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(monthlyAggregates.totalGross)}</p>
                                    </div>
                                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '1rem', padding: '1rem' }}>
                                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Net Take Home</span>
                                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: '#34d399', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(monthlyAggregates.totalNet)}</p>
                                    </div>
                                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '1rem', padding: '1rem' }}>
                                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Income Tax</span>
                                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: '#f87171', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(monthlyAggregates.totalIncomeTax)}</p>
                                    </div>
                                    <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.03)', border: '1px solid rgba(59, 130, 246, 0.1)', borderRadius: '1rem', padding: '1rem' }}>
                                        <span style={{ fontSize: '8px', fontWeight: '900', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total EPF Received</span>
                                        <p style={{ fontSize: '1.25rem', fontWeight: '950', color: '#60a5fa', fontFamily: 'monospace', margin: '0.25rem 0 0 0' }}>{formatCurrency(monthlyAggregates.totalEpf)}</p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyCenter: 'center', color: '#71717a', fontSize: '0.875rem', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '1.5rem', backgroundColor: 'rgba(255,255,255,0.01)', width: '100%', justifyContent: 'center' }}>
                                No monthly data for {selectedYear}
                            </div>
                        )}
                    </div>

                    {/* Annual Trend Chart */}
                    <div style={{
                        backgroundColor: 'rgba(24, 24, 27, 0.4)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '2rem',
                        padding: '1.5rem',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: 0 }}>Annual Field Tracking</h3>
                                <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.25rem' }}>Select fields to view historical progression</p>
                            </div>
                            {annualData.length > 0 && (
                                <MultiSelectDropdown 
                                    label="Filter Fields" 
                                    options={activeAnnualFields} 
                                    selected={activeAnnualFieldsFilter} 
                                    onChange={setActiveAnnualFieldsFilter} 
                                />
                            )}
                        </div>

                        {annualData.length > 0 ? (
                            <>
                                <div style={{ overflowX: 'auto', width: '100%', paddingBottom: '1rem' }}>
                                    <div style={{ minWidth: '800px', height: 400 }}>
                                        <BarChart width={800} height={400} data={annualData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                            <XAxis dataKey="year" stroke="#71717a" axisLine={false} tickLine={false} fontSize={10} dy={10} />
                                            <YAxis stroke="#71717a" axisLine={false} tickLine={false} fontSize={10} tickFormatter={val => `₹${val/100000}L`} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff02' }} />
                                            {activeAnnualFieldsFilter.map((fieldKey, idx) => {
                                                const field = activeAnnualFields.find(f => f.key === fieldKey);
                                                if(!field) return null;
                                                return <Bar key={fieldKey} dataKey={fieldKey} name={field.label} fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={60} />
                                            })}
                                        </BarChart>
                                    </div>
                                </div>
                                
                                {comparisonData && (
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <h4 style={{ fontSize: '1.125rem', fontWeight: '900', color: 'white', margin: 0 }}>CTC Realization vs Target</h4>
                                            <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.25rem' }}>Difference between actual monthly earnings and {selectedYear} Annual CTC targets</p>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                            {activeMonthlyEarnings.map(field => {
                                                const data = comparisonData[field.key];
                                                const isDeficit = data.difference < 0;
                                                const isSurplus = data.difference > 0;
                                                return (
                                                    <div key={field.key} style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1rem', padding: '1rem' }}>
                                                        <span style={{ fontSize: '9px', fontWeight: '900', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }} title={field.label}>{field.label}</span>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                                                                <span style={{ color: '#71717a' }}>Target</span>
                                                                <span style={{ color: 'white', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatCurrency(data.target)}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                                                                <span style={{ color: '#71717a' }}>Received</span>
                                                                <span style={{ color: '#60a5fa', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatCurrency(data.received)}</span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', fontSize: '10px' }}>
                                                            <span style={{ color: '#71717a' }}>Diff</span>
                                                            <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: isDeficit ? '#f87171' : isSurplus ? '#34d399' : '#a1a1aa' }}>
                                                                {data.difference > 0 ? '+' : ''}{formatCurrency(data.difference)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyCenter: 'center', color: '#71717a', fontSize: '0.875rem', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '1.5rem', backgroundColor: 'rgba(255,255,255,0.01)', width: '100%', justifyContent: 'center' }}>
                                No annual data available
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Salary;
