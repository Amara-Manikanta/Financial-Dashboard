import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wallet, PiggyBank, Coins, Car, BarChart3, Gem, LogOut, User as UserIcon, Users } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';

const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            `relative flex items-center gap-2 px-1 py-2 text-sm font-medium transition-all duration-200 group ${isActive
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
                <span>{label}</span>
                {isActive && (
                    <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-orange-500 rounded-t-full shadow-[0_-2px_6px_rgba(249,115,22,0.5)]" />
                )}
            </>
        )}
    </NavLink>
);

const Layout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

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
                <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
                    {/* Logo - Fixed Width */}
                    <div className="w-[200px] flex items-center gap-3">
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
                            AURA <span style={{ fontWeight: 400, opacity: 0.6 }}>FINANCE</span>
                        </h1>
                    </div>

                    {/* Navigation Items - Centered */}
                    <nav className="flex-1 flex items-center justify-center gap-8">
                        <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                        <NavItem to="/expenses" icon={Wallet} label="Expenses" />
                        <NavItem to="/savings" icon={PiggyBank} label="Savings" />
                        <NavItem to="/metals" icon={Coins} label="Gold & Silver" />
                        <NavItem to="/assets" icon={Car} label="Assets" />
                        <NavItem to="/lents" icon={Users} label="Lents" />
                        <NavItem to="/budget-planning" icon={BarChart3} label="Budget" />
                    </nav>

                    {/* Right Side - Actions/Profile */}
                    <div className="w-[200px] flex justify-end items-center gap-4">
                        <div className="flex items-center gap-3 pr-4 border-r border-white/10">
                            <NavLink to="/profile" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                                    <UserIcon size={16} />
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className="text-xs font-bold leading-none capitalize">{user?.username}</p>
                                    <p className="text-[10px] text-gray-500 leading-none mt-1 uppercase">{user?.role}</p>
                                </div>
                            </NavLink>
                        </div>
                        <button
                            onClick={handleLogout}
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
        </div>
    );
}

export default Layout;
