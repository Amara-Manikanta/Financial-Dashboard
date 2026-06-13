import http from 'http';
import fs from 'fs';
import path from 'path';
import { getLlama, LlamaChatSession } from "node-llama-cpp";

let llama = null;
let model = null;

// Initialize the model once
async function getModel() {
    if (model) return model;
    try {
        console.log("[AI] Initializing Local Llama Engine (CPU Mode)...");
        llama = await getLlama({
            gpu: false // Disable GPU to avoid OutOfMemory on Metal
        });
        model = await llama.loadModel({
            modelPath: "/Users/manikantaamara/Programming/Models/mistral-7b-instruct.gguf"
        });
        console.log("[AI] Model loaded successfully within code server.");
        return model;
    } catch (err) {
        console.error("[AI] Failed to load local model via node-llama-cpp:", err.message);
        console.log("[AI] Falling back to Ollama API...");
        return null; // Fallback to Ollama
    }
}

export async function handleInsightsRequest(req, res, INTERNAL_PORT) {
    try {
        const state = await getFinancialState(INTERNAL_PORT);
        const analysis = analyzeState(state);
        
        const prompt = `
You are an expert financial advisor AI for the 'Aura Finance' dashboard.
Review the following financial state and rules analysis.
Provide a concise, human-readable summary, and a specific monthly action plan based on the deterministic rules provided.
Keep it strictly under 200 words. Do NOT hallucinate data.

Financial State:
- Net Worth: ₹${analysis.netWorth.toLocaleString('en-IN')}
- Individual Stocks: ₹${analysis.valStocks.toLocaleString('en-IN')}
- Mutual Funds: ₹${analysis.valMutualFunds.toLocaleString('en-IN')}
- Fixed Deposits & Debt: ₹${analysis.valDebt.toLocaleString('en-IN')}
- Real Estate: ₹${analysis.valRealEstate.toLocaleString('en-IN')}
- Gold & Silver: ₹${analysis.valGoldSilver.toLocaleString('en-IN')}
- Emergency Fund: ${analysis.liquidity_months.toFixed(1)} months coverage

Rule Engine Flags:
${analysis.risks.map(r => "- " + r).join('\n') || "- No major risks"}
${analysis.opportunities.map(o => "- " + o).join('\n') || ""}

Provide output in JSON format:
{
  "summary": "...",
  "actions": ["action 1", "action 2"]
}
        `;

        const aiResponse = await generateAIResponse(prompt, true);
        console.log("[AI] Response received from Mistral.");
        
        let aiParsed = { summary: "AI explanation unavailable.", actions: [] };
        try {
            const start = aiResponse.indexOf('{');
            const end = aiResponse.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
                const cleanJson = aiResponse.substring(start, end + 1);
                aiParsed = JSON.parse(cleanJson);
            } else {
                aiParsed.summary = aiResponse;
            }
        } catch(e) {
            console.warn("[AI] JSON Parse failed, using raw response:", e.message);
            aiParsed.summary = aiResponse;
        }

        const responsePayload = {
            summary: aiParsed.summary,
            risks: analysis.risks,
            opportunities: analysis.opportunities,
            actions: aiParsed.actions || analysis.recommendations,
            allocation: analysis.allocation,
            liquidity_months: analysis.liquidity_months
        };

        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify(responsePayload));
    } catch (err) {
        console.error("Insights Error:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    }
}

export async function handleChatRequest(req, res, INTERNAL_PORT) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
        try {
            const { message, summary } = JSON.parse(body);
            const state = await getFinancialState(INTERNAL_PORT);
            const analysis = analyzeState(state);
            
            const prompt = `
You are Aura, the user's dedicated Personal Financial Assistant. You are warm, professional, and proactive.
The user asks: "${message}"

${summary ? `Summary of our previous conversations: ${summary}` : ''}

Financial Context:
- Net Worth: ₹${analysis.netWorth.toLocaleString('en-IN')}
- Avg Monthly Expenses: ₹${analysis.avgMonthlyExpense.toLocaleString('en-IN')}
- Target Emergency Fund (6 Months): ₹${analysis.targetEmergencyFund.toLocaleString('en-IN')}
- Current Liquid Savings: ₹${analysis.liquidSavings.toLocaleString('en-IN')}
- Emergency Fund Shortfall: ₹${analysis.shortfall.toLocaleString('en-IN')}
- Individual Stocks: ₹${analysis.valStocks.toLocaleString('en-IN')}
- Mutual Funds: ₹${analysis.valMutualFunds.toLocaleString('en-IN')}
- Debt & Fixed Deposits: ₹${analysis.valDebt.toLocaleString('en-IN')}
- Gold & Silver: ₹${analysis.valGoldSilver.toLocaleString('en-IN')}
- Real Estate: ₹${analysis.valRealEstate.toLocaleString('en-IN')}

Strategic Rules:
${analysis.risks.map(r => "- " + r).join('\n')}

Guidelines:
1. If the user asks about an emergency fund, give them the EXACT numbers (Target, Current, and Shortfall).
2. Note: The user considers both Liquid Cash and Fixed Deposits as part of their Emergency Fund.
3. Suggest a monthly savings plan to bridge the shortfall (e.g., "To bridge your ₹X shortfall in 12 months, we need to save ₹Y/month").
            `;
            
            const aiResponse = await generateAIResponse(prompt, false);
            
            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(JSON.stringify({ reply: aiResponse }));
        } catch (err) {
            console.error("Chat Error:", err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    });
}

