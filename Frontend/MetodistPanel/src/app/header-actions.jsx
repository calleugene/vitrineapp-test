import React, {useState} from 'react';
import {Bell} from '@gravity-ui/icons';
import {Button} from '@gravity-ui/uikit';
import {notificationApi} from '../api';

export function HeaderActions({items = [], unreadCount = 0, onRefresh}) {
  const [open,setOpen] = useState(false);
  const [pending,setPending] = useState(false);
  const [error,setError] = useState('');
  const markRead = async (id) => {
    if (pending) return;
    setPending(true);setError('');
    try {if (id) await notificationApi.markRead(id);else await notificationApi.markAllRead();await onRefresh?.();}
    catch {setError('Не удалось обновить уведомления.');}
    finally {setPending(false);}
  };
  return <div className="notification-shell"><button type="button" className="notification-trigger" aria-expanded={open} aria-label={`Уведомления, непрочитанных: ${unreadCount}`} onClick={() => {setOpen(!open);if (!open) void onRefresh?.();}}><Bell />{unreadCount > 0 ? <span className="notification-badge">{unreadCount}</span> : null}</button>{open ? <section className="notification-popover" aria-label="Уведомления"><h3>Уведомления</h3><Button disabled={pending || unreadCount === 0} onClick={() => markRead()}>Прочитать все</Button>{error ? <p role="alert">{error}</p> : null}{!items.length ? <p>Уведомлений пока нет.</p> : items.map((item) => <article key={item.id}><p>{item.title}</p><small>{item.meta}</small>{item.unread ? <Button disabled={pending} onClick={() => markRead(item.id)}>Прочитано</Button> : null}</article>)}<Button onClick={() => setOpen(false)}>Закрыть</Button></section> : null}</div>;
}
