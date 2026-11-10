# Промпт для генерации персонажа светлой темы

Персонаж Sticker Light — рисованная версия автора. Десять поз, один стиль,
один рост. Требования движка — `engine/public/shared/character/README.md`.

**Порядок работы — двухэтапный, одной пачкой не генерить.** Сначала делается
эталонная поза `base`, автор её утверждает, и дальше каждая следующая поза
генерится **с приложением утверждённого эталона как референса**. Иначе
от позы к позе плывут лицо, одежда и рост — а движок переключает позы
встык, и в кадре это выглядит как разные люди.

## Что приложить к генерации

| Референс | Файл | Зачем |
|---|---|---|
| Своё лицо, фронтальное фото | положи рядом и укажи путь | сходство |
| Эталон (со 2-й позы) | утверждённый `pose-base.png` | единый стиль, одежда, рост |

## Шаг 1 — эталонная поза (base)

```
Flat vector illustration of a young man, full character sticker, waist-up
to mid-thigh crop, centered on the canvas.

LIKENESS: base the face on the attached reference photo — slim oval face,
narrow chin, straight dark eyebrows, very short buzz-cut dark hair, light
skin, clean-shaven. Friendly and calm, not a caricature: simplified shapes,
but clearly recognizable as this person.

STYLE: modern flat vector / sticker illustration. Clean even outlines of
uniform weight, soft cell shading with two tones maximum, no gradients,
no texture, no noise. Calm muted palette. Think editorial app illustration,
not comic book, not 3D, not anime.

OUTFIT (identical in every pose): dark graphite hoodie (#2A2E35) over a
plain white tee, emerald green drawstrings and cuff accent (#12B76A),
dark slim trousers. No logos, no text anywhere on the clothing.

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
честную альфу, а белый фон нельзя вырезать, не съев белую футболку. Магенты
нет ни в коже, ни в одежде — вырезается чисто. Альфу делаю я скриптом.

## Шаг 2 — остальные девять поз

Тот же промпт, приложив утверждённый `pose-base.png`, и заменив блок POSE.
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

Брак генерации, который ловится чаще всего:

- **лишние пальцы и обрезанные кисти** — в кадре ролика бросается сразу;
- **разный рост** между позами: положи две картинки рядом, макушка и линия
  плеч должны стоять на одной высоте;
- **уехавший оттенок худи** — сверяй с эталоном, а не с памятью;
- **тень под фигурой** на фоне: её не должно быть вообще, иначе после
  вырезания останется серая грязь по контуру;
- **логотипы и надписи** на одежде — генерация любит их дорисовывать.

## Что делаю я после

Файлы кладёшь в Загрузки (см. память `oblozhki-iz-zagruzok`), дальше моя часть:

1. вырезаю магенту в альфу с антиалиасингом по краю;
2. привожу все десять к единому холсту **1056×1140**, выравнивая по макушке
   и по центру, чтобы персонаж не прыгал при смене позы;
3. проверяю каждую глазами и кладу в `engine/public/shared/character/`
   поверх заглушек под точными именами `pose-*.png`;
4. рендерю `DemoLight` и показываю, как персонаж стоит в реальном кадре.
