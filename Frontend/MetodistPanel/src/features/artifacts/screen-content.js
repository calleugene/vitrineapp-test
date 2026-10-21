export const SCREEN_TYPES = {
  text: {label: 'Текст и фото', hint: 'Расскажите историю экспоната'},
  model: {label: '3D-модель', hint: 'Покажите экспонат со всех сторон'},
  quiz: {label: 'Тест', hint: 'Один вопрос и варианты ответа'},
};

export function screenValues(screen) {
  let payload = screen.payload || {};
  try {if (typeof payload === 'string') payload = JSON.parse(payload);} catch {payload = {};}
  const legacy = payload.questions?.[0];
  const content = payload.content || (legacy ? {options:legacy.a,correct_answer:legacy.a?.[legacy.correct]} : payload);
  const options = Array.isArray(content.options) && content.options.length ? content.options : ['', ''];
  return {title: legacy?.q || screen.title || '', body: content.body || content.text || '', imageURL: content.image_url || content.imageUrl || '', modelURL: content.model_url || content.modelUrl || '', options, correct: options.indexOf(content.correct_answer || content.correctAnswer), explanation: content.explanation || '', legacyQuestions: payload.questions?.slice(1) || content.legacy_questions || []};
}

export function contentError(type, values) {
  if (!values.title.trim()) return type === 'quiz' ? 'Введите вопрос.' : 'Добавьте заголовок.';
  if (type === 'model' && !values.modelURL) return 'Загрузите 3D-модель перед сохранением.';
  if (type === 'quiz') {
    const options = values.options.map((option) => option.trim());
    if (options.length < 2 || options.length > 6 || options.some((option) => !option)) return 'Заполните от 2 до 6 вариантов ответа.';
    if (new Set(options.map((option) => option.toLocaleLowerCase('ru'))).size !== options.length) return 'Варианты ответа должны отличаться.';
    if (values.correct < 0 || values.correct >= options.length) return 'Отметьте правильный ответ.';
  }
  return '';
}

export function screenExtra(type, values) {
  if (type === 'model') return {model_url: values.modelURL};
  if (type === 'quiz') return {options: values.options.map((option) => option.trim()), correct_answer: values.options[values.correct]?.trim() || '', explanation: values.explanation, ...(values.legacyQuestions?.length ? {legacy_questions:values.legacyQuestions} : {})};
  return {};
}
