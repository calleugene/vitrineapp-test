import {
  BookOpen,
  Boxes3,
  ChartPie,
  Clock,
  Eye,
  House,
  LayoutCells,
  Lock,
  Megaphone,
  Person,
  Persons,
  Play,
  Route as RouteIcon,
  SquareChartBar,
  Stopwatch,
  Text,
  Volume,
} from '@gravity-ui/icons';

export const NAV_ITEMS = [
  {id: 'dashboard', label: 'Главная', icon: House},
  {id: 'museum', label: 'Профиль музея', icon: BookOpen},
  {id: 'routes', label: 'Маршруты', icon: RouteIcon},
  {id: 'artifacts', label: 'Артефакты', icon: Boxes3},
  {id: 'visitors', label: 'Посетители', icon: Persons},
  {id: 'stats', label: 'Статистика', icon: SquareChartBar},
  {id: 'feedback', label: 'Обратная связь', icon: Megaphone},
];

export const ARTIFACT_TABS = [
  {id: 'all', title: 'Все артефакты'},
  {id: 'published', title: 'Опубликованные'},
  {id: 'draft', title: 'Черновики'},
  {id: 'archive', title: 'Архив'},
];

export const ROUTE_TABS = [
  {id: 'all-routes', title: 'Все маршруты'},
  {id: 'published-routes', title: 'Опубликованные'},
  {id: 'draft-routes', title: 'Черновики'},
  {id: 'archive-routes', title: 'Архив'},
];

export const CATEGORY_OPTIONS = [
  {value: 'letters', content: 'Письма и документы'},
  {value: 'photo', content: 'Фотографии'},
  {value: 'items', content: 'Личные вещи'},
  {value: 'audio', content: 'Аудио и видео'},
];

export const ORDER_OPTIONS = [
  {value: 'step-2', content: 'Шаг 2 из 7'},
  {value: 'step-3', content: 'Шаг 3 из 7'},
  {value: 'step-4', content: 'Шаг 4 из 7'},
];

export const SESSION_STORAGE_KEY = 'vira-methodist-session';

export const ARTIFACT_STATUS_LABELS = {
  draft: 'Черновик',
  moderation: 'На модерации',
  published: 'Опубликован',
  archived: 'Архив',
};

export const ARTIFACT_STATUS_THEMES = {
  draft: 'warning',
  moderation: 'info',
  published: 'success',
  archived: 'utility',
};

export const SCREEN_TYPE_BY_EDITOR = {
  'editor-text': 'text-photo',
  'editor-quiz': 'quiz',
  'editor-model': 'model-3d',
  'editor-audio': 'audio-photo',
};

export const ARTIFACT_PUBLISH_STATUSES = ['draft', 'moderation', 'published'];
export const ARTIFACT_VISIBILITY_VALUES = ['public', 'team'];
export const ARTIFACT_ROUTE_ACCESS_VALUES = ['selected', 'all'];
export const ARTIFACT_SCREEN_STATUSES = ['draft', 'ready', 'error'];

export const SCREEN_TYPES = [
  {
    id: 'editor-text',
    title: 'Текст + Фото',
    description: 'Расскажите историю с помощью текста и изображений',
  },
  {
    id: 'editor-quiz',
    title: 'Тест',
    description: 'Задайте вопрос посетителю и предложите варианты ответов',
  },
  {
    id: 'editor-model',
    title: '3D-модель',
    description: 'Покажите интерактивную 3D-модель экспоната',
  },
  {
    id: 'editor-audio',
    title: 'Аудио + Фото',
    description: 'Дополните историю аудиозаписью и изображением',
  },
];

export const SCREEN_STATUS_META = {
  draft: {label: 'Черновик', tone: 'draft'},
  ready: {label: 'Готов', tone: 'ready'},
  error: {label: 'Ошибка контента', tone: 'error'},
};

export const SCREEN_KIND_META = {
  system: {
    label: 'Системный',
    previewLabel: 'Служебный экран',
    icon: Lock,
  },
  'editor-text': {
    label: 'Текст + Фото',
    previewLabel: 'История',
    icon: Text,
  },
  'editor-quiz': {
    label: 'Тест',
    previewLabel: 'Вопрос',
    icon: LayoutCells,
  },
  'editor-model': {
    label: '3D-модель',
    previewLabel: '3D-сцена',
    icon: Play,
  },
  'editor-audio': {
    label: 'Аудио + Фото',
    previewLabel: 'Аудиоистория',
    icon: Volume,
  },
};

export const ROUTE_DRAFT_STORAGE_KEY = 'vira-methodist-route-draft';

export const INITIAL_ARTIFACT_SCREENS = [
  {
    id: 'system-start',
    title: 'QR у экспоната',
    subtitle: 'Системный стартовый экран',
    body: 'Наведите камеру на QR-код',
    editor: null,
    locked: true,
    status: 'ready',
    kind: 'system',
    textLines: ['Наведите камеру на QR-код', 'Система распознает экспонат автоматически'],
    mediaCount: 1,
    audioCount: 0,
  },
  {
    id: 'system-finish',
    title: 'Добавлен в коллекцию',
    subtitle: 'Системный финальный экран',
    body: 'Артефакт добавлен в коллекцию',
    editor: null,
    locked: true,
    status: 'draft',
    kind: 'system',
    textLines: ['Артефакт сохранён', 'Продолжите исследование коллекции'],
    mediaCount: 1,
    audioCount: 0,
  },
];

