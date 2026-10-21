import test from 'node:test';
import assert from 'node:assert/strict';
import { sendLead, validEmail } from '../lib/leads.ts';
const lead = {
  email: 'test@example.com',
  intent: 'waitlist',
  source: 'pricing',
  plan: 'museum-plus',
  billingPeriod: 'year',
};
test('email validation rejects incomplete input', () => {
  for (const value of ['', 'name', 'name@', 'name@museum', 'a b@example.com'])
    assert.equal(validEmail(value), false);
  assert.equal(validEmail('museum@example.com'), true);
});
test('no endpoint means no request and no success', async () => {
  let calls = 0;
  const result = await sendLead(lead, '', async () => {
    calls++;
    return new Response();
  });
  assert.equal(result, 'unconfigured');
  assert.equal(calls, 0);
});
test('invalid email never sends', async () => {
  let calls = 0;
  await assert.rejects(
    sendLead(
      { ...lead, email: 'invalid' },
      'https://example.com/leads',
      async () => {
        calls++;
        return new Response();
      },
    ),
  );
  assert.equal(calls, 0);
});
test('successful response sends exact JSON contract without cookies', async () => {
  let payload;
  const result = await sendLead(
    lead,
    'https://example.com/leads',
    async (url, options) => {
      assert.equal(url, 'https://example.com/leads');
      assert.equal(options.method, 'POST');
      assert.equal(options.credentials, 'omit');
      payload = JSON.parse(options.body);
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  );
  assert.equal(result, 'sent');
  assert.deepEqual(payload, lead);
  assert.equal('name' in payload, false);
});
test('server error does not report success', async () => {
  await assert.rejects(
    sendLead(
      lead,
      'https://example.com/leads',
      async () => new Response(null, { status: 500 }),
    ),
    /Не удалось/,
  );
});
test('an unexpected 2xx response does not report success', async () => {
  await assert.rejects(
    sendLead(
      lead,
      'https://example.com/leads',
      async () => new Response('<php source>', { status: 200 }),
    ),
    /подтвердить/,
  );
});
test('network failure produces a retryable error', async () => {
  await assert.rejects(
    sendLead(lead, 'https://example.com/leads', async () => {
      throw new TypeError('Network failure');
    }),
    /Не удалось/,
  );
});
test('unsafe endpoint schemes are rejected before fetch', async () => {
  let calls = 0;
  await assert.rejects(
    sendLead(lead, 'javascript:alert(1)', async () => {
      calls++;
      return new Response();
    }),
  );
  assert.equal(calls, 0);
});
