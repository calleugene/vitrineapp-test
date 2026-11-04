import {createManagement} from './management.js';

const root = '/api/auth/api/v1/auth';
const byId = (id) => document.getElementById(id);
const forms = ['login', 'forgot', 'reset', 'catalog'];
const resetToken = new URLSearchParams(location.hash.slice(1)).get('token');
if (resetToken) history.replaceState(null, '', location.pathname);

let museums = [];
let currentMuseum = '';
let page = 1;
let busy = false;

function show(id) {
  forms.forEach((name) => { byId(name).hidden = name !== id; });
  byId('management-nav').hidden = id !== 'catalog';
  byId('users').hidden = true;
  byId('exhibits').hidden = true;
}
const notify = (message) => { byId('notice').textContent = message; };
const actions = [...document.querySelectorAll('button')];

async function request(path, body, method = body === undefined ? 'GET' : 'POST', reason = '') {
  const headers = reason ? {'X-Admin-Reason': encodeURIComponent(reason)} : {};
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json';
  const options = {method, headers, body: multipart ? body : JSON.stringify(body)};
  const response = await fetch(root + path, {...options, cache: 'no-store', signal: AbortSignal.timeout(multipart ? 120000 : 10000)});
  if (!response.ok) {
    const error = (await response.json().catch(() => null))?.error;
    throw Object.assign(new Error('Request failed'), {
      status: response.status, retryAfter: Number(response.headers.get('Retry-After')),
      code: typeof error === 'string' ? error : error?.code,
    });
  }
  return response.status === 204 ? null : response.json();
}

async function run(work, failure = 'Не удалось выполнить действие. Повторите попытку.') {
  if (busy) return;
  busy = true;
  actions.forEach((button) => { button.disabled = true; });
  notify('');
  try {
    await work();
  } catch (error) {
    if (error.status === 401 && !byId('management-nav').hidden) {
      clearWorkspace();
      show('login');
      notify('Сессия завершена. Войдите снова.');
    } else {
      const delay = error.retryAfter > 0 ? ` Попробуйте через ${Math.ceil(error.retryAfter / 60)} мин.` : ' Попробуйте позже.';
      const errors = {
        email_already_exists: 'Этот email уже занят.',
        invalid_range: 'Проверьте введённые данные.',
        cannot_publish_empty: 'Добавьте хотя бы один экран перед публикацией.',
        screen_content_incomplete: 'Заполните содержимое всех экранов перед публикацией.',
        archived_artifact: 'Сначала восстановите экспонат из архива.',
        revision_conflict: 'Экспонат уже изменился. Откройте его заново.',
        bad_request: 'Проверьте введённые данные.',
        forbidden: 'Операция недоступна для текущего состояния. Проверьте статус пользователя или музея.',
      };
      notify(error.status === 429 ? 'Слишком много попыток.' + delay : errors[error.code] || failure);
    }
  } finally {
    busy = false;
    actions.forEach((button) => { button.disabled = button.dataset.unavailable === 'true'; });
  }
}

function submit(id, work, failure) {
  byId(id).addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    void run(() => work(Object.fromEntries(new FormData(form))), failure);
  });
}

function updateOptions() {
  const search = byId('search').value.trim().toLocaleLowerCase('ru');
  const select = byId('select').elements.museum;
  const previous = select.value || currentMuseum;
  const items = museums.filter(({name, museum_id, code}) =>
    [name, museum_id, code].some((value) => value?.toLocaleLowerCase('ru').includes(search)));
  select.replaceChildren(new Option(items.length ? 'Выберите музей' : 'Музеи не найдены', ''),
    ...items.map(({name, museum_id}) => new Option(`${name} · ${museum_id}`, museum_id)));
  if (items.some(({museum_id}) => museum_id === previous)) select.value = previous;
}

function clearWorkspace() {
  currentMuseum = '';
  page = 1;
  byId('workspace').hidden = true;
  byId('museum-name').textContent = '';
  byId('museum-details').textContent = '';
  byId('artifacts').replaceChildren();
  byId('artifact-editor').hidden = true;
  byId('artifact-editor').replaceChildren();
  byId('museum-controls').replaceChildren();
}

