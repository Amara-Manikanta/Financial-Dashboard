import React from 'react';
import { Users, UserPlus, ShieldCheck, Sparkles } from 'lucide-react';
export const FamilyBar = ({ members, selectedMemberId, onSelectMember, onOpenAddModal, eligibleCount, totalCount, }) => {
    const activeMember = members.find((m) => m.id === selectedMemberId) || null;
    return (<div className="bg-slate-900 border-b border-slate-800 text-white py-3.5 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left Label & Member Switcher */}
        <div className="flex items-center space-x-3 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center space-x-2 pr-2 border-r border-slate-800 flex-shrink-0">
            <Users className="w-4 h-4 text-emerald-400"/>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Family Mode:
            </span>
          </div>

          {/* "All Family" Button */}
          <button onClick={() => onSelectMember(null)} className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${selectedMemberId === null
            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
            <span>All Family Overview</span>
          </button>

          {/* Member Chips */}
          {members.map((member) => {
            const isSelected = selectedMemberId === member.id;
            return (<button key={member.id} onClick={() => onSelectMember(member.id)} className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex-shrink-0 border ${isSelected
                    ? 'bg-[#14142e] text-white border-emerald-400 shadow-md scale-105'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white bg-gradient-to-tr ${member.avatarColor || 'from-indigo-500 to-purple-600'}`}>
                  {member.name.charAt(0)}
                </div>
                <span>{member.name}</span>
                <span className="text-[10px] opacity-75">
                  ({member.age}y, {member.occupation})
                </span>
                {member.isTaxPayer ? (<span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-900/50 text-indigo-300 border border-indigo-700/50">
                    ITR
                  </span>) : (<span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-700/50">
                    Non-Tax
                  </span>)}
              </button>);
        })}

          {/* Add Member Button */}
          <button onClick={onOpenAddModal} className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all flex-shrink-0">
            <UserPlus className="w-3.5 h-3.5"/>
            <span>+ Add Member</span>
          </button>
        </div>

        {/* Right Info: Live Filter Context */}
        {activeMember ? (<div className="flex items-center space-x-2 text-xs bg-slate-800/80 border border-slate-700 px-3.5 py-1.5 rounded-xl flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin" style={{ animationDuration: '4s' }}/>
            <span className="text-slate-300">
              Schemes for <strong className="text-white">{activeMember.name}</strong>:
            </span>
            <span className="font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {eligibleCount} of {totalCount} Matched
            </span>
          </div>) : (<div className="text-xs text-slate-400 flex items-center space-x-1.5 flex-shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400"/>
            <span>Click any family member above to filter schemes tailored for them.</span>
          </div>)}

      </div>
    </div>);
};
