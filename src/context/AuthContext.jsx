import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const API_URL = 'http://127.0.0.1:3000';
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('finance_user');
        return saved ? JSON.parse(saved) : null;
    });
    const [users, setUsers] = useState([]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch(`${API_URL}/users`);
                const data = await res.json();
                setUsers(data);
            } catch (error) {
                console.error("Failed to fetch users:", error);
            }
        };
        fetchUsers();
    }, []);

    const login = async (username, password) => {
        const foundUser = users.find(u => u.username === username && u.password === password);
        if (foundUser) {
            const userToSave = {
                id: foundUser.id,
                username: foundUser.username,
                role: foundUser.role
            };
            setUser(userToSave);
            localStorage.setItem('finance_user', JSON.stringify(userToSave));
            return { success: true };
        }
        return { success: false, message: 'Invalid username or password' };
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('finance_user');
    };

    const changePassword = async (userId, newPassword) => {
        try {
            const res = await fetch(`${API_URL}/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword })
            });
            if (res.ok) {
                // Refresh local users list
                const updatedUsers = await (await fetch(`${API_URL}/users`)).json();
                setUsers(updatedUsers);
                return { success: true };
            }
            return { success: false, message: 'Failed to update password' };
        } catch (error) {
            console.error("Error changing password:", error);
            return { success: false, message: 'Server error' };
        }
    };

    const value = {
        user,
        login,
        logout,
        changePassword,
        isAdmin: user?.role === 'admin',
        isGuest: user?.role === 'guest'
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
