// Мелодія Маркуса: шість нот на п'ять різних висот. Гравці чують її уривками в дорозі,
// а в Ребрах Велетня мають відтворити її, торкаючись предметів — нот знати не треба, лише слухати.

const hz = (semitonesFromA4) => 440 * 2 ** (semitonesFromA4 / 12);
export const PITCH = { A4: hz(0), C5: hz(3), D5: hz(5), E5: hz(7), F5: hz(8) };

// Ноти мелодії і скільки звучить кожна (в секундах)
export const MELODY = [
  { p: "A4", d: 0.42 },
  { p: "D5", d: 0.5 },
  { p: "C5", d: 0.32 },
  { p: "F5", d: 0.62 },
  { p: "E5", d: 0.34 },
  { p: "D5", d: 1.0 },
];

// Три уривки по дві ноти: гравці збирають їх протягом плавання
export const FRAGMENTS = [[0, 1], [2, 3], [4, 5]];

// Предмети в Ребрах Велетня: кожен звучить однією нотою мелодії, але своїм голосом
export const OBJECTS = [
  { id: "bell",  name: "Дзвін", note: "E5", voice: "bell" },
  { id: "rope",  name: "Снасть", note: "C5", voice: "rope" },
  { id: "shell", name: "Мушля", note: "A4", voice: "shell" },
  { id: "wind",  name: "Порожнє ребро", note: "F5", voice: "wind" },
  { id: "bone",  name: "Кістка", note: "D5", voice: "bone" },
];

// Правильна відповідь — предмети по порядку нот мелодії
export const ANSWER = MELODY.map((m) => OBJECTS.find((o) => o.note === m.p).id);
