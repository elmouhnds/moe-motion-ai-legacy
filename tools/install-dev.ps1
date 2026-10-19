# MOE Motion AI — developer install for After Effects 2025 on Windows 11.
# 1) Enables loading unsigned CEP 12 extensions (PlayerDebugMode) for the current user.
# 2) Links this repo's /extension folder into the per-user CEP extensions folder.
# Run from the repo root in PowerShell:  powershell -ExecutionPolicy Bypass -File tools\install-dev.ps1
# Remove with:                          powershell -ExecutionPolicy Bypass -File tools\install-dev.ps1 -Uninstall
param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'

$src    = Join-Path $PSScriptRoot '..\extension' | Resolve-Path
$cepDir = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
$target = Join-Path $cepDir 'moe-motion-ai'

if ($Uninstall) {
  if (Test-Path $target) { (Get-Item $target).Delete(); Write-Host "Removed $target" }
  Write-Host 'PlayerDebugMode left unchanged (other unsigned extensions may rely on it).'
  exit 0
}

New-Item -ItemType Directory -Force -Path 'HKCU:\Software\Adobe\CSXS.12' | Out-Null
Set-ItemProperty -Path 'HKCU:\Software\Adobe\CSXS.12' -Name 'PlayerDebugMode' -Value '1' -Type String
Write-Host 'PlayerDebugMode = 1 for CSXS.12'

New-Item -ItemType Directory -Force -Path $cepDir | Out-Null
if (Test-Path $target) { (Get-Item $target).Delete() }
New-Item -ItemType Junction -Path $target -Target $src | Out-Null
Write-Host "Linked $target -> $src"
Write-Host ''
Write-Host 'Restart After Effects, then open:  Window > Extensions > MOE Motion AI'
Write-Host 'Debug the panel in Chrome at http://localhost:8099 (see extension/.debug).'