async function loadWorkspace(targetPage) {
  const query = new URLSearchParams({museum_id: currentMuseum, page: targetPage});
  const {museum, artifacts, pagination} = await request('/admin/workspace?' + query);
  page = pagination.page;
  byId('museum-name').textContent = museum.name;
  byId('museum-details').textContent = ['Режим администратора', museum.museum_id, museum.address].filter(Boolean).join(' · ');
  management.renderMuseum(museum);
  const labels = {draft: 'Черновик', published: 'Опубликован', archived: 'В архиве', moderation: 'На модерации'};
  byId('artifacts').replaceChildren(...(artifacts.length ? artifacts.map(({title, status}) => {
    const item = document.createElement('li');
    item.textContent = `${title} · ${labels[status] || status}`;
    return item;
  }) : [Object.assign(document.createElement('li'), {textContent: 'Экспонатов пока нет'})]));
  artifacts.forEach((artifact, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = 'Открыть';
    button.disabled = museum.admin_state === 'archived';
    button.addEventListener('click', () => void run(() => management.openArtifact(artifact.id)));
    byId('artifacts').children[index].append(' ', button);
  });
  const pages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  byId('page').textContent = `Страница ${page} из ${pages}`;
  byId('prev').dataset.unavailable = String(page <= 1);
  byId('next').dataset.unavailable = String(page >= pages);
  byId('workspace').hidden = false;
}

async function loadCatalog() {
  const data = await request('/admin/museums');
  museums = data.museums;
  currentMuseum = data.current_museum_id;
  updateOptions();
  show('catalog');
  if (currentMuseum && museums.some(({museum_id}) => museum_id === currentMuseum)) await loadWorkspace(1);
}

submit('login', async ({email, password}) => {
  await request('/admin/login', {email, password});
  byId('login').reset();
  await loadCatalog();
}, 'Не удалось войти. Проверьте почту и пароль. Для первого входа установите пароль по ссылке из письма.');

byId('show-forgot').addEventListener('click', () => { notify(''); show('forgot'); });
submit('forgot', async ({email}) => {
  await request('/forgot-password', {email});
  notify('Если для этого адреса доступна смена пароля, инструкция придёт на почту.');
});
submit('reset', async ({password, confirm}) => {
  if (password !== confirm) { notify('Пароли не совпадают.'); return; }
  await request('/reset-password', {token: resetToken, new_password: password});
  byId('reset').reset();
  show('login');
  notify('Пароль сохранён. Войдите с новым паролем.');
}, 'Ссылка недействительна или срок её действия истёк. Запросите новое письмо.');

byId('search').addEventListener('input', updateOptions);
submit('select', async ({museum, reason}) => {
  await request('/admin/context', {museum_id: museum, reason});
  clearWorkspace();
  currentMuseum = museum;
  byId('select').elements.reason.value = '';
  await loadWorkspace(1);
});
byId('leave').addEventListener('click', () => void run(async () => {
  await request('/admin/context', {museum_id: ''});
  clearWorkspace();
}));
byId('logout').addEventListener('click', () => void run(async () => {
  await request('/admin/logout', {});
  clearWorkspace();
  museums = [];
  updateOptions();
  show('login');
}));
byId('prev').addEventListener('click', () => void run(() => loadWorkspace(page - 1)));
byId('next').addEventListener('click', () => void run(() => loadWorkspace(page + 1)));
byId('show-users').addEventListener('click', () => void run(async () => {
  byId('catalog').hidden = true;
  byId('workspace').hidden = true;
  byId('exhibits').hidden = true;
  byId('users').hidden = false;
  await management.loadUsers();
}));
byId('show-exhibits').addEventListener('click', () => void run(async () => {
  byId('catalog').hidden = true;
  byId('workspace').hidden = true;
  byId('users').hidden = true;
  byId('exhibits').hidden = false;
  await management.loadExhibits();
}));
byId('show-museums').addEventListener('click', () => void run(loadCatalog));

const management = createManagement({
  request, run, notify, byId, getMuseum: () => currentMuseum,
  getMuseums: () => museums,
  reloadWorkspace: () => loadWorkspace(page), loadCatalog, clearWorkspace,
});

if (resetToken) {
  show('reset');
} else {
  show('login');
  void run(async () => {
    try { await loadCatalog(); } catch (error) { if (error.status !== 401) throw error; }
  });
}
