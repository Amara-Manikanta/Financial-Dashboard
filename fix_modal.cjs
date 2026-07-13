const fs = require('fs');
const path = '/Users/manikantaamara/Desktop/Antigravity/Finance_Analyser/src/components/TransactionModal.jsx';
let content = fs.readFileSync(path, 'utf8');

// We will inject the state variables
content = content.replace(
    'const [isCreditCardBill, setIsCreditCardBill] = useState(false);',
    `const [isCreditCardBill, setIsCreditCardBill] = useState(false);
    const [deductFromSalary, setDeductFromSalary] = useState(true);
    const [km, setKm] = useState('');
    const [liters, setLiters] = useState('');
    const [pricePerLiter, setPricePerLiter] = useState('');
    const [vehicleType, setVehicleType] = useState('bike');
    
    // Investment fields
    const [investmentAssetId, setInvestmentAssetId] = useState('');
    const [invQuantity, setInvQuantity] = useState('');
    const [invPrice, setInvPrice] = useState('');
    const [invNav, setInvNav] = useState('');
    const [invUnits, setInvUnits] = useState('');
    const [invRemarks, setInvRemarks] = useState('');`
);

// We will inject savings
content = content.replace(
    'const { creditCards, mergedCategoryMap, addCustomCategory } = useFinance();',
    `const { creditCards, mergedCategoryMap, addCustomCategory, savings = [] } = useFinance();`
);

content = content.replace(
    'const subCategoriesList = mainCategory ? mergedCategoryMap[mainCategory] : [];',
    `const subCategoriesList = mainCategory ? mergedCategoryMap[mainCategory] : [];
    
    const allStocks = useMemo(() => {
        const stocks = [];
        savings.filter(s => s.type === 'stock_market').forEach(market => {
            if (market.stocks) {
                market.stocks.forEach(stock => {
                    stocks.push({ ...stock, marketId: market.id, label: \`\${stock.name} (\${stock.ticker}) - \${market.title}\` });
                });
            }
        });
        return stocks;
    }, [savings]);

    const allMutualFunds = useMemo(() => savings.filter(s => s.type === 'mutual_fund'), [savings]);`
);

// Modify useEffect for initialization
const oldUseEffect = `    useEffect(() => {
        if (isOpen && initialData) {
            setTitle(initialData.title || '');
            setAmount(initialData.amount || '');

            const initialCat = initialData.category || '';
            let initialMain = initialData.mainCategory || '';
            let properCaseCat = initialCat;

            if (initialMain && mergedCategoryMap[initialMain]) {
                const matched = mergedCategoryMap[initialMain].find(s => s.toLowerCase() === initialCat.toLowerCase());
                if (matched) properCaseCat = matched;
            }

            if (!initialMain && initialCat) {
                for (const [main, subs] of Object.entries(mergedCategoryMap)) {
                    const matched = subs.find(s => s.toLowerCase() === initialCat.toLowerCase());
                    if (matched) {
                        initialMain = main;
                        properCaseCat = matched;
                        break;
                    }
                }
            }
            if (!initialMain && initialCat) initialMain = 'Miscellaneous';

            setMainCategory(initialMain);
            setCategory(properCaseCat);

            setDate(initialData.date ? new Date(initialData.date) : (defaultDate || new Date()));
            setPaymentMode(initialData.paymentMode || 'direct');
            setCreditCardName(initialData.creditCardName || '');
            setIsCredited(!!initialData.isCredited);
            setIsCreditCardBill(initialCat.toLowerCase() === 'credit card bill' || initialCat.toLowerCase() === 'credit card payment');
        } else if (isOpen && !initialData) {
            setTitle('');
            setAmount('');
            setMainCategory('');
            setCategory('');
            setIsCredited(false);
            setDate(defaultDate || new Date());
            setPaymentMode('direct');
            setCreditCardName('');
            setIsCreditCardBill(false);
        }
    }, [initialData, isOpen, defaultDate]);`;

