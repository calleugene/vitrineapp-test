import {
  BookOpen,
  Boxes3,
  House,
  Megaphone,
  Persons,
  Route as RouteIcon,
  SquareChartBar,
} from '@gravity-ui/icons';

export const NAV_ITEMS = [
  {id: 'dashboard', label: 'Главная', icon: House},
  {id: 'museum', label: 'Профиль музея', icon: BookOpen},
  {id: 'routes', label: 'Маршруты', icon: RouteIcon},
  {id: 'visitors', label: 'Посетители', icon: Persons},
  {id: 'stats', label: 'Статистика', icon: SquareChartBar},
  {id: 'artifacts', label: 'Артефакты', icon: Boxes3},
  {id: 'feedback', label: 'Обратная связь', icon: Megaphone},
];

export const ARTIFACT_WIZARD_VIEWS = ['artifact-basic', 'artifact-content', 'artifact-publish'];
export const ROUTE_WIZARD_VIEWS = ['route-basic', 'route-content', 'route-publish', 'route-success'];
