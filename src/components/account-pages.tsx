import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeft, ArrowRight, Banknote, Eye, EyeOff, Mail, Smartphone, Store, Ticket, UserRound, Wallet } from 'lucide-react';
import { LiveShell } from './live-shell';
import { Button } from './ui/button';
import { openLogin } from '@/lib/login-modal';
import { setAccountSession, useAccountSession } from '@/lib/account-state';
import { getSignedInAccountActivity, getPendingMobileMoney, requestMobileMoneyDeposit, requestMobileMoneyPayout, type SignedInAccountActivityResult } from '@/lib/account.functions';
import { accountLinks, accountPageTitle, accountText as text, recordObject as obj, recordRows } from '@/lib/account-pages';

type Activity = Extract<SignedInAccountActivityResult, {ok:true}>;
const base = '/client/account/';
function money(value: unknown) { return Number(value || 0).toLocaleString('en-UG') + ' UGX'; }
function date(value: unknown) { const d = new Date(text(value)); return Number.isNaN(d.valueOf()) ? text(value) : d.toLocaleString('en-UG'); }

export function AccountPages({ path = 'profile' }: { path?: string }) {
  const session = useAccountSession();
  const [data, setData] = useState<Activity | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!session.account) { setData(null); return; }
    let active = true; setLoading(true); setError('');
    void getSignedInAccountActivity().then(result => { if (!active) return; if (result.ok) { setData(result); setAccountSession(result.account); } else setError(result.message); }).catch(() => { if (active) setError('Unable to load your account. Please try again.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.account?.nickname, refresh]);
  const profile = obj(data?.profile['ok'] ? data.profile['data'] : null);
  const contact = obj(profile['contact']);
  const address = obj(contact['address'] ?? profile['address']);
  return <LiveShell layout="full" active="account"><div className="fb-account">
    <nav className="fb-account-nav" aria-label="Account navigation">{accountLinks.map(([label,target,kind]) => {
      const Icon = kind === 'wallet' ? Wallet : kind === 'ticket' ? Ticket : kind === 'profile' ? UserRound : kind === 'messages' ? Mail : Banknote;
      const active = target === path || target === 'deposit' && /^(deposits|withdrawals)\//.test(path) || target === 'bets/all' && path === 'bets';
      return target ? <Button asChild variant="ghost" key={label} className={`fb-account-nav-link ${kind === 'child' ? 'is-child' : ''} ${active ? 'is-active' : ''}`}><a href={base+target}>{kind !== 'child' && <Icon/>}{label}</a></Button> : <div key={label} className="fb-account-nav-group"><Icon/>{label}</div>;
    })}</nav>
    <main className={`fb-account-main ${path === 'profile' ? 'fb-profile-main' : ''}`}>
      {!session.account ? <div className="fb-account-signin"><Button className="fb-account-action" onClick={openLogin}>Login</Button></div> : <>
        {error && <p role="alert">{error}</p>}
        {path === 'deposit' ? <CashierHome/> : path === 'profile' ? <ProfilePage key={data ? session.account.nickname : "loading"} nickname={session.account.nickname} contact={contact} address={address} loading={loading}/> : /^(deposits|withdrawals)\//.test(path) ? <PaymentPage key={path} path={path} phone={text(contact['phone'])} balance={session.account.balance}/> : <RecordsPage key={path} path={path} data={data} loading={loading} reload={()=>setRefresh(n=>n+1)}/>}
      </>}
    </main>
  </div></LiveShell>;
}
function Provider({name}: {name:string}) { return <span className={`fb-provider ${name}`}><img alt={name === 'mtn' ? 'MTN' : 'Airtel Money'} src={name === 'mtn' ? '/site-assets/f86d0edcebade4f4-b7026c838526636dab4e6860b0593a61.png' : '/site-assets/1cb8fa843cd5d3dc-b67f103634d8785c7593969457466c0f.png'}/></span>; }
function CashierHome() {
  return <>{['deposits','withdrawals'].map(kind=><section className="fb-cashier-section" key={kind}>
    <h2 className="fb-account-heading">{kind === 'deposits' ? <ArrowDownToLine/> : <ArrowUpFromLine/>}<Wallet/>{kind.toUpperCase()}</h2>
    <div className="fb-cashier-options"><div className="fb-cashier-option"><h3>{kind === 'deposits' ? 'Deposit' : 'Withdrawal'} at the Branch</h3><Button variant="ghost" asChild className="fb-payment-choice"><a href={base+kind+'/branch'} aria-label={`${kind} at the Branch`}>{kind === 'deposits' ? <ArrowRight/> : <ArrowLeft/>}<Store className="fb-branch-icon"/></a></Button></div>
    <div className="fb-cashier-option"><h3>{kind === 'deposits' ? 'Deposit' : 'Withdrawal'} via mobile phone</h3><div className="fb-payment-choice">{kind === 'deposits' ? <ArrowRight/> : <ArrowLeft/>}<Smartphone className="fb-phone-icon"/>{['airtel','mtn'].map(name=><Button asChild variant="ghost" key={name} className="fb-provider-link"><a href={base+kind+'/'+name} aria-label={`${kind} via ${name}`}><Provider name={name}/></a></Button>)}</div></div></div>
  </section>)}</>;
}
function ProfileField({label,value,placeholder,password=false}: {label:string;value?:string;placeholder?:string;password?:boolean}) {
  const [show,setShow] = useState(false);
  return <label className="fb-profile-field"><span>{label}</span><div className="fb-profile-input"><input aria-label={label} defaultValue={value} placeholder={placeholder} type={password && !show ? 'password' : 'text'} autoComplete={password ? 'new-password' : 'off'}/>{password && <Button variant="ghost" size="icon" type="button" aria-label={`${show ? 'Hide' : 'Show'} ${label}`} onClick={()=>setShow(!show)}>{show ? <EyeOff/> : <Eye/>}</Button>}</div></label>;
}
function ProfilePage({nickname,contact,address,loading}: {nickname:string;contact:Record<string,unknown>;address:Record<string,unknown>;loading:boolean}) {
  const [notice,setNotice] = useState('');
  const email = text(contact['email']).split('@');
  return <form onSubmit={e=>{e.preventDefault();setNotice('Profile changes are not connected here. Please save changes on fortebet.ug.');}}>
    <section className="fb-profile-section"><h2>Profile</h2><div className="fb-profile-details"><p><span>Username</span><strong>{nickname}</strong></p><p><span>Phone number</span><strong>{loading ? '…' : text(contact['phone'])}</strong></p></div></section>
    <section className="fb-profile-section"><h2>Name and address</h2><div className="fb-profile-columns"><div><ProfileField label="Title" value={text(contact['title'])} placeholder="Enter your title"/><ProfileField label="First name" value={text(contact['firstName'])}/><ProfileField label="Last name" value={text(contact['lastName'])}/><label className="fb-profile-field"><span>E-mail</span><div className="fb-email"><input aria-label="Email name" defaultValue={email[0]}/><span>@</span><input aria-label="Email domain" defaultValue={email[1]}/></div></label></div><div><ProfileField label="Address" value={text(address['address'] || address['streetName'])}/><ProfileField label="City" value={text(address['city'])}/><ProfileField label="Zipcode" value={text(address['zipcode'])}/></div></div></section>
    <section className="fb-profile-section"><h2>Change password</h2><div className="fb-profile-columns"><div><ProfileField label="New password" password placeholder="Enter new password"/><ProfileField label="New password again" password placeholder="Enter new password again"/></div></div></section>
    <section className="fb-profile-confirm"><ProfileField label="Current password" password placeholder="Enter current password"/><Button className="fb-account-action" type="submit">Save changes</Button>{notice && <p role="status">{notice}</p>}</section>
  </form>;
}
function PaymentPage({path,phone,balance}: {path:string;phone:string;balance:number}) {
  const withdraw = path.startsWith('withdrawals'); const provider = path.split('/')[1] ?? 'mtn'; const branch = provider === 'branch'; const name = provider === 'mtn' ? 'MTN' : 'Airtel';
  const [amount,setAmount] = useState(''); const [pending,setPending] = useState(true);const [blocked,setBlocked] = useState(false);const [notice,setNotice] = useState('');
  useEffect(()=>{if(branch){setPending(false);return;}let active=true;void getPendingMobileMoney({data:{kind:withdraw?'payout':'payin'}}).then(r=>{if(!active)return;setBlocked(!r.ok || r.requests.length>0);if(!r.ok)setNotice(r.message);else if(r.requests.length)setNotice('A mobile money request is pending.');}).catch(()=>{if(active){setBlocked(true);setNotice('Unable to check pending requests.');}}).finally(()=>{if(active)setPending(false);});return()=>{active=false;};},[withdraw,branch]);
  async function submit(e:FormEvent) { e.preventDefault();if(branch){setNotice('Branch withdrawal requests are not connected here. Use fortebet.ug.');return;}setPending(true);setNotice('');try {const result=await (withdraw?requestMobileMoneyPayout:requestMobileMoneyDeposit)({data:{amount:Number(amount)}});setNotice(result.message);if(result.ok){setBlocked(true);setAmount('');}}catch{setNotice('Unable to complete the request. Please try again.');}finally{setPending(false);} }
  return <><h2 className="fb-account-heading"><Button variant="ghost" asChild className="fb-back"><a href={base+'deposit'}><ArrowLeft/> BACK</a></Button><Wallet/>{branch ? withdraw?'CASH WITHDRAWAL AT THE BRANCH':'DEPOSITING MONEY AT THE BRANCH' : withdraw?'WITHDRAWAL VIA MOBILE '+name.toUpperCase():'DEPOSITING MONEY VIA '+name.toUpperCase()}</h2>
    <article className="fb-payment-article"><header><h1>{withdraw?'WITHDRAWAL MONEY FROM YOUR ACCOUNT':'DEPOSIT MONEY TO YOUR ACCOUNT'}<br/><em>{branch?'AT THE BRANCH':'DIRECTLY FROM YOUR MOBILE PHONE'}</em></h1>{!branch && <Provider name={provider}/>}</header>
      {branch ? <div className="fb-payment-copy">{withdraw ? <><p>Enter the amount you want to withdraw. Then you will receive a 4digit number on your registered phone number.</p><p>To complete the withdrawal visit a Fortebet branch and give the operator your username along with the 4digit number.</p></> : <><p><em>Client In</em> is a convenient option for depositing funds instantly, directly into your account.</p><ul><li>Visit any branch and inform the operator that you wish to perform a Client In transaction.</li><li>Provide your username and the desired amount. You will be issued with a transaction slip.</li><li>Carefully review the information on the slip to ensure all details are correct.</li><li>In the event of an error, the transaction can be cancelled within 10 minutes.</li></ul></>}</div> : !withdraw && <><h3>YOU CAN CHOOSE ONE OF TWO OPTIONS</h3><p className="fb-payment-option"><b>1.</b> FIRST OPTION - load from your ForteBet registered number:</p></>}
      {(withdraw || !branch) && <form className="fb-inline-payment" onSubmit={submit}>{!withdraw && <p>PHONE NUMBER: <span>{phone}</span></p>}<div><label htmlFor="fb-payment-amount">AMOUNT (UGX)</label><input id="fb-payment-amount" type="number" inputMode="numeric" required min={withdraw?1:1000} max={withdraw?balance:5000000} step={1} value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Enter your requested amount"/><Button className="fb-account-action" type="submit" disabled={pending||blocked}>{pending?'PLEASE WAIT…':withdraw?'WITHDRAW':'DEPOSIT'}</Button></div>{withdraw && <p>Your current account balance: <em>{money(balance)}</em></p>}{notice && <p role="status">{notice}</p>}</form>}
      <div className="fb-payment-copy">{!branch && <><h3>{withdraw?'NOTE:':'TO LOAD YOUR ACCOUNT:'}</h3>{withdraw ? <p>All mobile money withdrawals are under approval. The process time should not exceed 24 hours. Withdrawals will be cashed out to your registered phone number with ForteBet – make sure the number is correct.</p> : <><ol><li>Enter the amount</li><li>Press the deposit button</li></ol><p>You should then receive a payment request on your registered phone number. When approved, money will be transferred into your ForteBet account. For guidance call 0800 202 202 or 0800 303 303.</p></>}</>}
      <table className="fb-payment-limits"><tbody><tr><th>The minimum amount of a {withdraw?'withdrawal':'deposit'}{!branch && ': '+name}</th><td>1,000 UGX</td></tr><tr><th>The maximum amount of a {withdraw?'withdrawal':'deposit'}</th><td>{branch?'unlimited':'5,000,000 UGX per transaction / 20,000,000 UGX per 24 hours'}</td></tr>{!branch && !withdraw && <><tr><th>Processing time</th><td>Normally within 3 minutes</td></tr><tr><th>Fees:</th><td>Standard {name} fees applies</td></tr></>}</tbody></table>
      {withdraw && !branch && <><p>Another withdrawal request can be made after 2 minutes from the last approved request, if the maximum limit has not been reached. All fees are charged by your telecom provider.</p><h3>FEES:</h3><p>Your telecom provider applies mobile money withdrawal fees according to the amount withdrawn.</p></>}
      </div></article>
      {!withdraw && !branch && <article className="fb-payment-article"><p className="fb-payment-option"><b>2.</b> SECOND OPTION - load from a different number:</p><div className="fb-payment-copy"><p>Make sure the different number is not registered with ForteBet. After completing the payment call 0800 202 202 or 0800 303 303 so the team can credit your account.</p><h3>{provider==='mtn'?'9':'6'} QUICK STEPS - how to load money into my account</h3><ol className="fb-payment-steps">{(provider==='mtn'?['Dial *165#','Select Payments','Select Lotto & Sports Betting','Enter merchant code FORTEBET','Enter your username as payment reference','Enter the amount','Confirm using your mobile money PIN','Wait for processing','Check your confirmation message']:['Dial *185#','Select Payments','Select Betting and Gaming','Select FORTEBET','Enter the amount','Enter your username as the reference']).map((s,i)=><li key={s}><strong>STEP {i+1}</strong><p>{s}</p></li>)}</ol></div></article>}
  </>;
}
function RecordsPage({path,data,loading,reload}: {path:string;data:Activity|null;loading:boolean;reload:()=>void}) {
  const tickets=path.startsWith('bets');const messages=path==='messages';const points=path.endsWith('/pts');
  const [filters,setFilters]=useState(['All']);const [from,setFrom]=useState('');const [to,setTo]=useState('');const [expanded,setExpanded]=useState<number|null>(null);
  const record=messages?data?.messages:tickets?data?.tickets:data?.transactions;
  const options=tickets?['All','Win','Cashout','Placed','Lost','Void','Canceled']:['All','Deposits','Withdrawals','Money winnings','Money losses'];
  const rows=recordRows(record).filter(row=>{
    const timestamp=text(row['timestampIn']??row['timestamp']??row['date']);if(from&&timestamp.slice(0,10)<from||to&&timestamp.slice(0,10)>to)return false;
    if(tickets && !['bets','bets/all','bets/betting'].includes(path)){const type=text(row['type']).toLowerCase();if(path==='bets/vsoccer'&&!type.includes('soccer'))return false;if(path==='bets/live'&&!type.includes('live'))return false;if(path==='bets/prematch'&&!type.includes('prematch'))return false;if(path==='bets/virtual'&&!type.includes('virtual'))return false;}
    if(filters.includes('All')||messages)return true;const status=text(row['status']).toLowerCase();const amount=Number(row['amount']??row['value']??0);return filters.some(f=>tickets?status===f.toLowerCase():f==='Deposits'?amount>0:f==='Withdrawals'?amount<0:text(row['type']).toLowerCase().includes(f.toLowerCase()));
  });
  return <><h2 className="fb-account-heading">{accountPageTitle(path).toUpperCase()}</h2>{!messages && <div className="fb-record-filters">{options.map(option=><label key={option}><input type="checkbox" checked={filters.includes(option)} onChange={()=>setFilters(current=>option==='All'?['All']:current.includes(option)?current.filter(f=>f!==option):[...current.filter(f=>f!=='All'),option])}/>{option}</label>)}<input aria-label="From" placeholder="From" type={from?'date':'text'} value={from} onFocus={e=>e.currentTarget.type='date'} onChange={e=>setFrom(e.target.value)}/><input aria-label="To" placeholder="To" type={to?'date':'text'} value={to} onFocus={e=>e.currentTarget.type='date'} onChange={e=>setTo(e.target.value)}/><Button className="fb-account-action" onClick={reload} disabled={loading}>REFRESH</Button></div>}
    {record && !record.ok && <p className="fb-record-error" role="status">{record.message}</p>}
    {loading && !data && <p role="status">Loading…</p>}
    {messages ? <div className="fb-messages">{rows.map((row,i)=><section key={i}><Button variant="ghost" className="fb-message-title" onClick={()=>setExpanded(expanded===i?null:i)}><Mail/><strong>{text(row['title'])}</strong><span>{date(row['timestamp'])}</span></Button>{expanded===i && <p>{text(row['html']).replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ')}</p>}</section>)}</div> : tickets ? <div className="fb-ticket-list">{rows.map((row,i)=><section key={i}><Button variant="ghost" className="fb-ticket-row" onClick={()=>setExpanded(expanded===i?null:i)}><span><Ticket/>{text(row['shortNumber']??row['number'])}</span><span>{date(row['timestampIn'])} | {text(row['type'])}<br/>{text(row['type']).toLowerCase().includes('soccer')?'Virtual Soccer':text(row['type'])}</span><span>Stake<strong>{money(row['amountIn'])}</strong></span><span>Real Win<strong>{money(row['amountOut'])}</strong></span><span>Total Odds<strong>{text(row['totalOdds'])}</strong></span><span>{text(row['status'])}</span></Button>{expanded===i && <div className="fb-ticket-detail">{text(row['number'])} · {text(row['itemsCount'])} selections · {text(row['status'])}</div>}</section>)}</div> : <div className="fb-table-scroll"><table className="fb-transactions"><thead><tr>{['Date','Type','Value','Balance','Detail','Description'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}><td>{date(row['timestamp']??row['date'])}</td><td>{text(row['type'])}</td><td>{points?text(row['amount']??row['value']):money(row['amount']??row['value'])}</td><td>{points?text(row['balance']):money(row['balance'])}</td><td>{text(row['detail'])}</td><td>{text(row['description'])}</td></tr>)}</tbody></table></div>}
  </>;
}