const newUseEffect = `    useEffect(() => {
        if (isOpen && initialData) {
            setTitle(initialData.title || '');
            setAmount(initialData.amount || '');

            let initialCat = initialData.category || '';
            if (initialCat.toLowerCase() === 'fuels') initialCat = 'fuel';
            
            let initialMain = initialData.mainCategory || '';
            let properCaseCat = initialCat.toLowerCase();

            if (!initialMain && initialCat) {
                for (const [main, subs] of Object.entries(mergedCategoryMap)) {
                    const matched = subs.find(s => s.toLowerCase() === initialCat.toLowerCase());
                    if (matched) {
                        initialMain = main;
                        break;
                    }
                }
            }
            if (!initialMain && initialCat) initialMain = 'Miscellaneous';

            setMainCategory(initialMain);
            setCategory(properCaseCat);
            setDeductFromSalary(initialData.deductFromSalary !== false);
            
            setKm(initialData.km || '');
            setLiters(initialData.liters || '');
            setVehicleType(initialData.vehicleType || 'bike');
            if (initialData.liters && initialData.amount) {
                setPricePerLiter((Number(initialData.amount) / Number(initialData.liters)).toFixed(2));
            } else {
                setPricePerLiter('');
            }

            setDate(initialData.date ? new Date(initialData.date) : (defaultDate || new Date()));
            setPaymentMode(initialData.paymentMode || 'direct');
            setCreditCardName(initialData.creditCardName || '');
            setIsCredited(!!initialData.isCredited);
            setIsCreditCardBill(initialCat.toLowerCase() === 'credit card bill' || initialCat.toLowerCase() === 'credit card payment');
            
            // Investment logic
            const isInv = initialMain === 'Investments';
            if (isInv && initialData.investmentData) {
                const inv = initialData.investmentData;
                setInvestmentAssetId(inv.assetId || '');
                setInvQuantity(inv.quantity || '');
                setInvPrice(inv.price || '');
                setInvNav(inv.nav || '');
                setInvUnits(inv.units || '');
                setInvRemarks(inv.remarks || '');
            } else {
                setInvestmentAssetId('');
                setInvQuantity('');
                setInvPrice('');
                setInvNav('');
                setInvUnits('');
                setInvRemarks('');
            }
        } else if (isOpen && !initialData) {
            setTitle('');
            setAmount('');
            setMainCategory('');
            setCategory('');
            setDeductFromSalary(true);
            setIsCredited(false);
            setDate(defaultDate || new Date());
            setPaymentMode('direct');
            setCreditCardName('');
            setIsCreditCardBill(false);
            setKm(''); setLiters(''); setPricePerLiter(''); setVehicleType('bike');
            setInvestmentAssetId(''); setInvQuantity(''); setInvPrice(''); setInvNav(''); setInvUnits(''); setInvRemarks('');
        }
    }, [initialData, isOpen, defaultDate, mergedCategoryMap]);`;

content = content.replace(oldUseEffect, newUseEffect);

// Update select options for case-insensitive matching
content = content.replace(
    '{subCategoriesList.map(cat => <option key={cat} value={cat} className="bg-[#0c0c0e] capitalize">{cat}</option>)}',
    '{subCategoriesList.map(cat => <option key={cat} value={cat.toLowerCase()} className="bg-[#0c0c0e] capitalize">{cat}</option>)}'
);

// Add onSubmit data compilation
const oldHandleSubmit = `        onAdd({
            ...initialData,
            title,
            amount: parsedAmount,
            mainCategory: mainCategory,
            category: category.toLowerCase(),
            date: \`\${date.getFullYear()}-\${String(date.getMonth() + 1).padStart(2, '0')}-\${String(date.getDate()).padStart(2, '0')}\`,
            deductFromSalary: (paymentMode === 'direct' && !category.toLowerCase().includes('tax')) || category.toLowerCase() === 'credit card bill',
            paymentMode,
            creditCardName: paymentMode === 'credit_card' ? creditCardName : null,
            isCredited,
            transactionType: isCredited ? 'credit' : 'debit',
            type: 'monthly'
        });`;

const newHandleSubmit = `        let computedLiters = null;
        if (category && category.toLowerCase().includes('fuel') && km && pricePerLiter) {
            computedLiters = Number((Number(amount) / Number(pricePerLiter)).toFixed(2));
        }

        const investmentData = mainCategory === 'Investments' && investmentAssetId ? {
            assetId: investmentAssetId,
            quantity: Number(invQuantity) || null,
            price: Number(invPrice) || null,
            nav: Number(invNav) || null,
            units: Number(invUnits) || null,
            remarks: invRemarks
        } : null;

        onAdd({
            ...initialData,
            title,
            amount: parsedAmount,
            mainCategory,
            category: category.toLowerCase(),
            date: \`\${date.getFullYear()}-\${String(date.getMonth() + 1).padStart(2, '0')}-\${String(date.getDate()).padStart(2, '0')}\`,
            deductFromSalary,
            paymentMode,
            creditCardName: paymentMode === 'credit_card' ? creditCardName : null,
            isCredited,
            transactionType: isCredited ? 'credit' : 'debit',
            type: 'monthly',
            ...(category && category.toLowerCase().includes('fuel') && { km: km ? Number(km) : null, liters: computedLiters || (liters ? Number(liters) : null), vehicleType }),
            ...(investmentData && { investmentData })
        });`;

content = content.replace(oldHandleSubmit, newHandleSubmit);

