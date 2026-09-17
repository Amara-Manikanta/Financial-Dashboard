import { createPortal } from 'react-dom';
import React, { useState } from 'react';
import { X, UserPlus, Trash2, Users } from 'lucide-react';
export const AddMemberModal = ({ isOpen, onClose, members, onAddMember, onDeleteMember, }) => {
    if (!isOpen)
        return null;
    const [name, setName] = useState('');
    const [relationship, setRelationship] = useState('child_girl');
    const [age, setAge] = useState(5);
    const [gender, setGender] = useState('female');
    const [occupation, setOccupation] = useState('student');
    const [isTaxPayer, setIsTaxPayer] = useState(false);
    // Preset helpers when relationship changes
    const handleRelationshipChange = (rel) => {
        setRelationship(rel);
        if (rel === 'child_girl') {
            setGender('female');
            setAge(5);
            setOccupation('student');
            setIsTaxPayer(false);
        }
        else if (rel === 'child_boy') {
            setGender('male');
            setAge(5);
            setOccupation('student');
            setIsTaxPayer(false);
        }
        else if (rel === 'father') {
            setGender('male');
            setAge(65);
            setOccupation('retired');
            setIsTaxPayer(false);
        }
        else if (rel === 'mother') {
            setGender('female');
            setAge(62);
            setOccupation('homemaker');
            setIsTaxPayer(false);
        }
    };
    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!name.trim())
            return;
        const colors = [
            'from-emerald-500 to-teal-700',
            'from-rose-400 to-pink-600',
            'from-indigo-500 to-purple-600',
            'from-amber-400 to-orange-600',
            'from-sky-400 to-blue-600',
        ];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const newMember = {
            id: `member-${Date.now()}`,
            name: name.trim(),
            relationship,
            age: Number(age),
            gender,
            occupation,
            isTaxPayer,
            avatarColor: randomColor,
        };
        onAddMember(newMember);
        setName('');
    };
    return createPortal(<div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#14142e] rounded-3xl shadow-2xl max-w-2xl w-full border border-white/10 overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-6 relative flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Users className="w-5 h-5"/>
            </div>
            <div>
              <h3 className="text-xl font-black text-white">
                Family Profile Manager
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Add your family members to unlock person-specific government schemes & eligibility.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          
          {/* Section 1: Current Family Members */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Existing Family Profiles ({members.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {members.map((member) => (<div key={member.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white bg-gradient-to-tr ${member.avatarColor || 'from-indigo-500 to-purple-600'}`}>
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center space-x-1.5">
                        <span>{member.name}</span>
                        <span className="text-[11px] font-normal text-slate-400">
                          ({member.age} yrs)
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                        <span className="capitalize">{member.occupation}</span>
                        <span>•</span>
                        <span className={member.isTaxPayer ? 'text-indigo-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                          {member.isTaxPayer ? 'Taxpayer' : 'Non-Taxpayer'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {member.relationship !== 'self' && (<button onClick={() => onDeleteMember(member.id)} className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors" title="Remove member">
                      <Trash2 className="w-4 h-4"/>
                    </button>)}
                </div>))}
            </div>
          </div>

          {/* Section 2: Add New Member Form */}
          <form onSubmit={handleFormSubmit} className="bg-white/[0.03] border border-white/10 rounded-3xl p-5 space-y-4">
            <div className="flex items-center space-x-2 text-white font-extrabold text-sm border-b border-white/10 pb-2">
              <UserPlus className="w-4 h-4 text-emerald-400"/>
              <span>Add a New Family Member</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Full Name / Title *
                </label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daughter (Aanya) or Father (Rao)" className="w-full text-xs px-3.5 py-2.5 bg-[#14142e] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
              </div>

              {/* Relationship */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Relationship *
                </label>
                <select value={relationship} onChange={(e) => handleRelationshipChange(e.target.value)} className="w-full text-xs px-3.5 py-2.5 bg-[#14142e] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="child_girl">Daughter (Child Girl)</option>
                  <option value="child_boy">Son (Child Boy)</option>
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="spouse">Spouse</option>
                  <option value="other">Other Relative</option>
                </select>
              </div>

              {/* Age */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Age (Years) *
                </label>
                <input type="number" required min={0} max={120} value={age} onChange={(e) => setAge(Number(e.target.value))} className="w-full text-xs px-3.5 py-2.5 bg-[#14142e] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Gender *
                </label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full text-xs px-3.5 py-2.5 bg-[#14142e] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Occupation */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Occupation / Status *
                </label>
                <select value={occupation} onChange={(e) => setOccupation(e.target.value)} className="w-full text-xs px-3.5 py-2.5 bg-[#14142e] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="student">Student / Minor</option>
                  <option value="homemaker">Homemaker</option>
                  <option value="retired">Retired / Senior</option>
                  <option value="salaried">Corporate / Salaried</option>
                  <option value="business">Business / Self-Employed</option>
                  <option value="farmer">Farmer / Agriculture</option>
                  <option value="unorganized">Unorganized / Gig Worker</option>
                </select>
              </div>

              {/* Tax Payer Toggle */}
              <div className="flex items-center sm:pt-6">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input type="checkbox" checked={isTaxPayer} onChange={(e) => setIsTaxPayer(e.target.checked)} className="w-4 h-4 text-emerald-400 rounded border-white/15 focus:ring-emerald-500"/>
                  <span className="text-xs font-bold text-slate-200">
                    Files Income Tax Return (ITR Payer)
                  </span>
                </label>
              </div>

            </div>

            <button type="submit" className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-bold text-xs transition-colors shadow-md flex items-center justify-center space-x-2">
              <UserPlus className="w-4 h-4"/>
              <span>Save & Add Member to Dashboard</span>
            </button>
          </form>

        </div>

        {/* Footer */}
        <div className="p-4 bg-white/[0.03] border-t border-white/10 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors">
            Done
          </button>
        </div>

      </div>
    </div>, document.body);
};
