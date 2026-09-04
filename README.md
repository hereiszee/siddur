# סידור — a weekday siddur that knows what day it is

A mobile siddur for **weekday** tefillah that opens to the right service for the
time of day and quietly resolves everything that changes with the date — Ya'aleh
v'Yavo, Al HaNisim, the seasonal insertions, Hallel, Musaf, Tachanun, the shir
shel yom, and the Torah reading.

**→ https://hereiszee.github.io/siddur/**

Installable to a phone's home screen and fully offline after the first visit.

## What it does

**Works out the day.** The Hebrew date rolls over at nightfall, computed from
your actual location, so a maariv opened at 21:00 is already tomorrow's. Every
insertion is decided from that date plus whether you are in Israel.

**Opens to the right tefillah.** Shacharit until sof zman tefillah, then mincha
from mincha gedola, then maariv from tzeit — the same zmanim logic the header
shows, so you can see why. The tabs still let you go anywhere.

**Shows its work.** Nothing changes silently. A panel at the top lists what is
different about today and why:

> יַעֲלֶה וְיָבֹא — ראש חודש
> עַל הַנִּסִּים — חנוכה
> וְתֵן טַל וּמָטָר — מד׳/ה׳ בדצמבר
> אֵין תַּחֲנוּן — ראש חודש

Inside the text, an insertion that applies today is underlaid in gold, and
"הַצֵּג כָּל הַנֻּסָּחִים" reveals the alternatives it suppressed, struck
through — so you can check the siddur rather than trust it.

**Three nusachim.**

| In the app | Source text | Licence |
| --- | --- | --- |
| נוסח אשכנז | Siddur Ashkenaz — Metsudah siddur, 1981 | CC BY |
| נוסח ספרד | Siddur Sefard — Metsudah 1981 / Torat Emet | CC BY / public domain |
| עדות המזרח | Siddur Edot HaMizrach — Shaliehsaboo edition | CC0 |

**Torah reading.** Monday and Thursday, plus Rosh Chodesh, Chanukah, Chol
HaMoed and fast days, split into aliyot, in Tanach with Ta'amei Hamikra
(public domain) so the cantillation is there.

**Halachic notes.** The Metsudah text carries the printed instructions — what to
do if you forgot Ya'aleh v'Yavo, when to bow, when the chazan says what. They are
shown by default and can be switched off.

## The parts that took care

**Mashiv haruach and v'ten tal umatar are not the same season.** Both print as
בחורף / בימות הגשמים, but משיב הרוח begins at Musaf of Shemini Atzeret while
ותן טל ומטר waits until 7 Cheshvan in Israel, or the 4th/5th of December in the
diaspora — a gap of six weeks in which the siddur must say one and not the
other. The build tells them apart by what the text actually says rather than by
its label, and the December date is derived (it slides to the 5th in the civil
year before a leap year, and by a further day past 2100) rather than hard-coded.

**Alternates flow inside a beracha.** בָּרֵךְ עָלֵינוּ … וְתֵן / טַל וּמָטָר
לִבְרָכָה / עַל פְּנֵי הָאֲדָמָה is one sentence in three pieces. Choosing
between them has to happen inline or the beracha visibly breaks apart. Sefaria
also glues Ya'aleh v'Yavo's shared tail (זָכְרֵנוּ) onto the last of its
festival alternates, so the build splits it back out — otherwise on Rosh Chodesh
the beracha would stop mid-phrase.

**Tachanun is omitted on more days than anyone remembers.** The whole of Nisan,
Pesach Sheni, Lag BaOmer, up to 12 Sivan, 9 and 15 Av, from Yom Kippur to the end
of Tishrei, Chanukah, 15 Shvat, Purim and Purim Katan, erev Rosh Hashana, erev
Yom Kippur — and at mincha on the eve of any of them, except erev Rosh Chodesh.
The app names which one applies.

## What it does not do

- **No Shabbat and no Yom Tov davening.** This is a weekday siddur. It does
  cover Rosh Chodesh and Chol HaMoed in full, Musaf and Hallel included, since
  those fall on weekdays.
- **No Chabad.** Only the weekday Chabad siddur is freely licensed; shipping one
  nusach that cannot grow seemed worse than leaving it out.
