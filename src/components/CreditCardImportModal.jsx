import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, ArrowRight, CheckCircle, AlertTriangle, Lock } from 'lucide-react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { guessCategory } from '../utils/importUtils';
import { toISODate } from '../utils/dateUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const CreditCardImportModal = ({ isOpen, onClose, onSave, existingTransactions, cardName }) => {
    const [step, setStep] = useState('upload'); // 'upload', 'mapping', 'preview'
    const [rawRows, setRawRows] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [mappings, setMappings] = useState({ date: '', title: '', amount: '' });
    const [treatPositiveAsExpense, setTreatPositiveAsExpense] = useState(true);
    const [parsedTransactions, setParsedTransactions] = useState([]);
    
    // PDF State
    const [pdfFileBuffer, setPdfFileBuffer] = useState(null);
    const [pdfPassword, setPdfPassword] = useState('');
    const [pdfError, setPdfError] = useState('');

    if (!isOpen) return null;

    const reset = () => {
        setStep('upload');
        setRawRows([]);
        setHeaders([]);
        setMappings({ date: '', title: '', amount: '' });
        setTreatPositiveAsExpense(true);
        setParsedTransactions([]);
        setPdfFileBuffer(null);
        setPdfPassword('');
        setPdfError('');
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const parseExtractedRows = (rows) => {
        let headerRowIndex = 0;
        let maxScore = -1;
        
        // Find the best row that looks like a table header across all rows
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] && rows[i].filter(cell => typeof cell === 'string' && cell.trim().length > 0).length >= 3) {
                const rowStr = rows[i].join(' ').toLowerCase();
                let score = 0;
                if (rowStr.includes('date')) score += 2;
                if (rowStr.includes('amount') || rowStr.includes('debit') || rowStr.includes('dr')) score += 2;
                if (rowStr.includes('desc') || rowStr.includes('detail') || rowStr.includes('particular')) score += 2;
                if (rowStr.includes('ref') || rowStr.includes('balance') || rowStr.includes('curr')) score += 1;
                
                if (score > maxScore) {
                    maxScore = score;
                    headerRowIndex = i;
                }
            }
        }

        const extractedHeaders = rows[headerRowIndex] ? rows[headerRowIndex].map((h, i) => h ? String(h).trim() : `Column ${i}`) : [];
        const dataRows = rows.slice(headerRowIndex + 1).filter(r => r && r.length > 0);

        setHeaders(extractedHeaders);
        setRawRows(dataRows);

        const lowerHeaders = extractedHeaders.map(h => h.toLowerCase());
        const guessMapping = { date: '', title: '', amount: '' };
        
        lowerHeaders.forEach((h, i) => {
            if (h.includes('date')) guessMapping.date = i.toString();
            else if (h.includes('desc') || h.includes('particulars') || h.includes('detail') || h.includes('merchant')) guessMapping.title = i.toString();
            else if (h.includes('amount') || h.includes('debit') || h.includes('dr')) guessMapping.amount = i.toString();
        });

        setMappings(guessMapping);
        setStep('mapping');
    };

    const extractPdf = async (buffer, password = '') => {
        try {
            setPdfError('');
            const pdf = await pdfjsLib.getDocument({ data: buffer, password }).promise;
            const allRows = [];
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const items = textContent.items;
                
                // Sort items by Y descending (PDF coordinates: bottom to top)
                items.sort((a, b) => b.transform[5] - a.transform[5]);
                
                const rowsMap = [];
                let currentRow = [];
                let currentY = null;
                
                // Group items into rows with a 15px vertical tolerance
                items.forEach(item => {
                    const y = item.transform[5];
                    if (currentY === null) {
                        currentY = y;
                        currentRow.push(item);
                    } else if (Math.abs(currentY - y) < 15) {
                        currentRow.push(item);
                    } else {
                        rowsMap.push(currentRow);
                        currentRow = [item];
                        currentY = y;
                    }
                });
                if (currentRow.length > 0) rowsMap.push(currentRow);
                
                rowsMap.forEach(rowItems => {
                    // Sort by X coordinate
                    rowItems.sort((a, b) => a.transform[4] - b.transform[4]);
                    
                    let rowStrings = [];
                    let currentStr = "";
                    let lastX = null;

                    for (const item of rowItems) {
                        const trimmed = item.str.trim();
                        if (!trimmed) {
                            continue;
                        }

                        const x = item.transform[4];
                        if (lastX !== null) {
                            const gap = x - lastX;
                            // Threshold: 10 points. 
                            if (gap > 10 || gap < -5) { 
                                rowStrings.push(currentStr);
                                currentStr = trimmed;
                            } else {
                                currentStr += ' ' + trimmed;
                            }
                        } else {
                            currentStr = trimmed;
                        }
                        
                        // Clamp the width to prevent artificially bloated bounding boxes from ruining gaps
                        // A typical character is ~5-7 points wide in standard PDF fonts.
                        const estimatedMaxWidth = trimmed.length * 6;
                        const effectiveWidth = Math.min(item.width, estimatedMaxWidth);
                        lastX = x + effectiveWidth;
                    }
                    if (currentStr) rowStrings.push(currentStr);
                    
                    const finalStrings = rowStrings.filter(s => s.length > 0);
                    if (finalStrings.length > 0) {
                        allRows.push(finalStrings);
                    }
                });
            }
            
            // --- SMART REGEX PRE-PROCESSOR ---
            // Because PDF tables are notoriously unreliable with column spacing,
            // we mathematically scan merged rows for known bank transaction patterns (like ICICI).
            const cleanedRows = [];
            let foundSmartPattern = false;

            allRows.forEach(row => {
                const rowStr = row.join(' ').replace(/\s+/g, ' ').trim();

                // ICICI Bank Credit Card Pattern: DD-MMM-YY <Ref> <Description> <Curr> <IntAmt> <Amount>
                const iciciRegex = /^(\d{2}-[A-Za-z]{3}-\d{2})\s+(\d{8,})\s+(.+?)\s+([A-Za-z]{2,3})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})(?:\s+(Cr|Dr|CR|DR))?$/i;
                const iciciMatch = rowStr.match(iciciRegex);

                if (iciciMatch) {
                    cleanedRows.push([
                        iciciMatch[1], // Date
                        iciciMatch[2], // Ref
                        iciciMatch[3], // Description
                        iciciMatch[4], // Currency
                        iciciMatch[5], // Int Amount
                        iciciMatch[6] + (iciciMatch[7] ? ' ' + iciciMatch[7] : '') // Amount
                    ]);
                    foundSmartPattern = true;
                    return;
                }

                // Generic Pattern: Date <Description> Amount
                const genericRegex = /^(\d{2}[-/\s][A-Za-z0-9]{2,3}[-/\s]\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})(?:\s+(Cr|Dr|CR|DR))?$/i;
                const genMatch = rowStr.match(genericRegex);
                
                if (genMatch && !rowStr.toLowerCase().includes('total')) {
                    cleanedRows.push([
                        genMatch[1], // Date
                        genMatch[2], // Description
                        genMatch[3] + (genMatch[4] ? ' ' + genMatch[4] : '') // Amount
                    ]);
                    foundSmartPattern = true;
                    return;
                }

                cleanedRows.push(row);
            });

            // If we successfully mathematically extracted transactions, inject a perfect header row
            if (foundSmartPattern) {
                // This header will score perfectly in the parsing logic and appear in the dropdowns
                cleanedRows.unshift(["Smart Date", "Smart Ref", "Smart Description", "Smart Currency", "Smart Int Amount", "Smart Amount"]);
            }

            // Log the extracted rows to help debug if it fails again
            console.log("Cleaned PDF Rows:", cleanedRows);
            parseExtractedRows(cleanedRows);
        } catch (err) {
            if (err.name === 'PasswordException') {
                setPdfFileBuffer(buffer);
                setStep('password');
            } else {
                alert('Failed to extract PDF. ' + err.message);
                console.error(err);
                reset();
            }
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const isPdf = file.name.toLowerCase().endsWith('.pdf');

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const data = new Uint8Array(evt.target.result);
            if (isPdf) {
                await extractPdf(data);
            } else {
                try {
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    parseExtractedRows(rows);
                } catch (err) {
                    alert('Failed to parse Excel file.');
                    console.error(err);
                }
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const parseDate = (val) => {
        if (!val) return null;
        if (typeof val === 'number') {
            // Excel serial date
            const d = new Date(Math.round((val - 25569) * 86400 * 1000));
            return toISODate(d);
        }
        const str = String(val).trim();
        // Try DD/MM/YYYY
        if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 3) {
                // assume DD/MM/YYYY if parts[0] > 12 or if it's the standard in India
                // fallback to Date.parse if needed
                let d, m, y;
                if (parts[0].length === 4) { y = parts[0]; m = parts[1]; d = parts[2]; } // YYYY/MM/DD
                else { d = parts[0]; m = parts[1]; y = parts[2]; } // DD/MM/YYYY
                
                if (y.length === 2) y = `20${y}`;
                return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
        } else if (str.includes('-')) {
             const parts = str.split('-');
             if (parts.length === 3) {
                 let d, m, y;
                 if (parts[2].length === 4 || parts[2].length === 2) {
                     // DD-MMM-YY or DD-MM-YYYY
                     d = parts[0]; m = parts[1]; y = parts[2];
                     
                     // Convert MMM to MM
                     const monthNames = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
                     if (isNaN(m)) m = monthNames[m.toLowerCase().substring(0,3)] || '01';
                 } else {
                     y = parts[0]; m = parts[1]; d = parts[2];
                 }
                 if (y.length === 2) y = `20${y}`;
                 return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
             }
        }
        // Fallback
        const d = new Date(str);
        if (!isNaN(d.getTime())) return toISODate(d);
        return null;
    };

    const generatePreview = () => {
        if (mappings.date === '' || mappings.title === '' || mappings.amount === '') {
            alert('Please map Date, Description, and Amount columns.');
            return;
        }

        const dateIdx = parseInt(mappings.date);
        const titleIdx = parseInt(mappings.title);
        const amountIdx = parseInt(mappings.amount);

        const results = [];

        rawRows.forEach((row, i) => {
            const dateStr = parseDate(row[dateIdx]);
            const title = row[titleIdx] ? String(row[titleIdx]).trim() : '';
            let rawAmt = row[amountIdx];
            
            if (!dateStr || !title || rawAmt === undefined || rawAmt === null || rawAmt === '') return;

            // Handle amount parsing
            if (typeof rawAmt === 'string') rawAmt = parseFloat(rawAmt.replace(/,/g, ''));
            if (isNaN(rawAmt) || rawAmt === 0) return;

            // Determine if it's credit or debit
            // If treatPositiveAsExpense is true, positive amounts are expenses (isCredited = false)
            let isCredited = treatPositiveAsExpense ? rawAmt < 0 : rawAmt > 0;
            
            // Check for explicit 'Cr' in description or an adjacent column for Indian bank statements
            if (title.toLowerCase().endsWith(' cr') || (row[amountIdx+1] && String(row[amountIdx+1]).toLowerCase().includes('cr'))) {
                isCredited = true;
                rawAmt = Math.abs(rawAmt);
            }

            const amount = Math.abs(rawAmt);
            
            // Auto categorize
            const category = guessCategory(title, isCredited);

            const tx = {
                id: `import_${Date.now()}_${i}`,
                date: dateStr,
                title: title,
                amount: amount,
                category: category.sub.toLowerCase(),
                mainCategory: category.main,
                isCredited: isCredited,
                paymentMode: 'credit_card',
                creditCardName: cardName,
                transactionType: isCredited ? 'credit' : 'debit',
                type: 'monthly',
                deductFromSalary: true
            };

            // Deduplication logic (Date + Abs Amount + Title substring match)
            const isDuplicate = existingTransactions.some(ext => {
                const sameDate = ext.date === tx.date;
                const sameAmt = Math.abs(ext.amount) === Math.abs(tx.amount);
                // Simple substring match for title
                const t1 = ext.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                const t2 = tx.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                const similarTitle = t1.includes(t2) || t2.includes(t1);
                return sameDate && sameAmt && similarTitle;
            });

            if (!isDuplicate) {
                results.push(tx);
            }
        });

        setParsedTransactions(results);
        setStep('preview');
    };

    const handleSave = () => {
        onSave(parsedTransactions);
        handleClose();
    };

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 1000,
            backdropFilter: 'blur(8px)', padding: '1rem'
        }} onClick={handleClose}>
            <div style={{
                backgroundColor: '#18181b', border: '1px solid #27272a',
                borderRadius: '1.5rem', width: '100%', maxWidth: step === 'preview' ? '800px' : '500px',
                maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                        <Upload className="text-indigo-400" />
                        Import Statement
                    </h3>
                    <button onClick={handleClose} className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {step === 'upload' && (
                        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/10 rounded-2xl hover:border-indigo-500/50 transition-colors bg-white/[0.02]">
                            <Upload size={48} className="text-gray-500 mb-4" />
                            <p className="text-white font-bold mb-2">Upload Statement File</p>
                            <p className="text-sm text-gray-500 mb-6 text-center max-w-xs">Supports PDF, CSV, and Excel files downloaded directly from your bank.</p>
                            <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold cursor-pointer transition-colors shadow-lg shadow-indigo-900/40">
                                Select File
                                <input type="file" accept=".pdf, .csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                    )}

                    {step === 'password' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="bg-orange-500/10 p-4 rounded-full mb-4">
                                <Lock size={48} className="text-orange-400" />
                            </div>
                            <p className="text-white font-bold mb-2">Password Protected PDF</p>
                            <p className="text-sm text-gray-400 mb-6 text-center max-w-sm">
                                Bank statements are often protected with a password. Please enter the password to decrypt the file.
                            </p>
                            
                            <input 
                                type="password" 
                                value={pdfPassword}
                                onChange={e => setPdfPassword(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 w-full max-w-sm mb-4"
                                placeholder="Enter PDF Password"
                                onKeyDown={e => e.key === 'Enter' && extractPdf(pdfFileBuffer, pdfPassword)}
                                autoFocus
                            />
                            
                            {pdfError && <p className="text-xs text-rose-400 mb-4">{pdfError}</p>}

                            <button 
                                onClick={() => extractPdf(pdfFileBuffer, pdfPassword)}
                                className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-orange-900/40"
                            >
                                Unlock and Extract
                            </button>
                        </div>
                    )}

                    {step === 'mapping' && (
                        <div className="space-y-6">
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                                <AlertTriangle className="text-blue-400 shrink-0 mt-0.5" size={18} />
                                <div>
                                    <p className="text-sm text-blue-100 font-medium mb-1">Map your columns</p>
                                    <p className="text-xs text-blue-300/70">Select the headers from your file that correspond to Date, Description, and Amount.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {['date', 'title', 'amount'].map(field => (
                                    <div key={field}>
                                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                                            {field === 'title' ? 'Description / Merchant' : field} Column
                                        </label>
                                        <select 
                                            value={mappings[field]} 
                                            onChange={e => setMappings({...mappings, [field]: e.target.value})}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"
                                        >
                                            <option value="">-- Select Column --</option>
                                            {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                                        </select>
                                    </div>
                                ))}

                                <div className="mt-6 pt-6 border-t border-white/5">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={treatPositiveAsExpense} 
                                            onChange={e => setTreatPositiveAsExpense(e.target.checked)}
                                            className="w-5 h-5 rounded border-gray-600 bg-black/40 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900"
                                        />
                                        <div>
                                            <p className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">Treat positive amounts as Expenses</p>
                                            <p className="text-xs text-gray-500">Most credit card statements list spends as positive numbers. Uncheck if your bank uses negative numbers for spends.</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-white font-bold text-lg">{parsedTransactions.length} New Transactions Found</p>
                                    <p className="text-xs text-emerald-400 font-medium">Duplicate transactions were automatically skipped.</p>
                                </div>
                            </div>

                            {parsedTransactions.length === 0 ? (
                                <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                                    <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
                                    <p className="text-white font-bold">You're all caught up!</p>
                                    <p className="text-sm text-gray-400">No new non-duplicate transactions found in this statement.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-white/5 rounded-xl">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-white/5 text-gray-400 text-xs uppercase font-black tracking-widest">
                                            <tr>
                                                <th className="px-4 py-3">Date</th>
                                                <th className="px-4 py-3">Description</th>
                                                <th className="px-4 py-3">Category</th>
                                                <th className="px-4 py-3 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {parsedTransactions.map(tx => (
                                                <tr key={tx.id} className="hover:bg-white/5">
                                                    <td className="px-4 py-3 text-gray-300">{tx.date}</td>
                                                    <td className="px-4 py-3 text-white truncate max-w-[200px]">{tx.title}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-1 rounded bg-white/10 text-[10px] uppercase font-bold text-gray-300">
                                                            {tx.category}
                                                        </span>
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-mono font-bold ${tx.isCredited ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {tx.isCredited ? '+' : '-'}{tx.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {(step === 'mapping' || step === 'preview') && (
                    <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-black/20 rounded-b-3xl">
                        <button 
                            onClick={step === 'mapping' ? reset : () => setStep('mapping')} 
                            className="px-6 py-2.5 rounded-xl font-bold text-gray-400 hover:bg-white/5 hover:text-white transition-colors text-sm"
                        >
                            Back
                        </button>
                        <button 
                            onClick={step === 'mapping' ? generatePreview : handleSave} 
                            disabled={step === 'preview' && parsedTransactions.length === 0}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-900/40 text-sm flex items-center gap-2"
                        >
                            {step === 'mapping' ? 'Generate Preview' : 'Import Data'}
                            <ArrowRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default CreditCardImportModal;
