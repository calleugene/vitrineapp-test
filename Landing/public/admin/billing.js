const statuses = {
  creating: 'Создание платежа', pending: 'Ожидает оплаты', paid: 'Оплачен',
  expired: 'Срок оплаты истёк', failed: 'Платёж не создан', refunded: 'Возврат',
};
const issues = {
  create_unknown: 'Ответ о создании операции потерян',
  create_rejected: 'Банк отклонил создание ссылки',
  operation_mismatch: 'Данные банка и заказа расходятся',
  checkout_link_invalid: 'Адрес оплаты требует проверки',
  bank_status_conflict: 'Статус банка расходится с историей заказа',
  bank_status_overdue: 'Банк не закрыл просроченную ссылку',
  unknown_bank_status: 'Неизвестный статус банка',
  refund_review: 'Возврат требует проверки',
};
const errors = {
  operation_mismatch: 'Операция банка не соответствует этому заказу.',
  operation_id_required: 'Укажите ID операции из кабинета Точки.',
  checkout_unavailable: 'Интеграция с банком отключена.',
  cannot_close_order: 'Можно закрыть только попытку старше 45 минут без связанной операции Точки.',
};
const money = new Intl.NumberFormat('ru-RU', {style: 'currency', currency: 'RUB'});
const date = new Intl.DateTimeFormat('ru-RU', {dateStyle: 'medium', timeStyle: 'short'});

function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text) result.textContent = text;
  if (className) result.className = className;
  return result;
}

function control(labelText, input) {
  const label = node('label', labelText);
  label.append(input);
  return label;
}

function button(label, action) {
  const result = node('button', label, 'secondary');
  result.type = 'button';
  result.addEventListener('click', action);
  return result;
}

export function createBilling({request, run, notify, root}) {
  let q = '';
  let status = '';
  let enabled = false;

  async function load(page = 0) {
    const {orders, more, checkout_enabled} = await request('/admin/billing/payments?' + new URLSearchParams({q, status, page}));
    enabled = checkout_enabled;
    const form = node('form');
    const search = node('input');
    search.type = 'search';
    search.value = q;
    search.maxLength = 128;
    const filter = node('select');
    for (const [value, label] of Object.entries({'': 'Все статусы', review: 'Требуют разбора', ...statuses})) {
      filter.add(new Option(label, value, false, value === status));
    }
    const submit = node('button', 'Найти');
    submit.type = 'submit';
    form.append(control('ID музея, заказа или операции', search), control('Статус', filter), submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      q = search.value.trim();
      status = filter.value;
      void run(() => load());
    });

    const list = node('ul');
    const detail = node('section');
    detail.hidden = true;
    for (const order of orders) {
      const item = node('li');
      const label = [order.museum_id, money.format(order.amount_kopecks / 100), statuses[order.status], date.format(new Date(order.created_at))];
      item.append(node('span', label.join(' · ')), ' ',
        button('Открыть', () => void run(async () => {
          renderDetail(detail, await request('/admin/billing/payments/' + order.id), () => load(page));
          detail.hidden = false;
          detail.querySelector('h3').focus();
        })));
      if (order.issue) item.append(node('p', issues[order.issue] || order.issue));
      list.append(item);
    }
    const nav = node('div', '', 'heading');
    if (page > 0) nav.append(button('Назад', () => void run(() => load(page - 1))));
    nav.append(node('span', 'Страница ' + (page + 1)));
    if (more) nav.append(button('Далее', () => void run(() => load(page + 1))));
    root.replaceChildren(node('h2', 'Платежи'), form);
    if (!enabled) root.append(node('p', 'Онлайн-оплата выключена.'));
    root.append(orders.length ? list : node('p', 'Платежи не найдены.'), nav, detail);
  }

  function renderDetail(root, {order, history, period}, reload) {
    const title = node('h3', 'Платёж ' + order.id);
    title.tabIndex = -1;
    const details = node('dl');
    const metadata = [
      ['Музей', order.museum_id],
      ['Сумма', money.format(order.amount_kopecks / 100)],
      ['Период', order.months + ' мес.'],
      ['Статус', statuses[order.status]],
      ['Статус Точки', order.bank_status],
      ['ID операции Точки', order.operation_id],
      ['Оплачен', order.paid_at && date.format(new Date(order.paid_at))],
      ['Период подписки', period && [period.starts_at, period.ends_at].map((value) => date.format(new Date(value))).join(' — ')],
      ['Причина проверки', issues[order.issue] || order.issue],
    ];
    for (const [label, value] of metadata) {
      if (value) details.append(node('dt', label), node('dd', value));
    }

    const form = node('form');
    const reason = node('textarea');
    reason.required = true;
    reason.minLength = 3;
    reason.maxLength = 500;
    const actions = node('div', '', 'heading');
    const note = node('button', 'Записать комментарий');
    note.type = 'submit';
    note.value = 'note';
    actions.append(note);
    const operation = node('input');
    operation.maxLength = 36;
    operation.autocomplete = 'off';
    if (enabled) {
      if (!order.operation_id) form.append(control('ID операции Точки для повторной проверки', operation));
      const recheck = node('button', 'Сверить с Точкой');
      recheck.value = 'recheck';
      recheck.type = 'submit';
      actions.append(recheck);
    }
    if (!order.operation_id && order.status === 'creating' &&
        Date.now() - new Date(order.created_at).getTime() > 45 * 60 * 1000) {
      const close = node('button', 'Закрыть попытку без операции');
      close.type = 'submit';
      close.value = 'resolve-missing';
      actions.append(close);
    }
    form.append(control('Основание или комментарий', reason), actions);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const action = event.submitter?.value || 'note';
      if (action === 'resolve-missing' && !window.confirm(
        'Подтвердите, что в Точке нет активной ссылки или оплаты по этому заказу.',
      )) return;
      const input = {reason: reason.value};
      if (action === 'recheck') input.operation_id = operation.value.trim();
      for (const item of actions.children) item.disabled = true;
      void run(async () => {
        try {
          const updated = await request('/admin/billing/payments/' + order.id + '/' + action, input);
          renderDetail(root, updated, reload);
          root.querySelector('h3').focus();
          notify(action === 'note' ? 'Комментарий сохранён.' : 'Данные операции обновлены.');
        } catch (error) {
          if (errors[error.code]) notify(errors[error.code]);
          else throw error;
        }
      }).finally(() => { for (const item of actions.children) item.disabled = false; });
    });

    const log = node('ul');
    const actionLabel = {recheck: 'Запрос сверки', bank_status: 'Данные Точки', note: 'Комментарий',
      review: 'Требуется разбор', operation_not_found: 'Попытка закрыта без операции'};
    for (const item of history) {
      log.append(node('li', [date.format(new Date(item.created_at)), actionLabel[item.action], item.actor_id, item.note].join(' · ')));
    }
    root.replaceChildren(title, details, form, node('h4', 'История действий'),
      history.length ? log : node('p', 'Записей пока нет.'),
      button('Обновить список', () => void run(reload)));
  }

  return {load};
}
