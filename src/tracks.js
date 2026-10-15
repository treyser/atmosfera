// Музика й фонові звуки для Hoot. Файли не лежать у репозиторії: збірка на GitHub завантажує їх
// за цими адресами (scripts/fetch-audio.mjs) і кладе поруч із сайтом у /audio/.
// Ліцензії: CC0 — без умов; CC-BY — треба згадати автора (список — у README).

// Міняється щоразу, коли змінюється список треків: пульт підкаже додати нові в Hoot
export const TRACKS_VERSION = "2026-10-15c";

export const MUSIC_VOL = 0.6;
export const BG_VOL = 0.35;

export const PL = {
  sea: "Атмосфера · Море (пісня)",
  mystery: "Атмосфера · Таємниця",
  storm: "Атмосфера · Шторм",
  rain: "Атмосфера · Дощ",
  night: "Атмосфера · Ніч",
  tavern: "Атмосфера · Таверна",
  battle: "Атмосфера · Бій (пригода)",
  boss: "Атмосфера · Бос (темний)",
  cold: "Атмосфера · Холод",
  tension: "Атмосфера · Напруга",
  waves: "Атмосфера · Фон: море",
  rainbg: "Атмосфера · Фон: дощ",
  thunder: "Атмосфера · Фон: гроза",
  wind: "Атмосфера · Фон: вітер",
  fire: "Атмосфера · Фон: вогонь",
};

export const TRACKS = [
  { pl: "sea", file: "sea-2.ogg", name: "A Sailor's Chant", author: "Thimras", license: "CC0",
    url: "https://opengameart.org/sites/default/files/oga_jam_menu_music_loopable_0.ogg", page: null },
  { pl: "mystery", file: "mystery-1.mp3", name: "Sirens in Darkness", author: "cynicmusic", license: "CC0",
    url: "https://opengameart.org/sites/default/files/012_Sirens_in_Darkness_0.mp3", page: "https://opengameart.org/content/sirens-in-darkness" },
  { pl: "mystery", file: "mystery-2.mp3", name: "Mysterious Ambience", author: "cynicmusic", license: "CC0",
    url: "https://opengameart.org/sites/default/files/song21_0.mp3", page: "https://opengameart.org/content/mysterious-ambience-song21" },
  { pl: "storm", file: "storm-1.mp3", name: "Battle Theme (Wolfgang)", author: "Wolfgang_", license: "CC0",
    url: "https://opengameart.org/sites/default/files/Battle.mp3", page: "https://opengameart.org/content/battle-theme-0" },
  { pl: "rain", file: "rain-1.ogg", name: "The Longing", author: "Ruhinre", license: "CC0",
    url: "https://opengameart.org/sites/default/files/longing.ogg", page: "https://opengameart.org/content/the-longing" },
  { pl: "night", file: "night-1.mp3", name: "Rising Moon", author: "RandomMind", license: "CC0",
    url: "https://opengameart.org/sites/default/files/Rising_Moon_0.mp3", page: "https://opengameart.org/content/fantasy-rising-moon" },
  { pl: "tavern", file: "tavern-1.mp3", name: "The Old Tower Inn", author: "RandomMind", license: "CC0",
    url: "https://opengameart.org/sites/default/files/The_Old_Tower_Inn.mp3", page: "https://opengameart.org/content/medieval-the-old-tower-inn" },
  { pl: "tavern", file: "tavern-2.mp3", name: "The Bard's Tale", author: "RandomMind", license: "CC0",
    url: "https://opengameart.org/sites/default/files/The_Bards_Tale.mp3", page: "https://opengameart.org/content/medieval-the-bards-tale" },
  // Бій: епічна пригодницька тема (Нікіті вона пасує до бою найбільше)
  { pl: "battle", file: "battle-1.mp3", name: "Chest of Adventure", author: "Eldritch Grim", license: "CC0",
    url: "https://opengameart.org/sites/default/files/chest_of_adventure.mp3", page: "https://opengameart.org/content/chest-of-adventure" },
  { pl: "boss", file: "boss-dark-1.mp3", name: "Omens", author: "Eliot Corley (el-corleo)", license: "CC-BY 3.0",
    url: "https://opengameart.org/sites/default/files/Omens.mp3", page: "https://opengameart.org/content/omens" },
  { pl: "boss", file: "boss-dark-2.mp3", name: "Final Confrontation", author: "tcarisland", license: "CC-BY 4.0",
    url: "https://opengameart.org/sites/default/files/final_confrontation_0.mp3", page: "https://opengameart.org/node/165847" },
  { pl: "cold", file: "cold-1.mp3", name: "Long Winter", author: "Indieteur", license: "CC0",
    url: "https://opengameart.org/sites/default/files/Long%20Winter_0.mp3", page: "https://opengameart.org/content/long-winter" },
  { pl: "cold", file: "cold-2.mp3", name: "Icy Realm", author: "cynicmusic (The Cynic Project)", license: "CC0",
    url: "https://opengameart.org/sites/default/files/019_seven_and_eight_7-8_combined_0.mp3", page: "https://opengameart.org/content/icy-realm-seven-and-eight" },
  { pl: "tension", file: "tension-1.ogg", name: "The Monster Factory", author: "Eric Matyas, Soundimage.org", license: "CC-BY 3.0",
    url: "https://opengameart.org/sites/default/files/the_monster_factory_looping_0.ogg", page: "https://opengameart.org/content/the-monster-factory-looping" },

  { pl: "waves", file: "waves-long.mp3", name: "Хвилі (5 хвилин)", author: "RandomMind", license: "CC0", bg: true,
    url: "https://opengameart.org/sites/default/files/VistulaShort_0.mp3", page: "https://opengameart.org/content/sea-and-river-wave-sounds" },
  { pl: "rainbg", file: "rain.ogg", name: "Дощ", author: "Ove Melaa", license: "CC0", bg: true,
    url: "https://opengameart.org/sites/default/files/Ove%20Melaa%20-%20Rainy%20%28NOT%20loopable%29%20Long%20Version.ogg", page: "https://opengameart.org/content/rain-ambient-not-loopable-2-versions-available" },
  { pl: "thunder", file: "thunder.wav", name: "Дощ і грім", author: "DoKashiteru", license: "CC-BY 3.0", bg: true,
    url: "https://opengameart.org/sites/default/files/rain_thunder_loop.wav", page: "https://opengameart.org/content/rain-and-thunder-loop" },
  { pl: "wind", file: "wind.ogg", name: "Вітер", author: "InspectorJ, AntumDeluge", license: "CC-BY 3.0", bg: true,
    url: "https://opengameart.org/sites/default/files/wind-01_0.ogg", page: "https://opengameart.org/content/wind-loop" },
  { pl: "fire", file: "fire.wav", name: "Вогонь у каміні", author: "PagDev", license: "CC0", bg: true,
    url: "https://opengameart.org/sites/default/files/fire.wav", page: "https://opengameart.org/content/fireplace-sound-loop" },
];

