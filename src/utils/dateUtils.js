
export const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    let date;

    // Check if format is DD-MM-YYYY (e.g., 13-09-2025)
    // We strictly check for this pattern to avoid false positives
    const ddmmyyyyRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = dateString.match(ddmmyyyyRegex);

    if (match) {
        const [_, day, month, year] = match;
        // Construct ISO string YYYY-MM-DD which is reliably parsed
        date = new Date(`${year}-${month}-${day}`);
    } else {
        // Fallback to standard parsing for ISO strings (YYYY-MM-DD) or other standard formats
        date = new Date(dateString);
    }

    // Check for invalid date
    if (isNaN(date.getTime())) return dateString; // Return original if invalid

    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

export const toISODate = (dateString) => {
    if (!dateString) return '';

    let date;
    const ddmmyyyyRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = dateString.match(ddmmyyyyRegex);

    if (match) {
        const [_, day, month, year] = match;
        date = new Date(`${year}-${month}-${day}`);
    } else {
        date = new Date(dateString);
    }

    if (isNaN(date.getTime())) return '';

    return date.toISOString().split('T')[0];
};
