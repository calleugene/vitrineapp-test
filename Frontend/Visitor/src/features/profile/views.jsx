import React, {useState, useEffect, useCallback} from 'react';
import {TextInput, Button} from '@gravity-ui/uikit';
import {PageHeader, EmptyState, MuseumThumbIcon} from '../../components/ui.jsx';
import {CollectionCard} from '../collection/views.jsx';
import {formatMinutes, progressPercent} from '../../app/utils.js';
import './profile.css';

// ==================
// Info bottom-sheet modal
// ==================

function HelpContent() {
  return (
    <>
      <div className="info-section">
        <h3 className="info-section-title">Часто задаваемые вопросы</h3>
        <div className="info-faq-item">
          <p className="info-faq-q">Как сканировать QR-код?</p>
          <p className="info-faq-a">Нажмите «Сканировать» внизу экрана и наведите камеру на QR-код экспоната — история откроется автоматически.</p>
        </div>
        <div className="info-faq-item">
          <p className="info-faq-q">Что такое коллекция?</p>
          <p className="info-faq-a">Все найденные артефакты сохраняются в коллекции. Зарегистрируйтесь, чтобы она сохранялась между устройствами.</p>
        </div>
        <div className="info-faq-item">
          <p className="info-faq-q">Как работает 3D / AR?</p>
          <p className="info-faq-a">В историях некоторых экспонатов доступен 3D-просмотр. Нажмите «Взаимодействовать» и вращайте объект пальцем.</p>
        </div>
      </div>
      <div className="info-section">
        <h3 className="info-section-title">Связаться с поддержкой</h3>
        <a href="mailto:support@viralabs.ru" className="info-contact-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          support@viralabs.ru
        </a>
      </div>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <div className="info-section">
        <p className="info-body-text" style={{color: '#aab0be', fontSize: 12}}>Последнее обновление: 20 июня 2026 г.</p>
        <p className="info-body-text">Приложение «Витрина» собирает минимальный объём данных, необходимый для работы сервиса.</p>
      </div>
      <div className="info-section">
        <h3 className="info-section-title">Какие данные мы собираем</h3>
        <ul className="info-list">
          <li>Имя и адрес электронной почты при регистрации</li>
          <li>Статистика посещённых музеев и найденных артефактов</li>
          <li>Анонимные аналитические события для улучшения сервиса</li>
        </ul>
      </div>
      <div className="info-section">
        <h3 className="info-section-title">Как мы используем данные</h3>
        <ul className="info-list">
          <li>Для сохранения прогресса и коллекции</li>
          <li>Для персонализированного опыта</li>
          <li>Мы не передаём данные третьим лицам</li>
        </ul>
      </div>
      <div className="info-section">
        <h3 className="info-section-title">Ваши права</h3>
        <p className="info-body-text">
          Удалить все данные можно через «Настройки → Удалить аккаунт». По вопросам:{' '}
          <a href="mailto:privacy@viralabs.ru" className="info-inline-link">privacy@viralabs.ru</a>
        </p>
      </div>
    </>
  );
}

