import {Eye, Person, Persons, Stopwatch} from '@gravity-ui/icons';

export const VISITOR_STATS = [
  {icon: Persons, value: '1 248', title: 'Всего посетителей', delta: '+18% к прошлому месяцу', tone: 'violet'},
  {icon: Person, value: '342', title: 'Новые посетители', delta: '+12% к прошлому месяцу', tone: 'green'},
  {icon: Stopwatch, value: '18 мин', title: 'Среднее время на маршруте', delta: '+2 мин к прошлому месяцу', tone: 'amber'},
  {icon: Eye, value: '3 826', title: 'Просмотров экспонатов', delta: '+25% к прошлому месяцу', tone: 'blue'},
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
  {id: 'collectedArtifacts', title: 'Собрано экспонатов'},
  {id: 'routeCompleted', title: 'Маршрут пройден'},
];

