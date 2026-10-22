import React, {useId, useState} from 'react';
import {Button} from '@gravity-ui/uikit';
import {authApi} from '../api';
import {LegalDocumentDialog} from './LegalDocument';
import {useLegalDocuments} from './use-legal-documents';

function Input({label, password = false, ...props}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [validation, setValidation] = useState('');
  return <div className="auth-field"><label htmlFor={id}>{label}</label><div className="auth-input-wrap"><input id={id} {...props} aria-invalid={Boolean(validation)} aria-describedby={validation ? `${id}-error` : undefined} onInvalid={(event) => {event.preventDefault(); setValidation(event.target.validity.valueMissing ? 'Заполните это поле.' : event.target.validity.typeMismatch ? 'Введите корректный email.' : event.target.validity.tooShort ? 'Пароль должен содержать не менее 12 символов.' : event.target.validationMessage);}} onChange={(event) => {setValidation(''); props.onChange?.(event);}} type={password ? (visible ? 'text' : 'password') : (props.type || 'text')} />{password && <button type="button" className="auth-reveal" aria-label={visible ? `Скрыть: ${label}` : `Показать: ${label}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Скрыть' : 'Показать'}</button>}</div>{validation && <span id={`${id}-error`} className="auth-error" role="alert">{validation}</span>}</div>;
}

export function AuthScreen({authTab = 'login', setAuthTab, authForm = {}, setAuthForm, authError, authLoading, onLogin, onRegister, initialMode}) {
  const [mode, setMode] = useState(initialMode || 'auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [personal, setPersonal] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [document, setDocument] = useState(null);
  const {documents, error: legalError, retry} = useLegalDocuments();
  const login = authTab === 'login';
  const update = (key) => (event) => setAuthForm((previous) => ({...previous, [key]: event.target.value}));
  const legalLink = (type, text) => <button type="button" className="auth-link" disabled={!documents.length} onClick={() => setDocument(documents.find((item) => item.type === type))}>{text}</button>;
  const back = () => {if (initialMode) {window.location.assign(import.meta.env.BASE_URL); return;} setMode('auth'); setError(''); setSuccess('');};
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (mode === 'auth') {
      if (login) {onLogin(); return;}
      if (!personal || documents.length !== 3) {setError('Для регистрации подтвердите согласие на обработку персональных данных.'); return;}
      onRegister(['personal_data', 'marketing'].map((type) => ({type, version: documents.find((item) => item.type === type).version, accepted: type === 'personal_data' ? personal : marketing})));
      return;
    }
    if (mode === 'reset' && password !== repeat) {setError('Пароли не совпадают.'); return;}
    setBusy(true);
    try {
      if (mode === 'forgot') {await authApi.forgotPassword(email); setSuccess('Если аккаунт с указанной почтой существует, мы отправили письмо с инструкцией по восстановлению пароля');}
      else {await authApi.resetPassword(token, password); setPassword(''); setRepeat(''); window.history.replaceState({}, '', `${import.meta.env.BASE_URL}reset-password`); setSuccess('Пароль сохранён. Войдите с новым паролем.');}
    } catch (failure) {
      setError(failure.status === 429 ? 'Слишком много запросов. Повторите через 30 минут.' : mode === 'reset' && failure.status === 400 ? 'Ссылка недействительна или срок её действия истёк. Запросите новую.' : 'Не удалось выполнить запрос. Попробуйте позже.');
    } finally {setBusy(false);}
  };
  return <main className="auth-centered">
    <div className="auth-container">
      <header className="auth-brand"><div className="brand-logo" aria-hidden="true">Я</div><div><div className="brand-title">Витрина</div><div className="brand-subtitle">Кабинет методиста</div></div></header>
      {mode === 'auth' && <nav className="auth-tabs" aria-label="Авторизация"><button type="button" aria-current={login ? 'page' : undefined} className={`auth-tab ${login ? 'is-active' : ''}`} onClick={() => {setAuthTab('login'); setError('');}}>Вход</button><button type="button" aria-current={!login ? 'page' : undefined} className={`auth-tab ${!login ? 'is-active' : ''}`} onClick={() => {setAuthTab('register'); setError('');}}>Регистрация</button></nav>}
      <form className="auth-form" onSubmit={submit} onInvalid={(event) => event.currentTarget.querySelector(':invalid')?.focus()}>
        <div className="auth-form-heading"><h1>{mode === 'forgot' ? 'Восстановление пароля' : mode === 'reset' ? 'Новый пароль' : login ? 'Добро пожаловать!' : 'Создание аккаунта'}</h1><p>{mode === 'forgot' ? 'Введите электронную почту, указанную при регистрации. Мы отправим ссылку для восстановления доступа' : mode === 'reset' ? 'Придумайте пароль длиной не менее 12 символов.' : login ? 'Войдите в свой аккаунт, чтобы продолжить работу' : 'Заполните форму, чтобы начать работу в Витрине'}</p></div>
        {success ? <p role="status">{success}</p> : <>
          {mode === 'auth' && !login && <Input label="Имя и фамилия" required autoComplete="name" value={authForm.registerFullName} onChange={update('registerFullName')} />}
          {mode !== 'reset' && <Input label="Электронная почта" type="email" required autoComplete="email" maxLength={254} placeholder="example@mail.ru" value={mode === 'forgot' ? email : login ? authForm.loginEmail : authForm.registerEmail} onChange={mode === 'forgot' ? (event) => setEmail(event.target.value) : update(login ? 'loginEmail' : 'registerEmail')} />}
          {mode !== 'forgot' && <Input label={mode === 'reset' ? 'Новый пароль' : 'Пароль'} password required maxLength={1024} minLength={mode === 'auth' && login ? undefined : 12} autoComplete={mode === 'auth' && login ? 'current-password' : 'new-password'} value={mode === 'reset' ? password : login ? authForm.loginPassword : authForm.registerPassword} onChange={mode === 'reset' ? (event) => {setPassword(event.target.value); event.target.form.querySelector('[name=repeatPassword]')?.setCustomValidity(event.target.value === repeat ? '' : 'Пароли не совпадают.');} : update(login ? 'loginPassword' : 'registerPassword')} />}
          {mode === 'reset' && <Input label="Повтор нового пароля" name="repeatPassword" password required maxLength={1024} minLength={12} autoComplete="new-password" value={repeat} onChange={(event) => {setRepeat(event.target.value); event.target.setCustomValidity(event.target.value === password ? '' : 'Пароли не совпадают.');}} />}
          {mode === 'auth' && login && <div className="auth-inline-row"><label className="auth-checkline" title="Сохранить email на этом устройстве"><input type="checkbox" checked={Boolean(authForm.rememberMe)} onChange={updateRemember} />Запомнить меня</label><button type="button" className="auth-link" onClick={() => {setMode('forgot'); setError('');}}>Забыли пароль?</button></div>}
          {mode === 'auth' && !login && <><div className="auth-consent"><input id="personal-consent" type="checkbox" required checked={personal} onChange={(event) => setPersonal(event.target.checked)} /><div><label htmlFor="personal-consent">Даю согласие на обработку персональных данных.</label> {legalLink('personal_data', 'Текст согласия')} · {legalLink('privacy', 'Политика обработки данных')}</div></div><div className="auth-consent"><input id="marketing-consent" type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} /><div><label htmlFor="marketing-consent">Хочу получать рекламные рассылки (необязательно).</label> {legalLink('marketing', 'Текст согласия')}</div></div><small>Пароль — не менее 12 символов.</small></>}
          {(error || (mode === 'auth' && authError)) && <p className="auth-error" role="alert">{error || authError}</p>}
          {mode === 'reset' && (!token || error) && <a className="auth-link" href={`${import.meta.env.BASE_URL}forgot-password`}>Запросить новую ссылку</a>}
          <Button type="submit" view="action" size="xl" width="max" loading={busy || authLoading} disabled={mode === 'reset' ? !token : mode === 'auth' && !login ? documents.length !== 3 : false}>{mode === 'forgot' ? 'Отправить ссылку' : mode === 'reset' ? 'Сохранить пароль' : login ? 'Войти' : 'Зарегистрироваться'}</Button>
        </>}
        {mode !== 'auth' ? <button type="button" className="auth-link auth-return" onClick={back}>Вернуться ко входу</button> : <div className="auth-bottom-text">{login ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}<button type="button" className="auth-link" onClick={() => {setAuthTab(login ? 'register' : 'login'); setError('');}}>{login ? 'Зарегистрируйтесь' : 'Войти'}</button></div>}
      </form>
      <footer className="auth-legal">{legalLink('privacy', 'Политика обработки персональных данных')}{legalLink('personal_data', 'Согласие на обработку данных')}{legalLink('marketing', 'Согласие на рекламные рассылки')}{legalError && <p role="alert">{legalError} <button type="button" onClick={retry}>Повторить</button></p>}</footer>
    </div>{document && <LegalDocumentDialog document={document} onClose={() => setDocument(null)} />}
  </main>;
  function updateRemember(event) {setAuthForm((previous) => ({...previous, rememberMe: event.target.checked}));}
}