function InfoModal({type, onClose}) {
  const handleKey = useCallback(e => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (!type) return null;
  const isHelp = type === 'help';

  return (
    <div className="info-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={isHelp ? 'Помощь и поддержка' : 'Политика конфиденциальности'}>
      <div className="info-modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="info-modal-handle" aria-hidden="true" />
        <div className="info-modal-header">
          <h2 className="info-modal-title">{isHelp ? 'Помощь и поддержка' : 'Политика конфиденциальности'}</h2>
          <button className="info-modal-close" type="button" onClick={onClose} aria-label="Закрыть">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="info-modal-body">
          {isHelp ? <HelpContent /> : <PrivacyContent />}
        </div>
      </div>
    </div>
  );
}

// ==================
// Shared sub-components
// ==================

function ProfileHeader({onSettings}) {
  return (
    <header className="page-header">
      <span className="page-header-logo">Витрина</span>
      <div className="page-header-right">
        {onSettings && (
          <button
            className="page-header-right-btn"
            type="button"
            onClick={onSettings}
            aria-label="Открыть настройки"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M10.5 3h3l.7 2.5 2.3 1.3 2.5-.8 1.5 2.6-1.8 1.9v2.6l1.8 1.9-1.5 2.6-2.5-.8-2.3 1.3L13.5 21h-3l-.7-2.5-2.3-1.3-2.5.8-1.5-2.6 1.8-1.9v-2.6L3.5 8.6 5 6l2.5.8 2.3-1.3L10.5 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}

function AvatarBadge({size = 80}) {
  return (
    <div
      className="avatar-badge"
      aria-hidden="true"
      style={{width: size, height: size}}
    >
      <svg width={Math.round(size * 0.44)} height={Math.round(size * 0.44)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function CurrentRouteCard({detail, profile, navigate}) {
  const route = profile?.current_route;
  const hasRoute = route || detail;

  if (!hasRoute) {
    return (
      <div className="route-empty-cta">
        <div className="route-empty-icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </div>
        <p className="route-empty-text">Ни одного маршрута не начато</p>
        <Button view="outlined" size="m" onClick={() => navigate('myMuseums')}>
          Выбрать музей
        </Button>
      </div>
    );
  }

  const routeTitle = route?.museum_name || detail?.name || 'Маршрут';
  const routeText = route
    ? `${route.found_artifacts} из ${route.total_artifacts} артефактов найдено`
    : `${detail.found_artifacts} из ${detail.total_artifacts} артефактов найдено`;
  const routePct = route?.progress_percent
    ?? progressPercent(detail.found_artifacts, detail.total_artifacts);

  return (
    <div className="panel-card">
      <div className="route-card">
        <div className="route-thumb" aria-hidden="true"><MuseumThumbIcon /></div>
        <div className="museum-progress">
          <div>
            <h2 style={{margin: 0, fontSize: 16, lineHeight: 1.2, fontWeight: 730}}>{routeTitle}</h2>
            <p className="app-subtitle" style={{margin: '6px 0 0', fontSize: 13}}>{routeText}</p>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{width: `${routePct}%`}} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AchievementCard({item}) {
  return (
    <div className="achievement-card">
      <div
        className="success-mark"
        style={{width: 64, height: 64, margin: '0 auto 10px', boxShadow: 'none', opacity: item.awarded ? 1 : 0.35}}
        aria-hidden="true"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="m12 3 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      </div>
      <h3>{item.title}</h3>
      <p>{item.awarded ? 'Получено' : item.description}</p>
    </div>
  );
}

// ==================
// Authorized profile home
// ==================

export function ProfileHomeView({data, navigate, actions}) {
  const profile = data.profile;
  const [modalType, setModalType] = useState(null);
  if (!profile) {
    return (
      <section className="app-view app-shell is-active" aria-label="Профиль">
        <div className="app-screen" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh'}}>
          {data.loading ? (
            <div style={{textAlign: 'center', color: '#8a8f9e'}}>
              <div style={{width: 32, height: 32, border: '3px solid rgba(105,91,255,0.15)', borderTopColor: '#695bff', borderRadius: '50%', animation: 'vl-spin 0.7s linear infinite', margin: '0 auto 12px'}} />
              <p>Загружаем профиль…</p>
            </div>
          ) : (
            <div style={{textAlign: 'center', color: '#8a8f9e'}}>
              <p>Не удалось загрузить профиль</p>
              <button className="text-button" type="button" onClick={() => actions.bootstrap()} style={{marginTop: 8}}>Повторить</button>
            </div>
          )}
        </div>
      </section>
    );
  }

  const displayCollection = (data.collection || []).slice(0, 4);

  return (
    <section className="app-view app-shell is-active" aria-label="Профиль">
      <div className="app-screen">
        <ProfileHeader onSettings={() => navigate('profileSettings')} />

        <div className="profile-hero-centered">
          <AvatarBadge size={88} />
          <h1 className="profile-greeting-text">
            Привет, {profile.display_name || 'исследователь'}!
          </h1>
          <span className="level-pill">{profile.level_name || 'Новичок'}</span>
        </div>

        <div className="section-head">
          <h2>Текущий маршрут</h2>
          <button className="small-link" type="button" onClick={() => navigate('myMuseums')}>Все музеи</button>
        </div>
        <CurrentRouteCard detail={data.museumDetail} profile={profile} navigate={navigate} />

        <div className="section-head">
          <h2>Статистика</h2>
        </div>
        <div className="stats-grid" style={{gridTemplateColumns: '1fr 1fr'}}>
          <div className="metric-card">
            <span className="metric-value">{profile.museums_visited || 0}</span>
            <span className="metric-label">музеев посещено</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{profile.routes_completed || 0}</span>
            <span className="metric-label">маршрутов пройдено</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{profile.artifacts_found || 0}</span>
            <span className="metric-label">артефактов найдено</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{formatMinutes(profile.minutes_in_stories)}</span>
            <span className="metric-label">в историях</span>
          </div>
        </div>

        <div className="section-head">
          <h2>Коллекция</h2>
          <button className="small-link" type="button" onClick={() => navigate('profileCollection')}>
            Смотреть все
          </button>
        </div>
        {displayCollection.length ? (
          <div className="collection-grid">
            {displayCollection.map((item) => (
              <CollectionCard
                key={item.id}
                item={item}
                onOpen={() => actions.openArtifactFromCollection(item.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Коллекция пуста"
            text="Найдите первый артефакт на маршруте — он появится здесь."
          />
        )}

        <div className="section-head">
          <h2>О приложении</h2>
        </div>
        <div className="about-rows">
          <button className="about-row" type="button" onClick={() => setModalType('help')}>
            <span>Помощь и поддержка</span>
            <svg className="about-row-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="about-row" type="button" onClick={() => setModalType('privacy')}>
            <span>Политика конфиденциальности</span>
            <svg className="about-row-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div style={{height: 24}} />
      </div>
      <InfoModal type={modalType} onClose={() => setModalType(null)} />
    </section>
  );
}

// ==================
// Guest profile
// ==================

export function ProfileGuestView({data, navigate}) {
  const profile = data.profile;

  return (
    <section className="app-view app-shell is-active" aria-label="Профиль">
      <div className="app-screen" style={{paddingBottom: 'calc(300px + var(--safe-bottom, 0px))'}}>
        <ProfileHeader />

        <div className="profile-hero-centered">
          <AvatarBadge size={88} />
          <h1 className="profile-greeting-text">Привет, исследователь!</h1>
        </div>

        <div className="section-head">
          <h2>Текущий маршрут</h2>
          <button className="small-link" type="button" onClick={() => navigate('myMuseums')}>Все музеи</button>
        </div>
        <CurrentRouteCard detail={data.museumDetail} profile={profile} navigate={navigate} />

        <div className="section-head">
          <h2>Моя коллекция</h2>
        </div>
        <div className="guest-ghost-grid" aria-hidden="true">
          <div className="guest-ghost-tile" />
          <div className="guest-ghost-tile" />
          <div className="guest-ghost-tile" />
          <div className="guest-ghost-tile" />
        </div>
      </div>

      <div className="guest-lock-panel">
        <div className="guest-lock-gradient" aria-hidden="true" />
        <div className="guest-lock-body">
          <div className="guest-lock-badge" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="guest-lock-title">Сохраните прогресс</h2>
          <ul className="guest-lock-perks">
            <li>Коллекция и достижения в облаке</li>
            <li>История маршрутов и статистика</li>
            <li>Доступ с любого устройства</li>
          </ul>
          <Button view="action" size="l" width="max" onClick={() => navigate('auth')}>
            Зарегистрироваться
          </Button>
          <button className="guest-lock-signin" type="button" onClick={() => navigate('auth')}>
            Уже есть аккаунт? <strong>Войти</strong>
          </button>
        </div>
      </div>
    </section>
  );
}

// ==================
// Public profile
// ==================

export function PublicProfileView({data, navigate: _navigate}) {
  const profile = data.profile;
  const displayCollection = (data.collection || []).slice(0, 4);
  const visitorId = data.visitor?.id || '001';

  return (
    <section className="app-view app-shell is-active" aria-label="Публичный профиль">
      <div className="app-screen">
        <header className="page-header">
          <span className="page-header-logo">Витрина</span>
          <div className="page-header-right" aria-hidden="true" />
        </header>

        <div className="public-profile-hero">
          <AvatarBadge size={96} />
          <h1 className="public-profile-name">
            {profile?.display_name || 'Исследователь'}
          </h1>
          <span className="public-profile-link">viralabs.ru/id{visitorId.slice(-3).padStart(3, '0')}</span>
        </div>

        <div className="section-head">
          <h2>Статистика</h2>
        </div>
        <div className="stats-grid" style={{gridTemplateColumns: '1fr 1fr'}}>
          <div className="metric-card">
            <span className="metric-value">{profile?.museums_visited || 0}</span>
            <span className="metric-label">музеев посещено</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{profile?.routes_completed || 0}</span>
            <span className="metric-label">маршрутов пройдено</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{profile?.artifacts_found || 0}</span>
            <span className="metric-label">артефактов найдено</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{formatMinutes(profile?.minutes_in_stories)}</span>
            <span className="metric-label">в историях</span>
          </div>
        </div>

        <div className="section-head">
          <h2>Коллекция</h2>
        </div>
        {displayCollection.length ? (
          <div className="collection-grid">
            {displayCollection.map((item) => (
              <CollectionCard key={item.id} item={item} onOpen={() => {}} />
            ))}
          </div>
        ) : (
          <div className="helper-note">Коллекция пока пуста.</div>
        )}

        <div style={{height: 24}} />
      </div>
    </section>
  );
}

// ==================
// Settings
// ==================

export function ProfileSettingsView({data, navigate, actions}) {
  const profile = data.profile;
  const displayName = profile?.display_name || '';
  const nameParts = displayName.split(' ');

  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') || '');
  const [email, setEmail] = useState(profile?.email || 'user@example.com');

  // 'unverified' | 'sending' | 'sent' | 'verified'
  const [emailStatus, setEmailStatus] = useState('unverified');
  const [emailTimer, setEmailTimer] = useState(0);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const visitorId = data.visitor?.id || '001';
  const pwMismatch = confirmPw.length > 0 && newPw !== confirmPw;
  const pwCanSubmit = currentPw.length > 0 && newPw.length >= 6 && newPw === confirmPw;

  // Email verification countdown
  useEffect(() => {
    if (emailTimer <= 0) return;
    const id = setTimeout(() => setEmailTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [emailTimer]);

  const handleSendVerification = async () => {
    setEmailStatus('sending');
    await new Promise(r => setTimeout(r, 800));
    setEmailStatus('sent');
    setEmailTimer(60);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    await new Promise(r => setTimeout(r, 600));
    setSavingProfile(false);
  };

  const handleSavePassword = async () => {
    setSavingPw(true);
    await new Promise(r => setTimeout(r, 800));
    setSavingPw(false);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
  };

  return (
    <section className="app-view app-shell is-active" aria-label="Настройки">
      <div className="app-screen">
        <PageHeader title="Настройки" onBack={() => navigate('profileHome')} />

        <div className="settings-profile-mini">
          <div className="settings-profile-avatar" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div className="settings-profile-info">
            <p className="settings-profile-name">
              {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Имя Фамилия'}
            </p>
            <span className="settings-profile-link">
              viralabs.ru/id{visitorId.slice(-3).padStart(3, '0')}
            </span>
          </div>
        </div>

        {/* Основное */}
        <div className="settings-section">
          <p className="settings-section-label">Основное</p>
          <div className="settings-field">
            <label className="settings-field-label">Имя</label>
            <TextInput
              placeholder="Ваше имя"
              value={firstName}
              onUpdate={setFirstName}
              size="l"
              autoComplete="given-name"
            />
          </div>
          <div className="settings-field">
            <label className="settings-field-label">Фамилия</label>
            <TextInput
              placeholder="Ваша фамилия"
              value={lastName}
              onUpdate={setLastName}
              size="l"
              autoComplete="family-name"
            />
          </div>
          <Button
            view="action"
            size="l"
            width="max"
            loading={savingProfile}
            onClick={handleSaveProfile}
          >
            Сохранить
          </Button>
        </div>

        {/* Электронная почта */}
        <div className="settings-section">
          <p className="settings-section-label">Электронная почта</p>
          <div className="settings-field">
            <label className="settings-field-label">Адрес</label>
            <TextInput
              type="email"
              placeholder="you@example.com"
              value={email}
              onUpdate={setEmail}
              size="l"
              autoComplete="email"
            />
          </div>

          {emailStatus === 'unverified' && (
            <div className="email-warning">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{flexShrink: 0, marginTop: 1}}>
                <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="email-warning-text">
                Электронная почта не подтверждена
                <button className="email-warning-link" type="button" onClick={handleSendVerification}>
                  Подтвердить
                </button>
              </div>
            </div>
          )}

          {emailStatus === 'sending' && (
            <div className="email-status-row email-status-sending">
              <div className="email-status-spinner" aria-hidden="true" />
              <span>Отправляем письмо…</span>
            </div>
          )}

          {emailStatus === 'sent' && (
            <div className="email-status-row email-status-sent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{flexShrink: 0}}>
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="email-sent-content">
                <span>Письмо отправлено на {email}</span>
                {emailTimer > 0 ? (
                  <span className="email-resend-timer">Повторить через {emailTimer} с</span>
                ) : (
                  <button className="email-resend-btn" type="button" onClick={handleSendVerification}>
                    Отправить повторно
                  </button>
                )}
              </div>
            </div>
          )}

          {emailStatus === 'verified' && (
            <div className="email-status-row email-status-verified">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{flexShrink: 0}}>
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Электронная почта подтверждена</span>
            </div>
          )}
        </div>

        {/* Сменить пароль */}
        <div className="settings-section">
          <p className="settings-section-label">Сменить пароль</p>
          <div className="settings-field">
            <label className="settings-field-label">Текущий пароль</label>
            <TextInput
              type="password"
              placeholder="••••••••"
              value={currentPw}
              onUpdate={setCurrentPw}
              size="l"
              autoComplete="current-password"
            />
          </div>
          <div className="settings-field">
            <label className="settings-field-label">Новый пароль</label>
            <TextInput
              type="password"
              placeholder="Минимум 6 символов"
              value={newPw}
              onUpdate={setNewPw}
              size="l"
              autoComplete="new-password"
            />
          </div>
          <div className="settings-field">
            <label className="settings-field-label">Повторите пароль</label>
            <TextInput
              type="password"
              placeholder="••••••••"
              value={confirmPw}
              onUpdate={setConfirmPw}
              size="l"
              autoComplete="new-password"
            />
            {pwMismatch && (
              <p className="field-error-msg">Пароли не совпадают</p>
            )}
          </div>
          <Button
            view="outlined"
            size="l"
            width="max"
            disabled={!pwCanSubmit}
            loading={savingPw}
            onClick={handleSavePassword}
          >
            Сменить пароль
          </Button>
        </div>

        {/* Аккаунт */}
        <div className="settings-section">
          <p className="settings-section-label">Аккаунт</p>
          <button
            className="settings-logout-row"
            type="button"
            onClick={() => { actions.logout(); navigate('auth'); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Выйти из аккаунта</span>
          </button>
        </div>

        {/* Опасная зона */}
        <div className="settings-section settings-danger-section">
          <p className="settings-section-label">Опасная зона</p>
          <Button
            view="outlined-danger"
            size="l"
            width="max"
            onClick={() => navigate('deleteAccount')}
          >
            Удалить аккаунт
          </Button>
        </div>

        <div style={{height: 16}} />
      </div>
    </section>
  );
}

// ==================
// Delete account confirmation
// ==================

export function DeleteAccountView({navigate, actions}) {
  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirmed) return;
    setDeleting(true);
    await new Promise((r) => setTimeout(r, 800));
    setDeleting(false);
    actions.logout();
    navigate('accountDeleted');
  };

  return (
    <section className="delete-account-screen" aria-label="Удаление аккаунта">
      <div className="delete-account-body">
        <div className="delete-danger-icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="delete-account-title">Удаление аккаунта</h1>
        <p className="delete-account-text">
          Все данные, прогресс и коллекция будут безвозвратно удалены. Это действие нельзя отменить.
        </p>

        <label className="confirm-check-label">
          <input
            type="checkbox"
            className="confirm-check-input"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
          />
          <span className="confirm-check-box" aria-hidden="true">
            {confirmed && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="confirm-check-text">Понимаю, что данные удалятся безвозвратно</span>
        </label>
      </div>

      <div className="delete-account-actions">
        <Button
          view="outlined"
          size="xl"
          width="max"
          onClick={() => navigate('profileSettings')}
        >
          Отмена
        </Button>
        <Button
          view="outlined-danger"
          size="xl"
          width="max"
          loading={deleting}
          disabled={!confirmed}
          onClick={handleDelete}
        >
          Удалить аккаунт
        </Button>
      </div>
    </section>
  );
}

// ==================
// Account deleted
// ==================

export function AccountDeletedView({navigate}) {
  return (
    <section className="account-deleted-screen" aria-label="Аккаунт удалён">
      <div className="account-deleted-close">
        <button className="icon-button" type="button" onClick={() => navigate('museumSelect')} aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="account-deleted-body">
        <h1 className="account-deleted-title">Аккаунт удалён</h1>
        <p className="account-deleted-text">Будем рады Вас видеть вновь!</p>
      </div>

      <div className="account-deleted-footer">
        <Button view="action" size="xl" width="max" onClick={() => navigate('auth')}>
          Регистрация
        </Button>
      </div>
    </section>
  );
}

// ==================
// Achievements
// ==================

export function ProfileAchievementsView({data, navigate}) {
  const [tab, setTab] = useState('all');
  const achievements = data.achievements || [];
  const awarded = achievements.filter((item) => item.awarded);
  const locked = achievements.filter((item) => !item.awarded);
  const filtered = tab === 'awarded' ? awarded : tab === 'locked' ? locked : achievements;

  return (
    <section className="app-view app-shell is-active" aria-label="Достижения">
      <div className="app-screen">
        <PageHeader title="Достижения" onBack={() => navigate('profileHome')} />
        <p className="app-subtitle">{awarded.length} из {achievements.length} получено</p>
        <div className="pill-tabs">
          <button className={`seg-button ${tab === 'all' ? 'is-active' : ''}`} type="button" onClick={() => setTab('all')}>Все</button>
          <button className={`seg-button ${tab === 'awarded' ? 'is-active' : ''}`} type="button" onClick={() => setTab('awarded')}>
            Полученные {awarded.length > 0 && <span className="tab-badge">{awarded.length}</span>}
          </button>
          <button className={`seg-button ${tab === 'locked' ? 'is-active' : ''}`} type="button" onClick={() => setTab('locked')}>Не получены</button>
        </div>
        {filtered.length ? (
          <div className="collection-grid">
            {filtered.map((item) => <AchievementCard key={item.id} item={item} />)}
          </div>
        ) : (
          <EmptyState
            title={tab === 'awarded' ? 'Нет полученных достижений' : tab === 'locked' ? 'Все достижения получены!' : 'Достижений пока нет'}
            text={tab === 'awarded' ? 'Находите артефакты — первые достижения откроются быстро.' : 'Отлично! Вы получили все доступные достижения.'}
          />
        )}
      </div>
    </section>
  );
}
