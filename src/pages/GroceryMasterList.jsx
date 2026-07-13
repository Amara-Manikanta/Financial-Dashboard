import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Plus, Trash2, Edit2, ShoppingBag, ArrowRight } from 'lucide-react';

const GroceryMasterList = () => {
    const { groceryCategories, saveGroceryCategories } = useFinance();
    const [selectedCategory, setSelectedCategory] = useState(Object.keys(groceryCategories)[0] || '');
    
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
        if (groceryCategories[selectedCategory].includes(item)) return;

        const updated = { ...groceryCategories };
        updated[selectedCategory] = [...updated[selectedCategory], item].sort();
        saveGroceryCategories(updated);
        setNewItemName('');
    };

    const handleDeleteItem = (cat, item) => {
        const updated = { ...groceryCategories };
        updated[cat] = updated[cat].filter(i => i !== item);
        saveGroceryCategories(updated);
    };

    const handleRenameItem = (cat, oldItem) => {
        const newItem = window.prompt('Enter new item name:', oldItem);
        if (!newItem || newItem.trim() === '' || newItem === oldItem || groceryCategories[cat].includes(newItem)) return;

        const updated = { ...groceryCategories };
        updated[cat] = updated[cat].map(i => i === oldItem ? newItem.trim() : i).sort();
        saveGroceryCategories(updated);
    };

    const handleMoveItem = (oldCat, item, newCat) => {
        if (oldCat === newCat || !newCat || !groceryCategories[newCat]) return;
        if (groceryCategories[newCat].includes(item)) {
            alert(`${item} already exists in ${newCat}`);
            return;
        }
        const updated = { ...groceryCategories };
        updated[oldCat] = updated[oldCat].filter(i => i !== item);
        updated[newCat] = [...updated[newCat], item].sort();
        saveGroceryCategories(updated);
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

                {/* Items Editor */}
                <div style={{ flex: 1, backgroundColor: 'rgba(24, 24, 27, 0.4)', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', padding: '2rem' }}>
                    {!selectedCategory ? (
                        <div style={{ color: '#71717a', textAlign: 'center', padding: '3rem' }}>Select a category to view and edit items.</div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', margin: 0 }}>Items in {selectedCategory}</h3>
                                <form onSubmit={handleAddItem} style={{ display: 'flex', width: '300px' }}>
                                    <input 
                                        type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Add new item..." 
                                        style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem 0 0 0.75rem', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '0.875rem', outline: 'none' }}
                                    />
                                    <button type="submit" style={{ backgroundColor: '#10b981', color: 'black', border: 'none', borderRadius: '0 0.75rem 0.75rem 0', padding: '0 1rem', cursor: 'pointer' }}><Plus size={16} /></button>
                                </form>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                                {groceryCategories[selectedCategory].map(item => (
                                    <div key={item} style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: 'white', fontWeight: 'bold' }}>{item}</span>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => handleRenameItem(selectedCategory, item)} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0 }}><Edit2 size={16} /></button>
                                                <button onClick={() => handleDeleteItem(selectedCategory, item)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><Trash2 size={16} /></button>
                                            </div>
                                        </div>
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
                                    </div>
                                ))}
                                {groceryCategories[selectedCategory].length === 0 && (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#71717a' }}>No items in this category.</div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GroceryMasterList;
