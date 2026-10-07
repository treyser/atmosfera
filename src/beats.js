// Пригоди для пульта режисера. Кожна описує, які мапи лежать у її сцені й які моменти показує пульт.
// Пульт сам упізнає пригоду: бере ту, чиїх мап у відкритій сцені найбільше.
//
// maps   — ключ мапи → шматок її назви в сцені (регістр не важить). Назву видно в Outliner.
// places — місця. Мапи одного місця лежать одна на одній, і показується та, що зверху,
//          тому токени лишаються на своїх клітинках, коли міняється погода, палуба чи вагон.
// beats  — моменти по порядку. mood — id настрою зі state.js; big і small — титр (порожній big — без титру);
//          grid — прозорість сітки: на ілюстраціях вона зайва, на бойових мапах ледь помітна.

const sea = {
  id: "sea",
  name: "Тихе море",
  maps: {
    lobby:  "04 zastavka",
    world:  "map dn",
    day:    "01 korabel",
    calm:   "02 korabel",
    storm:  "03 korabel",
    hold:   "05 nyzhnia",
    battle: "06 biy",
    wreck:  "07 kladov",
  },
  places: {
    lobby:  ["lobby"],
    world:  ["world"],
    ship:   ["day", "storm", "calm", "hold"],
    battle: ["battle"],
    wreck:  ["wreck"],
  },
  beats: [
    { id: "lobby",   name: "Заставка",            map: "lobby",  mood: "day",   grid: 0, big: "Тихе море",           small: "Прокляття Неболіусу" },
    { id: "world",   name: "Мапа світу",          map: "world",  mood: "day",   grid: 0, big: "Курс на північ",      small: "Маршрут плавання" },
    { id: "day",     name: "Відкрите море",       map: "day",    mood: "day",   big: "Відкрите море",       small: "Попутний вітер" },
    { id: "hold",    name: "Під палубою",         map: "hold",   mood: "warm",  big: "Під палубою",         small: "" },
    { id: "volcano", name: "Повз вулкан",         map: "day",    mood: "dusk",  big: "Острів Вальтара",     small: "Вулкан по лівому борту" },
    { id: "storm",   name: "Шторм",               map: "storm",  mood: "storm", big: "Шторм",               small: "" },
    { id: "battle",  name: "Щось під водою",      map: "battle", mood: "rain",  big: "Щось під водою",      small: "" },
    { id: "calm",    name: "Штиль",               map: "calm",   mood: "calm",  big: "Тихе море",           small: "Вітер стих" },
    { id: "wreck",   name: "Кладовище кораблів",  map: "wreck",  mood: "calm",  big: "Там, де стоїть час",  small: "" },
  ],
};

// «Полярний експрес»: одинадцять актів сценарію. Усі вагони лежать одним стосом,
// тож партія «йде вперед» складом, а камера й токени лишаються на місці.
const express = {
  id: "express",
  name: "Полярний експрес",
  maps: {
    lobby:   "pe 01",
    world:   "map dn",
    coach:   "pe 02",
    alarm:   "pe 03",
    dining:  "pe 04",
    cargo:   "pe 05",
    roof:    "pe 06",
    service: "pe 07",
    engine:  "pe 08",
    after:   "pe 09",
  },
  places: {
    lobby: ["lobby"],
    world: ["world"],
    train: ["coach", "alarm", "dining", "cargo", "roof", "service", "engine"],
    after: ["after"],
  },
  beats: [
    { id: "lobby",   name: "Заставка",              map: "lobby",   mood: "blizzard", grid: 0, big: "Полярний експрес",   small: "Потяг не повинен зупинитися" },
    { id: "world",   name: "Мапа світу",            map: "world",   mood: "day",      grid: 0, big: "Новий континент",    small: "Колія до Білого Пределу" },
    { id: "first",   name: "I · Перший потяг",      map: "coach",   mood: "warm",     big: "Перший потяг",       small: "" },
    { id: "wastes",  name: "II · Морозні Пустки",   map: "coach",   mood: "frost",    big: "Морозні Пустки",     small: "Кілька годин у дорозі" },
    { id: "silence", name: "III · Тиша",            map: "alarm",   mood: "alarm",    big: "Тиша",               small: "Захисний контур втрачено" },
    { id: "breach",  name: "IV · Прорив",           map: "alarm",   mood: "breach",   big: "Прорив",             small: "" },
    { id: "dining",  name: "V · Вагон-ресторан",    map: "dining",  mood: "alarm",    big: "Через вагони",       small: "Вагон-ресторан" },
    { id: "cargo",   name: "V · Вантажний вагон",   map: "cargo",   mood: "breach",   big: "Вантажний вагон",    small: "Печатка Білого Пределу" },
    { id: "roof",    name: "VI · Дах",              map: "roof",    mood: "blizzard", big: "Дах",                small: "" },
    { id: "service", name: "VII · Сервісний вагон", map: "service", mood: "alarm",    big: "Сервісний вагон",    small: "" },
    { id: "brakes",  name: "VIII · Потяг не гальмує", map: "service", mood: "alarm",  big: "Потяг не гальмує",   small: "Десять раундів до Північного Хребта" },
    { id: "engine",  name: "IX · Локомотив",        map: "engine",  mood: "core",     big: "Локомотив",          small: "" },
    { id: "final",   name: "X · Фінальний прорив",  map: "engine",  mood: "surge",    big: "Фінальний прорив",   small: "Північний Хребет" },
    { id: "after",   name: "XI · Після бурі",       map: "after",   mood: "day",      grid: 0, big: "Після бурі",  small: "" },
  ],
};

export const ADVENTURES = [sea, express];

export const placeOf = (adventure, mapKey) =>
  Object.keys(adventure.places).find((p) => adventure.places[p].includes(mapKey));
