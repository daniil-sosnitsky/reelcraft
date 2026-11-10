<#
  rec-voice.ps1 — запись голоса под ролик одной командой: микрофон → wav →
  черновая расшифровка локальным whisper → готовый вход для конвейера.

  Зачем скрипт (16.10.2026). Раньше путь был такой: записать в сторонней
  программе → найти файл → положить в inbox → запустить prep.sh → ждать
  расшифровку и только тогда узнать, что дубль неудачный. Здесь всё в один
  проход, и текст дубля виден сразу: плохой дубль выбрасывается до того, как
  в него вложен конвейер.

  Расшифровка идёт ЛОКАЛЬНО (tools/whisper + модель large-v3-turbo). Никакой
  звук наружу не уходит — ни в Anthropic, ни в облако OpenAI.

  Использование (из корня проекта, в PowerShell):
    .\scripts\rec-voice.ps1 rolik-09-pamyat
        → пишет inbox/rolik-09-pamyat.wav. Остановка — клавиша q.
        → затем печатает расшифровку дубля.

    .\scripts\rec-voice.ps1 rolik-09-pamyat -Seconds 60
        → остановится сама через 60 секунд (страховка, если забыл про q).

    .\scripts\rec-voice.ps1 -List
        → показать, какие микрофоны видит система.

    .\scripts\rec-voice.ps1 proba -NoTranscribe
        → только запись, без расшифровки (быстрая проба уровня).

  Дальше по конвейеру:
    SPEED=1.0 ./prep.sh inbox/<имя>.wav          # −14 LUFS, чистка
    scripts/queue-add.sh inbox/<имя>-prep.wav NN # слот + пословные тайминги
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)][string]$Name,
  [int]$Seconds = 600,
  [string]$Device,
  [switch]$List,
  [switch]$NoTranscribe
)

$ErrorActionPreference = 'Stop'
$proj   = Split-Path -Parent $PSScriptRoot
$ffmpeg = Join-Path $proj 'tools\ffmpeg\ffmpeg.exe'
$wcli   = Join-Path $proj 'tools\whisper\whisper-cli.exe'
$model  = Join-Path $proj 'tools\whisper-models\ggml-large-v3-turbo.bin'
$gloss  = Join-Path $proj 'scripts\whisper-glossary.txt'

if (-not (Test-Path $ffmpeg)) { throw "Нет ffmpeg: $ffmpeg (см. tools/WINDOWS.md)" }

# Список микрофонов ffmpeg отдаёт в stderr — поэтому 2>&1 и фильтр по (audio).
function Get-AudioDevices {
  $raw = & $ffmpeg -hide_banner -list_devices true -f dshow -i dummy 2>&1 | Out-String
  $names = @()
  foreach ($line in $raw -split "`r?`n") {
    if ($line -match '"([^"]+)"\s+\(audio\)') { $names += $Matches[1] }
  }
  return $names
}

if ($List) {
  $i = 0
  Write-Host "Микрофоны, которые видит система:`n"
  foreach ($d in Get-AudioDevices) { Write-Host ("  [{0}] {1}" -f $i, $d); $i++ }
  Write-Host "`nЗапись с конкретного: .\scripts\rec-voice.ps1 имя -Device ""<название>"""
  return
}

if (-not $Name) { throw "Укажи имя дубля: .\scripts\rec-voice.ps1 rolik-09-pamyat" }

if (-not $Device) {
  $devices = Get-AudioDevices
  if ($devices.Count -eq 0) { throw "Микрофонов не нашлось. Проверь: .\scripts\rec-voice.ps1 -List" }
  $Device = $devices[0]
}

$inbox = Join-Path $proj 'inbox'
if (-not (Test-Path $inbox)) { New-Item -ItemType Directory $inbox | Out-Null }
$out = Join-Path $inbox "$Name.wav"
if (Test-Path $out) {
  # Дубли не перетираем молча: прошлый мог быть удачным.
  $stamp = Get-Date -Format 'HHmmss'
  $out = Join-Path $inbox "$Name-$stamp.wav"
  Write-Host "! Файл с таким именем есть, пишу в $(Split-Path -Leaf $out)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Микрофон: $Device"
Write-Host "Файл:     $(Split-Path -Leaf $out)  (48 кГц, моно, PCM)"
Write-Host "Потолок:  $Seconds с"
Write-Host ""
Write-Host "ГОВОРИ. Закончил - нажми q (не Ctrl+C: он портит заголовок wav)." -ForegroundColor Cyan
Write-Host ""

# -ac 1 / -ar 48000 / pcm_s16le — то, что ждёт prep.sh. Ускорение и
# нормализацию здесь НЕ делаем: это работа prep.sh, иначе LUFS считается дважды.
& $ffmpeg -hide_banner -loglevel warning -stats `
  -f dshow -i "audio=$Device" `
  -ac 1 -ar 48000 -c:a pcm_s16le -t $Seconds "$out"

if (-not (Test-Path $out)) { throw "Запись не создалась - смотри сообщение ffmpeg выше" }

$size = [math]::Round((Get-Item $out).Length / 1MB, 2)
$dur  = & $ffmpeg -hide_banner -i "$out" 2>&1 | Select-String -Pattern 'Duration: (\S+),' |
        ForEach-Object { $_.Matches[0].Groups[1].Value }
Write-Host ""
Write-Host "Записано: $out  ($size МБ, длительность $dur)" -ForegroundColor Green

if ($NoTranscribe) { return }
if (-not (Test-Path $wcli))  { Write-Host "! Нет whisper-cli - расшифровку пропускаю"; return }
if (-not (Test-Path $model)) { Write-Host "! Нет модели large-v3-turbo - расшифровку пропускаю"; return }

# whisper.cpp принимает только 16 кГц — отдельный временный файл, исходник не трогаем.
$tmp = Join-Path $env:TEMP "$Name-16k.wav"
& $ffmpeg -hide_banner -loglevel error -y -i "$out" -ar 16000 -ac 1 "$tmp"

$prompt = ''
if (Test-Path $gloss) { $prompt = ((Get-Content $gloss -Raw) -replace '\s+', ' ').Trim() }

Write-Host ""
Write-Host "Расшифровка дубля (локально, large-v3-turbo)..." -ForegroundColor Cyan
$wargs = @('-m', $model, '-f', $tmp, '-l', 'ru', '-nt')
if ($prompt) { $wargs += @('--prompt', $prompt) }
$text = (& $wcli @wargs 2>$null | Out-String).Trim()
Remove-Item $tmp -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "-------- что услышал whisper --------" -ForegroundColor DarkGray
Write-Host $text
Write-Host "-------------------------------------" -ForegroundColor DarkGray
Write-Host ""
$words = ($text -split '\s+' | Where-Object { $_ }).Count
Write-Host "Слов: $words. Для ролика 40-45 с норма - 120-135 слов."
Write-Host ""
Write-Host "Дубль годный -> дальше:" -ForegroundColor Green
Write-Host "  SPEED=1.0 ./prep.sh inbox/$(Split-Path -Leaf $out)"
Write-Host "  scripts/queue-add.sh inbox/$($Name)-prep.wav NN"
Write-Host "Дубль плохой -> просто перезапусти эту команду, прошлый файл не перетрётся."
