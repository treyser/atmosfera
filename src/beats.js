// Пригода «Плавання до Тихого моря»: які мапи є в сцені і які моменти показує пульт.
// Щоб переробити пульт під іншу пригоду, достатньо змінити цей файл.

// Ключ мапи → шматок її назви в сцені (регістр не важить). Назву видно в Outliner.
export const MAPS = {
  lobby:  "04 zastavka",
  world:  "map dn",
  day:    "01 korabel",
  calm:   "02 korabel",
  storm:  "03 korabel",
  hold:   "05 nyzhnia",
  battle: "06 biy",
  wreck:  "07 kladov",
};

// Місця. Мапи одного місця лежать одна на одній, і показується та, що зверху,
// тому токени на кораблі лишаються на своїх клітинках, коли міняється погода чи палуба.
export const PLACES = {
  lobby:  ["lobby"],
  world:  ["world"],
  ship:   ["day", "storm", "calm", "hold"],
  battle: ["battle"],
  wreck:  ["wreck"],
};

// Моменти по порядку. mood — id настрою зі state.js; big і small — титр (порожній big — без титру).
// grid — прозорість сітки: на ілюстраціях вона зайва, на бойових мапах ледь помітна.
export const BEATS = [
  { id: "lobby", grid: 0,   name: "Заставка",            map: "lobby",  mood: "day",   big: "Тихе море",           small: "Прокляття Неболіусу" },
  { id: "world", grid: 0,   name: "Мапа світу",          map: "world",  mood: "day",   big: "Курс на північ",      small: "Маршрут плавання" },
  { id: "day",     name: "Відкрите море",       map: "day",    mood: "day",   big: "Відкрите море",       small: "Попутний вітер" },
  { id: "hold",    name: "Під палубою",         map: "hold",   mood: "warm",  big: "Під палубою",         small: "" },
  { id: "volcano", name: "Повз вулкан",         map: "day",    mood: "dusk",  big: "Острів Вальтара",     small: "Вулкан по лівому борту" },
  { id: "storm",   name: "Шторм",               map: "storm",  mood: "storm", big: "Шторм",               small: "" },
  { id: "battle",  name: "Щось під водою",      map: "battle", mood: "rain",  big: "Щось під водою",      small: "" },
  { id: "calm",    name: "Штиль",               map: "calm",   mood: "calm",  big: "Тихе море",           small: "Вітер стих" },
  { id: "wreck",   name: "Кладовище кораблів",  map: "wreck",  mood: "calm",  big: "Там, де стоїть час",  small: "" },
];

export const placeOf = (mapKey) => Object.keys(PLACES).find((p) => PLACES[p].includes(mapKey));
