import React from 'react';

const CurrencyInput = ({ value, onChange, className, style, placeholder, name, required, readOnly, autoFocus }) => {

    const formatValue = (val) => {
        if (val === '' || val === undefined || val === null) return '';
        // Convert to string to check for trailing dot
        const strVal = val.toString();
        // If it ends with a dot, keep it
        if (strVal.endsWith('.')) {
            // Format the integer part
            const parts = strVal.split('.');
            const intPart = parts[0];
            // If pure integer entry (e.g. "123.")
            if (!intPart) return "0."; // specific case ".5"? No, input type text
            const formattedInt = Number(intPart).toLocaleString('en-IN');
            return `${formattedInt}.`;
        }

        // If it has decimal part
        if (strVal.includes('.')) {
            const parts = strVal.split('.');
            const intPart = parts[0];
            const decPart = parts[1];
            const formattedInt = Number(intPart).toLocaleString('en-IN');
            return `${formattedInt}.${decPart}`;
        }

        return Number(val).toLocaleString('en-IN');
    };

    const handleChange = (e) => {
        const rawValue = e.target.value;
        // Remove commas to get pure number/string
        const cleanValue = rawValue.replace(/,/g, '');

        // Allow valid number or empty string
        // Regex allows: empty, digits, digits with one dot, digits with dot and digits
        if (cleanValue === '' || /^[0-9]*\.?[0-9]*$/.test(cleanValue)) {
            // We need to pass the event-like structure or just the value? 
            // Standard inputs pass event. Let's mimic event to keep compatibility 
            // with existing handleChange functions that expect e.target.name/value.

            // However, most parents expect raw value in state? 
            // If parent state stores raw number, we should pass cleanValue.

            const syntheticEvent = {
                target: {
                    name: name,
                    value: cleanValue
                }
            };
            onChange(syntheticEvent);
        }
    };

    return (
        <input
            type="text"
            name={name}
            value={formatValue(value)}
            onChange={handleChange}
            className={className}
            style={style}
            placeholder={placeholder}
            required={required}
            readOnly={readOnly}
            autoFocus={autoFocus}
            inputMode="decimal" // Mobile keyboard optimization
        />
    );
};

export default CurrencyInput;
