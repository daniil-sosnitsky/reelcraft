# restore-tools.ps1 — поднять инструментарий reelcraft на чистой машине.
#
# Зачем нужен: ffmpeg, whisper-cli и модель распознавания весят 2.3 ГБ, и в
# git они не уходят. Дело не в лени — GitHub физически не принимает файлы
# больше 100 МБ, а здесь ffmpeg.exe 217 МБ и модель 1.6 ГБ. Поэтому в
# репозитории лежит ЭТОТ скрипт: код и правила версионируются, бинарники
# качаются заново одной командой.
#
# Запуск (PowerShell, из любого места):
#   <путь-к-проекту>\tools\restore-tools.ps1
#
# Идемпотентен: что уже стоит — пропускает.

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

$T   = $PSScriptRoot
$tmp = Join-Path $env:TEMP "reelcraft-restore"
New-Item -ItemType Directory -Force $tmp | Out-Null

function Say($t) { Write-Host "→ $t" }

# ── 1. ffmpeg ────────────────────────────────────────────────────────────────
if (Test-Path "$T\ffmpeg\ffmpeg.exe") {
    Say "ffmpeg уже на месте — пропускаю"
} else {
    Say "ffmpeg 9.0.2 (~246 МБ)…"
    $zip = "$tmp\ffmpeg.zip"
    Invoke-WebRequest "https://github.com/GyanD/codexffmpeg/releases/download/9.0.2/ffmpeg-9.0.2-full_build.zip" -OutFile $zip -TimeoutSec 1800
    Expand-Archive $zip "$tmp\ff" -Force
    $inner = (Get-ChildItem "$tmp\ff" -Directory | Select-Object -First 1).FullName
    New-Item -ItemType Directory -Force "$T\ffmpeg" | Out-Null
    Copy-Item "$inner\bin\*" "$T\ffmpeg\" -Force
    Say "ffmpeg готов"
}

# ── 2. whisper.cpp ───────────────────────────────────────────────────────────
if (Test-Path "$T\whisper\whisper-cli.exe") {
    Say "whisper-cli уже на месте — пропускаю"
} else {
    Say "whisper.cpp b5130 (~8 МБ)…"
    $zip = "$tmp\whisper.zip"
    Invoke-WebRequest "https://github.com/ggml-org/whisper.cpp/releases/download/b5130/whisper-bin-x64.zip" -OutFile $zip -TimeoutSec 900
    Expand-Archive $zip "$tmp\wh" -Force
    New-Item -ItemType Directory -Force "$T\whisper" | Out-Null
    Copy-Item "$tmp\wh\Release\*" "$T\whisper\" -Force
    # демо-утилиты не нужны, оставляем cli и библиотеки
    Remove-Item "$T\whisper\test-*.exe","$T\whisper\wchess.exe","$T\whisper\command.exe",
                "$T\whisper\stream.exe","$T\whisper\main.exe","$T\whisper\bench.exe",
                "$T\whisper\whisper-talk-llama.exe","$T\whisper\llama.dll",
                "$T\whisper\SDL2.dll","$T\whisper\parakeet*" -Force -ErrorAction SilentlyContinue
    Say "whisper-cli готов"
}

# ── 3. модель распознавания ──────────────────────────────────────────────────
$model = "$T\whisper-models\ggml-large-v3-turbo.bin"
if ((Test-Path $model) -and ((Get-Item $model).Length -gt 1.5GB)) {
    Say "модель уже на месте — пропускаю"
} else {
    Say "модель large-v3-turbo (1.6 ГБ, это надолго)…"
    New-Item -ItemType Directory -Force "$T\whisper-models" | Out-Null
    Invoke-WebRequest "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin" -OutFile $model -TimeoutSec 7200
    Say "модель готова"
}

