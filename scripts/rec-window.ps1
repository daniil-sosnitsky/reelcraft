<#
    Съёмка живого экрана: окно ставится в точные координаты, команда печатается
    посимвольно, пишется область экрана по прямоугольнику окна.

    Три грабли, на которых это ломалось (все проверены 2026-10-16):

    1. `ffmpeg -f gdigrab -i title=<окно>` даёт ЧЁРНЫЙ кадр с одним курсором:
       окно под композитором DWM отдаёт пустой контекст. Поэтому пишем область
       экрана, а окно сами же туда и ставим — всё остальное остаётся под ним.

    2. WScript.Shell.SendKeys печатать НЕЛЬЗЯ: он переводит символ в код
       клавиши по ТЕКУЩЕЙ раскладке. При активной русской раскладке латиницы
       в ней нет, и в окно летит мусор («claude» приехало как «3145»).
       Здесь ввод идёт через SendInput с флагом KEYEVENTF_UNICODE — шлётся
       сам символ, раскладка значения не имеет.

    3. Параметр $Steps объявлен [string]; присваивать разобранный JSON в
       $steps нельзя — имена переменных регистронезависимы, и массив молча
       схлопнется обратно в строку.

    Страж фокуса: перед каждым шагом сверяется активное окно. Ввод идёт в
    АКТИВНОЕ окно, поэтому если автор переключится, команда уедет в чужое
    окно — например, в переписку. Не совпало — съёмка обрывается, файл
    помечается браком.

    Запуск:
      pwsh -File scripts/rec-window.ps1 -WindowTitle REC-CLAUDE `
           -Steps footage/_takes/take-01.json -Out footage/_takes/take-01.mp4 `
           -X 0 -Y 0 -W 1280 -H 800
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $WindowTitle,
    [Parameter(Mandatory)] [string] $Steps,
    [Parameter(Mandatory)] [string] $Out,
    [int] $X = 0,
    [int] $Y = 0,
    [int] $W = 1280,
    [int] $H = 800,
    [int] $Inset = 10,
    [int] $Fps = 30,
    [int] $MaxSeconds = 240,
    [string] $Ffmpeg = "$PSScriptRoot\..\tools\ffmpeg\ffmpeg.exe"
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System; using System.Text; using System.Threading; using System.Runtime.InteropServices;
public class RecWin {
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool r);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint n, INPUT[] inp, int size);

  public struct RECT { public int L, T, R, B; }
  delegate bool EnumProc(IntPtr h, IntPtr p);

  [StructLayout(LayoutKind.Sequential)]
  struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit, Size=40)]
  struct INPUT { [FieldOffset(0)] public uint type; [FieldOffset(8)] public KEYBDINPUT ki; }

  const uint INPUT_KEYBOARD = 1, KEYEVENTF_KEYUP = 0x0002, KEYEVENTF_UNICODE = 0x0004;

  static void Send(ushort vk, ushort scan, uint flags) {
    var i = new INPUT { type = INPUT_KEYBOARD };
    i.ki = new KEYBDINPUT { wVk = vk, wScan = scan, dwFlags = flags, time = 0, dwExtraInfo = IntPtr.Zero };
    SendInput(1, new INPUT[] { i }, Marshal.SizeOf(typeof(INPUT)));
  }

  // Печать символа как ЮНИКОДА: раскладка клавиатуры не участвует вообще
  public static void TypeText(string text, int delayMs) {
    foreach (char c in text) {
      Send(0, c, KEYEVENTF_UNICODE);
      Send(0, c, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP);
      Thread.Sleep(delayMs);
    }
  }

  // Служебные клавиши шлются кодом: юникод-режим для них не годится
  public static void TapKey(ushort vk) {
    Send(vk, 0, 0);
    Thread.Sleep(40);
    Send(vk, 0, KEYEVENTF_KEYUP);
  }

  // Сколько ВИДИМЫХ окон носит этот заголовок. Больше одного — съёмка
  // не имеет права гадать: оболочка bash переживает закрытие родителя,
  // и тёзка остаётся висеть. Ввод уйдёт в одно окно, запись снимет другое.
  public static int Count(string title) {
    int n = 0;
    EnumWindows((h,p) => {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(400); GetWindowTextW(h, sb, 400);
      if (sb.ToString().Contains(title)) n++;
      return true;
    }, IntPtr.Zero);
    return n;
  }

  public static IntPtr Find(string title) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h,p) => {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(400); GetWindowTextW(h, sb, 400);
      if (sb.ToString().Contains(title)) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
  public static string TitleOf(IntPtr h) {
    var sb = new StringBuilder(400); GetWindowTextW(h, sb, 400); return sb.ToString();
  }
}
'@ -Language CSharp

# Коды служебных клавиш (VK_*)
$VK = @{
    ENTER = 0x0D; ESC = 0x1B; TAB = 0x09; SPACE = 0x20; BACKSPACE = 0x08
    UP = 0x26; DOWN = 0x28; LEFT = 0x25; RIGHT = 0x27
}

function Stop-Recorder($proc) {
    # 'q' в stdin — корректное завершение: ffmpeg дописывает moov-атом.
    # Kill оставляет файл без индекса, он не открывается вообще.
    if ($proc -and -not $proc.HasExited) {
        try { $proc.StandardInput.WriteLine('q'); $proc.StandardInput.Flush() } catch {}
        if (-not $proc.WaitForExit(8000)) { $proc.Kill() }
    }
}

