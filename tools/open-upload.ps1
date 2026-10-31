$ErrorActionPreference = 'Stop'
$u = Join-Path $PSScriptRoot '..\.tmp\github-upload.url'
$u = [System.IO.Path]::GetFullPath($u)
$lines = @('[InternetShortcut]', 'URL=https://github.com/oonb-xu/xuanji-minglironghe/upload')
Set-Content -Path $u -Value $lines -Encoding ASCII
Write-Output ("created: " + $u)
Invoke-Item $u
Start-Sleep -Seconds 2
Write-Output "invoked"