- **No machzor**, no Selichot (see [Ashmoret Selichot](https://hereiszee.github.io/selichot-yamim-noraim/)).
- Each nusach here is **one printed edition**. Communities differ. Where a
  minhag splits, the app shows rather than decides. Follow your congregation.

## Typography

Body text is **Noto Sans Hebrew** (SIL OFL), chosen for legibility after
setting the candidates side by side at reading size — see
[`/specimen/`](https://hereiszee.github.io/siddur/specimen/). Noto Serif
Hebrew, Shofar and Frank Ruehl CLM are alternatives.

What the font can draw decided what could even be considered, and the
constraint is stricter than it looks:

- **Meteg is 3% of every letter in this text** — 18,290 of them. Assistant,
  Heebo, IBM Plex Sans Hebrew, David Libre, Alef and Rubik all omit it, and
  would have dropped every one silently.
- **The siddur body carries 19,754 cantillation marks**, not just the Torah
  reading: the Metsudah uses U+0592 as a shva-na marker, and the verses the
  siddur quotes — Shema, Ashrei, Az Yashir — keep their full ta'amim. So
  Frank Ruhl Libre and Tinos, which ship none of the 31, break the siddur
  itself and not only the leyning.

**Ashurit draws no points at all.** Stam Ashkenaz CLM maps every nikud and
ta'am to an *empty glyph* — present in the cmap, drawing nothing. That is
correct for a STA"M face, since a sefer Torah is unpointed, but it means
Ashurit cannot show ta'amei hamikra, and it must never be the body face: as a
body font it silently strips the vowels out of the siddur.

So Ashurit is a **Torah-reading mode** instead. The reading can be shown
pointed with ta'amim, in Ashurit as the sefer has it, or both at once — which
is what a tikkun korim is.

## On a phone

Installs to the homescreen as a standalone app: maskable icon, scoped
manifest, theme colour that follows light and dark, and safe-area insets so
the header clears the notch and the text clears the home indicator. Offline
after the first visit. There is an optional screen-wake toggle, because a
screen that sleeps in the middle of the Amidah is its own small problem.

A rail of landmarks — הַשְׁכָּמַת הַבֹּקֶר, פְּסוּקֵי דְזִמְרָא, עֲמִידָה, קְרִיאַת הַתּוֹרָה,
הַלֵּל, מוּסָף — sits on the left edge for jumping around a long service, and
tracks where you are; the header names the section you are in. "תֹּכֶן" opens
the full list.

## Layout

```
index.html          markup and styles
bundle.js           built from app/ -- commit it; GitHub Pages has no build step
sw.js               offline cache
app/
  day.js            the halachic day: which conditions hold, and why
  zmanim.js         zmanim, and which tefillah the clock is in
  leyning.js        resolving the day's Torah reading
  main.js           rendering
data/
  ashkenaz.json     } text, parsed into conditional items
  sefard.json       }
  edot.json         }
  outline.json      service order and section-level conditions
  leyning.json      Torah readings with ta'amim
fonts/              subset to Hebrew and converted to woff2
specimen/           the font comparison the default was chosen from
raw/                what was pulled from Sefaria, before parsing
tools/              the build
```

## Building

```bash
npm install
python3 tools/pull.py        # fetch from Sefaria (cached in .cache/)
python3 tools/build.py       # raw/ -> data/
python3 tools/outline.py     # service outlines
node tools/check.mjs         # calendar checks against known days
npx esbuild app/entry.js --bundle --format=iife --minify --target=es2019 --outfile=bundle.js
```

Add `?date=2026-12-11` to any URL to see another day — useful for checking what
is coming, and for verifying the rules.

## Credits

Texts via [Sefaria](https://www.sefaria.org/). Calendar by
[@hebcal/core](https://github.com/hebcal/hebcal-es6) and
[@hebcal/leyning](https://github.com/hebcal/hebcal-leyning); zmanim by
[kosher-zmanim](https://github.com/BehindTheMath/KosherZmanim). Fonts by the
Culmus project, GPL-2.0 with the font embedding exception.

This is a reading aid, not a posek.
