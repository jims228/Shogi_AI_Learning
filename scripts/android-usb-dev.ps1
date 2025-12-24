param(
  [int]$WebPort = 3000,
  [int]$MetroPort = 8081
)

$ErrorActionPreference = "Stop"

function Assert-Adb {
  $adb = (Get-Command adb -ErrorAction SilentlyContinue)
  if (-not $adb) {
    Write-Host "adb not found. Install Android Platform Tools and add it to PATH." -ForegroundColor Red
    Write-Host "Then re-open PowerShell and retry." -ForegroundColor Yellow
    exit 1
  }
}

Assert-Adb

Write-Host "Restarting adb server..." -ForegroundColor Cyan
adb kill-server | Out-Null
adb start-server | Out-Null

Write-Host "Devices:" -ForegroundColor Cyan
adb devices -l

Write-Host "Clearing existing reverse rules..." -ForegroundColor Cyan
adb reverse --remove-all | Out-Null

Write-Host "Adding reverse rules..." -ForegroundColor Cyan
adb reverse tcp:$WebPort tcp:$WebPort
adb reverse tcp:$MetroPort tcp:$MetroPort

Write-Host "Reverse rules:" -ForegroundColor Cyan
adb reverse --list

Write-Host ""
Write-Host "Next steps (WSL):" -ForegroundColor Green
Write-Host "  pnpm --filter web dev"
Write-Host "  pnpm -C apps/mobile start -- --localhost --port $MetroPort"
Write-Host ""
Write-Host "On device:" -ForegroundColor Green
Write-Host "  - Open http://127.0.0.1:$WebPort in Chrome"
Write-Host "  - In the mobile app Settings set WEB_BASE_URL = http://127.0.0.1:$WebPort"


