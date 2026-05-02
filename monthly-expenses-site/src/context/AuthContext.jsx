import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [credentials, setCredentials] = useState(() => {
        const stored = localStorage.getItem('expenses_auth');
        return stored ? JSON.parse(stored) : null;
    });

    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        if (credentials?.token && credentials?.owner && credentials?.repo) {
            setIsAuthenticated(true);
        } else {
            setIsAuthenticated(false);
        }
    }, [credentials]);

    const login = (token, owner, repo) => {
        const creds = { token, owner, repo };
        localStorage.setItem('expenses_auth', JSON.stringify(creds));
        setCredentials(creds);
    };

    const logout = () => {
        localStorage.removeItem('expenses_auth');
        setCredentials(null);
    };

    return (
        <AuthContext.Provider value={{ credentials, isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
