import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield } from 'lucide-react';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [token, setToken] = useState('');
    const [owner, setOwner] = useState('');
    const [repo, setRepo] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!token || !owner || !repo) {
            setError('All fields are required');
            return;
        }
        login(token, owner, repo);
        navigate('/');
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#09090b]">
            <div className="w-full max-w-md bg-white/[0.02] border border-white/10 rounded-3xl p-8 space-y-8 shadow-2xl">
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Shield size={32} />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Setup Sync</h1>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Connect your private GitHub repository</p>
                </div>

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-sm font-medium text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">GitHub PAT (Token)</label>
                        <input
                            type="password"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxx"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:bg-white/10 focus:border-blue-500/50 outline-none transition-all"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Repository Owner</label>
                        <input
                            type="text"
                            value={owner}
                            onChange={(e) => setOwner(e.target.value)}
                            placeholder="Your GitHub Username"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:bg-white/10 focus:border-blue-500/50 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Repository Name</label>
                        <input
                            type="text"
                            value={repo}
                            onChange={(e) => setRepo(e.target.value)}
                            placeholder="e.g., my-expenses-data"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:bg-white/10 focus:border-blue-500/50 outline-none transition-all"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-900/20"
                    >
                        Connect & Sync
                    </button>
                    
                    <p className="text-center text-[10px] text-gray-600 px-4">
                        Your token is never sent anywhere except directly to GitHub's API. It is saved locally in your browser.
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Login;
