<#
    Подъём чистого консольного окна под съёмку банка футажа.

    Зачем отдельный скрипт: окно для кадра должно быть не «любым терминалом»,
    а повторяемым — один кегль, одна цветовая схема, один заголовок и пустая
    история. Прошлый прогон поднимал его руками, и геометрия кадра каждый раз
    была другая.

    Три вещи, которые здесь решаются и руками каждый раз забывались:

    1. Переменные CLAUDE_CODE* / CLAUDECODE* наследуются из сессии агента, и
       живая сессия `claude` печатает в кадр строку про inherited child-session
       marker. Вычищаются до запуска оболочки.

    2. Кегль консоли ставится только API-вызовом SetCurrentConsoleFontEx, и
       работает он в conhost — Windows Terminal вызов молча игнорирует. Поэтому
       оболочка поднимается явно через conhost.exe, а не через wt.exe.

    3. История прошлых команд — утечка приватности (в кадр лезут клиентские
       папки из прошлого вывода). Окно стартует с чистого экрана и своего
       профиля не грузит (-NoProfile).

    Запуск:
      pwsh -File scripts/rec-shell.ps1 -WorkDir C:\path\to\your-project
      pwsh -File scripts/rec-shell.ps1 -WorkDir . -Shell bash
#>
[CmdletBinding()]
param(
    [string] $Title = 'REC-CLAUDE',
    [Parameter(Mandatory)] [string] $WorkDir,
    [ValidateSet('pwsh', 'bash')] [string] $Shell = 'pwsh',
    [int] $FontSize = 24,
    [string] $FaceName = 'Consolas',
    [int] $Cols = 100,
    [int] $Rows = 38
)

$ErrorActionPreference = 'Stop'

$work = (Resolve-Path $WorkDir).Path

# Тёзки по заголовку: оболочка bash переживает закрытие своего pwsh-родителя,
# и прошлое съёмочное окно остаётся висеть. Два окна с одним именем — съёмка
# печатает в одно, а пишет другое (ловилось стражем фокуса как «брак» без
# объяснения причины). Гасим с повтором: Git Bash держит несколько процессов
# на одно окно, с первого прохода уходят не все.
for ($i = 0; $i -lt 8; $i++) {
    $stale = @(Get-Process | Where-Object { $_.MainWindowTitle -eq $Title })
    if ($stale.Count -eq 0) { break }
    if ($i -eq 0) { Write-Host "Гашу прежние окна '$Title': $($stale.Count)" }
    $stale | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 600
}

# Загрузчик окна: всё, что должно случиться ДО появления приглашения,
# пишется файлом — в аргументах командной строки кавычки и точки с запятой
# разбираются conhost'ом непредсказуемо.
$boot = Join-Path ([IO.Path]::GetTempPath()) "rec-shell-boot-$PID.ps1"

$bootBody = @"
# 1. Маркеры сессии агента — иначе `claude` печатает их в кадр
Get-ChildItem env: | Where-Object { `$_.Name -match '^(CLAUDE_CODE|CLAUDECODE)' } |
    ForEach-Object { Remove-Item "env:`$(`$_.Name)" -ErrorAction SilentlyContinue }
`$env:PYTHONIOENCODING = 'utf-8'

# 2. Кегль консоли: только через SetCurrentConsoleFontEx, и только в conhost
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class RecFont {
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr GetStdHandle(int n);
  [DllImport("kernel32.dll", SetLastError=true)]
  static extern bool SetCurrentConsoleFontEx(IntPtr h, bool max, ref FONTINFOEX f);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  struct FONTINFOEX {
    public uint cbSize; public uint nFont; public short X, Y;
    public uint FontFamily, FontWeight;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string FaceName;
  }
  public static void Set(string face, short size) {
    var f = new FONTINFOEX();
    f.cbSize = (uint)Marshal.SizeOf(typeof(FONTINFOEX));
    f.FaceName = face; f.Y = size; f.FontWeight = 400; f.FontFamily = 54;
    SetCurrentConsoleFontEx(GetStdHandle(-11), false, ref f);
  }
}
'@
[RecFont]::Set('$FaceName', $FontSize)

# 3. Размер окна в символах. Буфер равен окну: боковой скроллбар в кадре —
#    лишняя деталь, а перенос строк таблицы ломает её разбор глазами.
try {
    `$ui = `$Host.UI.RawUI
    `$ui.BufferSize = New-Object Management.Automation.Host.Size($Cols, 9999)
    `$ui.WindowSize  = New-Object Management.Automation.Host.Size($Cols, $Rows)
} catch { }

# 4. Подсказка-призрак PSReadLine: серым дорисовывает команду из ИСТОРИИ
#    прошлых сессий. В кадре это и лишняя деталь, и утечка — в истории
#    лежат пути клиентских папок. Отключается до первой печати.
try {
    Import-Module PSReadLine -ErrorAction Stop
    Set-PSReadLineOption -PredictionSource None
    Set-PSReadLineOption -HistorySaveStyle SaveNothing
} catch { }

`$Host.UI.RawUI.WindowTitle = '$Title'
Set-Location '$work'
Clear-Host
"@

if ($Shell -eq 'bash') {
    # Git Bash перебивает заголовок окна сам (PROMPT_COMMAND из /etc/profile),
    # и съёмка перестаёт находить окно по имени. Поэтому оболочка поднимается
    # со своим rc-файлом: заголовок прибит, приглашение короткое (в кадре нужен
    # путь, а не строка на пол-экрана), профиль пользователя не грузится.
    $bashWork = '/' + $work.Substring(0, 1).ToLower() + ($work.Substring(2) -replace '\\', '/')
    $rc = Join-Path ([IO.Path]::GetTempPath()) "rec-shell-rc-$PID"
    $rcBody = @"
cd '$bashWork'
export PS1='\[\e[36m\]\w\[\e[0m\]\$ '
export PROMPT_COMMAND='printf "\033]0;$Title\007"'
export HISTFILE=/dev/null
clear
"@
    Set-Content -LiteralPath $rc -Value $rcBody -Encoding ASCII
    # Пустая строка обязательна: $bootBody заканчивается без перевода строки,
    # и запуск склеивался с Clear-Host в одну строку — загрузчик падал.
    $bootBody += @"

& 'C:\Program Files\Git\bin\bash.exe' --noprofile --rcfile '$rc' -i
"@
}

Set-Content -LiteralPath $boot -Value $bootBody -Encoding UTF8

$cmdLine = "pwsh.exe -NoLogo -NoProfile -NoExit -ExecutionPolicy Bypass -File `"$boot`""
Start-Process -FilePath 'conhost.exe' -ArgumentList $cmdLine | Out-Null

# Окну нужно время родиться, прежде чем съёмка начнёт искать его по заголовку
Start-Sleep -Seconds 3
Write-Host "Окно '$Title' поднято: $work (кегль $FontSize, ${Cols}x${Rows})"