export const DASHBOARD_STATS = [
  {value: '1 248', title: 'Количество посетителей за месяц', delta: '+18% к прошлому месяцу'},
  {value: '18 мин', title: 'Среднее время маршрута', delta: '+2 мин к прошлому месяцу'},
  {value: '87%', title: 'Средний прогресс', delta: '+5% к прошлому месяцу'},
  {value: '4.8', title: 'Оценка музея', delta: '+0.3 по отзывам'},
];

export const POPULAR_ROUTES = [
  {
    rank: 1,
    title: 'Письма с фронта',
    description: 'Маршрут о личных историях и фронтовых письмах',
    visits: '1 024 посещения',
    progress: 92,
    delta: '+18%',
  },
  {
    rank: 2,
    title: 'История города в письмах',
    description: 'Городские хроники 1940-х в интерактивном формате',
    visits: '812 посещений',
    progress: 74,
    delta: '+12%',
  },
  {
    rank: 3,
    title: 'Война глазами детей',
    description: 'Детские дневники и письма военного времени',
    visits: '624 посещения',
    progress: 58,
    delta: '-4%',
  },
];

export const RECENT_ACTIVITY = [
  {
    title: 'Маршрут «Письма с фронта» опубликовали',
    meta: 'Сегодня, 12:45',
  },
  {
    title: 'Добавлен артефакт «Письмо от 12.04.1943»',
    meta: 'Сегодня, 10:20',
  },
  {
    title: 'Команда «Школьники 9Б» завершила маршрут',
    meta: 'Вчера, 16:40',
  },
  {
    title: 'Новый отзыв от посетителя',
    meta: '12 мая, 18:32',
  },
];

export const FEEDBACK_ITEMS = [
  {
    title: 'Новая заявка на маршрут',
    subtitle: 'Школа №124, 7 класс',
    meta: 'Сегодня, 09:10',
  },
  {
    title: 'Вопрос по артефакту',
    subtitle: 'От посетителя Ивана П.',
    meta: 'Сегодня, 11:25',
  },
  {
    title: 'Предложение по улучшению',
    subtitle: 'От посетителя Марии К.',
    meta: '11 мая, 17:48',
  },
];

export const MUSEUM_PROFILE_STATS = [
  {title: 'Артефактов', value: '248'},
  {title: 'Маршрутов', value: '16'},
  {title: 'Посетителей', value: '12 540'},
];

export const VISITOR_STATS = [
  {icon: Persons, value: '1 248', title: 'Всего посетителей', delta: '+18% к прошлому месяцу', tone: 'violet'},
  {icon: Person, value: '342', title: 'Новые посетители', delta: '+12% к прошлому месяцу', tone: 'green'},
  {icon: Stopwatch, value: '18 мин', title: 'Среднее время на маршруте', delta: '+2 мин к прошлому месяцу', tone: 'amber'},
  {icon: Eye, value: '3 826', title: 'Просмотров артефактов', delta: '+25% к прошлому месяцу', tone: 'blue'},
];

export const VISITORS_DYNAMICS = {
  day: {
    visitors: [86, 124, 98, 142, 118, 164, 136],
    newVisitors: [24, 38, 29, 42, 34, 51, 39],
    labels: ['9:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00'],
  },
  week: {
    visitors: [420, 310, 270, 590, 390, 340, 605],
    newVisitors: [120, 96, 84, 168, 132, 115, 176],
    labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  },
  month: {
    visitors: [420, 310, 270, 590, 390, 340, 605, 430, 648, 518, 702],
    newVisitors: [120, 96, 84, 168, 132, 115, 176, 138, 190, 154, 208],
    labels: ['14 апр', '17 апр', '19 апр', '23 апр', '24 апр', '29 апр', '3 мая', '4 мая', '9 мая', '10 мая', '14 мая'],
  },
  year: {
    visitors: [1820, 1640, 1710, 2140, 2480, 2310, 2860, 2940, 3180, 3360, 3520, 3890],
    newVisitors: [510, 472, 488, 620, 701, 664, 812, 838, 914, 966, 1012, 1124],
    labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  },
};

export const VISITOR_SOURCES = [
  {label: 'Прямые переходы', value: 45, count: 562, color: '#6A63FF'},
  {label: 'QR-коды', value: 30, count: 374, color: '#52C7EA'},
  {label: 'Социальные сети', value: 15, count: 187, color: '#F2CF63'},
  {label: 'Сайты и ссылки', value: 10, count: 125, color: '#FFB45B'},
];

export const VISITOR_ROWS = [
  {
    name: 'Иван Петров',
    route: 'Письма с фронта',
    firstVisit: '14.05.2024, 12:45',
    duration: '22 мин',
    collectedArtifacts: '24',
    routeCompleted: '7 экранов',
  },
  {
    name: 'Мария Иванова',
    route: 'История города',
    firstVisit: '14.05.2024, 11:20',
    duration: '15 мин',
    collectedArtifacts: '17',
    routeCompleted: '5 экранов',
  },
  {
    name: 'Алексей Смирнов',
    route: 'Великая Отечественная война',
    firstVisit: '14.05.2024, 10:05',
    duration: '28 мин',
    collectedArtifacts: '31',
    routeCompleted: '9 экранов',
  },
];

