import React, {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

const TYPES = [
  {value: 'review', label: 'Отзыв', field: 'Ваш отзыв', action: 'Отправить отзыв', placeholder: 'Что запомнилось? Что можно улучшить?'},
  {value: 'question', label: 'Вопрос', field: 'Ваш вопрос', action: 'Отправить вопрос', placeholder: 'О чём вы хотели бы узнать у музея?'},
  {value: 'suggestion', label: 'Идея', field: 'Ваша идея', action: 'Отправить идею', placeholder: 'Что вы предложили бы музею?'},
];
const RATINGS = ['Очень плохо', 'Плохо', 'Нормально', 'Хорошо', 'Отлично'];

function visitorToken() {
  try { return window.sessionStorage.getItem('viralabs.visitor.access-token') || ''; }
  catch { return ''; }
}

export function StoryFeedback({publicCode}) {
  const id = useId();
  const [opened, setOpened] = useState(false);
  const [kind, setKind] = useState('review');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const submission = useRef(null);
  const sending = useRef(false);
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const type = TYPES.find((item) => item.value === kind);
  const pending = state === 'pending';

  useEffect(() => {
    if (!opened) return undefined;
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    headingRef.current?.focus({preventScroll: true});
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpened(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button, input, textarea, a[href]')]
        .filter((node) => !node.disabled && (node.type !== 'radio' || node.checked || !dialog.querySelector(`input[name="${node.name}"]:checked`)));
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({preventScroll: true});
    };
  }, [opened]);

  useEffect(() => {
    if (opened && state === 'sent') headingRef.current?.focus({preventScroll: true});
  }, [opened, state]);

  const send = async (event) => {
    event.preventDefault();
    if (sending.current || !message.trim() || (kind === 'review' && !rating)) return;
    const token = visitorToken();
    if (!token) { setError('Чтобы отправить сообщение, войдите в аккаунт посетителя. Ваш текст сохранён в этом окне.'); return; }
    const body = message.trim();
    const signature = JSON.stringify({publicCode, kind, body, rating: kind === 'review' ? rating : 0});
    if (submission.current?.signature !== signature) submission.current = {signature, id: crypto.randomUUID()};
    sending.current = true;
    setState('pending'); setError('');
    try {
      const response = await fetch('/api/feedback/api/v1/public/feedback', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({id: submission.current.id, public_code: publicCode, type: kind, body, rating: kind === 'review' ? rating : 0}),
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'Войдите в аккаунт ещё раз. Ваш текст сохранён в этом окне.' : 'Не удалось отправить сообщение. Попробуйте ещё раз — текст сохранён.');
      setState('sent');
    } catch (reason) {
      setState('idle');
      setError(reason instanceof TypeError ? 'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.' : reason.message);
    } finally { sending.current = false; }
  };

  return <>
    <button type="button" className="public-feedback-trigger" onClick={() => setOpened(true)}>Оставить отзыв или задать вопрос</button>
    {opened && createPortal(
      <div className="public-feedback-backdrop">
        <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-description`} className="public-feedback-dialog">
          <button className="feedback-close" type="button" onClick={() => setOpened(false)} aria-label="Закрыть сообщение музею">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
          {state === 'sent' ? <div className="feedback-success">
            <span className="feedback-success-mark" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            <h2 ref={headingRef} tabIndex={-1} id={`${id}-heading`}>{kind === 'review' ? 'Спасибо за отзыв!' : 'Сообщение отправлено'}</h2>
            <p id={`${id}-description`}>{kind === 'review' ? 'Музей получил ваш отзыв. Он появится после проверки.' : 'Спасибо, что написали. Ваше сообщение передано музею.'}</p>
            <button className="feedback-submit" type="button" onClick={() => setOpened(false)}>Готово</button>
          </div> : <>
            <header className="feedback-header">
              <h2 ref={headingRef} tabIndex={-1} id={`${id}-heading`}>Сообщение музею</h2>
              <p id={`${id}-description`}>Поделитесь впечатлением или задайте вопрос</p>
            </header>
            <form onSubmit={send} aria-busy={pending}>
              <fieldset className="feedback-types" disabled={pending}>
                <legend className="feedback-sr-only">Тип сообщения</legend>
                {TYPES.map((item) => <label key={item.value} className="feedback-type">
                  <input type="radio" name={`${id}-type`} value={item.value} checked={kind === item.value} onChange={() => {setKind(item.value); setError('');}} />
                  <span>{item.label}</span>
                </label>)}
              </fieldset>
              {kind === 'review' && <fieldset className="feedback-rating" disabled={pending} aria-describedby={`${id}-rating`}>
                <legend>Как вам экспонат?</legend>
                <div className="feedback-stars">
                  {RATINGS.map((label, index) => <label key={label} className={`feedback-star${rating > index ? ' is-filled' : ''}`}>
                    <input type="radio" required name={`${id}-rating`} value={index + 1} checked={rating === index + 1} onChange={() => setRating(index + 1)} aria-label={`${index + 1} из 5 — ${label}`} />
                    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                  </label>)}
                </div>
                <p className="feedback-rating-caption" id={`${id}-rating`}>{rating ? RATINGS[rating - 1] : 'Выберите оценку'}</p>
              </fieldset>}
              <div className="feedback-message">
                <label htmlFor={`${id}-message`}>{type.field}</label>
                <textarea id={`${id}-message`} required maxLength={5000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={type.placeholder} disabled={pending} aria-describedby={`${id}-count`} />
                <span className="feedback-count" id={`${id}-count`}>{message.length} / 5000</span>
              </div>
              {error && <p className="feedback-error" role="alert">{error}</p>}
              <button className="feedback-submit" type="submit" disabled={pending || !message.trim() || (kind === 'review' && !rating)}>{pending ? 'Отправляем…' : type.action}</button>
              <p className="feedback-footnote">{!visitorToken() ? 'Для отправки нужен вход в аккаунт посетителя.' : kind === 'review' ? 'Отзыв появится после проверки музеем' : 'Сообщение будет передано команде музея'}</p>
            </form>
          </>}
        </section>
      </div>, document.body,
    )}
  </>;
}
