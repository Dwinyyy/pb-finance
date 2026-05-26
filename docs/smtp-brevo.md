# Supabase Auth SMTP With Brevo

## Decision

Use Brevo for Supabase Auth email delivery.

Why Brevo:

- Free transactional SMTP allowance is 300 emails per day.
- SMTP relay is included on the free plan.
- Supabase Auth supports any SMTP provider and lists Brevo as a compatible option.
- The setup does not require changing the app runtime or Vercel deployment.

Alternatives checked:

- Resend: cleaner developer UX, but free transactional quota is 100 emails per day.
- MailerSend: SMTP relay is included, but the free plan is 500 emails per month and 100 per day.

## Supabase Values

Use these settings in Supabase Dashboard -> Authentication -> SMTP Settings:

```text
Enable custom SMTP: On
Sender email: no-reply@your-domain.com
Sender name: PB Finance
SMTP host: smtp-relay.brevo.com
SMTP port: 587
SMTP username: your Brevo SMTP login
SMTP password: your Brevo SMTP key
```

Brevo says to use an SMTP key, not an API key.

## Brevo Setup

1. Create a Brevo account.
2. Add and authenticate your sending domain in Brevo.
3. Create a transactional sender, for example `no-reply@your-domain.com`.
4. Go to Brevo SMTP settings and copy:
   - SMTP login
   - SMTP key
5. Add those values in Supabase Authentication -> SMTP Settings.
6. Send a test signup from the production site.

## Optional Script

You can configure Supabase SMTP via the Management API using:

```powershell
$env:SUPABASE_ACCESS_TOKEN="your-supabase-management-token"
$env:SUPABASE_PROJECT_REF="your-project-ref"
$env:BREVO_SMTP_USER="your-brevo-smtp-login"
$env:BREVO_SMTP_PASS="your-brevo-smtp-key"
$env:SMTP_ADMIN_EMAIL="no-reply@your-domain.com"
$env:SMTP_SENDER_NAME="PB Finance"

.\scripts\configure-supabase-brevo-smtp.ps1
```

Create the Supabase Management API token from Supabase Dashboard -> Account -> Access Tokens.

## After Setup

Keep Supabase email confirmation enabled for real users. If you need faster local testing, disable confirmation temporarily in Supabase Dashboard -> Authentication -> Providers -> Email.

Check these after setup:

- Supabase Dashboard -> Authentication -> URL Configuration -> Site URL is `https://pb-finance.vercel.app`.
- Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs includes `https://pb-finance.vercel.app/**`.
- Supabase Dashboard -> Authentication -> Rate Limits is high enough for your expected onboarding burst.
- Brevo transactional logs show confirmation emails being accepted.
