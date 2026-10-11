import React, {useState, useEffect} from 'react';
import './auth.css';

function EyeOpen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7"/>
    </svg>
  );
}

function EyeClosed() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07A3 3 0 1 1 9.88 9.88" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}

function BrandMark() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="vl-grad" x1="6" y1="4" x2="38" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#695bff"/>
          <stop offset="1" stopColor="#9b8fff"/>
        </linearGradient>
      </defs>
      <path d="M22 4L38 13V31L22 40L6 31V13L22 4Z" fill="url(#vl-grad)"/>
      <path d="M22 4L38 13V31L22 40L6 31V13L22 4Z" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
      <path d="M14 18l8 12 8-12" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function InputField({label, id, type, value, onChange, onBlur, placeholder, autoComplete, error, showToggle, showPw, onTogglePw}) {
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>{label}</label>
      <div className={`auth-input-wrap${error ? ' has-error' : ''}`}>
        <input
          id={id}
          type={showToggle ? (showPw ? 'text' : 'password') : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="auth-input"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {showToggle && (
          <button
            type="button"
            className="auth-pw-toggle"
            onClick={onTogglePw}
            aria-label={showPw ? 'Скрыть пароль' : 'Показать пароль'}
            tabIndex={-1}
          >
            {showPw ? <EyeClosed /> : <EyeOpen />}
          </button>
        )}
      </div>
      {error && <span id={`${id}-error`} className="auth-field-error" role="alert">{error}</span>}
    </div>
  );
}

