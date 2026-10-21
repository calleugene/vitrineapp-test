export type BillingPeriod = 'year' | 'month';
export type Lead = {
  email: string;
  intent: 'waitlist' | 'demo';
  source: string;
  name?: string;
  museum?: string;
  plan?: string;
  billingPeriod?: BillingPeriod;
};
export type LeadResult = 'sent' | 'unconfigured';

declare global {
  interface Window {
    VITRINA_CONFIG?: { leadEndpoint?: string };
  }
}

export function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function sendLead(
  lead: Lead,
  endpoint: string,
  fetcher: typeof fetch = fetch,
): Promise<LeadResult> {
  if (!validEmail(lead.email))
    throw new Error('Укажите корректный e-mail, например name@museum.ru.');
  if (!endpoint.trim()) return 'unconfigured';
  const url = new URL(
    endpoint,
    typeof window !== 'undefined' ? window.location.href : 'http://localhost/',
  );
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(
      'Отправка временно недоступна. Напишите нам на hello@vitrina.museum.',
    );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetcher(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(lead),
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(
        'Не удалось отправить заявку. Попробуйте еще раз или напишите нам.',
      );
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json'))
      throw new Error(
        'Не удалось подтвердить отправку. Попробуйте еще раз или напишите нам.',
      );
    const result = (await response.json()) as { ok?: boolean };
    if (result.ok !== true)
      throw new Error(
        'Не удалось подтвердить отправку. Попробуйте еще раз или напишите нам.',
      );
    return 'sent';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      throw new Error('Сервер не ответил вовремя. Попробуйте еще раз.');
    if (error instanceof Error && error.message.startsWith('Не удалось'))
      throw error;
    throw new Error(
      'Не удалось отправить заявку. Проверьте соединение или напишите на hello@vitrina.museum.',
    );
  } finally {
    clearTimeout(timeout);
  }
}
