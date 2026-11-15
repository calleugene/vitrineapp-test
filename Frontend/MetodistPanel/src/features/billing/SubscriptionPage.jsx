import React, {useEffect, useRef, useState} from 'react';
import {Button, Card, Label, Loader} from '@gravity-ui/uikit';
import {billingApi} from '../../api';
import './subscription.css';

const money = new Intl.NumberFormat('ru-RU', {style: 'currency', currency: 'RUB'});
const date = new Intl.DateTimeFormat('ru-RU', {dateStyle: 'medium', timeStyle: 'short'});
const period = {month: '1 месяц', year: '12 месяцев'};
const statuses = {
  creating: ['Проверяем создание платежа', 'warning'],
  pending: ['Ожидает оплаты', 'warning'],
  paid: ['Оплачено', 'success'],
  failed: ['Платёж не создан', 'danger'],
  expired: ['Срок оплаты истёк', 'neutral'],
  refunded: ['Возврат', 'neutral'],
};
const errors = {
  offer_changed: 'Условия обновились. Проверьте сумму и подтвердите согласие ещё раз.',
  pending_order: 'У музея уже есть открытый платёж. Проверьте его ниже.',
  receipt_email_required: 'Укажите действующий адрес электронной почты в профиле для получения чека.',
  checkout_unavailable: 'Онлайн-оплата пока недоступна.',
};

function openOrder(order) {
  return order.status === 'creating' || order.status === 'pending';
}

