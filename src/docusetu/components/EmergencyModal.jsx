import { createPortal } from 'react-dom';
import React from 'react';
import { X, AlertCircle, ArrowRight, ShieldAlert, PhoneCall } from 'lucide-react';
export const EmergencyModal = ({ isOpen, onClose, onSelectScenario, emergencyScenarios, }) => {
    if (!isOpen)
        return null;
    return createPortal(<div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#14142e] rounded-3xl shadow-2xl max-w-2xl w-full border border-rose-500/30 overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 text-white p-6 relative">
          <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center text-white transition-colors">
            <X className="w-5 h-5"/>
          </button>

          <div className="flex items-center space-x-2 text-rose-200 text-xs font-bold uppercase tracking-wider mb-2">
            <AlertCircle className="w-4 h-4 text-rose-300"/>
            <span>High-Priority Protocol</span>
          </div>

          <h3 className="text-2xl font-black text-white">
            🚨 Emergency & Critical Action Mode
          </h3>
          <p className="text-xs text-rose-100 mt-1 max-w-lg leading-relaxed">
            When minutes matter or during sudden family crises, skip the searching. Here are the immediate protocols you must execute within the first 24 hours.
          </p>
        </div>

        {/* Emergency Situations List */}
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          {emergencyScenarios.map((sc) => (<div key={sc.id} className="bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/30 hover:border-rose-300 rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-rose-200 bg-rose-500/15 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {sc.badge}
                  </span>
                  <span className="text-xs text-rose-300 font-bold">
                    TAT: {sc.estimatedTAT}
                  </span>
                </div>

                <h4 className="text-base font-bold text-white mb-1">
                  {sc.title}
                </h4>
                <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                  {sc.subtitle}
                </p>

                {/* Top Critical Action from due diligence */}
                <div className="bg-[#14142e]/90 border border-rose-500/30 rounded-xl p-3 text-xs text-slate-100 mb-3 space-y-1">
                  <p className="font-bold text-rose-100 flex items-center space-x-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400"/>
                    <span>Immediate First Step:</span>
                  </p>
                  <p className="text-slate-200 font-medium leading-relaxed">
                    {sc.dueDiligenceTips[0] || sc.stepByStepWorkflow[0]}
                  </p>
                </div>
              </div>

              <button onClick={() => {
                onSelectScenario(sc.id);
                onClose();
            }} className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow">
                <span>Open Complete Emergency Checklist & Tick Docs</span>
                <ArrowRight className="w-4 h-4"/>
              </button>
            </div>))}

          {/* Quick Helplines Box */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-xs space-y-2">
            <h5 className="font-bold text-white flex items-center space-x-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-slate-300"/>
              <span>National Citizen Emergency Helplines</span>
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-300 pt-1">
              <div className="bg-[#14142e] p-2 rounded-lg border border-white/10">
                <span className="text-slate-400 block">Ambulance:</span>
                <span className="font-bold text-white">108 / 102</span>
              </div>
              <div className="bg-[#14142e] p-2 rounded-lg border border-white/10">
                <span className="text-slate-400 block">National Emergency:</span>
                <span className="font-bold text-white">112</span>
              </div>
              <div className="bg-[#14142e] p-2 rounded-lg border border-white/10">
                <span className="text-slate-400 block">Cyber Fraud Helpline:</span>
                <span className="font-bold text-white">1930</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/[0.03] border-t border-white/10 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>, document.body);
};
