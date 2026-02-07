param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$CommitWords
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "git not found. Please install Git first."
}

$statusShort = git status --short
if (-not $statusShort) {
  Write-Host "No changes to commit."
  exit 0
}

$commitMessage = ($CommitWords -join " ").Trim()
if ([string]::IsNullOrWhiteSpace($commitMessage)) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $commitMessage = "chore: update project ($timestamp)"
}

Write-Host "== Git status =="
git status

Write-Host "== git add . =="
git add .

Write-Host "== git commit =="
git commit -m $commitMessage

Write-Host "== git push =="
git push

Write-Host "Done."
