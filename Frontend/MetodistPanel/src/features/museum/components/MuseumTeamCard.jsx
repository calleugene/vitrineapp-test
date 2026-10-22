import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Button, Card, Dialog} from '@gravity-ui/uikit';
import {authApi} from '../../../api';

const ROLE_LABEL = {owner:'Владелец', museum_admin:'Администратор', methodist:'Методист'};

export function MuseumTeamCard({currentUser, invitation}) {
  const [members, setMembers] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [status, setStatus] = useState('loading');
  const [target, setTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++request.current;
    setStatus('loading');
    try {
      const response = await authApi.getMuseumMembers();
      if (sequence !== request.current) return;
      setMembers(response.members || []);
      setCanManage(response.can_manage === true);
      setStatus('ready');
    } catch {
      if (sequence === request.current) setStatus('error');
    }
  }, []);
  useEffect(() => {void load(); return () => {request.current += 1;};}, [load]);
  const remove = async () => {
    if (!target || removing) return;
    setRemoving(true); setError(''); setNotice('');
    try {
      await authApi.removeMuseumMember(target.id);
      setMembers((items) => items.filter((item) => item.id !== target.id));
      setNotice(`${target.full_name || target.email} больше не имеет доступа к этому музею.`);
      setTarget(null);
    } catch (cause) {
      setError(cause.status === 403 ? 'Недостаточно прав для исключения. Список сотрудников мог измениться — обновите его.' : 'Не удалось исключить сотрудника. Попробуйте ещё раз.');
    } finally {setRemoving(false);}
  };
  return <Card className="panel museum-team-card" view="filled">
    <div className="museum-team-heading">
      <div><h3>Команда музея{status === 'ready' && <span className="museum-team-count">{members.length}</span>}</h3><p className="museum-photo-caption">Сотрудники с доступом к музею и работе с экспонатами</p></div>
      {canManage && <Button view="outlined" size="l" onClick={() => setInviteOpen((value) => !value)}>{inviteOpen ? 'Скрыть приглашение' : 'Пригласить сотрудника'}</Button>}
    </div>
    {status === 'loading' && <p role="status" className="museum-team-status">Загружаем сотрудников…</p>}
    {status === 'error' && <div className="museum-team-status"><p role="alert">Не удалось загрузить команду музея.</p><Button view="outlined" onClick={load}>Повторить загрузку</Button></div>}
    {status === 'ready' && (members.length ? <ul className="museum-team-list">{members.map((member) => {
      const isSelf = member.id === currentUser?.id;
      return <li key={member.id}>
        <span className="museum-team-avatar" aria-hidden="true">{(member.full_name || member.email || '?').slice(0,1).toUpperCase()}</span>
        <div className="museum-team-person"><strong>{member.full_name || 'Сотрудник музея'}{isSelf && <span className="museum-team-self">Вы</span>}</strong><span>{member.email}</span></div>
        <span className="museum-team-role">{ROLE_LABEL[member.role] || 'Сотрудник'}</span>
        <div className="museum-team-action">{canManage && !isSelf && member.role === 'methodist' && <Button view="flat-danger" size="l" onClick={() => {setTarget(member);setError('');}}>Исключить</Button>}</div>
      </li>;
    })}</ul> : <p className="museum-team-status">В этом музее пока нет сотрудников.</p>)}
    {notice && <p role="status" className="museum-team-notice">{notice}</p>}
    {canManage && <div className="museum-team-invitation"><button type="button" onClick={() => setInviteOpen((value) => !value)} aria-expanded={inviteOpen}><span aria-hidden="true">{inviteOpen ? '⌄' : '›'}</span> Подключение по ID и коду</button>{inviteOpen && invitation}</div>}
    <Dialog open={Boolean(target)} onClose={() => {if (!removing) setTarget(null);}} size="s">
      <Dialog.Header caption="Исключить сотрудника?" />
      <Dialog.Body><p><strong>{target?.full_name || target?.email}</strong> потеряет доступ к этому музею. Аккаунт, созданные материалы и доступ к другим музеям сохранятся.</p>{error && <p className="museum-save-error" role="alert">{error}</p>}</Dialog.Body>
      <Dialog.Footer textButtonCancel="Отмена" textButtonApply="Исключить" onClickButtonCancel={() => setTarget(null)} onClickButtonApply={remove} propsButtonApply={{loading:removing,view:'outlined-danger'}} propsButtonCancel={{disabled:removing}} />
    </Dialog>
  </Card>;
}
