const museumFields = [
  ['name', 'Название', 'required'], ['short_description', 'Краткое описание'],
  ['description', 'Описание', 'textarea'], ['website', 'Сайт'],
  ['address', 'Адрес'], ['contact_email', 'Контактный email'], ['contact_phone', 'Контактный телефон'], ['logo_url', 'Адрес логотипа'],
];
const artifactFields = [
  ['title', 'Название', 'required'], ['short_description', 'Краткое описание'],
  ['description', 'Описание', 'textarea'], ['category', 'Категория'],
  ['created_date', 'Дата создания'], ['period', 'Период'], ['origin_place', 'Место происхождения'],
  ['tags', 'Теги через запятую'],
];
const userFields = [
  ['full_name', 'Имя и фамилия', 'required'], ['phone', 'Телефон'],
  ['position', 'Должность'], ['about', 'О себе', 'textarea'], ['birth_date', 'Дата рождения'],
  ['gender', 'Пол'], ['timezone', 'Часовой пояс'], ['interface_language', 'Язык интерфейса'],
  ['extra_languages', 'Дополнительные языки через запятую'],
  ['notifications_enabled', 'Уведомления', {true: 'Включены', false: 'Выключены'}],
  ['note', 'Заметка', 'textarea'],
];
const roles = {visitor: 'Посетитель', methodist: 'Методист', museum_admin: 'Администратор музея', owner: 'Владелец'};
const states = {ACTIVE: 'Активен', INVITED: 'Приглашён', DISABLED: 'Заблокирован', DORMANT: 'Ожидает удаления'};
const screenTypes = {text: 'Текст', quiz: 'Тест', model: '3D-модель'};

function element(tag, label, className) {
  const node = document.createElement(tag);
  if (label) node.textContent = label;
  if (className) node.className = className;
  return node;
}

function field(form, name, label, value, kind) {
  const wrapper = element('label', label);
  const input = element(typeof kind === 'object' ? 'select' : kind === 'textarea' ? 'textarea' : 'input');
  if (typeof kind === 'object') {
    for (const [key, option] of Object.entries(kind)) input.add(new Option(option, key));
  } else if (kind === 'email' || kind === 'file') {
    input.type = kind;
    input.required = true;
  }
  input.name = name;
  input.value = value ?? '';
  if (kind === 'required') input.required = true;
  wrapper.append(input);
  form.append(wrapper);
  return input;
}

function confirmation(message) {
  const reason = window.prompt(message + '\nУкажите причину.');
  return reason?.trim().slice(0, 300);
}

