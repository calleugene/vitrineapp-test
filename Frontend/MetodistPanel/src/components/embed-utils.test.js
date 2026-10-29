import test from 'node:test';
import assert from 'node:assert/strict';
import {embedDetails} from './embed-utils.js';

test('snippet drops query credentials and escapes title; sizing is bounded', () => {
  const result = embedDetails('https://vitrineapp.ru/exhibits/AB123?route_id=private#x', 9999, '"><img src=x onerror=alert(1)>');
  assert.equal(result.src, 'https://vitrineapp.ru/embed/exhibits/AB123');
  assert.equal(result.height, 1200);
  assert.ok(!result.html.includes('<img'));
  assert.ok(!result.html.includes('route_id'));
  assert.ok(result.html.includes('sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"'));
});
test('rejects unsafe public URLs; supports HTTP only for local development', () => {
  for (const url of ['', 'javascript:alert(1)', 'https://user:pass@vitrineapp.ru/exhibits/AB123', 'http://example.com/exhibits/AB123', 'https://vitrineapp.ru/methodist/']) assert.equal(embedDetails(url), null);
  assert.equal(embedDetails('http://localhost:5174/exhibits/AB123', 100).height, 320);
});

test('existing ten-character public codes can be embedded without republishing', () => {
 const result = embedDetails('https://vitrineapp.ru/exhibits/ABCDEF1234');
 assert.equal(result.src, 'https://vitrineapp.ru/embed/exhibits/ABCDEF1234');
 assert.equal(result.standalone, 'https://vitrineapp.ru/exhibits/ABCDEF1234');
 for (const code of ['ABCDEF123','ABCDEF12345','ZZZZZZZZZZ']) assert.equal(embedDetails(`https://vitrineapp.ru/exhibits/${code}`),null);
});
