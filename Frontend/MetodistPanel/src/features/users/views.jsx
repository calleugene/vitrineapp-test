import React from 'react';
import {ArrowRight, Camera, Copy, Lock, Plus} from '@gravity-ui/icons';
import {Button, Card, Checkbox, Label, Select, TextArea, TextInput} from '@gravity-ui/uikit';
import {
  PROFILE_EXTRA_LANGUAGE_OPTIONS,
  PROFILE_GENDER_OPTIONS,
  PROFILE_LANGUAGE_OPTIONS,
  PROFILE_ROLE_OPTIONS,
  PROFILE_STATUS_OPTIONS,
  PROFILE_TIMEZONE_OPTIONS,
  USER_PROFILE_TABS,
} from '../../app/constants';
import {Breadcrumbs, Field} from '../../components/ui';

export function UserProfileView({profile, setProfile, activeTab, setActiveTab, profileError, onCancel, onSave, saving}) {
  const aboutLength = profile.about.length;
  const noteLength = profile.note.length;

  const updateProfile = (key, value) => {
    setProfile((prev) => ({...prev, [key]: value}));
  };

  const extraLanguageLabels = profile.extraLanguages.map((value) => {
    return PROFILE_EXTRA_LANGUAGE_OPTIONS.find((item) => item.value === value)?.content || value;
  });

  return (
    <section className="page profile-page">
      <Breadcrumbs path={`Пользователи / ${profile.firstName} ${profile.lastName} / Редактирование`} />
      <div className="page-heading">
        <div>
          <h1>Редактирование профиля</h1>
          <p>Управление данными пользователя и доступом в системе.</p>
        </div>
      </div>

      <div className="profile-tabs">
        {USER_PROFILE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`profile-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.title}
          </button>
        ))}
      </div>

      {profileError ? <div className="chart-note">{profileError}</div> : null}

      <div className="profile-layout">
        <div className="stack">
          <Card className="panel panel-form profile-main-card" view="filled">
            <h3>Основная информация</h3>

            <div className="profile-basic-grid">
              <div className="profile-avatar-block">
                <div className="profile-photo" />
                <Button view="outlined" size="l"><Camera />Изменить фото</Button>
                <span className="profile-photo-note">JPG, PNG, не более 5 МБ</span>
              </div>

              <div className="profile-form-stack">
                <div className="field-grid">
                  <Field label="Имя"><TextInput size="xl" value={profile.firstName} onUpdate={(value) => updateProfile('firstName', value)} /></Field>
                  <Field label="Фамилия"><TextInput size="xl" value={profile.lastName} onUpdate={(value) => updateProfile('lastName', value)} /></Field>
                  <Field label="Email"><TextInput size="xl" value={profile.email} onUpdate={(value) => updateProfile('email', value)} /></Field>
                  <Field label="Телефон"><TextInput size="xl" value={profile.phone} onUpdate={(value) => updateProfile('phone', value)} /></Field>
                </div>

                <Field label="Должность">
                  <Select size="xl" value={[profile.position]} options={PROFILE_ROLE_OPTIONS} onUpdate={(value) => updateProfile('position', value[0])} />
                </Field>

                <Field label="О себе">
                  <div className="profile-textarea-shell">
                    <TextArea size="xl" rows={4} value={profile.about} onUpdate={(value) => updateProfile('about', value.slice(0, 500))} />
                    <span className="profile-counter">{aboutLength} / 500</span>
                  </div>
                </Field>

                <div className="profile-inline-grid">
                  <Field label="Язык интерфейса">
                    <Select size="xl" value={[profile.interfaceLanguage]} options={PROFILE_LANGUAGE_OPTIONS} onUpdate={(value) => updateProfile('interfaceLanguage', value[0])} />
                  </Field>
                  <label className="profile-checkbox-line">
                    <Checkbox checked={profile.notifications} onUpdate={(checked) => updateProfile('notifications', checked)} />
                    <span>Получать системные уведомления</span>
                  </label>
                </div>
              </div>
            </div>
          </Card>

          <Card className="panel panel-form profile-main-card" view="filled">
            <h3>Дополнительная информация</h3>

            <div className="field-grid profile-secondary-grid">
              <Field label="Дата рождения"><TextInput size="xl" type="date" value={profile.birthDate} onUpdate={(value) => updateProfile('birthDate', value)} /></Field>
              <Field label="Пол"><Select size="xl" value={[profile.gender]} options={PROFILE_GENDER_OPTIONS} onUpdate={(value) => updateProfile('gender', value[0])} /></Field>
              <Field label="Часовой пояс"><Select size="xl" value={[profile.timezone]} options={PROFILE_TIMEZONE_OPTIONS} onUpdate={(value) => updateProfile('timezone', value[0])} /></Field>
            </div>

            <Field label="Дополнительные языки">
              <div className="profile-languages-row">
                <div className="profile-chip-list">
                  {extraLanguageLabels.map((label) => (
                    <span className="profile-chip" key={label}>
                      {label}
                      <button
                        type="button"
                        className="profile-chip-remove"
                        onClick={() =>
                          updateProfile(
                            'extraLanguages',
                            profile.extraLanguages.filter((value) => PROFILE_EXTRA_LANGUAGE_OPTIONS.find((item) => item.value === value)?.content !== label),
                          )
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <Select
                  size="xl"
                  placeholder="Добавить язык"
                  value={[]}
                  options={PROFILE_EXTRA_LANGUAGE_OPTIONS.filter((item) => !profile.extraLanguages.includes(item.value))}
                  onUpdate={(value) => {
                    const next = value[0];
                    if (!next || profile.extraLanguages.includes(next)) {
                      return;
                    }

                    updateProfile('extraLanguages', [...profile.extraLanguages, next]);
                  }}
                />
              </div>
            </Field>

            <Field label="Примечание">
              <div className="profile-textarea-shell">
                <TextArea size="xl" rows={3} placeholder="Введите примечание о пользователе (видно только администраторам)" value={profile.note} onUpdate={(value) => updateProfile('note', value.slice(0, 500))} />
                <span className="profile-counter">{noteLength} / 500</span>
              </div>
            </Field>
          </Card>
        </div>

        <div className="stack">
          <Card className="panel profile-side-card" view="filled">
            <h3>Статус и аккаунт</h3>
            <ul className="profile-info-list">
              <li><span>Статус</span><Select size="m" value={[profile.status]} options={PROFILE_STATUS_OPTIONS} onUpdate={(value) => updateProfile('status', value[0])} /></li>
              <li><span>Дата регистрации</span><strong>{profile.registeredAt}</strong></li>
              <li><span>Последний вход</span><strong>{profile.lastLoginAt}</strong></li>
              <li><span>ID пользователя</span><strong className="profile-inline-value">{profile.userId}<button type="button" className="profile-inline-icon" aria-label="Скопировать ID"><Copy /></button></strong></li>
              <li><span>Источник регистрации</span><strong>{profile.registrationSource}</strong></li>
              <li><span>Двухфакторная аутентификация</span><strong className="profile-twofactor-row"><Label theme={profile.twoFactorEnabled ? 'success' : 'utility'} size="xs">{profile.twoFactorEnabled ? 'Включена' : 'Не включена'}</Label><Button view="flat" size="s">Включить 2FA</Button></strong></li>
            </ul>
          </Card>

          <Card className="panel profile-side-card" view="filled">
            <h3>Роли пользователя</h3>
            <div className="profile-role-box">
              <div className="profile-chip-list">
                {profile.roles.map((role) => (<span className="profile-chip is-role" key={role}>{role}</span>))}
              </div>
              <Button view="outlined" size="l" width="max"><Plus />Добавить роль</Button>
              <p className="profile-side-note">Пользователь может создавать и редактировать истории, работать с коллекциями и контентом в назначенных музеях.</p>
            </div>
          </Card>

          <Card className="panel profile-side-card" view="filled">
            <div className="panel-header">
              <h3>Доступ к музеям</h3>
              <Button view="outlined" size="m">Изменить</Button>
            </div>
            <div className="profile-museum-list">
              {(profile.museums || []).map((museum) => (
                <div className="profile-museum-item" key={museum.name}>
                  <div className="profile-museum-thumb" />
                  <div className="profile-museum-copy"><strong>{museum.name}</strong><span>{museum.city}</span></div>
                  <Label theme={museum.status === 'Просмотр' ? 'info' : 'success'} size="xs">{museum.status}</Label>
                </div>
              ))}
            </div>
            {(profile.museums || []).length > 0 ? <button type="button" className="profile-link-button">Показать все ({profile.museums.length})<ArrowRight /></button> : null}
          </Card>

          <Card className="panel profile-side-card profile-side-card-danger" view="filled">
            <div className="profile-danger-row">
              <div>
                <h3>Заблокировать пользователя</h3>
                <p>Пользователь потеряет доступ к системе. Это действие можно отменить в любой момент.</p>
              </div>
              <Button view="outlined-danger" size="l">Заблокировать</Button>
            </div>
          </Card>
        </div>
      </div>

      <div className="page-action-bar page-action-bar-split">
        <Button view="outlined" size="xl">
          <Lock />
          Сбросить пароль
        </Button>
        <div className="page-action-group">
          <Button view="outlined" size="xl" onClick={onCancel}>
            Отмена
          </Button>
          <Button view="action" size="xl" onClick={onSave} loading={saving}>
            Сохранить изменения
          </Button>
        </div>
      </div>
    </section>
  );
}
