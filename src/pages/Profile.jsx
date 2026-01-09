import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Lock, CheckCircle, AlertCircle } from 'lucide-react';

const Profile = () => {
    const { user, changePassword } = useAuth();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [isUpdating, setIsUpdating] = useState(false);

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }

        if (newPassword.length < 4) {
            setMessage({ type: 'error', text: 'Password must be at least 4 characters' });
            return;
        }

        setIsUpdating(true);
        const result = await changePassword(user.id, newPassword);
        setIsUpdating(false);

        if (result.success) {
            setMessage({ type: 'success', text: 'Password updated successfully!' });
            setNewPassword('');
            setConfirmPassword('');
        } else {
            setMessage({ type: 'error', text: result.message });
        }
    };

    return (
        <div style={{ padding: 'var(--spacing-lg)' }}>
            <h2 className="text-3xl font-bold mb-8">User Settings</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', alignItems: 'start' }}>
                {/* Account Info */}
                <div className="card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <User size={24} className="text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">{user.username}</h3>
                            <p className="text-secondary text-sm">Account Type: {user.role}</p>
                        </div>
                    </div>

                    <div style={{ spaceY: '1rem' }}>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 text-sm">
                            <span className="text-gray-400">User ID</span>
                            <span className="text-white font-mono">{user.id}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 text-sm mt-2">
                            <span className="text-gray-400">Security Status</span>
                            <span className="text-emerald-400 flex items-center gap-1">
                                <Shield size={14} /> Active
                            </span>
                        </div>
                    </div>
                </div>

                {/* Password Change */}
                <div className="card" style={{ padding: '2rem' }}>
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                        <Lock size={20} className="text-indigo-400" />
                        Change Password
                    </h3>

                    <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.5rem' }}>
                                New Password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-indigo-500 outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.5rem' }}>
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-indigo-500 outline-none"
                                required
                            />
                        </div>

                        {message.text && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: message.type === 'success' ? '#10b981' : '#ef4444'
                            }}>
                                {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                {message.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isUpdating}
                            className={`px-6 py-2 rounded-lg font-bold transition-all ${isUpdating ? 'bg-gray-700 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                        >
                            {isUpdating ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;
