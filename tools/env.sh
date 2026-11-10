# ─────────────────────────────────────────────────────────────────────────────
# env.sh — прослойка окружения reelcraft. ДОБАВЛЕНО ПРИ УСТАНОВКЕ, не из кита.
#
# Кит писался под macOS. В Git Bash под Windows нет ffmpeg, whisper-cli,
# caffeinate, рабочего `python3` и даже `head`. Чтобы не кромсать авторские
# скрипты в десятке мест, всё окружение собрано здесь, а в каждом скрипте
# кита стоит ровно одна строка подключения.
#
# Файл безопасен на любой ОС: на macOS и Linux он только подсказывает шрифт
# для QA, инструменты там берутся из системы. Поэтому строку подключения можно
# держать в скриптах постоянно — после обновления кита её не переналагают, а
# просто возвращают на место (tools/patch-kit.sh сделает это сам).
#
# Подключается так — путь НЕ зашивать, он считается от самого скрипта:
#   из корня проекта:  . "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tools/env.sh"
#   из scripts/:       . "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"
# ─────────────────────────────────────────────────────────────────────────────

# Своё расположение — отсюда считаем всё остальное. Абсолютных путей в этом
# файле нет намеренно: с ними конвейер не переносится на другую машину.
RC_TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RC_ROOT="$(cd "$RC_TOOLS/.." && pwd)"
export RC_TOOLS RC_ROOT

# Модели whisper держим внутри проекта, если они там есть: на Windows у C:\
# обычно нет прав записи, а дефолт кита — ~/.cache/whisper-models.
if [ -d "$RC_TOOLS/whisper-models" ]; then
  export WHISPER_MODELS_DIR="${WHISPER_MODELS_DIR:-$RC_TOOLS/whisper-models}"
fi

case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*)
    # ── Только Windows ──────────────────────────────────────────────────────
    # bin/ — шимы (head, caffeinate, python3); дальше ffmpeg и whisper-cli.
    # Ставим В НАЧАЛО PATH: системный python3 из WindowsApps — нерабочая
    # заглушка, её нужно перекрыть, а не дополнить.
    PATH="$RC_TOOLS/bin:$RC_TOOLS/ffmpeg:$RC_TOOLS/whisper:$PATH"
    export PATH

    # Шрифт для подписей кадров на контактном листе QA (в ките зашит macOS).
    export RC_QA_FONT="${RC_QA_FONT:-C:/Windows/Fonts/arialbd.ttf}"

    # Python под Windows печатает в консоль в cp1251 и падает на «×», «→», «✓»
    # в выводе скриптов QA (UnicodeEncodeError). Принудительно UTF-8.
    export PYTHONIOENCODING=utf-8
    ;;
  Darwin)
    # ── macOS ───────────────────────────────────────────────────────────────
    # Всё родное: ffmpeg и whisper-cli из Homebrew, python3 и head системные.
    # Шрифт для QA — тот же, что зашит в ките, но через переменную.
    export RC_QA_FONT="${RC_QA_FONT:-/System/Library/Fonts/Supplemental/Arial Bold.ttf}"
    ;;
  *)
    # ── Linux и прочее ──────────────────────────────────────────────────────
    # caffeinate и забор записей из Диктофона macOS (--voice) недоступны;
    # соответствующие шаги пропускаются, см. INSTALL.md.
    # Шрифт для QA ищем в типовых местах дистрибутивов.
    if [ -z "${RC_QA_FONT:-}" ]; then
      for f in \
        /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf \
        /usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf \
        /usr/share/fonts/TTF/DejaVuSans-Bold.ttf
      do
        [ -f "$f" ] && { export RC_QA_FONT="$f"; break; }
      done
    fi
    ;;
esac
