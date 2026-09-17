import React from 'react';
import { Clock, FileText, CheckCircle, ChevronRight, AlertCircle, Home, Trees, Car, ShieldCheck, Briefcase, Wallet, Building2, Building2 as Hospital, Receipt, Banknote, Key, Sparkles, HeartPulse, Feather, Plane, TrendingUp, Landmark, PiggyBank, Check, X, AlertTriangle } from 'lucide-react';
import { getScenarioStats } from '../utils/storage';
import { evaluateEligibility } from '../utils/eligibility';
import { SchemeStatusControl } from './SchemeStatusControl';
import { statusesForScenario, statusMeta } from '../utils/schemeStatus';
const ICON_MAP = {
    Home,
    Trees,
    Car,
    ShieldCheck,
    Briefcase,
    Wallet,
    Hospital,
    Receipt,
    Banknote,
    Key,
    Sparkles,
    HeartPulse,
    Feather,
    Plane,
    TrendingUp,
    Landmark,
    PiggyBank,
};
export const ScenarioCard = ({ scenario, progressMap, onOpen, selectedMember, schemeStatus, familyMembers = [], onStatusChange, }) => {
    const IconComponent = ICON_MAP[scenario.icon] || FileText;
    const stats = getScenarioStats(scenario.id, scenario.documents, progressMap);
    const eligibility = selectedMember ? evaluateEligibility(scenario, selectedMember) : null;
    const getUrgencyBadge = () => {
        if (scenario.urgency === 'emergency') {
            return (<span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 animate-pulse">
          <AlertCircle className="w-3 h-3"/>
          <span>URGENT / CRITICAL</span>
        </span>);
        }
        if (scenario.urgency === 'high') {
            return (<span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-200 border border-amber-500/30">
          <span>Priority</span>
        </span>);
        }
        return null;
    };
    return (<div onClick={() => onOpen(scenario)} className="bg-[#14142e] rounded-2xl border border-white/10 hover:border-emerald-500/40 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col justify-between group">
      <div>
        {/* Top Badges & Icon */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/[0.03] to-white/5 border border-white/10 flex items-center justify-center text-slate-200 group-hover:bg-emerald-500/10 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors shadow-inner">
            <IconComponent className="w-6 h-6"/>
          </div>
          <div className="flex flex-col items-end space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-white/5 px-2.5 py-0.5 rounded-full">
              {scenario.badge}
            </span>
            {getUrgencyBadge()}
          </div>
        </div>

        {/* Titles */}
        <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors leading-snug mb-1">
          {scenario.title}
        </h3>
        <p className="text-sm text-slate-400 line-clamp-2 mb-4 leading-relaxed">
          {scenario.subtitle}
        </p>

        {/* Quick Meta */}
        <div className="space-y-1.5 text-xs text-slate-400 mb-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"/>
            <span className="font-medium text-slate-200">Timeline:</span>
            <span>{scenario.estimatedTAT}</span>
          </div>
          <div className="flex items-center space-x-2 truncate">
            <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"/>
            <span className="truncate">{scenario.officialDepartment}</span>
          </div>
        </div>

        {/* Person Specific Eligibility Callout */}
        {selectedMember && eligibility && (<div className={`mb-4 p-2.5 rounded-xl text-xs border flex items-start space-x-2 transition-all ${eligibility.status === 'eligible'
                ? 'bg-emerald-500/10 text-emerald-100 border-emerald-500/30'
                : eligibility.status === 'conditional'
                    ? 'bg-amber-500/10 text-amber-100 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-100 border-rose-500/30'}`}>
            {eligibility.status === 'eligible' && (<div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 stroke-[3]"/>
              </div>)}
            {eligibility.status === 'conditional' && (<div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-3 h-3 stroke-[3]"/>
              </div>)}
            {eligibility.status === 'ineligible' && (<div className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <X className="w-3 h-3 stroke-[3]"/>
              </div>)}
            <div className="leading-snug">
              <span className="font-bold">
                {eligibility.status === 'eligible'
                ? `Eligible for ${selectedMember.name}`
                : eligibility.status === 'conditional'
                    ? `Conditional`
                    : `Not Eligible`}
                :
              </span>{' '}
              <span className="opacity-90">{eligibility.reason}</span>
            </div>
          </div>)}
      </div>

      {/* Progress & Tick Status Bar */}
      <div>
        {selectedMember
            ? <SchemeStatusControl statusMap={schemeStatus} member={selectedMember} scenarioId={scenario.id} onChange={onStatusChange}/>
            : (() => {
                const rows = statusesForScenario(schemeStatus, familyMembers, scenario.id);
                return rows.length > 0 && (<div className="mb-3 flex flex-wrap gap-1.5">
                  {rows.map(({ member, entry }) => (<span key={member.id} className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusMeta(entry.status).chip}`}>
                      {member.name}: {statusMeta(entry.status).label}
                    </span>))}
                </div>);
            })()}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3.5 mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <div className="flex items-center space-x-1.5">
              {stats.isComplete ? (<CheckCircle className="w-4 h-4 text-emerald-400"/>) : (<FileText className="w-3.5 h-3.5 text-slate-400"/>)}
              <span className={stats.isComplete ? 'text-emerald-300 font-bold' : 'text-slate-200'}>
                {stats.claimedCount} of {stats.totalCount} Documents Claimed
              </span>
            </div>
            <span className={`font-extrabold ${stats.isComplete ? 'text-emerald-400' : stats.claimedCount > 0 ? 'text-indigo-400' : 'text-slate-400'}`}>
              {stats.percentage}%
            </span>
          </div>

          {/* Progress bar line */}
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div className={`h-full transition-all duration-500 rounded-full ${stats.isComplete
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
            : stats.claimedCount > 0
                ? 'bg-gradient-to-r from-indigo-500 to-emerald-500'
                : 'bg-white/20'}`} style={{ width: `${stats.percentage}%` }}/>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs font-semibold text-slate-300 group-hover:text-emerald-400">
          <span>{stats.isComplete ? 'Checklist Completed' : 'Manage Checklist'}</span>
          <div className="flex items-center space-x-1">
            <span>Open</span>
            <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform"/>
          </div>
        </div>
      </div>
    </div>);
};
