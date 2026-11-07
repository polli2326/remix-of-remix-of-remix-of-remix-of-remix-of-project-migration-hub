import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ request: {}, cookie: undefined as string | undefined, written: vi.fn(), fetch: vi.fn() }));
vi.mock('@tanstack/react-start/server', () => ({
  getCookie: () => state.cookie, getRequest: () => state.request,
  getRequestProtocol: () => 'https', setCookie: state.written, setResponseHeader: vi.fn(),
}));
import { submitFortebetLogin, loadPendingMobileMoney, loadAccountRecords } from '@/lib/account-service.server';

const response = (data: unknown, status = 200, headers = {}) => new Response(JSON.stringify({ status: status === 200 ? 'OK' : 'ERROR', data }), {status, headers});
beforeEach(() => { state.request = {}; state.cookie = undefined; state.fetch.mockReset(); state.written.mockClear(); vi.stubGlobal('fetch', state.fetch); });
afterEach(() => vi.unstubAllGlobals());

it('confirms login with the captured session before returning a signed-in account', async () => {
  state.fetch.mockResolvedValueOnce(response({nickname:'test-user'}, 200, {'set-cookie':'session=verified; Path=/; HttpOnly'}));
  state.fetch.mockResolvedValueOnce(response({nickname:'test-user',wallets:[]}));
  const result = await submitFortebetLogin({nickname:'test-user',password:'test-only'});
  expect(result).toMatchObject({ok:true,account:{nickname:'test-user'}});
  const call = state.fetch.mock.calls[1];
  expect(call?.[0]).toBe('https://fortebet.ug/api/web/v1/client/info');
  expect((call?.[1].headers as Headers).get('Cookie')).toBe('session=verified');
});

it('does not claim login success when Fortebet rejects the established session', async () => {
  state.fetch.mockResolvedValueOnce(response({nickname:'test-user'}, 200, {'set-cookie':'session=rejected; Path=/'}));
  state.fetch.mockResolvedValueOnce(response(null,401));
  expect(await submitFortebetLogin({nickname:'test-user',password:'test-only'})).toMatchObject({ok:false});
  expect(state.written).toHaveBeenLastCalledWith('fortebet_proxy_session','',expect.objectContaining({maxAge:0}));
});

it('does not call payment endpoints without an authenticated session', async () => {
  expect(await loadPendingMobileMoney('payin')).toEqual({ok:false,message:'Sign in to view your payment requests.'});
  expect(state.fetch).not.toHaveBeenCalled();
});

it('does not misreport a temporary Fortebet outage as signed out on deposits', async () => {
  state.cookie = btoa(JSON.stringify({session:'verified'}));
  state.fetch.mockResolvedValueOnce(response(null,503));
  expect(await loadPendingMobileMoney('payin')).toEqual({ok:false,message:'Unable to confirm your account with Fortebet. Please try again.'});
  expect(state.fetch).toHaveBeenCalledTimes(1);
});

it('does not misreport a connection failure as signed out on transactions', async () => {
  state.cookie = btoa(JSON.stringify({session:'verified'}));
  state.fetch.mockRejectedValueOnce(new Error('connection unavailable'));
  expect(await loadAccountRecords({path:'transactions/money',filters:['All'],from:'',to:'',page:0})).toEqual({ok:false,message:'Unable to confirm your account with Fortebet. Please try again.'});
});