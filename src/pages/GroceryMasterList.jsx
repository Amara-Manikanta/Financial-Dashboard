import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Plus, Trash2, Edit2, ShoppingBag, ArrowRight, Tag, Droplets, Package, MapPin, X, Search, Merge } from 'lucide-react';

const GroceryMasterList = () => {
    const { 
        groceryCategories, saveGroceryCategories,
        groceryBrands, addGroceryBrand, removeGroceryBrand, saveGroceryBrands,
        groceryFlavours, addGroceryFlavour, removeGroceryFlavour, saveGroceryFlavours,
        groceryItemBrandMap, groceryItemFlavourMap,
        saveGroceryItemBrandMap, saveGroceryItemFlavourMap,
        mergeGroceryItem
    } = useFinance();
    const [selectedCategory, setSelectedCategory] = useState(Object.keys(groceryCategories)[0] || '');
    const [activeTab, setActiveTab] = useState('items'); // items, brands, flavours
    const [mappingItem, setMappingItem] = useState(null); // Item name currently being mapped
    const [searchQuery, setSearchQuery] = useState('');
    const [mergeState, setMergeState] = useState({ active: false, oldItem: null, targetItem: '' });
    
    // Add new category
    const [newCategoryName, setNewCategoryName] = useState('');
    // Add new item
    const [newItemName, setNewItemName] = useState('');

    const handleAddCategory = (e) => {
        e.preventDefault();
        const cat = newCategoryName.trim();
        if (!cat || groceryCategories[cat]) return;

        const updated = { ...groceryCategories, [cat]: [] };
        saveGroceryCategories(updated);
        setNewCategoryName('');
        setSelectedCategory(cat);
    };

    const handleDeleteCategory = (cat) => {
        if (!window.confirm(`Are you sure you want to delete the entire category "${cat}"?`)) return;
        const updated = { ...groceryCategories };
        delete updated[cat];
        saveGroceryCategories(updated);
        if (selectedCategory === cat) {
            setSelectedCategory(Object.keys(updated)[0] || '');
        }
    };

    const handleRenameCategory = (oldName) => {
        const newName = window.prompt('Enter new category name:', oldName);
        if (!newName || newName.trim() === '' || newName === oldName || groceryCategories[newName]) return;

        const updated = { ...groceryCategories };
        updated[newName] = updated[oldName];
        delete updated[oldName];
        saveGroceryCategories(updated);
        if (selectedCategory === oldName) setSelectedCategory(newName);
    };

    const handleAddItem = (e) => {
        e.preventDefault();
        const item = newItemName.trim();
        if (!item || !selectedCategory) return;
        
        if (activeTab === 'items') {
            if (groceryCategories[selectedCategory].includes(item)) return;
            const updated = { ...groceryCategories };
            updated[selectedCategory] = [...updated[selectedCategory], item].sort();
            saveGroceryCategories(updated);
        } else if (activeTab === 'brands') {
            addGroceryBrand(selectedCategory, item);
        } else if (activeTab === 'flavours') {
            addGroceryFlavour(selectedCategory, item);
        }
        
        setNewItemName('');
    };

    const handleDeleteItem = (cat, item) => {
        if (activeTab === 'items') {
            const updated = { ...groceryCategories };
            updated[cat] = updated[cat].filter(i => i !== item);
            saveGroceryCategories(updated);
        } else if (activeTab === 'brands') {
            removeGroceryBrand(cat, item);
        } else if (activeTab === 'flavours') {
            removeGroceryFlavour(cat, item);
        }
    };

    const handleRenameItem = (cat, oldItem) => {
        const newItem = window.prompt(`Enter new ${activeTab.slice(0, -1)} name:`, oldItem);
        
        if (!newItem || newItem.trim() === '' || newItem === oldItem) return;

        const updated = activeTab === 'items' ? { ...groceryCategories } : activeTab === 'brands' ? { ...groceryBrands } : { ...groceryFlavours };
        
        if (updated[cat] && updated[cat].includes(newItem)) {
            alert('Name already exists!');
            return;
        }

        updated[cat] = updated[cat].map(i => i === oldItem ? newItem.trim() : i).sort();
        
        if (activeTab === 'items') {
            saveGroceryCategories(updated);
        } else if (activeTab === 'brands') {
            // Need a context function to save brands entirely, but for now we can just save it by adding and deleting.
            // Wait, we can't easily save the whole object without a saveGroceryBrands function. 
            // We'll call saveGroceryBrands which we'll add to context.
            saveGroceryBrands(updated);
        } else {
            saveGroceryFlavours(updated);
        }
    };

    const handleMoveItem = (oldCat, item, newCat) => {
        if (oldCat === newCat) return;
        const updated = { ...groceryCategories };
        updated[oldCat] = updated[oldCat].filter(i => i !== item);
        updated[newCat] = [...updated[newCat], item].sort();
        saveGroceryCategories(updated);
    };

    const toggleItemMapping = (type, brandOrFlavour) => {
        if (!mappingItem) return;
        
        if (type === 'brand') {
            const currentMap = { ...groceryItemBrandMap };
            if (!currentMap[selectedCategory]) currentMap[selectedCategory] = {};
            
            const currentList = currentMap[selectedCategory][mappingItem] || [];
            if (currentList.includes(brandOrFlavour)) {
                currentMap[selectedCategory][mappingItem] = currentList.filter(b => b !== brandOrFlavour);
            } else {
                currentMap[selectedCategory][mappingItem] = [...currentList, brandOrFlavour];
            }
            saveGroceryItemBrandMap(currentMap);
        } else {
            const currentMap = { ...groceryItemFlavourMap };
            if (!currentMap[selectedCategory]) currentMap[selectedCategory] = {};
            
            const currentList = currentMap[selectedCategory][mappingItem] || [];
            if (currentList.includes(brandOrFlavour)) {
                currentMap[selectedCategory][mappingItem] = currentList.filter(f => f !== brandOrFlavour);
            } else {
                currentMap[selectedCategory][mappingItem] = [...currentList, brandOrFlavour];
            }
            saveGroceryItemFlavourMap(currentMap);
        }
    };

    const currentItems = groceryCategories[selectedCategory] || [];
    const currentBrands = groceryBrands[selectedCategory] || [];
    const currentFlavours = groceryFlavours[selectedCategory] || [];

    const getFilteredList = (list) => {
        if (!searchQuery) return list;
        return list.filter(item => item.toLowerCase().includes(searchQuery.toLowerCase()));
    };

    const handleMergeSubmit = async () => {
        if (!mergeState.targetItem || mergeState.targetItem === mergeState.oldItem) return;
        if (window.confirm(`Are you sure you want to merge "${mergeState.oldItem}" into "${mergeState.targetItem}"? This will update all historical transactions and cannot be undone.`)) {
            await mergeGroceryItem(selectedCategory, mergeState.oldItem, mergeState.targetItem);
            setMergeState({ active: false, oldItem: null, targetItem: '' });
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '900', color: 'white', letterSpacing: '-0.025em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ShoppingBag style={{ color: '#10b981' }} size={32} /> Master Grocery Builder
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: '#71717a', margin: '0.25rem 0 0 0' }}>Manage all your categories and items to streamline your expenses tracking.</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                {/* Categories Sidebar */}
                <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.4)', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '900', color: 'white', margin: '0 0 0.5rem 0' }}>Categories</h3>
                        
                        {Object.keys(groceryCategories).map(cat => (
                            <div 
                                key={cat} 
                                onClick={() => setSelectedCategory(cat)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderRadius: '1rem', cursor: 'pointer', transition: 'all 0.2s',
                                    backgroundColor: selectedCategory === cat ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                    border: selectedCategory === cat ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid transparent',
                                    color: selectedCategory === cat ? '#34d399' : '#a1a1aa'
                                }}
                            >
                                <span style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>{cat}</span>
                                {selectedCategory === cat && (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={(e) => { e.stopPropagation(); handleRenameCategory(cat); }} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0 }}><Edit2 size={14} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><Trash2 size={14} /></button>
                                    </div>
                                )}
                            </div>
                        ))}

                        <form onSubmit={handleAddCategory} style={{ display: 'flex', marginTop: '1rem' }}>
                            <input 
                                type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New Category..." 
                                style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem 0 0 0.75rem', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '0.875rem', outline: 'none' }}
                            />
                            <button type="submit" style={{ backgroundColor: '#10b981', color: 'black', border: 'none', borderRadius: '0 0.75rem 0.75rem 0', padding: '0 1rem', cursor: 'pointer' }}><Plus size={16} /></button>
                        </form>
                    </div>
                </div>

                {/* Editor Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    {/* Tabs */}
                    {selectedCategory && (
                        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                            <button
                                onClick={() => setActiveTab('items')}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    backgroundColor: activeTab === 'items' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    color: activeTab === 'items' ? 'white' : '#71717a', border: 'none'
                                }}
                            >
                                <Package size={16} /> Items
                            </button>
                            <button
                                onClick={() => setActiveTab('brands')}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    backgroundColor: activeTab === 'brands' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    color: activeTab === 'brands' ? 'white' : '#71717a', border: 'none'
                                }}
                            >
                                <Tag size={16} /> Brands
                            </button>
                            <button
                                onClick={() => setActiveTab('flavours')}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    backgroundColor: activeTab === 'flavours' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    color: activeTab === 'flavours' ? 'white' : '#71717a', border: 'none'
                                }}
                            >
                                <Droplets size={16} /> Flavours
                            </button>
                        </div>
                    )}

                    <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.4)', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', padding: '2rem' }}>
                        {!selectedCategory ? (
                            <div style={{ color: '#71717a', textAlign: 'center', padding: '3rem' }}>Select a category to view and edit.</div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', margin: 0, textTransform: 'capitalize' }}>{activeTab} in {selectedCategory}</h3>
                                    
                                    <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '300px', justifyContent: 'flex-end' }}>
                                        {/* Search Bar */}
                                        <div style={{ position: 'relative', width: '100%', maxWidth: '250px' }}>
                                            <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#71717a', pointerEvents: 'none' }}>
                                                <Search size={16} />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder={`Search ${activeTab}...`}
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '0.75rem 1rem 0.75rem 2.5rem', color: 'white', fontSize: '0.875rem', outline: 'none' }}
                                            />
                                        </div>

                                        <form onSubmit={handleAddItem} style={{ display: 'flex', gap: '1rem', maxWidth: '300px' }}>
                                            <input 
                                                type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder={`Add new ${activeTab.slice(0, -1)}...`}
                                                style={{ width: '150px', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '0.875rem', outline: 'none' }}
                                            />
                                            <button type="submit" style={{ backgroundColor: '#10b981', color: 'black', border: 'none', borderRadius: '0.75rem', padding: '0 1rem', cursor: 'pointer' }}><Plus size={16} /></button>
                                        </form>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                                    {getFilteredList(activeTab === 'items' ? currentItems : activeTab === 'brands' ? currentBrands : currentFlavours).map(item => (
                                        <div key={item} style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ color: 'white', fontWeight: 'bold' }}>{item}</span>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    {activeTab === 'items' && (
                                                        <>
                                                            <button onClick={() => setMergeState({ active: true, oldItem: item, targetItem: '' })} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', padding: 0 }} title="Merge Item"><Merge size={16} /></button>
                                                            <button onClick={() => setMappingItem(item)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 0 }} title="Map Brands & Flavours"><MapPin size={16} /></button>
                                                        </>
                                                    )}
                                                    <button onClick={() => handleRenameItem(selectedCategory, item)} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0 }} title={`Rename ${activeTab.slice(0, -1)}`}><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDeleteItem(selectedCategory, item)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }} title="Delete"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                            
                                            {activeTab === 'items' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <ArrowRight size={14} className="text-gray-500" />
                                                    <select 
                                                        onChange={(e) => handleMoveItem(selectedCategory, item, e.target.value)}
                                                        value={selectedCategory}
                                                        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '11px', outline: 'none', cursor: 'pointer' }}
                                                    >
                                                        {Object.keys(groceryCategories).map(c => (
                                                            <option key={c} value={c}>{c}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {getFilteredList(activeTab === 'items' ? currentItems : activeTab === 'brands' ? currentBrands : currentFlavours).length === 0 && (
                                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#71717a' }}>No {activeTab} in this category.</div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Mapping Modal */}
            {mappingItem && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div style={{ backgroundColor: '#18181b', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: '500px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <MapPin size={20} className="text-emerald-500" /> Map {mappingItem}
                            </h2>
                            <button onClick={() => setMappingItem(null)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        
                        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {/* Brands Mapping */}
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Tag size={16} className="text-blue-500" /> Brands</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    {(groceryBrands[selectedCategory] || []).length === 0 ? (
                                        <p style={{ color: '#71717a', fontSize: '0.875rem', margin: 0 }}>No brands defined in {selectedCategory}.</p>
                                    ) : (
                                        (groceryBrands[selectedCategory] || []).map(brand => {
                                            const isChecked = (groceryItemBrandMap[selectedCategory]?.[mappingItem] || []).includes(brand);
                                            return (
                                                <label key={brand} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isChecked ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '2rem', transition: 'all 0.2s' }}>
                                                    <input type="checkbox" checked={isChecked} onChange={() => toggleItemMapping('brand', brand)} style={{ display: 'none' }} />
                                                    <span style={{ color: isChecked ? '#60a5fa' : '#e4e4e7', fontSize: '0.875rem', fontWeight: '500' }}>{brand}</span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            
                            {/* Flavours Mapping */}
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Droplets size={16} className="text-purple-500" /> Flavours</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    {(groceryFlavours[selectedCategory] || []).length === 0 ? (
                                        <p style={{ color: '#71717a', fontSize: '0.875rem', margin: 0 }}>No flavours defined in {selectedCategory}.</p>
                                    ) : (
                                        (groceryFlavours[selectedCategory] || []).map(flavour => {
                                            const isChecked = (groceryItemFlavourMap[selectedCategory]?.[mappingItem] || []).includes(flavour);
                                            return (
                                                <label key={flavour} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', backgroundColor: isChecked ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isChecked ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '2rem', transition: 'all 0.2s' }}>
                                                    <input type="checkbox" checked={isChecked} onChange={() => toggleItemMapping('flavour', flavour)} style={{ display: 'none' }} />
                                                    <span style={{ color: isChecked ? '#c084fc' : '#e4e4e7', fontSize: '0.875rem', fontWeight: '500' }}>{flavour}</span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setMappingItem(null)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#10b981', color: 'black', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>Done</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Merge Modal */}
            {mergeState.active && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div style={{ backgroundColor: '#18181b', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: '400px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Merge size={20} className="text-amber-500" /> Merge Item
                            </h2>
                            <button onClick={() => setMergeState({ active: false, oldItem: null, targetItem: '' })} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>Item to merge and delete:</label>
                                <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1.125rem', padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                    {mergeState.oldItem}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', color: '#71717a' }}>
                                <ArrowRight size={24} style={{ transform: 'rotate(90deg)' }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>Merge into (Keep this item):</label>
                                <select 
                                    value={mergeState.targetItem}
                                    onChange={(e) => setMergeState(prev => ({ ...prev, targetItem: e.target.value }))}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '1rem', outline: 'none', cursor: 'pointer' }}
                                >
                                    <option value="" disabled>Select target item...</option>
                                    {(groceryCategories[selectedCategory] || [])
                                        .filter(item => item !== mergeState.oldItem)
                                        .map(item => (
                                            <option key={item} value={item}>{item}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div style={{ padding: '1rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '0.75rem', fontSize: '0.875rem', color: '#fcd34d' }}>
                                <strong>Warning:</strong> This will update all past transactions replacing "{mergeState.oldItem}" with the selected item. This cannot be undone.
                            </div>
                        </div>

                        <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button onClick={() => setMergeState({ active: false, oldItem: null, targetItem: '' })} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'transparent', color: 'white', borderRadius: '0.5rem', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleMergeSubmit} disabled={!mergeState.targetItem} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f59e0b', color: 'black', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', opacity: !mergeState.targetItem ? 0.5 : 1 }}>Confirm Merge</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroceryMasterList;
