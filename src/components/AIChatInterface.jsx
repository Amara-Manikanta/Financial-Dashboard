import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';

export default function AIChatInterface() {
    const [messages, setMessages] = useState(() => {
        const saved = localStorage.getItem('aura_ai_chat');
        const savedDate = localStorage.getItem('aura_ai_date');
        const today = new Date().toDateString();

        // Clear chat if it's a new day, but keep the summary
        if (savedDate && savedDate !== today) {
            localStorage.setItem('aura_ai_date', today);
            localStorage.removeItem('aura_ai_chat');
            return [
                { role: 'assistant', text: "Good morning! I've summarized our previous discussions to keep things light. How can I help you today?" }
            ];
        }
        
        if (!savedDate) localStorage.setItem('aura_ai_date', today);

        return saved ? JSON.parse(saved) : [
            { role: 'assistant', text: "Hello! I'm your Aura Finance AI. Ask me anything about your current financial state, asset allocation, or monthly action plan." }
        ];
    });

    const [summary, setSummary] = useState(() => localStorage.getItem('aura_ai_summary') || '');
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const API_URL = 'http://127.0.0.1:3000';

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
        localStorage.setItem('aura_ai_chat', JSON.stringify(messages));
        
        // Update summary every 5 messages to keep it fresh without overloading
        if (messages.length > 5 && messages.length % 5 === 0) {
            updateSummaryOnBackend(messages);
        }
    }, [messages]);

    const updateSummaryOnBackend = async (chatHistory) => {
        try {
            const res = await fetch(`${API_URL}/api/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: chatHistory })
            });
            if (res.ok) {
                const data = await res.json();
                setSummary(data.summary);
                localStorage.setItem('aura_ai_summary', data.summary);
            }
        } catch (e) { console.error("Summary failed", e); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: userMsg,
                    summary: summary // Pass the persistent summary to the AI
                })
            });

            if (!res.ok) throw new Error('Failed to get response');
            const data = await res.json();

            setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I'm having trouble connecting to the intelligence engine right now." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[500px] backdrop-blur-sm">
            <div className="p-4 border-b border-white/10 bg-black/20 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                    <h3 className="font-semibold text-white">Ask Aura AI</h3>
                    <p className="text-xs text-indigo-300">Context-aware financial assistant</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-purple-500/20 text-purple-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                            {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                        </div>
                        <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-purple-500/20 text-white rounded-tr-none' : 'bg-white/10 text-gray-200 rounded-tl-none border border-white/5'}`}>
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3 max-w-[85%]">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="p-4 rounded-2xl bg-white/10 rounded-tl-none border border-white/5 flex items-center gap-2 text-indigo-300 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 bg-black/20">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your financial health, asset allocation, or rules..."
                        className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 p-2 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 transition-colors text-white"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    );
}
