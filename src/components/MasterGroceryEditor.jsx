import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Plus, Trash2, X, Settings } from 'lucide-react';
import { createPortal } from 'react-dom';

const CATEGORIES = [
    'Milk Products', 'Vegetables', 'Fruits', 'Dals/Pulses', 'Rice/Atta', 
    'Oils/Ghee', 'Snacks', 'Cleaning Supplies', 'Personal Care', 'Eggs', 'Others'
];

const MasterGroceryEditor = ({ isOpen, onClose }) => {
    const { 
        customGroceryItems, addCustomGroceryItem, removeCustomGroceryItem,
        groceryBrands, addGroceryBrand, removeGroceryBrand,
        groceryFlavours, addGroceryFlavour, removeGroceryFlavour
    } = useFinance();

    const [activeTab, setActiveTab] = useState('items'); // items, brands, flavours
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
    const [newValue, setNewValue] = useState('');

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newValue.trim()) return;

        const val = newValue.trim();
        if (activeTab === 'items') addCustomGroceryItem(selectedCategory, val);
        else if (activeTab === 'brands') addGroceryBrand(selectedCategory, val);
        else if (activeTab === 'flavours') addGroceryFlavour(selectedCategory, val);

        setNewValue('');
    };

    const handleRemove = (val) => {
        if (activeTab === 'items') removeCustomGroceryItem(selectedCategory, val);
        else if (activeTab === 'brands') removeGroceryBrand(selectedCategory, val);
        else if (activeTab === 'flavours') removeGroceryFlavour(selectedCategory, val);
    };

    if (!isOpen) return null;

    let currentList = [];
    if (activeTab === 'items') currentList = customGroceryItems[selectedCategory] || [];
    else if (activeTab === 'brands') currentList = Array.isArray(groceryBrands) ? [] : (groceryBrands[selectedCategory] || []);
    else if (activeTab === 'flavours') currentList = Array.isArray(groceryFlavours) ? [] : (groceryFlavours[selectedCategory] || []);

    return createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.98), rgba(18, 18, 18, 0.98))', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '2rem', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
                        <Settings size={20} className="text-emerald-500" /> Master List Editor
                    </h3>
                    <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.75rem', border: 'none', backgroundColor: 'rgba(255,255,255,0.03)', color: '#71717a', cursor: 'pointer' }}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            style={{
                                padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                                backgroundColor: selectedCategory === cat ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)',
                                color: selectedCategory === cat ? '#34d399' : '#71717a',
                                border: selectedCategory === cat ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.05)'
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
                    {['items', 'brands', 'flavours'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer',
                                backgroundColor: activeTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent',
                                color: activeTab === tab ? 'white' : '#71717a', border: 'none'
                            }}
                        >
                            Custom {tab}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <input 
                        type="text" 
                        value={newValue}
                        onChange={e => setNewValue(e.target.value)}
                        placeholder={`Add new ${activeTab.slice(0,-1)} to ${selectedCategory}...`}
                        style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '0.75rem 1rem', fontSize: '0.875rem', outline: 'none' }}
                    />
                    <button type="submit" style={{ backgroundColor: '#10b981', color: 'black', fontWeight: 'bold', borderRadius: '1rem', padding: '0 1.25rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={16} /> Add
                    </button>
                </form>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    {currentList.map(item => (
                        <div key={item} style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.75rem', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ color: 'white', fontSize: '0.875rem', fontWeight: 'bold' }}>{item}</span>
                            <button onClick={() => handleRemove(item)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                    {currentList.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#71717a', fontSize: '0.875rem' }}>
                            No custom {activeTab} added for {selectedCategory} yet.
                        </div>
                    )}
                </div>

            </div>
        </div>,
        document.body
    );
};

export default MasterGroceryEditor;
