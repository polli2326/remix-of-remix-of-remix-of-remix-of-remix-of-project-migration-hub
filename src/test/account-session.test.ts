import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ request: {}, cookie: undefined as string | undefined, written: vi.fn() }));
vi.mock('@tanstack/react-start/server', () => ({
  getCookie: () => state.cookie,
  getRequest: () => state.request,
  getRequestProtocol: () => 'https',
  setCookie: state.written,
}));
import { captureFortebetSessionCookies, getFortebetSessionCookieHeader } from '@/lib/account-session.server';

beforeEach(() => { state.request = {}; state.cookie = undefined; state.written.mockClear(); });

it('forwards newly established login cookies to subsequent account checks in the same request', () => {
  captureFortebetSessionCookies(new Response('', { headers: { 'set-cookie': 'session=verified; Path=/; HttpOnly' } }));
  expect(getFortebetSessionCookieHeader()).toBe('session=verified');
});

it('preserves both cookies when a runtime combines headers including an expiry date', () => {
  const response = new Response('', { headers: { 'set-cookie': 'session=verified; Expires=Tue, 10 Nov 2026 00:00:00 GMT; Path=/, route=node2; Path=/' } });
  Object.defineProperty(response.headers, 'getSetCookie', { value: undefined });
  captureFortebetSessionCookies(response);
  expect(getFortebetSessionCookieHeader()).toBe('session=verified; route=node2');
});

it('does not discard other cookies when one is rotated in the same request', () => {
  captureFortebetSessionCookies(new Response('', { headers: { 'set-cookie': 'session=first; Path=/' } }));
  captureFortebetSessionCookies(new Response('', { headers: { 'set-cookie': 'route=node2; Path=/' } }));
  expect(getFortebetSessionCookieHeader()).toBe('session=first; route=node2');
});

it('does not silently report a usable session when the browser cannot store it', () => {
  expect(() => captureFortebetSessionCookies(new Response('', { headers: { 'set-cookie': `session=${'x'.repeat(4000)}; Path=/` } }))).toThrow();
});

it('isolates cookie state between users requests', () => {
  captureFortebetSessionCookies(new Response('', { headers: { 'set-cookie': 'session=user-one; Path=/' } }));
  state.request = {};
  expect(getFortebetSessionCookieHeader()).toBe('');
});