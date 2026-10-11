/* Тексты и константы фичи «Музеи».

   Единственное место, где живёт русский копирайт фичи: компоненты не содержат
   строковых литералов интерфейса (по образцу features/story/config.js). */

export const MUSEUM_LIST = {
  ariaLabel: 'Выбор музея',
  title: 'Музеи',
  subtitle: 'AR-маршруты и короткие истории экспонатов',
  searchLabel: 'Поиск музея',
  searchPlaceholder: 'Поиск музея',
  clearSearch: 'Очистить поиск',
  emptySearch: (query) => `Ничего не найдено по запросу «${query}»`,
};

export const MUSEUM_CARD = {
  completed: 'Пройден',
  meta: ({artifacts, minutes}) => `${artifacts} · ~${minutes || 0} мин`,
  progressLabel: (found, total) => `${found}/${total}`,
};

/* Формы счёта для «AR-артефакт»: 1 артефакт / 2 артефакта / 5 артефактов. */
export const ARTIFACT_PLURAL_FORMS = ['AR-артефакт', 'AR-артефакта', 'AR-артефактов'];

export const MUSEUM_DETAIL = {
  ariaLabel: 'Экран музея',
  loadingAriaLabel: 'Загрузка музея',
  infoButton: 'О музее',
  loading: 'Загружаем данные музея…',
  loadError: 'Не удалось загрузить музей',
  backToList: 'Вернуться к списку',
  foundWord: 'найдено',
  ofWord: 'из',
  minutes: (value) => `~${value || 0} мин`,
  progressAriaLabel: 'Прогресс по экспонатам',
  allFound: 'Все экспонаты собраны!',
  remaining: (left, percent) => `Осталось ${left} · ${percent}% выполнено`,
  enterCode: 'Ввести код экспоната',
};

export const MUSEUM_INFO = {
  ariaLabel: 'О музее',
  close: 'Закрыть',
  website: 'Открыть сайт музея',
};

export const ARTIFACT_ITEM = {
  found: 'Найдено',
  missing: 'Не найдено',
};

/* Ссылку на сайт музея открываем только по http(s): относительный адрес
   сломал бы переход, а произвольная схема — небезопасна. */
export const SAFE_EXTERNAL_PROTOCOLS = ['http:', 'https:'];
