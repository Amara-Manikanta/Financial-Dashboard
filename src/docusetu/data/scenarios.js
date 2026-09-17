export const SCENARIOS = [
    // ==========================================
    // PROPERTY & REAL ESTATE
    // ==========================================
    {
        id: 'buying-resale-flat-house',
        category: 'property',
        title: 'Purchasing Resale Flat / Independent House',
        subtitle: 'Secondary market property purchase checklist from an individual seller',
        badge: 'Property & Land',
        icon: 'Home',
        estimatedTAT: '15 - 30 Days',
        officialDepartment: 'Department of Stamps & Registration (Sub-Registrar)',
        officialPortalUrl: 'https://igrsup.gov.in',
        overview: 'Purchasing a resale property requires careful historical title verification. You must trace ownership back at least 30 years and verify no pending loans, society dues, or municipal tax defaults exist.',
        dueDiligenceTips: [
            'Demand an Encumbrance Certificate (EC) for the last 30 years to verify the property is free from mortgages or legal disputes.',
            'Check all "Parent Deeds" (chain of past ownership documents from the first allotment to current seller).',
            'Verify the seller has a registered Occupancy Certificate (OC) issued by the local civic authority.',
            'Always pay via bank transfer or cheque — avoid cash advances without a registered Agreement to Sell.'
        ],
        stepByStepWorkflow: [
            'Legal Title Search: Have an independent advocate vet the chain of ownership for 30 years.',
            'Draft & Sign Agreement to Sell with token advance (include penalty and exit clauses).',
            'Obtain Society / Resident Welfare Association NOC & clear all maintenance dues.',
            'Pay Stamp Duty & Registration charges through state treasury portal.',
            'Execute Sale Deed registration at the Sub-Registrar Office in presence of 2 witnesses.',
            'Apply for Khata/Patta mutation in the municipal revenue records in your name.'
        ],
        documents: [
            {
                id: 'resale-title-deed',
                title: 'Original Mother/Parent Title Deeds',
                importance: 'mandatory',
                type: 'original',
                description: 'Complete chain of registered Sale Deeds or Allotment letters proving how the seller acquired legal title.',
                whereToGet: 'From current seller (demand to inspect original before signing agreement)',
                commonRejectionPitfall: 'Missing link in the chain (e.g., grandfather bought it, passed to uncle, but no registered partition deed exists).',
                validity: 'Permanent'
            },
            {
                id: 'resale-ec',
                title: 'Encumbrance Certificate (EC) for 30 Years',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Certificate from Sub-Registrar confirming property has no legal dues, liens, or court attachments.',
                whereToGet: 'State Registration portal (e.g. Kaveri Online, IGRS, Meebhoomi, Dharani) or Sub-Registrar Office',
                commonRejectionPitfall: 'Form 15 shows existing hypothecation to a bank that seller claims was closed without bank release deed.',
                validity: 'Obtain within 15 days of registration',
                estimatedFee: '₹100 - ₹300'
            },
            {
                id: 'resale-khata-patta',
                title: 'Latest Khata / Patta Certificate & Extract',
                importance: 'mandatory',
                type: 'original',
                description: 'Municipal property tax register entry identifying the seller as the legal taxpayer.',
                whereToGet: 'Municipal Corporation / Panchayat / Revenue Authority',
                commonRejectionPitfall: 'B-Khata or Unapproved layout entry where bank loans and construction permissions are blocked.',
                validity: 'Current Assessment Year'
            },
            {
                id: 'resale-oc-cc',
                title: 'Occupancy Certificate (OC) & Completion Certificate',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Proof that the building was constructed in accordance with the sanctioned building plan.',
                whereToGet: 'Municipal Corporation / Local Planning Authority via Seller / Builder',
                commonRejectionPitfall: 'Properties without OC face municipal water/electricity tariff penalties and risks of partial demolition.',
                validity: 'Permanent'
            },
            {
                id: 'resale-tax-receipts',
                title: 'Latest Property Tax Paid Receipts (Last 3 Years)',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Receipts showing that all municipal or Gram Panchayat property taxes are cleared till date.',
                whereToGet: 'Municipal tax portal or counter receipts from seller',
                commonRejectionPitfall: 'Pending tax arrears will be transferred onto the new buyer with penalty interest.',
                validity: 'Current Financial Year'
            },
            {
                id: 'resale-society-noc',
                title: 'Society NOC & No Dues Certificate',
                importance: 'mandatory',
                type: 'original',
                description: 'Official letter from the Apartment Owners Association (AOA) stating zero pending maintenance fees.',
                whereToGet: 'Apartment Management Committee / RWA',
                commonRejectionPitfall: 'Unpaid sinking fund or special repair assessments left by previous owner.',
                validity: '30 Days'
            },
            {
                id: 'resale-utility-bills',
                title: 'Latest Electricity & Water Bill (with Meter Transfer Form)',
                importance: 'recommended',
                type: 'xerox_self_attested',
                description: 'Recent utility bills in seller’s name with zero arrears, plus signed consent letter for meter transfer.',
                whereToGet: 'State Electricity Board / Water Supply Board',
                commonRejectionPitfall: 'Huge commercial or industrial unpaid power dues tied to the physical meter RR number.',
                validity: 'Latest billing cycle'
            }
        ]
    },
    {
        id: 'buying-agricultural-land',
        category: 'property',
        title: 'Purchasing Agricultural Land',
        subtitle: 'Farmland verification, mutation records, and non-farmer ownership compliance',
        badge: 'Property & Land',
        icon: 'Trees',
        estimatedTAT: '30 - 60 Days',
        officialDepartment: 'Revenue Department & Sub-Registrar',
        officialPortalUrl: 'https://landrecords.gov.in',
        overview: 'Agricultural land acquisitions have state-specific farmer status eligibility laws (Section 79A/B in Karnataka, Section 63 in Maharashtra, etc.) and require stringent scrutiny of cultivation records.',
        dueDiligenceTips: [
            'Verify if your state allows non-agriculturists to purchase agricultural land or if prior revenue sanction is needed.',
            'Check Revenue Record of Rights (RTC/Pahani/7/12 extract) for 30 years to check for government land grants, Inam land, or SC/ST PTCL restrictions.',
            'Conduct a physical boundary survey through a licensed government surveyor before executing deed.',
            'Ensure right of passage / cart track road access is legally recorded in the village cadastral map.'
        ],
        stepByStepWorkflow: [
            'Extract RTC / 7/12 / Pahani records for past 30 years from Bhoomi / Meebhoomi / Mahabhulekh.',
            'Verify Mutation Extract (Register of Mutations) to see how ownership passed down through generations.',
            'Obtain Village Map & Tippani / Survey Sketch to verify boundaries and access road.',
            'Publish a 15-day Public Notice in local newspapers calling for any objections.',
            'Execute Sale Deed at the Sub-Registrar office with 2 independent local witnesses.',
            'Apply for Patta Passbook / RoR mutation through the Taluk Tehsildar / Village Administrative Officer.'
        ],
        documents: [
            {
                id: 'agri-rtc-pahani',
                title: 'RTC / Pahani / 7/12 Extract (Last 30 Years)',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Record of Rights showing land classification, soil type, crops grown, owner names, and tenancy rights.',
                whereToGet: 'State Land Records portal (Bhoomi, Mahabhulekh, Meebhoomi, Bhulekh)',
                commonRejectionPitfall: 'Names of deceased family members still appearing in column 9 with no succession initiated.',
                validity: '3 Months',
                estimatedFee: '₹15 - ₹50'
            },
            {
                id: 'agri-mutation-extract',
                title: 'Mutation Register Extract (Pauti / Ferfar)',
                importance: 'mandatory',
                type: 'original',
                description: 'Details the history of how title was transferred previously (inheritance, partition, sale, court decree).',
                whereToGet: 'Taluk Revenue Office / Village Accountant (Patwari / Talathi)',
                commonRejectionPitfall: 'Undivided ancestral share sold without signatures of all legal heirs/daughters.',
                validity: 'Current'
            },
            {
                id: 'agri-survey-sketch',
                title: 'Tippani / Akarband / Survey Sketch (Form 11E)',
                importance: 'mandatory',
                type: 'original',
                description: 'Official survey sketch from the Department of Survey and Land Records depicting physical dimensions.',
                whereToGet: 'Taluk Survey Department / Mojini portal',
                commonRejectionPitfall: 'Mismatch between on-ground physical fence and registered survey sketch acreage.',
                validity: 'Permanent'
            },
            {
                id: 'agri-non-tenancy',
                title: 'Section 79A/B / Non-Tenancy Declaration Certificate',
                importance: 'mandatory',
                type: 'affidavit',
                description: 'Affidavit affirming purchaser is eligible to hold agricultural land and complies with income caps.',
                whereToGet: 'Notary / Executive Magistrate',
                commonRejectionPitfall: 'Purchaser holding non-agricultural income above ceiling limits where state acts apply.',
                validity: '1 Year'
            },
            {
                id: 'agri-nil-encumbrance',
                title: 'Nil-Encumbrance Certificate (Form 15)',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Sub-Registrar certificate ensuring no agricultural bank crop loans or mortgages exist on the survey number.',
                whereToGet: 'Sub-Registrar Office / State IGRS portal',
                commonRejectionPitfall: 'Active primary agricultural society (PACS) loan attached to the land.',
                validity: '30 Days'
            }
        ]
    },
    // ==========================================
    // VEHICLES & TRANSPORT
    // ==========================================
    {
        id: 'used-car-bike-transfer',
        category: 'vehicle',
        title: 'Second-Hand Car / Bike RC Ownership Transfer',
        subtitle: 'RTO vehicle transfer checklist for intrastate and interstate sales',
        badge: 'Vehicles',
        icon: 'Car',
        estimatedTAT: '14 - 30 Days',
        officialDepartment: 'Ministry of Road Transport & Highways (MoRTH) / State RTO',
        officialPortalUrl: 'https://parivahan.gov.in',
        overview: 'Transferring used vehicle ownership within 14 days of purchase is legally mandatory under Section 50 of the Motor Vehicles Act. Failure to transfer keeps the original seller liable for accidents or police challans.',
        dueDiligenceTips: [
            'Check for unpaid traffic e-challans on the Parivahan portal before making final payment.',
            'Check Parivahan Vahan dashboard to verify if the vehicle is blacklisted or flagged as stolen by police.',
            'Verify chassis and engine numbers stamped on the vehicle chassis match the RC card character-by-character.',
            'Ensure insurance has at least 30 days of validity remaining so it can be transferred alongside RC.'
        ],
        stepByStepWorkflow: [
            'Seller signs Form 29 (Notice of Transfer) and Form 30 (Application for Transfer) in duplicate.',
            'Clear all outstanding traffic challans on Parivahan portal.',
            'If vehicle is financed, obtain Form 35 + NOC letter from the financier bank.',
            'Submit application online at parivahan.gov.in or at the jurisdictional RTO.',
            'Physically submit original RC, forms, and pencil imprint of chassis number at RTO counter.',
            'Once new RC is issued, apply for insurance policy transfer to buyer’s name within 14 days.'
        ],
        documents: [
            {
                id: 'rto-rc-original',
                title: 'Original Registration Certificate (Smart Card / Paper RC)',
                importance: 'mandatory',
                type: 'original',
                description: 'Original vehicle RC issued by the registering authority.',
                whereToGet: 'From the seller (inspect carefully for physical tampering)',
                commonRejectionPitfall: 'Faded chassis numbers or torn smart card chip.',
                validity: '15 Years from original registration'
            },
            {
                id: 'rto-form-29',
                title: 'Form 29 (Notice of Transfer of Ownership) - 2 Copies',
                importance: 'mandatory',
                type: 'original',
                description: 'Official notice from the seller declaring vehicle has been sold and delivered.',
                whereToGet: 'Download from parivahan.gov.in or RTO portal',
                commonRejectionPitfall: 'Seller signature mismatch with specimen signature on RTO records.',
                validity: '14 Days from date of sale'
            },
            {
                id: 'rto-form-30',
                title: 'Form 30 (Application for Transfer of Ownership) - 2 Copies',
                importance: 'mandatory',
                type: 'original',
                description: 'Formal joint application by both buyer and seller to transfer the registration mark.',
                whereToGet: 'Download from parivahan.gov.in',
                commonRejectionPitfall: 'Omission of chassis pencil print on the designated section of the form.',
                validity: '14 Days from date of sale'
            },
            {
                id: 'rto-form-28-noc',
                title: 'Form 28 (No Objection Certificate) - 3 Copies',
                importance: 'conditional',
                type: 'original',
                description: 'Mandatory only if transferring from one RTO jurisdiction to another RTO or another state.',
                whereToGet: 'Jurisdictional RTO where vehicle is currently registered',
                commonRejectionPitfall: 'Expired NOC (NOC is valid for 6 months; after that re-validation is cumbersome).',
                validity: '6 Months',
                estimatedFee: '₹100'
            },
            {
                id: 'rto-insurance',
                title: 'Valid Motor Insurance Policy Copy',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Active comprehensive or third-party insurance policy.',
                whereToGet: 'Insurer portal or current seller',
                commonRejectionPitfall: 'Lapsed insurance policy — RTO will outright reject ownership transfer without active cover.',
                validity: 'Must be active during transfer'
            },
            {
                id: 'rto-puc',
                title: 'Valid Pollution Under Control (PUC) Certificate',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Emission test certificate linked to Parivahan Vahan portal.',
                whereToGet: 'Any authorized fuel station PUC testing centre',
                commonRejectionPitfall: 'PUC not synced onto Parivahan database due to poor network at the emission centre.',
                validity: '6 Months to 1 Year',
                estimatedFee: '₹60 - ₹120'
            },
            {
                id: 'rto-buyer-kyc',
                title: 'Buyer Aadhaar, PAN Card & Address Proof',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Self-attested copies of buyer’s government IDs for address verification in the RTO zone.',
                whereToGet: 'DigiLocker / Self',
                commonRejectionPitfall: 'Buyer residing in rented home without registered rental agreement matching address.',
                validity: 'Current'
            }
        ]
    },
    {
        id: 'vehicle-hypothecation-removal',
        category: 'vehicle',
        title: 'Vehicle Loan Hypothecation Removal (HPA Termination)',
        subtitle: 'Removing bank lien from RC card after repaying your car/bike loan',
        badge: 'Vehicles',
        icon: 'ShieldCheck',
        estimatedTAT: '7 - 14 Days',
        officialDepartment: 'State RTO & Financier Bank',
        officialPortalUrl: 'https://parivahan.gov.in',
        overview: 'After paying your final vehicle loan EMI, the bank’s name remains on your RC until you formally apply for Hypothecation Cancellation. You cannot sell your vehicle or claim total loss insurance without removing this lien.',
        dueDiligenceTips: [
            'Ensure the bank issues Form 35 in duplicate with their official seal and authorized signature.',
            'Check that the bank NOC has not expired (most bank NOCs are valid for 90 days only).',
            'Apply online on Parivahan to generate the application fee receipt before visiting the RTO.'
        ],
        stepByStepWorkflow: [
            'Collect Bank NOC and two signed copies of Form 35 from the lender bank.',
            'Login to Parivahan Citizen Services and choose "Hypothecation Termination".',
            'Pay RTO fee online (approx ₹100 - ₹500 depending on bike/car).',
            'Submit original RC, Bank NOC, Form 35, and insurance copy at RTO.',
            'Receive updated Smart Card RC with "Hypothecation: NIL".'
        ],
        documents: [
            {
                id: 'hypo-bank-noc',
                title: 'Bank No Objection Certificate (NOC) / No Dues Letter',
                importance: 'mandatory',
                type: 'original',
                description: 'Letter from bank stating loan account is closed with zero balance outstanding.',
                whereToGet: 'Lender Bank / NBFC Branch',
                commonRejectionPitfall: 'Bank NOC date is older than 90 days (RTO mandates fresh letter if expired).',
                validity: '90 Days'
            },
            {
                id: 'hypo-form-35',
                title: 'Form 35 in Duplicate (with Bank Seal)',
                importance: 'mandatory',
                type: 'original',
                description: 'Notice of termination of agreement of hire-purchase / lease / hypothecation.',
                whereToGet: 'Issued by the bank upon loan closure',
                commonRejectionPitfall: 'Missing round bank branch stamp or signature of bank authorized signatory.',
                validity: '90 Days'
            },
            {
                id: 'hypo-original-rc',
                title: 'Original Registration Certificate (RC)',
                importance: 'mandatory',
                type: 'original',
                description: 'Existing RC card showing bank name in the hypothecation field.',
                whereToGet: 'Vehicle Owner',
                commonRejectionPitfall: 'Submitting duplicate RC when original is still with the financier.',
                validity: 'Current'
            },
            {
                id: 'hypo-valid-puc-ins',
                title: 'Valid Insurance Policy & PUC Certificate',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Mandatory prerequisites for any RTO service.',
                whereToGet: 'Insurer / Testing Centre',
                commonRejectionPitfall: 'Lapsed insurance halts application processing.',
                validity: 'Current'
            }
        ]
    },
    // ==========================================
    // PROVIDENT FUND (EPFO) & RETIREMENT
    // ==========================================
    {
        id: 'epfo-full-withdrawal',
        category: 'pf_pension',
        title: 'EPFO Final PF Withdrawal (Form 19 & 10C)',
        subtitle: 'Full provident fund & EPS pension settlement upon leaving employment',
        badge: 'PF & EPFO',
        icon: 'Briefcase',
        estimatedTAT: '7 - 14 Days',
        officialDepartment: 'Employees’ Provident Fund Organisation (EPFO)',
        officialPortalUrl: 'https://unifiedportal-mem.epfindia.gov.in',
        overview: 'Employees who have resigned and remained unemployed for at least 2 months (or left service after 58 years of age) can withdraw their entire PF balance (Form 19) and Pension benefit (Form 10C).',
        dueDiligenceTips: [
            'Verify that your previous employer has marked your "Date of Exit" in the EPFO portal.',
            'Ensure your name, father’s name, and DOB match character-for-character across Aadhaar, PAN, and EPFO.',
            'Bank account linked to UAN must have your name printed on the cheque book, or claim will be rejected.',
            'If service is less than 5 years and withdrawal exceeds ₹50,000, submit Form 15G/15H to prevent 10% TDS deduction.'
        ],
        stepByStepWorkflow: [
            'Log in to Unified Member Portal using UAN and password.',
            'Check "Service History" to ensure Date of Exit (DOE) is entered by employer.',
            'Verify KYC tab: Aadhaar (verified with UIDAI), PAN (verified with ITD), Bank IFSC (approved).',
            'Go to "Online Services" -> "Claim (Form-31, 19, 10C & 10D)".',
            'Verify last 4 digits of bank account number.',
            'Upload image of cancelled cheque / bank passbook first page showing name, account #, and IFSC.',
            'Authenticate with Aadhaar OTP to submit claim.'
        ],
        documents: [
            {
                id: 'epfo-cancelled-cheque',
                title: 'Cancelled Cheque with Name Printed (or Bank Passbook)',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Scanned copy of bank cheque showing Account Holder Name, Account Number, and IFSC code.',
                whereToGet: 'Your Bank Chequebook (must be pre-printed with your name)',
                commonRejectionPitfall: 'Handwritten name on cheque or blank cheque without printed name is the #1 cause of EPFO rejection!',
                validity: 'Current Bank Account'
            },
            {
                id: 'epfo-pan-card',
                title: 'PAN Card Linked to UAN',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Permanent Account Number seeded and verified in the EPFO Member Portal.',
                whereToGet: 'Income Tax Department / NSDL',
                commonRejectionPitfall: 'PAN not seeded leads to 34.6% TDS deduction instead of 10% or zero.',
                validity: 'Lifetime'
            },
            {
                id: 'epfo-form-15g',
                title: 'Form 15G / 15H (TDS Exemption Form)',
                importance: 'conditional',
                type: 'digital_portal',
                description: 'Self-declaration for non-deduction of tax if service is under 5 years and total taxable income is below exemption limit.',
                whereToGet: 'Download standard Form 15G from EPFO or Income Tax portal',
                commonRejectionPitfall: 'Not submitting Form 15G when service is under 5 years causes automatic TDS deduction.',
                validity: 'Financial Year'
            },
            {
                id: 'epfo-aadhaar-otp',
                title: 'Aadhaar Card Linked with Active Mobile Number',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Aadhaar details must match EPFO records for instant OTP e-signing of the claim.',
                whereToGet: 'UIDAI',
                commonRejectionPitfall: 'Mobile number linked to Aadhaar is lost or switched off during claim filing.',
                validity: 'Lifetime'
            }
        ]
    },
    {
        id: 'epfo-advance-claim',
        category: 'pf_pension',
        title: 'EPFO Advance / Partial Withdrawal (Form 31)',
        subtitle: 'Emergency PF loan for medical bills, marriage, home purchase, or illness',
        badge: 'PF & EPFO',
        icon: 'Wallet',
        estimatedTAT: '3 - 7 Days',
        officialDepartment: 'Employees’ Provident Fund Organisation (EPFO)',
        officialPortalUrl: 'https://unifiedportal-mem.epfindia.gov.in',
        overview: 'You do not need to quit your job to access PF money. Form 31 allows non-refundable advances for medical emergencies (self/family), home purchase/construction, daughter/sister/self marriage, or post-matric education.',
        dueDiligenceTips: [
            'Choosing the "Illness / Outbreak of Pandemic" para requires no medical certificates and has the fastest approval rate (auto-mode).',
            'For home purchase advances, 5 years of continuous PF service is mandatory.',
            'Marriage advance requires 7 years of service (up to 50% of employee share).',
            'Ensure bank KYC is verified by your current employer before applying.'
        ],
        stepByStepWorkflow: [
            'Log in to EPFO Member Portal.',
            'Select Online Services -> Claim Form 31.',
            'Enter bank account number to authenticate.',
            'Choose the purpose of advance (e.g., Illness, Housing, Marriage).',
            'Enter amount required and your residential address.',
            'Upload image of cancelled cheque showing printed name.',
            'Submit via Aadhaar OTP.'
        ],
        documents: [
            {
                id: 'pf-adv-cheque',
                title: 'Cancelled Cheque with Pre-printed Name',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Legible image of cheque leaf with pre-printed account holder name and IFSC.',
                whereToGet: 'Bank cheque book',
                commonRejectionPitfall: 'Image blur or file size below 100KB/above 500KB resulting in auto-rejection.',
                validity: 'Current'
            },
            {
                id: 'pf-adv-medical-cert',
                title: 'Medical Certificate / Doctor Prescription (Only for specialized illnesses)',
                importance: 'conditional',
                type: 'xerox_self_attested',
                description: 'Doctor recommendation for hospitalization or major surgery under Illness para.',
                whereToGet: 'Treating Doctor / Hospital',
                commonRejectionPitfall: 'Not needed if applying under general "Illness" or "Natural Calamity" auto-mode paras.',
                validity: 'Recent (within 30 days)'
            }
        ]
    },
    // ==========================================
    // HOSPITALIZATION & HEALTH INSURANCE
    // ==========================================
    {
        id: 'hospital-cashless-claim',
        category: 'hospital_insurance',
        title: 'Hospital Cashless Health Insurance Approval',
        subtitle: 'Emergency & planned hospital admission pre-authorization checklist',
        badge: 'Health & Insurance',
        icon: 'Hospital',
        urgency: 'emergency',
        estimatedTAT: '2 - 6 Hours (Instant at Hospital)',
        officialDepartment: 'Third Party Administrator (TPA) & Hospital Insurance Desk',
        overview: 'Cashless hospitalization allows policyholders to receive treatment without paying bills upfront (except non-medical expenses). Pre-authorization must be submitted within 24 hours of emergency admission or 48 hours before planned surgery.',
        dueDiligenceTips: [
            'Verify if the treating hospital is inside your insurer’s "Network Hospital List" (Preferred Provider Network - PPN).',
            'Inform the insurance desk immediately upon admission; do not wait until discharge day.',
            'Ensure the doctor’s initial diagnosis note clearly states symptoms and onset date (avoids pre-existing disease dispute).',
            'Remember that room rent caps determine proportionate deduction across surgeon and nursing fees!'
        ],
        stepByStepWorkflow: [
            'Approach Hospital TPA / Insurance Helpdesk with Health E-card and Patient ID proof.',
            'Hospital fills Section B (Medical details & estimated cost) of Cashless Pre-Auth Form.',
            'Patient / Proposer signs Section A (Policyholder declaration).',
            'Hospital transmits form and initial consultation papers to Insurer / TPA.',
            'TPA issues Initial Approval Letter (Authorization Sanction).',
            'At discharge, hospital sends final bill; TPA issues Final Approval Letter; patient pays non-medical items.'
        ],
        documents: [
            {
                id: 'cashless-tpa-card',
                title: 'Health Insurance E-Card / Policy Number',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'TPA Health Card or Policy Document showing Policy Number, Proposer Name, and Member ID.',
                whereToGet: 'Insurer Mobile App / DigiLocker / Email policy PDF',
                commonRejectionPitfall: 'Presenting expired policy document after policy renewal date.',
                validity: 'Current Policy Period'
            },
            {
                id: 'cashless-patient-kyc',
                title: 'Patient & Proposer Government Photo ID Proof',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Aadhaar Card, PAN Card, or Voter ID of patient and main policyholder.',
                whereToGet: 'Patient / Family',
                commonRejectionPitfall: 'Spelling mismatch between name on health card and Aadhaar.',
                validity: 'Lifetime'
            },
            {
                id: 'cashless-preauth-form',
                title: 'Cashless Pre-Authorization Request Form',
                importance: 'mandatory',
                type: 'original',
                description: 'Standardized IRDAI form detailing illness, planned line of treatment, estimated room rent, and surgical costs.',
                whereToGet: 'Hospital TPA desk',
                commonRejectionPitfall: 'Doctor leaving "duration of current illness" blank, triggering query for pre-existing disease (PED).',
                validity: 'Single Admission'
            },
            {
                id: 'cashless-first-consult',
                title: 'First Doctor Consultation Sheet & Referral Letter',
                importance: 'mandatory',
                type: 'original',
                description: 'Outpatient (OPD) prescription note where doctor first diagnosed the condition and advised hospitalization.',
                whereToGet: 'Treating Physician',
                commonRejectionPitfall: 'Failure to produce first consultation prescription leads TPA to suspect chronic ailment.',
                validity: 'Recent'
            }
        ]
    },
    {
        id: 'hospital-reimbursement-claim',
        category: 'hospital_insurance',
        title: 'Hospital Reimbursement Claim Filing',
        subtitle: 'Full claim documentation package for non-network hospitals or denied cashless',
        badge: 'Health & Insurance',
        icon: 'Receipt',
        estimatedTAT: '15 - 30 Days',
        officialDepartment: 'Insurance Company / TPA Claims Processing Centre',
        overview: 'If you were admitted to a non-network hospital or had your cashless denied, you must pay upfront and file a reimbursement claim within 15 to 30 days of discharge. Every single bill must be supported by a prescription.',
        dueDiligenceTips: [
            'Submit the reimbursement dossier within 30 days of discharge (strict deadline).',
            'Consolidated pharmacy receipts get rejected! Demand itemized pharmacy bills with batch numbers and tax breakdown.',
            'Collect the full "Indoor Case Papers" (ICP) and Doctor daily progress notes before leaving the hospital.',
            'Always keep a complete Xerox/scanned copy of every page sent to the insurer.'
        ],
        stepByStepWorkflow: [
            'Collect original Discharge Summary, Final Bill with payment receipt, and test reports upon discharge.',
            'Collect all pre-hospitalization bills (up to 30 days prior) and post-hospitalization bills (up to 60 days post).',
            'Fill out the comprehensive Reimbursement Claim Form (Part A by patient, Part B by hospital).',
            'Attach cancelled cheque of the primary policyholder for direct bank transfer (NEFT).',
            'Submit physically via courier or upload through insurer app; track acknowledgment number.'
        ],
        documents: [
            {
                id: 'reimb-discharge-summary',
                title: 'Original Discharge Summary (Signed & Stamped)',
                importance: 'mandatory',
                type: 'original',
                description: 'Complete hospital report mentioning date/time of admission & discharge, clinical findings, treatment given, and advice on discharge.',
                whereToGet: 'Hospital Nursing Station / Medical Records Dept (MRD)',
                commonRejectionPitfall: 'Missing hospital seal or doctor signature, or omission of past medical history.',
                validity: 'Permanent'
            },
            {
                id: 'reimb-final-bill',
                title: 'Original Itemized Final Hospital Bill & Payment Receipt',
                importance: 'mandatory',
                type: 'original',
                description: 'Detailed bill showing room charges, nursing charges, OT fees, surgeon fees, and medicine breakdown with payment receipt.',
                whereToGet: 'Hospital Billing Department',
                commonRejectionPitfall: 'Submitting payment receipt without itemized breakdown (interim/summary bills are rejected).',
                validity: 'Permanent'
            },
            {
                id: 'reimb-pharmacy-bills',
                title: 'Itemized Pharmacy Bills with Doctor Prescriptions',
                importance: 'mandatory',
                type: 'original',
                description: 'Original bills for all medicines purchased inside and outside hospital during treatment.',
                whereToGet: 'Hospital / Retail Pharmacy',
                commonRejectionPitfall: 'Medicine bill submitted without matching doctor prescription or missing drug batch numbers.',
                validity: 'Permanent'
            },
            {
                id: 'reimb-icp-notes',
                title: 'Indoor Case Papers (ICP) & Operation Theatre (OT) Notes',
                importance: 'recommended',
                type: 'xerox_self_attested',
                description: 'Nurse daily progress sheets, vitals charts, doctor daily rounds notes, and surgical anaesthesia record.',
                whereToGet: 'Hospital Medical Records Department (MRD) — request upon discharge',
                commonRejectionPitfall: 'Crucial for claims exceeding ₹1 Lakh; claims get stalled for months if ICP is missing.',
                validity: 'Permanent'
            },
            {
                id: 'reimb-diagnostic-reports',
                title: 'Investigation Reports & Radiography Films / CDs',
                importance: 'mandatory',
                type: 'original',
                description: 'Lab blood test reports, ECG, Ultrasound, MRI/CT scans with radiologist report.',
                whereToGet: 'Diagnostic Labs / Hospital Pathology',
                commonRejectionPitfall: 'Submitting bill for MRI/CT scan without attaching the actual diagnostic report.',
                validity: 'Permanent'
            },
            {
                id: 'reimb-cancelled-cheque',
                title: 'Cancelled Cheque of Proposer for NEFT Transfer',
                importance: 'mandatory',
                type: 'original',
                description: 'Cheque leaf with proposer name printed to credit claim amount directly.',
                whereToGet: 'Bank Chequebook',
                commonRejectionPitfall: 'Providing account in the name of patient when patient is a dependent and proposer is spouse/parent.',
                validity: 'Current'
            }
        ]
    },
    // ==========================================
    // LOANS & MORTGAGES
    // ==========================================
    {
        id: 'home-loan-application',
        category: 'loans',
        title: 'Home Loan Application Dossier',
        subtitle: 'Comprehensive financial & property documentation for home loan sanction',
        badge: 'Loans & Banking',
        icon: 'Banknote',
        estimatedTAT: '7 - 21 Days',
        officialDepartment: 'Commercial Banks / Housing Finance Companies (HFC)',
        overview: 'Lenders evaluate both the borrower’s repayment capacity (financial underwriting) and the property’s legal clear title (technical & legal appraisal) before disbursing home loan amounts.',
        dueDiligenceTips: [
            'Maintain a CIBIL score of 750+ for the lowest interest rates and minimal processing fees.',
            'Ensure all salary credits in your bank statements match your salary slip figures without discrepancies.',
            'Check if the builder project has an APF (Approved Project Financial) number with the prospective bank for instant approval.',
            'Ask the bank for an exact list of original title deeds they will take into their custody (Safe Custody Letter).'
        ],
        stepByStepWorkflow: [
            'Submit KYC and income proof documents for preliminary financial sanction.',
            'Receive in-principle sanction letter with maximum approved loan amount.',
            'Submit complete property paper trail (Agreement to sell, EC, Khata, Sanctioned plan).',
            'Bank deputes advocate for legal title search and valuer for property inspection.',
            'Sign Loan Agreement and deposit original property title deeds with bank.',
            'Bank issues disbursement cheque/RTGS to seller/builder.'
        ],
        documents: [
            {
                id: 'loan-pan-aadhaar',
                title: 'Applicant & Co-Applicant PAN Card & Aadhaar Card',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Primary identity and address verification required by RBI KYC guidelines.',
                whereToGet: 'Self / DigiLocker',
                commonRejectionPitfall: 'Mismatch in address or marital name change not updated in PAN database.',
                validity: 'Permanent'
            },
            {
                id: 'loan-salary-slips',
                title: 'Last 3 to 6 Months Salary Slips (Salaried)',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Pay slips stamped by employer HR showing gross salary, statutory deductions (PF/PT), and net pay.',
                whereToGet: 'Employer HR portal',
                commonRejectionPitfall: 'Unexplained salary reductions or lack of corporate stamp on computer-generated slips.',
                validity: 'Last 3-6 Months'
            },
            {
                id: 'loan-bank-statement',
                title: 'Last 6 Months Bank Statement of Salary / Business Account',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Original PDF e-statement with bank logo showing regular salary credits and existing EMI deductions.',
                whereToGet: 'NetBanking Portal (download digitally signed PDF)',
                commonRejectionPitfall: 'Cheque bounces or inward return charges severely downgrade credit scoring.',
                validity: 'Last 6 Months'
            },
            {
                id: 'loan-form-16-itr',
                title: 'Last 2 to 3 Years Form 16 & ITR-V with Computation',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Proof of income continuity and tax compliance filed with the Income Tax Department.',
                whereToGet: 'Income Tax e-filing portal / Employer HR',
                commonRejectionPitfall: 'Filing delayed or revised ITRs with massive artificial income jumps just before loan application.',
                validity: 'Last 2-3 Assessment Years'
            },
            {
                id: 'loan-sale-agreement',
                title: 'Registered Agreement to Sell / Builder Buyer Agreement',
                importance: 'mandatory',
                type: 'original',
                description: 'Contract between buyer and seller specifying purchase consideration and payment milestone schedule.',
                whereToGet: 'Drafted with Advocate & registered at Sub-Registrar',
                commonRejectionPitfall: 'Unregistered agreement on simple stamp paper is rejected by most nationalized banks.',
                validity: 'Current Transaction'
            },
            {
                id: 'loan-own-contribution',
                title: 'Proof of Own Contribution (Margin Money Paid Receipts)',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Bank payment vouchers and seller receipts proving buyer paid 10-20% margin money.',
                whereToGet: 'Bank transaction receipts to seller',
                commonRejectionPitfall: 'Cash payment claims without banking trail will not be recognized as margin money.',
                validity: 'Current'
            }
        ]
    },
    {
        id: 'loan-closure-deed-retrieval',
        category: 'loans',
        title: 'Loan Foreclosure & Original Title Deed Retrieval',
        subtitle: 'Checklist for reclaiming your original property papers and clearing bank charge',
        badge: 'Loans & Banking',
        icon: 'Key',
        estimatedTAT: '15 - 30 Days',
        officialDepartment: 'Lending Bank & CERSAI / Sub-Registrar',
        overview: 'Paying off your home loan is not complete until you reclaim every original title document deposited in the bank locker and ensure the bank files a Satisfaction of Charge in CERSAI registry.',
        dueDiligenceTips: [
            'RBI mandates banks must return original property documents within 30 days of loan repayment or pay ₹5,000 per day penalty.',
            'Count and verify every single page of original mother deeds against the original deposit acknowledgment list.',
            'Check for physical wet-ink bank stamps saying "Cancelled" across the deposited loan security documents.',
            'Obtain a No Objection Certificate (NOC) and CERSAI satisfaction certificate to remove bank’s public lien.'
        ],
        stepByStepWorkflow: [
            'Pay off the final balance and request a formal Loan Foreclosure Statement.',
            'Bank processes closure and summons the original documents from their centralized archival vault.',
            'Both borrower and co-borrower visit the designated bank branch in person with photo IDs.',
            'Inspect each document against the original "List of Documents" (LOD) handed over at sanction.',
            'Sign the document handover register and obtain No Dues Certificate (NDC).',
            'Register Deeds of Release/Reconveyance at the Sub-Registrar to clear the registered lien.'
        ],
        documents: [
            {
                id: 'close-ndc',
                title: 'No Dues Certificate (NDC) / Loan Closure Letter',
                importance: 'mandatory',
                type: 'original',
                description: 'Official letter from bank stating loan account is closed with zero balance outstanding.',
                whereToGet: 'Lending Bank Branch',
                commonRejectionPitfall: 'Unpaid fractional interest or pending legal audit charges leaving ₹1 balance active.',
                validity: 'Permanent'
            },
            {
                id: 'close-lod',
                title: 'Original List of Documents (LOD) Deposit Receipt',
                importance: 'mandatory',
                type: 'original',
                description: 'The receipt given by the bank when you first deposited your property papers.',
                whereToGet: 'Your personal file (handed over during loan disbursement)',
                commonRejectionPitfall: 'Misplacing LOD causes delays in locating documents at bank’s central repository.',
                validity: 'Permanent'
            },
            {
                id: 'close-cersai-cert',
                title: 'CERSAI Charge Satisfaction Certificate',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Proof that the security interest registered with CERSAI (Central Registry) has been vacated.',
                whereToGet: 'Bank / CERSAI public portal',
                commonRejectionPitfall: 'Bank fails to update CERSAI portal, causing future buyers or lenders to see an active mortgage.',
                validity: 'Permanent'
            },
            {
                id: 'close-deed-reconveyance',
                title: 'Deed of Reconveyance / Release Deed',
                importance: 'conditional',
                type: 'original',
                description: 'Registered document required in states where mortgage by deposit of title deeds was registered at the Sub-Registrar.',
                whereToGet: 'Executed by bank officer at Sub-Registrar office',
                commonRejectionPitfall: 'Not executing release deed leaves registered charge active in the Encumbrance Certificate.',
                validity: 'Permanent'
            }
        ]
    },
    // ==========================================
    // GOVERNMENT SCHEMES
    // ==========================================
    {
        id: 'sukanya-samriddhi-yojana',
        category: 'govt_schemes',
        title: 'Sukanya Samriddhi Yojana (SSY - Girl Child Scheme)',
        subtitle: 'Government high-interest tax-free savings scheme for girl child up to 10 years',
        badge: 'Govt Schemes',
        icon: 'Sparkles',
        estimatedTAT: 'Same Day at Post Office / Bank',
        officialDepartment: 'Department of Posts (India Post) / Public Sector Banks',
        officialPortalUrl: 'https://www.ippbonline.com',
        overview: 'Sukanya Samriddhi Yojana offers one of the highest government-backed risk-free interest rates with triple tax exemption (EEE under Sec 80C). Account can be opened for any girl child below 10 years of age.',
        dueDiligenceTips: [
            'Account can only be opened before the girl child completes 10 years of age.',
            'Only 2 accounts allowed per family (except in case of twin/triplet girls born in second birth).',
            'Minimum deposit is ₹250/year and maximum is ₹1.5 Lakh/year.',
            'Matures after 21 years from account opening, or at marriage after age 18.'
        ],
        stepByStepWorkflow: [
            'Obtain SSY Account Opening Form from any Post Office or authorized commercial bank branch.',
            'Attach girl child’s birth certificate and guardian KYC documents.',
            'Submit with initial deposit amount (minimum ₹250 by cash or cheque).',
            'Receive official SSY Passbook with account number and CIF ID.',
            'Optionally link to NetBanking or IPPB app for online monthly contributions.'
        ],
        documents: [
            {
                id: 'ssy-birth-cert',
                title: 'Girl Child Birth Certificate',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Birth certificate issued by Municipal Corporation or Registrar of Births & Deaths.',
                whereToGet: 'Municipal Authority / Hospital / Birth Registrar',
                commonRejectionPitfall: 'Birth certificate without child’s official legal name registered.',
                validity: 'Lifetime'
            },
            {
                id: 'ssy-parent-kyc',
                title: 'Parent / Legal Guardian Aadhaar & PAN Card',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Identity and address proof of the biological parent or court-appointed legal guardian.',
                whereToGet: 'UIDAI / NSDL',
                commonRejectionPitfall: 'Guardian name mismatch between child’s birth certificate and guardian Aadhaar.',
                validity: 'Current'
            },
            {
                id: 'ssy-photos',
                title: 'Passport Size Photographs (Child & Guardian)',
                importance: 'mandatory',
                type: 'original',
                description: '2 recent passport size photographs of the guardian and girl child.',
                whereToGet: 'Photo studio',
                commonRejectionPitfall: 'Blurry or non-standard size photos.',
                validity: 'Recent (within 6 months)'
            },
            {
                id: 'ssy-twins-cert',
                title: 'Medical Affidavit for Twins / Triplets (If applicable)',
                importance: 'conditional',
                type: 'affidavit',
                description: 'Medical certificate / affidavit from hospital if claiming 3rd account due to twin girls in second order of birth.',
                whereToGet: 'Hospital / Notary',
                commonRejectionPitfall: 'Failure to provide proof results in rejection of 3rd account.',
                validity: 'Lifetime'
            }
        ]
    },
    {
        id: 'ayushman-bharat-pmjay',
        category: 'govt_schemes',
        title: 'Ayushman Bharat PM-JAY & Vay Vandana Card (Free ₹5 Lakh Cover)',
        subtitle: 'Health insurance card for low-income families & all senior citizens aged 70+',
        badge: 'Govt Schemes',
        icon: 'HeartPulse',
        estimatedTAT: 'Instant E-KYC Approval',
        officialDepartment: 'National Health Authority (NHA)',
        officialPortalUrl: 'https://beneficiary.nha.gov.in',
        overview: 'Provides ₹5,00,000 cashless secondary and tertiary hospitalization cover per family per year. Under the newly expanded scheme, ALL senior citizens aged 70 and above are eligible regardless of income under the Vay Vandana Card.',
        dueDiligenceTips: [
            'Senior citizens aged 70+ require ONLY Aadhaar linked with mobile OTP to generate card (no income certificate needed!).',
            'For family cards under SECC, Ration Card must have member names updated.',
            'Card can be generated for free on beneficiary.nha.gov.in or via Ayushman App.'
        ],
        stepByStepWorkflow: [
            'Visit beneficiary.nha.gov.in or download Ayushman App.',
            'Log in with mobile number and select state.',
            'Search by Aadhaar number, PMJAY ID, or Ration Card number.',
            'Complete Aadhaar Face-Auth or Mobile OTP verification.',
            'Download PVC Ayushman Card instantly on your phone.'
        ],
        documents: [
            {
                id: 'pmjay-aadhaar',
                title: 'Aadhaar Card Linked with Mobile Number',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Aadhaar is mandatory for e-KYC and biometric authentication.',
                whereToGet: 'UIDAI',
                commonRejectionPitfall: 'Mobile number not linked to Aadhaar requires physical biometric visit to CSC centre.',
                validity: 'Lifetime'
            },
            {
                id: 'pmjay-ration-card',
                title: 'State Ration Card / Family ID',
                importance: 'conditional',
                type: 'xerox_self_attested',
                description: 'Ration card containing all family members (for general PMJAY criteria; not required for 70+ seniors).',
                whereToGet: 'State Food & Civil Supplies Department',
                commonRejectionPitfall: 'Newborns or newly married spouses whose names were not added to ration card.',
                validity: 'Current'
            },
            {
                id: 'pmjay-age-proof',
                title: 'Age Proof for Senior Citizens (70+ Vay Vandana)',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Aadhaar card DOB is accepted as primary age proof for senior citizen card.',
                whereToGet: 'UIDAI',
                commonRejectionPitfall: 'Aadhaar showing only birth year (e.g. 1956) instead of full DD/MM/YYYY.',
                validity: 'Lifetime'
            }
        ]
    },
    // ==========================================
    // BEREAVEMENT, LEGAL & LIFE EVENTS
    // ==========================================
    {
        id: 'post-death-affairs-checklist',
        category: 'legal_life',
        title: 'Post-Demise Family Affairs & Asset Transmission',
        subtitle: 'Settling bank accounts, mutual funds, property, and legal heir certificates',
        badge: 'Life & Legal',
        icon: 'Feather',
        urgency: 'high',
        estimatedTAT: '30 - 90 Days',
        officialDepartment: 'Revenue Dept (Tehsildar), Municipal Corp, Banks & RTAs',
        overview: 'When a family member passes away, grieving relatives face immense administrative complexity. Following this structured checklist ensures bank accounts are not permanently frozen and assets pass smoothly to legal heirs.',
        dueDiligenceTips: [
            'Obtain at least 15 to 20 original certified copies of the Death Certificate from the Municipality (every bank and department demands an original).',
            'Apply for a Legal Heir Certificate (Varis Dakhla / Surviving Member Certificate) from the local Tehsildar as early as possible.',
            'If accounts have registered nominees, banks MUST release funds upon death certificate + nominee KYC without demanding succession certificate (RBI guidelines).',
            'Do not withdraw money via ATM after date of death; use formal bank claim forms to prevent legal disputes among heirs.'
        ],
        stepByStepWorkflow: [
            'Register death within 21 days with municipal registrar and collect 15+ official copies.',
            'Apply for Surviving Member / Legal Heir Certificate through the District Revenue / Tehsildar portal.',
            'Submit Nominee Claim Form at bank branches along with death certificate and nominee KYC.',
            'Submit Form ISR-1/2/3 at CAMS / KFintech for mutual fund and stock transmission.',
            'Apply for Khata/Patta mutation for immovable properties at the Sub-Registrar / Municipal office.',
            'Surrender deceased’s PAN card and cancel passport after all financial settlements.'
        ],
        documents: [
            {
                id: 'death-cert-original',
                title: 'Municipal Death Certificate (Multiple Certified Copies)',
                importance: 'mandatory',
                type: 'original',
                description: 'Official death certificate issued by Municipal Corporation or Gram Panchayat.',
                whereToGet: 'Registrar of Births & Deaths / Municipal Corporation',
                commonRejectionPitfall: 'Typo in deceased person’s name compared to their bank account or PAN.',
                validity: 'Permanent'
            },
            {
                id: 'legal-heir-cert',
                title: 'Legal Heir Certificate / Surviving Member Certificate',
                importance: 'mandatory',
                type: 'original',
                description: 'Revenue authority certificate listing all surviving legal heirs (spouse, children, mother).',
                whereToGet: 'Taluk Tehsildar / Revenue Divisional Officer (RDO) / E-Seva',
                commonRejectionPitfall: 'Omission of married daughters (under Hindu Succession Act, daughters have equal coparcenary rights).',
                validity: 'Permanent'
            },
            {
                id: 'bank-nominee-claim-form',
                title: 'Bank Deceased Claim Form (with Nominee KYC)',
                importance: 'mandatory',
                type: 'original',
                description: 'Bank-specific claim form for settlement of balance in savings, current, and fixed deposit accounts.',
                whereToGet: 'Respective Bank Branch / Download from bank website',
                commonRejectionPitfall: 'Bank officers illegally asking for Succession Certificate when registered nomination exists.',
                validity: 'Specific to claim'
            },
            {
                id: 'mf-demat-isr-form',
                title: 'SEBI Form ISR-1 / Annexure for Demat & Mutual Fund Transmission',
                importance: 'mandatory',
                type: 'original',
                description: 'Standardized SEBI forms for transmission of mutual fund units and shares to nominee.',
                whereToGet: 'CAMS, KFintech, or Depository Participant (CDSL / NSDL)',
                commonRejectionPitfall: 'Bank account of nominee not verified via penny drop test before transmission.',
                validity: 'Current'
            },
            {
                id: 'affidavit-no-objection',
                title: 'No Objection Affidavit from Other Heirs (If non-nominee claims)',
                importance: 'conditional',
                type: 'notary',
                description: 'Notarized affidavit on stamp paper where other legal heirs relinquish their claim in favor of one heir.',
                whereToGet: 'Advocate / Notary on non-judicial stamp paper',
                commonRejectionPitfall: 'Missing signature of any one legal heir.',
                validity: 'Permanent'
            }
        ]
    },
    {
        id: 'fresh-tatkal-passport',
        category: 'legal_life',
        title: 'Passport Application (Fresh / Renewal / Tatkaal)',
        subtitle: 'Ministry of External Affairs document matrix for standard & fast-track passport',
        badge: 'Identity & Travel',
        icon: 'Plane',
        estimatedTAT: 'Tatkaal: 1 - 3 Days | Normal: 7 - 14 Days',
        officialDepartment: 'Passport Seva Kendra (PSK) / Ministry of External Affairs',
        officialPortalUrl: 'https://passportindia.gov.in',
        overview: 'Applying for an Indian passport requires proof of Date of Birth, Present Address, and ECNR (Non-Emigration Check Required) qualification. Tatkaal applications require 3 specific IDs from MEA list.',
        dueDiligenceTips: [
            'Address proof must reflect where you currently reside (even if rented), not your permanent hometown.',
            'Aadhaar details (Name, Father’s name, DOB) must match your 10th Standard School Leaving Certificate.',
            'For Tatkaal, carry Aadhaar, PAN card, and Voter ID / Bank Passbook with photograph.',
            'Do not laminate certificates! PSK scanners cannot read laminated documents properly.'
        ],
        stepByStepWorkflow: [
            'Register on passportindia.gov.in and complete Form online.',
            'Book appointment slot and pay fee online (₹1,500 normal / ₹3,500 Tatkaal).',
            'Visit PSK on scheduled date with all original documents + 2 sets of self-attested photocopies.',
            'Pass through Counter A (Biometrics & photo), Counter B (Document verification), Counter C (Granting).',
            'Police verification initiated at local police station; track dispatch via India Post speed post.'
        ],
        documents: [
            {
                id: 'pass-dob-proof',
                title: 'Proof of Date of Birth (Birth Certificate or 10th Marksheet)',
                importance: 'mandatory',
                type: 'original',
                description: '10th standard school board certificate or municipal birth certificate.',
                whereToGet: 'Education Board / Municipal Registrar',
                commonRejectionPitfall: 'Father’s initial expanded on 10th cert but abbreviated on Aadhaar.',
                validity: 'Lifetime'
            },
            {
                id: 'pass-address-proof',
                title: 'Proof of Present Address (Aadhaar / Bank Passbook / Electricity Bill)',
                importance: 'mandatory',
                type: 'original',
                description: 'Document validating applicant’s physical stay at the present address for last 1 year.',
                whereToGet: 'Bank (with photo stamped by manager) / Utility Board',
                commonRejectionPitfall: 'Bank passbook without photo affixed or without round bank manager stamp across photo.',
                validity: 'Current (within 1 year)'
            },
            {
                id: 'pass-ecnr-proof',
                title: 'Non-ECR Proof (Educational Degree or 10th Pass Marksheet)',
                importance: 'mandatory',
                type: 'original',
                description: 'Proof of passing matriculation (10th standard) or higher degree to get Non-ECR passport.',
                whereToGet: 'School / University',
                commonRejectionPitfall: 'Applicants without 10th cert get ECR status requiring protector of emigrants clearance for gulf work.',
                validity: 'Lifetime'
            },
            {
                id: 'pass-old-passport',
                title: 'Old Original Passport (If Re-issue / Renewal)',
                importance: 'conditional',
                type: 'original',
                description: 'Previous passport along with self-attested copies of first 2 and last 2 pages including ECR/Non-ECR page.',
                whereToGet: 'Applicant',
                commonRejectionPitfall: 'Failure to report damaged or lost passport under appropriate renewal category.',
                validity: 'Expired / Expiring'
            }
        ]
    },
    {
        id: 'physical-shares-to-demat',
        category: 'legal_life',
        title: 'Converting Physical Share Certificates to Demat (SEBI ISR)',
        subtitle: 'Step-by-step dematerialization of paper share certificates, KYC unfreezing, and IEPF recovery',
        badge: 'Shares & Demat',
        icon: 'TrendingUp',
        urgency: 'high',
        estimatedTAT: '30 - 60 Days (6 - 12 Months if in IEPF)',
        officialDepartment: 'SEBI, RTA (Link Intime / KFintech), & Depositories (CDSL / NSDL)',
        officialPortalUrl: 'https://www.sebi.gov.in',
        overview: 'Under SEBI regulations, physical share certificates can no longer be sold or transferred in paper format. To trade, pledge, or receive future corporate dividends, you must dematerialize them into an active Demat account using standardized SEBI ISR forms. If dividends remained unclaimed for 7+ consecutive years, the shares were transferred to the IEPF Authority and must be recovered.',
        dueDiligenceTips: [
            'Check if the company has undergone mergers, stock splits, or name changes (e.g., ancient TISCO is now Tata Steel) — ensure the current ISIN is identified.',
            'Check whether the shares are still with the company RTA or have been transferred to the IEPF Authority by searching your folio on the iepf.gov.in portal.',
            'Ensure the exact name spelling and sequence of joint holders on the share certificates matches your Demat account Client Master List (CML).',
            'Never send original share certificates via normal post. Always use Registered Post / Speed Post with tracking, and preserve high-resolution color scans of both sides.'
        ],
        stepByStepWorkflow: [
            'Submit SEBI Form ISR-1 to the company Registrar & Transfer Agent (RTA) to update PAN, KYC, bank details, email, and mobile.',
            'If your signature has changed over decades, obtain SEBI Form ISR-2 with original wet-ink banker verification and branch seal.',
            'Submit Form SH-13 (Nomination Form) or Form ISR-3 (Nomination Opt-Out) to unfreeze the folio.',
            'Obtain Dematerialisation Request Form (DRF) in triplicate from your Depository Participant (Zerodha, Groww, ICICI Direct, etc.).',
            'Surrender physical certificates along with stamped DRF and CML copy to your DP counter.',
            'DP generates Demat Request Number (DRN), defaces certificates with "Surrendered for Dematerialisation", and dispatches physical lot to RTA.',
            'RTA validates original certificates against company registers and electronically credits shares into your Demat account.'
        ],
        documents: [
            {
                id: 'demat-orig-certificates',
                title: 'Original Physical Share Certificates',
                importance: 'mandatory',
                type: 'original',
                description: 'Original paper share certificates bearing Company Name, Registered Folio Number, Certificate Number, and Distinctive Number ranges.',
                whereToGet: 'Personal file / Family records',
                commonRejectionPitfall: 'Damaged, soiled, or lost certificates require Form ISR-4 for duplicate issuance with indemnity bond and FIR.',
                validity: 'Permanent'
            },
            {
                id: 'demat-drf-form',
                title: 'Dematerialisation Request Form (DRF) - Triplicate',
                importance: 'mandatory',
                type: 'original',
                description: 'Standardized depository request form filled in triplicate and signed by all registered holders in the same order as certificates.',
                whereToGet: 'Your Stock Broker / Depository Participant (DP)',
                commonRejectionPitfall: 'Holder signature mismatch with DP account specimen or different order of joint holders.',
                validity: 'Current'
            },
            {
                id: 'demat-sebi-isr1',
                title: 'SEBI Form ISR-1 (KYC & Details Registration)',
                importance: 'mandatory',
                type: 'original',
                description: 'Mandatory statutory form under SEBI circular for registering PAN, bank mandates, address, email, and mobile against the folio.',
                whereToGet: 'Download from SEBI or RTA portal (Link Intime, KFintech, CAMS, Bigshare)',
                commonRejectionPitfall: 'PAN not linked with Aadhaar results in automatic freeze of security folios by RTA.',
                validity: 'Permanent'
            },
            {
                id: 'demat-sebi-isr2',
                title: 'SEBI Form ISR-2 (Banker Attestation of Signature)',
                importance: 'mandatory',
                type: 'original',
                description: 'Verification of holder signature by bank branch manager with bank seal, employee code number, and original cancelled cheque.',
                whereToGet: 'Your savings bank home branch',
                commonRejectionPitfall: 'Bank manager missing their unique Employee Code/Number on the rubber stamp; RTA will reject without it.',
                validity: 'Current'
            },
            {
                id: 'demat-nomination-sh13',
                title: 'Form SH-13 (Nomination) or Form ISR-3 (Opt-Out)',
                importance: 'mandatory',
                type: 'original',
                description: 'Formal declaration designating legal nominee or explicit declaration opting out of nomination.',
                whereToGet: 'RTA Portal / Stock Broker',
                commonRejectionPitfall: 'Folios without registered nomination or declaration are permanently frozen by SEBI mandate.',
                validity: 'Permanent'
            },
            {
                id: 'demat-cml-report',
                title: 'Client Master List (CML) with Wet-Ink DP Stamp',
                importance: 'mandatory',
                type: 'original',
                description: 'Official Client Master Report of your Demat account confirming 16-digit BO ID, DP ID, PAN, and full address.',
                whereToGet: 'Your Demat broker (Zerodha, Upstox, Groww, ICICI, etc.)',
                commonRejectionPitfall: 'Submitting digital PDF printout without physical rubber stamp and signature of the DP branch officer.',
                validity: '3 Months'
            },
            {
                id: 'demat-iepf5-claim',
                title: 'Form IEPF-5 & Indemnity Bond (Only if transferred to IEPF)',
                importance: 'conditional',
                type: 'digital_portal',
                description: 'Statutory MCA claim for reclaiming shares whose dividends went unclaimed for 7 consecutive years.',
                whereToGet: 'Ministry of Corporate Affairs IEPF Portal (mca.gov.in)',
                commonRejectionPitfall: 'Mismatch between original entitlement letter issued by company Nodal Officer and IEPF-5 SRN claim details.',
                validity: 'Current'
            }
        ]
    },
    // ==========================================
    // BANK SCHEMES & JAN SURAKSHA
    // ==========================================
    {
        id: 'pmjjby-life-insurance',
        category: 'govt_schemes',
        title: 'Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY - ₹2 Lakh Life Cover)',
        subtitle: 'Universal life insurance for ₹436/year auto-debited via bank account & nominee claim process',
        badge: 'Bank Scheme',
        icon: 'Landmark',
        urgency: 'high',
        estimatedTAT: 'Enrollment: Instant | Claim Payout: 30 Days',
        officialDepartment: 'Ministry of Finance & Partner Life Insurers (LIC, SBI Life, etc.)',
        officialPortalUrl: 'https://jansuraksha.gov.in',
        overview: 'PMJJBY provides ₹2,00,000 pure term life insurance cover for death due to any reason (natural, medical, or accidental) for just ₹436/year. Available to anyone aged 18 to 50 with a bank or post office savings account.',
        dueDiligenceTips: [
            'Maintain at least ₹436 in your bank account during May 25 to May 31 every year so the auto-debit renewal does not fail.',
            'Only ONE PMJJBY policy is valid per person across all banks. Having multiple policies in different banks will result in premium forfeiture and only 1 claim paid.',
            'There is a 30-day lien period (waiting period) from enrollment during which non-accidental death is not covered.',
            'Ensure your nominee name is updated in the bank account; if no nominee is registered, legal heir certificate is demanded.'
        ],
        stepByStepWorkflow: [
            'Enroll via NetBanking / Mobile Banking app under "Govt Schemes" or submit auto-debit consent form at home bank branch.',
            'Auto-debit of ₹436 takes place and insurance Certificate of Insurance (COI) is generated.',
            'In case of death of the insured, nominee approaches the bank branch within 30 days of demise.',
            'Nominee submits Death Certificate, filled Claim Form, and their cancelled cheque / passbook copy.',
            'Bank verifies account records, debits history, and forwards dossier to the linked life insurer within 7 days.',
            'Insurer verifies documents and credits ₹2,00,000 directly to the nominee’s bank account within 30 days.'
        ],
        documents: [
            {
                id: 'pmjjby-bank-mandate',
                title: 'Bank Account with Auto-Debit Mandate Form',
                importance: 'mandatory',
                type: 'original',
                description: 'Active savings account with consent authorization permitting bank to auto-debit ₹436 annual premium annually in May.',
                whereToGet: 'Bank Branch / NetBanking / Mobile App',
                commonRejectionPitfall: 'Insufficient balance in bank account during May auto-debit cycle leading to lapsed cover.',
                validity: 'Annual Renewal'
            },
            {
                id: 'pmjjby-aadhaar-kyc',
                title: 'Subscriber Aadhaar Card & Nominee Photo ID',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'KYC proof validating subscriber age (must be between 18 and 50 at entry) and identity of nominee.',
                whereToGet: 'UIDAI / Self',
                commonRejectionPitfall: 'Subscriber enrolling after age 50 or spelling mismatch between bank account name and Aadhaar.',
                validity: 'Lifetime'
            },
            {
                id: 'pmjjby-death-cert',
                title: 'Official Municipal Death Certificate (For Claim)',
                importance: 'mandatory',
                type: 'original',
                description: 'Municipal Corporation / Gram Panchayat death certificate showing deceased name, date, and cause of death.',
                whereToGet: 'Registrar of Births & Deaths',
                commonRejectionPitfall: 'Date of death falling before policy commencement date or during the initial 30-day lien window.',
                validity: 'Permanent'
            },
            {
                id: 'pmjjby-claim-form',
                title: 'PMJJBY Claim Form-cum-Discharge Receipt',
                importance: 'mandatory',
                type: 'original',
                description: 'Standardized Jan Suraksha claim form filled and signed by the registered nominee in front of witnesses.',
                whereToGet: 'Home Bank Branch / Download from jansuraksha.gov.in',
                commonRejectionPitfall: 'Claim filed by a relative who is not registered as nominee in bank records.',
                validity: 'Submit within 30 days of demise'
            },
            {
                id: 'pmjjby-nominee-cheque',
                title: 'Nominee Cancelled Cheque / Passbook Copy for NEFT',
                importance: 'mandatory',
                type: 'original',
                description: 'Bank account proof of the nominee showing name, account number, and IFSC for electronic claim credit.',
                whereToGet: 'Nominee Bank Chequebook',
                commonRejectionPitfall: 'Providing cheque leaf without pre-printed name or inactive bank account.',
                validity: 'Current'
            }
        ]
    },
    {
        id: 'pmsby-accidental-insurance',
        category: 'govt_schemes',
        title: 'Pradhan Mantri Suraksha Bima Yojana (PMSBY - ₹2 Lakh Accident Cover)',
        subtitle: 'Accidental death & disability insurance for ₹20/year auto-debited via bank account',
        badge: 'Bank Scheme',
        icon: 'ShieldCheck',
        urgency: 'high',
        estimatedTAT: 'Enrollment: Instant | Claim: 30 - 60 Days',
        officialDepartment: 'Ministry of Finance & General Insurance Companies',
        officialPortalUrl: 'https://jansuraksha.gov.in',
        overview: 'PMSBY offers ₹2,00,000 cover for accidental death or permanent total disability (and ₹1,00,000 for permanent partial disability) for an unbelievable premium of just ₹20 per year. Covers individuals aged 18 to 70.',
        dueDiligenceTips: [
            'PMSBY strictly covers ACCIDENTAL events (road accidents, snake bite, drowning, falling from height, machinery accidents). Natural illness deaths are NOT covered.',
            'A police FIR or Panchnama or Hospital Medico-Legal Case (MLC) report is 100% MANDATORY for any PMSBY claim.',
            'In case of accidental death, an official Post-Mortem Report (PMR) is compulsory.',
            'Claim must be submitted to the bank within 30 calendar days of the accident.'
        ],
        stepByStepWorkflow: [
            'Enroll via NetBanking or submit consent form at your home bank branch.',
            'Annual premium of ₹20 auto-debited in May every year.',
            'In case of accident, immediately lodge Police FIR / General Diary (GD) and ensure Hospital Medico-Legal Case (MLC) is marked.',
            'For disability claims, obtain Permanent Disability Certificate from a Government District Medical Board.',
            'Submit PMSBY Claim Form along with FIR copy, Post-Mortem / Disability report, and Nominee KYC at the home bank branch.',
            'Bank processes and transmits claim to the partner General Insurance Company for direct settlement.'
        ],
        documents: [
            {
                id: 'pmsby-fir-report',
                title: 'Police FIR / Panchnama / Medico-Legal Case (MLC) Copy',
                importance: 'mandatory',
                type: 'original',
                description: 'Certified copy of Police First Information Report (FIR), inquest panchnama, or hospital MLC register extract confirming accidental injury/death.',
                whereToGet: 'Jurisdictional Police Station / Treating Hospital Casualty',
                commonRejectionPitfall: 'Failing to lodge an FIR or police GD entry. Claims without police record are outright rejected!',
                validity: 'Permanent'
            },
            {
                id: 'pmsby-post-mortem',
                title: 'Post-Mortem Report (PMR) - In Case of Death',
                importance: 'mandatory',
                type: 'original',
                description: 'Autopsy report by government forensic doctor confirming cause of death was accidental trauma.',
                whereToGet: 'Government Mortuary / Hospital Forensic Dept',
                commonRejectionPitfall: 'Autopsy indicating death was caused by cardiac arrest or pre-existing medical condition rather than accident trauma.',
                validity: 'Permanent'
            },
            {
                id: 'pmsby-disability-cert',
                title: 'Government Medical Board Disability Certificate (For Disability Claims)',
                importance: 'conditional',
                type: 'original',
                description: 'Certificate issued by District Civil Surgeon / Medical Board specifying percentage of permanent anatomical loss.',
                whereToGet: 'District Government Hospital Medical Board',
                commonRejectionPitfall: 'Submitting private doctor prescription instead of gazetted Medical Board disability certificate.',
                validity: 'Permanent'
            },
            {
                id: 'pmsby-claim-form',
                title: 'PMSBY Claim Form & Nominee Bank Details',
                importance: 'mandatory',
                type: 'original',
                description: 'Prescribed claim form with nominee bank details for direct NEFT credit.',
                whereToGet: 'Bank Branch / jansuraksha.gov.in',
                commonRejectionPitfall: 'Claim submitted after 30 days of accident without convincing condonation proof.',
                validity: 'Submit within 30 Days'
            }
        ]
    },
    {
        id: 'atal-pension-yojana',
        category: 'govt_schemes',
        title: 'Atal Pension Yojana (APY - Guaranteed ₹1,000 to ₹5,000 Monthly Pension)',
        subtitle: 'Government-guaranteed lifelong retirement pension for unorganized workers & non-taxpayers',
        badge: 'Bank Scheme',
        icon: 'PiggyBank',
        estimatedTAT: 'Enrollment: Instant | Pension: At Age 60',
        officialDepartment: 'Pension Fund Regulatory and Development Authority (PFRDA) & Bank',
        officialPortalUrl: 'https://www.npscra.nsdl.co.in',
        overview: 'APY guarantees a lifelong monthly pension of ₹1,000, ₹2,000, ₹3,000, ₹4,000, or ₹5,000 from age 60 until death. After the subscriber passes away, the spouse receives the EXACT same monthly pension for life. After both pass away, the full pension corpus (up to ₹8.5 Lakh) is returned to the nominee.',
        dueDiligenceTips: [
            'Subscribers MUST be between 18 and 40 years of age at joining.',
            'Since October 1, 2022, individuals who are INCOME TAX PAYERS are NOT eligible to join APY. If an income tax payer joins, the account will be closed and only contribution refunded.',
            'The younger you join, the lower the monthly contribution (e.g., at age 18, just ₹210/month for ₹5,000 pension; at age 40, ₹1,454/month).',
            'Keep auto-debit active; default penalty is just ₹1 per ₹100 per month.'
        ],
        stepByStepWorkflow: [
            'Approach your savings bank branch or log in to NetBanking.',
            'Fill APY Subscriber Registration Form and select desired pension slab (₹1,000 to ₹5,000).',
            'Choose contribution frequency: Monthly, Quarterly, or Half-Yearly.',
            'Submit Aadhaar, mobile number, and spouse KYC as primary nominee.',
            'Receive Permanent Retirement Account Number (PRAN) card via SMS/post.',
            'At age 60, submit pension disbursement request form at the bank branch to start monthly pension credit.'
        ],
        documents: [
            {
                id: 'apy-registration-form',
                title: 'APY Subscriber Registration Form',
                importance: 'mandatory',
                type: 'original',
                description: 'Application form specifying selected pension slab (₹1,000 - ₹5,000) and contribution schedule.',
                whereToGet: 'Bank Branch / NetBanking Portal',
                commonRejectionPitfall: 'Incorrect selection of pension tier without verifying monthly debit affordability.',
                validity: 'Permanent'
            },
            {
                id: 'apy-aadhaar-mobile',
                title: 'Aadhaar Card Linked to Active Mobile Number',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Aadhaar for age verification and mobile number to receive PRAN and transaction confirmation alerts.',
                whereToGet: 'UIDAI',
                commonRejectionPitfall: 'Applicant age exceeding 40 years on date of application submission.',
                validity: 'Lifetime'
            },
            {
                id: 'apy-non-tax-decl',
                title: 'Self-Declaration of Non-Income Tax Payer Status',
                importance: 'mandatory',
                type: 'affidavit',
                description: 'Mandatory declaration confirming subscriber does not pay income tax under Section 139 of IT Act.',
                whereToGet: 'Integrated into APY Form',
                commonRejectionPitfall: 'Filing ITR after enrolling in APY results in account closure and forfeiture of govt benefits.',
                validity: 'Current'
            },
            {
                id: 'apy-spouse-kyc',
                title: 'Spouse Name & Aadhaar (Default Nominee)',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Under APY rules, married subscribers MUST name their spouse as the primary beneficiary.',
                whereToGet: 'Spouse ID proof',
                commonRejectionPitfall: 'Leaving spouse column blank when subscriber is legally married.',
                validity: 'Lifetime'
            }
        ]
    },
    {
        id: 'mudra-loan-application',
        category: 'loans',
        title: 'Pradhan Mantri MUDRA Loan (Collateral-Free Business Credit up to ₹20 Lakh)',
        subtitle: 'Bank credit for small businesses, shops, artisans, and service units without property mortgage',
        badge: 'Bank Scheme',
        icon: 'Banknote',
        estimatedTAT: '7 - 14 Days',
        officialDepartment: 'Department of Financial Services, MUDRA & Commercial Banks / NBFCs',
        officialPortalUrl: 'https://www.mudra.org.in',
        overview: 'MUDRA loans provide collateral-free business funding for non-corporate, non-farm small/micro enterprises across 3 categories: Shishu (loans up to ₹50,000), Kishore (₹50,000 to ₹5 Lakh), and Tarun (₹5 Lakh to ₹20 Lakh). No personal property or third-party guarantee is required.',
        dueDiligenceTips: [
            'Banks cannot legally ask for collateral or physical property mortgages for MUDRA loans up to ₹10 Lakh (covered by CGFMU credit guarantee).',
            'Maintain a clean personal CIBIL score (680+) and no existing loan defaults.',
            'Always have a formal quotation / proforma invoice ready for the machinery, computer, or inventory you plan to buy.',
            'Register your enterprise for free on the Udyam portal before applying; it gives instant MSME priority.'
        ],
        stepByStepWorkflow: [
            'Register business on Udyam Registration portal (udyamregistration.gov.in) to get free Udyam certificate.',
            'Prepare business profile and proforma invoice of equipment/machinery to be financed.',
            'Apply online on JanSamarth portal (jansamarth.in) or submit MUDRA application at any commercial/Gramin bank.',
            'Bank conducts credit assessment and inspection of business premises.',
            'Loan sanction letter issued and loan amount disbursed directly to supplier/vendor or working capital account with MUDRA RuPay Card.'
        ],
        documents: [
            {
                id: 'mudra-app-form',
                title: 'Standard MUDRA Application Form (Shishu / Kishore / Tarun)',
                importance: 'mandatory',
                type: 'original',
                description: 'Standardized application form detailing promoter background, business activity, and loan amount requested.',
                whereToGet: 'Bank Branch / Download from mudra.org.in / jansamarth.in',
                commonRejectionPitfall: 'Applying for Shishu loan when requesting more than ₹50,000 (must use Kishore/Tarun form).',
                validity: 'Current Application'
            },
            {
                id: 'mudra-udyam-cert',
                title: 'Udyam Registration Certificate (MSME Proof)',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Government MSME recognition certificate showing business name, activity, and date of commencement.',
                whereToGet: 'Free online registration on udyamregistration.gov.in',
                commonRejectionPitfall: 'Unregistered business without any trade license, GST, or Udyam proof.',
                validity: 'Permanent'
            },
            {
                id: 'mudra-quotation-bills',
                title: 'Proforma Invoice / Quotation for Machinery or Stock',
                importance: 'mandatory',
                type: 'original',
                description: 'Quotation from authorized vendor specifying model number, tax breakdown, and price of equipment to be purchased.',
                whereToGet: 'Equipment / Raw Material Supplier',
                commonRejectionPitfall: 'Handwritten quotations without GSTIN from unverified vendors.',
                validity: 'Current (within 30 days)'
            },
            {
                id: 'mudra-bank-statements',
                title: 'Last 12 Months Bank Statements (Savings / Current)',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Statement showing business turnover, existing cash flows, and zero cheque bounce history.',
                whereToGet: 'NetBanking / Bank Branch',
                commonRejectionPitfall: 'Frequent inward returns or high cash withdrawals without business ledger trail.',
                validity: 'Last 12 Months'
            },
            {
                id: 'mudra-project-report',
                title: 'Projected Balance Sheet & Financial Estimates (For Loans > ₹2 Lakh)',
                importance: 'conditional',
                type: 'xerox_self_attested',
                description: '2-year projected sales, cost of goods sold, profit margin, and debt-service coverage ratio (DSCR).',
                whereToGet: 'Prepared with Tax Consultant / CA',
                commonRejectionPitfall: 'Unrealistic 500% revenue projections without historical track record.',
                validity: 'For Loan Tenure'
            }
        ]
    },
    {
        id: 'senior-citizen-savings-scheme',
        category: 'govt_schemes',
        title: 'Senior Citizen Savings Scheme (SCSS - 8.2% Quarterly Payout)',
        subtitle: 'Sovereign high-yield retirement income scheme for individuals aged 60+ up to ₹30 Lakh',
        badge: 'Bank Scheme',
        icon: 'Landmark',
        estimatedTAT: 'Same Day at Bank / Post Office',
        officialDepartment: 'Ministry of Finance & Commercial Banks / India Post',
        officialPortalUrl: 'https://www.nsiindia.gov.in',
        overview: 'SCSS is one of the highest-yielding sovereign-backed savings schemes in India, offering 8.2% annual interest disbursed directly into your bank account on the first working day of every quarter. Maximum investment limit is ₹30 Lakh, and investments qualify for Section 80C tax deduction.',
        dueDiligenceTips: [
            'Eligible age is 60+ years, OR 55+ years for individuals who retired under a Voluntary Retirement Scheme (VRS) or superannuation.',
            'Retirees aged 55-60 MUST open the account within ONE MONTH of receiving their retirement benefits.',
            'Interest is fully taxable; submit Form 15H every April if your total taxable income is below basic exemption limit to avoid TDS.',
            'Tenure is 5 years, extendable in blocks of 3 years.'
        ],
        stepByStepWorkflow: [
            'Collect SCSS Form 1 from any authorized Public/Private Sector Bank or Post Office.',
            'Attach age proof (Aadhaar/Passport) and 2 passport size photographs.',
            'If aged 55-60, attach employer retirement certificate and proof of retirement disbursement date.',
            'Deposit funds via cheque or demand draft (up to ₹30 Lakh).',
            'Receive SCSS Passbook/Certificate and set up auto-credit to your savings bank account.'
        ],
        documents: [
            {
                id: 'scss-form-1',
                title: 'SCSS Account Opening Form (Form 1)',
                importance: 'mandatory',
                type: 'original',
                description: 'Official application form for opening Senior Citizen Savings Scheme account.',
                whereToGet: 'Bank Branch / Post Office counter',
                commonRejectionPitfall: 'Exceeding the maximum cumulative ceiling of ₹30 Lakh across all bank/post office accounts.',
                validity: 'Account Opening'
            },
            {
                id: 'scss-age-proof',
                title: 'Age Proof Document (Aadhaar / Passport / Voter ID)',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Government document proving applicant has attained 60 years of age.',
                whereToGet: 'UIDAI / Passport Office',
                commonRejectionPitfall: 'Aadhaar showing only birth year without complete date/month.',
                validity: 'Lifetime'
            },
            {
                id: 'scss-retirement-cert',
                title: 'Retirement Benefit Proof (Mandatory only if Age 55 to 60)',
                importance: 'conditional',
                type: 'original',
                description: 'Letter from employer stating retirement/VRS date, retirement funds amount, and bank credit date within 1 month.',
                whereToGet: 'Retiring Employer HR / Pension Office',
                commonRejectionPitfall: 'Applying after more than 30 days from the date of retirement benefit receipt.',
                validity: 'Within 1 Month of retirement'
            },
            {
                id: 'scss-form-15h',
                title: 'Form 15H (For Non-Deduction of TDS on Interest)',
                importance: 'recommended',
                type: 'original',
                description: 'Self-declaration by senior citizen to prevent 10% TDS deduction if estimated total income is non-taxable.',
                whereToGet: 'Bank Branch / Income Tax Portal',
                commonRejectionPitfall: 'Forgetting to submit fresh Form 15H at the start of each financial year (April).',
                validity: 'Annual (Financial Year)'
            }
        ]
    },
    {
        id: 'post-office-mis-pomis',
        category: 'govt_schemes',
        title: 'Post Office / Bank Monthly Income Scheme (POMIS - 7.4% Monthly Payout)',
        subtitle: 'Fixed monthly income scheme for individuals and joint accounts with sovereign guarantee',
        badge: 'Bank Scheme',
        icon: 'Wallet',
        estimatedTAT: 'Same Day at Post Office or Bank',
        officialDepartment: 'Department of Posts / Ministry of Finance',
        officialPortalUrl: 'https://www.indiapost.gov.in',
        overview: 'POMIS offers a guaranteed monthly interest payout (7.4%+) on a one-time lump sum deposit. Deposit up to ₹9 Lakh in a single account or ₹15 Lakh in a joint account. The interest is credited automatically into your savings account on a fixed date every month.',
        dueDiligenceTips: [
            'Maximum deposit limit is ₹9 Lakh for single accounts and ₹15 Lakh for joint accounts.',
            'All joint account holders have an equal share in the investment.',
            'Tenure is 5 years; premature withdrawal allowed after 1 year with 2% penalty, and after 3 years with 1% penalty.',
            'Interest earned is taxable under "Income from Other Sources", but there is NO TDS deduction at source by Post Office.'
        ],
        stepByStepWorkflow: [
            'Collect POMIS Account Opening Form from any Post Office or authorized commercial bank.',
            'Attach Aadhaar, PAN, and 2 passport photos of all account holders.',
            'Provide cheque / cash for deposit amount (multiples of ₹1,000).',
            'Open a linked Post Office Savings Account (POSA) or provide bank account details for auto-credit.',
            'Collect POMIS passbook; monthly interest starts crediting from the exact day of deposit next month.'
        ],
        documents: [
            {
                id: 'pomis-app-form',
                title: 'POMIS Account Opening Form',
                importance: 'mandatory',
                type: 'original',
                description: 'Prescribed application form for National Savings Monthly Income Account.',
                whereToGet: 'Post Office / Bank Branch',
                commonRejectionPitfall: 'Depositing in excess of individual ₹9 Lakh / joint ₹15 Lakh limit across all branches.',
                validity: 'Account Opening'
            },
            {
                id: 'pomis-pan-aadhaar',
                title: 'Mandatory PAN Card & Aadhaar Card',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Government KYC documents mandatory for all small savings schemes under Ministry of Finance notifications.',
                whereToGet: 'UIDAI / NSDL',
                commonRejectionPitfall: 'PAN not submitted at account opening leads to account freeze until submitted.',
                validity: 'Permanent'
            },
            {
                id: 'pomis-savings-passbook',
                title: 'Linked Savings Bank / Post Office Account Passbook',
                importance: 'mandatory',
                type: 'original',
                description: 'Savings account where monthly interest will be automatically transferred via ECS/standing instruction.',
                whereToGet: 'Bank or Post Office',
                commonRejectionPitfall: 'Not setting up auto-credit mandate causes interest to sit in non-interest bearing account.',
                validity: 'Current'
            }
        ]
    },
    // ==========================================
    // ONGOING CASH BENEFIT & DBT SCHEMES
    // ==========================================
    {
        id: 'aadhaar-npci-dbt-activation',
        category: 'govt_schemes',
        title: 'Aadhaar NPCI DBT Bank Seeding (Mandatory for Scheme Cash)',
        subtitle: 'The essential one-time bank procedure required to receive any government cash payouts & subsidies',
        badge: 'DBT & Cash Payouts',
        icon: 'Landmark',
        urgency: 'high',
        estimatedTAT: '24 - 48 Hours at Bank',
        officialDepartment: 'National Payments Corporation of India (NPCI) & Banks',
        officialPortalUrl: 'https://resident.uidai.gov.in/bank-mapper',
        overview: 'Simply submitting your Aadhaar to your bank for KYC does NOT mean your account is enabled for government payouts. All central and state cash subsidies (LPG PAHAL, PM-Kisan, PMMVY, Women cash transfers, scholarships) travel via the NPCI Aadhaar Payment Bridge (APB). If your bank account is not seeded with NPCI DBT, payments fail with the error "Aadhaar not mapped to NPCI".',
        dueDiligenceTips: [
            'Only ONE bank account can receive DBT payments at any given time. If you have multiple bank accounts, designate your primary active account.',
            'Check your current seeding status on the official UIDAI portal (resident.uidai.gov.in) -> "Check Aadhaar & Bank Account Linking Status".',
            'The bank account MUST be an individual account in your single name (joint accounts frequently cause DBT routing failures).',
            'Ensure your mobile number is active to receive the government DBT payment SMS alert.'
        ],
        stepByStepWorkflow: [
            'Visit your home bank branch where you hold your primary savings account.',
            'Ask the customer service desk for the "Application for Linking / Seeding Aadhaar Number and Receiving DBT Benefits into Bank Account (NPCI Mapping)".',
            'Select Option 1: "I wish to seed my account with NPCI mapper to receive DBT benefits."',
            'Attach a self-attested photocopy of your Aadhaar card and passbook first page.',
            'Bank officer performs biometric or OTP authentication and updates the NPCI mapper server.',
            'Verify status after 48 hours on UIDAI portal or via m-Aadhaar app.'
        ],
        documents: [
            {
                id: 'dbt-npci-form',
                title: 'NPCI Aadhaar Seeding / Mandate Consent Form',
                importance: 'mandatory',
                type: 'original',
                description: 'Standardized RBI/NPCI form authorizing the bank to receive direct government benefit credits into your account.',
                whereToGet: 'Your Bank Branch / Download from npci.org.in',
                commonRejectionPitfall: 'Bank clerk only updating internal core banking KYC without submitting mandate to NPCI central mapper.',
                validity: 'Permanent until switched'
            },
            {
                id: 'dbt-aadhaar-original',
                title: 'Original Aadhaar Card & Self-Attested Copy',
                importance: 'mandatory',
                type: 'original',
                description: 'Aadhaar letter or PVC card with 12-digit UID number.',
                whereToGet: 'UIDAI / DigiLocker',
                commonRejectionPitfall: 'Name spelling mismatch between bank account passbook and Aadhaar card.',
                validity: 'Lifetime'
            },
            {
                id: 'dbt-bank-passbook',
                title: 'Bank Savings Account Passbook (Single Account)',
                importance: 'mandatory',
                type: 'original',
                description: 'Passbook of active savings account showing Account Number, IFSC, and customer name.',
                whereToGet: 'Bank Branch',
                commonRejectionPitfall: 'Submitting a dormant / inoperative bank account that has had zero transactions for over a year.',
                validity: 'Current Active Account'
            }
        ]
    },
    {
        id: 'state-women-cash-transfers',
        category: 'govt_schemes',
        title: 'Monthly Cash Support for Homemakers / Women (₹1,000 - ₹2,000/Month)',
        subtitle: 'Active ongoing monthly cash transfers: Ladki Bahin (MH), Gruha Lakshmi (KA), Subhadra (OD), Ladli Behna (MP), Magalir Urimai (TN)',
        badge: 'Ongoing Cash Payout',
        icon: 'PiggyBank',
        urgency: 'high',
        estimatedTAT: 'Monthly Direct Bank Credit (DBT)',
        officialDepartment: 'State Women & Child Development Departments',
        overview: 'Major Indian states are actively transferring ₹1,000 to ₹2,000 directly into the bank accounts of women and homemakers aged 21 to 60/65 every month. Examples include: Majhi Ladki Bahin (₹1,500/mo in Maharashtra), Gruha Lakshmi (₹2,000/mo in Karnataka), Subhadra Yojana (₹10,000/yr in Odisha), Ladli Behna (₹1,250/mo in MP), and Kalaignar Magalir Urimai (₹1,000/mo in Tamil Nadu).',
        dueDiligenceTips: [
            'The bank account MUST be in the woman’s single name (joint accounts with husband are strictly rejected in most states).',
            'The account must be 100% seeded with Aadhaar on the NPCI DBT mapper.',
            'Most state schemes require the family annual income to be below ₹2.5 Lakh or holding an eligible state ration card.',
            'Applicants should not be income tax payers or government regular employees.'
        ],
        stepByStepWorkflow: [
            'Download the respective state scheme mobile app or apply via Grama/Ward Sachivalayam or CSC Seva Kendra.',
            'Authenticate with applicant woman’s Aadhaar OTP.',
            'Enter active individual bank account number with IFSC (must be NPCI seeded).',
            'Upload Ration Card / Domicile proof and non-taxpayer self-declaration.',
            'Field verification completed by local Anganwadi worker or municipal ward officer.',
            'Monthly payment of ₹1,000 to ₹2,000 credited automatically via DBT on designated day of every month.'
        ],
        documents: [
            {
                id: 'women-single-bank',
                title: 'Individual Savings Bank Account (Single Name, NPCI Seeded)',
                importance: 'mandatory',
                type: 'original',
                description: 'Bank passbook in woman’s individual name with NPCI DBT mapper active.',
                whereToGet: 'Bank Branch (e.g. SBI, Post Office, Bank of Baroda, etc.)',
                commonRejectionPitfall: 'Submitting joint account with husband or father; leads to automatic DBT payment bounce!',
                validity: 'Active Account'
            },
            {
                id: 'women-aadhaar-phone',
                title: 'Aadhaar Card Linked to Applicant’s Mobile Number',
                importance: 'mandatory',
                type: 'digital_portal',
                description: 'Aadhaar card with working mobile number for OTP e-KYC authentication.',
                whereToGet: 'UIDAI',
                commonRejectionPitfall: 'Aadhaar linked to husband’s old mobile number which is disconnected.',
                validity: 'Lifetime'
            },
            {
                id: 'women-ration-card',
                title: 'State Ration Card / Resident Domicile Proof',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Valid state family ration card or domicile certificate proving residence in the implementing state.',
                whereToGet: 'Food & Civil Supplies Dept / Revenue Tehsildar',
                commonRejectionPitfall: 'Applicant woman’s name missing from the family ration card.',
                validity: 'Current'
            },
            {
                id: 'women-income-decl',
                title: 'Self-Declaration of Non-Taxpayer / Annual Income (<₹2.5L)',
                importance: 'mandatory',
                type: 'affidavit',
                description: 'Declaration that applicant is not an income-tax payer and does not own commercial 4-wheeler vehicle.',
                whereToGet: 'Integrated into scheme application form',
                commonRejectionPitfall: 'Filing ITR in applicant’s own name makes her disqualified.',
                validity: 'Annual'
            }
        ]
    },
    {
        id: 'pmmvy-maternity-cash-benefit',
        category: 'govt_schemes',
        title: 'Pradhan Mantri Matru Vandana Yojana (PMMVY - ₹5,000 to ₹6,000 Cash Assistance)',
        subtitle: 'Central maternity cash benefit directly credited to pregnant women and lactating mothers',
        badge: 'Ongoing Cash Payout',
        icon: 'HeartPulse',
        estimatedTAT: 'Disbursed in DBT Installments',
        officialDepartment: 'Ministry of Women and Child Development',
        officialPortalUrl: 'https://pmmvy.wcd.gov.in',
        overview: 'Under PMMVY, pregnant women receive ₹5,000 in two installments for the first living child, and ₹6,000 in a single installment for a second girl child. The cash is directly transferred via DBT into the mother’s individual Aadhaar-linked bank account to compensate for wage loss and support nutrition.',
        dueDiligenceTips: [
            'Register the pregnancy within 570 days of the Last Menstrual Period (LMP) date.',
            'The bank account MUST belong strictly to the pregnant mother (not husband’s account).',
            'The beneficiary must have an official Mother and Child Protection (MCP) card issued by a government hospital or Anganwadi.',
            'Regular central/state government employees are excluded.'
        ],
        stepByStepWorkflow: [
            'Register pregnancy at the local Anganwadi Centre or government health facility to get an MCP Card / RCH ID.',
            'Apply online on pmmvy.wcd.gov.in or submit Form 1A at the Anganwadi / ASHA worker desk.',
            'First Installment (₹3,000 for 1st child / ₹6,000 for 2nd girl child): Credited upon pregnancy registration and at least one Antenatal Checkup (ANC).',
            'Second Installment (₹2,000 for 1st child): Credited after child birth registration and first cycle of immunization (BCG, OPV, DPT, Hepatitis-B).',
            'Funds credited via DBT directly into the mother’s bank account.'
        ],
        documents: [
            {
                id: 'pmmvy-mcp-card',
                title: 'Mother and Child Protection (MCP) Card / RCH ID',
                importance: 'mandatory',
                type: 'original',
                description: 'Official card issued by Anganwadi/Government Hospital with LMP date and ANC checkup entries.',
                whereToGet: 'Local Anganwadi Centre / Primary Health Centre (PHC)',
                commonRejectionPitfall: 'Missing doctor stamp on the first Antenatal Checkup (ANC) record.',
                validity: 'Pregnancy to Child Age 5'
            },
            {
                id: 'pmmvy-mother-bank',
                title: 'Mother’s Individual Savings Bank Passbook (NPCI Seeded)',
                importance: 'mandatory',
                type: 'original',
                description: 'Passbook of pregnant woman showing active single account with Aadhaar DBT seeding.',
                whereToGet: 'Mother’s Bank Branch',
                commonRejectionPitfall: 'Submitting husband’s bank account number; PMMVY system automatically rejects non-mother accounts.',
                validity: 'Current'
            },
            {
                id: 'pmmvy-parents-aadhaar',
                title: 'Aadhaar Cards of Mother and Husband',
                importance: 'mandatory',
                type: 'xerox_self_attested',
                description: 'Identity proof of both expectant parents for family record linking.',
                whereToGet: 'UIDAI',
                commonRejectionPitfall: 'Spelling mismatch between MCP card and mother’s Aadhaar.',
                validity: 'Lifetime'
            },
            {
                id: 'pmmvy-child-birth-cert',
                title: 'Child Birth Registration Certificate (For Final Installment)',
                importance: 'conditional',
                type: 'original',
                description: 'Birth certificate issued by Municipal Corporation / Hospital showing child date of birth and gender.',
                whereToGet: 'Registrar of Births & Deaths',
                commonRejectionPitfall: 'Delaying birth registration beyond 1 year halts final installment processing.',
                validity: 'Permanent'
            }
        ]
    }
];
