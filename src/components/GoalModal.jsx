import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { X, Target, Calendar, DollarSign, Layers, Plus, Trash2, CheckCircle2, FileText, Info } from 'lucide-react';
import { lentOutstanding, receivableLents, totalReceivable } from '../utils/lents';

const CATEGORY_OPTIONS = [
    // A goal you have decided on but not yet funded is a real state. Forcing a
    // source at creation time makes the goal claim progress it does not have.
    { value: 'none', label: 'Not linked yet — decide the source later' },
    { value: 'all_savings', label: 'All Savings & Investments' },
    { value: 'all_investments', label: 'All Investment Portfolio (MFs + Stocks)' },
    { value: 'mutual_fund', label: 'Mutual Funds (All or Particular Fund)' },
    { value: 'recurring_deposit', label: 'Recurring Deposits (All or Particular RD)' },
    { value: 'fixed_deposit', label: 'Fixed Deposits (All or Particular FD)' },
    { value: 'stock_market', label: 'Stock Portfolio (All or Particular Stock)' },
    { value: 'ppf', label: 'PPF (Public Provident Fund)' },
    { value: 'pf', label: 'EPF / PF' },
    { value: 'nps', label: 'NPS (National Pension System)' },
    { value: 'sgb', label: 'SGB (Sovereign Gold Bonds)' },
    { value: 'gratuity', label: 'Gratuity Fund / Accumulation' },
    { value: 'policy', label: 'Insurance Policies (All or Particular Policy)' },
    { value: 'emergency_fund', label: 'Emergency Fund' },
    { value: 'lent', label: 'Money Lent Out (All or Particular Person)' },
    { value: 'manual', label: 'Manual Progress Amount' }
];

/** Sources that contribute nothing and so need no item picker. */
const EMPTY_SOURCE = 'none';

