# Desktop shortcut -> signed node.exe directly (bypasses Smart App Control blocking .cmd).
# No Chinese literals (PS 5.1 reads .ps1 as ANSI). Localized text comes from UTF-8 JSON.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$metaPath = Join-Path $PSScriptRoot 'shortcut-meta.json'

$raw = [System.IO.File]::ReadAllText($metaPath, [System.Text.Encoding]::UTF8)
$raw = $raw.TrimStart([char]0xFEFF)
$meta = $raw | ConvertFrom-Json

$desktop   = [Environment]::GetFolderPath('Desktop')
$lnkPath   = Join-Path $desktop ($meta.name + '.lnk')
$scriptPath= Join-Path $root $meta.script
$icoPath   = Join-Path $root $meta.icon

# resolve node.exe robustly
$nodeExe = $null
$cand = @(
  'C:\Program Files\nodejs\node.exe',
  'C:\Program Files (x86)\nodejs\node.exe'
)
foreach ($c in $cand) { if (Test-Path -LiteralPath $c) { $nodeExe = $c; break } }
if (-not $nodeExe) {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source -and (Test-Path -LiteralPath $cmd.Source)) { $nodeExe = $cmd.Source }
}
if (-not $nodeExe) { throw 'node.exe not found' }

if (Test-Path -LiteralPath $lnkPath) { Remove-Item -LiteralPath $lnkPath -Force }

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnkPath)
$sc.TargetPath       = $nodeExe                                    # signed binary
$sc.Arguments        = '"' + $scriptPath + '" ' + $meta.args
$sc.WorkingDirectory = $root
$sc.WindowStyle      = 7
$sc.Description      = $meta.description
if (Test-Path -LiteralPath $icoPath) { $sc.IconLocation = "$icoPath,0" }
$sc.Save()

# verify by re-reading
$chk = $ws.CreateShortcut($lnkPath)
$sig = (Get-AuthenticodeSignature $nodeExe).Status.ToString()
$res = [ordered]@{
  ok            = (Test-Path -LiteralPath $lnkPath)
  shortcut      = $lnkPath
  target        = $chk.TargetPath
  arguments     = $chk.Arguments
  workdir       = $chk.WorkingDirectory
  icon          = $chk.IconLocation
  node_exe      = $nodeExe
  node_signed   = $sig
  target_is_node= ($chk.TargetPath -eq $nodeExe)
  script_exists = (Test-Path -LiteralPath $scriptPath)
}
($res | ConvertTo-Json -Compress) | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'shortcut-result.json') -Encoding UTF8
Write-Output 'done'
