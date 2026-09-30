/**
 * Where the client talks to the API.
 *
 * `VITE_API_URL` points the whole client at a different instance, which is what
 * makes it possible to exercise the real UI — including saves — against an
 * isolated copy of the database instead of the live one. Without it, any
 * end-to-end check writes to the real records.
 *
 * It lives here rather than in FinanceContext because AuthContext needs it too,
 * and FinanceContext already imports AuthContext — importing back the other way
 * would be a cycle. AuthContext had its own copy of this without the env check,
 * so a sandbox run read the throwaway database but signed in against the live
 * server, which is exactly the split the sandbox exists to prevent.
 */
export const API_URL = import.meta.env?.VITE_API_URL
    || (typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname || 'localhost'}:3000`
        : 'http://localhost:3000');
