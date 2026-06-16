import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { FinanceProvider } from './context/FinanceContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';

// Lazy load pages for better performance (though standard import is fine for this size)
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import ExpenseDetails from './pages/ExpenseDetails';
import Analytics from './pages/Analytics';
import Salary from './pages/Salary';
import Savings from './pages/Savings';
import Investments from './pages/Investments';
import Metals from './pages/Metals';
import Assets from './pages/Assets';
import AssetCategoryDetails from './pages/AssetCategoryDetails';
import MutualFundDetails from './pages/MutualFundDetails';
import FixedDepositDetails from './pages/FixedDepositDetails';
import PolicyDetails from './pages/PolicyDetails';
import StockMarketDetails from './pages/StockMarketDetails';
import MetalDetails from './pages/MetalDetails';
import MetalItemDetails from './pages/MetalItemDetails';
import PPFDetails from './pages/PPFDetails';
import PFDetails from './pages/PFDetails';
import NPSDetails from './pages/NPSDetails';
import GoldBondDetails from './pages/GoldBondDetails';
import AssetItemDetails from './pages/AssetItemDetails';
import StockDetails from './pages/StockDetails';
import EmergencyFundDetails from './pages/EmergencyFundDetails';
import SavingsAccountDetails from './pages/SavingsAccountDetails';
import RecurringDepositDetails from './pages/RecurringDepositDetails';
import SingleRecurringDepositDetails from './pages/SingleRecurringDepositDetails';
import SingleDepositDetails from './pages/SingleDepositDetails';
import Login from './pages/Login';
import Profile from './pages/Profile';
import LentsAndLoans from './pages/LentsAndLoans';
import LentDetails from './pages/LentDetails';
import CreditCardDetails from './pages/CreditCardDetails';
import SingleCreditCardDetails from './pages/SingleCreditCardDetails';
import AllTransactions from './pages/AllTransactions';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught runtime error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white p-8">
                    <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl max-w-lg w-full text-center">
                        <h1 className="text-3xl font-black text-red-400 mb-4 tracking-tight">System Error</h1>
                        <p className="text-gray-400 mb-6 text-sm">{this.state.error?.message || "An unexpected error occurred."}</p>
                        <button 
                            onClick={() => window.location.href = '/'}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-xl transition-all"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const NotFound = () => (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white p-8 text-center">
        <h1 className="text-8xl font-black text-gray-800 mb-4">404</h1>
        <h2 className="text-2xl font-bold mb-6">Page Not Found</h2>
        <p className="text-gray-500 mb-8 max-w-md">The page you are looking for doesn't exist or has been moved.</p>
        <button 
            onClick={() => window.location.href = '/'}
            className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-8 rounded-xl transition-all"
        >
            Go Home
        </button>
    </div>
);

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return (
        <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white">
            <div className="w-16 h-16 border-4 border-white/10 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-bold tracking-widest uppercase text-gray-500 animate-pulse">Initializing Secure Context</p>
        </div>
    );
    // Allow guest access (user with username 'guest')
    if (!user) return <Navigate to="/login" />;
    return children;
};

function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <FinanceProvider>
                    <Router>
                        <div style={{
                            minHeight: '100vh',
                            background: '#09090b',
                            color: '#fff',
                            fontFamily: '"Plus Jakarta Sans", sans-serif'
                        }}>
                            <Routes>
                                <Route path="/login" element={<Login />} />
                                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                                    <Route index element={<Dashboard />} />
                                    <Route path="expenses" element={<Expenses />} />
                                    <Route path="expenses/:year/:month" element={<ExpenseDetails />} />
                                    <Route path="analytics" element={<Analytics />} />
                                    <Route path="salary" element={<Salary />} />
                                    <Route path="savings" element={<Savings />} />
                                    <Route path="investments" element={<Investments />} />
                                    <Route path="savings/mutual-fund/:id" element={<MutualFundDetails />} />
                                    <Route path="savings/fixed-deposit/:id" element={<FixedDepositDetails />} />
                                    <Route path="savings/fixed-deposit/:id/deposit/:depositId" element={<SingleDepositDetails />} />
                                    <Route path="savings/policy/:id" element={<PolicyDetails />} />
                                    <Route path="savings/stock-market/:id" element={<StockMarketDetails />} />
                                    <Route path="savings/stock-market/:id/stock/:stockId" element={<StockDetails />} />
                                    <Route path="savings/ppf/:id" element={<PPFDetails />} />
                                    <Route path="savings/pf/:id" element={<PFDetails />} />
                                    <Route path="savings/nps/:id" element={<NPSDetails />} />
                                    <Route path="savings/sgb/:id" element={<GoldBondDetails />} />
                                    <Route path="savings/emergency-fund/:id" element={<EmergencyFundDetails />} />
                                    <Route path="savings/savings-account/:id" element={<SavingsAccountDetails />} />
                                    <Route path="savings/recurring-deposit/:id" element={<RecurringDepositDetails />} />
                                    <Route path="savings/recurring-deposit/:id/rd/:rdId" element={<SingleRecurringDepositDetails />} />
                                    <Route path="metals" element={<Metals />} />
                                    <Route path="metals/:type" element={<MetalDetails />} />
                                    <Route path="metals/:type/:itemId" element={<MetalItemDetails />} />
                                    <Route path="assets" element={<Assets />} />
                                    <Route path="assets/:id" element={<AssetCategoryDetails />} />
                                    <Route path="assets/:categoryId/:itemId" element={<AssetItemDetails />} />
                                    <Route path="lents-loans" element={<LentsAndLoans />} />
                                    <Route path="lents-loans/:id" element={<LentDetails />} />
                                    <Route path="profile" element={<Profile />} />
                                    <Route path="credit-cards" element={<CreditCardDetails />} />
                                    <Route path="credit-cards/:id" element={<SingleCreditCardDetails />} />
                                    <Route path="all-transactions" element={<AllTransactions />} />
                                    
                                    {/* 404 Catch-all Route inside authenticated area */}
                                    <Route path="*" element={<NotFound />} />
                                </Route>
                                {/* 404 Catch-all Route for unauthenticated area */}
                                <Route path="*" element={<NotFound />} />
                            </Routes>
                        </div>
                    </Router>
                </FinanceProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;
