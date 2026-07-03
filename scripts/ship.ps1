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

Write-Host "== Files to be committed =="
git status --short
Write-Host ""
$answer = Read-Host "Stage ALL of the above and push? (y/N)"
if ($answer -notmatch '^[Yy]$') {
  Write-Host "Aborted. Nothing staged."
  exit 1
}

Write-Host "== git add . =="
git add .

Write-Host "== git commit =="
git commit -m $commitMessage

Write-Host "== git push =="
git push

Write-Host "Done."
