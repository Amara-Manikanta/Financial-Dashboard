import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MoreHorizontal, X, User as UserIcon, LogOut, Unplug } from 'lucide-react';
import { SavingsIcon, StockMarketIcon, ExpensesIcon } from '../utils/customIcons';
import { NAV_GROUPS, NAV_LOANS } from './navSections';
import { useAuth } from '../context/AuthContext';

const INVESTMENT_DETAIL_PATHS = ['/savings/stock-market', '/savings/mutual-fund', '/savings/sgb'];

const TABS = [
    { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/expenses', label: 'Expenses', icon: ExpensesIcon },
    { to: '/savings', label: 'Savings', icon: SavingsIcon },
    { to: '/investments', label: 'Invest', icon: StockMarketIcon },
];

const isNative = () => typeof window !== 'undefined' && !!window.__KUBERA_NATIVE__;

/**
 * Phone navigation: a floating, translucent tab bar for the four places used
 * daily and a "More" sheet for everything else. Shown below 768px only; the
 * desktop header is untouched above that.
 *
 * Savings and Investments share route prefixes (a stock page lives under
 * /savings/), so the highlight follows the same rule as the desktop bar.
 */
const MobileNav = () => {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(false);

    // Navigating from the sheet closes it.
    useEffect(() => { setOpen(false); }, [pathname]);

    // The page behind a sheet must not scroll with it.
    useEffect(() => {
        if (!open) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [open]);

    const investing = INVESTMENT_DETAIL_PATHS.some((p) => pathname.startsWith(p));
    const active = (tab) => {
        if (tab.to === '/savings') return pathname.startsWith('/savings') && !investing;
        if (tab.to === '/investments') return pathname.startsWith('/investments') || investing;
        if (tab.end) return pathname === '/';
        return pathname.startsWith(tab.to);
    };
    const tabbed = TABS.some(active);

    const disconnect = () => {
        if (!window.confirm('Disconnect this iPhone from your Mac? You will need a new code to connect again.')) return;
        window.webkit?.messageHandlers?.native?.postMessage({ action: 'unpair' });
    };

    return (
        <>
            <nav
                aria-label="Main"
                className="md:hidden fixed left-3 right-3 z-40 bottom-[calc(10px+env(safe-area-inset-bottom))] flex items-stretch justify-around rounded-[28px] border border-white/10 bg-zinc-900/70 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.55)] px-1.5 py-1.5"
            >
                {TABS.map((tab) => {
                    const on = active(tab);
                    return (
                        <NavLink
                            key={tab.to}
                            to={tab.to}
                            className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-[22px] py-2 text-[10.5px] font-bold transition-colors ${on ? 'text-orange-400 bg-orange-500/12' : 'text-zinc-400 active:bg-white/5'}`}
                        >
                            <span className="flex h-6 w-6 items-center justify-center overflow-hidden [&>img]:h-6 [&>img]:w-6 [&>img]:object-contain"><tab.icon size={22} /></span>
                            {tab.label}
                        </NavLink>
                    );
                })}
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-[22px] py-2 text-[10.5px] font-bold transition-colors ${!tabbed ? 'text-orange-400 bg-orange-500/12' : 'text-zinc-400 active:bg-white/5'}`}
                    aria-haspopup="dialog"
                >
                    <MoreHorizontal size={21} />
                    More
                </button>
            </nav>

            {open && (
                <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="All pages">
                    <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
                    <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-[32px] border-t border-white/10 bg-[#141417] px-4 pt-3 pb-[calc(24px+env(safe-area-inset-bottom))]">
                        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/15" />
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-black text-white m-0">All pages</h2>
                            <button type="button" onClick={() => setOpen(false)} className="p-2 rounded-full bg-white/5 text-zinc-300"><X size={16} /></button>
                        </div>

                        {[...NAV_GROUPS, { key: 'loans', label: 'Loans', items: [NAV_LOANS] }].map((group) => (
                            <section key={group.key} className="mt-4">
                                <h3 className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-zinc-500 mb-2">{group.label}</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {group.items.map((item) => (
                                        <NavLink
                                            key={item.to}
                                            to={item.to}
                                            className={({ isActive }) => `flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-[12.5px] font-semibold leading-tight ${isActive ? 'border-orange-500/40 bg-orange-500/10 text-orange-300' : 'border-white/5 bg-white/[0.03] text-zinc-200 active:bg-white/10'}`}
                                        >
                                            <item.icon size={18} className="shrink-0" />
                                            <span>{item.label}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            </section>
                        ))}

                        <section className="mt-5 pt-4 border-t border-white/10 space-y-2">
                            <button type="button" onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-left text-zinc-200">
                                <UserIcon size={18} />
                                <span className="text-[13px] font-semibold capitalize">{user?.username || 'Guest'} · Profile & settings</span>
                            </button>
                            {isNative() && (
                                <button type="button" onClick={disconnect} className="w-full flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-left text-zinc-300">
                                    <Unplug size={18} />
                                    <span className="text-[13px] font-semibold">Disconnect this iPhone</span>
                                </button>
                            )}
                            <button type="button" onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-left text-red-300">
                                <LogOut size={18} />
                                <span className="text-[13px] font-semibold">Log out</span>
                            </button>
                        </section>
                    </div>
                </div>
            )}
        </>
    );
};

export default MobileNav;
