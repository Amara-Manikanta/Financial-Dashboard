
export const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    let date;

    if (dateString instanceof Date) {
        date = dateString;
    } else if (typeof dateString === 'string') {
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
    } else {
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

    if (dateString instanceof Date) {
        return !isNaN(dateString.getTime()) ? dateString.toISOString().split('T')[0] : '';
    }

    let date;
    const ddmmyyyyRegex = /^(\d{2})-(\d{2})-(\d{4})$/;

    if (typeof dateString === 'string') {
        const match = dateString.match(ddmmyyyyRegex);

        if (match) {
            const [_, day, month, year] = match;
            date = new Date(`${year}-${month}-${day}`);
        } else {
            date = new Date(dateString);
        }
    } else {
        date = new Date(dateString);
    }

    if (isNaN(date.getTime())) return '';

    return date.toISOString().split('T')[0];
};

export const getLastWorkingDayOfMonth = (year, monthIndex) => {
    // monthIndex is 0-based (0 = Jan, 11 = Dec)
    const lastDay = new Date(year, monthIndex + 1, 0); // Last day of the month
    const dayOfWeek = lastDay.getDay(); // 0 = Sunday, 6 = Saturday

    if (dayOfWeek === 0) { // Sunday
        lastDay.setDate(lastDay.getDate() - 2);
    } else if (dayOfWeek === 6) { // Saturday
        lastDay.setDate(lastDay.getDate() - 1);
    }
    // Else it is Mon-Fri
    return lastDay.getDate();
};
