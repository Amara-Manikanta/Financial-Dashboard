import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Briefcase, ChevronDown, Copy, Plus, X as XIcon, EyeOff } from 'lucide-react';

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
        <div className="p-8 max-w-[1600px] mx-auto space-y-12">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <h2 className="text-5xl font-black text-white tracking-tighter mb-4 flex items-center gap-4">
                        <Briefcase className="text-blue-500" size={40} />
                        Salary Dashboard
                    </h2>
                    <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-xs">Track your CTC, Payslips, and Benefits</p>
                </div>
                
                <div className="relative group min-w-[200px] z-50">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                        className="w-full appearance-none border border-white/10 text-white py-4 pl-6 pr-12 rounded-2xl font-bold uppercase tracking-widest text-sm focus:outline-none focus:border-blue-500/50 hover:bg-white/[0.05] transition-all cursor-pointer"
                    >
                        {years.map(y => <option key={y} value={y} style={{ backgroundColor: '#121214' }} className="text-white">{y}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-white transition-colors pointer-events-none" size={18} />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)' }} className="xl:col-span-5 border border-white/5 rounded-[2rem] p-6 lg:p-8 flex flex-col h-full shadow-2xl relative z-10">
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} className="flex gap-2 mb-8 p-1 rounded-2xl border border-white/5">
                        <button
                            onClick={() => { setEntryMode('Monthly'); setIsEditing(false); }}
                            className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${entryMode === 'Monthly' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                        >
                            Monthly Payslip
                        </button>
                        <button
                            onClick={() => { setEntryMode('Annual'); setIsEditing(false); }}
                            className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${entryMode === 'Annual' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                        >
                            Annual CTC
                        </button>
                    </div>

                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-2xl font-black text-white tracking-tight">{entryMode} Data</h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                                {entryMode === 'Annual' ? `For Year ${selectedYear}` : 'Select month below'}
                            </p>
                        </div>
                        {entryMode === 'Monthly' && (
                            <div className="relative group">
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => { setSelectedMonth(e.target.value); setIsEditing(false); }}
                                    style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                                    className="appearance-none border border-white/10 text-white py-2 pl-4 pr-10 rounded-xl font-bold text-sm focus:outline-none cursor-pointer"
                                >
                                    {MONTHS.map(m => <option key={m} value={m} style={{ backgroundColor: '#121214' }}>{m}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-8 custom-scrollbar">
                        {entryMode === 'Annual' ? (
                            <div className="bg-[#121214] border border-white/10 rounded-2xl p-6 shadow-2xl relative">
                                <div className="border-b border-white/10 pb-4 mb-6">
                                    <h4 className="text-xl font-black text-white tracking-tight">ANNUAL CTC STRUCTURE</h4>
                                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Financial Year {selectedYear}</p>
                                </div>
                                
                                {['Base', 'Allowances', 'Retirement', 'Insurance & Limits', 'Custom'].map(category => {
                                    const fields = activeAnnualFields.filter(f => (f.category || 'Custom') === category);
                                    if(fields.length === 0 && !isEditing) return null;
                                    if(fields.length === 0 && isEditing && category !== 'Custom') return null; // Only show Custom add button if empty maybe? Actually let's always show Add button if editing.

                                    return (
                                        <div key={category} className="mb-8 last:mb-0">
                                            <h5 className="text-[10px] font-black text-blue-400 uppercase tracking-widest border-b border-blue-500/20 pb-2 mb-2">{category}</h5>
                                            <div className="space-y-1">
                                                {fields.map(renderFieldInput)}
                                            </div>
                                            {isEditing && (
                                                <button onClick={() => handleAddCustomField('annual', category)} className="w-full mt-3 py-2 border border-dashed border-white/10 rounded-lg text-gray-500 hover:text-white hover:border-white/30 hover:bg-white/5 text-[9px] font-bold uppercase tracking-widest flex justify-center items-center gap-2 transition-all">
                                                    <Plus size={12} /> Add {category} Field
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="bg-[#121214] border border-white/10 rounded-2xl p-6 shadow-2xl relative">
                                {/* Decorative header */}
                                <div className="flex justify-between items-end border-b border-white/10 pb-6 mb-6">
                                    <div>
                                        <h4 className="text-xl font-black text-white tracking-tight">SALARY SLIP</h4>
                                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{selectedMonth} {selectedYear}</p>
                                    </div>
                                    <div className="text-right">
                                        <h4 className="text-emerald-400 font-black text-3xl">{formatCurrency(currentNet)}</h4>
                                        <p className="text-emerald-500/50 text-[9px] font-black uppercase tracking-widest mt-1">Net Take Home</p>
                                    </div>
                                </div>
                                
                                {isEditing && selectedMonth !== 'January' && (
                                    <button onClick={handleCopyPreviousMonth} className="w-full mb-6 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg flex justify-center items-center gap-2 text-[10px] text-blue-400 hover:bg-blue-500/20 font-bold uppercase tracking-wider transition-colors">
                                        <Copy size={12} /> Copy from Previous Month
                                    </button>
                                )}

                                <div className="flex flex-col gap-8">
                                    <div>
                                        <div className="flex justify-between items-end border-b border-emerald-500/20 pb-2 mb-2">
                                            <h5 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Earnings</h5>
                                            <span className="text-xs font-black text-emerald-400">{formatCurrency(currentGross)}</span>
                                        </div>
                                        <div className="space-y-1">
                                            {activeMonthlyEarnings.map(renderFieldInput)}
                                        </div>
                                        {isEditing && (
                                            <button onClick={() => handleAddCustomField('monthlyEarnings', null)} className="w-full mt-3 py-2 border border-dashed border-white/10 rounded-lg text-gray-500 hover:text-white hover:border-white/30 hover:bg-white/5 text-[9px] font-bold uppercase tracking-widest flex justify-center items-center gap-2 transition-all">
                                                <Plus size={12} /> Add Earning
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <div className="flex justify-between items-end border-b border-rose-500/20 pb-2 mb-2">
                                            <h5 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Deductions</h5>
                                            <span className="text-xs font-black text-rose-400">{formatCurrency(currentDeductions)}</span>
                                        </div>
                                        <div className="space-y-1">
                                            {activeMonthlyDeductions.map(renderFieldInput)}
                                        </div>
                                        {isEditing && (
                                            <button onClick={() => handleAddCustomField('monthlyDeductions', null)} className="w-full mt-3 py-2 border border-dashed border-white/10 rounded-lg text-gray-500 hover:text-white hover:border-white/30 hover:bg-white/5 text-[9px] font-bold uppercase tracking-widest flex justify-center items-center gap-2 transition-all">
                                                <Plus size={12} /> Add Deduction
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-white/5">
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest transition-all"
                            >
                                {currentRecord ? 'Edit Record' : 'Add Record'}
                            </button>
                        ) : (
                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setFormData(currentRecord ? { ...currentRecord } : {});
                                    }}
                                    className="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-900/20"
                                >
                                    Save Record
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="xl:col-span-7 flex flex-col gap-8 relative z-0">
                    {/* Monthly Trend Chart */}
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)' }} className="border border-white/5 rounded-[2rem] p-8 shadow-2xl flex flex-col">
                        <div className="mb-6 flex justify-between items-start">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight">Payslip Analysis</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Select fields to compare across {selectedYear}</p>
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
                                <div className="w-full overflow-x-auto custom-scrollbar pb-4 mt-4">
                                    <div style={{ minWidth: '800px', height: '400px' }}>
                                        <BarChart width={800} height={400} data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                            <XAxis dataKey="month" stroke="#ffffff50" axisLine={false} tickLine={false} fontSize={12} dy={10} />
                                            <YAxis stroke="#ffffff50" axisLine={false} tickLine={false} fontSize={12} tickFormatter={val => `₹${val/1000}k`} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff05' }} />
                                            {activeMonthlyFieldsFilter.map((fieldKey, idx) => {
                                                const field = MONTHLY_ALL_TOGGLES.find(f => f.key === fieldKey);
                                                if(!field) return null;
                                                return <Bar key={fieldKey} dataKey={fieldKey} name={field.label} fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={60} />
                                            })}
                                        </BarChart>
                                    </div>
                                </div>
                                
                                <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-white/5">
                                    <div style={{ backgroundColor: 'rgba(255,255,255,0.03)' }} className="rounded-2xl p-5 border border-white/5 shadow-lg">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">Total Year Gross</p>
                                        <p className="text-2xl font-black text-white">{formatCurrency(monthlyAggregates.totalGross)}</p>
                                    </div>
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 shadow-lg shadow-emerald-900/10">
                                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1.5">Total Net Take Home</p>
                                        <p className="text-2xl font-black text-emerald-400">{formatCurrency(monthlyAggregates.totalNet)}</p>
                                    </div>
                                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 shadow-lg shadow-rose-900/10">
                                        <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest mb-1.5">Total Income Tax</p>
                                        <p className="text-2xl font-black text-rose-400">{formatCurrency(monthlyAggregates.totalIncomeTax)}</p>
                                    </div>
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 shadow-lg shadow-blue-900/10">
                                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1.5">Total EPF Received</p>
                                        <p className="text-2xl font-black text-blue-400">{formatCurrency(monthlyAggregates.totalEpf)}</p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ height: '400px' }} className="w-full flex items-center justify-center text-gray-500 font-bold uppercase tracking-widest text-xs border border-white/5 rounded-2xl bg-black/20">
                                No monthly data for {selectedYear}
                            </div>
                        )}
                    </div>

                    {/* Annual Trend Chart */}
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)' }} className="border border-white/5 rounded-[2rem] p-8 shadow-2xl flex flex-col">
                        <div className="mb-6 flex justify-between items-start">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight">Annual Field Tracking</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Select fields to view historical progression</p>
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
                                <div className="w-full overflow-x-auto custom-scrollbar pb-4 mt-4">
                                    <div style={{ minWidth: '800px', height: '400px' }}>
                                        <BarChart width={800} height={400} data={annualData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                            <XAxis dataKey="year" stroke="#ffffff50" axisLine={false} tickLine={false} fontSize={12} dy={10} />
                                            <YAxis stroke="#ffffff50" axisLine={false} tickLine={false} fontSize={12} tickFormatter={val => `₹${val/100000}L`} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff05' }} />
                                            {activeAnnualFieldsFilter.map((fieldKey, idx) => {
                                                const field = activeAnnualFields.find(f => f.key === fieldKey);
                                                if(!field) return null;
                                                return <Bar key={fieldKey} dataKey={fieldKey} name={field.label} fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={60} />
                                            })}
                                        </BarChart>
                                    </div>
                                </div>
                                
                                {comparisonData && (
                                    <div className="mt-8 pt-6 border-t border-white/5">
                                        <div className="mb-6">
                                            <h4 className="text-xl font-black text-white tracking-tight">CTC Realization vs Target</h4>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Difference between actual monthly earnings and {selectedYear} Annual CTC targets</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {activeMonthlyEarnings.map(field => {
                                                const data = comparisonData[field.key];
                                                const isDeficit = data.difference < 0;
                                                const isSurplus = data.difference > 0;
                                                return (
                                                    <div key={field.key} style={{ backgroundColor: 'rgba(255,255,255,0.02)' }} className="rounded-2xl p-5 border border-white/5 shadow-lg">
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4 line-clamp-1" title={field.label}>{field.label}</p>
                                                        <div className="space-y-2 mb-4">
                                                            <div className="flex justify-between items-end text-xs">
                                                                <span className="text-gray-500 font-bold uppercase tracking-wider text-[9px]">Target</span>
                                                                <span className="text-white font-black">{formatCurrency(data.target)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-end text-xs">
                                                                <span className="text-gray-500 font-bold uppercase tracking-wider text-[9px]">Received</span>
                                                                <span className="text-blue-400 font-black">{formatCurrency(data.received)}</span>
                                                            </div>
                                                        </div>
                                                        <div className={`pt-3 border-t ${isDeficit ? 'border-rose-500/20' : isSurplus ? 'border-emerald-500/20' : 'border-white/10'} flex justify-between items-center`}>
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Difference</span>
                                                            <span className={`text-sm font-black ${isDeficit ? 'text-rose-400' : isSurplus ? 'text-emerald-400' : 'text-gray-300'}`}>
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
                            <div style={{ height: '400px' }} className="w-full flex items-center justify-center text-gray-500 font-bold uppercase tracking-widest text-xs border border-white/5 rounded-2xl bg-black/20">
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
