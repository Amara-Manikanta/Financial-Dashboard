export const DEFAULT_FAMILY_MEMBERS = [
    {
        id: 'member-self',
        name: 'You (Manikanta)',
        relationship: 'self',
        age: 31,
        gender: 'male',
        occupation: 'salaried',
        isTaxPayer: true,
        avatarColor: 'from-emerald-500 to-teal-700',
    },
    {
        id: 'member-spouse',
        name: 'Wife',
        relationship: 'spouse',
        age: 29,
        gender: 'female',
        occupation: 'homemaker',
        isTaxPayer: false,
        avatarColor: 'from-rose-400 to-pink-600',
    },
];
export function evaluateEligibility(scenario, member) {
    const { age, gender, occupation, isTaxPayer } = member;
    // 1. Specific Scenario Overrides for high precision
    // Aadhaar NPCI DBT Seeding
    if (scenario.id === 'aadhaar-npci-dbt-activation') {
        return {
            status: 'eligible',
            reason: 'Universal Requirement: Mandatory one-time bank setup for direct receipt of any government cash payout.',
        };
    }
    // State Women Monthly Cash Transfers (Ladki Bahin, Gruha Lakshmi, etc.)
    if (scenario.id === 'state-women-cash-transfers') {
        if (gender === 'female' && !isTaxPayer && age >= 21 && age <= 65) {
            return {
                status: 'eligible',
                reason: `Direct Match: Non-taxpayer woman aged ${age} qualifies for ongoing monthly state cash transfers (₹1,000 - ₹2,000/mo)!`,
            };
        }
        if (gender !== 'female') {
            return {
                status: 'ineligible',
                reason: 'Scheme reserved strictly for female heads of household / homemakers.',
            };
        }
        if (isTaxPayer) {
            return {
                status: 'ineligible',
                reason: 'Disqualified: Income-tax paying individuals are excluded under state rules.',
            };
        }
        return {
            status: 'conditional',
            reason: 'Check state domicile and family income ceiling (<₹2.5L/yr).',
        };
    }
    // PMMVY Maternity Cash Benefit
    if (scenario.id === 'pmmvy-maternity-cash-benefit') {
        if (gender === 'female' && age >= 19 && age <= 45) {
            return {
                status: 'eligible',
                reason: `Direct Match: Woman aged ${age} qualifies for ₹5,000 - ₹6,000 direct cash assistance upon pregnancy & child delivery.`,
            };
        }
        if (gender === 'male') {
            return {
                status: 'conditional',
                reason: 'Husband: Can support pregnant spouse by submitting joint Aadhaar and hospital MCP card.',
            };
        }
        return {
            status: 'ineligible',
            reason: 'Applicable during childbearing age upon pregnancy registration.',
        };
    }
    // Atal Pension Yojana (APY)
    if (scenario.id === 'atal-pension-yojana') {
        if (isTaxPayer) {
            return {
                status: 'ineligible',
                reason: 'Disqualified: Barred for income-tax payers under Oct 1, 2022 central rules.',
            };
        }
        if (age >= 18 && age <= 40) {
            return {
                status: 'eligible',
                reason: `Direct Match: Non-taxpayer aged ${age} can secure ₹5,000/mo guaranteed lifelong pension from age 60!`,
            };
        }
        return {
            status: 'ineligible',
            reason: `Age ${age} is outside the eligible APY entry bracket of 18 to 40 years.`,
        };
    }
    // PM Jeevan Jyoti Bima Yojana (PMJJBY)
    if (scenario.id === 'pmjjby-life-insurance') {
        if (age >= 18 && age <= 50) {
            return {
                status: 'eligible',
                reason: `Direct Match: Age ${age} qualifies for ₹2,00,000 pure life insurance for just ₹436/yr.`,
            };
        }
        return {
            status: 'ineligible',
            reason: `Age ${age} is outside the entry window of 18 to 50 years.`,
        };
    }
    // PM Suraksha Bima Yojana (PMSBY)
    if (scenario.id === 'pmsby-accidental-insurance') {
        if (age >= 18 && age <= 70) {
            return {
                status: 'eligible',
                reason: `Direct Match: Age ${age} qualifies for ₹2,00,000 accidental insurance for just ₹20/yr.`,
            };
        }
        return {
            status: 'ineligible',
            reason: `Age ${age} is outside the eligible age bracket of 18 to 70 years.`,
        };
    }
    // Sukanya Samriddhi Yojana (SSY)
    if (scenario.id === 'sukanya-samriddhi-yojana') {
        if (member.relationship === 'child_girl' && age <= 10) {
            return {
                status: 'eligible',
                reason: `Direct Match: Girl child aged ${age} qualifies for high-interest (8.2%) tax-free account.`,
            };
        }
        if (member.relationship === 'self' || member.relationship === 'spouse') {
            return {
                status: 'conditional',
                reason: 'Parent / Guardian: Eligible to open account on behalf of your daughter (if under 10 yrs).',
            };
        }
        return {
            status: 'ineligible',
            reason: 'Reserved strictly for girl children up to 10 years of age.',
        };
    }
    // Senior Citizen Savings Scheme (SCSS)
    if (scenario.id === 'senior-citizen-savings-scheme') {
        if (age >= 60) {
            return {
                status: 'eligible',
                reason: `Direct Match: Age ${age} qualifies for 8.2% sovereign quarterly payout up to ₹30 Lakh.`,
            };
        }
        if (age >= 55 && occupation === 'retired') {
            return {
                status: 'conditional',
                reason: 'Retirees aged 55-60 eligible within 1 month of receiving retirement/VRS funds.',
            };
        }
        return {
            status: 'ineligible',
            reason: `Requires age 60+ (current age: ${age}).`,
        };
    }
    // Ayushman Bharat PM-JAY & Vay Vandana
    if (scenario.id === 'ayushman-bharat-pmjay') {
        if (age >= 70) {
            return {
                status: 'eligible',
                reason: `Universal Match: All senior citizens aged 70+ receive free ₹5,00,000 health cover under Vay Vandana (No income cap!).`,
            };
        }
        if (isTaxPayer) {
            return {
                status: 'ineligible',
                reason: 'General PM-JAY has low-income caps; corporate taxpayers are excluded.',
            };
        }
        return {
            status: 'conditional',
            reason: 'Eligible if listed in state BPL Ration Card or SECC deprivation census.',
        };
    }
    // EPFO (Form 19, 10C, 31 Advance)
    if (scenario.category === 'pf_pension') {
        if (occupation === 'salaried') {
            return {
                status: 'eligible',
                reason: 'Corporate Salaried: Active EPF subscriber eligible for advances and withdrawal.',
            };
        }
        return {
            status: 'ineligible',
            reason: 'Requires mandatory corporate employment EPF deductions.',
        };
    }
    // Home Loan Application
    if (scenario.id === 'home-loan-application') {
        if (occupation === 'salaried' || occupation === 'business') {
            return {
                status: 'eligible',
                reason: 'Earning Applicant: High loan eligibility with Form 16 / ITR tax proofs.',
            };
        }
        if (occupation === 'homemaker') {
            return {
                status: 'conditional',
                reason: 'Eligible as Co-Borrower or Co-Owner alongside earning spouse (gives lower stamp duty in many states!).',
            };
        }
        return {
            status: 'conditional',
            reason: 'Requires co-applicant or guarantor with regular income.',
        };
    }
    // MUDRA Business Loan
    if (scenario.id === 'mudra-loan-application') {
        if (occupation === 'business' || occupation === 'unorganized') {
            return {
                status: 'eligible',
                reason: 'Micro-Enterprise: Eligible for collateral-free credit up to ₹20 Lakh.',
            };
        }
        if (occupation === 'homemaker') {
            return {
                status: 'eligible',
                reason: 'Women Entrepreneur Priority: Banks offer special concessions for women-run home businesses.',
            };
        }
        return {
            status: 'conditional',
            reason: 'Requires starting or running a non-corporate micro enterprise or trade.',
        };
    }
    // Post Office MIS (POMIS)
    if (scenario.id === 'post-office-mis-pomis') {
        if (age >= 18) {
            return {
                status: 'eligible',
                reason: `Adult Indian Resident: Can open single (₹9L) or joint account (₹15L) for 7.4% monthly income.`,
            };
        }
        return {
            status: 'conditional',
            reason: 'Minors aged 10+ can operate with guardian.',
        };
    }
    // Physical Shares to Demat
    if (scenario.id === 'physical-shares-to-demat') {
        return {
            status: 'conditional',
            reason: 'Applicable if this family member holds old paper share certificates or inherited shares.',
        };
    }
    // Cashless Hospitalization & Medical Reimbursement
    if (scenario.category === 'hospital_insurance') {
        return {
            status: 'eligible',
            reason: 'Family Member: Must be covered under Family Floater health insurance policy.',
        };
    }
    // General fallback
    if (age >= 18) {
        return {
            status: 'eligible',
            reason: 'Adult Citizen: Full legal capacity to execute applications and deeds.',
        };
    }
    return {
        status: 'conditional',
        reason: 'Requires parent or legal guardian signature for execution.',
    };
}