export const VISITOR_TABLE_COLUMNS = [
  {id: 'name', title: 'Посетитель'},
  {id: 'route', title: 'Маршрут'},
  {id: 'firstVisit', title: 'Первое посещение'},
  {id: 'duration', title: 'Время на маршруте'},
  {id: 'collectedArtifacts', title: 'Собрано артефактов'},
  {id: 'routeCompleted', title: 'Маршрут пройден'},
];

export const ROUTE_ROWS = [
  {title: 'Письма с фронта', subtitle: 'Истории солдат в письмах', status: 'Опубликован', artifacts: '12', updated: '12 мая 2024', views: '824'},
  {title: 'История города в письмах', subtitle: 'Городские хроники 1940-х', status: 'Опубликован', artifacts: '15', updated: '9 мая 2024', views: '642'},
  {title: 'Война глазами детей', subtitle: 'Детские дневники и письма', status: 'Опубликован', artifacts: '10', updated: '1 мая 2024', views: '532'},
  {title: 'Покорение космоса', subtitle: 'История великих достижений', status: 'Черновик', artifacts: '8', updated: '7 мая 2024', views: '—'},
  {title: 'Музей за один час', subtitle: 'Краткий обзор экспозиции', status: 'Черновик', artifacts: '7', updated: '3 мая 2024', views: '—'},
  {title: 'Женщины в истории', subtitle: 'Подвиги и достижения', status: 'Архив', artifacts: '9', updated: '15 апр 2024', views: '218'},
];

export const ARTIFACT_CARDS = [
  {
    title: 'Письмо с фронта',
    description: 'Истории солдат в письмах',
    status: 'Опубликован',
    date: '12 мая 2024',
  },
  {
    title: 'История города в письмах',
    description: 'Городские хроники 1940-х',
    status: 'Опубликован',
    date: '9 мая 2024',
  },
  {
    title: 'Война глазами детей',
    description: 'Детские дневники и письма',
    status: 'Опубликован',
    date: '1 мая 2024',
  },
  {
    title: 'Покорение космоса',
    description: 'История великих достижений',
    status: 'Черновик',
    date: '7 мая 2024',
  },
  {
    title: 'Музей за один час',
    description: 'Краткий обзор экспозиции',
    status: 'Опубликован',
    date: '3 мая 2024',
  },
  {
    title: 'Женщины в истории',
    description: 'Их подвиги и достижения',
    status: 'Опубликован',
    date: '15 апр 2024',
  },
];

export const ATTENDANCE_SERIES = {
  week: {
    labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    values: [210, 248, 236, 275, 294, 332, 318],
    note: 'Суббота - пик посещаемости. Добавьте больше командных маршрутов на выходные.',
  },
  month: {
    labels: ['16 апр', '19 апр', '23 апр', '26 апр', '30 апр', '3 мая', '7 мая', '10 мая', '14 мая'],
    values: [280, 190, 430, 310, 470, 325, 505, 360, 645],
    note: '14 мая - пик посещаемости. Рекомендуем обновить главную витрину.',
  },
  year: {
    labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    values: [1800, 1940, 2210, 2460, 2730, 2620, 2880, 3010, 3260, 3480, 3710, 3960],
    note: 'Осенью ожидается рост интереса. Подготовьте тематические подборки к новому сезону.',
  },
};

export const ARTIFACT_WIZARD_VIEWS = ['artifact-basic', 'artifact-content', 'artifact-publish'];
export const ROUTE_WIZARD_VIEWS = ['route-basic', 'route-content', 'route-publish', 'route-success'];

export const USER_PROFILE_TABS = [
  {id: 'profile', title: 'Профиль'},
  {id: 'roles', title: 'Доступ и роли'},
  {id: 'museums', title: 'Музеи и коллекции'},
  {id: 'activity', title: 'Активность'},
];