# --- окно ---------------------------------------------------------------
$hwnd = [RecWin]::Find($WindowTitle)
if ($hwnd -eq [IntPtr]::Zero) { throw "Окно с заголовком '$WindowTitle' не найдено" }
$sameName = [RecWin]::Count($WindowTitle)
if ($sameName -gt 1) {
    throw "Окон с заголовком '$WindowTitle' сразу $sameName. Ввод уйдёт в одно, " +
          "запись снимет другое — съёмка отменена. Погаси лишние: " +
          "Get-Process | ? MainWindowTitle -eq '$WindowTitle' | Stop-Process -Force"
}

[RecWin]::ShowWindow($hwnd, 9) | Out-Null      # SW_RESTORE
[RecWin]::MoveWindow($hwnd, $X, $Y, $W, $H, $true) | Out-Null
[RecWin]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 900

$r = New-Object RecWin+RECT
[RecWin]::GetWindowRect($hwnd, [ref]$r) | Out-Null
$rw = $r.R - $r.L; $rh = $r.B - $r.T

# Кадр пишется по ФАКТИЧЕСКОМУ прямоугольнику окна, а не по заказанному:
# Windows Terminal округляет размер до символьной сетки. Для приватности
# важно совпадение области записи с окном — иначе по краям откроются соседи.
$tolerance = 60
if ([math]::Abs($r.L - $X) -gt 4 -or [math]::Abs($r.T - $Y) -gt 4 -or
    [math]::Abs($rw - $W) -gt $tolerance -or [math]::Abs($rh - $H) -gt $tolerance) {
    throw "Окно встало не по месту: $($r.L),$($r.T) ${rw}x${rh}, ожидалось $X,$Y ${W}x${H}"
}
# У окон Windows 11 есть НЕВИДИМАЯ рамка изменения размера: GetWindowRect
# отдаёт прямоугольник шире видимого окна, и по краям кадра открывается то,
# что лежит под ним (поймано 2026-10-16: полоса чужого окна справа).
# Поэтому область записи вжимается внутрь окна на $Inset пикселей.
$X = $r.L + $Inset; $Y = $r.T + $Inset
$rw = $rw - 2 * $Inset; $rh = $rh - 2 * $Inset
$capW = $rw - ($rw % 2); $capH = $rh - ($rh % 2)   # ffmpeg не кодирует нечётные стороны

$stepList = @(Get-Content -LiteralPath $Steps -Raw -Encoding UTF8 | ConvertFrom-Json)
$outDir = Split-Path -Parent $Out
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

# --- запись -------------------------------------------------------------
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = (Resolve-Path $Ffmpeg).Path
$psi.Arguments = @(
    '-hide_banner','-loglevel','error',
    '-f','gdigrab','-framerate',$Fps,
    '-offset_x',$X,'-offset_y',$Y,'-video_size',"${capW}x${capH}",
    '-i','desktop','-t',$MaxSeconds,
    '-c:v','libx264','-crf','16','-preset','veryfast','-pix_fmt','yuv420p',
    '-y',$Out
) -join ' '
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.CreateNoWindow = $true
$rec = [System.Diagnostics.Process]::Start($psi)
Start-Sleep -Milliseconds 900

$aborted = $null
try {
    foreach ($s in $stepList) {
        # страж: вводим только в своё окно
        $fg = [RecWin]::GetForegroundWindow()
        if ($fg -ne $hwnd) {
            $aborted = "фокус ушёл в окно '$([RecWin]::TitleOf($fg))'"
            break
        }
        switch ($s.act) {
            'wait' {
                # Ожидание дробится на тики со сверкой фокуса. Один длинный
                # Start-Sleep — это слепая зона: окно успевает уйти на задний
                # план, а запись продолжает писать ОБЛАСТЬ ЭКРАНА, то есть
                # то, что оказалось сверху. Поймано 2026-10-16: ожидание
                # рендера в 95 с сняло браузер с клиентской CRM.
                $left = [int]$s.ms
                while ($left -gt 0) {
                    $tick = [math]::Min(250, $left)
                    Start-Sleep -Milliseconds $tick
                    $left -= $tick
                    $cur = [RecWin]::GetForegroundWindow()
                    if ($cur -ne $hwnd) {
                        $aborted = "фокус ушёл в окно '$([RecWin]::TitleOf($cur))' во время ожидания"
                        break
                    }
                }
            }
            'key'  {
                $name = ([string]$s.keys).ToUpper()
                if (-not $VK.ContainsKey($name)) { throw "Неизвестная клавиша: $name" }
                $times = if ($s.times) { [int]$s.times } else { 1 }
                for ($i = 0; $i -lt $times; $i++) {
                    [RecWin]::TapKey([uint16]$VK[$name])
                    Start-Sleep -Milliseconds 220
                }
            }
            'type' {
                $delay = if ($s.cps) { [int](1000 / [int]$s.cps) } else { 110 }
                [RecWin]::TypeText([string]$s.text, $delay)
            }
            default { throw "Неизвестный шаг: $($s.act)" }
        }
        if ($aborted) { break }
    }
}
finally {
    Stop-Recorder $rec
}

if ($aborted) {
    # Файл не сохраняется, а УДАЛЯЕТСЯ. Обрыв по фокусу значит ровно одно:
    # в кадр попало чужое окно — почта, переписка, клиентская CRM. Хранить
    # такой дубль «на всякий случай» нельзя, пересъёмка стоит минуту.
    if (Test-Path $Out) { Remove-Item -LiteralPath $Out -Force }
    throw "Съёмка оборвана: $aborted. Дубль удалён (в кадр попало чужое окно) — пересними."
}

$size = (Get-Item -LiteralPath $Out).Length
"снято: $Out ($([math]::Round($size/1MB,2)) МБ, область ${capW}x${capH})"
