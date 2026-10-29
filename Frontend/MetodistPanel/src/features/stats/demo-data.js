import {BookOpen, Boxes3, ChartPie, Clock, Eye, Megaphone, Person, Persons, Route as RouteIcon} from '@gravity-ui/icons';

export const STATS_TABS = [
  {id: 'overview', title: 'Обзор'},
  {id: 'visitors', title: 'Посетители'},
  {id: 'content', title: 'Контент'},
  {id: 'routes', title: 'Маршруты'},
  {id: 'stories', title: 'Истории'},
  {id: 'artifacts', title: 'Экспонаты'},
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
      {label: 'Экспонаты', value: 21, count: '5 844', color: '#63C987'},
      {label: 'Коллекции', value: 11, count: '3 092', color: '#FFB01F'},
      {label: 'Медиаконтент', value: 7, count: '2 036', color: '#D2D5DE'},
    ],
    lowerSections: [
      {type: 'ranked', title: 'Самые просматриваемые истории', cta: 'Истории', items: STATS_POPULAR_STORIES, story: true},
      {type: 'ranked', title: 'Самые сильные экспонаты', cta: 'Экспонаты', items: [
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
        {label: 'Переход к экспонатам', share: 38},
        {label: 'Продолжение маршрута', share: 34},
        {label: 'Сохранение', share: 17},
        {label: 'Шеринг', share: 11},
      ], note: 'Что пользователи делают дальше'},
    ],
    footnote: 'Вкладка сфокусирована именно на story-first сценариях.',
  },
  artifacts: {
    summary: [
      {title: 'Открытия экспонатов', value: '14 208', delta: '+19%', note: 'карточки и внутренние экраны', icon: Boxes3, tone: 'violet'},
      {title: 'Сканирования QR', value: '8 942', delta: '+24%', note: 'от витрин и стендов', icon: Eye, tone: 'blue'},
      {title: 'Сохранения', value: '1 482', delta: '+7%', note: 'в личные подборки', icon: ChartPie, tone: 'green'},
      {title: 'Средний интерес', value: '2.8 мин', delta: '+0.2', note: 'на один экспонат', icon: Clock, tone: 'amber'},
    ],
    chartTitle: 'Интерес к экспонатам',
    chartLabel: 'Открытия экспонатов',
    chartSeries: {
      day: {labels: ['12 мая', '16 мая', '19 мая', '23 мая', '26 мая', '30 мая', '2 июн', '7 июн', '9 июн'], values: [1210, 1380, 1290, 1560, 1420, 1690, 1580, 1820, 1710]},
      week: {labels: ['1 нед', '2 нед', '3 нед', '4 нед', '5 нед'], values: [6180, 6530, 6420, 7010, 7280]},
      month: {labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'], values: [7200, 7810, 8560, 9130, 14208, 13320]},
    },
    sideTitle: 'Категории экспонатов',
    sideButton: 'Все категории',
    sideItems: [
      {label: 'Письма и документы', value: 36, count: '5 115', color: '#5A4FF6'},
      {label: 'Фотографии', value: 24, count: '3 410', color: '#4D7EF1'},
      {label: 'Личные вещи', value: 18, count: '2 557', color: '#63C987'},
      {label: 'Аудио и видео', value: 13, count: '1 847', color: '#FFB01F'},
      {label: '3D-объекты', value: 9, count: '1 279', color: '#D2D5DE'},
    ],
    lowerSections: [
      {type: 'ranked', title: 'Топ экспонатов', cta: 'Все экспонаты', items: [
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
      ], note: 'Какие представления экспонатов чаще открывают'},
      {type: 'bars', title: 'Пути входа', cta: 'Подробно', items: [
        {label: 'QR у витрины', share: 47},
        {label: 'Из маршрута', share: 29},
        {label: 'Из истории', share: 15},
        {label: 'Поиск', share: 9},
      ], note: 'Откуда пользователи попадают в экспонаты'},
    ],
    footnote: 'Метрики экспонатов показывают интерес к единичным объектам коллекции.',
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
        {rank: 3, title: 'Экспонаты', views: '47', delta: '+7%', tone: 'positive'},
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

