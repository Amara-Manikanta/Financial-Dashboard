/**
 * Whose shares a holding is.
 *
 * Shares kept on paper, or held by a family member, are still worth tracking —
 * prices, dividends, what they are worth — but they are not this person's
 * portfolio. Every total (net worth, invested, current value, P&L, capital
 * gains, dividends, returns, exposure) goes through `ownHoldings`, so the rule
 * lives in one place. A copy of it in any one page would let family shares
 * silently inflate that page's number.
 *
 * A holding with no `owner` is the user's own, so every existing record keeps
 * counting exactly as it did.
 */
import { DEFAULT_FAMILY_MEMBERS } from '../docusetu/utils/eligibility';

export const SELF_OWNER = 'self';
export const PHYSICAL_OWNER = 'physical';

export const ownerOf = (holding) => (holding && holding.owner) || SELF_OWNER;

export const isOwnHolding = (holding) => ownerOf(holding) === SELF_OWNER;

export const ownHoldings = (holdings) => (holdings || []).filter(isOwnHolding);

/**
 * Owner choices, built from the DocuSetu family profiles so both pages share one
 * list of people. The profile marked `self` is the user, already covered by "Me".
 */
export const ownerOptions = (familyMembers) => {
    const members = (familyMembers && familyMembers.length ? familyMembers : DEFAULT_FAMILY_MEMBERS)
        .filter((m) => m.relationship !== 'self');
    return [
        { id: SELF_OWNER, label: 'Me' },
        { id: PHYSICAL_OWNER, label: 'Physical certificate' },
        ...members.map((m) => ({ id: m.id, label: m.name })),
    ];
};

export const ownerLabel = (ownerId, familyMembers) => {
    const option = ownerOptions(familyMembers).find((o) => o.id === ownerId);
    // A profile that has since been deleted still gets a readable label.
    return option ? option.label : 'Family member';
};
