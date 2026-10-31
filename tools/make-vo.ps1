# Generate per-scene narration WAV via Windows SAPI (zh-CN voice).
# ASCII-only file on purpose: Windows PowerShell 5.1 reads .ps1 as GBK and mangles UTF-8 Chinese.
# All Chinese text lives in tools/vo-lines.json (UTF-8).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$jsonPath = Join-Path $PSScriptRoot 'vo-lines.json'
$lines = Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
$outDir = Join-Path $root '.tmp\vo'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

$voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq 'zh-CN' } | Select-Object -First 1
if ($voice) {
    $synth.SelectVoice($voice.VoiceInfo.Name)
    Write-Host ("voice: " + $voice.VoiceInfo.Name)
} else {
    Write-Warning 'no zh-CN voice found, using default'
}
$synth.Rate = 0
$synth.Volume = 100

$n = 0
foreach ($l in $lines) {
    $idx = [int]$l.n
    $path = Join-Path $outDir ("vo-{0:d2}.wav" -f $idx)
    $synth.SetOutputToWaveFile($path)
    $synth.Speak([string]$l.text)
    $synth.SetOutputToNull()
    $len = (Get-Item $path).Length
    Write-Host ("  vo-{0:d2}.wav  {1,9:N0} B" -f $idx, $len)
    $n++
}
$synth.Dispose()
Write-Host ("done: " + $n + " files -> " + $outDir)
