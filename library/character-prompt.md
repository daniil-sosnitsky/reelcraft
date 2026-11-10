# Промпт для генерации персонажа светлой темы

Светлая тема ставит в низ кадра нарисованного персонажа, который «играет»
позами под речь. Персонаж — это ты: узнаваемый, в одном стиле, в одной одежде,
одного роста на всех десяти позах. Требования движка к файлам —
`engine/public/shared/character/README.md`.

> **Персонаж не обязателен.** Тёмные темы его не используют вообще. Не хочешь
> рисовать — бери тёмную тему (`library/adaptive-theme.md`), и этот файл тебе
> не нужен. Это полноценный путь, а не упрощение.

**Порядок двухэтапный, одной пачкой не генерить.** Сначала делается эталонная
поза `base`, ты её утверждаешь, и дальше каждая следующая поза генерится
**с приложением утверждённого эталона как референса**. Иначе от позы к позе
плывут лицо, одежда и рост — а движок переключает позы встык, и в кадре это
выглядит как разные люди. Это самая дорогая ошибка на этом шаге: переделывать
придётся все десять.

## Что приложить к генерации

| Референс | Чем | Зачем |
|---|---|---|
| Своё лицо | фронтальное фото, положи рядом и укажи путь | сходство |
| Эталон (со 2-й позы) | утверждённый `pose-base.png` | единый стиль, одежда, рост |

## Шаг 1 — эталонная поза (base)

Подставь своё в три места: `ВНЕШНОСТЬ`, `ОДЕЖДА` и цвета. Остальное не трогай —
это требования движка, а не вкусовщина.

```
Flat vector illustration of a person, full character sticker, waist-up
to mid-thigh crop, centered on the canvas.

LIKENESS: base the face on the attached reference photo — <ВНЕШНОСТЬ: опиши
себя в 5-7 словах: форма лица, брови, причёска и её длина, борода или нет,
очки или нет>. Friendly and calm, not a caricature: simplified shapes, but
clearly recognizable as this person.

STYLE: modern flat vector / sticker illustration. Clean even outlines of
uniform weight, soft cell shading with two tones maximum, no gradients,
no texture, no noise. Calm muted palette. Think editorial app illustration,
not comic book, not 3D, not anime.

OUTFIT (identical in every pose): <ОДЕЖДА: один верх, один низ, два-три
цвета из палитры твоей темы, например «dark graphite hoodie (#2A2E35) over
a plain white tee, dark slim trousers»>. No logos, no text anywhere on the
clothing.

POSE: neutral standing, arms relaxed at the sides, facing the viewer,
weight even, calm confident expression, slight friendly smile.

COMPOSITION: full figure from the top of the head down to mid-thigh,
vertical canvas, figure centered horizontally, head near the top with a
small margin above it, no part of the body or hands cropped by the frame
edges. Both hands fully visible with five fingers each.

BACKGROUND: solid flat magenta #FF00FF, absolutely uniform, no shadow,
no ground plane, no contact shadow under the figure, no vignette.

Output: vertical image, high resolution.
```

**Почему фон магента, а не прозрачный:** внешние генераторы редко отдают
честную альфу, а белый фон нельзя вырезать, не съев белую футболку. Магенты нет
ни в коже, ни в одежде, ни в волосах — край получается чистым. Вырезает её в
альфу скрипт `tools/character-cutout.py`.

Цвета одежды возьми из палитры своей темы (`library/light-theme.md`), иначе
персонаж будет спорить с кадром. Если палитры ещё нет — любые два спокойных
цвета, главное записать их и дальше не менять.

## Шаг 2 — остальные девять поз

Тот же промпт, приложив утверждённый `pose-base.png` и заменив блок POSE.
Перед блоком POSE добавить:

```
Keep the attached character exactly as-is: same face, same hairstyle, same
outfit, same colors, same line style, same body proportions and the SAME
HEIGHT and scale on the canvas — only the pose and arms change.
```

| Файл | Смысл в ролике | POSE |
|---|---|---|
| `pose-welcome.png` | приветствие, открытие | both arms open wide to the sides, palms up, welcoming gesture, warm smile |
| `pose-wave.png` | привет зрителю | right hand raised near the head, waving hello, friendly smile |
| `pose-present-left.png` | показывает на объект слева | body slightly turned, left arm extended to the left, open palm presenting something off-frame, head turned to follow the hand |
| `pose-present-right.png` | показывает на объект справа | body slightly turned, right arm extended to the right, open palm presenting something off-frame, head turned to follow the hand |
| `pose-think-chin.png` | размышление | right hand touching the chin, head slightly tilted, thoughtful look, eyes slightly up |
| `pose-think-cross.png` | скепсис, взвешивание | arms crossed over the chest, head slightly tilted, skeptical evaluating expression |
| `pose-shrug.png` | «а чёрт знает» | both shoulders raised, elbows bent, palms up at waist level, puzzled expression with raised eyebrows |
| `pose-stop.png` | стоп, предупреждение | right palm facing the viewer in a stop gesture at chest height, serious expression |
| `pose-fists.png` | собранность, результат | both fists clenched at chest height, determined confident expression, slight forward lean |

## Приёмка — что смотреть глазами

Посмотри все десять, это пять минут, которые экономят переделку ролика. Брак
генерации, который ловится чаще всего:

- **лишние пальцы и обрезанные кисти** — в кадре ролика бросается сразу;
- **разный рост** между позами: положи две картинки рядом, макушка и линия
  плеч должны стоять на одной высоте;
- **уехавший оттенок одежды** — сверяй с эталоном, а не с памятью;
- **тень под фигурой** на фоне: её не должно быть вообще, иначе после
  вырезания останется серая грязь по контуру;
- **логотипы и надписи** на одежде — генерация любит их дорисовывать.

## Сборка: от картинок из генератора до файлов движка

Это делает агент, попроси его. По шагам:

1. вырезать магенту в альфу с антиалиасингом по краю —
   `python tools/character-cutout.py <папка с картинками>`;
2. привести все десять к единому холсту **1056×1140**, выравнивая по макушке
   и по центру, чтобы персонаж не прыгал при смене позы;
3. проверить каждую глазами и положить в `engine/public/shared/character/`
   поверх серых заглушек под точными именами `pose-*.png`;
4. отрендерить `DemoLight` и посмотреть, как персонаж стоит в реальном кадре:
   `cd engine && npx remotion render DemoLight ../out/demo-light.mp4`.

Пока своих поз нет, в папке лежат нейтральные серые силуэты — движок с ними
запускается и контрольный рендер проходит, но в ролик такое не выпустишь.
Перерисовать заглушки заново: `python tools/make-placeholder-poses.py`.
