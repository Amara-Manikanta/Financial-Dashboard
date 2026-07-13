import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';

const QUANTITY_OPTIONS = {
    'Milk Products': ['250 ml', '500 ml', '1 L', '2 L', 'Custom'],
    'Cleaning Supplies': ['250 ml', '500 ml', '1 L', '2 L', 'Custom'],
    'Dals/Pulses': ['250 g', '500 g', '1 kg', '2 kg', '5 kg', 'Custom'],
    'Rice/Atta': ['500 g', '1 kg', '2 kg', '5 kg', '10 kg', '25 kg', 'Custom'],
    'Vegetables': ['250 g', '500 g', '1 kg', 'Custom'],
    'Fruits': ['250 g', '500 g', '1 kg', 'Custom'],
    'Non-Veg': ['250 g', '500 g', '1 kg', '6', '12', '30', 'Custom'],
    'default': ['1 pc', '2 pcs', 'Custom']
};

const GroceryBuilder = ({ items, onChange, expenses }) => {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedItem, setSelectedItem] = useState('');
    const [finalBillAmount, setFinalBillAmount] = useState('');
    const { customGroceryItems = {}, addCustomGroceryItem, groceryBrands = {}, addGroceryBrand, groceryFlavours = {}, addGroceryFlavour, groceryCategories, groceryItemBrandMap = {}, groceryItemFlavourMap = {}, saveGroceryItemBrandMap, saveGroceryItemFlavourMap } = useFinance();

    // Extract historical data for autocomplete (brands and custom items)
    const historicalData = useMemo(() => {
        const brandsByCategory = {};
        const flavoursByCategory = {};
        const itemHistory = {};
        
        if (expenses) {
            Object.values(expenses).forEach(yearData => {
                Object.values(yearData).forEach(monthData => {
                    if (monthData.transactions) {
                        monthData.transactions.forEach(tx => {
                            if (tx.groceryItems) {
                                tx.groceryItems.forEach(gi => {
                                    if (gi.brand && gi.subcategory) {
                                        if (!brandsByCategory[gi.subcategory]) brandsByCategory[gi.subcategory] = new Set();
                                        brandsByCategory[gi.subcategory].add(gi.brand);
                                    }
                                    if (gi.flavour && gi.subcategory) {
                                        if (!flavoursByCategory[gi.subcategory]) flavoursByCategory[gi.subcategory] = new Set();
                                        flavoursByCategory[gi.subcategory].add(gi.flavour);
                                    }
                                    if (gi.name) {
                                        const nameLower = gi.name.toLowerCase();
                                        if (!itemHistory[nameLower]) {
                                            itemHistory[nameLower] = {
                                                originalName: gi.name,
                                                subcategory: gi.subcategory,
                                                quantity: gi.quantity,
                                                brand: gi.brand,
                                                count: 0
                                            };
                                        }
                                        itemHistory[nameLower].count += 1;
                                        
                                        const existingUpperCount = itemHistory[nameLower].originalName.replace(/[^A-Z]/g, '').length;
                                        const newUpperCount = gi.name.replace(/[^A-Z]/g, '').length;
                                        if (newUpperCount > existingUpperCount) {
                                            itemHistory[nameLower].originalName = gi.name;
                                        }
                                    }
                                });
                            }
                        });
                    }
                });
            });
        }
        
        // Convert Sets to Arrays for easier consumption
        const processedBrands = {};
        Object.keys(brandsByCategory).forEach(cat => {
            processedBrands[cat] = Array.from(brandsByCategory[cat]).sort();
        });
        const processedFlavours = {};
        Object.keys(flavoursByCategory).forEach(cat => {
            processedFlavours[cat] = Array.from(flavoursByCategory[cat]).sort();
        });

        return {
            brandsByCategory: processedBrands,
            flavoursByCategory: processedFlavours,
            itemHistory
        };
    }, [expenses]);

    // Update selected item list based on category
    const availableItems = useMemo(() => {
        if (!selectedCategory) return [];
        const baseItems = groceryCategories[selectedCategory] || [];
        // Mix in historical items that belong to this category but aren't in the base list
        const historicalForCategory = Object.values(historicalData.itemHistory)
            .filter(data => data.subcategory === selectedCategory)
            .map(data => data.originalName);
            
        // Mix in explicit custom items saved to DB
        const savedCustomItems = customGroceryItems[selectedCategory] || [];
        
        const allCandidates = [...baseItems, ...historicalForCategory, ...savedCustomItems];
        
        // Deduplicate ignoring case, preferring title-cased versions
        const uniqueMap = new Map();
        allCandidates.forEach(item => {
            const lower = item.toLowerCase();
            if (!uniqueMap.has(lower)) {
                uniqueMap.set(lower, item);
            } else {
                const existing = uniqueMap.get(lower);
                const existingUpperCount = existing.replace(/[^A-Z]/g, '').length;
                const newUpperCount = item.replace(/[^A-Z]/g, '').length;
                if (newUpperCount > existingUpperCount) {
                    uniqueMap.set(lower, item);
                }
            }
        });
        
        // Sort by frequency first, then alphabetically
        return Array.from(uniqueMap.values()).sort((a, b) => {
            const countA = historicalData.itemHistory[a.toLowerCase()]?.count || 0;
            const countB = historicalData.itemHistory[b.toLowerCase()]?.count || 0;
            if (countB !== countA) {
                return countB - countA;
            }
            return a.localeCompare(b);
        });
    }, [selectedCategory, historicalData, customGroceryItems]);

    // Handle adding an item to the list
    const handleAddItem = () => {
        if (!selectedCategory || !selectedItem) return;

        // Allowed to add duplicates

        const history = historicalData.itemHistory[selectedItem.toLowerCase()] || {};

        onChange([...items, {
            id: Date.now().toString() + Math.random().toString(),
            name: selectedItem,
            subcategory: selectedCategory,
            quantity: history.quantity || '',
            customQuantity: '',
            brand: history.brand || '',
            flavour: history.flavour || '',
            price: ''
        }]);

        // Reset selection for quick next entry
        setSelectedItem('');
    };

    const updateItem = (id, field, value) => {
        onChange(items.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const removeItem = (id) => {
        onChange(items.filter(i => i.id !== id));
    };

    return (
        <div className="bg-[#18181b] rounded-2xl border border-white/5 p-5 mt-6 space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <ShoppingBag size={16} />
                </div>
                <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">Grocery Builder</h4>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Add detailed items to receipt</p>
                </div>
            </div>

            {/* Top selectors for Category -> Item */}
            <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 sm:col-span-5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 block ml-1">1. Category</label>
                    <select
                        value={selectedCategory}
                        onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            setSelectedItem('');
                        }}
                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all appearance-none cursor-pointer"
                    >
                        <option value="" disabled className="bg-gray-900">Select Category...</option>
                        {Object.keys(groceryCategories).map(cat => (
                            <option key={cat} value={cat} className="bg-gray-900">{cat}</option>
                        ))}
                    </select>
                </div>
                
                <div className="col-span-12 sm:col-span-5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 block ml-1">2. Item</label>
                    <select
                        value={selectedItem}
                        onChange={(e) => {
                            if (e.target.value === '__add_new__') {
                                const newItem = window.prompt(`Enter new product name for ${selectedCategory}:`);
                                if (newItem && newItem.trim()) {
                                    const formatted = newItem.trim().charAt(0).toUpperCase() + newItem.trim().slice(1);
                                    addCustomGroceryItem(selectedCategory, formatted);
                                    setSelectedItem(formatted);
                                }
                            } else {
                                setSelectedItem(e.target.value);
                            }
                        }}
                        disabled={!selectedCategory}
                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all appearance-none cursor-pointer disabled:opacity-50"
                    >
                        <option value="" disabled className="bg-gray-900">{selectedCategory ? "Select Item..." : "Choose Category First"}</option>
                        {availableItems.map(item => (
                            <option key={item} value={item} className="bg-gray-900">{item}</option>
                        ))}
                        {selectedCategory && (
                            <option value="__add_new__" className="bg-gray-900 text-emerald-400 font-bold">+ Add New Product...</option>
                        )}
                    </select>
                </div>

                <div className="col-span-12 sm:col-span-2 flex items-end">
                    <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={!selectedCategory || !selectedItem}
                        className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>

            {/* List of Added Items */}
            {items.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3 ml-1">Added Items</h5>
                    {items.map((item) => {
                        const opts = QUANTITY_OPTIONS[item.subcategory] || QUANTITY_OPTIONS['default'];
                        const isCustomQty = item.quantity === 'Custom';
                        
                        const histBrands = historicalData.brandsByCategory[item.subcategory] || [];
                        const mappedBrands = groceryItemBrandMap[item.subcategory]?.[item.name];
                        const explicitBrands = Array.isArray(groceryBrands) ? [] : (mappedBrands || []);
                        const availableBrands = Array.from(new Set([...histBrands, ...explicitBrands])).sort();
                        
                        const histFlavours = historicalData.flavoursByCategory[item.subcategory] || [];
                        const mappedFlavours = groceryItemFlavourMap[item.subcategory]?.[item.name];
                        const explicitFlavours = Array.isArray(groceryFlavours) ? [] : (mappedFlavours || []);
                        const availableFlavours = Array.from(new Set([...histFlavours, ...explicitFlavours])).sort();
                        
                        return (
                            <div key={item.id} className="bg-black/40 p-3.5 rounded-2xl border border-white/5 flex flex-col sm:flex-row flex-wrap sm:flex-nowrap sm:items-center gap-3 relative group transition-all hover:bg-black/60 hover:border-white/10">
                                
                                <div className="flex-1 min-w-[100px]">
                                    <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-0.5">{item.subcategory}</div>
                                    <div className="text-sm font-bold text-white">{item.name}</div>
                                </div>
                                
                                {!(item.subcategory === 'Vegetables' || item.subcategory === 'Fruits' || item.subcategory === 'Vegetables & Fruits') && (
                                    <>
                                        <div className="flex-1 min-w-[100px]">
                                            <select
                                                value={item.brand}
                                                onChange={(e) => {
                                                    if (e.target.value === '__add_new__') {
                                                        const newBrand = window.prompt("Enter new brand name:");
                                                        if (newBrand && newBrand.trim()) {
                                                            const formatted = newBrand.trim().charAt(0).toUpperCase() + newBrand.trim().slice(1);
                                                            addGroceryBrand(item.subcategory, formatted);
                                                            
                                                            // Also map this brand to the specific item automatically
                                                            const catMap = groceryItemBrandMap[item.subcategory] || {};
                                                            const currentMapped = catMap[item.name] || [];
                                                            if (!currentMapped.includes(formatted)) {
                                                                saveGroceryItemBrandMap({
                                                                    ...groceryItemBrandMap,
                                                                    [item.subcategory]: {
                                                                        ...catMap,
                                                                        [item.name]: [...currentMapped, formatted].sort()
                                                                    }
                                                                });
                                                            }
                                                            
                                                            updateItem(item.id, 'brand', formatted);
                                                        }
                                                    } else {
                                                        updateItem(item.id, 'brand', e.target.value);
                                                    }
                                                }}
                                                className="w-full bg-white/5 border border-transparent rounded-lg px-3 py-2 text-xs font-medium text-white focus:border-white/20 focus:outline-none transition-colors appearance-none cursor-pointer"
                                            >
                                                <option value="" className="bg-gray-900 text-gray-500">Brand (Optional)</option>
                                                {availableBrands.map(b => (
                                                    <option key={b} value={b} className="bg-gray-900">{b}</option>
                                                ))}
                                                <option value="__add_new__" className="bg-gray-900 text-emerald-400 font-bold">+ Add New Brand...</option>
                                            </select>
                                        </div>
                                        
                                        <div className="flex-1 min-w-[100px]">
                                            <select
                                                value={item.flavour || ''}
                                                onChange={(e) => {
                                                    if (e.target.value === '__add_new__') {
                                                        const newFlavour = window.prompt("Enter new flavour/type:");
                                                        if (newFlavour && newFlavour.trim()) {
                                                            const formatted = newFlavour.trim().charAt(0).toUpperCase() + newFlavour.trim().slice(1);
                                                            addGroceryFlavour(item.subcategory, formatted);

                                                            // Also map this flavour to the specific item automatically
                                                            const catMap = groceryItemFlavourMap[item.subcategory] || {};
                                                            const currentMapped = catMap[item.name] || [];
                                                            if (!currentMapped.includes(formatted)) {
                                                                saveGroceryItemFlavourMap({
                                                                    ...groceryItemFlavourMap,
                                                                    [item.subcategory]: {
                                                                        ...catMap,
                                                                        [item.name]: [...currentMapped, formatted].sort()
                                                                    }
                                                                });
                                                            }

                                                            updateItem(item.id, 'flavour', formatted);
                                                        }
                                                    } else {
                                                        updateItem(item.id, 'flavour', e.target.value);
                                                    }
                                                }}
                                                className="w-full bg-white/5 border border-transparent rounded-lg px-3 py-2 text-xs font-medium text-white focus:border-white/20 focus:outline-none transition-colors appearance-none cursor-pointer"
                                            >
                                                <option value="" className="bg-gray-900 text-gray-500">Flavour (Opt)</option>
                                                {availableFlavours.map(f => (
                                                    <option key={f} value={f} className="bg-gray-900">{f}</option>
                                                ))}
                                                <option value="__add_new__" className="bg-gray-900 text-emerald-400 font-bold">+ Add New Flavour...</option>
                                            </select>
                                        </div>
                                    </>
                                )}

                                <div className="flex-1 min-w-[120px] flex gap-2">
                                    <select
                                        value={item.quantity}
                                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                        className="w-full bg-white/5 border border-transparent rounded-lg px-3 py-2 text-xs font-medium text-white focus:border-white/20 focus:outline-none transition-colors appearance-none cursor-pointer"
                                    >
                                        <option value="" className="bg-gray-900">Size/Qty</option>
                                        {opts.map(o => <option key={o} value={o} className="bg-gray-900">{o}</option>)}
                                    </select>
                                    
                                    {isCustomQty && (
                                        <input
                                            type="text"
                                            value={item.customQuantity}
                                            onChange={(e) => updateItem(item.id, 'customQuantity', e.target.value)}
                                            className="w-full bg-white/5 border border-transparent rounded-lg px-3 py-2 text-xs font-medium text-white focus:border-white/20 focus:outline-none placeholder:text-gray-600 transition-colors"
                                            placeholder="e.g. 1.5kg"
                                            autoFocus
                                        />
                                    )}
                                </div>

                                <div className="w-[100px]">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">₹</span>
                                        <input
                                            type="number"
                                            value={item.price}
                                            onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                                            className="w-full bg-white/5 border border-transparent rounded-lg pl-7 pr-3 py-2 text-xs font-bold text-emerald-400 focus:border-emerald-500/30 focus:outline-none placeholder:text-gray-600 transition-colors"
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                                
                                <button
                                    type="button"
                                    onClick={() => removeItem(item.id)}
                                    className="absolute -top-2 -right-2 sm:static bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white p-2 rounded-xl transition-all opacity-100 sm:opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
            
            {items.length > 0 && (
                <div className="flex flex-col gap-3 pt-4 border-t border-white/5 mt-4">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Sum of Groceries:</span>
                        <span className="text-xl font-black text-emerald-400">₹{items.reduce((sum, i) => sum + (Number(i.price) || 0), 0).toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center bg-black/40 p-3 rounded-2xl border border-white/5">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Final Bill Amount</span>
                            <span className="text-[9px] text-gray-500">To calculate GST / Bag charges</span>
                        </div>
                        <div className="relative w-1/3">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">₹</span>
                            <input
                                type="number"
                                value={finalBillAmount}
                                onChange={(e) => setFinalBillAmount(e.target.value)}
                                className="w-full bg-white/5 border border-transparent rounded-lg pl-7 pr-3 py-2 text-sm font-bold text-white focus:border-indigo-500/50 focus:outline-none placeholder:text-gray-600 transition-colors"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

                    {finalBillAmount && Number(finalBillAmount) > items.reduce((sum, i) => sum + (Number(i.price) || 0), 0) && (
                        <button
                            type="button"
                            onClick={() => {
                                const sumOfGroceries = items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
                                const diff = Number(finalBillAmount) - sumOfGroceries;
                                onChange([
                                    ...items,
                                    {
                                        id: Date.now().toString(),
                                        subcategory: 'Others',
                                        name: 'GST / Carry Bag',
                                        quantity: '1',
                                        customQuantity: '',
                                        brand: '',
                                        flavour: '',
                                        price: diff.toFixed(2)
                                    }
                                ]);
                                setFinalBillAmount(''); // reset
                            }}
                            className="w-full py-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 mt-2 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                        >
                            + Add ₹{(Number(finalBillAmount) - items.reduce((sum, i) => sum + (Number(i.price) || 0), 0)).toFixed(2)} as GST / Others
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default GroceryBuilder;
