import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { ArrowRight, CheckCircle2, LoaderCircle } from 'lucide-react';
import { sendLead, validEmail, type Lead } from '@/lib/leads';

type Props = Omit<Lead, 'email' | 'name' | 'museum'>;
export function LeadForm({ intent, source, plan, billingPeriod }: Props) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [museum, setMuseum] = useState('');
  const [state, setState] = useState<
    'idle' | 'sending' | 'success' | 'error' | 'unconfigured'
  >('idle');
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  const emailRef = useRef<HTMLInputElement>(null);
  const id = intent === 'waitlist' ? 'waitlist-email' : 'demo-email';
  const configured = Boolean(window.VITRINA_CONFIG?.leadEndpoint?.trim());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!validEmail(email)) {
      setState('error');
      setError('Укажите корректный e-mail, например name@museum.ru.');
      emailRef.current?.focus();
      return;
    }
    busy.current = true;
    setState('sending');
    setError('');
    const payload: Lead = {
      email: email.trim(),
      intent,
      source,
      ...(name.trim() ? { name: name.trim() } : {}),
      ...(museum.trim() ? { museum: museum.trim() } : {}),
      ...(plan ? { plan } : {}),
      ...(billingPeriod ? { billingPeriod } : {}),
    };
    try {
      const result = await sendLead(
        payload,
        window.VITRINA_CONFIG?.leadEndpoint ?? '',
      );
      if (mounted.current)
        setState(result === 'sent' ? 'success' : 'unconfigured');
    } catch (cause) {
      if (mounted.current) {
        setState('error');
        setError(
          cause instanceof Error
            ? cause.message
            : 'Не удалось отправить заявку.',
        );
      }
    } finally {
      busy.current = false;
    }
  }
  return (
    <form
      className={`lead-form ${intent === 'demo' ? 'demo-form' : ''}`}
      onSubmit={submit}
      noValidate
      aria-label={intent === 'waitlist' ? 'Лист ожидания' : 'Заявка на демо'}
    >
      {state === 'success' ? (
        <output className="success-message">
          <CheckCircle2 size={24} />
          <div>
            <strong>Спасибо! Заявка отправлена.</strong>
            <p>
              {intent === 'demo'
                ? 'Мы свяжемся с вами, чтобы договориться о демонстрации.'
                : 'Мы напишем, когда откроем доступ.'}
            </p>
          </div>
        </output>
      ) : (
        <>
          {intent === 'demo' && (
            <div className="demo-fields">
              <label htmlFor="demo-name">
                Ваше имя <span>необязательно</span>
              </label>
              <input
                id="demo-name"
                name="name"
                autoComplete="name"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={state === 'sending'}
                placeholder="Как к вам обращаться"
              />
              <label htmlFor="demo-museum">
                Музей <span>необязательно</span>
              </label>
              <input
                id="demo-museum"
                name="museum"
                autoComplete="organization"
                maxLength={200}
                value={museum}
                onChange={(e) => setMuseum(e.target.value)}
                disabled={state === 'sending'}
                placeholder="Название музея"
              />
            </div>
          )}
          <label
            className={intent === 'waitlist' ? 'sr-only' : ''}
            htmlFor={id}
          >
            Ваш e-mail
          </label>
          <div className="email-row">
            <input
              ref={emailRef}
              id={id}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="Ваш e-mail"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (state === 'error') {
                  setState('idle');
                  setError('');
                }
              }}
              aria-invalid={state === 'error' && !validEmail(email)}
              aria-describedby={`${id}-status`}
              disabled={state === 'sending'}
            />
            <button
              className="button accent-button"
              type="submit"
              disabled={state === 'sending'}
            >
              {state === 'sending' ? (
                <>
                  Отправляем
                  <LoaderCircle className="spinner" />
                </>
              ) : (
                <>
                  Записаться
                  <ArrowRight />
                </>
              )}
            </button>
          </div>
          <div id={`${id}-status`} aria-live="polite">
            {state === 'error' && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {(!configured || state === 'unconfigured') && (
              <p className="form-unavailable">
                Онлайн-запись скоро откроется. Пока напишите нам:{' '}
                <a href="mailto:hello@vitrineapp.ru">hello@vitrineapp.ru</a>.
                {state === 'unconfigured' && (
                  <strong> Заявка не отправлена.</strong>
                )}
              </p>
            )}
          </div>
        </>
      )}
    </form>
  );
}