// Re-inject the UI blocks right before the footer
const footerStr = `<div className="mt-8 flex justify-end gap-3 sticky bottom-0 bg-modal pt-4 border-t border-white/5">`;
const customUI = `                        {category && category.toLowerCase().includes('fuel') && (
                            <div className="space-y-4 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-orange-400 uppercase tracking-wider pl-1">Vehicle Type</label>
                                    <div className="flex gap-2">
                                        {['bike', 'car', 'other'].map(vType => (
                                            <button
                                                key={vType}
                                                type="button"
                                                onClick={() => setVehicleType(vType)}
                                                className={\`flex-1 h-10 rounded-xl text-sm font-bold capitalize transition-all border \${
                                                    vehicleType === vType 
                                                        ? 'bg-orange-500 text-white border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]' 
                                                        : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white'
                                                }\`}
                                            >
                                                {vType}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1 space-y-2">
                                        <label className="block text-[10px] font-bold text-orange-400 uppercase tracking-wider pl-1">Odometer (km)</label>
                                        <input
                                            type="number"
                                            value={km}
                                            onChange={(e) => setKm(e.target.value)}
                                            className="w-full h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-white font-bold text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 focus:bg-[#2c2c2e] transition-all"
                                            placeholder="e.g. 15000"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <label className="block text-[10px] font-bold text-orange-400 uppercase tracking-wider pl-1">Price/Liter (₹)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={pricePerLiter}
                                            onChange={(e) => {
                                                setPricePerLiter(e.target.value);
                                                if (e.target.value && Number(e.target.value) > 0 && amount && Number(amount) > 0) {
                                                    setLiters((Number(amount) / Number(e.target.value)).toFixed(2));
                                                }
                                            }}
                                            className="w-full h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-white font-bold text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 focus:bg-[#2c2c2e] transition-all"
                                            placeholder="e.g. 102.50"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <label className="block text-[10px] font-bold text-orange-400 uppercase tracking-wider pl-1">Liters</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={liters}
                                            onChange={(e) => setLiters(e.target.value)}
                                            className="w-full h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-white font-bold text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 focus:bg-[#2c2c2e] transition-all"
                                            placeholder="e.g. 5.5"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {mainCategory === 'Investments' && category && (
                            <div className="space-y-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                                {category.toLowerCase() === 'stocks' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider pl-1">Select Stock</label>
                                            <select
                                                value={investmentAssetId}
                                                onChange={(e) => setInvestmentAssetId(e.target.value)}
                                                className="w-full h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-[#2c2c2e]"
                                                required
                                            >
                                                <option value="" disabled className="bg-[#0c0c0e]">Choose Stock...</option>
                                                {allStocks.map(s => (
                                                    <option key={s.id} value={\`\${s.marketId}|\${s.id}\`} className="bg-[#0c0c0e]">{s.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-1 space-y-2">
                                                <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider pl-1">Quantity</label>
                                                <input type="number" step="0.001" value={invQuantity} onChange={e => setInvQuantity(e.target.value)} required className="w-full h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-white font-bold text-sm" placeholder="e.g. 10" />
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider pl-1">Price / Share</label>
                                                <input type="number" step="0.01" value={invPrice} onChange={e => setInvPrice(e.target.value)} required className="w-full h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-white font-bold text-sm" placeholder="e.g. 1500.50" />
                                            </div>
                                        </div>
                                    </>
                                )}
                                {category.toLowerCase() === 'mutual funds' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider pl-1">Select Mutual Fund</label>
                                            <select
                                                value={investmentAssetId}
                                                onChange={(e) => setInvestmentAssetId(e.target.value)}
                                                className="w-full h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-[#2c2c2e]"
                                                required
                                            >
                                                <option value="" disabled className="bg-[#0c0c0e]">Choose Fund...</option>
                                                {allMutualFunds.map(f => (
                                                    <option key={f.id} value={f.id} className="bg-[#0c0c0e]">{f.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-1 space-y-2">
                                                <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider pl-1">Units (Optional)</label>
                                                <input type="number" step="0.001" value={invUnits} onChange={e => setInvUnits(e.target.value)} className="w-full h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-white font-bold text-sm" placeholder="e.g. 10.5" />
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider pl-1">NAV (Optional)</label>
                                                <input type="number" step="0.01" value={invNav} onChange={e => setInvNav(e.target.value)} className="w-full h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-white font-bold text-sm" placeholder="e.g. 55.40" />
                                            </div>
                                        </div>
                                    </>
                                )}
                                {['stocks', 'mutual funds'].includes(category.toLowerCase()) && (
                                    <div className="space-y-2 mt-4">
                                        <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider pl-1">Remarks</label>
                                        <input type="text" value={invRemarks} onChange={e => setInvRemarks(e.target.value)} className="w-full h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-white font-bold text-sm" placeholder="e.g. Monthly SIP" />
                                    </div>
                                )}
                            </div>
                        )}
`;

content = content.replace(footerStr, customUI + "\n" + footerStr);

fs.writeFileSync(path, content, 'utf8');
console.log("Patched UI.");