const GoalModal = ({ isOpen, onClose, onSave, editingGoal }) => {
    const { savings, lents, formatCurrency, calculateItemCurrentValue } = useFinance();

    const [name, setName] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const [deadline, setDeadline] = useState('');
    const [priority, setPriority] = useState('medium');
    const [notes, setNotes] = useState('');
    const [fundingSources, setFundingSources] = useState([
        { category: 'all_savings', itemId: 'all', manualAmount: 0 }
    ]);

    useEffect(() => {
        if (editingGoal) {
            setName(editingGoal.name || '');
            setTargetAmount(editingGoal.targetAmount ? String(editingGoal.targetAmount) : '');
            setDeadline(editingGoal.deadline || '');
            setPriority(editingGoal.priority || 'medium');
            setNotes(editingGoal.notes || '');

            if (editingGoal.fundingSources && editingGoal.fundingSources.length > 0) {
                setFundingSources(editingGoal.fundingSources);
            } else if (editingGoal.fundingSource) {
                setFundingSources([{
                    category: editingGoal.fundingSource,
                    itemId: 'all',
                    manualAmount: editingGoal.manualProgress || 0
                }]);
            } else {
                setFundingSources([{ category: 'all_savings', itemId: 'all', manualAmount: 0 }]);
            }
        } else {
            setName('');
            setTargetAmount('');
            setDeadline(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
            setPriority('medium');
            setNotes('');
            setFundingSources([{ category: 'all_savings', itemId: 'all', manualAmount: 0 }]);
        }
    }, [editingGoal, isOpen]);

    if (!isOpen) return null;

    const handleAddSource = () => {
        setFundingSources(prev => [
            ...prev,
            { category: 'recurring_deposit', itemId: 'all', manualAmount: 0 }
        ]);
    };

    const handleRemoveSource = (index) => {
        if (fundingSources.length === 1) return; // Keep at least 1 source
        setFundingSources(prev => prev.filter((_, i) => i !== index));
    };

    const handleSourceChange = (index, field, value) => {
        setFundingSources(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            if (field === 'category') {
                updated[index].itemId = 'all'; // reset item selection on category change
            }
            return updated;
        });
    };

    // Helper to check if item/sub-item is active (not archived or closed)
    const isItemActive = (item) => {
        if (!item) return false;
        if (item.isArchived) return false;
        if (item.status === 'Closed' || item.status === 'Archived') return false;
        return true;
    };

    // Helper to calculate single item or sub-item value
    const getItemValue = (cat, itemId) => {
        if (!itemId || itemId === 'all') return 0;
        const validSavings = (savings || []).filter(isItemActive);

        // Money owed to you lives in `lents`, not `savings`.
        if (cat === 'lent') {
            const found = receivableLents(lents).find(l => String(l.id) === String(itemId));
            return found ? lentOutstanding(found) : 0;
        }

        // Check for sub-RD selection
        if (String(itemId).startsWith('rd_')) {
            const subId = String(itemId).replace('rd_', '');
            for (const s of validSavings) {
                if (s.type === 'recurring_deposit' && s.recurringDeposits) {
                    const found = s.recurringDeposits.find(rd => isItemActive(rd) && String(rd.id) === String(subId));
                    if (found) {
                        return (found.installments || []).reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);
                    }
                }
            }
        }

        // Check for sub-FD selection
        if (String(itemId).startsWith('fd_')) {
            const subId = String(itemId).replace('fd_', '');
            for (const s of validSavings) {
                if (s.type === 'fixed_deposit' && s.deposits) {
                    const found = s.deposits.find(fd => isItemActive(fd) && String(fd.id) === String(subId));
                    if (found) {
                        return Number(found.currentValue || found.originalAmount || 0);
                    }
                }
            }
        }

        // Standard parent item
        const foundItem = validSavings.find(s => String(s.id) === String(itemId));
        return foundItem ? calculateItemCurrentValue(foundItem) : 0;
    };

    // Helper to build list of selectable items for a category (excluding archived/closed items)
    const getSelectableItemsForCategory = (cat) => {
        const validSavings = (savings || []).filter(isItemActive);
        const options = [];

        if (cat === EMPTY_SOURCE) return options;

        if (cat === 'lent') {
            receivableLents(lents).forEach((l) => {
                options.push({
                    id: l.id,
                    title: `🎯 ${l.name || 'Unnamed'}${l.description ? ` — ${l.description.trim().split('\n')[0]}` : ''}`,
                    val: lentOutstanding(l)
                });
            });
            return options;
        }

        if (cat === 'recurring_deposit') {
            validSavings.filter(s => s.type === 'recurring_deposit').forEach(s => {
                const activeRds = (s.recurringDeposits || []).filter(isItemActive);
                if (activeRds.length > 0) {
                    activeRds.forEach(rd => {
                        const val = (rd.installments || []).reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);
                        options.push({
                            id: `rd_${rd.id}`,
                            title: `🎯 ${rd.name || 'Recurring Deposit'}`,
                            val
                        });
                    });
                } else if (isItemActive(s)) {
                    options.push({
                        id: s.id,
                        title: `🎯 ${s.title && s.title.toLowerCase() !== 'unnamed' ? s.title : 'Recurring Deposits'}`,
                        val: calculateItemCurrentValue(s)
                    });
                }
            });
        } else if (cat === 'fixed_deposit') {
            validSavings.filter(s => s.type === 'fixed_deposit').forEach(s => {
                const activeFds = (s.deposits || []).filter(isItemActive);
                if (activeFds.length > 0) {
                    activeFds.forEach(fd => {
                        const val = Number(fd.currentValue || fd.originalAmount || 0);
                        const title = `🎯 ${fd.bank || 'Fixed Deposit'} ${fd.accountNo ? '(' + fd.accountNo + ')' : ''} ${fd.remarks ? '- ' + fd.remarks : ''}`;
                        options.push({
                            id: `fd_${fd.id}`,
                            title,
                            val
                        });
                    });
                } else if (isItemActive(s)) {
                    options.push({
                        id: s.id,
                        title: `🎯 ${s.title && s.title.toLowerCase() !== 'unnamed' ? s.title : 'Fixed Deposits'}`,
                        val: calculateItemCurrentValue(s)
                    });
                }
            });
        } else {
            // General items (Mutual Funds, Stocks, Policies, PPF, PF, NPS, SGB, Emergency Fund, Gratuity)
            validSavings.filter(item => isItemActive(item) && (item.type || '').toLowerCase() === cat.toLowerCase()).forEach(item => {
                const categoryObj = CATEGORY_OPTIONS.find(c => c.value === cat);
                const categoryLabel = categoryObj ? categoryObj.label : cat.toUpperCase();
                const rawTitle = (item.title && item.title.toLowerCase() !== 'unnamed') 
                    ? item.title 
                    : (item.name || item.policyDetails?.planName);
                
                const title = rawTitle || categoryLabel;
                const val = calculateItemCurrentValue(item);
                options.push({
                    id: item.id,
                    title: `🎯 ${title}`,
                    val
                });
            });
        }

        return options;
    };

    // Calculate live estimated total from selected funding sources
    const calculateEstimatedTotal = () => {
        let total = 0;
        const validSavings = (savings || []).filter(isItemActive);

        fundingSources.forEach(src => {
            const cat = src.category || 'all_savings';
            const itemId = src.itemId;
            const manualAmt = Number(src.manualAmount || 0);

            if (cat === EMPTY_SOURCE) {
                // Contributes nothing on purpose.
            } else if (cat === 'manual') {
                total += manualAmt;
            } else if (itemId && itemId !== 'all') {
                total += getItemValue(cat, itemId);
            } else if (cat === 'lent') {
                total += totalReceivable(lents);
            } else if (cat === 'all_savings') {
                total += validSavings.reduce((sum, item) => sum + calculateItemCurrentValue(item), 0);
            } else if (cat === 'all_investments') {
                total += validSavings
                    .filter(item => item.type === 'mutual_fund' || item.type === 'stock_market')
                    .reduce((sum, item) => sum + calculateItemCurrentValue(item), 0);
            } else {
                total += validSavings
                    .filter(item => (item.type || '').toLowerCase() === cat.toLowerCase())
                    .reduce((sum, item) => sum + calculateItemCurrentValue(item), 0);
            }
        });
        return total;
    };

    const estimatedTotal = calculateEstimatedTotal();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !targetAmount || !deadline) return;

        const primarySource = fundingSources[0]?.category || 'all_savings';
        const primaryManual = fundingSources.find(s => s.category === 'manual')?.manualAmount || 0;

        const goalData = {
            id: editingGoal ? editingGoal.id : `goal_${Date.now()}`,
            name,
            targetAmount: Number(targetAmount) || 0,
            deadline,
            fundingSource: primarySource,
            manualProgress: Number(primaryManual) || 0,
            fundingSources,
            priority,
            notes,
            updatedAt: new Date().toISOString()
        };

        onSave(goalData);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: '1rem'
        }}>
            <div style={{
                backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '1.5rem', width: '100%', maxWidth: '620px',
                maxHeight: '90vh', overflowY: 'auto',
                padding: '2rem', color: 'white', position: 'relative',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Target style={{ color: '#38bdf8' }} size={24} />
                        {editingGoal ? 'Edit Financial Goal' : 'Create Financial Goal'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Goal Name *</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. House Down Payment, Vacation Fund"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{
                                width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white', outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <label style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Target Amount (₹) *</label>
                                {targetAmount > 0 && (
                                    <span style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                        {formatCurrency(targetAmount)}
                                    </span>
                                )}
                            </div>
                            <input
                                type="number"
                                required
                                placeholder="1000000"
                                value={targetAmount}
                                onChange={(e) => setTargetAmount(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Target Date *</label>
                            <input
                                type="date"
                                required
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Priority</label>
                        <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            style={{
                                width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                backgroundColor: '#27272a', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white', outline: 'none'
                            }}
                        >
                            <option value="high">High Priority</option>
                            <option value="medium">Medium Priority</option>
                            <option value="low">Low Priority</option>
                        </select>
                    </div>

                    {/* Dynamic Funding Sources Section */}
                    <div style={{
                        backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '1rem', padding: '1.25rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Layers size={16} /> Funding Sources
                                </h4>
                                <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '0.2rem' }}>Link specific mutual funds, particular RDs, FDs, or custom sources</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddSource}
                                style={{
                                    padding: '0.4rem 0.8rem', backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                    color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '0.5rem',
                                    fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem'
                                }}
                            >
                                <Plus size={16} /> Add Source
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {fundingSources.map((src, idx) => {
                                const category = src.category || 'all_savings';
                                const showsSpecificItemDropdown = [
                                    'mutual_fund', 'recurring_deposit', 'fixed_deposit', 'stock_market',
                                    'policy', 'ppf', 'pf', 'nps', 'sgb', 'gratuity', 'emergency_fund', 'lent'
                                ].includes(category);

                                const itemOptions = getSelectableItemsForCategory(category);

                                return (
                                    <div key={idx} style={{
                                        display: 'flex', flexDirection: 'column', gap: '0.5rem',
                                        padding: '0.75rem', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '0.75rem',
                                        border: '1px solid rgba(255,255,255,0.06)'
                                    }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <div style={{ flex: 1 }}>
                                                <select
                                                    value={category}
                                                    onChange={(e) => handleSourceChange(idx, 'category', e.target.value)}
                                                    style={{
                                                        width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem',
                                                        backgroundColor: '#27272a', border: '1px solid rgba(255,255,255,0.1)',
                                                        color: 'white', outline: 'none', fontSize: '0.85rem'
                                                    }}
                                                >
                                                    {CATEGORY_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {fundingSources.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSource(idx)}
                                                    style={{
                                                        padding: '0.6rem', backgroundColor: 'rgba(248, 113, 113, 0.1)',
                                                        color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.2)',
                                                        borderRadius: '0.5rem', cursor: 'pointer'
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Secondary Dropdown for Particular Items (e.g. Particular RD, Particular FD, Particular MF) */}
                                        {showsSpecificItemDropdown && (
                                            <div>
                                                <select
                                                    value={src.itemId || 'all'}
                                                    onChange={(e) => handleSourceChange(idx, 'itemId', e.target.value)}
                                                    style={{
                                                        width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem',
                                                        backgroundColor: '#1f1f23', border: '1px solid rgba(56, 189, 248, 0.3)',
                                                        color: '#38bdf8', outline: 'none', fontSize: '0.85rem'
                                                    }}
                                                >
                                                    <option value="all">
                                                        {category === 'lent' ? '⚡ Everyone who owes me' : '⚡ All Items in this Category'}
                                                    </option>
                                                    {itemOptions.map(opt => (
                                                        <option key={opt.id} value={opt.id}>
                                                            {opt.title} ({formatCurrency(opt.val)})
                                                        </option>
                                                    ))}
                                                </select>
                                                {category === 'lent' && itemOptions.length === 0 && (
                                                    <p style={{ fontSize: '0.7rem', color: '#71717a', margin: '0.4rem 0 0' }}>
                                                        Nothing outstanding — fully repaid loans and money you borrowed are not listed.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Nothing chosen yet */}
                                        {category === EMPTY_SOURCE && (
                                            <p style={{ fontSize: '0.75rem', color: '#71717a', margin: 0, lineHeight: 1.5 }}>
                                                This goal will track its target and deadline but show no progress
                                                until you link a source. Nothing is counted towards it.
                                            </p>
                                        )}

                                        {/* Manual Input Field */}
                                        {category === 'manual' && (
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                                    <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Manual Amount</span>
                                                    {src.manualAmount > 0 && (
                                                        <span style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                            {formatCurrency(src.manualAmount)}
                                                        </span>
                                                    )}
                                                </div>
                                                <input
                                                    type="number"
                                                    placeholder="Enter manual amount (₹)"
                                                    value={src.manualAmount || ''}
                                                    onChange={(e) => handleSourceChange(idx, 'manualAmount', e.target.value)}
                                                    style={{
                                                        width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem',
                                                        backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                        color: 'white', outline: 'none', fontSize: '0.85rem'
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Estimated Linked Total Badge */}
                        <div style={{
                            marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem'
                        }}>
                            <span style={{ color: '#a1a1aa' }}>Total Currently Linked</span>
                            <span style={{ color: '#34d399', fontWeight: 'bold', fontSize: '1rem' }}>{formatCurrency(estimatedTotal)}</span>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>Notes / Description</label>
                        <textarea
                            rows={2}
                            placeholder="Optional notes or milestone plans"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            style={{
                                width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem',
                                backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white', outline: 'none', resize: 'none'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                flex: 1, padding: '0.75rem', borderRadius: '0.75rem',
                                backgroundColor: 'rgba(255,255,255,0.05)', border: 'none',
                                color: '#a1a1aa', fontWeight: 'bold', cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                flex: 1, padding: '0.75rem', borderRadius: '0.75rem',
                                backgroundColor: '#38bdf8', border: 'none',
                                color: 'black', fontWeight: 'bold', cursor: 'pointer'
                            }}
                        >
                            {editingGoal ? 'Save Changes' : 'Create Goal'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GoalModal;
