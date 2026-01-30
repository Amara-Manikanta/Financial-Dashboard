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
import Savings from './pages/Savings';
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
import Lents from './pages/Lents';
import LentDetails from './pages/LentDetails';
import Loans from './pages/Loans';
import CreditCardDetails from './pages/CreditCardDetails';
import SingleCreditCardDetails from './pages/SingleCreditCardDetails';
import AllTransactions from './pages/AllTransactions';

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;
    // Allow guest access (user with username 'guest')
    if (!user) return <Navigate to="/login" />;
    return children;
};

function App() {
    return (
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
                                <Route path="savings" element={<Savings />} />
                                <Route path="savings/mutual-fund/:id" element={<MutualFundDetails />} />
                                <Route path="savings/fixed-deposit/:id" element={<FixedDepositDetails />} />
                                <Route path="savings/fixed-deposit/:id/deposit/:depositId" element={<SingleDepositDetails />} />
                                <Route path="savings/policy/:id" element={<PolicyDetails />} />
                                <Route path="savings/stock-market/:id" element={<StockMarketDetails />} />
                                <Route path="savings/stock-market/:id/stock/:stockId" element={<StockDetails />} />
                                <Route path="savings/ppf/:id" element={<PPFDetails />} />
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
                                <Route path="lents" element={<Lents />} />
                                <Route path="lents/:id" element={<LentDetails />} />
                                <Route path="loans" element={<Loans />} />
                                <Route path="loans/:id" element={<LentDetails />} />
                                <Route path="profile" element={<Profile />} />
                                <Route path="credit-cards" element={<CreditCardDetails />} />
                                <Route path="credit-cards/:id" element={<SingleCreditCardDetails />} />
                                <Route path="all-transactions" element={<AllTransactions />} />
                            </Route>
                        </Routes>
                    </div>
                </Router>
            </FinanceProvider>
        </AuthProvider>
    );
}

export default App;