// Таємні звуки для уважних (не для Hoot — грає сама «Атмосфера»). Записи BigSoundBank (Joseph Sardin), CC0.
// off/dur — який шматок запису грати (секунди), gain — підсилення тихих записів.
export const SFX = [
  { k: "steps",   file: "sfx-steps.mp3",   off: 0,   dur: 5.0, gain: 1.6, name: "Man footsteps on the wooden floor",
    url: "https://bigsoundbank.com/UPLOAD/mp3/0165.mp3", page: "https://bigsoundbank.com/man-footsteps-on-the-wooden-floor-s0165.html" },
  { k: "creak",   file: "sfx-creak.mp3",   off: 0,   dur: 4.9, gain: 1.2, name: "Creaking door 3",
    url: "https://bigsoundbank.com/UPLOAD/mp3/3206.mp3", page: "https://bigsoundbank.com/creaking-door-3-s3206.html" },
  { k: "whisper", file: "sfx-whisper.mp3", off: 9.0, dur: 6.0, gain: 2.6, name: "Whisper 1",
    url: "https://bigsoundbank.com/UPLOAD/mp3/3255.mp3", page: "https://bigsoundbank.com/whisper-1-s3255.html" },
  { k: "knock",   file: "sfx-knock.mp3",   off: 2.9, dur: 3.9, gain: 0.9, name: "Knock on a light door",
    url: "https://bigsoundbank.com/UPLOAD/mp3/0374.mp3", page: "https://bigsoundbank.com/knock-on-a-light-door-s0374.html" },
  { k: "splash",  file: "sfx-splash.mp3",  off: 0,   dur: 3.3, gain: 0.8, name: "Splash big 1",
    url: "https://bigsoundbank.com/UPLOAD/mp3/1519.mp3", page: "https://bigsoundbank.com/splash-big-1-s1519.html" },
  { k: "metal",   file: "sfx-blade.mp3",   off: 0,   dur: 1.0, gain: 0.9, name: "Sword",
    url: "https://bigsoundbank.com/UPLOAD/mp3/0129.mp3", page: "https://bigsoundbank.com/sword-s0129.html" },
  { k: "growl",   file: "sfx-growl.mp3",   off: 0,   dur: 4.2, gain: 1.0, name: "Grunts",
    url: "https://bigsoundbank.com/UPLOAD/mp3/0486.mp3", page: "https://bigsoundbank.com/grunts-s0486.html" },
  { k: "breath",  file: "sfx-breath.mp3",  off: 3.5, dur: 6.5, gain: 2.0, name: "Man breathing",
    url: "https://bigsoundbank.com/UPLOAD/mp3/2195.mp3", page: "https://bigsoundbank.com/man-breathing-s2195.html" },
  { k: "dice",    file: "sfx-dice.mp3",    off: 0,   dur: 1.1, gain: 0.7, name: "Four dice on wooden table",
    url: "https://bigsoundbank.com/UPLOAD/mp3/0582.mp3", page: "https://bigsoundbank.com/four-dice-on-wooden-table-s0582.html" },
];

// Настрій сцени → музика й фонові звуки
export const BY_MOOD = {
  clear:    { music: "sea",     bg: ["waves"] },
  day:      { music: "sea",     bg: ["waves"] },
  rain:     { music: "rain",    bg: ["rainbg"] },
  storm:    { music: "storm",   bg: ["thunder", "wind"] },
  fog:      { music: "mystery", bg: ["waves"] },
  night:    { music: "night",   bg: ["waves"] },
  calm:     { music: "mystery", bg: [] },
  dusk:     { music: "night",   bg: ["waves"] },
  warm:     { music: "tavern",  bg: ["fire"] },
  frost:    { music: "cold",    bg: [] },
  blizzard: { music: "cold",    bg: ["wind"] },
  alarm:    { music: "tension", bg: [] },
  breach:   { music: "tension", bg: ["wind"] },
  core:     { music: "tension", bg: [] },
  surge:    { music: "tension", bg: [] },
};
