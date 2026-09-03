import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Edit2, Trash2, Plus, TrendingUp, TrendingDown, MapPin, Calendar, Briefcase, Info, Home, User, TrendingUp as Arrow } from 'lucide-react';
import AssetTransactionModal from '../components/AssetTransactionModal';
import AssetItemModal from '../components/AssetItemModal';
import BackButton from '../components/BackButton';
import { formatDate } from '../utils/dateUtils';
import {
    ENTRY_KINDS, kindOf, summariseRental, rentLedger, billLedger, expectedRentOn, formatPeriod,
    BORNE_BY, asksWhoPays, borneBy, netCost,
} from '../utils/rental';
import WarrantyPanel from '../components/WarrantyPanel';
import PropertyUnitModal from '../components/PropertyUnitModal';
import {
    hasUnits, summariseProperty, applyUnit, allUnits, MAIN_UNIT_ID,
} from '../utils/propertyUnits';

const AssetItemDetails = () => {
    const { categoryId, itemId } = useParams();
    const navigate = useNavigate();
    const { assets, formatCurrency, updateItem } = useFinance();
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    // Every hook runs before the two early returns below.
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState(null);
    const [selectedUnitId, setSelectedUnitId] = useState(null);

    // Ids may be stored as numbers (Date.now()) but URL params are always
    // strings, so these must be compared loosely or the item never resolves.
    const category = assets.find(a => String(a.id) === String(categoryId));
    if (!category) {
        return <div className="p-8 text-center bg-modal m-10 rounded-3xl">Category not found</div>;
    }

    const item = category.items.find(i => String(i.id) === String(itemId));
    if (!item) {
        return <div className="p-8 text-center bg-modal m-10 rounded-3xl">Asset item not found</div>;
    }

    const isRealEstate = category.type === 'real_estate';
    const usesUnits = hasUnits(item);
    const property = usesUnits ? summariseProperty(item) : null;

    /**
     * Which tenancy the page is currently showing.
     *
     * With units, selecting one narrows the whole lower half of the page to it;
     * selecting nothing shows the building's own entries — the roof, the tax on
     * the structure — which belong to no single unit.
     */
    const activeUnit = usesUnits
        ? (allUnits(item).find((u) => String(u.id) === String(selectedUnitId)) || null)
        : null;

    // The main unit's entries ARE item.transactions, so both branches agree
    // when it is selected — nothing has to move for that to be true.
    const transactions = activeUnit ? (activeUnit.transactions || []) : (item.transactions || []);
    const rental = activeUnit ? activeUnit.rental : item.rental;
    const summary = summariseRental(transactions);

    // Yield deliberately excludes a refundable deposit: it is money held on the
    // tenant's behalf, not a return on the asset.
    /**
     * The headline figures: the whole property until a unit is chosen.
     *
     * These used to read only `item.transactions`, which on a property tracked
     * by units is just the building's own costs — so a house with three shops
     * let showed a total yield of ₹0 while the units below it plainly said
     * otherwise.
     */
    const showingWholeProperty = usesUnits && !activeUnit;
    const totalIncome = showingWholeProperty ? property.income : summary.income;
    const totalExpenses = showingWholeProperty ? property.expense : summary.expense;
    const headlineDeposit = showingWholeProperty ? property.depositHeld : summary.depositHeld;

    const categoryTitle = category.title || category.category || category.name
        || category.type?.replace('_', ' ') || 'Assets';
    const ledger = rental ? rentLedger(rental, transactions) : [];
    const bills = isRealEstate ? billLedger(transactions) : [];
    const arrears = ledger.reduce((sum, r) => sum + r.shortfall, 0);
    const currentRent = rental ? expectedRentOn(rental, new Date().toISOString().slice(0, 10)) : 0;

    /**
     * Compared as strings, like the lookup above.
     *
     * 15 of 25 asset items carry a numeric id from Date.now(), and a URL param
     * is always a string, so `i.id === itemId` matched nothing on those items:
     * `map` returned the array unchanged and the save wrote the collection back
     * exactly as it was. It looked like a success — no error, no banner — and
     * the change was simply gone on the next load. Uploading a receipt for the
     * Aquaguard put the file on disk twice and recorded neither.
     */
    const handleSaveAsset = async (updatedData) => {
        const updatedItems = category.items.map(i => (String(i.id) === String(itemId) ? updatedData : i));
        await updateItem('asset', { ...category, items: updatedItems });
    };

    const handleDeleteAsset = async () => {
        if (window.confirm('Delete this entire asset and all its transaction history?')) {
            // Same trap: with a numeric id this filtered nothing out, so the
            // delete quietly did nothing at all.
            const updatedItems = category.items.filter(i => String(i.id) !== String(itemId));
            await updateItem('asset', { ...category, items: updatedItems });
            navigate(`/assets/${categoryId}`);
        }
    };

    /** Save an item back into its category, preserving everything else. */
    const persistItem = async (updatedItem) => {
        const updatedItems = category.items.map((i) => (String(i.id) === String(itemId) ? updatedItem : i));
        await updateItem('asset', { ...category, items: updatedItems });
    };

    /**
     * A property let as a whole keeps its tenancy exactly where it is; adding a
     * second unit simply appends. Nothing is migrated, so no write here removes
     * a key — which is what the write guard refused when this did move data.
     */
    const handleSaveUnit = async (unitData) => {
        await persistItem(applyUnit(item, unitData));
        setIsUnitModalOpen(false);
        setEditingUnit(null);
    };

    const handleDeleteUnit = async (unit) => {
        if (unit.id === MAIN_UNIT_ID) {
            window.alert('This tenancy is stored on the property itself. Remove it by editing the property and unticking “let out”.');
            return;
        }
        const count = (unit.transactions || []).length;
        const warning = count > 0
            ? `Delete “${unit.name}” and its ${count} recorded entr${count === 1 ? 'y' : 'ies'}? This cannot be undone.`
            : `Delete “${unit.name}”?`;
        if (!window.confirm(warning)) return;
        await persistItem({ ...item, units: (item.units || []).filter((u) => String(u.id) !== String(unit.id)) });
        if (String(selectedUnitId) === String(unit.id)) setSelectedUnitId(null);
        setIsUnitModalOpen(false);
        setEditingUnit(null);
    };

    /** Add or replace an entry in whichever tenancy holds it. */
    const withEntry = (base, targetId, entry, mode) => {
        const target = targetId
            ? allUnits(base).find((u) => String(u.id) === String(targetId))
            : null;
        const current = target ? (target.transactions || []) : (base.transactions || []);
        const next = mode === 'replace'
            ? current.map((t) => (t.id === entry.id ? entry : t))
            : [...current, entry];
        return target
            ? applyUnit(base, { ...target, transactions: next })
            : { ...base, transactions: next };
    };

    /** Drop an entry id from whichever tenancy currently holds it. */
    const withoutEntry = (base, sourceId, entryId) => {
        const source = sourceId
            ? allUnits(base).find((u) => String(u.id) === String(sourceId))
            : null;
        const current = source ? (source.transactions || []) : (base.transactions || []);
        const next = current.filter((t) => t.id !== entryId);
        return source
            ? applyUnit(base, { ...source, transactions: next })
            : { ...base, transactions: next };
    };

    const handleSaveTx = async (txData, targetUnitId) => {
        // Undefined means the form had no unit picker (a property without
        // units), so the entry goes wherever the page is already pointed.
        const target = targetUnitId === undefined
            ? (activeUnit ? activeUnit.id : '')
            : targetUnitId;
        const from = activeUnit ? activeUnit.id : '';

        let next;
        if (editingTx && String(from) !== String(target)) {
            // Moved to a different unit. Removing before adding matters: doing
            // it the other way round on the same target would delete the row
            // that was just written.
            next = withEntry(withoutEntry(item, from, txData.id), target, txData, 'add');
        } else {
            next = withEntry(item, target, txData, editingTx ? 'replace' : 'add');
        }

        await persistItem(next);
        // Follow the entry, so a row saved against another unit is visible
        // rather than appearing to have vanished.
        if (usesUnits) setSelectedUnitId(target || null);
        setIsTxModalOpen(false);
        setEditingTx(null);
    };

    const handleDeleteTx = async (txId) => {
        if (window.confirm('Delete this transaction?')) {
            const updatedTransactions = transactions.filter(t => t.id !== txId);
            // Same rule as saving: the entry is removed from whichever tenancy
            // is on screen, not always from the building.
            const updatedItem = activeUnit
                ? applyUnit(item, { ...activeUnit, transactions: updatedTransactions })
                : { ...item, transactions: updatedTransactions };
            await persistItem(updatedItem);
        }
    };

    return (
        <div className="animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
                <div>
                    <BackButton label={`Back to ${categoryTitle}`} to={`/assets/${categoryId}`} />
                    <div className="flex items-center gap-4">
                        <div className="p-4 rounded-3xl bg-indigo-500/10 border border-indigo-500/20">
                            <Briefcase className="text-indigo-400" size={32} />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black tracking-tight">{item.name}</h2>
                            <div className="flex items-center gap-4 mt-2">
                                <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    <Calendar size={12} className="text-gray-600" />
                                    {formatDate(item.purchaseDate)}
                                </span>
                                {item.place && (
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                        <MapPin size={12} className="text-gray-600" />
                                        {item.place}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsAssetModalOpen(true)}
                        className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all group"
                        title="Edit Asset Details"
                    >
                        <Edit2 size={20} className="group-hover:text-blue-400 transition-colors" />
                    </button>
                    <button
                        onClick={handleDeleteAsset}
                        className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                        title="Delete Asset"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="card group relative overflow-hidden">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 relative z-10">Current Valuation</p>
                    <p className="text-3xl font-black text-emerald-400 tracking-tight relative z-10">{formatCurrency(item.currentValue || 0)}</p>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-[0.03] group-hover:opacity-[0.05] transition-opacity bg-emerald-500" />
                </div>
                <div className="card group relative overflow-hidden">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 relative z-10">
                        Total Yield (Income){headlineDeposit > 0 ? ' · excl. deposit' : ''}
                        {usesUnits && (
                            <span className="text-gray-600 normal-case tracking-normal font-bold">
                                {' · '}{activeUnit ? activeUnit.name : 'all units'}
                            </span>
                        )}
                    </p>
                    <p className="text-3xl font-black text-blue-400 tracking-tight relative z-10 flex items-center gap-2">
                        {formatCurrency(totalIncome)}
                        <TrendingUp size={24} className="opacity-20" />
                    </p>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-[0.03] group-hover:opacity-[0.05] transition-opacity bg-blue-500" />
                </div>
                <div className="card group relative overflow-hidden">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 relative z-10">
                        Maintenance (Expenses)
                        {usesUnits && (
                            <span className="text-gray-600 normal-case tracking-normal font-bold">
                                {' · '}{activeUnit ? activeUnit.name : 'all units'}
                            </span>
                        )}
                    </p>
                    <p className="text-3xl font-black text-red-400 tracking-tight relative z-10 flex items-center gap-2">
                        {formatCurrency(totalExpenses)}
                        <TrendingDown size={24} className="opacity-20" />
                    </p>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-[0.03] group-hover:opacity-[0.05] transition-opacity bg-red-500" />
                </div>
            </div>

            {/* Land has no warranty; goods do. */}
            {!isRealEstate && (
                <div className="mb-10">
                    <WarrantyPanel item={item} onSave={handleSaveAsset} formatCurrency={formatCurrency} />
                </div>
            )}

            {/* Units. A building can hold several tenancies and a part you live
                in yourself; a single `rental` block cannot describe that. */}
            {isRealEstate && (
                <div className="mb-10 card border border-white/5">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                        <div>
                            <h3 className="text-lg font-black text-white tracking-tight">Units</h3>
                            <p className="text-xs text-gray-500 mt-1 max-w-[62ch] leading-relaxed">
                                {usesUnits
                                    ? 'Each part of this property with its own tenant, rent and entries. The part you occupy is listed too — it earns nothing by design, which is not the same as sitting empty.'
                                    : item.rental
                                        ? 'This property is let as a whole. Add a unit and the existing tenancy stays exactly where it is, listed alongside the new one — nothing is moved or rewritten. Useful when a building has shops below and a floor you live in.'
                                        : 'Split this property into separately let parts — three shops and a floor, say — each with its own tenant, rent and ledger. The part you live in is a unit too.'}
                            </p>
                        </div>
                        <button
                            onClick={() => { setEditingUnit(null); setIsUnitModalOpen(true); }}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-emerald-700 flex items-center gap-2 shrink-0"
                        >
                            <Plus size={14} /> {usesUnits ? 'Add unit' : 'Split into units'}
                        </button>
                    </div>

                    {usesUnits && (
                        <>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                                {[
                                    { label: 'Rent roll', value: formatCurrency(property.monthlyRentRoll), note: 'per month, at current rents', color: '#10b981' },
                                    {
                                        label: 'Occupancy',
                                        value: property.occupancyPct === null ? '—' : `${property.occupancyPct.toFixed(0)}%`,
                                        // Counted over lettable units only — including the
                                        // part you live in would report a fully tenanted
                                        // building as 75% let.
                                        note: `${property.counts.let} let of ${property.counts.lettable} lettable`,
                                        color: property.counts.vacant > 0 ? '#fbbf24' : '#10b981',
                                    },
                                    { label: 'Rent received', value: formatCurrency(property.rentReceived), note: 'all units, all time', color: '#10b981' },
                                    { label: 'Arrears', value: formatCurrency(property.arrears), note: 'across let units', color: property.arrears > 0 ? '#ef4444' : '#10b981' },
                                    { label: 'Deposits held', value: formatCurrency(property.depositHeld), note: 'Refundable', color: '#6366f1' },
                                ].map((tile) => (
                                    <div key={tile.label} className="bg-black/30 rounded-2xl p-4 border border-white/5">
                                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1.5">{tile.label}</p>
                                        <p className="text-lg font-black tracking-tight" style={{ color: tile.color }}>{tile.value}</p>
                                        <p className="text-[9px] text-gray-600 mt-0.5">{tile.note}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {property.units.map((u) => {
                                    const selected = String(selectedUnitId) === String(u.unit.id);
                                    const sm = u.statusMeta;
                                    return (
                                        <div
                                            key={u.unit.id}
                                            onClick={() => setSelectedUnitId(selected ? null : u.unit.id)}
                                            className="rounded-2xl p-4 border cursor-pointer transition-all"
                                            style={{
                                                backgroundColor: selected ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)',
                                                borderColor: selected ? sm.color : 'rgba(255,255,255,0.06)',
                                            }}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-white truncate">
                                                        {u.typeMeta.icon} {u.unit.name}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                                                        {u.unit.rental?.tenantName || (u.status === 'self_occupied' ? 'You' : 'No tenant recorded')}
                                                    </p>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0"
                                                    style={{ backgroundColor: sm.bg, border: `1px solid ${sm.border}`, color: sm.color }}>
                                                    {sm.label}
                                                </span>
                                            </div>

                                            <div className="flex items-end justify-between mt-3">
                                                <div>
                                                    <p className="text-base font-black text-white font-mono">
                                                        {u.status === 'let' ? `${formatCurrency(u.currentRent)}` : '—'}
                                                    </p>
                                                    <p className="text-[9px] text-gray-600">
                                                        {u.status === 'let' ? 'per month' : u.status === 'vacant' ? 'not let' : 'no rent by design'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    {u.arrears > 0 && (
                                                        <p className="text-[10px] font-black text-red-400">
                                                            {formatCurrency(u.arrears)} behind
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-2 justify-end">
                                                        {/* Two different actions, and they were easy to
                                                            confuse: the card opens the unit's ledger,
                                                            Edit changes its tenant and rent. */}
                                                        <span className="text-[10px] font-black uppercase tracking-widest"
                                                            style={{ color: selected ? sm.color : '#52525b' }}>
                                                            {selected ? 'Showing' : 'Open'}
                                                        </span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingUnit(u.unit); setIsUnitModalOpen(true); }}
                                                            className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest"
                                                        >
                                                            Edit
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <p className="text-[11px] text-gray-600 mt-4">
                                {activeUnit
                                    ? `Showing ${activeUnit.name} below. Entries you add go to this unit.`
                                    : 'Select a unit to see its rent ledger and entries. With none selected, everything below is the building itself — property tax, structural repairs.'}
                            </p>
                        </>
                    )}
                </div>
            )}

            {rental && (
                <div className="mb-10 space-y-6">
                    <div className="card border border-emerald-500/20 bg-emerald-500/[0.03]">
                        <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                                    <Home className="text-emerald-400" size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white tracking-tight">
                                        {/* The unit's name when one is selected.
                                            It fell back to the property name,
                                            so every unit's panel was headed
                                            with the building and there was no
                                            sign of which one you were editing. */}
                                        {activeUnit ? activeUnit.name : (rental.unitName || item.name)}
                                    </h3>
                                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                                        <User size={11} />
                                        {rental.tenantName || 'No tenant recorded'}
                                        {rental.rentDueDay ? ` · due on the ${rental.rentDueDay}` : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Rent now</p>
                                <p className="text-3xl font-black text-emerald-400 tracking-tight">
                                    {formatCurrency(currentRent)}
                                </p>
                                {currentRent > (Number(rental.monthlyRent) || 0) && (
                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                        started at {formatCurrency(rental.monthlyRent)}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            {[
                                { label: 'Rent received', value: summary.rentReceived, color: '#10b981' },
                                { label: 'Advance held', value: summary.depositHeld, color: '#6366f1', note: 'Refundable' },
                                {
                                    label: 'Current bills',
                                    // What the bills left you carrying, not what
                                    // was billed — on a let shop the meter is in
                                    // the owner's name and the money comes back.
                                    value: summary.billsBorne,
                                    color: '#f59e0b',
                                    note: summary.billsRecovered > 0
                                        ? `${formatCurrency(summary.billsPaid)} billed, ${formatCurrency(summary.billsRecovered)} recovered`
                                        : undefined,
                                },
                                { label: 'Property tax', value: summary.taxPaid, color: '#ef4444' },
                                { label: 'Arrears', value: arrears, color: arrears > 0 ? '#ef4444' : '#10b981' },
                            ].map((tile) => (
                                <div key={tile.label} className="bg-black/30 rounded-2xl p-4 border border-white/5">
                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1.5">
                                        {tile.label}
                                    </p>
                                    <p className="text-lg font-black tracking-tight" style={{ color: tile.color }}>
                                        {formatCurrency(tile.value)}
                                    </p>
                                    {tile.note && <p className="text-[9px] text-gray-600 mt-0.5">{tile.note}</p>}
                                </div>
                            ))}
                        </div>

                        {(rental.escalationValue > 0 || rental.leaseStart || rental.rules) && (
                            <div className="mt-6 pt-5 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                                {rental.escalationValue > 0 && (
                                    <div>
                                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Increment</p>
                                        <p className="text-gray-300 font-bold flex items-center gap-1.5">
                                            <Arrow size={12} className="text-emerald-400" />
                                            {rental.escalationType === 'fixed'
                                                ? `${formatCurrency(rental.escalationValue)}`
                                                : `${rental.escalationValue}%`} every {rental.escalationEveryMonths} months
                                        </p>
                                    </div>
                                )}
                                {rental.leaseStart && (
                                    <div>
                                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Lease</p>
                                        <p className="text-gray-300 font-bold">
                                            {formatDate(rental.leaseStart)}
                                            {rental.leaseEnd ? ` → ${formatDate(rental.leaseEnd)}` : ''}
                                        </p>
                                    </div>
                                )}
                                {rental.rules && (
                                    <div>
                                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Notes</p>
                                        <p className="text-gray-400 leading-relaxed whitespace-pre-wrap">{rental.rules}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* The points you actually reach for mid-argument, kept
                            as separate lines rather than buried in a paragraph. */}
                        {(rental.terms || []).length > 0 && (
                            <div className="mt-5 pt-5 border-t border-white/5">
                                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-2.5">
                                    Agreement points
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                                    {rental.terms.map((term, i) => (
                                        // eslint-disable-next-line react/no-array-index-key
                                        <div key={i} className="flex gap-2.5 items-start">
                                            <span className="text-emerald-500 text-[10px] font-black mt-0.5 shrink-0">
                                                {String(i + 1).padStart(2, '0')}
                                            </span>
                                            <span className="text-xs text-gray-300 leading-relaxed">{term}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Also shown when the ledger has no rows: a payment
                        outside the lease window still has to be visible. */}
                    {(ledger.length > 0 || (ledger.unplaced || []).length > 0) && (
                        <div className="card p-0 overflow-hidden border border-white/5">
                            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">
                                    Rent due vs received
                                </h4>
                                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                                    Most recent first
                                </span>
                            </div>
                            <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left text-xs">
                                    <tbody className="divide-y divide-white/5">
                                        {ledger.map((row) => (
                                            <tr key={row.month} className="hover:bg-white/[0.03] transition-colors">
                                                <td className="py-3 px-6 font-mono text-gray-400">{formatPeriod(row.month)}</td>
                                                <td className="py-3 px-6 text-right font-mono text-gray-500">
                                                    {formatCurrency(row.due)}
                                                </td>
                                                <td className="py-3 px-6 text-right font-mono font-bold text-white">
                                                    {formatCurrency(row.received)}
                                                </td>
                                                <td className="py-3 px-6 text-right w-32">
                                                    {row.shortfall > 0 ? (
                                                        <span className="text-red-400 font-black">
                                                            short {formatCurrency(row.shortfall)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-emerald-400 font-black">paid</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* A payment whose month could not be read is named
                                rather than dropped. Dropping it is what made a
                                month that had been paid show as short. */}
                            {(ledger.unplaced || []).length > 0 && (
                                <div className="px-6 py-4 border-t border-amber-500/20 bg-amber-500/[0.04]">
                                    <p className="text-[11px] font-black text-amber-400 uppercase tracking-wider">
                                        {ledger.unplaced.length} rent payment{ledger.unplaced.length === 1 ? '' : 's'} not counted above
                                    </p>
                                    {/* Two different causes with two different
                                        fixes: an unreadable month is corrected
                                        on the entry, a month outside the lease
                                        is corrected on the lease dates. */}
                                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                                        {ledger.unplaced.some((e) => e.outsideLease)
                                            ? 'Some cover months outside the lease period, so there is no row to match them against. Check the lease start and end dates on the unit.'
                                            : 'The month each covers could not be read, so it is not matched to any row.'}
                                        {' '}Months are stored as <span className="font-mono">2026-08</span>.
                                    </p>
                                    {ledger.unplaced.map((e) => (
                                        <p key={e.id} className="text-[11px] text-gray-500 mt-1 font-mono">
                                            {e.date} · {formatCurrency(e.amount)} · for {formatPeriod(e.period) || 'blank'}
                                            {e.outsideLease ? ' · outside the lease period' : ' · month unreadable'}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {bills.length > 0 && (
                        <div className="card p-0 overflow-hidden border border-white/5">
                            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">
                                    Bills charged vs recovered
                                </h4>
                                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                                    Most recent first
                                </span>
                            </div>
                            {/* No "due" column on purpose: electricity is
                                whatever the meter said, so nothing here can
                                claim a bill was expected. It reports what was
                                recorded and what that left you carrying. */}
                            <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left text-xs">
                                    <tbody className="divide-y divide-white/5">
                                        {bills.map((row) => (
                                            <tr key={row.month} className="hover:bg-white/[0.03] transition-colors">
                                                <td className="py-3 px-6 font-mono text-gray-400">{formatPeriod(row.month)}</td>
                                                <td className="py-3 px-6 text-right font-mono text-gray-500">
                                                    {formatCurrency(row.billed)} billed
                                                </td>
                                                <td className="py-3 px-6 text-right font-mono text-gray-500">
                                                    {row.tenantPaid > 0 && (
                                                        <span className="text-indigo-400">
                                                            {formatCurrency(row.tenantPaid)} by tenant
                                                        </span>
                                                    )}
                                                    {row.tenantPaid > 0 && row.recovered > 0 && ' · '}
                                                    {row.recovered > 0 && `${formatCurrency(row.recovered)} back`}
                                                    {row.tenantPaid === 0 && row.recovered === 0 && '—'}
                                                </td>
                                                <td className="py-3 px-6 text-right w-40">
                                                    {row.borne > 0 ? (
                                                        <span className="text-amber-400 font-black">
                                                            you paid {formatCurrency(row.borne)}
                                                        </span>
                                                    ) : row.borne < 0 ? (
                                                        <span className="text-emerald-400 font-black">
                                                            {formatCurrency(-row.borne)} ahead
                                                        </span>
                                                    ) : row.billed === 0 && row.tenantPaid > 0 ? (
                                                        // Never yours to recover — you did not pay it.
                                                        <span className="text-indigo-400 font-black">not your bill</span>
                                                    ) : (
                                                        <span className="text-emerald-400 font-black">fully recovered</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">
                        {rental ? 'Rent, Bills & Tax Entries' : 'Transaction History'}
                    </h3>
                    {/* Which tenancy an entry will land against, said before the
                        button is pressed rather than discovered afterwards. */}
                    {usesUnits && (
                        <p className="text-[11px] text-gray-600 mt-1">
                            {activeUnit
                                ? <>For <span className="text-emerald-400 font-bold">{activeUnit.name}</span> — select a different unit above to switch</>
                                : <>For the <span className="text-indigo-400 font-bold">building itself</span> — select a unit above to record its rent</>}
                        </p>
                    )}
                </div>
                <button
                    onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20"
                >
                    <Plus size={16} /> Add {usesUnits && activeUnit ? `entry to ${activeUnit.name}` : 'Transaction'}
                </button>
            </div>

            <div className="card p-0 overflow-hidden border border-white/5 shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-gray-500 text-[10px] font-black uppercase tracking-widest bg-white/2">
                                <th className="py-5 px-6">Event Date</th>
                                <th className="py-5 px-6">Classification</th>
                                <th className="py-5 px-6 text-right">Fiscal Impact</th>
                                <th className="py-5 px-6">Description</th>
                                <th className="py-5 px-6 text-center">Manage</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center text-gray-500 font-medium">
                                        No fiscal records identified for this asset.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map(tx => (
                                    <tr key={tx.id} className="hover:bg-white/[0.03] transition-colors group">
                                        <td className="py-5 px-6">
                                            <span className="text-gray-400 text-xs font-medium">{formatDate(tx.date)}</span>
                                        </td>
                                        <td className="py-5 px-6">
                                            <span
                                                className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
                                                style={{
                                                    color: ENTRY_KINDS[kindOf(tx)].color,
                                                    backgroundColor: `${ENTRY_KINDS[kindOf(tx)].color}1a`,
                                                    borderColor: `${ENTRY_KINDS[kindOf(tx)].color}44`,
                                                }}
                                            >
                                                {ENTRY_KINDS[kindOf(tx)].label}
                                            </span>
                                            {tx.period && (
                                                <span className="block text-[10px] text-gray-600 font-mono mt-1">
                                                    for {formatPeriod(tx.period)}
                                                </span>
                                            )}
                                            {/* Who carried it, whenever that is
                                                not simply you. */}
                                            {asksWhoPays(kindOf(tx), isRealEstate) && borneBy(tx) !== 'owner' && (
                                                <span className="block text-[10px] font-bold mt-1"
                                                    style={{ color: BORNE_BY[borneBy(tx)].color }}>
                                                    {BORNE_BY[borneBy(tx)].short}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-5 px-6 text-right font-black text-sm text-white">
                                            {formatCurrency(tx.amount)}
                                            {/* The billed figure stays the headline —
                                                it is what the invoice said — with what
                                                it actually cost you beneath it. */}
                                            {asksWhoPays(kindOf(tx), isRealEstate) && netCost(tx) !== Math.abs(Number(tx.amount) || 0) && (
                                                <span className="block text-[10px] font-bold text-emerald-400 mt-0.5">
                                                    {netCost(tx) === 0
                                                        ? 'cost you nothing'
                                                        : `${formatCurrency(netCost(tx))} to you`}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-5 px-6">
                                            <span className="text-gray-400 text-xs italic">{tx.description || 'No description provided'}</span>
                                        </td>
                                        <td className="py-5 px-6">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => { setEditingTx(tx); setIsTxModalOpen(true); }}
                                                    className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all transform hover:scale-110"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTx(tx.id)}
                                                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all transform hover:scale-110"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AssetTransactionModal
                isOpen={isTxModalOpen}
                onClose={() => { setIsTxModalOpen(false); setEditingTx(null); }}
                onSave={handleSaveTx}
                initialData={editingTx}
                isRealEstate={isRealEstate}
                units={usesUnits ? allUnits(item).map((u) => ({ id: u.id, name: u.name, selfOccupied: u.selfOccupied })) : []}
                unitId={activeUnit ? activeUnit.id : ''}
            />

            <AssetItemModal
                isOpen={isAssetModalOpen}
                onClose={() => setIsAssetModalOpen(false)}
                onSave={handleSaveAsset}
                initialData={item}
                categoryType={category.type}
            />

            <PropertyUnitModal
                isOpen={isUnitModalOpen}
                onClose={() => { setIsUnitModalOpen(false); setEditingUnit(null); }}
                onSave={handleSaveUnit}
                onDelete={handleDeleteUnit}
                initialData={editingUnit}
            />
        </div>
    );
};

export default AssetItemDetails;
