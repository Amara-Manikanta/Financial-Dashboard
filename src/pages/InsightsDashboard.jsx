import React, { useState, useEffect } from 'react';
import { BrainCircuit, AlertTriangle, Activity, Lightbulb, ArrowRight, Loader2, Target, TrendingUp, ShieldCheck, Sparkles } from 'lucide-react';
import AIChatInterface from '../components/AIChatInterface';
import { useAuth } from '../context/AuthContext';

export default function InsightsDashboard() {
    const { user } = useAuth();
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const API_URL = 'http://127.0.0.1:3000';

    useEffect(() => {
        const fetchInsights = async () => {
            try {
                const res = await fetch(`${API_URL}/api/insights`);
                if (!res.ok) throw new Error('Failed to fetch AI Insights');
                const data = await res.json();
                setInsights(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchInsights();
    }, []);

    if (!user) return <div className="p-8 text-center text-gray-400">Please log in to view insights.</div>;

    const healthScore = insights ? Math.min(100, (insights.liquidity_months / 6 * 40) + (insights.risks.length === 0 ? 60 : 30)) : 0;

    return (
        <div className="min-h-screen bg-transparent text-white p-4 sm:p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            {/* Header with Background Glow */}
            <header className="relative py-10 px-8 rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-indigo-900/20 via-purple-900/10 to-transparent backdrop-blur-xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] -z-10 animate-pulse" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[80px] -z-10" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold tracking-wider uppercase">
                            <Sparkles className="w-3 h-3" />
                            AI Powered Intelligence
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter">
                            Financial <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Health Radar</span>
                        </h1>
                        <p className="text-gray-400 text-lg max-w-xl">
                            Real-time analysis of your wealth, risk exposure, and growth opportunities using local Mistral intelligence.
                        </p>
                    </div>

                    {/* Health Score Gauge */}
                    <div className="relative w-40 h-40 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                            <circle cx="80" cy="80" r="70" fill="none" stroke="url(#healthGradient)" strokeWidth="12" 
                                    strokeDasharray={440} strokeDashoffset={440 - (440 * healthScore / 100)}
                                    className="transition-all duration-1000 ease-out" strokeLinecap="round" />
                            <defs>
                                <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#818cf8" />
                                    <stop offset="100%" stopColor="#c084fc" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-black">{Math.round(healthScore)}</span>
                            <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Health Score</span>
                        </div>
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-64 bg-white/5 rounded-3xl border border-white/10 animate-pulse" />
                    ))}
                </div>
            ) : error ? (
                <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-10 text-center space-y-4 backdrop-blur-md">
                    <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
                    <h2 className="text-2xl font-bold text-red-200">Intelligence Engine Unavailable</h2>
                    <p className="text-gray-400 max-w-md mx-auto">{error}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column - Main Insights */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Summary Card */}
                        <section className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-[2.5rem] p-8 transition-all duration-500 overflow-hidden relative">
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors" />
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400">
                                    <Activity className="w-6 h-6" />
                                </div>
                                <h2 className="text-2xl font-bold">Health Summary</h2>
                            </div>
                            <div className="relative z-10">
                                <p className="text-xl leading-relaxed text-gray-300 font-medium">
                                    {insights?.summary}
                                </p>
                            </div>
                        </section>

                        {/* Action Plan Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <section className="bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] p-8">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400">
                                        <Lightbulb className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-xl font-bold">Monthly Strategy</h2>
                                </div>
                                <div className="space-y-4">
                                    {insights?.actions?.map((action, i) => (
                                        <div key={i} className="flex gap-3 group">
                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:scale-150 transition-transform" />
                                            <p className="text-gray-300 text-sm leading-relaxed">{action}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="bg-blue-500/5 border border-blue-500/10 rounded-[2rem] p-8">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400">
                                        <Target className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-xl font-bold">Optimization</h2>
                                </div>
                                <div className="space-y-4 text-sm text-gray-400">
                                    <p>Based on your current allocation, there are opportunities to optimize your tax-harvesting and rebalance into equity while gold is at a premium.</p>
                                    <button className="text-blue-400 font-bold flex items-center gap-2 group">
                                        View Detailed Analysis <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Right Column - Risks & Metrics */}
                    <div className="lg:col-span-4 space-y-8">
                        {/* Risk Panel */}
                        <section className="bg-red-500/5 border border-red-500/10 rounded-[2.5rem] p-8 relative overflow-hidden">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-red-500/20 rounded-2xl text-red-400 animate-pulse">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <h2 className="text-2xl font-bold text-red-200">Critical Risks</h2>
                            </div>
                            
                            <div className="space-y-4">
                                {insights?.risks?.length > 0 ? insights.risks.map((risk, i) => (
                                    <div key={i} className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-200 flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                        {risk}
                                    </div>
                                )) : (
                                    <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col items-center gap-2">
                                        <ShieldCheck className="w-10 h-10 text-emerald-400" />
                                        <p className="text-emerald-200 font-bold">All Systems Secure</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Quick Stats */}
                        <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
                            <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
                                <TrendingUp className="w-5 h-5 text-purple-400" />
                                Performance Metrics
                            </h2>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-500">
                                        <span>Liquidity / Emergency</span>
                                        <span className="text-purple-400">{insights?.liquidity_months?.toFixed(1)} mo</span>
                                    </div>
                                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-1000 ${insights?.liquidity_months >= 6 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                             style={{ width: `${Math.min(100, (insights?.liquidity_months || 0) / 6 * 100)}%` }} />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    {Object.entries(insights?.allocation || {}).map(([key, val]) => (
                                        <div key={key} className="flex items-center justify-between group">
                                            <span className="text-gray-400 capitalize text-sm group-hover:text-white transition-colors">{key.replace(/([A-Z])/g, ' $1')}</span>
                                            <div className="flex items-center gap-3">
                                                <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                                                    <div className="h-full bg-white/20" style={{ width: `${val}%` }} />
                                                </div>
                                                <span className="font-mono text-sm font-bold text-gray-300">{val?.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            )}

            {/* Chat Section */}
            <section className="pt-10 border-t border-white/10">
                <div className="mb-8 text-center space-y-2">
                    <h2 className="text-3xl font-black italic">Aura Deep Intelligence</h2>
                    <p className="text-gray-500">Chat with the engine about your specific goals and future planning.</p>
                </div>
                <div className="max-w-4xl mx-auto shadow-2xl shadow-indigo-500/10">
                    <AIChatInterface />
                </div>
            </section>
        </div>
    );
}
