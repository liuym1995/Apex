[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$ProtocolName = "apex"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$rootKey = "HKCU:\Software\Classes\$ProtocolName"
$exists = Test-Path -LiteralPath $rootKey

if ($exists -and $PSCmdlet.ShouldProcess($rootKey, "Remove $ProtocolName URL protocol registration")) {
  Remove-Item -LiteralPath $rootKey -Recurse -Force
}

[pscustomobject]@{
  protocol = $ProtocolName
  removed = $exists
  root_key = $rootKey
}
