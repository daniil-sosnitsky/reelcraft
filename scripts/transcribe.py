#!/usr/bin/env python3
# transcribe.py — конвертация вывода whisper-cli (-oj, -ml 1 -sow) в:
#   transcript.json  — массив слов [{text,start,end}] (плоский формат,
#                      его же ждёт find-source-reel.py)
#   captions.generated.ts — заготовка Word[] для караоке (вычитать ошибки
#                      Whisper ОБЯЗАТЕЛЬНО, тайминги не трогать)
# Запуск: transcribe.py <whisper.json> <слот-папка>
import json, sys, re, os

src, slot = sys.argv[1], sys.argv[2]
# encoding обязателен: на русской Windows Python берёт cp1251 и падает на
# кириллице в выводе whisper (UnicodeDecodeError, поймано 2026-10-03)
data = json.load(open(src, encoding="utf-8"))
words = []
for seg in data.get("transcription", []):
    text = seg.get("text", "").strip()
    if not text:
        continue
    off = seg.get("offsets", {})
    start = round(off.get("from", 0) / 1000, 2)
    end = round(off.get("to", 0) / 1000, 2)
    # whisper-cli с -ml 1 иногда клеит знак к следующему сегменту-пустышке
    words.append({"text": text, "start": start, "end": end})

json.dump(words, open(os.path.join(slot, "transcript.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

with open(os.path.join(slot, "captions.generated.ts"), "w", encoding="utf-8") as f:
    f.write("// ЗАГОТОВКА КАРАОКЕ — вычитать ошибки Whisper построчно!\n")
    f.write("// Тексты можно править, тайминги НЕ трогать. Разметка выделений:\n")
    f.write("// ключевые слова hl:'mark', отрицания/минус-цифры hl:'red'.\n")
    f.write("export const CAP = [\n")
    for w in words:
        t = w["text"].replace("\\", "\\\\").replace("'", "\\'")
        f.write(f"  {{ text: '{t}', start: {w['start']}, end: {w['end']} }},\n")
    f.write("];\n")
print(f"→ слов: {len(words)}, транскрипт и караоке-заготовка в {slot}/")
