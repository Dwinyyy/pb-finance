export const AVAILABILITY_OPTIONS = [
  'Immediate Start',
  '1-2 Weeks Notice',
  '3-4 Weeks Notice',
  'Part-time OK',
  'Full-time',
  'US Shift (EST)',
  'US Shift (PST)',
  'UK/Europe Shift',
  'Not Available'
];

export const SOFTWARE_OPTIONS = [
  'QuickBooks Online',
  'Xero',
  'NetSuite',
  'Oracle SAP',
  'Excel',
  'Tableau',
  'Power BI'
];

export const SKILLS_OPTIONS = [
  'Tax',
  'Audit',
  'FP&A',
  'Bookkeeping',
  'Payroll',
  'Advisory',
  'Financial Reporting',
  'Budgeting'
];

export const PROFESSIONAL_TITLE_OPTIONS = [
  'Certified Public Accountant',
  'Enrolled Agent (EA)',
  'US Tax Specialist',
  'UK Tax / VAT Specialist',
  'US GAAP Accountant',
  'Financial Controller',
  'Senior Tax Manager',
  'Audit Senior',
  'Bookkeeper',
  'Accounting Specialist',
  'QuickBooks ProAdvisor',
  'Xero Advisor',
  'NetSuite Consultant'
];

export const PROFESSIONAL_TITLE_CERTIFICATION_OPTIONS = {
  'Bookkeeper': [
    'Bookkeeping certificate',
    'Training record'
  ],
  'Accounting Specialist': [
    'Accounting diploma',
    'Role verification letter'
  ],
  'Certified Public Accountant': [
    'CPA License',
    'PRC License',
    'BOA Accreditation'
  ],
  'Fractional CFO': [
    'Finance leadership role verification'
  ],
  'Financial Controller': [
    'Controller role verification'
  ],
  'Senior Tax Manager': [
    'Tax practitioner accreditation'
  ],
  'Audit Senior': [
    'Audit Methodology Training',
    'Independence or ethics training record'
  ],
  'Full-charge Bookkeeper': [
    'Bookkeeping certificate',
    'Training record'
  ],
  'FP&A Director': [
    'FP&A or financial modeling certification'
  ],
  'QuickBooks ProAdvisor': [
    'QuickBooks ProAdvisor certificate'
  ],
  'Xero Advisor': [
    'Xero Advisor certificate'
  ],
  'NetSuite Consultant': [
    'NetSuite consultant certification'
  ],
  'Enrolled Agent (EA)': [
    'IRS Enrolled Agent Certificate',
    'IRS PTIN verification'
  ],
  'US Tax Specialist': [
    'US Tax preparer training certificate',
    'PTIN verification'
  ],
  'UK Tax / VAT Specialist': [
    'ATT or CTA certification',
    'HMRC Agent registration'
  ],
  'US GAAP Accountant': [
    'US GAAP continuing education certificate',
    'CPA license (US or foreign)'
  ],
};

export const REGULATED_TITLE_REQUIREMENTS = {
  'Certified Public Accountant': {
    requiresAudit: true,
    inputFields: [
      { id: 'prcLicenseNumber', label: 'PRC License Number', type: 'text', required: true, pattern: '^[0-9]{6,8}$', hint: 'Use 6 to 8 digits.' }
    ]
  },
  'Enrolled Agent (EA)': {
    requiresAudit: true,
    inputFields: [
      { id: 'irsPtin', label: 'IRS PTIN', type: 'text', required: true, pattern: '^P[0-9]{8}$', hint: 'Use P followed by 8 digits.' }
    ]
  },
  'US Tax Specialist': {
    requiresAudit: false,
    inputFields: [
      { id: 'irsPtin', label: 'IRS PTIN (Optional)', type: 'text', required: false, pattern: '^P[0-9]{8}$', hint: 'Use P followed by 8 digits.' }
    ]
  },
  'UK Tax / VAT Specialist': {
    requiresAudit: false,
    inputFields: [
      { id: 'hmrcAgentCode', label: 'HMRC Agent Code (Optional)', type: 'text', required: false, pattern: '^[A-Z0-9]{4,12}$', hint: 'Use 4 to 12 letters or numbers.' }
    ]
  }
};

export const EXTERNAL_LINK_OPTIONS = [
  { id: 'linkedin', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/in/your-profile' },
  { id: 'portfolio', label: 'Portfolio', placeholder: 'https://your-portfolio.com' },
  { id: 'website', label: 'Website', placeholder: 'https://your-site.com' },
  { id: 'github', label: 'GitHub', placeholder: 'https://github.com/your-profile' },
  { id: 'other', label: 'Other', placeholder: 'https://example.com' }
];

export const PROFESSIONAL_TITLE_OTHER_DOCUMENT_OPTIONS = {
  'Bookkeeper': [
    'Bank reconciliation sample',
    'Payroll processing sample',
    'Client bookkeeping reference'
  ],
  'Accounting Specialist': [
    'Month-end close or reconciliation sample',
    'ERP or accounting system work sample',
    'Accounts payable or receivable process sample'
  ],
  'Certified Public Accountant': [
    'Continuing professional education record',
    'Tax or audit work sample',
    'Client accounting reference'
  ],
  'Fractional CFO': [
    'Board or advisory reference',
    'Financial strategy case summary',
    'Forecasting or board reporting sample'
  ],
  'Financial Controller': [
    'Month-end close sample checklist',
    'ERP implementation or cleanup summary',
    'Finance team leadership reference'
  ],
  'Senior Tax Manager': [
    'Tax compliance work sample',
    'Continuing tax education record',
    'Tax planning memo sample'
  ],
  'Audit Senior': [
    'External audit engagement summary',
    'Audit workpaper sample',
    'Client or firm reference'
  ],
  'Full-charge Bookkeeper': [
    'Payroll or bank reconciliation sample',
    'Payroll processing sample',
    'Client bookkeeping reference'
  ],
  'FP&A Director': [
    'Forecasting or board reporting sample',
    'Analytics dashboard sample',
    'Budget planning case summary'
  ],
  'QuickBooks ProAdvisor': [
    'QuickBooks Online profile link',
    'Client setup or cleanup sample',
    'QuickBooks workflow sample'
  ],
  'Xero Advisor': [
    'Xero partner profile link',
    'Xero migration or setup sample',
    'Xero reconciliation sample'
  ],
  'NetSuite Consultant': [
    'ERP implementation project summary',
    'SuiteAnalytics or reporting sample',
    'NetSuite workflow sample'
  ],
  'Enrolled Agent (EA)': [
    'Tax resolution case summary',
    'Complex US tax return sample',
    'IRS correspondence sample'
  ],
  'US Tax Specialist': [
    'US 1040/1120 tax return sample',
    'US tax planning memo',
    'US state tax filing sample'
  ],
  'UK Tax / VAT Specialist': [
    'UK self-assessment return sample',
    'VAT return filing sample',
    'HMRC correspondence sample'
  ],
  'US GAAP Accountant': [
    'US GAAP financial statements sample',
    'ASC 606 or ASC 842 memo sample',
    'US entity month-end close checklist'
  ],
};
