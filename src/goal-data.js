// Таємні цілі: у майстра — усі (за героями, тобто за власником листа персонажа), у гравця — лише свої.
export const GOALS = "atmosfera.goals";                       // у майстра: { [власник листа]: [цілі] }
export const MINE = (room) => `atmosfera.my-goals.${room}.${owner()}`;   // у гравця: цілі його героя
export const OPENED = "atmosfera.goals-opened";               // у гравця: які печатки вже зламано
export const SHEETS = "com.nikita.character-sheet/sheets";

const read = (k, f) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
export const allGoals = () => read(GOALS, {});
export const saveAll = (g) => write(GOALS, g);
export const myGoals = (room) => read(MINE(room), []);
export const saveMine = (room, g) => write(MINE(room), g);
export const opened = () => new Set(read(OPENED, []));
export const markOpened = (id) => { const s = opened(); s.add(id); write(OPENED, [...s]); };
export const owner = () => { try { return localStorage.getItem("sheet-owner") || ""; } catch { return ""; } };
export const uid = () => "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const STATUS = { active: "Триває", claimed: "Чекає на майстра", done: "Виконано", failed: "Провалено" };

// гравцю — без таємної нотатки майстра і без чернеток
export const forPlayer = (list) => (list ?? []).filter((g) => g.sent).map(({ gm, ...g }) => g);

// Ідеї, щоб не починати з порожнього аркуша
export const IDEAS = [
  { title: "Борг крові", text: "Хтось на цьому кораблі винен тобі життя — і не знає про це. Зроби так, щоб до кінця подорожі він сам це визнав.", reward: "Натхнення і союзник, який не відмовить" },
  { title: "Чужий лист", text: "Знайди й тихо знищ листа з печаткою Церкви, перш ніж його прочитає хтось із команди.", reward: "Церква пам'ятатиме твою послугу" },
  { title: "Карта в рукаві", text: "Добудь щось цінне з чужої скрині так, щоб ніхто не помітив. Що саме — вирішиш сам.", reward: "Те, що взяв" },
  { title: "Мовчання", text: "Протягом трьох сесій жодного разу не розповідай нікому про свій сон. Навіть якщо спитають прямо.", reward: "Сон відкриє тобі ще одну частину" },
  { title: "Давня пісня", text: "Дізнайся, де Маркус уперше почув свою мелодію. Не питай його прямо.", reward: "Підказка до останнього уривка" },
  { title: "Слабке місце", text: "Дізнайся страх або слабкість одного з супутників і запиши її. Використовувати не обов'язково.", reward: "Перевага в одному кидку проти будь-кого з команди" },
  { title: "Ім'я на кораблі", text: "Переконай команду перейменувати корабель на твою честь або на честь того, кого ти втратив.", reward: "Корабель берегтиме тебе" },
  { title: "Ціна свободи", text: "Звільни когось, хто опинився в неволі, навіть якщо це затримає подорож.", reward: "Вірний NPC" },
];