export function AuthView({navigate, actions}) {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isLoginValid = validateEmail(email) && password.length > 0;
	const isRegisterValid = validateEmail(email) && password.length >= 12;
  const isValid = tab === 'login' ? isLoginValid : isRegisterValid;

  const handleEmailBlur = () => {
    if (email && !validateEmail(email)) {
      setEmailError('Введите корректный email-адрес');
    } else {
      setEmailError('');
    }
  };

  const handleTabSwitch = (t) => {
    setTab(t);
    setServerError('');
    setEmailError('');
    setShowPw(false);
  };

  const handleSubmit = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    setServerError('');
    try {
		await actions.login({email, password, register: tab === 'register'});
		navigate('profileHome');
	} catch (error) {
		setServerError(error?.status === 409 ? 'Этот email уже зарегистрирован. Войдите в аккаунт.' : 'Неверный email или пароль. Проверьте данные и попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-screen" aria-label={tab === 'login' ? 'Авторизация' : 'Регистрация'}>
      <div className="auth-blob" aria-hidden="true"/>
      <div className="auth-inner">
        <div className="auth-close-row">
          <button className="auth-close-btn" type="button" onClick={() => navigate('profileHome')} aria-label="Закрыть">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="auth-brand">
          <BrandMark/>
          <div className="auth-brand-wordmark">Витрина</div>
          <div className="auth-brand-tagline">AR-экскурсии в браузере</div>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            className={`auth-tab${tab === 'login' ? ' is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            onClick={() => handleTabSwitch('login')}
          >
            Войти
          </button>
          <button
            className={`auth-tab${tab === 'register' ? ' is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={tab === 'register'}
            onClick={() => handleTabSwitch('register')}
          >
            Регистрация
          </button>
        </div>

        {serverError && (
          <div className="auth-server-error" role="alert">{serverError}</div>
        )}

        <div className="auth-fields">
          <InputField
            id="auth-email"
            label="Эл. почта"
            type="email"
            value={email}
            onChange={setEmail}
            onBlur={handleEmailBlur}
            placeholder="you@example.com"
            autoComplete="email"
            error={emailError}
          />
          <InputField
            id="auth-password"
            label="Пароль"
            type="password"
            value={password}
            onChange={setPassword}
			placeholder={tab === 'login' ? '••••••••' : 'Минимум 12 символов'}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            showToggle
            showPw={showPw}
            onTogglePw={() => setShowPw(v => !v)}
          />
        </div>

        {tab === 'login' && (
          <div className="auth-forgot-row">
            <button className="auth-forgot-btn" type="button" onClick={() => navigate('forgotPassword')}>
              Забыли пароль?
            </button>
          </div>
        )}

        {tab === 'register' && password.length > 0 && (
          <div className="pw-reqs" aria-live="polite">
			<div className={`pw-req${password.length >= 12 ? ' is-met' : ''}`}>
              <span className="pw-req-dot" aria-hidden="true"/>
				Минимум 12 символов
            </div>
            <div className={`pw-req${/[A-Za-z]/.test(password) ? ' is-met' : ''}`}>
              <span className="pw-req-dot" aria-hidden="true"/>
              Содержит буквы
            </div>
          </div>
        )}

        <div className="auth-cta-group">
          <button
            className="auth-cta-btn"
            type="button"
            disabled={!isValid || loading}
            onClick={handleSubmit}
            aria-busy={loading}
          >
            {loading && <span className="auth-spinner" aria-hidden="true"/>}
            {tab === 'login' ? 'Войти в аккаунт' : 'Создать аккаунт'}
          </button>

          <div className="auth-switch-row">
            {tab === 'login' ? (
              <button className="auth-switch-btn" type="button" onClick={() => handleTabSwitch('register')}>
                Нет аккаунта? <span className="auth-switch-accent">Зарегистрироваться</span>
              </button>
            ) : (
              <button className="auth-switch-btn" type="button" onClick={() => handleTabSwitch('login')}>
                Уже есть аккаунт? <span className="auth-switch-accent">Войти</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ForgotPasswordView({navigate}) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleEmailBlur = () => {
    if (email && !validateEmail(email)) {
      setEmailError('Введите корректный email-адрес');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async () => {
    if (!validateEmail(email) || loading) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    navigate('forgotPasswordSent');
  };

  return (
    <section className="auth-screen" aria-label="Восстановление пароля">
      <div className="auth-blob" aria-hidden="true"/>
      <div className="auth-inner">
        <div className="auth-close-row">
          <button className="auth-close-btn" type="button" onClick={() => navigate('auth')} aria-label="Закрыть">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="auth-brand">
          <BrandMark/>
          <div className="auth-brand-wordmark">Витрина</div>
        </div>

        <div className="auth-section-head">
          <h1 className="auth-section-title">Восстановление пароля</h1>
          <p className="auth-section-sub">Введите email — мы отправим ссылку для сброса</p>
        </div>

        <div className="auth-fields">
          <InputField
            id="recovery-email"
            label="Эл. почта"
            type="email"
            value={email}
            onChange={setEmail}
            onBlur={handleEmailBlur}
            placeholder="you@example.com"
            autoComplete="email"
            error={emailError}
          />
        </div>

        <div className="auth-cta-group" style={{marginTop: 24}}>
          <button
            className="auth-cta-btn"
            type="button"
            disabled={!validateEmail(email) || loading}
            onClick={handleSubmit}
            aria-busy={loading}
          >
            {loading && <span className="auth-spinner" aria-hidden="true"/>}
            Отправить ссылку
          </button>

          <div className="auth-switch-row">
            <button className="auth-switch-btn" type="button" onClick={() => navigate('auth')}>
              Вспомнили пароль? <span className="auth-switch-accent">Войти</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ForgotPasswordSentView({navigate}) {
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  return (
    <section className="auth-success-screen" aria-label="Письмо отправлено">
      <div className="auth-success-close">
        <button className="auth-close-btn" type="button" onClick={() => navigate('auth')} aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="email-sent-body">
        <div className="email-sent-icon" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path d="M3 8l9 6 9-6M3 8v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8M3 8l2-2h14l2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h1 className="email-sent-title">Письмо отправлено</h1>
        <p className="email-sent-note">
          Проверьте входящие. Ссылка для сброса пароля действительна 15 минут.
        </p>

        <div className="resend-row" aria-live="polite">
          {seconds === 0 ? (
            <button className="resend-btn" type="button" onClick={() => setSeconds(60)}>
              Отправить снова
            </button>
          ) : (
            <span>Отправить снова через {seconds} с</span>
          )}
        </div>
      </div>

      <div className="auth-success-footer">
        <button className="auth-outline-btn" type="button" onClick={() => navigate('auth')}>
          Вернуться ко входу
        </button>
      </div>
    </section>
  );
}

export function ResetPasswordView({navigate}) {
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirmBlur = () => {
    if (confirm && newPw !== confirm) {
      setConfirmError('Пароли не совпадают');
    } else {
      setConfirmError('');
    }
  };

  const isValid = newPw.length >= 6 && newPw === confirm;

  const handleSubmit = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    navigate('resetPasswordSuccess');
  };

  return (
    <section className="auth-screen" aria-label="Установка нового пароля">
      <div className="auth-blob" aria-hidden="true"/>
      <div className="auth-inner">
        <div className="auth-close-row">
          <button className="auth-close-btn" type="button" onClick={() => navigate('auth')} aria-label="Закрыть">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="auth-brand">
          <BrandMark/>
          <div className="auth-brand-wordmark">Витрина</div>
        </div>

        <div className="auth-section-head">
          <h1 className="auth-section-title">Новый пароль</h1>
          <p className="auth-section-sub">Придумайте надёжный пароль для аккаунта</p>
        </div>

        <div className="auth-fields">
          <InputField
            id="new-password"
            label="Новый пароль"
            type="password"
            value={newPw}
            onChange={setNewPw}
            placeholder="Минимум 6 символов"
            autoComplete="new-password"
            showToggle
            showPw={showNewPw}
            onTogglePw={() => setShowNewPw(v => !v)}
          />
          {newPw.length > 0 && (
            <div className="pw-reqs" aria-live="polite">
              <div className={`pw-req${newPw.length >= 6 ? ' is-met' : ''}`}>
                <span className="pw-req-dot" aria-hidden="true"/>
                Минимум 6 символов
              </div>
            </div>
          )}
          <InputField
            id="confirm-password"
            label="Повторите пароль"
            type="password"
            value={confirm}
            onChange={setConfirm}
            onBlur={handleConfirmBlur}
            placeholder="••••••••"
            autoComplete="new-password"
            error={confirmError}
            showToggle
            showPw={showConfirm}
            onTogglePw={() => setShowConfirm(v => !v)}
          />
        </div>

        <div className="auth-cta-group" style={{marginTop: 24}}>
          <button
            className="auth-cta-btn"
            type="button"
            disabled={!isValid || loading}
            onClick={handleSubmit}
            aria-busy={loading}
          >
            {loading && <span className="auth-spinner" aria-hidden="true"/>}
            Установить пароль
          </button>
        </div>
      </div>
    </section>
  );
}

export function ResetPasswordSuccessView({navigate}) {
  return (
    <section className="auth-success-screen" aria-label="Пароль обновлён">
      <div className="auth-success-close">
        <button className="auth-close-btn" type="button" onClick={() => navigate('auth')} aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="auth-success-body">
        <div className="auth-success-avatar" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="auth-success-title">Пароль обновлён</h1>
        <p className="auth-success-text">
          Используйте новый пароль для входа в аккаунт
        </p>
      </div>

      <div className="auth-success-footer">
        <button className="auth-cta-btn" type="button" onClick={() => navigate('auth')}>
          Войти в аккаунт
        </button>
      </div>
    </section>
  );
}
