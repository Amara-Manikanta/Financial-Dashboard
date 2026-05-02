import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { FinanceProvider } from './context/FinanceContext';
import { AuthProvider, useAuth } from './context/AuthContext';

import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import ExpenseDetails from './pages/ExpenseDetails';
import Analytics from './pages/Analytics';
import Login from './pages/Login';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" />;
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
                            </Route>
                        </Routes>
                    </div>
                </Router>
            </FinanceProvider>
        </AuthProvider>
    );
}

export default App;