export async function handleSummarizeRequest(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
        try {
            const { history } = JSON.parse(body);
            const chatText = history.map(m => `${m.role}: ${m.text}`).join('\n');
            const prompt = `Summarize the key financial concerns, goals, and decisions discussed in this chat history in 2-3 sentences. Keep it very concise.\n\nHistory:\n${chatText}`;
            
            const aiResponse = await generateAIResponse(prompt, false);
            
            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(JSON.stringify({ summary: aiResponse }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    });
}

async function generateAIResponse(prompt, isJson) {
    const localModel = await getModel();
    
    if (localModel) {
        try {
            console.log("[AI] Starting local inference...");
            const context = await localModel.createContext();
            const session = new LlamaChatSession({
                contextSequence: context.getSequence()
            });
            const result = await session.prompt(prompt, {
                maxTokens: 1024
            });
            return result;
        } catch (err) {
            console.error("[AI] Local inference failed, falling back to Ollama:", err.message);
        }
    }

    // Fallback to Ollama
    return getOllamaResponse(prompt, isJson);
}

// ... rest of the helper functions (getFinancialState, analyzeState, getOllamaResponse)
// I will keep the rest of the functions from the previous version.

async function getFinancialState(port) {
    const fetchLocal = async (path) => {
        return new Promise((resolve, reject) => {
            http.get(`http://127.0.0.1:${port}/${path}`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });
    };

    const [expenses, savings, metals, assets, lents, creditCards] = await Promise.all([
        fetchLocal('expenses'),
        fetchLocal('savings'),
        fetchLocal('metals'),
        fetchLocal('assets'),
        fetchLocal('lents'),
        fetchLocal('creditCards')
    ]);

    return { expenses, savings, metals, assets, lents, creditCards };
}

function analyzeState(state) {
    const { expenses, savings, metals, assets, lents, creditCards } = state;
    let totalExpenses = 0;
    let totalIncome = 0;
    let monthsCount = 0;

    Object.values(expenses || {}).forEach(yearData => {
        Object.values(yearData).forEach(monthData => {
            const categories = monthData.categories || monthData;
            Object.entries(categories).forEach(([cat, val]) => {
                if (['salary received', 'income'].includes(cat.toLowerCase())) totalIncome += Number(val) || 0;
                else totalExpenses += Number(val) || 0;
            });
            monthsCount++;
        });
    });

    const avgMonthlyExpense = monthsCount > 0 ? (totalExpenses / monthsCount) : 0;
    const liquidSavings = (savings || []).reduce((sum, acc) => {
        if (acc.type === 'savings_account' || acc.type === 'fixed_deposit') {
            // For savings accounts, calculate balance from transactions
            if (acc.type === 'savings_account') {
                const bal = (acc.transactions || []).reduce((b, t) => {
                    if(t.type === 'deposit') return b + Number(t.amount);
                    if(t.type === 'withdraw') return b - Number(t.amount);
                    return b;
                }, 0);
                return sum + bal;
            }
            // For Fixed Deposits, use the amount directly
            return sum + (Number(acc.amount) || 0);
        }
        return sum;
    }, 0);

    const liquidity_months = avgMonthlyExpense > 0 ? (liquidSavings / avgMonthlyExpense) : 0;

    let valStocks = 0, valMutualFunds = 0, valDebt = 0, valRealEstate = 0, valGoldSilver = 0, liabilities = 0;

    (savings || []).forEach(item => {
        if (item.type === 'stock_market') {
            valStocks += (item.stocks || []).reduce((sum, s) => sum + (Number(s.shares || 0) * Number(s.currentPrice || 0)), 0);
        } else if (item.type === 'mutual_fund') {
            const units = (item.transactions || []).reduce((sum, tx) => {
                const type = tx.type?.toLowerCase() || (tx.remarks?.toLowerCase().includes('sip') ? 'buy' : 'buy');
                if (type === 'buy') return sum + (Number(tx.units) || 0);
                if (type === 'sell' || type === 'withdraw') return sum - (Number(tx.units) || 0);
                return sum;
            }, 0);
            const currentVal = units > 0 ? (units * (Number(item.currentNav) || 0)) : (Number(item.amount) || 0);
            valMutualFunds += currentVal;
        } else if (['fixed_deposit', 'ppf', 'pf', 'nps', 'sgb'].includes(item.type)) {
            valDebt += Number(item.amount || item.investedAmount || 0);
        }
    });

    const valEquity = valStocks + valMutualFunds;
    valGoldSilver += (metals?.gold || []).reduce((sum, g) => sum + (Number(g.currentValue) || 0), 0);
    valGoldSilver += (metals?.silver || []).reduce((sum, s) => sum + (Number(s.currentValue) || 0), 0);

    (assets || []).forEach(category => {
        (category.items || []).forEach(item => {
            valRealEstate += (Number(item.currentValue) || Number(item.purchasePrice) || 0);
        });
    });

    (creditCards || []).forEach(card => { liabilities += Number(card.outstandingAmount || card.unbilledAmount || 0); });

    const totalAssets = valEquity + valDebt + valRealEstate + valGoldSilver + liquidSavings;
    const allocation = {
        equity: totalAssets > 0 ? (valEquity / totalAssets) * 100 : 0,
        debt: totalAssets > 0 ? ((valDebt + liquidSavings) / totalAssets) * 100 : 0,
        realEstate: totalAssets > 0 ? (valRealEstate / totalAssets) * 100 : 0,
        goldSilver: totalAssets > 0 ? (valGoldSilver / totalAssets) * 100 : 0,
    };

    const risks = [];
    const opportunities = [];
    const recommendations = [];

    if (liquidity_months < 6) { risks.push("Emergency fund is too low (< 6 months)."); recommendations.push("Build liquid savings."); }
    if (allocation.goldSilver > 15) risks.push("Overexposed to Gold/Silver (> 15%).");
    if (allocation.realEstate > 60) risks.push("High concentration in Real Estate (> 60%).");

    const shortfall = Math.max(0, (avgMonthlyExpense * 6) - liquidSavings);

    return { 
        netWorth: totalAssets - liabilities, 
        avgMonthlyExpense,
        targetEmergencyFund: avgMonthlyExpense * 6,
        liquidSavings,
        shortfall,
        valStocks,
        valMutualFunds,
        valEquity,
        valDebt,
        valRealEstate,
        valGoldSilver,
        allocation, 
        liquidity_months, 
        risks, 
        opportunities, 
        recommendations 
    };
}

async function getOllamaResponse(prompt, jsonFormat) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ model: "finance-mistral", prompt: prompt, stream: false, format: jsonFormat ? "json" : undefined });
        const req = http.request({ hostname: '127.0.0.1', port: 11434, path: '/api/generate', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try { resolve(JSON.parse(data).response); } catch (e) { reject(e); }
                } else reject(new Error("Ollama status " + res.statusCode));
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}
