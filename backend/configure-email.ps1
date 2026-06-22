$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $projectRoot ".env"

$apiKey = Read-Host "Paste your Resend API key"
$authEmail = Read-Host "Email to receive OxyGuard login codes" 
$sender = Read-Host "Sender email (press Enter for OxyGuard <onboarding@resend.dev>)"

if ([string]::IsNullOrWhiteSpace($authEmail)) {
  $authEmail = "robertmarson88@gmail.com"
}

if ([string]::IsNullOrWhiteSpace($sender)) {
  $sender = "OxyGuard <onboarding@resend.dev>"
}

@(
  "RESEND_API_KEY=$apiKey",
  "OXYGUARD_AUTH_EMAIL=$authEmail",
  "OXYGUARD_EMAIL_FROM=$sender"
) | Set-Content -LiteralPath $envPath

Write-Host "Email settings saved to $envPath"
Write-Host "Restart OxyGuard for the settings to take effect."
