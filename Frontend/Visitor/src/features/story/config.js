export const SCREEN_LABELS = [
  'ОБЛОЖКА',
  'ФАКТ I',
  'ФАКТ II',
  '3D · AR',
  'ВОПРОС',
  'ФИНАЛ',
];

export const SCREEN_LABEL = {
  cover: 'ОБЛОЖКА',
  final: 'ФИНАЛ',
  default: 'ЭКРАН',
};

export const UI = {
  // quiz
  quizKicker: 'Проверьте себя',
  quizCorrect: 'Правильно!',
  quizWrong: 'Почти!',
  quizContinue: 'Продолжить',

  // screen flow
  swipeUp: 'свайп вверх',
  nextScreen: 'Следующий экран',
  closeStory: 'Закрыть историю',
  finishInteraction: 'Завершить взаимодействие',
  screen: (index) => `Экран ${index + 1}`,

  // ar placeholder
  arScanning: 'сканирование',
  arActionLabel: 'Взаимодействовать с 3D-объектом',
  arActionButton: 'Взаимодействовать',
  arExitButton: 'Готово',

  // collect
  collectBtnDefault: 'Сохранить в коллекцию',
  collectBtnInProgress: 'Сохраняем…',
  collectBtnDone: 'Сохранено в коллекции',
  collectGhostDefault: 'Вернуться к музею',
  collectGhostDone: 'К музею',
  collectError: 'Не удалось добавить экспонат в коллекцию. Попробуйте ещё раз.',

  // final
  finalKicker: 'История пройдена',
};

export const MEDIA_LABEL = {
  image: {
    cover: 'Обложка экспоната',
    fact: 'Фото экспоната',
  },
  ar: {
    default: '3D-модель · AR',
  },
};

export const CONFETTI = {
  colors: ['#695bff', '#fbbf24', '#22c55e', '#f43f5e', '#38bdf8', '#a78bfa', '#fb923c'],
  particleCount: 36,
  durationMs: 1500,
};

