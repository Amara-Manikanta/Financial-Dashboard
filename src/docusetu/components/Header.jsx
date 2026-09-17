import React from 'react';
import { Compass, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
export const Header = ({ searchQuery, onSearchChange, onOpenEmergency, totalClaimed, totalDocs, activeScenarios, }) => {
    return (<header className="rounded-2xl overflow-hidden bg-slate-900 text-white shadow-xl border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          
          {/* Logo & Brand (with left padding for macOS native window controls) */}
          <div className="flex items-center space-x-3 cursor-pointer group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Compass className="w-6 h-6 text-white"/>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  DocuSetu
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Citizen Dossier
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                The Operating Guide for Critical Paperwork & Milestones
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-lg hidden md:block">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400"/>
              </div>
              <input type="text" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search any situation, document, form (e.g. Form 29, Sukanya, Cashless)..." className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"/>
              {searchQuery && (<button onClick={() => onSearchChange('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-white">
                  Clear
                </button>)}
            </div>
          </div>

          {/* Right Action: Emergency Mode + Global Claim Stats */}
          <div className="flex items-center space-x-3">
            <button onClick={onOpenEmergency} className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 hover:text-rose-200 transition-all font-medium text-xs sm:text-sm animate-pulse" title="Quick access for hospital emergencies and sudden events">
              <AlertCircle className="w-4 h-4 text-rose-400"/>
              <span className="hidden sm:inline">Emergency Mode</span>
              <span className="sm:hidden">Urgent</span>
            </button>

            {/* Claimed Tracker Badge */}
            <div className="hidden lg:flex items-center space-x-3 bg-slate-800/90 border border-slate-700 px-3.5 py-1.5 rounded-xl text-xs">
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400"/>
                <div>
                  <span className="text-slate-400">Claimed: </span>
                  <span className="font-bold text-white">
                    {totalClaimed}/{totalDocs}
                  </span>
                </div>
              </div>
              <div className="border-l border-slate-700 pl-2 text-slate-400 text-[11px]">
                {activeScenarios} Active
              </div>
            </div>
          </div>

        </div>

        {/* Mobile Search Bar */}
        <div className="pb-4 md:hidden">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400"/>
            </div>
            <input type="text" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search documents, forms, schemes..." className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
          </div>
        </div>

      </div>
    </header>);
};
