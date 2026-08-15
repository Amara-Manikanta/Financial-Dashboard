import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Target, Plus, TrendingUp, Calendar, AlertCircle, Edit2, Trash2, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import GoalModal from '../components/GoalModal';
import { lentOutstanding, receivableLents, totalReceivable } from '../utils/lents';
import { GoalIconDisplay } from '../utils/goalIcons';

const FinancialGoals = () => {
    const { goals, savings, lents, addItem, updateItem, deleteItem, formatCurrency, calculateItemCurrentValue } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState(null);
    const [filterPriority, setFilterPriority] = useState('all');

    const isItemActive = (item) => {
        if (!item) return false;
        if (item.isArchived) return false;
        if (item.status === 'Closed' || item.status === 'Archived') return false;
        return true;
    };

    // Helper to compute live value of funding source
    const getFundingSourceValue = (sourceCategory, manualVal = 0) => {
        // A goal whose source has not been decided yet contributes nothing,
        // rather than silently falling through to "all savings" and claiming
        // progress it does not have.
        if (sourceCategory === 'none') return 0;
        if (sourceCategory === 'manual') return manualVal;
        if (sourceCategory === 'lent') return totalReceivable(lents);

        const validSavings = (savings || []).filter(isItemActive);

        if (sourceCategory === 'all_savings') {
            return validSavings.reduce((sum, item) => sum + calculateItemCurrentValue(item), 0);
        }
        if (sourceCategory === 'all_investments') {
            return validSavings
                .filter(item => isItemActive(item) && (item.type === 'mutual_fund' || item.type === 'stock_market'))
                .reduce((sum, item) => sum + calculateItemCurrentValue(item), 0);
        }
        
        // Single specific savings type
        return validSavings
            .filter(item => isItemActive(item) && (item.type || '').toLowerCase() === sourceCategory.toLowerCase())
            .reduce((sum, item) => sum + calculateItemCurrentValue(item), 0);
    };

    const getGoalTotalSaved = (goal) => {
        const sources = (goal.fundingSources && goal.fundingSources.length > 0)
            ? goal.fundingSources
            : [{ category: goal.fundingSource || 'all_savings', itemId: 'all', manualAmount: goal.manualProgress || 0 }];

        const validSavings = (savings || []).filter(isItemActive);
        let total = 0;

        sources.forEach(src => {
            const cat = src.category || 'all_savings';
            const itemId = src.itemId;
            const manualAmt = Number(src.manualAmount || 0);

            if (cat === 'none') {
                // Deliberately unfunded — contributes nothing.
            } else if (cat === 'manual') {
                total += manualAmt;
            } else if (cat === 'lent' && itemId && itemId !== 'all') {
                const found = receivableLents(lents).find(l => String(l.id) === String(itemId));
                if (found) total += lentOutstanding(found);
            } else if (itemId && itemId !== 'all') {
                if (String(itemId).startsWith('rd_')) {
                    const subId = String(itemId).replace('rd_', '');
                    for (const s of validSavings) {
                        if (s.type === 'recurring_deposit' && s.recurringDeposits) {
                            const found = s.recurringDeposits.find(rd => isItemActive(rd) && String(rd.id) === String(subId));
                            if (found) {
                                total += (found.installments || []).reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);
                            }
                        }
                    }
                } else if (String(itemId).startsWith('fd_')) {
                    const subId = String(itemId).replace('fd_', '');
                    for (const s of validSavings) {
                        if (s.type === 'fixed_deposit' && s.deposits) {
                            const found = s.deposits.find(fd => isItemActive(fd) && String(fd.id) === String(subId));
                            if (found) {
                                total += Number(found.currentValue || found.originalAmount || 0);
                            }
                        }
                    }
                } else {
                    const item = validSavings.find(s => isItemActive(s) && String(s.id) === String(itemId));
                    if (item) {
                        total += calculateItemCurrentValue(item);
                    }
                }
            } else {
                total += getFundingSourceValue(cat, manualAmt);
            }
        });

        return total;
    };

    const handleSaveGoal = async (goalData) => {
        if (editingGoal) {
            await updateItem('goals', goalData);
        } else {
            await addItem('goals', goalData);
        }
        setIsModalOpen(false);
        setEditingGoal(null);
    };

    const handleEdit = (goal) => {
        setEditingGoal(goal);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this goal?')) {
            await deleteItem('goals', id);
        }
    };

    // Calculate aggregated metrics
    const goalList = goals || [];
    const totalGoals = goalList.length;
    const totalTargetAmount = goalList.reduce((sum, g) => sum + (Number(g.targetAmount) || 0), 0);
    
    let totalAchievedAmount = 0;
    const processedGoals = goalList.map(goal => {
        const currentSaved = getGoalTotalSaved(goal);
        totalAchievedAmount += Math.min(currentSaved, goal.targetAmount);
        
        const progressPct = goal.targetAmount > 0 
            ? Math.min(100, Math.round((currentSaved / goal.targetAmount) * 100))
            : 0;

        const targetDate = new Date(goal.deadline);
        const today = new Date();
        const diffTime = targetDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let status = 'on_track';
        if (progressPct >= 100) {
            status = 'completed';
        } else if (diffDays < 0) {
            status = 'overdue';
        } else if (progressPct < 30 && diffDays < 90) {
            status = 'behind';
        }

        return {
            ...goal,
            currentSaved,
            progressPct,
            diffDays,
            status
        };
    });

    const filteredGoals = processedGoals.filter(g => 
        filterPriority === 'all' ? true : g.priority === filterPriority
    );

    const overallProgress = totalTargetAmount > 0 
        ? Math.round((totalAchievedAmount / totalTargetAmount) * 100) 
        : 0;

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Target style={{ color: '#38bdf8' }} size={32} />
                        Financial Goals
                    </h1>
                    <p style={{ color: '#a1a1aa', marginTop: '0.5rem' }}>Set milestones and track progress linked to live savings & investments</p>
                </div>
                <button
                    onClick={() => { setEditingGoal(null); setIsModalOpen(true); }}
                    style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#38bdf8',
                        color: 'black',
                        border: 'none',
                        borderRadius: '0.75rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 4px 12px rgba(56, 189, 248, 0.25)'
                    }}
                >
                    <Plus size={20} /> Create Goal
                </button>
            </div>

            {/* Top Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '1.25rem', padding: '1.25rem', backdropFilter: 'blur(10px)'
                }}>
                    <p style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase' }}>Active Goals</p>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', marginTop: '0.5rem' }}>{totalGoals}</h3>
                </div>

                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '1.25rem', padding: '1.25rem', backdropFilter: 'blur(10px)'
                }}>
                    <p style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase' }}>Total Goal Target</p>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#38bdf8', marginTop: '0.5rem' }}>{formatCurrency(totalTargetAmount)}</h3>
                </div>

                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '1.25rem', padding: '1.25rem', backdropFilter: 'blur(10px)'
                }}>
                    <p style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase' }}>Achieved So Far</p>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#34d399', marginTop: '0.5rem' }}>{formatCurrency(totalAchievedAmount)}</h3>
                </div>

                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '1.25rem', padding: '1.25rem', backdropFilter: 'blur(10px)'
                }}>
                    <p style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase' }}>Overall Progress</p>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#fbbf24', marginTop: '0.5rem' }}>{overallProgress}%</h3>
                </div>
            </div>

            {/* Filter Priority Tabs */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {['all', 'high', 'medium', 'low'].map(p => (
                    <button
                        key={p}
                        onClick={() => setFilterPriority(p)}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none',
                            backgroundColor: filterPriority === p ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)',
                            color: filterPriority === p ? '#38bdf8' : '#a1a1aa',
                            fontWeight: '600', cursor: 'pointer', textTransform: 'capitalize', fontSize: '0.85rem'
                        }}
                    >
                        {p === 'all' ? 'All Priorities' : `${p} Priority`}
                    </button>
                ))}
            </div>

            {/* Goals Cards Grid */}
            {filteredGoals.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'rgba(24, 24, 27, 0.4)',
                    borderRadius: '1.5rem', border: '1px dashed rgba(255,255,255,0.1)'
                }}>
                    <Target size={48} style={{ color: '#52525b', margin: '0 auto 1rem auto' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>No Financial Goals Found</h3>
                    <p style={{ color: '#71717a', marginTop: '0.5rem' }}>Click "Create Goal" above to start setting your financial targets.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
                    {filteredGoals.map(goal => {
                        const getStatusBadge = () => {
                            if (goal.status === 'completed') {
                                return { text: 'Achieved', color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)' };
                            }
                            if (goal.status === 'overdue') {
                                return { text: 'Overdue', color: '#f87171', bg: 'rgba(248, 113, 113, 0.1)' };
                            }
                            if (goal.status === 'behind') {
                                return { text: 'Action Needed', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' };
                            }
                            return { text: 'On Track', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)' };
                        };

                        const badge = getStatusBadge();

                        return (
                            <div
                                key={goal.id}
                                style={{
                                    backgroundColor: 'rgba(24, 24, 27, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '1.5rem', padding: '1.5rem', display: 'flex', flexDirection: 'column',
                                    justifyContent: 'space-between', backdropFilter: 'blur(10px)',
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', position: 'relative'
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <span style={{
                                                fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.6rem',
                                                borderRadius: '0.5rem', backgroundColor: badge.bg, color: badge.color,
                                                textTransform: 'uppercase', letterSpacing: '0.05em'
                                            }}>
                                                {badge.text}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                                                <div style={{
                                                    width: '42px', height: '42px', borderRadius: '0.85rem',
                                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                                }}>
                                                    <GoalIconDisplay iconId={goal.icon || (goal.name?.toLowerCase().includes('education') || goal.name?.toLowerCase().includes('study') || goal.name?.toLowerCase().includes('college') || goal.name?.toLowerCase().includes('degree') ? 'education' : (goal.name?.toLowerCase().includes('wedding') || goal.name?.toLowerCase().includes('marriage') || goal.name?.toLowerCase().includes('anniversary') ? 'wedding' : (goal.name?.toLowerCase().includes('travel') || goal.name?.toLowerCase().includes('vacation') || goal.name?.toLowerCase().includes('trip') || goal.name?.toLowerCase().includes('holiday') ? 'travel' : (goal.name?.toLowerCase().includes('car') || goal.name?.toLowerCase().includes('vehicle') || goal.name?.toLowerCase().includes('bike') ? 'car' : (goal.name?.toLowerCase().includes('emergenc') || goal.name?.toLowerCase().includes('medical') ? 'emergency' : (goal.name?.toLowerCase().includes('retire') ? 'retirement' : (goal.name?.toLowerCase().includes('invest') || goal.name?.toLowerCase().includes('wealth') ? 'investments' : (goal.name?.toLowerCase().includes('house') || goal.name?.toLowerCase().includes('home') ? 'home_3d' : 'Target'))))))))} size={26} />
                                                </div>
                                                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', margin: 0 }}>{goal.name}</h3>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => handleEdit(goal)}
                                                style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '0.25rem' }}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(goal.id)}
                                                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.25rem' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div style={{ marginBottom: '1.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                            <span style={{ color: '#a1a1aa' }}>Progress ({goal.progressPct}%)</span>
                                            <span style={{ color: 'white', fontWeight: 'bold' }}>{formatCurrency(goal.currentSaved)}</span>
                                        </div>
                                        <div style={{
                                            height: '10px', backgroundColor: 'rgba(255,255,255,0.08)',
                                            borderRadius: '5px', overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                height: '100%', width: `${goal.progressPct}%`,
                                                backgroundColor: goal.progressPct >= 100 ? '#34d399' : '#38bdf8',
                                                borderRadius: '5px', transition: 'width 0.4s ease'
                                            }} />
                                        </div>
                                    </div>

                                    {/* Amounts & Source */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '0.75rem', marginBottom: '1rem' }}>
                                        <div>
                                            <span style={{ color: '#71717a', fontSize: '0.75rem', display: 'block' }}>Target Amount</span>
                                            <span style={{ color: 'white', fontWeight: 'bold' }}>{formatCurrency(goal.targetAmount)}</span>
                                        </div>
                                        <div>
                                            <span style={{ color: '#71717a', fontSize: '0.75rem', display: 'block' }}>Remaining</span>
                                            <span style={{ color: '#f87171', fontWeight: 'bold' }}>
                                                {formatCurrency(Math.max(0, goal.targetAmount - goal.currentSaved))}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#a1a1aa', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                            <Calendar size={14} />
                                            {goal.diffDays < 0 ? `${Math.abs(goal.diffDays)} days ago` : `${goal.diffDays} days left`}
                                        </span>
                                        <span style={{ textTransform: 'capitalize', color: '#38bdf8', fontWeight: '500' }}>
                                            Source: {(() => {
                                                const srcs = goal.fundingSources || [];
                                                if (srcs.length > 1) return `${srcs.length} Linked Sources`;
                                                const cat = srcs[0]?.category || goal.fundingSource || 'all_savings';
                                                // Spelled out rather than shown as "none", which reads like an error.
                                                if (cat === 'none') return 'not linked yet';
                                                if (cat === 'lent') return 'money lent out';
                                                return cat.replace(/_/g, ' ');
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            <GoalModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveGoal}
                editingGoal={editingGoal}
            />
        </div>
    );
};

export default FinancialGoals;
