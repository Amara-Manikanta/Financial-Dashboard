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

            // We do not need to find the proper case because we'll use lowercase for values in select!

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

// Update select options
content = content.replace(
    '{subCategoriesList.map(cat => <option key={cat} value={cat} className="bg-[#0c0c0e] capitalize">{cat}</option>)}',
    '{subCategoriesList.map(cat => <option key={cat} value={cat.toLowerCase()} className="bg-[#0c0c0e] capitalize">{cat}</option>)}'
);

// Add onSubmit data compilation
const oldHandleSubmit = `        const transactionData = {
            title: title.trim() || category,
            amount: Number(amount),
            category,
            mainCategory,
            date: date.toISOString(),
            paymentMode,
            creditCardName: paymentMode === 'credit_card' ? creditCardName : null,
            isCredited,
            transactionType: isCredited ? 'credit' : 'debit'
        };`;

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

        const transactionData = {
            title: title.trim() || category,
            amount: Number(amount),
            category,
            mainCategory,
            date: date.toISOString(),
            paymentMode,
            creditCardName: paymentMode === 'credit_card' ? creditCardName : null,
            isCredited,
            transactionType: isCredited ? 'credit' : 'debit',
            deductFromSalary,
            ...(category && category.toLowerCase().includes('fuel') && { km: km ? Number(km) : null, liters: computedLiters || (liters ? Number(liters) : null), vehicleType }),
            ...(investmentData && { investmentData })
        };`;

content = content.replace(oldHandleSubmit, newHandleSubmit);

fs.writeFileSync(path, content, 'utf8');
console.log("Patched basic logic.");