export function SubscriptionPage({user, isMock}) {
  const [data, setData] = useState(null);
  const [returned, setReturned] = useState(null);
  const [selected, setSelected] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const request = useRef(null);
  const live = useRef(false);
  const locked = useRef(false);
  const [returnID] = useState(() => new URLSearchParams(window.location.search).get('order'));
  const inProgress = data?.orders.find(openOrder);
  const plan = data?.plans?.find(({id}) => id === selected) || data?.plans?.[0];

  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);
  useEffect(() => {
    if (isMock || !user?.museum_id) return;
    const controller = new AbortController();
    let timer;
    async function load() {
      try {
        const summary = await billingApi.subscription(controller.signal);
        const payment = returnID
          ? summary.orders.find(({id}) => id === returnID) ||
            await billingApi.order(returnID, controller.signal).catch((error) => {
              if (error.status !== 404) throw error;
              return {id: returnID, missing: true};
            })
          : null;
        if (controller.signal.aborted) return;
        setData(summary);
        setReturned(payment);
        setLoadingError('');
        if (summary.orders.some(openOrder)) timer = window.setTimeout(load, 7000);
      } catch {
        if (controller.signal.aborted) return;
        setLoadingError('Не удалось загрузить данные подписки.');
        timer = window.setTimeout(load, 12000);
      }
    }
    void load();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [isMock, user?.museum_id, returnID, refresh]);

  async function pay(event) {
    event.preventDefault();
    if (locked.current || !plan || !accepted) return;
    locked.current = true;
    setBusy(true);
    setActionError('');
    const offer = [plan.id, plan.amount_kopecks, data.terms_version].join(':');
    if (request.current?.offer !== offer) request.current = {offer, id: crypto.randomUUID()};
    try {
      const order = await billingApi.checkout({
        plan_id: plan.id, expected_amount_kopecks: plan.amount_kopecks,
        request_id: request.current.id, terms_accepted: true, terms_version: data.terms_version,
      });
      if (!live.current) return;
      request.current = null;
      if (order.checkout_url) {
        window.location.assign(order.checkout_url);
        return;
      }
      setAccepted(false);
      setRefresh((n) => n + 1);
    } catch (error) {
      if (!live.current) return;
      if (error.status === 409) {
        request.current = null;
        setAccepted(false);
      }
      setActionError(errors[error.code] || 'Не удалось начать оплату. Нажмите «Обновить статус» перед повторной попыткой.');
      setRefresh((n) => n + 1);
    } finally {
      locked.current = false;
      if (live.current) setBusy(false);
    }
  }

  return <section className="subscription-page">
    <header>
      <h1>Подписка</h1>
      <p>Оплата и история подписки выбранного музея.</p>
    </header>
    {isMock || !user?.museum_id ? <Card className="subscription-card">Раздел доступен в рабочем кабинете музея.</Card> : null}
    {!data && !loadingError && !isMock && user?.museum_id ? <div role="status"><Loader /> Загрузка подписки</div> : null}
    {loadingError ? <div role="alert" className="subscription-feedback">
      {loadingError} <Button onClick={() => setRefresh((n) => n + 1)}>Повторить</Button>
    </div> : null}
    {data && <>
      <Card className="subscription-card">
        <h2>Статус подписки</h2>
        <div className="subscription-feedback" role="status">
          <Label theme={data.subscription.status === 'active' ? 'success' : 'neutral'}>
            {{active: 'Активна', expired: 'Истекла', none: 'Без подписки'}[data.subscription.status]}
          </Label>
          {data.subscription.ends_at && <span>Оплачено до {date.format(new Date(data.subscription.ends_at))}</span>}
          {returned?.missing && <span>Платёж не найден. Проверьте выбранный музей.</span>}
          {returned && !returned.missing && <strong>Результат платежа · {statuses[returned.status]?.[0]}</strong>}
        </div>
      </Card>
      <Card className="subscription-card">
        <h2>{data.subscription.status === 'active' ? 'Продление' : 'Оплата'}</h2>
        {inProgress ? <>
          <p role="status">{inProgress.issue ? 'Платёж проверяет администратор. Проверьте статус позже.' :
            'У музея есть открытый платёж. Статус обновляется автоматически.'}</p>
          <div className="subscription-feedback">
            {data.checkout_enabled && inProgress.checkout_url ? <Button href={inProgress.checkout_url} view="action" size="l">Продолжить оплату</Button> : null}
            <Button size="l" onClick={() => setRefresh((n) => n + 1)}>Обновить статус</Button>
          </div>
        </> : data.checkout_enabled && plan ? <form onSubmit={pay}>
          <fieldset disabled={busy || Boolean(loadingError)}>
            <legend>Период</legend>
            {data.plans.map((option) => <label className="subscription-option" key={option.id}>
              <input type="radio" name="period" checked={plan.id === option.id} onChange={() => {
                setSelected(option.id);
                setAccepted(false);
                setActionError('');
              }} />
              <span>{period[option.id]}</span><strong>{money.format(option.amount_kopecks / 100)}</strong>
            </label>)}
          </fieldset>
          <p>Разовый платёж. Для следующего периода оплату можно повторить в кабинете. Чек придёт на {user.email}.</p>
          <div className="subscription-confirm">
            <input id="billing-terms" type="checkbox" checked={accepted} required disabled={busy} onChange={(event) => setAccepted(event.target.checked)} />
            <div><label htmlFor="billing-terms">Подтверждаю, что уполномочен оплатить подписку от имени музея и принимаю условия оплаты.</label>
              {' '}<a href={data.terms_url} target="_blank" rel="noreferrer">Условия оплаты</a>
            </div>
          </div>
          <Button type="submit" view="action" size="l" loading={busy} disabled={!accepted || busy || Boolean(loadingError)}>Оплатить</Button>
        </form> : <p>Онлайн-оплата пока недоступна.</p>}
        {actionError && <p role="alert">{actionError} <Button onClick={() => setRefresh((n) => n + 1)}>Обновить статус</Button></p>}
      </Card>
      {data.orders.length > 0 && <Card className="subscription-card">
        <h2>Платежи музея</h2>
        <ul className="subscription-history">
          {data.orders.map((order) => <li key={order.id}>
            <div><strong>{money.format(order.amount_kopecks / 100)}</strong> · {period[order.plan_id]}
              <small>{date.format(new Date(order.created_at))} · {order.id}</small></div>
            <Label theme={statuses[order.status]?.[1]}>{statuses[order.status]?.[0]}</Label>
          </li>)}
        </ul>
      </Card>}
    </>}
  </section>;
}
