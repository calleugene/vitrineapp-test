import React, {useEffect, useState} from 'react';
import {Button, Card, Dialog, TextInput, useToaster} from '@gravity-ui/uikit';
import {Copy} from '@gravity-ui/icons';
import {authApi} from '../../../api';
import {accountDate, profileErrorMessage} from '../../users/profile-state';

export function MuseumJoinCodeCard({currentUser}) {
  const [allowed,setAllowed] = useState(false);
  const [code,setCode] = useState(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [rotateOpen,setRotateOpen] = useState(false);
  const {add} = useToaster();
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    let cancelled = false;
    authApi.getMuseums(currentUser.id).then(({museums}) => {
      const membership = museums?.find((museum) => museum.id === currentUser.museum_id);
      if (!cancelled) setAllowed(['owner','museum_admin'].includes(membership?.role));
    }).catch(() => {if (!cancelled) setAllowed(false);});
    return () => {cancelled = true;};
  }, [currentUser?.id,currentUser?.museum_id]);
  const generate = async () => {
    setBusy(true); setError('');
    try {setCode(await authApi.createMuseumCode()); setRotateOpen(false);}
    catch (cause) {setError(profileErrorMessage(cause));} finally {setBusy(false);}
  };
  if (!allowed) return null;
  return <Card className="panel panel-form" view="filled"><h3>Подключение сотрудников</h3><div className="stack"><span className="personal-caption">ID музея</span><TextInput value={currentUser.museum_id || ''} readOnly controlProps={{'aria-label':'ID музея'}} endContent={<Button view="flat" aria-label="Скопировать ID музея" onClick={async () => {try {await navigator.clipboard.writeText(currentUser.museum_id); add({name:'museum-id',theme:'success',title:'ID музея скопирован'});} catch {setError('Не удалось скопировать ID музея.');}}}><Copy /></Button>} /></div><p className="personal-caption">Для подключения сотруднику нужны ID музея и специальный код. Передавайте его только приглашённым сотрудникам. Код действует 7 дней.</p>{code && <div className="stack"><TextInput value={code.code} readOnly controlProps={{'aria-label':'Код подключения музея'}} endContent={<Button view="flat" aria-label="Скопировать код" onClick={async () => {try {await navigator.clipboard.writeText(code.code); add({name:'museum-code',theme:'success',title:'Код скопирован'});} catch {setError('Не удалось скопировать код.');}}}><Copy /></Button>} /><span className="personal-caption">Действует до {accountDate(code.expires_at)}</span></div>}<div className="page-action-group"><Button disabled={busy} onClick={() => setRotateOpen(true)}>{code ? 'Перевыпустить код' : 'Создать новый код'}</Button><Button disabled={busy} onClick={async () => {setBusy(true); setError(''); try {await authApi.revokeMuseumCode(); setCode(null); add({name:'museum-code',theme:'success',title:'Коды подключения отозваны'});} catch (cause) {setError(profileErrorMessage(cause));} finally {setBusy(false);}}}>Отозвать коды</Button></div>{error && <p role="alert">{error}</p>}<Dialog open={rotateOpen} onClose={() => {if (!busy) setRotateOpen(false);}} size="s"><Dialog.Header caption="Создать новый код подключения?" /><Dialog.Body>Предыдущий код перестанет действовать. Подключённые сотрудники сохранят доступ.{error && <p role="alert">{error}</p>}</Dialog.Body><Dialog.Footer textButtonCancel="Отмена" textButtonApply="Создать код" onClickButtonCancel={() => setRotateOpen(false)} onClickButtonApply={generate} propsButtonApply={{loading:busy}} propsButtonCancel={{disabled:busy}} /></Dialog></Card>;
}
