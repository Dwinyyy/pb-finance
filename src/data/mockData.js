import { User, Layers3, BarChart3, BadgeCheck } from 'lucide-react';

export const REVIEWS = [
  { id: 1, title: "Exceptional Service", body: "Found an amazing CPA who completely streamlined our US tax prep. Highly recommended!", name: "Sarah J., Tech Startup", date: "Oct 2025", rating: 5 },
  { id: 2, title: "Game Changer", body: "Our remote bookkeeping team from Manila is faster and more accurate than our previous local hires.", name: "David M., Retail Agency", date: "Sep 2025", rating: 5 },
  { id: 3, title: "Reliable & Professional", body: "What stood out was structure: documentation, handoffs, overlap hours, and communication were all better than previous vendors.", name: "Elena R., E-commerce", date: "Aug 2025", rating: 5 },
  { id: 4, title: "Cost-Effective Scaling", body: "We cut month-end close from 12 days to 6 and finally got consistent reporting. Their outsourced accountants felt like our own team.", name: "Mark T., SaaS Founder", date: "Aug 2025", rating: 5 },
];

export const TALENT_PROFILES = [
  { id: 1, name: "Natasha Romanoff, CPA", role: "Senior Tax Accountant", exp: "8 Years", tools: ["QuickBooks", "Xero", "TurboTax"], rate: "$15/hr", rating: 4.9, available: "Immediate", match: 98 },
  { id: 2, name: "Steve Rogers", role: "Full-Charge Bookkeeper", exp: "5 Years", tools: ["Xero", "Wave", "Excel"], rate: "$10/hr", rating: 4.8, available: "In 2 weeks", match: 94 },
  { id: 3, name: "Bruce Banner, CPA", role: "Financial Analyst", exp: "6 Years", tools: ["Excel", "PowerBI", "SAP"], rate: "$18/hr", rating: 5.0, available: "Immediate", match: 99 },
  { id: 4, name: "Peter Parker", role: "Payroll Specialist", exp: "4 Years", tools: ["Gusto", "QuickBooks", "ADP"], rate: "$9/hr", rating: 4.7, available: "Flexible", match: 88 },
  { id: 5, name: "Wanda Maximoff", role: "Accounts Payable Clerk", exp: "3 Years", tools: ["NetSuite", "Bill.com"], rate: "$8/hr", rating: 4.6, available: "Immediate", match: 91 },
  { id: 6, name: "Tony Stark, CPA", role: "Virtual CFO", exp: "12 Years", tools: ["Xero", "Fathom", "Advanced Modeling"], rate: "$35/hr", rating: 5.0, available: "In 1 week", match: 97 },
  { id: 7, name: "Stephen Strange, CPA", role: "Forensic Accountant", exp: "15 Years", tools: ["CaseWare", "Relativity", "Excel"], rate: "$45/hr", rating: 5.0, available: "In 1 month", match: 92 },
  { id: 8, name: "T'Challa", role: "Global Controller", exp: "10 Years", tools: ["Oracle SAP", "NetSuite", "BlackLine"], rate: "$50/hr", rating: 4.9, available: "In 2 weeks", match: 96 },
  { id: 9, name: "Carol Danvers, CPA", role: "Audit Manager", exp: "9 Years", tools: ["AuditBoard", "Workiva", "QuickBooks"], rate: "$30/hr", rating: 4.8, available: "Immediate", match: 91 },
  { id: 10, name: "Scott Lang", role: "Accounts Receivable", exp: "2 Years", tools: ["QuickBooks", "Stripe", "Excel"], rate: "$7/hr", rating: 4.5, available: "Immediate", match: 85 },
  { id: 11, name: "Clint Barton", role: "Tax Preparer", exp: "6 Years", tools: ["ProConnect", "Lacerte", "Drake"], rate: "$12/hr", rating: 4.7, available: "Flexible", match: 89 },
  { id: 12, name: "Sam Wilson", role: "FP&A Manager", exp: "7 Years", tools: ["Adaptive Insights", "Tableau", "Excel"], rate: "$25/hr", rating: 4.8, available: "In 1 week", match: 95 },
];

export const AGENCIES = [
  { id: 101, name: "Precision Financials BPO", specialty: "Tax & Advisory Pods", size: "50-200 Staff", location: "Manila (BGC Hub)", rate: "Starts at $1,500/mo", rating: 4.9, certs: ["US GAAP", "SOC 2 Type II"] },
  { id: 102, name: "Quantum Accounting Group", specialty: "Full-Cycle Bookkeeping", size: "10-50 Staff", location: "Cebu City", rate: "Starts at $800/mo", rating: 4.8, certs: ["QuickBooks Certified", "Xero Gold"] },
  { id: 103, name: "Nexus Enterprise Solutions", specialty: "FP&A & Audit Support", size: "200+ Staff", location: "Makati CBD", rate: "Starts at $3,500/mo", rating: 5.0, certs: ["IFRS Compliant", "Big 4 Alumni"] },
];

export const SERVICE_CARDS = [
  { title: "Dedicated Finance Talent", icon: User, desc: "Hire embedded accountants, CPAs, and finance analysts who operate like an extension of your internal team." },
  { title: "Managed Accounting Pods", icon: Layers3, desc: "Deploy role-based teams for month-end close, tax season, cleanup projects, or recurring finance operations." },
  { title: "Process Improvement", icon: BarChart3, desc: "Standardize workflows, improve close speed, reduce errors, and create reporting that leaders actually use." },
  { title: "Compliance-Ready Execution", icon: BadgeCheck, desc: "Get documentation-first support with quality controls, secure file handling, and review-ready outputs." },
];

export const PROCESS_STEPS = [
  { title: "Scope & workflow audit", text: "We map deliverables, systems, quality standards, and overlap requirements before any placement happens." },
  { title: "Curated shortlist", text: "You review pre-vetted finance professionals matched by function, tools, seniority, and communication style." },
  { title: "Pilot & onboarding", text: "We launch with SOPs, access checklists, training windows, and success metrics tailored to your team." },
  { title: "QA & scale-up", text: "Performance reviews, backup coverage, and process optimization keep quality high as your needs grow." },
];

export const FAQ_DATA = [
  { q: "What makes this different from generic staffing?", a: "This model is specialized for accounting and finance. Matching is based on workflows, tools, controls, industry context, and communication quality—not just availability." },
  { q: "Can international talent work in our timezone?", a: "Yes. We prioritize overlap hours and can structure shifts for US, UK, Australia, or hybrid global teams depending on the role and urgency." },
  { q: "How do you protect financial data?", a: "We design onboarding around least-privilege access, documentation standards, secure file handling, and clear approval workflows. Sensitive access can also be segmented by function." },
  { q: "Can we start with one person and scale later?", a: "Absolutely. Many clients start with one accountant or CPA, validate the workflow, then add roles for AP/AR, reporting, tax, or audit support." },
];
