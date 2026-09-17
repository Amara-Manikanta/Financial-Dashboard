import React from 'react';
import { Layers, Home, Car, Briefcase, Building2 as Hospital, Banknote, Sparkles, Scale } from 'lucide-react';
const CATEGORIES = [
    { id: 'all', label: 'All Situations', icon: Layers },
    { id: 'property', label: 'Property & Land', icon: Home },
    { id: 'vehicle', label: 'Vehicles & RTO', icon: Car },
    { id: 'hospital_insurance', label: 'Health & Insurance', icon: Hospital },
    { id: 'pf_pension', label: 'PF & EPFO', icon: Briefcase },
    { id: 'loans', label: 'Loans & Mortgages', icon: Banknote },
    { id: 'govt_schemes', label: 'Govt Schemes', icon: Sparkles },
    { id: 'legal_life', label: 'Life & Legal', icon: Scale },
];
export const CategoryFilter = ({ activeCategory, onSelectCategory, categoryCounts, }) => {
    return (<div className="py-4 border-b border-white/10 bg-[#14142e]/70 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const count = categoryCounts[cat.id] || 0;
            const isActive = activeCategory === cat.id;
            return (<button key={cat.id} onClick={() => onSelectCategory(cat.id)} className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${isActive
                    ? 'bg-slate-900 text-white shadow-md shadow-black/10 scale-[1.02]'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}/>
                <span>{cat.label}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/10 text-slate-300'}`}>
                  {count}
                </span>
              </button>);
        })}
        </div>
      </div>
    </div>);
};
