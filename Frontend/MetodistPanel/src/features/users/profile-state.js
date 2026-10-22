export function profileFields(user) {
  const parts = (user?.full_name || '').trim().split(/\s+/);
  return {firstName: parts[0] || '', lastName: parts.slice(1).join(' '), email: user?.email || '', phone: user?.phone || '', about: user?.about || ''};
}

export function profileChanged(saved, draft) {
  return Object.keys(saved).some((key) => saved[key] !== draft[key]);
}

export function validateProfile(draft) {
  const errors = {};
  if (!draft.firstName.trim()) errors.firstName = 'Введите имя';
  if (!draft.lastName.trim()) errors.lastName = 'Введите фамилию';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) errors.email = 'Введите корректный email';
  if (draft.phone.length > 40) errors.phone = 'Не более 40 символов';
  if (draft.about.length > 500) errors.about = 'Не более 500 символов';
  return errors;
}

export function accountDate(value, dateOnly = false) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Нет данных';
  return new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'long', year: 'numeric', ...(dateOnly ? {} : {hour: '2-digit', minute: '2-digit'})}).format(new Date(value));
}

export const profileErrorMessage = (error) => ({
  code_not_found: 'Код не найден. Проверьте его и повторите попытку.',
  code_invalid: 'Код недействителен или отозван. Запросите новый код у администратора музея.',
  already_joined: 'Вы уже подключены к этому музею.',
  join_rate_limited: 'Превышено количество попыток. Повторите через 15 минут.',
  email_already_exists: 'Этот email уже используется.',
  email_change_rate_limited: 'Слишком много запросов смены email. Повторите через 30 минут.',
  invalid_token: 'Код подтверждения недействителен или истёк.',
  forbidden: 'Операция недоступна для вашего аккаунта.',
  bad_request: 'Проверьте введённые данные.',
}[error?.code || error?.message] || 'Не удалось выполнить операцию. Повторите попытку.');
