import React from 'react';
import {Button, Checkbox, TextInput} from '@gravity-ui/uikit';
import {Field} from '../components/ui';

export function AuthScreen({
  authTab,
  setAuthTab,
  authForm,
  setAuthForm,
  authError,
  authLoading,
  onLogin,
  onRegister,
}) {
  const isLogin = authTab === 'login';

  return (
    <div className="desktop-app-shell">
      <div className="auth-shell">
        <div className="auth-backdrop" />
        <section className="auth-hero">
          <div className="auth-brand">
            <div className="brand-logo">Я</div>
            <div>
              <div className="brand-title">Витрина</div>
              <div className="brand-subtitle">Кабинет методиста</div>
            </div>
          </div>

          <div className="auth-hero-copy">
            <h1>Создавайте интерактивные артефакты и маршруты, которые запоминаются</h1>
            <p>
              Витрина — платформа для методистов и музейных команд. Оживляйте
              экспонаты, выстраивайте маршруты и изучайте свою аудиторию.
            </p>
          </div>

          <div className="auth-feature-list">
            <div className="auth-feature">
              <div className="auth-feature-icon">✦</div>
              <div>
                <strong>Интерактивность</strong>
                <span>Оживляйте экспонаты с помощью мультимедиа и интерактивных заданий</span>
              </div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">⌘</div>
              <div>
                <strong>Маршруты и точки</strong>
                <span>Создавайте логичные маршруты и управляйте точками интереса</span>
              </div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">▥</div>
              <div>
                <strong>Аналитика</strong>
                <span>Отслеживайте вовлечённость и поведение посетителей</span>
              </div>
            </div>
          </div>

          <div className="auth-visual">
            <div className="auth-device">
              <div className="auth-device-card">
                <div className="auth-device-title">Письмо фронтовика 1943 года</div>
                <div className="auth-device-text">Отсканируйте QR-код, чтобы просмотреть артефакт</div>
                <div className="auth-qr" />
              </div>
            </div>
            <div className="auth-map" />
            <div className="auth-badge auth-badge-a">T</div>
            <div className="auth-badge auth-badge-b">◁</div>
            <div className="auth-badge auth-badge-c">⌂</div>
          </div>

          <div className="auth-footer-note">
            <strong>Ваши данные защищены</strong>
            <span>Мы соблюдаем требования 152-ФЗ и используем современные методы шифрования</span>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${isLogin ? 'is-active' : ''}`}
              onClick={() => setAuthTab('login')}
            >
              Вход
            </button>
            <button
              type="button"
              className={`auth-tab ${!isLogin ? 'is-active' : ''}`}
              onClick={() => setAuthTab('register')}
            >
              Регистрация
            </button>
          </div>

          {isLogin ? (
            <div className="auth-form">
              <div className="auth-form-heading">
                <h2>Добро пожаловать!</h2>
                <p>Войдите в свой аккаунт, чтобы продолжить работу</p>
              </div>

              <Field label="Электронная почта">
                <TextInput
                  size="xl"
                  placeholder="Введите вашу почту"
                  value={authForm.loginEmail}
                  onUpdate={(value) => setAuthForm((prev) => ({...prev, loginEmail: value}))}
                />
              </Field>
              <Field label="Пароль">
                <TextInput
                  size="xl"
                  type="password"
                  placeholder="Введите пароль"
                  value={authForm.loginPassword}
                  onUpdate={(value) => setAuthForm((prev) => ({...prev, loginPassword: value}))}
                />
              </Field>

              <div className="auth-inline-row">
                <label className="auth-checkline">
                  <Checkbox />
                  <span>Запомнить меня</span>
                </label>
                <button type="button" className="auth-link">Забыли пароль?</button>
              </div>

              {authError ? <div className="chart-note">{authError}</div> : null}

              <Button view="action" size="xl" width="max" onClick={onLogin} loading={authLoading}>
                Войти
              </Button>

              <div className="auth-divider"><span>или</span></div>

              <div className="auth-socials">
                <Button view="outlined" size="xl">Войти через Яндекс</Button>
                <Button view="outlined" size="xl">Войти через Google</Button>
                <Button view="outlined" size="xl">Войти через VK ID</Button>
              </div>

              <div className="auth-bottom-text">
                Нет аккаунта?{' '}
                <button type="button" className="auth-link" onClick={() => setAuthTab('register')}>
                  Зарегистрируйтесь
                </button>
              </div>
            </div>
          ) : (
            <div className="auth-form">
              <div className="auth-form-heading">
                <h2>Создание аккаунта</h2>
                <p>Заполните форму, чтобы начать работу в Витрине</p>
              </div>

              <Field label="Имя и фамилия">
                <TextInput
                  size="xl"
                  placeholder="Анна Смирнова"
                  value={authForm.registerFullName}
                  onUpdate={(value) => setAuthForm((prev) => ({...prev, registerFullName: value}))}
                />
              </Field>
              <Field label="Электронная почта">
                <TextInput
                  size="xl"
                  placeholder="example@mail.ru"
                  value={authForm.registerEmail}
                  onUpdate={(value) => setAuthForm((prev) => ({...prev, registerEmail: value}))}
                />
              </Field>
              <Field label="Пароль">
                <TextInput
                  size="xl"
                  type="password"
                  placeholder="Придумайте пароль"
                  value={authForm.registerPassword}
                  onUpdate={(value) => setAuthForm((prev) => ({...prev, registerPassword: value}))}
                />
              </Field>

              <label className="auth-checkline auth-checkline-wrap">
                <Checkbox />
                <span>
                  Я принимаю{' '}
                  <button type="button" className="auth-link">Политику конфиденциальности</button>,{' '}
                  <button type="button" className="auth-link">Пользовательское соглашение</button> и{' '}
                  <button type="button" className="auth-link">Правила сервиса</button>
                </span>
              </label>

              {authError ? <div className="chart-note">{authError}</div> : null}

              <Button view="action" size="xl" width="max" onClick={onRegister} loading={authLoading}>
                Зарегистрироваться
              </Button>

              <div className="auth-bottom-text">
                Уже есть аккаунт?{' '}
                <button type="button" className="auth-link" onClick={() => setAuthTab('login')}>
                  Войти
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
