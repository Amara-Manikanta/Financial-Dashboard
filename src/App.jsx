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
import SingleDepositDetails from './pages/SingleDepositDetails';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Lents from './pages/Lents';
import LentDetails from './pages/LentDetails';
import BudgetPlanning from './pages/BudgetPlanning';

const ProtectedRoute = () => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    return <Outlet />;
};

function App() {
    return (
        <AuthProvider>
            <FinanceProvider>
                <Router>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route element={<ProtectedRoute />}>
                            <Route path="/" element={<Layout />}>
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
                                <Route path="metals" element={<Metals />} />
                                <Route path="metals/:type" element={<MetalDetails />} />
                                <Route path="metals/:type/:itemId" element={<MetalItemDetails />} />
                                <Route path="assets" element={<Assets />} />
                                <Route path="assets/:id" element={<AssetCategoryDetails />} />
                                <Route path="assets/:categoryId/:itemId" element={<AssetItemDetails />} />
                                <Route path="lents" element={<Lents />} />
                                <Route path="lents/:id" element={<LentDetails />} />
                                <Route path="budget-planning" element={<BudgetPlanning />} />
                                <Route path="profile" element={<Profile />} />
                            </Route>
                        </Route>
                    </Routes>
                </Router>
            </FinanceProvider>
        </AuthProvider>
    );
}

export default App;
