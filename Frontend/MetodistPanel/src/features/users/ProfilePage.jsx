import React, {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, Camera, Copy, Plus, Person, House as BuildingColumnsIcon, Calendar, Clock, CircleInfo} from '@gravity-ui/icons';
import {Button, Card, Dialog, Label, TextInput, TextArea, Tooltip, useToaster} from '@gravity-ui/uikit';
import {authApi} from '../../api';
import {accountDate, profileChanged, profileErrorMessage, profileFields, validateProfile} from './profile-state';
import './profile-page.css';

const DEACTIVATION_TEXT = 'Ваш аккаунт перейдёт в спящий режим. Редактирование данных и работа с музеями будут недоступны. Вы сможете восстановить аккаунт в течение 30 дней. После окончания этого срока аккаунт будет удалён';

function ProfileField({label, name, error, children}) {
  return <label className="personal-field" htmlFor={`personal-${name}`}><span>{label}</span>{children}{error && <span className="personal-field-error" id={`personal-${name}-error`}>{error}</span>}</label>;
}

export function ProfilePage({session, onSessionRefresh, onNavigate, museums, museumState, loadMuseums, onMuseumsUpdated, onSelectMuseum, onDirtyChange}) {
  const {add} = useToaster();
  const [user, setUser] = useState(null);
  const [draft, setDraft] = useState(() => profileFields(null));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');
  const [joinMuseumId,setJoinMuseumId] = useState('');
  const [joinError, setJoinError] = useState('');
  const [museumBusy, setMuseumBusy] = useState(false);
  const [deactivationOpen, setDeactivationOpen] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailToken, setEmailToken] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailTarget, setEmailTarget] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInput = useRef(null);
  const id = session.user.id;
  const notify = (title) => add({name: 'profile-result', title, theme: 'success', autoHiding: 5000});
  const dirty = user && profileChanged(profileFields(user), draft);
  const invalid = Object.keys(validateProfile(draft)).length > 0;

  useEffect(() => {
    if (!avatarFile) {setAvatarPreview(''); return undefined;}
    const url = URL.createObjectURL(avatarFile); setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  useEffect(() => {
    if (!dirty && !avatarFile) return undefined;
    const warn = (event) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, avatarFile]);

  useEffect(() => {onDirtyChange(Boolean(dirty || avatarFile)); return () => onDirtyChange(false);}, [dirty,avatarFile,onDirtyChange]);

  const loadProfile = async () => {
    setLoading(true); setLoadError('');
    try {const response = await authApi.getUser(id); setUser(response.user); setDraft(profileFields(response.user));}
    catch {setLoadError('Не удалось загрузить профиль. Проверьте подключение и повторите попытку.');}
    finally {setLoading(false);}
  };

  useEffect(() => {
    let cancelled = false;
    authApi.getUser(id).then(({user: next}) => {if (!cancelled) {setUser(next); setDraft(profileFields(next));}}).catch(() => {if (!cancelled) setLoadError('Не удалось загрузить профиль. Повторите попытку.');}).finally(() => {if (!cancelled) setLoading(false);});

    return () => {cancelled = true;};
  }, [id]);

  const applyUser = (next) => {setUser(next); onSessionRefresh({...session, user: next});};
  const update = (name, value) => {setDraft((prev) => ({...prev, [name]: value})); setErrors((prev) => ({...prev, [name]: ''}));};
  const save = async (event) => {
    event.preventDefault(); if (!dirty || saving) return;
    const validation = validateProfile(draft); setErrors(validation); if (Object.keys(validation).length) return;
    setSaving(true); setError('');
    try {
      const response = await authApi.updateUser(id, {full_name: `${draft.firstName.trim()} ${draft.lastName.trim()}`, phone: draft.phone, about: draft.about});
      applyUser(response.user);
      if (draft.email !== response.user.email) {
        await authApi.requestEmailChange(draft.email);
        setEmailTarget(draft.email); setEmailToken(''); setEmailError(''); setEmailOpen(true);
        notify('Данные сохранены. Подтвердите новый email.');
      } else {setDraft(profileFields(response.user)); notify('Изменения сохранены');}
    } catch (cause) {setError(profileErrorMessage(cause));}
    finally {setSaving(false);}
  };
  const confirmEmail = async () => {
    if (!emailToken.trim() || saving) return; setSaving(true); setEmailError('');
    try {const response = await authApi.confirmEmailChange(emailToken.trim()); applyUser(response.user); setDraft((prev) => ({...prev, email: response.user.email})); setEmailOpen(false); notify('Новый email подтверждён');}
    catch (cause) {setEmailError(profileErrorMessage(cause));} finally {setSaving(false);}
  };
  const uploadAvatar = async () => {
    if (!avatarFile || avatarBusy) return; setAvatarBusy(true); setAvatarError('');
    try {const response = await authApi.uploadAvatar(id, avatarFile); applyUser(response.user); setAvatarFile(null); notify('Фото профиля обновлено');}
    catch (cause) {setAvatarError(profileErrorMessage(cause));} finally {setAvatarBusy(false);}
  };
  const join = async () => {
    if (!joinMuseumId.trim() || !code.trim() || museumBusy) return; setMuseumBusy(true); setJoinError('');
    try {const response = await authApi.joinMuseum(joinMuseumId.trim(),code.trim()); onMuseumsUpdated(response.museums || []); setJoinOpen(false); setCode(''); setJoinMuseumId(''); notify('Музей успешно подключён');}
    catch (cause) {setJoinError(profileErrorMessage(cause)); if (cause?.code === 'already_joined') await loadMuseums();}
    finally {setMuseumBusy(false);}
  };
  const openMuseum = async (museum) => {
    if (museumBusy) return;
    if ((dirty || avatarFile) && !window.confirm('Есть несохранённые изменения. Перейти в музей и отменить их?')) return;
    setMuseumBusy(true); setError('');
    try {await onSelectMuseum(museum.id,{discardConfirmed:true});}
    catch (cause) {setError(profileErrorMessage(cause));} finally {setMuseumBusy(false);}
  };
  const deactivate = async () => {
    if (lifecycleBusy) return; setLifecycleBusy(true); setLifecycleError('');
    try {const response = await authApi.deactivate(); onSessionRefresh({...session, user: response.user});}
    catch (cause) {setLifecycleError(profileErrorMessage(cause));} finally {setLifecycleBusy(false);}
  };
  const goBack = () => {if ((!dirty && !avatarFile) || window.confirm('Отменить несохранённые изменения?')) onNavigate('dashboard');};

  if (loading) return <section className="page personal-page"><p role="status" aria-live="polite">Загружаем профиль…</p></section>;
  if (loadError) return <section className="page personal-page"><h1>Редактирование профиля</h1><p role="alert">{loadError}</p><Button onClick={loadProfile}>Повторить загрузку</Button></section>;

  return <section className="page personal-page">
    <header className="personal-heading"><Button view="flat" onClick={goBack}><ArrowLeft />Назад</Button><h1>Редактирование профиля</h1><p>Управляйте своими данными и подключёнными музеями.</p></header>
    <div className="personal-layout">
      <div className="personal-column">
        <Card className="personal-card" view="filled">
          <form onSubmit={save} noValidate>
            <div className="personal-card-heading"><h2>Основная информация</h2><Button view="action" size="l" type="submit" disabled={!dirty || invalid || avatarBusy} loading={saving}>Сохранить изменения</Button></div>
            <div className="personal-basic">
              <div className="personal-avatar-control">
                <div className="personal-avatar">{avatarPreview || user?.avatar_url ? <img src={avatarPreview || user.avatar_url} alt="Фото профиля" /> : <Person width={46} height={46} />}</div>
                <input ref={fileInput} type="file" accept="image/jpeg,image/png" hidden aria-label="Фотография профиля" onChange={(event) => {const file = event.target.files?.[0]; event.target.value = ''; setAvatarError(''); if (!file) return; if (!['image/jpeg','image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {setAvatarError('Выберите JPG или PNG до 5 МБ'); return;} setAvatarFile(file);}} />
                <Button size="m" view="flat" disabled={avatarBusy || saving} onClick={() => fileInput.current?.click()}><Camera />Изменить фото</Button>
                <span className="personal-caption">JPG, PNG до 5 МБ</span>
                {avatarFile && <><Button size="m" onClick={uploadAvatar} loading={avatarBusy}>Сохранить фото</Button><Button view="flat" disabled={avatarBusy} onClick={() => setAvatarFile(null)}>Отмена</Button></>}
                {avatarError && <p role="alert" className="personal-caption">{avatarError}</p>}
              </div>
              <div className="personal-fields">
                {['firstName','lastName','email','phone'].map((name) => <ProfileField key={name} name={name} label={{firstName:'Имя *',lastName:'Фамилия *',email:'Email *',phone:'Телефон'}[name]} error={errors[name]}><TextInput id={`personal-${name}`} size="l" value={draft[name]} type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'} autoComplete={{firstName:'given-name',lastName:'family-name',email:'email',phone:'tel'}[name]} disabled={saving} validationState={errors[name] ? 'invalid' : undefined} controlProps={{maxLength: name === 'email' ? 254 : name === 'phone' ? 40 : 100, required: name !== 'phone', 'aria-describedby': errors[name] ? `personal-${name}-error` : undefined}} onUpdate={(value) => update(name, value)} onBlur={() => setErrors((prev) => ({...prev, [name]: validateProfile(draft)[name]}))} /></ProfileField>)}
                <div className="personal-about"><ProfileField name="about" label="О себе" error={errors.about}><TextArea id="personal-about" size="l" rows={4} value={draft.about} disabled={saving} controlProps={{maxLength:500}} onUpdate={(value) => update('about',value)} /></ProfileField><span className="personal-counter">{draft.about.length} / 500</span></div>
                {draft.email !== user.email && <p className="personal-caption personal-wide"><CircleInfo /> Новый email будет использоваться после подтверждения.</p>}
              </div>
            </div>
            {error && <p className="personal-notice" role="alert">{error}</p>}
          </form>
        </Card>
        <Card className="personal-card" view="filled">
          <div className="personal-card-heading"><h2>Мои музеи</h2><Button view="outlined" size="l" onClick={() => {setJoinError(''); setJoinOpen(true);}}><Plus />Добавить музей</Button></div>
          <p className="personal-caption">Переключайтесь между музеями или подключите новый по приглашению.</p>
          {museumState === 'loading' ? <p role="status">Загружаем музеи…</p> : museumState === 'error' ? <div role="alert"><p>Не удалось загрузить музеи.</p><Button onClick={loadMuseums}>Повторить</Button></div> : museums.length ? <div className="personal-museums">{museums.map((museum) => <MuseumItem key={museum.id} museum={museum} busy={museumBusy} onClick={() => openMuseum(museum)} />)}</div> : <div className="personal-empty"><BuildingColumnsIcon width={28} height={28}/><p>У вас пока нет подключённых музеев</p><span>Получите код у администратора музея, чтобы присоединиться.</span></div>}
        </Card>
      </div>
      <div className="personal-column">
        <AccountStatusCard user={user} onCopy={async () => {try {await navigator.clipboard.writeText(user.id); notify('ID пользователя скопирован');} catch {setError('Не удалось скопировать ID.');}}} />
        <Card className="personal-card personal-lifecycle" view="filled"><h2>Деактивация аккаунта</h2><p>Вы можете временно приостановить работу в кабинете.</p><div className="personal-notice"><CircleInfo /><span>Восстановить аккаунт можно в течение 30 дней с даты деактивации. Затем персональные данные будут удалены.</span></div><Button view="outlined" size="l" width="max" onClick={() => {setLifecycleError(''); setDeactivationOpen(true);}}>Деактивировать аккаунт</Button><p className="personal-caption">Материалы и данные музеев сохранятся.</p></Card>
      </div>
    </div>
    <Dialog open={joinOpen} onClose={() => {if (!museumBusy) setJoinOpen(false);}} size="s"><Dialog.Header caption="Присоединиться к музею" /><Dialog.Body><p className="personal-dialog-intro">Введите ID музея и код, полученные от его администратора.</p><ProfileField name="join-museum-id" label="ID музея"><TextInput id="personal-join-museum-id" autoFocus size="l" value={joinMuseumId} disabled={museumBusy} onUpdate={setJoinMuseumId} controlProps={{maxLength:128,autoComplete:'off'}} /></ProfileField><div className="personal-join-code-field" /><ProfileField name="join-code" label="Код подключения музея" error={joinError}><TextInput id="personal-join-code" size="l" value={code} disabled={museumBusy} onUpdate={setCode} controlProps={{maxLength:512, autoComplete:'off'}} onKeyDown={(event) => {if (event.key === 'Enter') {event.preventDefault(); join();}}} /></ProfileField></Dialog.Body><Dialog.Footer textButtonCancel="Отмена" textButtonApply="Подключиться" onClickButtonCancel={() => setJoinOpen(false)} onClickButtonApply={join} propsButtonApply={{loading:museumBusy,disabled:!joinMuseumId.trim() || !code.trim()}} propsButtonCancel={{disabled:museumBusy}} /></Dialog>
    <Dialog open={deactivationOpen} onClose={() => {if (!lifecycleBusy) setDeactivationOpen(false);}} size="s"><Dialog.Header caption="Деактивировать аккаунт?" /><Dialog.Body><p className="personal-deletion-warning">{DEACTIVATION_TEXT}</p>{lifecycleError && <p role="alert">{lifecycleError}</p>}</Dialog.Body><Dialog.Footer textButtonCancel="Отмена" textButtonApply="Деактивировать аккаунт" onClickButtonCancel={() => setDeactivationOpen(false)} onClickButtonApply={deactivate} propsButtonApply={{loading:lifecycleBusy}} propsButtonCancel={{disabled:lifecycleBusy}} /></Dialog>
    <Dialog open={emailOpen} onClose={() => {if (!saving) setEmailOpen(false);}} size="s"><Dialog.Header caption="Подтвердите новый email" /><Dialog.Body><p>На адрес {emailTarget} отправлен код подтверждения. До подтверждения используется прежний email.</p><ProfileField name="email-token" label="Код из письма" error={emailError}><TextInput id="personal-email-token" autoFocus value={emailToken} disabled={saving} onUpdate={setEmailToken} autoComplete="one-time-code" /></ProfileField></Dialog.Body><Dialog.Footer textButtonCancel="Позже" textButtonApply="Подтвердить" onClickButtonCancel={() => setEmailOpen(false)} onClickButtonApply={confirmEmail} propsButtonApply={{loading:saving,disabled:!emailToken.trim()}} propsButtonCancel={{disabled:saving}} /></Dialog>
  </section>;
}

function MuseumItem({museum, busy, onClick}) {
  const role = {owner:'Администратор',museum_admin:'Администратор',methodist:'Методист',moderator:'Модератор'}[museum.role] || museum.role;
  return <button type="button" className="personal-museum" disabled={busy} onClick={onClick}>{museum.logo_url ? <img src={museum.logo_url} alt="" /> : <span className="personal-museum-placeholder"><BuildingColumnsIcon width={25} height={25} /></span>}<span className="personal-museum-copy"><strong>{museum.name}</strong>{role && <span>{role}</span>}</span><ArrowRight className="personal-museum-arrow" /></button>;
}

function AccountStatusCard({user, onCopy}) {
  return <Card className="personal-card" view="filled"><div className="personal-card-heading"><h2>Статус аккаунта</h2><Label theme="success">Активен</Label></div><dl className="personal-status"><div><dt><Calendar />Дата регистрации</dt><dd>{accountDate(user?.registered_at,true)}</dd></div><div><dt><Clock />Последний вход</dt><dd>{accountDate(user?.last_login_at)}</dd></div><div><dt><Person />ID пользователя</dt><dd className="personal-id"><span title={user?.id}>{user?.id || 'Нет данных'}</span><Tooltip content="Скопировать ID пользователя"><Button view="flat" onClick={onCopy} aria-label="Скопировать ID пользователя"><Copy /></Button></Tooltip></dd></div></dl></Card>;
}

export function ReactivationScreen({user, onActivate, onLogout}) {
  const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  return <main className="personal-recovery"><Card className="personal-card" view="filled"><span className="personal-recovery-icon"><Person width={32} height={32} /></span><Label theme="warning">Спящий режим</Label><h1>Аккаунт деактивирован</h1><p>Чтобы вернуться к работе с музеями, активируйте аккаунт.</p><div className="personal-notice">Планируемое удаление: <strong>{accountDate(user?.scheduled_deletion_at)}</strong></div><p className="personal-caption">Вход в аккаунт не отменяет запланированное удаление.</p>{error && <p role="alert">{error}</p>}<Button view="action" size="xl" width="max" loading={busy} onClick={async () => {setBusy(true); setError(''); try {await onActivate();} catch (cause) {setError(profileErrorMessage(cause));} finally {setBusy(false);}}}>Активировать аккаунт</Button><Button view="flat" size="l" disabled={busy} onClick={onLogout}>Выйти</Button></Card></main>;
}
