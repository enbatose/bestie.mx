# Run once after clone: git init + first commit (adjust remote URL for GitHub).
$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
if (-not (Test-Path .git)) {
    git init
    git branch -M main
}
git add -A
git status
if ((git status --porcelain) -ne '') {
    git commit -m "Initial Bestie web scaffold (Vite + React + Tailwind)"
}
Write-Host "Done. Add GitHub remote: git remote add origin https://github.com/YOU/bestie.mx.git" -ForegroundColor Green
Write-Host "Then: git push -u origin main" -ForegroundColor Green
