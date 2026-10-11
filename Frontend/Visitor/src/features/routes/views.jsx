import React, {useState} from 'react';
import {PageHeader, MuseumThumbIcon} from '../../components/ui.jsx';
import {useToast} from '../../components/Toast.jsx';
import {formatMinutes} from '../../app/utils.js';

const STATUS_LABEL = {
  completed: 'Завершено',
  in_progress: 'В процессе',
};

export function MyMuseumsView({data, navigate, actions}) {
  const [tab, setTab] = useState('all');
  const museums = data.museums || [];
  const completed = museums.filter((m) => m.status === 'completed');
  const inProgress = museums.filter((m) => m.status === 'in_progress');
  const filtered = tab === 'completed' ? completed : tab === 'in_progress' ? inProgress : museums;

  const openRoute = async (routeId) => {
    await actions.loadRouteResult(routeId);
    navigate('routeResult');
  };

  return (
    <section className="app-view app-shell is-active" aria-label="Мои музеи">
      <div className="app-screen">
        <PageHeader title="Мои музеи" onBack={() => navigate('profileHome')} />
        <div className="pill-tabs">
          <button className={`seg-button ${tab === 'all' ? 'is-active' : ''}`} type="button" onClick={() => setTab('all')}>Все</button>
          <button className={`seg-button ${tab === 'completed' ? 'is-active' : ''}`} type="button" onClick={() => setTab('completed')}>
            Завершённые {completed.length > 0 && <span className="tab-badge">{completed.length}</span>}
          </button>
          <button className={`seg-button ${tab === 'in_progress' ? 'is-active' : ''}`} type="button" onClick={() => setTab('in_progress')}>В процессе</button>
        </div>
        {filtered.length ? (
          <div className="profile-list">
            {filtered.map((museum) => (
              <button key={museum.id} className="museum-card" type="button" onClick={() => openRoute(museum.route_id)}>
                <span className="museum-thumb" aria-hidden="true"><MuseumThumbIcon /></span>
                <span>
                  <h2>{museum.name}</h2>
                  <p>
                    {museum.found_artifacts} из {museum.total_artifacts} артефактов
                    <br />
                    {STATUS_LABEL[museum.status] || 'Новый маршрут'}
                  </p>
                </span>
                <span className={`artifact-status ${museum.status === 'completed' ? 'found' : ''}`}>{museum.estimated_minutes} мин</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="app-subtitle" style={{marginTop: 24, textAlign: 'center'}}>
            {tab === 'completed' ? 'Завершённых маршрутов пока нет.' : 'Нет маршрутов в процессе.'}
          </p>
        )}
      </div>
    </section>
  );
}

export function RouteResultView({data, navigate}) {
  const toast = useToast();
  const result = data.routeResult;
  if (!result) {
    return (
      <section className="app-view app-shell is-active" aria-label="Загрузка результата">
        <div className="received-layout" style={{alignItems: 'center', justifyContent: 'center', minHeight: '60vh'}}>
          {data.loading ? (
            <div style={{textAlign: 'center', color: '#8a8f9e'}}>
              <div style={{width: 32, height: 32, border: '3px solid rgba(105,91,255,0.15)', borderTopColor: '#695bff', borderRadius: '50%', animation: 'vl-spin 0.7s linear infinite', margin: '0 auto 12px'}} />
              <p>Загружаем результат…</p>
            </div>
          ) : (
            <div style={{textAlign: 'center', color: '#8a8f9e'}}>
              <p>Результат маршрута не найден</p>
              <button className="text-button" type="button" onClick={() => navigate('myMuseums')} style={{marginTop: 8}}>Вернуться к музеям</button>
            </div>
          )}
        </div>
      </section>
    );
  }

  const handleShare = async () => {
    const text = result.completed
      ? `Прошёл маршрут в «${result.museum_name}» — нашёл все ${result.total_artifacts} экспонатов! Попробуй Витрину.`
      : `Исследую «${result.museum_name}» — уже нашёл ${result.found_artifacts} из ${result.total_artifacts} артефактов. Присоединяйся!`;
    if (navigator.share) {
      try {
        await navigator.share({title: 'Витрина', text});
      } catch {
        // user dismissed native share sheet — no feedback needed
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toast.show('Текст скопирован в буфер обмена', {type: 'success'});
      } catch {
        toast.show('Не удалось скопировать текст', {type: 'error'});
      }
    }
  };

  return (
    <section className="app-view app-shell is-active" aria-label="Результат маршрута">
      <div className="received-layout">
        <div className="success-mark" aria-hidden="true">
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
            <path d="M7 5h10v3a5 5 0 0 1-10 0V5Zm-2 1H3a3 3 0 0 0 3 3m13-3h2a3 3 0 0 1-3 3M12 13v4m-3 3h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1>{result.completed ? 'Маршрут завершён!' : 'Маршрут в процессе'}</h1>
        <p>
          {result.completed
            ? `Вы собрали все артефакты музея ${result.museum_name}. Отличная работа.`
            : `Вы уже нашли ${result.found_artifacts} артефактов в музее ${result.museum_name}. Продолжайте маршрут.`}
        </p>
        <div className="panel-card" style={{width: '100%', maxWidth: 330, textAlign: 'left', marginTop: 16}}>
          <div className="meta-list">
            <div className="meta-row"><span>Найдено артефактов</span><strong>{result.found_artifacts} из {result.total_artifacts}</strong></div>
            <div className="meta-row"><span>Время прохождения</span><strong>{formatMinutes(result.minutes_spent)}</strong></div>
            <div className="meta-row"><span>Средний темп</span><strong>{result.average_artifact_pace || 0} мин на артефакт</strong></div>
            <div className="meta-row"><span>Достижений открыто</span><strong>{(result.achievements_unlocked || []).length}</strong></div>
          </div>
        </div>
        <div className="sticky-actions">
          <button className="primary-button app-cta" type="button" onClick={handleShare}>Поделиться результатом</button>
          <button className="outline-button app-cta" type="button" onClick={() => navigate('myMuseums')}>Пройти ещё музей</button>
        </div>
      </div>
    </section>
  );
}
