[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$ExecutablePath,
  [string]$ProtocolName = "apex"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-DesktopExecutablePath {
  param([string]$ConfiguredPath)

  $candidates = @()
  if ($ConfiguredPath) {
    $candidates += $ConfiguredPath
  }
  if ($env:APEX_DESKTOP_EXE) {
    $candidates += $env:APEX_DESKTOP_EXE
  }
  $candidates += "D:\apex-localdev\cargo-target\debug\apex-desktop-shell.exe"

  foreach ($candidate in $candidates) {
    if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw "Unable to locate apex-desktop-shell.exe. Pass -ExecutablePath or set APEX_DESKTOP_EXE."
}

$resolvedExecutable = Resolve-DesktopExecutablePath -ConfiguredPath $ExecutablePath
$rootKey = "HKCU:\Software\Classes\$ProtocolName"
$commandKey = Join-Path $rootKey "shell\open\command"
$iconKey = Join-Path $rootKey "DefaultIcon"
$commandValue = "`"$resolvedExecutable`" `"%1`""

if ($PSCmdlet.ShouldProcess($rootKey, "Register $ProtocolName URL protocol")) {
  New-Item -Path $rootKey -Force | Out-Null
  New-ItemProperty -Path $rootKey -Name "(default)" -Value "URL:$ProtocolName Protocol" -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $rootKey -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null

  New-Item -Path $commandKey -Force | Out-Null
  New-ItemProperty -Path $commandKey -Name "(default)" -Value $commandValue -PropertyType String -Force | Out-Null

  New-Item -Path $iconKey -Force | Out-Null
  New-ItemProperty -Path $iconKey -Name "(default)" -Value "`"$resolvedExecutable`",0" -PropertyType String -Force | Out-Null
}

[pscustomobject]@{
  protocol = $ProtocolName
  executable = $resolvedExecutable
  root_key = $rootKey
  command = $commandValue
}