# ── 4. каталог приёмов video-shotcraft ───────────────────────────────────────
# Кладётся В ПОДПАПКУ skill/: upstream переструктурировали репозиторий, а
# конвейер ссылается на старые пути ../video-shotcraft/skill/... — так они
# сходятся без правок в шести файлах library/.
#
# Клонируем ГИТОМ, а не архивом, и это не вкусовщина: общий банк звуковых
# эффектов upstream удалил 29.10.2026, и достать его можно только из истории
# (scripts/setup-assets.sh забирает его из коммита 5a2e98da). У распакованного
# архива истории нет — звук стал бы недоступен. Архив остаётся запасным путём,
# если git почему-то недоступен.
$sc = Join-Path (Split-Path (Split-Path $T -Parent) -Parent) "video-shotcraft\skill"
if (Test-Path "$sc\references\shots") {
    Say "каталог приёмов уже на месте — пропускаю"
} else {
    New-Item -ItemType Directory -Force (Split-Path $sc -Parent) | Out-Null
    $git = (Get-Command git -ErrorAction SilentlyContinue).Source
    if ($git) {
        Say "каталог приёмов video-shotcraft, клон с историей (~60 МБ)…"
        & $git clone --quiet https://github.com/Vincentwei1021/video-shotcraft $sc
        if ($LASTEXITCODE -ne 0) { throw "git clone каталога приёмов не удался (код $LASTEXITCODE)" }
        Say "каталог готов (история на месте — звук восстановим)"
    } else {
        Say "git не найден; беру каталог приёмов архивом (~48 МБ)…"
        $zip = "$tmp\shotcraft.zip"
        Invoke-WebRequest "https://codeload.github.com/Vincentwei1021/video-shotcraft/zip/refs/heads/main" -OutFile $zip -TimeoutSec 1800
        Expand-Archive $zip "$tmp\sc" -Force
        $inner = (Get-ChildItem "$tmp\sc" -Directory | Select-Object -First 1).FullName
        Copy-Item $inner $sc -Recurse -Force
        Write-Host "  ! Без истории: банк звуковых эффектов из неё не достать." -ForegroundColor Yellow
        Write-Host "    Поставь git и переклонируй каталог, либо подбери эффекты"
        Write-Host "    сам — оба способа печатает scripts/setup-assets.sh."
    }
}

# ── 5. зависимости движка и звуковые банки ───────────────────────────────────
$proj = Split-Path $T -Parent
if (Test-Path "$proj\engine\node_modules") { Say "node_modules уже есть — пропускаю" }
else { Say "npm install (~500 МБ)…"; Push-Location "$proj\engine"; npm install --no-audit --no-fund; Pop-Location }

Say "звуковые банки (SFX из каталога приёмов)…"
# Через bash, а не напрямую: PowerShell не исполняет .sh, и шаг молча падал.
# В PATH у PowerShell bash обычно НЕТ, даже когда Git Bash стоит, — поэтому
# после PATH проверяем стандартные места установки Git for Windows.
$bash = (Get-Command bash -ErrorAction SilentlyContinue).Source
if (-not $bash) {
    $bash = @(
        "$env:ProgramFiles\Git\bin\bash.exe",
        "${env:ProgramFiles(x86)}\Git\bin\bash.exe",
        "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe"
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}
if ($bash) {
    # Путь в POSIX-виде: D:\…\setup-assets.sh → /d/…/setup-assets.sh
    $sh = "$proj\scripts\setup-assets.sh" -replace '\\', '/' -replace '^([A-Za-z]):', '/$1'
    $sh = $sh.Substring(0, 2).ToLower() + $sh.Substring(2)
    # Код возврата проверяем обязательно: раньше шаг мог упасть (нет описи,
    # нет банка в клоне), а скрипт всё равно писал «ГОТОВО» — и человек узнавал
    # об отсутствии звука только на первом ролике.
    & $bash $sh 2>&1 | Select-Object -Last 14
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ! Звуковые банки НЕ установлены (setup-assets.sh вернул $LASTEXITCODE)." -ForegroundColor Yellow
        Write-Host "    Прочитай его вывод выше и запусти повторно в Git Bash:"
        Write-Host "    scripts/setup-assets.sh"
        $script:assetsFailed = $true
    }
} else {
    Write-Host "  ! bash не найден — звуковые банки не поставлены." -ForegroundColor Yellow
    Write-Host "    Поставь Git for Windows (вместе с Git Bash) и запусти в Git Bash:"
    Write-Host "    scripts/setup-assets.sh"
}

Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Write-Host ""
if ($script:assetsFailed) {
    Write-Host "ИНСТРУМЕНТЫ ГОТОВЫ, НО ЗВУК НЕ ПОСТАВЛЕН — см. предупреждение выше." -ForegroundColor Yellow
} else {
    Write-Host "ГОТОВО." -ForegroundColor Green
}
Write-Host "Осталось руками:"
Write-Host "  • 4-5 треков с mixkit.co в engine\public\shared\bgm\"
Write-Host "  • свой круглый аватар канала в engine\public\shared\cta\avatar.png"
Write-Host "    и чистый скрин шапки в engine\public\shared\cta\tg-channel.jpg"
Write-Host "    (сейчас там серые заглушки — рендер пройдёт, но в кадр их не выпускают)"
Write-Host "  • патчи монтажного стола — ветка W3 в INSTALL.md"
