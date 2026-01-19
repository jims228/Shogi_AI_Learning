param(
  [int[]]$Ports = @(3000, 8787, 8081),
  [string]$WslDistro = "Ubuntu-22.04"
)

$ErrorActionPreference = "Stop"

function Assert-Admin {
  $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Please run PowerShell as Administrator." -ForegroundColor Red
    exit 1
  }
}

function Assert-Adb {
  $adb = (Get-Command adb -ErrorAction SilentlyContinue)
  if (-not $adb) {
    Write-Host "adb not found. Install Android Platform Tools and add it to PATH." -ForegroundColor Red
    exit 1
  }
}

function Get-WslIpv4 {
  $raw = (wsl -d $WslDistro -- hostname -I) 2>$null
  if (-not $raw) {
    Write-Host "Failed to get WSL IP. Is distro '$WslDistro' installed?" -ForegroundColor Red
    exit 1
  }
  $match = [regex]::Match($raw, "(?<ip>\d{1,3}(\.\d{1,3}){3})")
  if (-not $match.Success) {
    Write-Host "Could not parse IPv4 from: $raw" -ForegroundColor Red
    exit 1
  }
  return $match.Groups["ip"].Value
}

Assert-Admin
Assert-Adb

$wslIp = Get-WslIpv4
Write-Host "WSL IPv4: $wslIp" -ForegroundColor Cyan

foreach ($port in $Ports) {
  Write-Host "Configuring portproxy for $port..." -ForegroundColor Cyan
  & netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null | Out-Null
  & netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wslIp | Out-Null

  $ruleName = "Shogi AI WSL2 Portproxy $port"
  $rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if (-not $rule) {
    Write-Host "Creating firewall rule for port $port..." -ForegroundColor Yellow
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port | Out-Null
  }
}

Write-Host "Setting adb reverse rules..." -ForegroundColor Cyan
foreach ($port in $Ports) {
  adb reverse tcp:$port tcp:$port | Out-Null
}

Write-Host "adb reverse list:" -ForegroundColor Green
adb reverse --list
