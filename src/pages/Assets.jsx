import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { Home, PieChart, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Assets = () => {
    const { assets, formatCurrency } = useFinance();
    const navigate = useNavigate();

    const getIcon = (id) => {
        switch (id) {
            case 'plots': return <Layers size={32} className="text-emerald-400" />;
            case 'apartments': return <Home size={32} className="text-blue-400" />;
            case 'other_assets': return <PieChart size={32} className="text-purple-400" />;
            default: return <Layers size={32} className="text-gray-400" />;
        }
    };

    const calculateTotalValue = (items) => {
        return items.reduce((sum, item) => sum + (Number(item.currentValue) || Number(item.purchasePrice) || Number(item.purchasedValue) || 0), 0);
    };

    return (
        <div>
            <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">Assets</h2>
                <p className="text-secondary">Track and manage your real estate and other valuable assets.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assets.map(category => (
                    <div
                        key={category.id}
                        onClick={() => navigate(`/assets/${category.id}`)}
                        className="card group hover:scale-[1.02] transition-all cursor-pointer bg-white/5 border border-white/10 hover:border-blue-500/50 p-6 rounded-xl"
                    >
                        <div className="flex items-start justify-between mb-6">
                            <div className="p-3 bg-white/5 rounded-lg group-hover:bg-white/10 transition-colors">
                                {getIcon(category.id)}
                            </div>
                        </div>

                        <h3 className="text-xl font-bold mb-2">{category.title}</h3>

                        <div className="space-y-1">
                            <p className="text-sm text-secondary">Total Value</p>
                            <p className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
                                {formatCurrency(calculateTotalValue(category.items))}
                            </p>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-sm text-secondary">
                            <span>{category.items.length} Items</span>
                            <span className="group-hover:translate-x-1 transition-transform">View Details →</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Assets;
