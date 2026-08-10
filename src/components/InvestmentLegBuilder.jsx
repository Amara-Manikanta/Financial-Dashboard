import React, { useMemo } from 'react';
import { Plus, Trash2, TrendingUp, AlertTriangle, Link2 } from 'lucide-react';
import {
    investableAssets,
    actionsFor,
    suggestAsset,
    validateLegs,
    candidateTransactions,
    legFromTransaction,
    describeTransaction
} from '../utils/investmentSync';

/**
 * Maps one expense row onto the holdings it actually funded.
 *
 * A single debit is frequently several investments — in this database a ₹200
 * row is ₹100 into one index fund and ₹100 into another — so this edits a list
 * of legs rather than one asset. The fields mirror the ones on the mutual fund
 * and stock transaction modals, so a transaction logged here is indistinguishable
 * from one logged on the investment page itself.
 */
const InvestmentLegBuilder = ({ legs, onChange, savings, expenseAmount, title, expenseDate }) => {
    const assets = useMemo(() => investableAssets(savings), [savings]);
    const funds = useMemo(() => assets.filter(a => a.assetType === 'mutual_fund'), [assets]);
    const stocks = useMemo(() => assets.filter(a => a.assetType === 'stock'), [assets]);

    const errors = useMemo(() => validateLegs(legs, expenseAmount), [legs, expenseAmount]);
    const legTotal = legs.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

    const patchLeg = (index, changes) => {
        onChange(legs.map((leg, i) => {
            if (i !== index) return leg;
            const next = { ...leg, ...changes };

            // Units follow from amount and NAV, exactly as the fund modal does,
            // but stay editable because the AMC's own figure is authoritative.
            if (next.assetType === 'mutual_fund' && !('units' in changes)) {
                const amt = Number(next.amount);
                const nav = Number(next.nav);
                if (amt > 0 && nav > 0) next.units = Number((amt / nav).toFixed(3));
            }
            // Same for a stock: quantity x price is the amount that left the bank.
            if (next.assetType === 'stock' && next.action !== 'dividend' && !('amount' in changes)) {
                const q = Number(next.quantity);
                const p = Number(next.price);
                if (q > 0 && p > 0) next.amount = Number((q * p).toFixed(2));
            }
            return next;
        }));
    };

    const addLeg = () => {
        // Only the first leg guesses, and only from the title. With several legs
        // the amounts are split, so a guess would be wrong more often than right.
        const guess = legs.length === 0 ? suggestAsset(title, assets) : null;
        const remaining = Math.max(0, (Number(expenseAmount) || 0) - legTotal);
        onChange([...legs, {
            assetType: guess?.assetType || 'mutual_fund',
            assetId: guess?.assetId || '',
            action: (guess?.assetType === 'stock') ? 'buy' : 'sip',
            amount: legs.length === 0 ? (Number(expenseAmount) || '') : (remaining || ''),
            nav: guess?.currentNav || '',
            units: '',
            quantity: '',
            price: guess?.currentPrice || '',
            remarks: ''
        }]);
    };

    const removeLeg = (index) => onChange(legs.filter((_, i) => i !== index));

    const labelCls = 'block text-[9px] font-black text-zinc-500 uppercase tracking-wider mb-1.5';
    const fieldCls = 'w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50';

    return (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                        Link to holdings
                    </span>
                </div>
                <button
                    type="button"
                    onClick={addLeg}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25"
                >
                    <Plus className="w-3 h-3" /> {legs.length ? 'Split further' : 'Add holding'}
                </button>
            </div>

            {legs.length === 0 && (
                <p className="text-[11px] leading-relaxed text-zinc-400">
                    Optional. Add a holding and this transaction is recorded on the
                    investment page too — no need to enter it twice. Split it if one
                    payment covered several funds.
                </p>
            )}

            {legs.map((leg, index) => {
                const isStock = leg.assetType === 'stock';
                const list = isStock ? stocks : funds;
                // Unlinked transactions already on this holding around the
                // expense date — the ones this expense is probably paying for.
                const matches = candidateTransactions(savings, leg.assetType, leg.assetId, expenseDate);
                const matchedIndex = (() => {
                    const at = matches.findIndex((t) => {
                        const f = legFromTransaction(t, leg.assetType);
                        return isStock
                            ? Number(f.quantity) === Number(leg.quantity) && Number(f.price) === Number(leg.price)
                            : Number(f.units) === Number(leg.units) && Number(f.nav) === Number(leg.nav);
                    });
                    return at === -1 ? 'new' : at;
                })();
                return (
                    <div key={index} className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                                {legs.length > 1 ? `Leg ${index + 1}` : 'Holding'}
                            </span>
                            <button
                                type="button"
                                onClick={() => removeLeg(index)}
                                className="text-zinc-500 hover:text-red-400"
                                aria-label={`Remove leg ${index + 1}`}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label className={labelCls}>Kind</label>
                                <select
                                    value={leg.assetType}
                                    onChange={(e) => patchLeg(index, {
                                        assetType: e.target.value,
                                        assetId: '',
                                        action: e.target.value === 'stock' ? 'buy' : 'sip'
                                    })}
                                    className={fieldCls}
                                >
                                    <option value="mutual_fund">Mutual Fund</option>
                                    <option value="stock">Stock</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Type</label>
                                <select
                                    value={leg.action}
                                    onChange={(e) => patchLeg(index, { action: e.target.value })}
                                    className={fieldCls}
                                >
                                    {actionsFor(leg.assetType).map(a => (
                                        <option key={a.value} value={a.value}>{a.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>{isStock ? 'Stock' : 'Fund'}</label>
                            <select
                                value={leg.assetId}
                                onChange={(e) => {
                                    const assetId = e.target.value;
                                    const picked = list.find(a => a.assetId === assetId);
                                    // If the holding already records this purchase, fill the leg
                                    // from it. That figure is the accurate one, and matching it
                                    // exactly is what lets the sync adopt the existing row
                                    // instead of creating a duplicate.
                                    const existing = candidateTransactions(savings, leg.assetType, assetId, expenseDate)[0];
                                    patchLeg(index, {
                                        assetId,
                                        ...(existing
                                            ? legFromTransaction(existing, leg.assetType)
                                            : {
                                                ...(picked && !leg.nav && picked.currentNav ? { nav: picked.currentNav } : {}),
                                                ...(picked && !leg.price && picked.currentPrice ? { price: picked.currentPrice } : {})
                                            })
                                    });
                                }}
                                className={fieldCls}
                            >
                                <option value="">Select {isStock ? 'a stock' : 'a fund'}…</option>
                                {list.map(a => (
                                    <option key={a.assetId} value={a.assetId}>
                                        {a.name}{a.ticker ? ` (${a.ticker})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {matches.length > 0 && (
                            <div>
                                <label className={labelCls}>Existing transaction</label>
                                <select
                                    value={matchedIndex}
                                    onChange={(e) => {
                                        const at = e.target.value;
                                        if (at === 'new') {
                                            patchLeg(index, { amount: Number(expenseAmount) || '', units: '', quantity: '' });
                                            return;
                                        }
                                        patchLeg(index, legFromTransaction(matches[Number(at)], leg.assetType));
                                    }}
                                    className={fieldCls}
                                >
                                    {matches.map((t, i) => (
                                        <option key={t.id || i} value={i}>{describeTransaction(t, leg.assetType)}</option>
                                    ))}
                                    <option value="new">Not one of these — record a new one</option>
                                </select>
                                <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-emerald-400/80">
                                    <Link2 className="h-3 w-3 shrink-0" />
                                    {matchedIndex === 'new'
                                        ? 'A new transaction will be added to this holding.'
                                        : 'Links to the transaction already on this holding — nothing is duplicated.'}
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-2.5">
                            <div>
                                <label className={labelCls}>Amount</label>
                                <input
                                    type="number" step="0.01" value={leg.amount}
                                    onChange={(e) => patchLeg(index, { amount: e.target.value })}
                                    className={fieldCls} placeholder="0.00"
                                />
                            </div>

                            {isStock && leg.action !== 'dividend' && (
                                <>
                                    <div>
                                        <label className={labelCls}>Quantity</label>
                                        <input
                                            type="number" step="0.001" value={leg.quantity}
                                            onChange={(e) => patchLeg(index, { quantity: e.target.value })}
                                            className={fieldCls} placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Price</label>
                                        <input
                                            type="number" step="0.01" value={leg.price}
                                            onChange={(e) => patchLeg(index, { price: e.target.value })}
                                            className={fieldCls} placeholder="0.00"
                                        />
                                    </div>
                                </>
                            )}

                            {!isStock && (
                                <>
                                    <div>
                                        <label className={labelCls}>NAV</label>
                                        <input
                                            type="number" step="0.0001" value={leg.nav}
                                            onChange={(e) => patchLeg(index, { nav: e.target.value })}
                                            className={fieldCls} placeholder="NAV"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Units</label>
                                        <input
                                            type="number" step="0.001" value={leg.units}
                                            onChange={(e) => patchLeg(index, { units: e.target.value })}
                                            className={fieldCls} placeholder="auto"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            })}

            {legs.length > 1 && (
                <div className="flex items-center justify-between px-1 text-[11px]">
                    <span className="text-zinc-500">Legs total</span>
                    <span className={`font-mono font-bold ${
                        Math.abs(legTotal - (Number(expenseAmount) || 0)) > 1 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                        ₹{legTotal.toLocaleString('en-IN')} / ₹{(Number(expenseAmount) || 0).toLocaleString('en-IN')}
                    </span>
                </div>
            )}

            {errors.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                    {errors.map((err, i) => (
                        <p key={i} className="flex items-start gap-1.5 text-[11px] text-amber-300">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {err}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
};

export default InvestmentLegBuilder;
