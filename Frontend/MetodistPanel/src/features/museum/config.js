/* Тексты и константы фичи «Профиль музея».

   Единственное место, где живёт русский копирайт фичи: компоненты не содержат
   строковых литералов интерфейса (по образцу config.js в Visitor/features/story). */

export const MUSEUM_HEADING = {
  title: 'Профиль музея',
  description: 'Управляйте информацией о музее. Эти данные отображаются для посетителей.',
  createHint: 'Создайте профиль, чтобы посетители увидели ваш музей и его экспонаты в приложении.',
};

export const MUSEUM_PROFILE_LOAD = {
  loading: 'Загружаем профиль музея…',
  retry: 'Повторить загрузку',
};

export const MUSEUM_EMPTY = {
  title: 'Музей ещё не создан',
  text: 'Заполните профиль музея. После создания ему будет автоматически присвоен уникальный код.',
  action: 'Создать музей',
};

export const MUSEUM_INFO_CARD = {
  title: 'Основная информация',
  nameLabel: 'Название музея *',
  codeLabel: 'Уникальный код музея *',
  codeNote: 'Код присваивается автоматически при регистрации музея.',
  descriptionLabel: 'Краткое описание',
  descriptionLimit: 500,
  websiteLabel: 'Сайт музея',
  websiteError: 'Укажите адрес сайта — например, shm.ru или https://shm.ru',
  addressLabel: 'Адрес',
  note: 'Эта информация будет отображаться в карточке вашего музея для посетителей.',
  descriptionCounter: (length, limit) => `${length} / ${limit}`,
};

/* UI uses a museum photograph; logo_url remains a compatible API field. */
export const MUSEUM_LOGO = {
  title: 'Изображение музея',
  pickLabel: 'Выбрать изображение музея',
  removeLabel: 'Удалить изображение',
  upload: 'Загрузить фото',
  placeholder: 'Перетащите изображение сюда или выберите файл вручную.',
  note: 'JPG, PNG или WebP · до 10 МБ. Рекомендуем горизонтальное фото от 1200×675 px.',
  previewAlt: 'Изображение музея',
  badge: {
    saved: 'Текущее изображение',
    selected: 'Новый файл',
    empty: 'Фото не загружено',
  },
  status: {
    saved: 'Сохранён в профиле',
    selected: 'Файл выбран',
    empty: 'Файл не выбран',
  },
  errors: {
    type: 'Выберите фотографию в формате JPG, PNG или WebP.',
    size: (limitMb) => `Файл больше ${limitMb} МБ. Выберите изображение меньшего размера.`,
  },
};

export const MUSEUM_ACTIONS = {
  cancel: 'Отмена',
  save: 'Сохранить изменения',
};

export const MUSEUM_CREATE = {
  title: 'Создать музей',
  intro: 'Укажите данные, которые будут видны посетителям. Код вида GIM-0001 сформируется автоматически.',
  apply: 'Создать музей',
  cancel: 'Отменить',
};

export const MUSEUM_ERRORS = {
  load: 'Не удалось загрузить профиль музея. Проверьте подключение и повторите попытку.',
  loadUnauthorized: 'Нет доступа к профилю музея. Войдите заново и повторите попытку.',
  save: 'Не удалось сохранить профиль музея. Попробуйте ещё раз.',
  unauthorized: 'Сессия истекла или нет доступа к музею. Адрес и другие изменения не сохранены. Войдите заново и повторите сохранение.',
};

export const MUSEUM_LOGO_ACCEPT = ['image/png', 'image/jpeg', 'image/webp'];
export const MUSEUM_LOGO_MAX_MB = 10;
