import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {validateProfileChanges,recordRequest} from '@/lib/account-inputs';
vi.mock('@tanstack/react-start/server',()=>({setResponseHeader:vi.fn()}));
vi.mock('@/lib/account-session.server',()=>({getFortebetSessionCookieHeader:()=> 'session=test',captureFortebetSessionCookies:vi.fn(),clearFortebetSessionCookie:vi.fn()}));
import {submitAccountProfile,submitBranchWithdrawal,loadAccountMessage,loadAccountRecords} from '@/lib/account-service.server';
const fetchMock=vi.fn();
const response=(data:unknown)=>new Response(JSON.stringify({status:'OK',data}));
const account=()=>response({nickname:'sample',wallets:[{name:'money',balance:25000,currency:'UGX'}]});
const profile={contact:{phone:'+256700000000',address:[{addressType:'MAIN',country:'UG',streetName:'Old',streetNumber:'10'},{addressType:'DELIVERY',city:'Other'}]}};
const changes={title:'Mr',firstName:'Sample',lastName:'User',email:'sample@example.com',streetName:'New Street',city:'Kampala',zipcode:'',currentPassword:'test-current',newPassword:'',newPasswordAgain:''};
beforeEach(()=>{vi.stubGlobal('fetch',fetchMock);fetchMock.mockReset();});
afterEach(()=>vi.unstubAllGlobals());
it('requires the current password before saving real account details',()=>{expect(()=>validateProfileChanges({...changes,currentPassword:''})).toThrow();});
it('rejects mismatching new passwords before calling Fortebet',()=>{expect(()=>validateProfileChanges({...changes,newPassword:'new-a',newPasswordAgain:'new-b'})).toThrow();});
it('saves entered profile fields while preserving phone and other addresses',async()=>{
 fetchMock.mockResolvedValueOnce(account()).mockResolvedValueOnce(response(profile)).mockResolvedValueOnce(response({result:true}));
 expect((await submitAccountProfile(changes)).ok).toBe(true);
 const [url,options]=fetchMock.mock.calls[2] as [string,RequestInit];
 expect(url).toBe('https://fortebet.ug/api/web/v1/client/profile/set');
 expect(JSON.parse(String(options.body))).toEqual({password:'test-current',personalInfo:{contact:{title:'Mr',firstName:'Sample',lastName:'User',email:'sample@example.com',phone:'+256700000000',address:[{addressType:'MAIN',country:'UG',streetName:'New Street',streetNumber:'10',city:'Kampala',zipcode:''},{addressType:'DELIVERY',city:'Other'}]}}});
});
it('changes the password only after the profile save succeeds',async()=>{
 fetchMock.mockResolvedValueOnce(account()).mockResolvedValueOnce(response(profile)).mockResolvedValueOnce(response({result:true})).mockResolvedValueOnce(response({result:true}));
 expect((await submitAccountProfile({...changes,newPassword:'new-test',newPasswordAgain:'new-test'})).ok).toBe(true);
 expect(fetchMock.mock.calls[3]?.[0]).toBe('https://fortebet.ug/api/web/v1/client/password/change');
 expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toEqual({oldPassword:'test-current',newPassword:'new-test',newPasswordConfirm:'new-test'});
});
it('does not change the password when the profile save is rejected',async()=>{
 fetchMock.mockResolvedValueOnce(account()).mockResolvedValueOnce(response(profile)).mockResolvedValueOnce(response({result:false}));
 expect((await submitAccountProfile({...changes,newPassword:'new-test',newPasswordAgain:'new-test'})).ok).toBe(false);expect(fetchMock).toHaveBeenCalledTimes(3);
});
it('rejects withdrawals above the current real balance',async()=>{fetchMock.mockResolvedValueOnce(account());expect((await submitBranchWithdrawal(25001)).ok).toBe(false);expect(fetchMock).toHaveBeenCalledTimes(1);});
it('submits branch withdrawals using the verified amount contract',async()=>{fetchMock.mockResolvedValueOnce(account()).mockResolvedValueOnce(response({result:true,message:'Accepted'}));expect((await submitBranchWithdrawal(5000)).ok).toBe(true);expect(fetchMock.mock.calls[1]?.[0]).toBe('https://fortebet.ug/api/web/v1/client/paymethods/payout-request');expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({amount:5000});});
it('requests VIP records from wallet 2 with real paging and filters',()=>{expect(recordRequest({path:'transactions/pts',filters:['VIP PTS winnings'],from:'2026-11-01',to:'2026-11-07',page:1})).toEqual({limit:31,offset:30,dateFrom:'2026-11-01',dateTo:'2026-11-07',wallet:2,type:'vipWin'});});
it('requests placed virtual soccer tickets including repaired state',()=>{expect(recordRequest({path:'bets/vsoccer',filters:['Placed'],from:'',to:'',page:0})).toEqual({limit:31,offset:0,dateFrom:null,dateTo:null,state:['PLACED','REPAIRED'],betType:['VSOCCER']});});
it('loads message content by the signed-in users message identifier',async()=>{fetchMock.mockResolvedValueOnce(account()).mockResolvedValueOnce(response({html:'Message body'}));expect(await loadAccountMessage(123)).toEqual({ok:true,data:{html:'Message body'}});expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({messageId:123,lang:'EN'});});
it('does not fetch records without a valid Fortebet account',async()=>{fetchMock.mockResolvedValueOnce(response(null));expect((await loadAccountRecords({path:'transactions/money',filters:['All'],from:'',to:'',page:0})).ok).toBe(false);expect(fetchMock).toHaveBeenCalledTimes(1);});