[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$DeepLink,
  [string]$ExecutablePath
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
$normalizedDeepLink =
  if ($DeepLink.StartsWith("apex://") -or $DeepLink.StartsWith("#kind=")) {
    $DeepLink
  } elseif ($DeepLink.StartsWith("kind=")) {
    "#$DeepLink"
  } else {
    throw "DeepLink must start with apex://, #kind=, or kind=."
  }

Start-Process -FilePath $resolvedExecutable -ArgumentList @($normalizedDeepLink) | Out-Null

[pscustomobject]@{
  executable = $resolvedExecutable
  deep_link = $normalizedDeepLink
}
