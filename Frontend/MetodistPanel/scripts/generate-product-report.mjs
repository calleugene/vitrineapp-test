import {mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backlogPath = join(root, 'PRODUCT_BACKLOG.md');
const externalWorkPath = join(root, 'PRODUCT_EXTERNAL_WORK.md');
const reportPath = join(root, 'PRODUCT_REPORT.html');
const siteReportPath = join(root, 'public', 'updates.html');
const statuses = ['READY', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
const tasks = [];
const seenIds = new Set();

for (const sourcePath of [backlogPath, externalWorkPath]) {
  let status = '';
  let task = null;
  const source = readFileSync(sourcePath, 'utf8');
  for (const line of source.split(/\r?\n/)) {
    const section = line.match(/^## (READY|IN_PROGRESS|BLOCKED|DONE)$/);
    if (section) {
      status = section[1];
      task = null;
      continue;
    }

    if (/^## /.test(line)) {
      status = '';
      task = null;
      continue;
    }

    const heading = line.match(/^### ([A-Z]+-\d+) · (P\d+) · (.+)$/);
    if (heading && status) {
      task = null;
      if (!seenIds.has(heading[1])) {
        task = {id: heading[1], priority: heading[2], title: heading[3], status, details: []};
        seenIds.add(task.id);
        tasks.push(task);
      }
      continue;
    }

    const detail = line.match(/^- \*\*(.+?):\*\* (.+)$/);
    if (detail && task) task.details.push({label: detail[1], value: detail[2]});
  }
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const renderInline = (value) => escapeHtml(value)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const count = (value) => tasks.filter((item) => item.status === value).length;
const labels = {READY: 'Готово к работе', IN_PROGRESS: 'В работе', BLOCKED: 'Нужна сверка', DONE: 'Сделано'};
const descriptions = {
  READY: 'Подтверждённые задачи, которые можно взять в разработку.',
  IN_PROGRESS: 'Активные изменения с проверками.',
  BLOCKED: 'Требуют решения по контракту или зависимости.',
  DONE: 'Завершённые задачи и проверенная история.',
};
const taskHtml = (item) => `<article class="task">
  <div class="task-top"><span class="task-id">${escapeHtml(item.id)}</span><span class="priority">${escapeHtml(item.priority)}</span></div>
  <h3>${escapeHtml(item.title)}</h3>
  <dl>${item.details.map(({label, value}) => `<div><dt>${escapeHtml(label)}</dt><dd>${renderInline(value)}</dd></div>`).join('')}</dl>
</article>`;
const sectionsHtml = statuses.map((item) => `<section class="section" id="${item.toLowerCase()}">
  <div class="section-head"><div><span class="eyebrow">${escapeHtml(item)}</span><h2>${labels[item]}</h2><p>${descriptions[item]}</p></div><span class="section-count">${count(item)}</span></div>
  <div class="task-grid">${tasks.filter((taskItem) => taskItem.status === item).map(taskHtml).join('') || '<div class="empty">Пока нет задач в этом статусе.</div>'}</div>
</section>`).join('');
const updated = new Intl.DateTimeFormat('ru-RU', {dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Berlin'}).format(new Date());

const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="60">
  <title>Панель методиста — продуктовый отчёт</title>
  <style>
    :root {font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:#192238; background:#f5f7fb; font-synthesis:none}
    * {box-sizing:border-box} body {margin:0} a {color:inherit} .wrap {max-width:1180px; margin:auto; padding:42px 28px 80px}
    .hero {padding:42px; border-radius:28px; color:#fff; background:linear-gradient(125deg,#14233f,#283b6a 63%,#4862a3); box-shadow:0 20px 50px #253b691a}
    .eyebrow {font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.14em; color:#5b72a5} .hero .eyebrow {color:#a9c3ff}
    h1 {font-size:clamp(32px,5vw,54px); line-height:1.05; letter-spacing:-.04em; margin:12px 0 16px} .hero p {max-width:730px; color:#d8e2fa; line-height:1.6; margin:0}
    .meta {display:flex; gap:18px; flex-wrap:wrap; align-items:center; margin-top:26px; color:#d8e2fa; font-size:14px}.meta a {text-decoration:none; border-bottom:1px solid #a9c3ff}
    .journey {display:flex; gap:8px; flex-wrap:wrap; margin:22px 0 26px; padding:0; list-style:none}.journey li {background:#e7edfa; color:#304771; padding:10px 14px; border-radius:999px; font-size:13px; font-weight:650}.journey li:not(:last-child)::after {content:' →'; padding-left:12px; color:#7588af}
    .summary {display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px}.metric {background:#fff; border:1px solid #e5eaf3; border-radius:18px; padding:20px 22px; box-shadow:0 7px 25px #23365d08}.metric strong {display:block; font-size:32px; line-height:1}.metric span {display:block; color:#61708c; font-size:13px; margin-top:9px}
    .section {margin-top:50px}.section-head {display:flex; justify-content:space-between; gap:20px; align-items:end; margin-bottom:20px}.section-head h2 {font-size:29px; letter-spacing:-.03em; margin:6px 0}.section-head p {margin:0; color:#64728b; font-size:14px}.section-count {background:#e4eaf7; color:#324974; min-width:44px; height:44px; display:grid; place-items:center; border-radius:14px; font-weight:800}
    .task-grid {display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px}.task,.empty {background:#fff; border:1px solid #e5eaf3; border-radius:20px; padding:24px; box-shadow:0 7px 25px #23365d08}.task-top {display:flex; gap:10px; align-items:center}.task-id {font-size:12px; font-weight:800; letter-spacing:.08em; color:#496295}.priority {font-size:11px; font-weight:800; background:#fff0e5; color:#ad4b1d; border-radius:6px; padding:4px 7px}.task h3 {font-size:19px; margin:14px 0 20px; line-height:1.35}.task dl {margin:0; display:grid; gap:14px}.task dt {font-size:12px; font-weight:800; color:#445777; margin-bottom:4px}.task dd {margin:0; color:#45536d; font-size:14px; line-height:1.55; overflow-wrap:anywhere}.task code {font-size:12px; background:#eef2f9; padding:2px 4px; border-radius:4px}.empty {color:#748198; grid-column:1/-1}
    footer {margin-top:54px; color:#7b879b; font-size:12px; line-height:1.5} footer a {color:#526ba0}
    @media(max-width:720px){.wrap {padding:18px 14px 50px}.hero {padding:28px 24px}.summary {grid-template-columns:repeat(2,1fr)}.task-grid {grid-template-columns:1fr}.journey li {font-size:12px}.section {margin-top:38px}}
    @media print {.wrap {padding:0}.hero {box-shadow:none}.metric,.task,.empty {box-shadow:none}.section {break-inside:avoid}}
  </style>
</head>
<body>
  <main class="wrap">
    <header class="hero"><span class="eyebrow">Product & Engineering</span><h1>Панель методиста</h1><p>Проверяемый бэклог улучшений пути от регистрации до публикации артефакта. Задачи формирует продуктовый менеджер, реализует фронтенд-разработчик.</p><div class="meta"><span>Обновлено: ${escapeHtml(updated)} · Europe/Berlin</span><a href="/methodist/">Открыть панель</a></div></header>
    <ol class="journey"><li>Регистрация</li><li>Вход</li><li>Музей</li><li>Артефакт</li><li>Публикация</li><li>Visitor</li></ol>
    <div class="summary">${statuses.map((item) => `<div class="metric"><strong>${count(item)}</strong><span>${labels[item]}</span></div>`).join('')}</div>
    ${sectionsHtml}
    <footer>Отчёт сформирован из PRODUCT_BACKLOG.md и PRODUCT_EXTERNAL_WORK.md; открытая страница автоматически перечитывается раз в минуту. Статус DONE означает завершение указанной задачи с ограничениями, записанными в её карточке; он не означает завершение всего пользовательского пути.</footer>
  </main>
</body>
</html>
`;

mkdirSync(join(root, 'public'), {recursive: true});
for (const [index, target] of [reportPath, siteReportPath].entries()) {
  const temporaryPath = join(root, `.product-report-${process.pid}-${index}.tmp`);
  writeFileSync(temporaryPath, html, 'utf8');
  renameSync(temporaryPath, target);
}
console.log(`Обновлены ${reportPath} и ${siteReportPath}: ${tasks.length} задач`);
