# PB Finance Startup Expense Projection

Last updated: 2026-05-27

This projection is budget-first. The goal is to launch with the tools already in the codebase, avoid paid upgrades until they protect production users or unlock clear value, and keep optional growth tools separate from launch essentials.

## Assumptions

- Currency is USD. PHP estimates use `1 USD ~= PHP 61.50` for quick planning only; recheck exchange rates before paying vendors.
- Prices are before tax, card fees, usage overages, and promo discounts.
- Initial team assumption: 1 founder/admin and 1 developer. Per-seat tools scale with headcount.
- The app is currently a React/Vite frontend with Vercel serverless API routes, Supabase Auth/database, Brevo email support, Sentry error monitoring code, in-app notifications, client billing placeholders, and a local matchmaker.
- Some tools in `package.json` are open-source libraries, not subscriptions.
- Payment handling is still a future feature. Plan for either direct Stripe payments, true escrow through a licensed escrow provider, or both. Do not store full card or bank details in PB Finance.
- Stripe availability depends on the country of the legal business entity, not just where customers are located. Confirm the company registration country before committing to Stripe as the only payment path.

## Current Tools In The Project

| Tool / area | How PB Finance uses it now | Free/budget starting point | When to upgrade | Paid projection |
| --- | --- | ---: | --- | ---: |
| React, React DOM, React Router | Core frontend app and routing | $0 | No paid upgrade needed | $0 |
| Vite | Local dev/build tooling | $0 | No paid upgrade needed | $0 |
| Tailwind CSS, PostCSS, Autoprefixer | Styling/build pipeline | $0 | No paid upgrade needed | $0 |
| ESLint and React lint plugins | Code quality checks | $0 | No paid upgrade needed | $0 |
| Framer Motion | UI animation | $0 | No paid upgrade needed for current use | $0 |
| Lucide React | Icons | $0 | No paid upgrade needed | $0 |
| Vercel | Hosts frontend and `/api` serverless router | Hobby is free for personal/non-commercial use | Use Pro for a commercial/public startup site, team collaboration, higher limits, better production controls | $20/user/month |
| Supabase | Auth, user profiles, app database, notifications, realtime client | Free plan for build/test and very early beta | Move to Pro before depending on real customer data, heavier auth/database usage, backups, or larger storage/egress | from $25/month baseline |
| Brevo | Supabase SMTP and runtime notification emails | Free plan supports 300 emails/day | Upgrade if email volume exceeds free daily allowance, or if deliverability/reporting needs improve | Starter from about $9/month; Standard from about $18/month |
| Sentry | ErrorBoundary plus optional browser tracing/replay through `VITE_SENTRY_DSN` | Developer/free tier while traffic is low | Upgrade when multiple teammates need monitoring, higher event volume, alert routing, or richer issue management | Team from about $26/month |
| Domain registration | Public website address, branded email domain | Buy only one primary domain at launch | Add defensive domains later only if brand protection matters | Typical `.com`: about $10-$19/year depending registrar and renewal |
| DNS and SSL | Vercel/Cloudflare DNS, HTTPS certificates | Free through Vercel or Cloudflare | Paid DNS/security only when advanced traffic/security controls are needed | $0 initially |
| Git/source control | Local git repo now; likely GitHub/GitLab later | GitHub Free is enough for small private repos | Upgrade for required reviewers, advanced branch controls, team permissions | GitHub Team $4/user/month |

## Recommended Launch Stack

This is the practical setup for a real public launch while still being careful with cash.

| Category | Recommended tool | Monthly cost | Annualized cost | Why it is included |
| --- | --- | ---: | ---: | --- |
| Domain | `.com` via Cloudflare Registrar or Namecheap | about $1/month amortized | about $10-$19/year | Needed for credibility, branded email, production URLs |
| Hosting/API | Vercel Pro | $20 | $240 | Commercial production hosting for the current architecture |
| Database/Auth | Supabase Pro | $25 | $300 | Protects real user data better than staying on free tier |
| Email | Brevo Free first, Starter when needed | $0-$9 | $0-$108 | Confirmation, password, and workflow emails |
| Error monitoring | Sentry Free first | $0 | $0 | Already wired in; set `VITE_SENTRY_DSN` when ready |
| Business email | Google Workspace Business Starter, 1 seat | $7 | $84 | Professional address such as `hello@yourdomain.com` |
| Analytics | Google Analytics or Vercel basic analytics | $0 | $0 | Start free; do not pay before traffic exists |
| Uptime monitoring | UptimeRobot Free | $0 | $0 | Basic external uptime checks |
| Payments | Stripe and/or escrow provider | $0 monthly | $0 monthly | Add only when charging; per-transaction fees apply and should be modeled into client pricing |

Estimated launch monthly total:

| Version | Monthly estimate | PHP estimate |
| --- | ---: | ---: |
| Tight public launch, keeping Supabase and Brevo free briefly | about $28 | about PHP 1,720 |
| Safer public launch with Supabase Pro, Brevo free | about $53 | about PHP 3,260 |
| Safer public launch with Supabase Pro and Brevo Starter | about $62 | about PHP 3,810 |

Recommended path: budget for the $53-$62/month version before collecting real user data. The $28/month version is acceptable only for a short closed beta where downtime, missing backups, and low limits are tolerable.

## Growth Stack Add-Ons

Add these only when the trigger is real. This keeps the first version lean.

| Future need | Tool option | Start free? | Upgrade trigger | Paid projection |
| --- | --- | ---: | --- | ---: |
| Source control team controls | GitHub Team | Yes | More than one developer, code reviews, protected branches | $4/user/month |
| Private uptime checks and faster monitoring | UptimeRobot Solo | Yes | Real customers rely on login, dashboard, or API uptime | about $8-$10/month |
| Privacy-friendly analytics | Plausible | No long-term free production plan | You want simple analytics without Google Analytics overhead/cookies | from $9/month |
| Customer scheduling | Calendly Standard | Yes | Sales calls, interview scheduling, reminder workflows | about $10/user/month billed annually, or $12 monthly |
| Internal docs/wiki | Notion Plus | Yes | Shared operating docs, hiring pipeline notes, sales docs | about $10/user/month billed annually |
| Team chat | Slack Pro | Yes | More than 2-3 active team members, searchable history, external partners | about $7.25/user/month billed annually, or $8.75 monthly |
| Customer support inbox/chat | Crisp | Yes | Support conversations exceed normal email, need shared inbox/chat automation | paid workspace plans from about $45/month |
| Accounting and invoicing | Zoho Books Standard or similar | Yes/limited | Recurring invoices, expense tracking, tax prep, reconciliation | about $15-$20/org/month |
| E-signatures/contracts | DocuSign, Dropbox Sign, Zoho Sign, or similar | Usually limited | Client contracts and professional agreements become regular workflow | budget $10-$30/user/month |
| Bot/spam protection | Cloudflare Turnstile | Yes | Public forms attract spam or abuse | $0 for most startup use |
| Direct payment processing | Stripe Payments | No monthly fee | Client billing goes live without escrow | 2.9% + $0.30 per successful domestic card transaction; international and currency conversion fees can add more |
| Marketplace payouts | Stripe Connect | No monthly fee if Stripe handles connected-account pricing | PB Finance collects from clients and pays professionals/agencies through the platform | If PB Finance handles pricing: $2 per monthly active connected account plus 0.25% + $0.25 per payout, on top of payment processing |
| True escrow | Escrow.com or licensed escrow provider | No subscription, but transaction fees apply | Funds need to be held until service milestones, contract acceptance, or dispute windows are complete | Escrow.com standard USD fee starts at 2.6% with a $50 minimum for $0-$5,000 transactions; lower percentage tiers apply at larger amounts |
| AI-assisted matching | OpenAI, Anthropic, or similar API | No | Local keyword matching is not enough and user data justifies better matching | budget $10-$100/month first, then usage-based |
| File storage for resumes/contracts | Supabase Storage first | Included in Supabase plan | Larger uploads, long retention, heavy downloads | Supabase usage overages or object storage provider later |
| Backups/export discipline | Supabase Pro plus manual exports | Included/mostly free | Production data is business-critical | Start with Supabase Pro; add dedicated backup tooling only later |

## Suggested Monthly Budgets By Stage

| Stage | What is included | Monthly estimate | PHP estimate |
| --- | --- | ---: | ---: |
| Development/private testing | Free stack, optional branded email, domain amortized | $1-$8 | PHP 60-PHP 490 |
| Closed beta | Domain, business email, Vercel Pro if public/commercial, free Supabase/Brevo briefly | $28-$37 | PHP 1,720-PHP 2,280 |
| Public MVP, recommended | Vercel Pro, Supabase Pro, domain, Google Workspace, Brevo free/Starter | $53-$62 | PHP 3,260-PHP 3,810 |
| Early growth | Public MVP plus Sentry Team, uptime paid, GitHub Team for 2 users, basic accounting, Calendly | $120-$150 | PHP 7,380-PHP 9,225 |
| Scaling | More seats, support chat, paid analytics, higher email volume, extra Supabase/Vercel usage, accounting/support tooling | $350-$750+ | PHP 21,525-PHP 46,125+ |

These estimates exclude salaries, contractors, paid ads, legal retainers, taxes, and payment processing fees.

## Payment Flow Planning

PB Finance should treat Stripe and escrow as two different models, not interchangeable labels.

