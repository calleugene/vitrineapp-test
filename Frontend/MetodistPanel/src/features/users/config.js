export const USER_PROFILE_TABS = [
  {id: 'profile', title: 'Профиль'},
  {id: 'roles', title: 'Доступ и роли'},
  {id: 'museums', title: 'Музеи и коллекции'},
  {id: 'activity', title: 'Активность'},
];

export const PROFILE_ROLE_OPTIONS = [
  {value: 'methodist', content: 'Методист'},
  {value: 'museum_admin', content: 'Администратор музея'},
  {value: 'moderator', content: 'Модератор'},
];

export const PROFILE_LANGUAGE_OPTIONS = [
  {value: 'ru', content: 'Русский'},
  {value: 'en', content: 'English'},
];

export const PROFILE_GENDER_OPTIONS = [
  {value: 'female', content: 'Женский'},
  {value: 'male', content: 'Мужской'},
  {value: 'other', content: 'Не указан'},
];

export const PROFILE_TIMEZONE_OPTIONS = [
  {value: 'moscow', content: '(GMT+3) Москва'},
  {value: 'yekaterinburg', content: '(GMT+5) Екатеринбург'},
];

export const PROFILE_EXTRA_LANGUAGE_OPTIONS = [
  {value: 'en', content: 'Английский'},
  {value: 'de', content: 'Немецкий'},
  {value: 'fr', content: 'Французский'},
];

export const PROFILE_STATUS_OPTIONS = [
  {value: 'active', content: 'Активен'},
  {value: 'disabled', content: 'Отключён'},
];

export const USER_PROFILE_FALLBACKS = {
  firstName: 'Анна',
  lastName: 'Смирнова',
  email: 'anna.smirnova@mail.ru',
  phone: '+7 (916) 123-45-67',
  about: 'Занимаюсь разработкой и проверкой образовательного контента, курирую методические материалы для музеев.',
  registrationSource: 'Приглашение администратором',
};

export const USER_MUSEUM_ACCESS_LABELS = {
  edit: 'Редактирование',
  view: 'Просмотр',
};

export const USER_MUSEUM_ACCESS_THEMES = {
  edit: 'success',
  view: 'info',
};