export const USER_MUSEUM_ACCESS = [
  {name: 'Музей истории города', city: 'Санкт-Петербург', status: 'Редактирование'},
  {name: 'Музей Победы', city: 'Москва', status: 'Редактирование'},
  {name: 'Эрмитаж', city: 'Санкт-Петербург', status: 'Просмотр'},
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

export const ARTIFACT_CATEGORY_SUMMARY = [
  {value: 'all', label: 'Все категории', count: 43},
  {value: 'letters', label: 'Письма и документы', count: 18},
  {value: 'photo', label: 'Фотографии', count: 12},
  {value: 'items', label: 'Личные вещи', count: 7},
  {value: 'audio', label: 'Аудио и видео', count: 6},
];

export const MOCK_AUTH_CREDENTIALS = {
  email: 'test@mail.ru',
  password: 'test',
};

export const MOCK_AUTH_USER = {
  id: 'mock_usr_001',
  email: MOCK_AUTH_CREDENTIALS.email,
  full_name: 'Тестович Тестов',
  role: 'methodist',
  museumId: 'mock_museum_001',
  status: 'active',
};

export const STATS_TABS = [
  {id: 'overview', title: 'Обзор'},
  {id: 'visitors', title: 'Посетители'},
  {id: 'content', title: 'Контент'},
  {id: 'routes', title: 'Маршруты'},
  {id: 'stories', title: 'Истории'},
  {id: 'artifacts', title: 'Артефакты'},
  {id: 'feedback', title: 'Обратная связь'},
];

export const STATS_SUMMARY = [
  {title: 'Посетители', value: '12 846', delta: '+18%', note: 'по сравнению с 12 апр — 11 мая', icon: Persons, tone: 'violet'},
  {title: 'Просмотры контента', value: '28 562', delta: '+22%', note: 'по сравнению с 12 апр — 11 мая', icon: Eye, tone: 'blue'},
  {title: 'Среднее время в приложении', value: '18 мин', delta: '+2 мин', note: 'по сравнению с 12 апр — 11 мая', icon: Clock, tone: 'green'},
  {title: 'Оценка музея', value: '4.8', delta: '+0.3', note: 'по сравнению с 12 апр — 11 мая', icon: ChartPie, tone: 'amber'},
];

export const STATS_VISITOR_SERIES = {
  day: {
    labels: ['12 мая', '16 мая', '19 мая', '23 мая', '26 мая', '30 мая', '2 июн', '7 июн', '9 июн'],
    values: [920, 1280, 940, 1710, 810, 1690, 980, 1987, 1320],
  },
  week: {
    labels: ['1 нед', '2 нед', '3 нед', '4 нед', '5 нед'],
    values: [4230, 4780, 5120, 4860, 5610],
  },
  month: {
    labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'],
    values: [8140, 8920, 9440, 10180, 12846, 11920],
  },
};

export const STATS_TRAFFIC_SOURCES = [
  {label: 'Прямые переходы', value: 37, count: '4 823', color: '#5A4FF6'},
  {label: 'Поисковые системы', value: 31, count: '3 954', color: '#4D7EF1'},
  {label: 'Социальные сети', value: 21, count: '2 781', color: '#63C987'},
  {label: 'Сайты музея', value: 7, count: '876', color: '#FFB01F'},
  {label: 'Прочее', value: 4, count: '412', color: '#D2D5DE'},
];

export const STATS_POPULAR_ROUTES = [
  {rank: 1, title: 'Письма с фронта', views: '4 562', delta: '+15%', tone: 'positive'},
  {rank: 2, title: 'Подвиг народа', views: '3 284', delta: '+11%', tone: 'positive'},
  {rank: 3, title: 'Истории города', views: '2 491', delta: '+8%', tone: 'positive'},
  {rank: 4, title: 'Детство в войну', views: '1 876', delta: '+6%', tone: 'positive'},
  {rank: 5, title: 'Женщины на войне', views: '1 529', delta: '-3%', tone: 'negative'},
];

export const STATS_POPULAR_STORIES = [
  {rank: 1, title: 'Таня Савичева', views: '2 341', delta: '+16%', tone: 'positive'},
  {rank: 2, title: 'Блокадный дневник', views: '1 987', delta: '+12%', tone: 'positive'},
  {rank: 3, title: 'Письмо из Берлина', views: '1 654', delta: '+9%', tone: 'positive'},
  {rank: 4, title: 'Дорога жизни', views: '1 423', delta: '+6%', tone: 'positive'},
  {rank: 5, title: 'Переправа через Волгу', views: '1 208', delta: '-2%', tone: 'negative'},
];

export const STATS_DEVICE_ROWS = [
  {label: 'iPhone', share: 46},
  {label: 'Android', share: 38},
  {label: 'Web', share: 12},
  {label: 'iPad', share: 3},
  {label: 'Прочие', share: 1},
];

export const STATS_TAB_CONTENT = {
  overview: {
    summary: STATS_SUMMARY,
    chartTitle: 'Посетители',
    chartLabel: 'Посетители',
    chartSeries: STATS_VISITOR_SERIES,
    sideTitle: 'Источники трафика',
    sideButton: 'Все источники',
    sideItems: STATS_TRAFFIC_SOURCES,
    lowerSections: [
      {type: 'ranked', title: 'Популярные маршруты', cta: 'Смотреть все', items: STATS_POPULAR_ROUTES},
      {type: 'ranked', title: 'Популярные истории', cta: 'Смотреть все', items: STATS_POPULAR_STORIES, story: true},
      {type: 'bars', title: 'Устройства', cta: 'Все устройства', items: STATS_DEVICE_ROWS, note: 'Данные по уникальным посетителям'},
    ],
    footnote: 'Данные обновляются ежедневно в 00:00 по МСК',
  },
  visitors: {
    summary: [
      {title: 'Уникальные посетители', value: '12 846', delta: '+18%', note: 'за выбранный период', icon: Persons, tone: 'violet'},
      {title: 'Новые пользователи', value: '3 214', delta: '+12%', note: 'впервые открыли маршрут', icon: Person, tone: 'green'},
      {title: 'Среднее время сессии', value: '18 мин', delta: '+2 мин', note: 'в приложении', icon: Clock, tone: 'amber'},
      {title: 'Возвраты', value: '27%', delta: '+4%', note: 'повторные посещения', icon: Eye, tone: 'blue'},
    ],
    chartTitle: 'Динамика посещений',
    chartLabel: 'Посетители',
    chartSeries: STATS_VISITOR_SERIES,
    sideTitle: 'Источники посетителей',
    sideButton: 'Все источники',
    sideItems: STATS_TRAFFIC_SOURCES,
    lowerSections: [
      {type: 'ranked', title: 'Маршруты, которые привели больше всего посетителей', cta: 'Маршруты', items: STATS_POPULAR_ROUTES},
      {type: 'bars', title: 'Сегменты посетителей', cta: 'Все сегменты', items: [
        {label: 'Школьные группы', share: 41},
        {label: 'Индивидуальные посетители', share: 28},
        {label: 'Семьи', share: 19},
        {label: 'Туристы', share: 12},
      ], note: 'Распределение по основным аудиториям'},
      {type: 'bars', title: 'Устройства', cta: 'Все устройства', items: STATS_DEVICE_ROWS, note: 'По пользователям, открывшим маршруты'},
    ],
    footnote: 'Вкладка показывает только visitor-oriented показатели.',
  },
  content: {
    summary: [
      {title: 'Просмотры контента', value: '28 562', delta: '+22%', note: 'всех экранов и историй', icon: Eye, tone: 'blue'},
      {title: 'Досмотры до конца', value: '74%', delta: '+6%', note: 'средний completion rate', icon: BookOpen, tone: 'green'},
      {title: 'Средняя глубина', value: '6.2', delta: '+0.8', note: 'экрана за сессию', icon: RouteIcon, tone: 'violet'},
      {title: 'Добавления в избранное', value: '1 148', delta: '+9%', note: 'сохранения контента', icon: ChartPie, tone: 'amber'},
    ],
    chartTitle: 'Потребление контента',
    chartLabel: 'Просмотры',
    chartSeries: {
      day: {labels: ['12 мая', '16 мая', '19 мая', '23 мая', '26 мая', '30 мая', '2 июн', '7 июн', '9 июн'], values: [1600, 1780, 1720, 2140, 1890, 2410, 2280, 2610, 2440]},
      week: {labels: ['1 нед', '2 нед', '3 нед', '4 нед', '5 нед'], values: [8420, 9160, 8840, 9730, 10420]},
      month: {labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'], values: [16400, 18100, 19740, 21420, 28562, 26910]},
    },
    sideTitle: 'Типы контента',
    sideButton: 'Все типы',
    sideItems: [
      {label: 'Истории', value: 34, count: '9 768', color: '#5A4FF6'},
      {label: 'Маршруты', value: 27, count: '7 822', color: '#4D7EF1'},
      {label: 'Артефакты', value: 21, count: '5 844', color: '#63C987'},
      {label: 'Коллекции', value: 11, count: '3 092', color: '#FFB01F'},
      {label: 'Медиаконтент', value: 7, count: '2 036', color: '#D2D5DE'},
    ],
    lowerSections: [
      {type: 'ranked', title: 'Самые просматриваемые истории', cta: 'Истории', items: STATS_POPULAR_STORIES, story: true},
      {type: 'ranked', title: 'Самые сильные артефакты', cta: 'Артефакты', items: [
        {rank: 1, title: 'Письмо с фронта', views: '2 884', delta: '+12%', tone: 'positive'},
        {rank: 2, title: 'Военный дневник', views: '2 116', delta: '+7%', tone: 'positive'},
        {rank: 3, title: 'Фотография госпиталя', views: '1 945', delta: '+6%', tone: 'positive'},
        {rank: 4, title: 'Телеграмма 1944', views: '1 654', delta: '+3%', tone: 'positive'},
        {rank: 5, title: 'Полевой набор', views: '1 201', delta: '-1%', tone: 'negative'},
      ]},
      {type: 'bars', title: 'Форматы контента', cta: 'Все форматы', items: [
        {label: 'Текст + фото', share: 42},
        {label: 'Аудио', share: 24},
        {label: 'Видео', share: 18},
        {label: '3D-модели', share: 16},
      ], note: 'Доля просмотров по формату подачи'},
    ],
    footnote: 'Контентные метрики помогают понять, что удерживает внимание лучше всего.',
  },
  routes: {
    summary: [
      {title: 'Запуски маршрутов', value: '6 482', delta: '+14%', note: 'стартов за период', icon: RouteIcon, tone: 'violet'},
      {title: 'Завершения', value: '4 936', delta: '+11%', note: 'маршрут пройден до конца', icon: BookOpen, tone: 'green'},
      {title: 'Completion rate', value: '76%', delta: '+3%', note: 'по всем маршрутам', icon: ChartPie, tone: 'amber'},
      {title: 'Средняя длина', value: '18 мин', delta: '+1 мин', note: 'на один маршрут', icon: Clock, tone: 'blue'},
    ],
    chartTitle: 'Динамика по маршрутам',
    chartLabel: 'Запуски маршрутов',
    chartSeries: {
      day: {labels: ['12 мая', '16 мая', '19 мая', '23 мая', '26 мая', '30 мая', '2 июн', '7 июн', '9 июн'], values: [620, 710, 680, 930, 740, 980, 890, 1120, 1015]},
      week: {labels: ['1 нед', '2 нед', '3 нед', '4 нед', '5 нед'], values: [3180, 3560, 3410, 3810, 4204]},
      month: {labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'], values: [4120, 4510, 4900, 5360, 6482, 6120]},
    },
    sideTitle: 'Типы маршрутов',
    sideButton: 'Все маршруты',
    sideItems: [
      {label: 'Военная история', value: 39, count: '2 528', color: '#5A4FF6'},
      {label: 'Городские хроники', value: 24, count: '1 556', color: '#4D7EF1'},
      {label: 'Семейные маршруты', value: 18, count: '1 166', color: '#63C987'},
      {label: 'Обзорные', value: 12, count: '778', color: '#FFB01F'},
      {label: 'Экспериментальные', value: 7, count: '454', color: '#D2D5DE'},
    ],
    lowerSections: [
      {type: 'ranked', title: 'Маршруты-лидеры', cta: 'Все маршруты', items: STATS_POPULAR_ROUTES},
      {type: 'bars', title: 'Точки выхода', cta: 'Подробно', items: [
        {label: 'После 1-го шага', share: 12},
        {label: 'После 3-го шага', share: 28},
        {label: 'После 5-го шага', share: 33},
        {label: 'Финиш', share: 27},
      ], note: 'Где пользователи чаще всего прерывают прохождение'},
      {type: 'bars', title: 'Источники запуска', cta: 'Все источники', items: [
        {label: 'QR-коды', share: 44},
        {label: 'Главная страница', share: 23},
        {label: 'Поиск', share: 17},
        {label: 'Подборки', share: 16},
      ], note: 'Как пользователи попадают в маршруты'},
    ],
    footnote: 'Маршрутные метрики пригодятся для оптимизации структуры и длины сценария.',
  },
  stories: {
    summary: [
      {title: 'Открытия историй', value: '9 764', delta: '+17%', note: 'в рамках маршрутов и отдельно', icon: BookOpen, tone: 'violet'},
      {title: 'Дочитывания', value: '68%', delta: '+5%', note: 'до последнего экрана', icon: Eye, tone: 'green'},
      {title: 'Среднее чтение', value: '4.6 мин', delta: '+0.4', note: 'на одну историю', icon: Clock, tone: 'amber'},
      {title: 'Поделились', value: '824', delta: '+8%', note: 'шеры и копирования ссылок', icon: Megaphone, tone: 'blue'},
    ],
    chartTitle: 'Динамика чтения историй',
    chartLabel: 'Открытия историй',
    chartSeries: {
      day: {labels: ['12 мая', '16 мая', '19 мая', '23 мая', '26 мая', '30 мая', '2 июн', '7 июн', '9 июн'], values: [1020, 1120, 1090, 1360, 1170, 1490, 1380, 1610, 1520]},
      week: {labels: ['1 нед', '2 нед', '3 нед', '4 нед', '5 нед'], values: [5120, 5410, 5380, 5820, 6040]},
      month: {labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'], values: [5800, 6240, 7010, 7520, 9764, 9310]},
    },
    sideTitle: 'Тематики историй',
    sideButton: 'Все темы',
    sideItems: [
      {label: 'Личные истории', value: 33, count: '3 222', color: '#5A4FF6'},
      {label: 'Дневники и письма', value: 26, count: '2 539', color: '#4D7EF1'},
      {label: 'Городская память', value: 19, count: '1 855', color: '#63C987'},
      {label: 'Подвиги и биографии', value: 14, count: '1 367', color: '#FFB01F'},
      {label: 'Прочее', value: 8, count: '781', color: '#D2D5DE'},
    ],
    lowerSections: [
      {type: 'ranked', title: 'Истории-лидеры', cta: 'Все истории', items: STATS_POPULAR_STORIES, story: true},
      {type: 'bars', title: 'Формат чтения', cta: 'Все форматы', items: [
        {label: 'На телефоне', share: 71},
        {label: 'На Web', share: 18},
        {label: 'На планшете', share: 11},
      ], note: 'На каких устройствах читают истории'},
      {type: 'bars', title: 'Действия после прочтения', cta: 'Подробнее', items: [
        {label: 'Переход к артефактам', share: 38},
        {label: 'Продолжение маршрута', share: 34},
        {label: 'Сохранение', share: 17},
        {label: 'Шеринг', share: 11},
      ], note: 'Что пользователи делают дальше'},
    ],
    footnote: 'Вкладка сфокусирована именно на story-first сценариях.',
  },
  artifacts: {
    summary: [
      {title: 'Открытия артефактов', value: '14 208', delta: '+19%', note: 'карточки и внутренние экраны', icon: Boxes3, tone: 'violet'},
      {title: 'Сканирования QR', value: '8 942', delta: '+24%', note: 'от витрин и стендов', icon: Eye, tone: 'blue'},
      {title: 'Сохранения', value: '1 482', delta: '+7%', note: 'в личные подборки', icon: ChartPie, tone: 'green'},
      {title: 'Средний интерес', value: '2.8 мин', delta: '+0.2', note: 'на один артефакт', icon: Clock, tone: 'amber'},
    ],
    chartTitle: 'Интерес к артефактам',
    chartLabel: 'Открытия артефактов',
    chartSeries: {
      day: {labels: ['12 мая', '16 мая', '19 мая', '23 мая', '26 мая', '30 мая', '2 июн', '7 июн', '9 июн'], values: [1210, 1380, 1290, 1560, 1420, 1690, 1580, 1820, 1710]},
      week: {labels: ['1 нед', '2 нед', '3 нед', '4 нед', '5 нед'], values: [6180, 6530, 6420, 7010, 7280]},
      month: {labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'], values: [7200, 7810, 8560, 9130, 14208, 13320]},
    },
    sideTitle: 'Категории артефактов',
    sideButton: 'Все категории',
    sideItems: [
      {label: 'Письма и документы', value: 36, count: '5 115', color: '#5A4FF6'},
      {label: 'Фотографии', value: 24, count: '3 410', color: '#4D7EF1'},
      {label: 'Личные вещи', value: 18, count: '2 557', color: '#63C987'},
      {label: 'Аудио и видео', value: 13, count: '1 847', color: '#FFB01F'},
      {label: '3D-объекты', value: 9, count: '1 279', color: '#D2D5DE'},
    ],
    lowerSections: [
      {type: 'ranked', title: 'Топ артефактов', cta: 'Все артефакты', items: [
        {rank: 1, title: 'Письмо с фронта', views: '2 884', delta: '+12%', tone: 'positive'},
        {rank: 2, title: 'Военный дневник', views: '2 116', delta: '+7%', tone: 'positive'},
        {rank: 3, title: 'Фотография госпиталя', views: '1 945', delta: '+6%', tone: 'positive'},
        {rank: 4, title: 'Телеграмма 1944', views: '1 654', delta: '+3%', tone: 'positive'},
        {rank: 5, title: 'Полевой набор', views: '1 201', delta: '-1%', tone: 'negative'},
      ]},
      {type: 'bars', title: 'Форматы взаимодействия', cta: 'Все форматы', items: [
        {label: 'Фото', share: 39},
        {label: 'Текст', share: 26},
        {label: 'Аудио', share: 18},
        {label: '3D', share: 17},
      ], note: 'Какие представления артефактов чаще открывают'},
      {type: 'bars', title: 'Пути входа', cta: 'Подробно', items: [
        {label: 'QR у витрины', share: 47},
        {label: 'Из маршрута', share: 29},
        {label: 'Из истории', share: 15},
        {label: 'Поиск', share: 9},
      ], note: 'Откуда пользователи попадают в артефакты'},
    ],
    footnote: 'Артефактные метрики показывают интерес к единичным объектам коллекции.',
  },
  feedback: {
    summary: [
      {title: 'Сообщения', value: '263', delta: '+18%', note: 'входящие за период', icon: Megaphone, tone: 'violet'},
      {title: 'Отзывы', value: '148', delta: '+11%', note: 'о маршрутах и контенте', icon: ChartPie, tone: 'green'},
      {title: 'Вопросы', value: '72', delta: '+9%', note: 'запросы пользователей', icon: Persons, tone: 'blue'},
      {title: 'Средняя оценка', value: '4.7', delta: '+0.2', note: 'по опубликованным отзывам', icon: Eye, tone: 'amber'},
    ],
    chartTitle: 'Поток обращений',
    chartLabel: 'Сообщения',
    chartSeries: {
      day: {labels: ['12 мая', '16 мая', '19 мая', '23 мая', '26 мая', '30 мая', '2 июн', '7 июн', '9 июн'], values: [18, 24, 19, 31, 22, 28, 26, 34, 29]},
      week: {labels: ['1 нед', '2 нед', '3 нед', '4 нед', '5 нед'], values: [94, 108, 101, 117, 129]},
      month: {labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'], values: [128, 143, 156, 188, 263, 241]},
    },
    sideTitle: 'Типы сообщений',
    sideButton: 'Все типы',
    sideItems: [
      {label: 'Отзывы', value: 56, count: '148', color: '#5A4FF6'},
      {label: 'Вопросы', value: 27, count: '72', color: '#4D7EF1'},
      {label: 'Предложения', value: 11, count: '28', color: '#63C987'},
      {label: 'Ошибки и жалобы', value: 6, count: '15', color: '#FFB01F'},
    ],
    lowerSections: [
      {type: 'ranked', title: 'Чаще всего пишут про', cta: 'Все темы', items: [
        {rank: 1, title: 'Маршруты', views: '96', delta: '+14%', tone: 'positive'},
        {rank: 2, title: 'Истории', views: '58', delta: '+9%', tone: 'positive'},
        {rank: 3, title: 'Артефакты', views: '47', delta: '+7%', tone: 'positive'},
        {rank: 4, title: 'Доступность', views: '34', delta: '+4%', tone: 'positive'},
        {rank: 5, title: 'Приложение', views: '28', delta: '-2%', tone: 'negative'},
      ]},
      {type: 'bars', title: 'Скорость ответа', cta: 'SLA', items: [
        {label: 'До 1 часа', share: 36},
        {label: 'До 4 часов', share: 31},
        {label: 'В течение дня', share: 24},
        {label: 'Дольше', share: 9},
      ], note: 'Как быстро команда отвечает пользователям'},
      {type: 'bars', title: 'Каналы обратной связи', cta: 'Все каналы', items: [
        {label: 'Форма на сайте', share: 49},
        {label: 'В приложении', share: 28},
        {label: 'Email', share: 15},
        {label: 'Соцсети', share: 8},
      ], note: 'Через что чаще всего приходят сообщения'},
    ],
    footnote: 'Вкладка помогает следить за качеством коммуникации и удовлетворённостью.',
  },
};

export const FEEDBACK_TABS = [
  {id: 'all', title: 'Все сообщения'},
  {id: 'reviews', title: 'Отзывы'},
  {id: 'questions', title: 'Вопросы'},
  {id: 'suggestions', title: 'Предложения'},
];

export const FEEDBACK_CONVERSATIONS = [
  {
    id: 'feedback-1',
    initial: 'ЕК',
    author: 'Екатерина К.',
    museum: 'Музей Победы',
    type: 'Отзыв',
    typeTheme: 'info',
    preview: 'Очень понравился маршрут «Письма с фронта»! Узнала много нового...',
    time: 'Сегодня, 14:32',
    title: 'Маршрут «Письма с фронта»',
    body: 'Очень понравился маршрут «Письма с фронта»! Узнала много нового о судьбах людей в военное время. Особенно тронули подлинные письма и фотографии. Спасибо создателям за такую важную работу!',
    section: 'Маршруты',
    route: 'Письма с фронта',
    source: 'Форма обратной связи на сайте',
    device: 'Chrome на macOS',
    rating: 5,
    replyStatus: 'Опубликован',
    reply: 'Спасибо большое за ваш отзыв! Мы очень рады, что маршрут «Письма с фронта» произвёл на вас впечатление. Ваши слова вдохновляют нашу команду продолжать работу над новыми проектами.',
    replyAuthor: 'Анна Смирнова, методист',
    replyTime: 'Сегодня, 15:10',
    accent: 'violet',
  },
  {
    id: 'feedback-2',
    initial: 'ИВ',
    author: 'Иван В.',
    museum: 'Музей истории города',
    type: 'Вопрос',
    typeTheme: 'success',
    preview: 'Есть ли возможность добавить AR-контент в маршрут?',
    time: 'Сегодня, 11:08',
    title: 'Вопрос по маршруту',
    body: 'Есть ли возможность добавить AR-контент в маршрут? Хотелось бы показать отдельные артефакты в объёме прямо в мобильном приложении.',
    section: 'Маршруты',
    route: 'Истории города',
    source: 'Форма обратной связи на сайте',
    device: 'Safari на iPhone',
    rating: null,
    replyStatus: 'Черновик',
    reply: '',
    replyAuthor: '',
    replyTime: '',
    accent: 'green',
  },
  {
    id: 'feedback-3',
    initial: 'ОЛ',
    author: 'Ольга Л.',
    museum: 'Эрмитаж',
    type: 'Отзыв',
    typeTheme: 'info',
    preview: 'Прекрасная коллекция и подача материала. Спасибо!',
    time: 'Вчера, 19:45',
    title: 'Отзыв о коллекции',
    body: 'Прекрасная коллекция и подача материала. Спасибо!',
    section: 'Истории',
    route: 'Женщины на войне',
    source: 'Форма обратной связи в приложении',
    device: 'Android',
    rating: 5,
    replyStatus: 'Нет ответа',
    reply: '',
    replyAuthor: '',
    replyTime: '',
    accent: 'mint',
  },
  {
    id: 'feedback-4',
    initial: 'ДС',
    author: 'Дмитрий С.',
    museum: 'Музей Победы',
    type: 'Предложение',
    typeTheme: 'warning',
    preview: 'Предлагаю добавить аудиогид для слабовидящих посетителей.',
    time: 'Вчера, 16:20',
    title: 'Предложение по доступности',
    body: 'Предлагаю добавить аудиогид для слабовидящих посетителей.',
    section: 'Контент',
    route: 'Письма с фронта',
    source: 'Email',
    device: 'Web',
    rating: null,
    replyStatus: 'Нет ответа',
    reply: '',
    replyAuthor: '',
    replyTime: '',
    accent: 'orange',
  },
  {
    id: 'feedback-5',
    initial: 'АН',
    author: 'Анастасия Н.',
    museum: 'Музей истории города',
    type: 'Вопрос',
    typeTheme: 'success',
    preview: 'Как записаться на экскурсию для школьной группы?',
    time: '12 мая, 10:15',
    title: 'Вопрос об экскурсии',
    body: 'Как записаться на экскурсию для школьной группы?',
    section: 'Маршруты',
    route: 'Городские истории',
    source: 'Форма обратной связи на сайте',
    device: 'Chrome на Windows',
    rating: null,
    replyStatus: 'Нет ответа',
    reply: '',
    replyAuthor: '',
    replyTime: '',
    accent: 'mint',
  },
];

export const NOTIFICATION_ITEMS = [
  {
    id: 'notification-1',
    title: 'Новый отзыв о маршруте',
    meta: 'Письма с фронта · 5 минут назад',
  },
  {
    id: 'notification-2',
    title: 'Артефакт сохранён в черновики',
    meta: 'Письмо фронтовика 1943 года · 24 минуты назад',
  },
  {
    id: 'notification-3',
    title: 'Команда завершила маршрут',
    meta: 'Школьники 9Б · Сегодня, 12:10',
  },
];