| Option | Best for | Budget impact | Startup recommendation |
| --- | --- | ---: | --- |
| Stripe Payments only | Simple card payments, invoices, deposits, subscriptions, or retainers where PB Finance is the merchant | No monthly fee; card fees reduce margin on every payment | Use first if the business model is direct billing and manual payout/off-platform fulfillment is acceptable |
| Stripe Connect | Marketplace-style flow where clients pay through PB Finance and professionals/agencies receive payouts | Standard card fees plus possible Connect fees depending on account/pricing setup | Use when platform payouts, commissions, payout timing, and connected-account onboarding matter |
| Escrow.com or licensed escrow provider | Higher-trust transactions where funds should be held until milestones or acceptance | Percentage escrow fees can be materially higher than card fees, but may reduce trust friction | Use for larger engagements or first client deals where trust is more important than minimizing fee percentage |
| Hybrid | Stripe for normal invoices; escrow for high-value or milestone-based contracts | Operationally more complex, but budget-friendly because escrow is used selectively | Recommended long-term direction: keep everyday payments simple and reserve escrow for larger or riskier engagements |

Planning note: Stripe can hold balances, delay captures, route funds, and manage payouts, but that does not automatically make PB Finance a licensed escrow service. Before advertising "escrow" inside the product, get legal/payment-provider review and use a provider that supports the exact escrow workflow.

Availability note: if PB Finance is registered in a country Stripe does not directly support, budget extra time and possible setup cost for a supported entity, Stripe Atlas-style setup, or a local payment gateway alternative.

## First-Year Planning Range

| Scenario | Annual subscription estimate | Notes |
| --- | ---: | --- |
| Lean public MVP | about $635-$745/year | Vercel Pro, Supabase Pro, 1 Google Workspace seat, domain, Brevo free/Starter |
| Early growth | about $1,500-$1,900/year | Adds Sentry Team, paid uptime, GitHub Team for 2 users, accounting, Calendly, optional analytics |
| More mature startup stack | about $4,200-$9,000+/year | Adds more seats, customer support tooling, higher vendor usage, more monitoring/analytics, possible AI usage |

## One-Time Or Irregular Costs To Remember

| Item | Budget range | When it matters |
| --- | ---: | --- |
| Domain purchase | $10-$19/year for common `.com` domains | Before launch |
| Brand/social handles | $0 upfront | Reserve early to avoid brand confusion |
| Logo/brand assets | $0-$300 | Use current assets first; pay only if brand polish blocks launch |
| Privacy policy, Terms, cookie notice | $0-$300 DIY/template, or $500-$2,000+ legal review | Before collecting real user data |
| Company registration, bookkeeping setup | Varies heavily by jurisdiction | Before signing paid clients or contractors |
| Security review | $0 internal checklist first, then paid review later | Before handling sensitive financial or employment data at scale |
| Paid ads/marketing experiments | $100-$1,000+/month | Only after conversion tracking is in place |
| Contractor help | Project-based | Use for specific launch blockers, not permanent overhead |

## Upgrade Priority

1. Buy the domain and set up branded email.
2. Keep all open-source frontend/build tools free.
3. Use Vercel Pro once the site is public and commercial.
4. Move Supabase to Pro before relying on real customer data.
5. Keep Brevo free until email volume or deliverability needs force a paid plan.
6. Set up Sentry free at launch; upgrade only when monitoring becomes team-critical.
7. Add Stripe or escrow only when billing is actually ready; choose the payment flow before building the UI.
8. Use free analytics and uptime monitoring first.
9. Delay paid Slack, Notion, support chat, AI matching, and accounting until the workflow is active enough to justify them.

## Source Links

- Vercel pricing: https://vercel.com/pricing
- Supabase pricing: https://supabase.com/pricing
- Brevo pricing/help: https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans
- Sentry pricing: https://sentry.io/pricing/
- Cloudflare Registrar: https://developers.cloudflare.com/registrar/
- Namecheap domain pricing: https://www.namecheap.com/domains/
- Stripe pricing: https://stripe.com/us/pricing
- Stripe global availability: https://stripe.com/global
- Stripe Connect pricing: https://stripe.com/us/connect/pricing
- Escrow.com fee calculator: https://www.escrow.com/fee-calculator/
- Escrow.com fee FAQ: https://www.escrow.com/support/faqs/how-much-does-it-cost-to-use-escrowcom-services
- GitHub pricing: https://github.com/pricing
- Google Workspace pricing: https://workspace.google.com/business/
- UptimeRobot pricing: https://uptimerobot.com/pricing/
- Plausible pricing: https://plausible.io/
- Calendly pricing: https://calendly.com/pricing
- Notion pricing: https://www.notion.com/pricing
- Slack pricing: https://slack.com/pricing
- Crisp pricing: https://crisp.chat/en/pricing/
- Zoho Books pricing: https://www.zoho.com/books/pricing/
- Cloudflare Turnstile: https://www.cloudflare.com/products/turnstile/
- USD/PHP reference: https://www.investing.com/currencies/usd-php-historical-data