function commaList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function createManagement({request, run, notify, byId, getMuseum, getMuseums, reloadWorkspace, loadCatalog, clearWorkspace}) {
  function formFor(fields, values, title, save) {
    const form = element('form');
    for (const [key, label, kind] of fields) field(form, key, label, values[key], kind);
    const submit = element('button', title);
    submit.type = 'submit';
    form.append(submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void run(() => save(Object.fromEntries(new FormData(form))));
    });
    return form;
  }

  function button(label, action) {
    const item = element('button', label, 'secondary');
    item.type = 'button';
    item.addEventListener('click', () => void run(action));
    return item;
  }

  function content(path, body, method, reason) {
    return request('/admin/content/' + path + '?' + new URLSearchParams({museum_id: getMuseum()}), body, method, reason);
  }

  function upload(title, accept, save) {
    const form = formFor([['file', title, 'file']], {}, 'Загрузить', ({file}) => {
      const data = new FormData();
      data.set('file', file);
      return save(data);
    });
    form.elements.file.accept = accept;
    return form;
  }

  const imageTypes = 'image/jpeg,image/png,image/webp';
  const create = byId('create-museum');
  create.append(element('summary', 'Создать музей'), formFor(museumFields, {}, 'Создать', async (data) => {
    const {museum} = await request('/admin/museums', data);
    await request('/admin/context', {museum_id: museum.museum_id, reason: 'Создание музея'});
    create.open = false;
    create.querySelector('form').reset();
    await loadCatalog();
    notify('Музей создан. Назначьте владельца в разделе «Команда музея».');
  }));

  function renderMuseum(museum) {
    const mount = byId('museum-controls');
    const createArtifact = byId('create-artifact');
    createArtifact.hidden = museum.admin_state === 'archived';
    createArtifact.replaceChildren(element('summary', 'Создать экспонат'), formFor(artifactFields, {}, 'Создать черновик', async (data) => {
      const {artifact} = await content('artifacts', {...data, tags: commaList(data.tags)});
      await reloadWorkspace();
      await openArtifact(artifact.id);
      notify('Черновик создан.');
    }));
    const controls = element('div', '', 'heading');
    async function setState(action, message) {
      const reason = message ? confirmation(message) : 'Изменение видимости или восстановление музея';
      if (message && !reason) return;
      await content('museum-state', {action}, 'PUT', reason);
      if (action === 'delete') {
        await request('/admin/context', {museum_id: ''});
        clearWorkspace();
      }
      await loadCatalog();
      notify('Статус музея обновлён.');
    }
    if (museum.admin_state === 'archived') {
      controls.append(button('Восстановить музей', () => setState('restore')),
        button('Удалить музей', () => setState('delete', 'Удалить музей из рабочих разделов? Его экспонаты и ссылки останутся недоступны. Данные сохранятся для служебного восстановления.')));
      mount.replaceChildren(element('p', 'Музей в архиве'), controls);
      byId('artifact-editor').hidden = true;
      return;
    }
    controls.append(
      button(museum.is_public ? 'Скрыть из каталога' : 'Показать в каталоге', () => setState(museum.is_public ? 'hide' : 'publish')),
      button('Архивировать музей', () => setState('archive', 'Архивировать музей? Его экспонаты временно станут недоступны посетителям.')),
    );
    const profile = element('details');
    const edit = formFor(museumFields, museum, 'Сохранить профиль', async (data) => {
      await content('museums/profile', data, 'PATCH');
      await reloadWorkspace();
      notify('Профиль сохранён.');
    });
    profile.append(element('summary', 'Профиль музея'), edit, upload('Файл логотипа', imageTypes, async (data) => {
      const result = await content('museums/profile/image', data);
      edit.elements.logo_url.value = result.image_url;
      notify('Логотип загружен. Сохраните профиль, чтобы применить его.');
    }));
    const team = element('details');
    const list = element('ul');
    team.append(element('summary', 'Команда музея'), button('Загрузить команду', () => loadTeam(list)), list,
      formFor([['user_id', 'ID пользователя', 'required'], ['role', 'Роль в музее', {methodist: roles.methodist, museum_admin: roles.museum_admin, owner: roles.owner}]], {role: 'methodist'}, 'Назначить', async ({user_id, role}) => {
        const reason = role === 'owner' ? confirmation('Назначить нового владельца? Прежний владелец станет администратором музея.') : '';
        if (role === 'owner' && !reason) return;
        await request('/admin/team?' + new URLSearchParams({museum_id: getMuseum()}), {user_id, role, reason}, 'PUT');
        await loadTeam(list);
        notify('Роль в музее обновлена.');
      }));
    mount.replaceChildren(controls, profile, team);
  }

  async function loadTeam(list) {
    const url = '/admin/team?' + new URLSearchParams({museum_id: getMuseum()});
    const {members} = await request(url);
    list.replaceChildren(...members.map((member) => {
      const item = element('li', `${member.full_name} · ${member.email} · ${roles[member.role]} · ${member.id}`);
      if (member.role !== 'owner') item.append(' ', button('Отозвать доступ', async () => {
        const reason = confirmation(`Отозвать доступ к этому музею у ${member.full_name}?`);
        if (!reason) return;
        await request(url, {user_id: member.id, role: '', reason}, 'PUT');
        await loadTeam(list);
      }));
      return item;
    }));
    if (!members.length) list.append(element('li', 'Сотрудников пока нет.'));
  }

  async function openArtifact(id) {
    const path = 'artifacts/' + encodeURIComponent(id);
    const [{artifact}, {screens}] = await Promise.all([content(path), content(path + '/screens')]);
    const editor = byId('artifact-editor');
    const controls = element('div', '', 'heading');
    const close = () => { editor.hidden = true; editor.replaceChildren(); };
    const action = (name, label, payload = {}, method = 'POST') => button(label, async () => {
      let reason = '';
      if (method === 'DELETE' || name === 'archive') {
        reason = confirmation(`${label} «${artifact.title}»?`);
        if (!reason) return;
      }
      const result = await content(path + (name ? '/' + name : ''), payload, method, reason);
      await reloadWorkspace();
      if (method === 'DELETE') close();
      else await openArtifact(name === 'duplicate' ? result.artifact.id : id);
      notify('Изменения сохранены.');
    });
    controls.append(button('Закрыть', close), action('duplicate', 'Дублировать'), action('', 'Удалить', undefined, 'DELETE'));
    if (artifact.status === 'archived') {
      controls.append(action('restore', 'Восстановить'));
      editor.replaceChildren(element('h3', artifact.title), controls);
      editor.hidden = false;
      return;
    }
    controls.append(action('archive', 'Архивировать'));
    if (artifact.published_revision) controls.append(action('unpublish', 'Снять с публикации'));
    controls.append(action('publish', 'Опубликовать', {expected_draft_revision: artifact.draft_revision}));
    const details = element('details');
    details.open = true;
    let tags = '';
    try { tags = JSON.parse(artifact.tags || '[]').join(', '); } catch { tags = artifact.tags || ''; }
    details.append(element('summary', 'Карточка экспоната'), formFor(artifactFields, {...artifact, tags}, 'Сохранить карточку', async (data) => {
      await content(path, {...data, tags: commaList(data.tags)}, 'PATCH');
      await reloadWorkspace();
      await openArtifact(id);
      notify('Карточка сохранена.');
    }), upload('Обложка экспоната', imageTypes, async (data) => {
      await content(path + '/cover', data);
      await openArtifact(id);
      notify('Обложка обновлена.');
    }));
    const screenList = element('details');
    const visible = screens.filter((screen) => !screen.is_system);
    screenList.open = true;
    screenList.append(element('summary', 'Экраны экспоната'), ...visible.map((screen, index) => screenEditor(path, id, screen, screens, visible, index)),
      formFor([['type', 'Тип нового экрана', screenTypes], ['title', 'Заголовок', 'required']], {type: 'text'}, 'Добавить экран', async (data) => {
        await content(path + '/screens', {...data, payload: JSON.stringify({version: 1, content: {body: ''}})});
        await openArtifact(id);
      }));
    editor.replaceChildren(element('h3', artifact.title), controls, details, screenList);
    editor.hidden = false;
  }

  function screenEditor(path, artifactID, screen, allScreens, screens, index) {
    const url = path + '/screens/' + encodeURIComponent(screen.id);
    let envelope;
    try { envelope = JSON.parse(screen.payload) || {}; } catch { envelope = {body: screen.payload || ''}; }
    const legacy = envelope.questions?.[0];
    const data = envelope.content || envelope;
    const values = {
      title: legacy?.q || screen.title, body: data.body || data.text || '',
      image_url: data.image_url || data.imageUrl || '', model_url: data.model_url || data.modelUrl || '',
      options: (data.options || legacy?.a || []).join('\n'), correct_answer: data.correct_answer || legacy?.a?.[legacy.correct] || '',
      explanation: data.explanation || '',
    };
    const fields = [['title', 'Заголовок', 'required'], ['body', 'Текст', 'textarea'], ['image_url', 'Адрес изображения']];
    if (screen.type === 'quiz') fields.push(['options', 'Варианты ответа, по одному на строку', 'textarea'],
      ['correct_answer', 'Точный текст правильного ответа'], ['explanation', 'Пояснение', 'textarea']);
    if (screen.type === 'model') fields.push(['model_url', 'Адрес 3D-модели']);
    const editor = formFor(fields, values, 'Сохранить экран', async ({title, ...next}) => {
      if (next.options !== undefined) next.options = next.options.split('\n').map((text) => text.trim()).filter(Boolean);
      if (next.correct_answer !== undefined) next.correct_answer = next.correct_answer.trim();
      const original = envelope.content || (legacy ? {} : data);
      const payload = {...envelope, version: 1, content: {...original, ...next}};
      if (legacy) {
        delete payload.questions;
        if (envelope.questions.length > 1) payload.content.legacy_questions = envelope.questions.slice(1);
      }
      await content(url, {title, payload: JSON.stringify(payload)}, 'PATCH');
      await openArtifact(artifactID);
      notify('Экран сохранён.');
    });
    const details = element('details');
    const actions = element('div', '', 'heading');
    const move = (step, label) => button(label, async () => {
      const reordered = [...screens];
      [reordered[index], reordered[index + step]] = [reordered[index + step], reordered[index]];
      let next = 0;
      const items = allScreens.map((item, order) => ({screenId: item.is_system ? item.id : reordered[next++].id, order: order + 1}));
      await content(path + '/screens/reorder', {items}, 'PUT');
      await openArtifact(artifactID);
    });
    if (index > 0) actions.append(move(-1, 'Выше'));
    if (index < screens.length - 1) actions.append(move(1, 'Ниже'));
    actions.append(button('Дублировать экран', async () => {
      await content(url + '/duplicate', {});
      await openArtifact(artifactID);
    }), button('Удалить экран', async () => {
      const reason = confirmation(`Удалить экран «${screen.title}»?`);
      if (!reason) return;
      await content(url, undefined, 'DELETE', reason);
      await openArtifact(artifactID);
    }));
    details.append(element('summary', `${screen.title} · ${screenTypes[screen.type] || screen.type}`), actions, editor,
      upload('Изображение экрана', imageTypes, async (file) => {
        const result = await content(url + '/image', file);
        editor.elements.image_url.value = result.image_url;
        notify('Изображение загружено. Сохраните экран, чтобы применить его.');
      }));
    if (screen.type === 'model') details.append(upload('3D-модель GLB', '.glb', async (file) => {
      const result = await content(url + '/model', file);
      editor.elements.model_url.value = result.model_url;
      notify('Модель загружена. Сохраните экран, чтобы применить её.');
    }));
    return details;
  }

  async function loadUsers(search = '', page = 0) {
    const {users, more} = await request('/admin/users?' + new URLSearchParams({q: search, page}));
    const mount = byId('users');
    const list = element('ul');
    const editor = element('div');
    const heading = element('div', '', 'heading');
    const invite = element('details');
    invite.append(element('summary', 'Пригласить пользователя'), formFor([
      ['full_name', 'Имя и фамилия', 'required'], ['email', 'Email', 'email'],
      ['role', 'Роль', {visitor: roles.visitor, methodist: roles.methodist}],
    ], {role: 'visitor'}, 'Отправить приглашение', async (data) => {
      await request('/admin/users', data);
      await loadUsers(data.email);
      notify('Аккаунт создан. Приглашение поставлено в очередь.');
    }));
    for (const user of users) {
      const item = element('li', `${user.full_name} · ${user.email} · ${roles[user.role] || user.role} · ${states[user.status.toUpperCase()] || user.status}`);
      item.append(' ', button('Открыть профиль', () => openUser(editor, user.id, () => loadUsers(search, page))));
      list.append(item);
    }
    if (!users.length) list.append(element('li', 'Пользователи не найдены.'));
    if (page > 0) heading.append(button('Предыдущая страница', () => loadUsers(search, page - 1)));
    if (more) heading.append(button('Следующая страница', () => loadUsers(search, page + 1)));
    mount.replaceChildren(element('h2', 'Пользователи'), invite,
      formFor([['q', 'Поиск по имени, email или ID']], {q: search}, 'Найти', ({q}) => loadUsers(q)), list, heading, editor);
  }

  async function loadExhibits(search = '', page = 0) {
    const {artifacts, more} = await request('/admin/exhibits?' + new URLSearchParams({q: search, page}));
    const list = element('ul');
    const pager = element('div', '', 'heading');
    for (const artifact of artifacts) {
      const row = element('li', `${artifact.title} · ${artifact.museum_name}`);
      row.append(' ', button('Открыть экспонат', async () => {
        if (getMuseum() !== artifact.museum_id) {
          const reason = confirmation(`Открыть музей «${artifact.museum_name}»?`);
          if (!reason) return;
          await request('/admin/context', {museum_id: artifact.museum_id, reason});
          clearWorkspace();
        }
        await loadCatalog();
        await openArtifact(artifact.id);
      }));
      list.append(row);
    }
    if (!artifacts.length) list.append(element('li', 'Экспонаты не найдены.'));
    if (page > 0) pager.append(button('Предыдущая страница', () => loadExhibits(search, page - 1)));
    if (more) pager.append(button('Следующая страница', () => loadExhibits(search, page + 1)));
    byId('exhibits').replaceChildren(element('h2', 'Экспонаты всех музеев'),
      formFor([['q', 'Поиск по названию, коду или ID']], {q: search}, 'Найти', ({q}) => loadExhibits(q)), list, pager);
  }

  async function openUser(editor, id, reload) {
    const url = '/admin/users/' + encodeURIComponent(id);
    const {user, museums} = await request(url);
    const state = user.status.toUpperCase();
    let languages = '';
    try { languages = JSON.parse(user.extra_languages || '[]').join(', '); } catch { languages = user.extra_languages || ''; }
    const controls = element('div', '', 'heading');
    const action = (path, label, message = '', feedback = 'Изменения сохранены.') => button(label, async () => {
      const reason = message ? confirmation(message) : '';
      if (message && !reason) return;
      await request(url + '/' + path, {reason});
      await reload();
      notify(feedback);
    });
    controls.append(action('reset-password', 'Отправить ссылку для пароля', '', 'Запрос поставлен в очередь отправки.'),
      action('revoke-sessions', 'Завершить сессии', 'Завершить все сессии пользователя?'));
    if (state === 'ACTIVE') controls.append(action('block', 'Заблокировать', 'Заблокировать аккаунт и завершить его сессии?'));
    if (state === 'DISABLED') controls.append(action('unblock', 'Разблокировать'));
    if (state === 'DORMANT') controls.append(action('restore', 'Отменить удаление'));
    else controls.append(action('delete', 'Запланировать удаление', 'Аккаунт будет деактивирован. Через 30 дней личные данные будут удалены. Для владельца сначала передайте владение.'));
    if (user.role === 'visitor') controls.append(action('methodist', 'Назначить методистом'));
    const links = element('ul');
    const available = getMuseums().filter((museum) => museum.admin_state !== 'archived');
    for (const museum of museums || []) {
      const name = available.find(({museum_id}) => museum_id === museum.id)?.name || museum.id;
      const row = element('li', `${name} · ${roles[museum.role] || museum.role}`);
      if (museum.role !== 'owner' && available.some(({museum_id}) => museum_id === museum.id)) {
        row.append(' ', button('Отозвать доступ', async () => {
          const reason = confirmation(`Отозвать доступ к музею «${name}»?`);
          if (!reason) return;
          await request(url + '/membership', {museum_id: museum.id, role: '', reason});
          await openUser(editor, id, reload);
        }));
      }
      links.append(row);
    }
    if (!links.children.length) links.append(element('li', 'Музеи не назначены.'));
    editor.replaceChildren(element('h3', user.full_name), element('p', `${user.email} · ID ${user.id}`), controls,
      formFor(userFields, {...user, extra_languages: languages, notifications_enabled: String(Boolean(user.notifications_enabled))}, 'Сохранить профиль', async (data) => {
        data.extra_languages = commaList(data.extra_languages);
        data.notifications_enabled = data.notifications_enabled === 'true';
        await request(url, data, 'PATCH');
        await openUser(editor, id, reload);
        notify('Профиль сохранён.');
      }),
      element('h4', 'Музеи пользователя'), links);
    if (available.length && ['ACTIVE', 'INVITED'].includes(state)) {
      const choices = Object.fromEntries(available.map((museum) => [museum.museum_id, museum.name]));
      editor.append(formFor([
        ['museum_id', 'Музей', choices],
        ['role', 'Роль в музее', {methodist: roles.methodist, museum_admin: roles.museum_admin, owner: roles.owner}],
      ], {museum_id: available[0].museum_id, role: 'methodist'}, 'Назначить роль в музее', async (data) => {
        const reason = data.role === 'owner' ? confirmation('Назначить нового владельца? Прежний владелец станет администратором музея.') : '';
        if (data.role === 'owner' && !reason) return;
        await request(url + '/membership', {...data, reason});
        await openUser(editor, id, reload);
        notify('Роль в музее обновлена.');
      }));
    }
    if (state === 'ACTIVE') editor.append(upload('Аватар пользователя', 'image/jpeg,image/png', async (data) => {
      await request(url + '/avatar', data);
      notify('Аватар обновлён.');
    }), formFor([['email', 'Новый email', 'email']], {}, 'Отправить подтверждение', async (data) => {
      await request(url + '/email', data);
      notify('Код отправлен на новый адрес. Пользователь может ввести его в своём профиле.');
    }));
  }

  return {renderMuseum, openArtifact, loadUsers, loadExhibits};
}
