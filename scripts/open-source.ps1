param([Parameter(Mandatory=$true)][string]$SourceFile)
$ErrorActionPreference='Stop'
if (!(Test-Path -LiteralPath $SourceFile -PathType Leaf)) { throw 'Source is unavailable' }
Invoke-Item -LiteralPath $SourceFile
