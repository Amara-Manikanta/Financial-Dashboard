import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wallet, PiggyBank, TrendingUp, Coins, Car, BarChart3, Gem, LogOut, User as UserIcon, Users, CreditCard, ArrowUpRight, ArrowDownLeft, List, BrainCircuit, Briefcase, Fuel, ShoppingBag, Receipt, Edit2, FileText, Target, ShieldCheck, Calculator, Percent, Compass, Repeat, Stethoscope } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from './ConfirmModal';

const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            `relative flex items-center gap-1.5 px-1 py-2 text-[13px] font-medium whitespace-nowrap shrink-0 transition-all duration-200 group ${isActive
                ? 'text-orange-500'
                : 'text-gray-400 hover:text-white'
            }`
        }
    >
        {({ isActive }) => (
            <>
                <span className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-orange-500/10' : 'group-hover:bg-white/5'}`}>
                    <Icon size={18} />
                </span>
                <span className="hidden xl:inline">{label}</span>
                {isActive && (
                    <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-orange-500 rounded-t-full shadow-[0_-2px_6px_rgba(249,115,22,0.5)]" />
                )}
            </>
        )}
    </NavLink>
);

const NavDropdown = ({ label, icon: Icon, items }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div 
            className="relative group/dropdown z-50 shrink-0"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <div className="relative flex items-center gap-1.5 px-1 py-2 text-[13px] font-medium whitespace-nowrap transition-all duration-200 group text-gray-400 hover:text-white cursor-pointer">
                <span className="p-1.5 rounded-lg transition-colors group-hover:bg-white/5">
                    <Icon size={18} />
                </span>
                <span className="hidden xl:inline">{label}</span>
            </div>
            {isOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-48 bg-[#18181b] border border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex flex-col py-1 overflow-hidden animate-fade-in">
                    {items.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `px-4 py-2.5 text-xs transition-colors flex items-center gap-2 ${isActive ? 'text-orange-500 bg-white/5 font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <item.icon size={14} />
                            {item.label}
                        </NavLink>
                    ))}
                </div>
            )}
        </div>
    );
};

const Layout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    return (
        <div className="min-h-screen flex flex-col bg-transparent">
            {/* Top Navigation Bar */}
            <header
                style={{
                    height: '64px',
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 50
                }}
            >
                {/* The nav holds ten items, so the side blocks size to their
                    content instead of reserving a fixed 200px each. With fixed
                    widths and a 1280px cap the nav was clipped and the last
                    entries (Assets, Loans & Lents) sat off-screen entirely. */}
                <div className="max-w-[1700px] mx-auto px-4 h-full flex items-center justify-between gap-4">
                    {/* Logo */}
                    <div className="shrink-0 flex items-center gap-3">
                        <div
                            className="flex items-center justify-center"
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, #8B5CF6, #D946EF, #FF8C00)',
                                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                                color: 'white'
                            }}
                        >
                            <Gem size={20} strokeWidth={2.5} />
                        </div>
                        <h1 style={{
                            fontSize: '1.4rem',
                            fontWeight: 900,
                            letterSpacing: '-0.04em',
                            background: 'linear-gradient(to right, #fff, #a1a1aa)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            {/* The second word is dropped on narrower windows so the
                                nav keeps enough room to show every link at once. */}
                            AURA <span className="hidden 2xl:inline" style={{ fontWeight: 400, opacity: 0.6 }}>FINANCE</span>
                        </h1>
                    </div>

                    {/* Navigation Items - Centered */}
                    {/* Overflow must stay visible: the dropdown menus are absolutely
                        positioned below this bar, and any overflow value other than
                        visible clips them vertically as well as horizontally, which
                        makes every grouped link unreachable. Space is managed by
                        grouping links into dropdowns and by hiding labels on
                        narrower windows, never by scrolling this container. */}
                    <nav className="flex-1 min-w-0 flex items-center justify-center gap-1.5 xl:gap-3">
                        <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                        <NavDropdown
                            label="Income"
                            icon={Briefcase}
                            items={[
                                { to: '/salary', label: 'Salary', icon: Briefcase },
                                { to: '/taxes', label: 'Taxes', icon: FileText }
                            ]}
                        />

                        <NavDropdown 
                            label="Planning" 
                            icon={Compass} 
                            items={[
                                { to: '/goals', label: 'Financial Goals', icon: Target },
                                { to: '/insurance-analysis', label: 'Insurance Gap Analysis', icon: ShieldCheck }
                            ]} 
                        />
                        
                        <NavDropdown 
                            label="Expenses" 
                            icon={Wallet} 
                            items={[
                                { to: '/expenses', label: 'All Expenses', icon: Receipt },
                                { to: '/all-transactions', label: 'All Transactions', icon: List },
                                { to: '/credit-cards', label: 'Cards', icon: CreditCard },
                                { to: '/category-budgets', label: 'Budget Limits', icon: Target },
                                { to: '/recurring', label: 'Recurring & Subscriptions', icon: Repeat },
                                { to: '/fuel', label: 'Fuel Analytics', icon: Fuel },
                                { to: '/grocery-analytics', label: 'Grocery Analytics', icon: ShoppingBag },
                                { to: '/grocery-master-list', label: 'Grocery Builder', icon: Edit2 },
                                { to: '/data-health', label: 'Data Health', icon: Stethoscope }
                            ]}
                        />
                        
                        <NavItem to="/savings" icon={PiggyBank} label="Savings" />
                        <NavItem to="/investments" icon={TrendingUp} label="Investments" />
                        <NavItem to="/metals" icon={Coins} label="Gold & Silver" />
                        <NavItem to="/assets" icon={Car} label="Assets" />
                        <NavItem to="/lents-loans" icon={ArrowUpRight} label="Loans & Lents" />
                    </nav>

                    {/* Right Side - Actions/Profile */}
                    <div className="shrink-0 flex justify-end items-center gap-4">
                        <div className="flex items-center gap-3 pr-4 border-r border-white/10">
                            <NavLink to="/profile" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                                    <UserIcon size={16} />
                                </div>
                                <div className="hidden 2xl:block text-left">
                                    <p className="text-xs font-bold leading-none capitalize">{user?.username || 'Guest'}</p>
                                    <p className="text-[10px] text-gray-500 leading-none mt-1 uppercase">{user?.role || 'User'}</p>
                                </div>
                            </NavLink>
                        </div>
                        <button
                            onClick={() => setIsLogoutModalOpen(true)}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
                            title="Logout"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main
                style={{
                    paddingTop: '80px',
                    paddingBottom: '2rem',
                    paddingLeft: '1.5rem',
                    paddingRight: '1.5rem',
                    width: '100%',
                    maxWidth: '1400px',
                    margin: '0 auto'
                }}
            >
                <Outlet />
            </main>
            
            <ConfirmModal
                isOpen={isLogoutModalOpen}
                onClose={() => setIsLogoutModalOpen(false)}
                onConfirm={handleLogout}
                title="Logout Confirmation"
                message="Are you sure you want to log out of your session?"
                confirmText="Log Out"
                type="danger"
            />
        </div>
    );
}

export default Layout;
