import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFinance } from '../context/FinanceContext';
import { CheckCircle2, FolderCheck, ShieldCheck, Sparkles, ExternalLink, Search, Filter, Check, Compass } from 'lucide-react';
import { SCENARIOS } from './data/scenarios';
import { getOverallStats } from './utils/storage';
import { SCHEME_STATUSES, getSchemeStatus, setSchemeStatus, statusMeta } from './utils/schemeStatus';
import { DEFAULT_FAMILY_MEMBERS, evaluateEligibility } from './utils/eligibility';
import { Header } from './components/Header';
import { FamilyBar } from './components/FamilyBar';
import { CategoryFilter } from './components/CategoryFilter';
import { ScenarioCard } from './components/ScenarioCard';
import { ChecklistModal } from './components/ChecklistModal';
import { EmergencyModal } from './components/EmergencyModal';
import { AddMemberModal } from './components/AddMemberModal';
export const App = () => {
    const { docuSetu, saveDocuSetu, loadError } = useFinance();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [selectedScenarioId, setSelectedScenarioId] = useState(null);
    const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [eligibleOnlyFilter, setEligibleOnlyFilter] = useState(false);
    const [progressMap, setProgressMap] = useState({});
    const [schemeStatus, setSchemeStatusMap] = useState({});
    const [statusFilter, setStatusFilter] = useState('all');
    const [familyMembers, setFamilyMembers] = useState(DEFAULT_FAMILY_MEMBERS);
    // Selected Family Member ID (Defaults to self)
    const [selectedMemberId, setSelectedMemberId] = useState('member-self');
    // Seed once from the database; until then nothing is written back, so an
    // empty screen can never overwrite saved checklists.
    const hydrated = useRef(false);
    useEffect(() => {
        if (hydrated.current || docuSetu === null) return;
        setProgressMap(docuSetu.progress || {});
        setSchemeStatusMap(docuSetu.schemeStatus || {});
        setFamilyMembers(docuSetu.familyMembers?.length ? docuSetu.familyMembers : DEFAULT_FAMILY_MEMBERS);
        hydrated.current = true;
    }, [docuSetu]);
    // Notes are typed one key at a time, so writes are debounced.
    useEffect(() => {
        if (!hydrated.current || loadError) return;
        const same = JSON.stringify(docuSetu?.progress || {}) === JSON.stringify(progressMap)
            && JSON.stringify(docuSetu?.schemeStatus || {}) === JSON.stringify(schemeStatus)
            && JSON.stringify(docuSetu?.familyMembers || DEFAULT_FAMILY_MEMBERS) === JSON.stringify(familyMembers);
        if (same) return;
        const t = setTimeout(() => saveDocuSetu({ progress: progressMap, familyMembers, schemeStatus }), 700);
        return () => clearTimeout(t);
    }, [progressMap, familyMembers, schemeStatus]);
    const handleStatusChange = (memberId, scenarioId, patch) => {
        setSchemeStatusMap((prev) => setSchemeStatus(prev, memberId, scenarioId, patch));
    };
    // Active selected family member object
    const selectedMember = useMemo(() => {
        return familyMembers.find((m) => m.id === selectedMemberId) || null;
    }, [familyMembers, selectedMemberId]);
    // Handle adding new family member
    const handleAddMember = (newMember) => {
        setFamilyMembers((prev) => [...prev, newMember]);
        setSelectedMemberId(newMember.id);
    };
    // Handle deleting family member
    const handleDeleteMember = (id) => {
        setFamilyMembers((prev) => prev.filter((m) => m.id !== id));
        if (selectedMemberId === id) {
            setSelectedMemberId('member-self');
        }
    };
    // Handle toggling doc claimed
    const handleToggleClaimed = (scenarioId, docId) => {
        setProgressMap((prev) => {
            const scenarioData = prev[scenarioId] || {};
            const currentDoc = scenarioData[docId] || { isClaimed: false, personalNote: '' };
            return {
                ...prev,
                [scenarioId]: {
                    ...scenarioData,
                    [docId]: {
                        ...currentDoc,
                        isClaimed: !currentDoc.isClaimed,
                        updatedAt: new Date().toISOString(),
                    },
                },
            };
        });
    };
    // Handle updating personal location note
    const handleUpdateNote = (scenarioId, docId, note) => {
        setProgressMap((prev) => {
            const scenarioData = prev[scenarioId] || {};
            const currentDoc = scenarioData[docId] || { isClaimed: false, personalNote: '' };
            return {
                ...prev,
                [scenarioId]: {
                    ...scenarioData,
                    [docId]: {
                        ...currentDoc,
                        personalNote: note,
                        updatedAt: new Date().toISOString(),
                    },
                },
            };
        });
    };
    // Handle marking all docs as claimed
    const handleMarkAll = (scenarioId, claimed) => {
        const targetScenario = SCENARIOS.find((s) => s.id === scenarioId);
        if (!targetScenario)
            return;
        setProgressMap((prev) => {
            const scenarioData = { ...(prev[scenarioId] || {}) };
            targetScenario.documents.forEach((doc) => {
                scenarioData[doc.id] = {
                    isClaimed: claimed,
                    personalNote: scenarioData[doc.id]?.personalNote || '',
                    updatedAt: new Date().toISOString(),
                };
            });
            return {
                ...prev,
                [scenarioId]: scenarioData,
            };
        });
    };
    // Handle resetting scenario progress
    const handleReset = (scenarioId) => {
        if (window.confirm('Are you sure you want to uncheck all documents for this situation?')) {
            setProgressMap((prev) => {
                const updated = { ...prev };
                delete updated[scenarioId];
                return updated;
            });
        }
    };
    // Calculate Category counts
    const categoryCounts = useMemo(() => {
        const counts = {
            all: SCENARIOS.length,
            property: 0,
            vehicle: 0,
            pf_pension: 0,
            hospital_insurance: 0,
            loans: 0,
            govt_schemes: 0,
            legal_life: 0,
        };
        SCENARIOS.forEach((sc) => {
            if (counts[sc.category] !== undefined) {
                counts[sc.category]++;
            }
        });
        return counts;
    }, []);
    // Filter scenarios based on category, search query, and member eligibility
    const filteredScenarios = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return SCENARIOS.filter((sc) => {
            // 1. Category Filter
            const matchesCategory = activeCategory === 'all' || sc.category === activeCategory;
            if (!matchesCategory)
                return false;
            // 2. Member Eligibility Filter (if enabled)
            if (selectedMember && eligibleOnlyFilter) {
                const evalResult = evaluateEligibility(sc, selectedMember);
                if (evalResult.status === 'ineligible') {
                    return false;
                }
            }
            // Scheme status filter: one member's status, or any member's in family view
            if (statusFilter !== 'all') {
                const ids = selectedMember ? [selectedMember.id] : familyMembers.map((m) => m.id);
                if (!ids.some((id) => getSchemeStatus(schemeStatus, id, sc.id).status === statusFilter)) return false;
            }
            // 3. Search Query Filter
            if (!query)
                return true;
            const inTitle = sc.title.toLowerCase().includes(query);
            const inSubtitle = sc.subtitle.toLowerCase().includes(query);
            const inDepartment = sc.officialDepartment.toLowerCase().includes(query);
            const inDocs = sc.documents.some((d) => d.title.toLowerCase().includes(query) ||
                d.description.toLowerCase().includes(query) ||
                (d.commonRejectionPitfall && d.commonRejectionPitfall.toLowerCase().includes(query)));
            return inTitle || inSubtitle || inDepartment || inDocs;
        });
    }, [activeCategory, searchQuery, selectedMember, eligibleOnlyFilter, statusFilter, schemeStatus, familyMembers]);
    const statusCounts = useMemo(() => {
        const ids = selectedMember ? [selectedMember.id] : familyMembers.map((m) => m.id);
        const counts = {};
        SCHEME_STATUSES.forEach((s) => { counts[s.id] = SCENARIOS.filter((sc) => ids.some((id) => getSchemeStatus(schemeStatus, id, sc.id).status === s.id)).length; });
        return counts;
    }, [schemeStatus, selectedMember, familyMembers]);
    // Overall progress stats
    const overallStats = useMemo(() => {
        return getOverallStats(SCENARIOS, progressMap);
    }, [progressMap]);
    // Count how many scenarios are matched/eligible for selected member
    const memberEligibleCount = useMemo(() => {
        if (!selectedMember)
            return 0;
        return SCENARIOS.filter((sc) => {
            const evalResult = evaluateEligibility(sc, selectedMember);
            return evalResult.status === 'eligible' || evalResult.status === 'conditional';
        }).length;
    }, [selectedMember]);
    // Emergency Scenarios (for quick modal)
    const emergencyScenarios = useMemo(() => {
        return SCENARIOS.filter((s) => s.urgency === 'emergency' || s.urgency === 'high');
    }, []);
    // Currently active selected scenario object
    const activeScenario = useMemo(() => {
        return SCENARIOS.find((s) => s.id === selectedScenarioId) || null;
    }, [selectedScenarioId]);
    return (<div className="flex flex-col selection:bg-emerald-500 selection:text-white">
      
      {/* Top Navigation */}
      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} onOpenEmergency={() => setIsEmergencyOpen(true)} totalClaimed={overallStats.totalClaimed} totalDocs={overallStats.totalDocs} activeScenarios={overallStats.activeScenarios}/>

      {/* Family Member Switcher Bar */}
      <FamilyBar members={familyMembers} selectedMemberId={selectedMemberId} onSelectMember={(id) => {
            setSelectedMemberId(id);
            setEligibleOnlyFilter(false);
        }} onOpenAddModal={() => setIsAddMemberOpen(true)} eligibleCount={memberEligibleCount} totalCount={SCENARIOS.length}/>

      {/* Category Pills Bar */}
      <CategoryFilter activeCategory={activeCategory} onSelectCategory={(cat) => {
            setActiveCategory(cat);
            setSearchQuery('');
        }} categoryCounts={categoryCounts}/>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Hero Banner with Live Tracker */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden border border-slate-700/60">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"/>
          <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"/>

          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-3 border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5"/>
              <span>Smart Document & Scheme Companion</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Know Every Document Before You Pay, Sign, or Queue Up.
            </h1>
            
            <p className="text-sm sm:text-base text-slate-300 mt-2.5 leading-relaxed">
              Tailored checklists, official portals, and interactive tick lists for property, vehicles, PF, hospital cashless, bank schemes, and family welfare.
            </p>

            {/* Quick Stat Pill Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-700/80">
              <div className="bg-slate-800/80 backdrop-blur-sm p-3.5 rounded-2xl border border-slate-700/60">
                <div className="text-xs text-slate-400 font-medium flex items-center space-x-1.5 mb-1">
                  <FolderCheck className="w-3.5 h-3.5 text-emerald-400"/>
                  <span>Active Dossiers</span>
                </div>
                <div className="text-lg font-black text-white">
                  {overallStats.activeScenarios} <span className="text-xs font-normal text-slate-400">of {SCENARIOS.length}</span>
                </div>
              </div>

              <div className="bg-slate-800/80 backdrop-blur-sm p-3.5 rounded-2xl border border-slate-700/60">
                <div className="text-xs text-slate-400 font-medium flex items-center space-x-1.5 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400"/>
                  <span>Docs Claimed</span>
                </div>
                <div className="text-lg font-black text-emerald-400">
                  {overallStats.totalClaimed} <span className="text-xs font-normal text-slate-400">/ {overallStats.totalDocs} ({overallStats.overallPercentage}%)</span>
                </div>
              </div>

              <div className="hidden sm:block bg-slate-800/80 backdrop-blur-sm p-3.5 rounded-2xl border border-slate-700/60">
                <div className="text-xs text-slate-400 font-medium flex items-center space-x-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400"/>
                  <span>Family Mode</span>
                </div>
                <div className="text-lg font-black text-white">
                  {familyMembers.length} <span className="text-xs font-normal text-slate-400">Profiles Active</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Section Heading with Person-Specific Filter Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                {activeCategory === 'all' ? 'All Situations & Schemes' : `Dossiers: ${activeCategory.replace('_', ' ').toUpperCase()}`}
              </h2>
              {selectedMember && (<span className="text-xs font-bold text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  Filtered for {selectedMember.name}
                </span>)}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedMember
            ? `Eligibility evaluated for ${selectedMember.name} (${selectedMember.age}y, ${selectedMember.occupation}, ${selectedMember.isTaxPayer ? 'Taxpayer' : 'Non-Taxpayer'}).`
            : 'Select any family member above to highlight personalized eligibility.'}
            </p>
          </div>

          {/* Person-Specific Only Filter Button */}
          {selectedMember && (<div className="flex items-center space-x-2 self-start sm:self-auto">
              <button onClick={() => setEligibleOnlyFilter(!eligibleOnlyFilter)} className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${eligibleOnlyFilter
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                : 'bg-[#14142e] text-slate-200 border-white/15 hover:border-emerald-500'}`}>
                <Filter className="w-3.5 h-3.5"/>
                <span>
                  {eligibleOnlyFilter ? 'Showing 100% Eligible Only' : `Show Only Eligible for ${selectedMember.name}`}
                </span>
                {eligibleOnlyFilter && <Check className="w-3.5 h-3.5 stroke-[3]"/>}
              </button>
            </div>)}
        </div>

        {/* Scheme status chips */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${statusFilter === 'all' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white/5 text-slate-300 border-white/10 hover:border-emerald-500'}`}>Any status</button>
          {SCHEME_STATUSES.filter((s) => s.id !== 'not_started').map((s) => (<button key={s.id} onClick={() => setStatusFilter(statusFilter === s.id ? 'all' : s.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${statusFilter === s.id ? 'ring-2 ring-emerald-500/60 ' : ''}${statusMeta(s.id).chip}`}>
              {s.label} <span className="opacity-70">({statusCounts[s.id] || 0})</span>
            </button>))}
        </div>

        {/* Scenario Grid */}
        {filteredScenarios.length === 0 ? (<div className="bg-[#14142e] rounded-3xl p-12 text-center border border-white/10 shadow-sm max-w-lg mx-auto">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3"/>
            <h3 className="text-lg font-bold text-slate-100">No matching dossiers found</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              {eligibleOnlyFilter
                ? `No schemes in this category are directly eligible for ${selectedMember?.name}. Try viewing all schemes or changing category.`
                : `We couldn’t find anything matching your filters. Try resetting search or category.`}
            </p>
            <button onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
                setEligibleOnlyFilter(false);
                setStatusFilter('all');
            }} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors">
              Reset Filters
            </button>
          </div>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredScenarios.map((scenario) => (<ScenarioCard key={scenario.id} scenario={scenario} progressMap={progressMap} onOpen={(sc) => setSelectedScenarioId(sc.id)} selectedMember={selectedMember} schemeStatus={schemeStatus} familyMembers={familyMembers} onStatusChange={handleStatusChange}/>))}
          </div>)}

      </main>

      {/* Checklist Modal */}
      {activeScenario && <ChecklistModal key={activeScenario.id} scenario={activeScenario} onClose={() => setSelectedScenarioId(null)} progressMap={progressMap} onToggleClaimed={handleToggleClaimed} onUpdateNote={handleUpdateNote} onMarkAll={handleMarkAll} onReset={handleReset} selectedMember={selectedMember} schemeStatus={schemeStatus} onStatusChange={handleStatusChange}/>}

      {/* Family Member Manager Modal */}
      {isAddMemberOpen && <AddMemberModal isOpen={isAddMemberOpen} onClose={() => setIsAddMemberOpen(false)} members={familyMembers} onAddMember={handleAddMember} onDeleteMember={handleDeleteMember}/>}

      {/* Emergency Drawer / Modal */}
      <EmergencyModal isOpen={isEmergencyOpen} onClose={() => setIsEmergencyOpen(false)} onSelectScenario={(scId) => setSelectedScenarioId(scId)} emergencyScenarios={emergencyScenarios}/>

      {/* Footer */}
      <footer className="bg-[#14142e] border-t border-white/10 mt-16 py-10 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20">
                <Compass className="w-5 h-5"/>
              </div>
              <div>
                <span className="font-extrabold text-lg text-white">DocuSetu</span>
                <p className="text-xs text-slate-400">Citizen Paperwork & Family Eligibility Companion</p>
              </div>
            </div>

            {/* Quick Links to Official Portals */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-300">
              <a href="https://www.digilocker.gov.in" target="_blank" rel="noreferrer" className="hover:text-emerald-400 flex items-center space-x-1">
                <span>DigiLocker</span>
                <ExternalLink className="w-3 h-3"/>
              </a>
              <span className="text-slate-300">•</span>
              <a href="https://parivahan.gov.in" target="_blank" rel="noreferrer" className="hover:text-emerald-400 flex items-center space-x-1">
                <span>Parivahan</span>
                <ExternalLink className="w-3 h-3"/>
              </a>
              <span className="text-slate-300">•</span>
              <a href="https://jansuraksha.gov.in" target="_blank" rel="noreferrer" className="hover:text-emerald-400 flex items-center space-x-1">
                <span>Jan Suraksha (PMJJBY/PMSBY/APY)</span>
                <ExternalLink className="w-3 h-3"/>
              </a>
              <span className="text-slate-300">•</span>
              <a href="https://unifiedportal-mem.epfindia.gov.in" target="_blank" rel="noreferrer" className="hover:text-emerald-400 flex items-center space-x-1">
                <span>EPFO Member Portal</span>
                <ExternalLink className="w-3 h-3"/>
              </a>
            </div>

            <p className="text-xs text-slate-400">
              Family profiles & checklists are saved in your Kubera database.
            </p>

          </div>
        </div>
      </footer>

    </div>);
};
export default App;
