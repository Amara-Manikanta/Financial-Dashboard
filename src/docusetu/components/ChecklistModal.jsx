import { createPortal } from 'react-dom';
import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { X, Check, Clock, Building2, ExternalLink, AlertTriangle, Share2, Printer, RotateCcw, CheckCheck, FileText, MapPin, ShieldAlert, ListOrdered, FileCheck2 } from 'lucide-react';
import { getScenarioStats, generateWhatsAppSummary } from '../utils/storage';
import { evaluateEligibility } from '../utils/eligibility';
import { SchemeStatusControl } from './SchemeStatusControl';
export const ChecklistModal = ({ scenario, onClose, progressMap, onToggleClaimed, onUpdateNote, onMarkAll, onReset, selectedMember, schemeStatus, onStatusChange, }) => {
    if (!scenario)
        return null;
    const [activeTab, setActiveTab] = useState('checklist');
    const [docFilter, setDocFilter] = useState('all');
    const scenarioProgress = progressMap[scenario.id] || {};
    const stats = getScenarioStats(scenario.id, scenario.documents, progressMap);
    const eligibility = selectedMember ? evaluateEligibility(scenario, selectedMember) : null;
    // Trigger celebration confetti when all documents are claimed
    useEffect(() => {
        if (stats.isComplete && stats.totalCount > 0) {
            try {
                confetti({
                    particleCount: 80,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#10b981', '#06b6d4', '#6366f1'],
                });
            }
            catch (err) {
                // Safe fallback
            }
        }
    }, [stats.isComplete]);
    // Document formatting helper
    const renderTypeBadge = (type) => {
        switch (type) {
            case 'original':
                return (<span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30">
            Original Required
          </span>);
            case 'xerox_self_attested':
                return (<span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
            Self-Attested Photocopy
          </span>);
            case 'digital_portal':
                return (<span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            Digital / Portal E-Copy
          </span>);
            case 'notary':
                return (<span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
            Notarized Stamp Paper
          </span>);
            case 'affidavit':
                return (<span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            Sworn Affidavit
          </span>);
            default:
                return null;
        }
    };
    const renderImportanceBadge = (importance) => {
        switch (importance) {
            case 'mandatory':
                return (<span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-red-500/15 text-red-200">
            Mandatory
          </span>);
            case 'conditional':
                return (<span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-200">
            Conditional
          </span>);
            case 'recommended':
                return (<span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-white/5 text-slate-200">
            Recommended
          </span>);
        }
    };
    const filteredDocs = scenario.documents.filter((doc) => {
        const isClaimed = !!scenarioProgress[doc.id]?.isClaimed;
        if (docFilter === 'claimed')
            return isClaimed;
        if (docFilter === 'pending')
            return !isClaimed;
        return true;
    });
    const handleWhatsAppShare = () => {
        const encoded = generateWhatsAppSummary(scenario, progressMap);
        window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    };
    const handlePrint = () => {
        window.print();
    };
    return createPortal(<div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-[#14142e] rounded-2xl md:rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-white/10 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-7 relative border-b border-slate-800">
          <button onClick={onClose} className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors no-print" aria-label="Close modal">
            <X className="w-5 h-5"/>
          </button>

          <div className="pr-12">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {scenario.badge}
              </span>
              {scenario.urgency === 'emergency' && (<span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                  Emergency High-Stress Checklist
                </span>)}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {scenario.title}
            </h2>
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">
              {scenario.subtitle}
            </p>

            {selectedMember
                ? <SchemeStatusControl statusMap={schemeStatus} member={selectedMember} scenarioId={scenario.id} onChange={onStatusChange} detailed/>
                : <p className="mt-3 text-xs text-slate-400">Pick a family member above to record this scheme's status for them.</p>}

            {/* Selected Family Member Eligibility Banner */}
            {selectedMember && eligibility && (<div className={`mt-3 p-3 rounded-xl text-xs border flex items-start space-x-2.5 ${eligibility.status === 'eligible'
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                : eligibility.status === 'conditional'
                    ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-200 border-rose-500/40'}`}>
                <div className="font-bold whitespace-nowrap">
                  {eligibility.status === 'eligible'
                ? `Eligible for ${selectedMember.name}`
                : eligibility.status === 'conditional'
                    ? `Conditional for ${selectedMember.name}`
                    : `Ineligible for ${selectedMember.name}`}
                  :
                </div>
                <div className="leading-snug">{eligibility.reason}</div>
              </div>)}

            <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-slate-300">
              <div className="flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-emerald-400"/>
                <span>Typical TAT: <strong>{scenario.estimatedTAT}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-slate-400"/>
                <span>Dept: <strong>{scenario.officialDepartment}</strong></span>
              </div>
              {scenario.officialPortalUrl && (<a href={scenario.officialPortalUrl} target="_blank" rel="noreferrer" className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 underline font-medium no-print">
                  <span>Official Portal</span>
                  <ExternalLink className="w-3.5 h-3.5"/>
                </a>)}
            </div>
          </div>

          {/* Live Progress Bar Inside Header */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs sm:text-sm font-semibold mb-2">
              <div className="flex items-center space-x-2">
                <FileCheck2 className="w-4 h-4 text-emerald-400"/>
                <span className="text-slate-200">
                  Claimed: {stats.claimedCount} of {stats.totalCount} Documents
                </span>
              </div>
              <span className={`font-black ${stats.isComplete ? 'text-emerald-400' : 'text-slate-300'}`}>
                {stats.percentage}% Complete {stats.isComplete && '🎉 All Claimed!'}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/80">
              <div className={`h-full transition-all duration-500 rounded-full ${stats.isComplete
            ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
            : 'bg-gradient-to-r from-indigo-500 via-teal-400 to-emerald-400'}`} style={{ width: `${stats.percentage}%` }}/>
            </div>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 sm:px-7 bg-white/[0.03] no-print">
          <div className="flex space-x-4 sm:space-x-8">
            <button onClick={() => setActiveTab('checklist')} className={`py-3.5 text-sm font-bold border-b-2 flex items-center space-x-2 transition-colors ${activeTab === 'checklist'
            ? 'border-emerald-600 text-emerald-300'
            : 'border-transparent text-slate-400 hover:text-slate-100'}`}>
              <FileText className="w-4 h-4"/>
              <span>Document Checklist</span>
              <span className="text-xs bg-white/10 text-slate-200 px-2 py-0.5 rounded-full">
                {scenario.documents.length}
              </span>
            </button>

            <button onClick={() => setActiveTab('due_diligence')} className={`py-3.5 text-sm font-bold border-b-2 flex items-center space-x-2 transition-colors ${activeTab === 'due_diligence'
            ? 'border-emerald-600 text-emerald-300'
            : 'border-transparent text-slate-400 hover:text-slate-100'}`}>
              <ShieldAlert className="w-4 h-4 text-amber-500"/>
              <span>Due Diligence & Red Flags</span>
            </button>

            <button onClick={() => setActiveTab('workflow')} className={`py-3.5 text-sm font-bold border-b-2 flex items-center space-x-2 transition-colors ${activeTab === 'workflow'
            ? 'border-emerald-600 text-emerald-300'
            : 'border-transparent text-slate-400 hover:text-slate-100'}`}>
              <ListOrdered className="w-4 h-4 text-indigo-500"/>
              <span>Process Roadmap</span>
            </button>
          </div>

          {/* Quick Toolbar (Share & Print) */}
          <div className="hidden sm:flex items-center space-x-2">
            <button onClick={handleWhatsAppShare} className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold transition-colors" title="Share formatted checklist via WhatsApp">
              <Share2 className="w-3.5 h-3.5"/>
              <span>WhatsApp</span>
            </button>
            <button onClick={handlePrint} className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10 text-xs font-semibold transition-colors" title="Print checklist">
              <Printer className="w-3.5 h-3.5"/>
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">

          {/* TAB 1: DOCUMENT CHECKLIST */}
          {activeTab === 'checklist' && (<div>
              {/* Filter and Bulk Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10 no-print">
                {/* Filter Pills */}
                <div className="flex items-center space-x-1.5 bg-white/5 p-1 rounded-xl">
                  <button onClick={() => setDocFilter('all')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${docFilter === 'all'
                ? 'bg-[#14142e] text-white shadow-sm'
                : 'text-slate-300 hover:text-white'}`}>
                    All ({scenario.documents.length})
                  </button>
                  <button onClick={() => setDocFilter('pending')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${docFilter === 'pending'
                ? 'bg-[#14142e] text-amber-300 shadow-sm'
                : 'text-slate-300 hover:text-white'}`}>
                    Pending ({scenario.documents.length - stats.claimedCount})
                  </button>
                  <button onClick={() => setDocFilter('claimed')} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${docFilter === 'claimed'
                ? 'bg-[#14142e] text-emerald-300 shadow-sm'
                : 'text-slate-300 hover:text-white'}`}>
                    Claimed ({stats.claimedCount})
                  </button>
                </div>

                {/* Bulk Actions */}
                <div className="flex items-center space-x-2">
                  <button onClick={() => onMarkAll(scenario.id, true)} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium transition-colors">
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400"/>
                    <span>Claim All</span>
                  </button>
                  <button onClick={() => onReset(scenario.id)} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium transition-colors">
                    <RotateCcw className="w-3.5 h-3.5 text-rose-500"/>
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Document Items List */}
              <div className="mt-4 space-y-4">
                {filteredDocs.length === 0 ? (<div className="text-center py-12 bg-white/[0.03] rounded-2xl border border-dashed border-white/15">
                    <FileCheck2 className="w-10 h-10 text-slate-400 mx-auto mb-2"/>
                    <p className="text-slate-300 font-semibold text-sm">
                      {docFilter === 'claimed' ? 'No claimed documents yet.' : 'All documents have been claimed!'}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      {docFilter === 'claimed' ? 'Tick the checkboxes as you collect your papers.' : 'Great job completing this dossier!'}
                    </p>
                  </div>) : (filteredDocs.map((doc) => {
                const isClaimed = !!scenarioProgress[doc.id]?.isClaimed;
                const personalNote = scenarioProgress[doc.id]?.personalNote || '';
                return (<div key={doc.id} className={`rounded-2xl border transition-all duration-200 p-4 sm:p-5 ${isClaimed
                        ? 'bg-emerald-500/5 border-emerald-500/30 shadow-sm'
                        : 'bg-[#14142e] border-white/10 hover:border-white/15 hover:shadow-md'}`}>
                        <div className="flex items-start gap-3 sm:gap-4">
                          
                          {/* BIG INTERACTIVE CHECKBOX FOR CLAIMING */}
                          <button type="button" onClick={() => onToggleClaimed(scenario.id, doc.id)} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center flex-shrink-0 transition-all duration-200 cursor-pointer mt-0.5 ${isClaimed
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-105'
                        : 'bg-[#14142e] border-white/15 hover:border-emerald-500 text-transparent hover:bg-emerald-500/10'}`} aria-label={`Mark ${doc.title} as ${isClaimed ? 'pending' : 'claimed'}`}>
                            <Check className={`w-4 h-4 sm:w-5 sm:h-5 stroke-[3] ${isClaimed ? 'text-white' : 'text-slate-300'}`}/>
                          </button>

                          {/* Content */}
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              {renderImportanceBadge(doc.importance)}
                              {renderTypeBadge(doc.type)}
                              {doc.estimatedFee && (<span className="text-[11px] font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                                  Fee: {doc.estimatedFee}
                                </span>)}
                              {doc.validity && (<span className="text-[11px] font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                                  Validity: {doc.validity}
                                </span>)}
                            </div>

                            <h4 className={`text-base font-bold transition-colors ${isClaimed ? 'text-emerald-100 line-through decoration-emerald-500/60' : 'text-white'}`}>
                              {doc.title}
                            </h4>

                            <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                              {doc.description}
                            </p>

                            {/* Where to get */}
                            <div className="mt-2.5 flex items-center space-x-1.5 text-xs text-slate-300 bg-white/5 px-3 py-1.5 rounded-lg inline-flex">
                              <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0"/>
                              <span><strong>Where to get:</strong> {doc.whereToGet}</span>
                            </div>

                            {/* Common Rejection Pitfall Callout */}
                            {doc.commonRejectionPitfall && (<div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-100 flex items-start space-x-2.5">
                                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"/>
                                <div>
                                  <span className="font-bold text-amber-100">Common Rejection Trap: </span>
                                  <span>{doc.commonRejectionPitfall}</span>
                                </div>
                              </div>)}

                            {/* Personal Note & Physical Location Field */}
                            <div className="mt-3 pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center gap-2">
                              <label className="text-xs font-semibold text-slate-400 whitespace-nowrap">
                                📍 Location / Note:
                              </label>
                              <input type="text" value={personalNote} onChange={(e) => onUpdateNote(scenario.id, doc.id, e.target.value)} placeholder="e.g. In Godrej locker box #2, or Digilocker doc URI..." className="flex-1 text-xs px-3 py-1.5 bg-white/[0.03] focus:bg-[#14142e] border border-white/10 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"/>
                            </div>

                          </div>
                        </div>
                      </div>);
            }))}
              </div>
            </div>)}

          {/* TAB 2: DUE DILIGENCE & RED FLAGS */}
          {activeTab === 'due_diligence' && (<div className="space-y-6">
              <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded-r-xl">
                <div className="flex items-center space-x-2 text-amber-100 font-bold text-sm mb-1">
                  <ShieldAlert className="w-4 h-4 text-amber-400"/>
                  <span>Crucial Verification Before Proceeding</span>
                </div>
                <p className="text-xs text-amber-200 leading-relaxed">
                  Most financial losses, fraud, and government claim rejections happen due to skipping basic preliminary verification. Review these golden rules:
                </p>
              </div>

              <div className="space-y-3">
                {scenario.dueDiligenceTips.map((tip, idx) => (<div key={idx} className="flex items-start space-x-3 p-4 bg-white/[0.03] rounded-xl border border-white/10">
                    <div className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-200 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <p className="text-sm text-slate-100 font-medium leading-relaxed">
                      {tip}
                    </p>
                  </div>))}
              </div>

              <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl text-xs space-y-2">
                <p className="font-bold text-emerald-400 text-sm">💡 Pro-Tip for Verification:</p>
                <p>
                  Never make substantial financial payments (tokens, full booking, settlement cash) until an independent legal advisor has physically examined the original parent deeds and verified the online revenue portal status.
                </p>
              </div>
            </div>)}

          {/* TAB 3: STEP-BY-STEP WORKFLOW */}
          {activeTab === 'workflow' && (<div className="space-y-4">
              <p className="text-xs text-slate-400">
                Follow this chronological sequence to ensure you don’t miss dependent approvals or statutory deadlines:
              </p>

              <div className="relative pl-6 border-l-2 border-emerald-500 space-y-6 my-4">
                {scenario.stepByStepWorkflow.map((step, idx) => (<div key={idx} className="relative group">
                    {/* Number dot */}
                    <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-emerald-500/30">
                      {idx + 1}
                    </div>
                    <div className="bg-white/[0.03] rounded-xl p-4 border border-white/10 group-hover:border-emerald-300 transition-colors">
                      <p className="text-sm font-semibold text-white">
                        {step}
                      </p>
                    </div>
                  </div>))}
              </div>
            </div>)}

        </div>

        {/* Modal Footer */}
        <div className="bg-white/[0.03] p-4 sm:px-7 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-400 font-medium">
            Saved automatically in your browser’s secure offline storage.
          </div>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors shadow-md ml-auto">
            Done & Close
          </button>
        </div>

      </div>
    </div>, document.body);
};
