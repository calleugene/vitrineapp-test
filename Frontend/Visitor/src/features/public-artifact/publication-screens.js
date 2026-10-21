function parsePayload(value) {
  if (typeof value !== 'string') return value || {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export function normalizePublication(payload) {
  const snapshot = payload?.snapshot || payload?.publication?.snapshot || payload;
  const artifact = snapshot?.artifact || snapshot?.exhibit || snapshot || {};
  const rawScreens = snapshot?.screens || artifact?.screens || [];
  const cover = {
    id: 'cover',
    type: 'cover',
    media: 'image',
    mediaLabel: 'Обложка экспоната',
    imageUrl: artifact.cover_url || artifact.coverUrl || '',
    title: artifact.title || 'Экспонат',
    text: artifact.short_description || artifact.description || '',
  };
  const expandedScreens = rawScreens.filter((screen) => !screen.is_system).flatMap((screen) => {
    const parsed = parsePayload(screen.payload);
    const legacy = parsed.questions || parsed.content?.legacy_questions;
    if (screen.type !== 'quiz' || !Array.isArray(legacy)) return [screen];
    const main = parsed.content ? [screen] : [];
    return [...main, ...legacy.map((question, index) => ({...screen,id:`${screen.id}-legacy-${index}`,title:question.q,content:{options:question.a,correct_answer:question.a?.[question.correct],explanation:question.explanation || ''}}))];
  });
  const screens = expandedScreens.map((screen, index) => {
    const payloadValue = parsePayload(screen.payload);
    const content = screen.content || payloadValue.content || payloadValue || {};
    const type = screen.type === 'quiz' ? 'quiz' : ['model', 'ar', '3d'].includes(screen.type) ? 'ar' : 'fact';
    const options = Array.isArray(content.options) ? content.options.filter((option) => typeof option === 'string') : [];
    return {
      id: screen.id || `screen-${index}`,
      type,
      media: type === 'ar' ? 'ar' : 'image',
      mediaLabel: 'Изображение экрана',
      imageUrl: screen.image_url || content.image_url || content.imageUrl || '',
      title: screen.title || content.title || 'Экран экспоната',
      text: screen.text || content.body || content.text || '',
      note: screen.subtitle || content.subtitle || '',
      modelUrl: content.model_url || content.modelUrl || '',
      options,
      correctAnswer: content.correct_answer || content.correctAnswer || '',
      explanation: content.explanation || '',
    };
  });
  const final = {
    id: 'system-final',
    type: 'final',
    media: 'none',
    badge: 'star',
    title: 'История пройдена',
    text: 'Добавьте экспонат в свою коллекцию, чтобы вернуться к нему позже.',
  };
  return {artifactId: artifact.id || '', museumId: artifact.museum_id || '', screens: [cover, ...screens, final]};
}
