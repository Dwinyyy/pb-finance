$ErrorActionPreference = "Stop"

$requiredVariables = @(
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_REF",
  "BREVO_SMTP_USER",
  "BREVO_SMTP_PASS",
  "SMTP_ADMIN_EMAIL"
)

$missingVariables = $requiredVariables | Where-Object {
  [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_))
}

if ($missingVariables.Count -gt 0) {
  throw "Missing required environment variables: $($missingVariables -join ', ')"
}

$senderName = if ($env:SMTP_SENDER_NAME) { $env:SMTP_SENDER_NAME } else { "PB Finance" }
$smtpPort = if ($env:BREVO_SMTP_PORT) { [int]$env:BREVO_SMTP_PORT } else { 587 }

$payload = @{
  external_email_enabled = $true
  mailer_autoconfirm = $false
  mailer_secure_email_change_enabled = $true
  smtp_admin_email = $env:SMTP_ADMIN_EMAIL
  smtp_host = "smtp-relay.brevo.com"
  smtp_pass = $env:BREVO_SMTP_PASS
  smtp_port = $smtpPort
  smtp_sender_name = $senderName
  smtp_user = $env:BREVO_SMTP_USER
} | ConvertTo-Json

$headers = @{
  Authorization = "Bearer $($env:SUPABASE_ACCESS_TOKEN)"
  "Content-Type" = "application/json"
}

$url = "https://api.supabase.com/v1/projects/$($env:SUPABASE_PROJECT_REF)/config/auth"

Invoke-RestMethod -Method Patch -Uri $url -Headers $headers -Body $payload | Out-Null

Write-Host "Configured Supabase Auth SMTP for Brevo on project $($env:SUPABASE_PROJECT_REF)."
