import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { ChevronLeft, ChevronRight, Ticket } from 'lucide-react';
import { Button } from './ui/button';
import { TicketDetailModal } from './ticket-check';
import { getAccountRecords, getAccountMessage, type FortebetClientRecord } from '@/lib/account.functions';
import { checkTicket, type TicketDTO } from '@/lib/fortebet.functions';
import { accountPageTitle, accountText as text, recordObject, recordRows } from '@/lib/account-pages';

const money = (value: unknown) => value == null ? '—' : Number(value).toLocaleString('en-UG') + ' UGX';
const stamp = (value: unknown) => { const d = new Date(text(value)); return Number.isNaN(d.valueOf()) ? text(value) : d.toLocaleString('en-UG'); };

export function AccountRecords({path}: {path: string}) {
  const loadRecords = useServerFn(getAccountRecords);
  const loadMessage = useServerFn(getAccountMessage);
  const loadTicket = useServerFn(checkTicket);
  const tickets = path.startsWith('bets');
  const messages = path === 'messages';
  const points = path.endsWith('/pts');
  const [filters, setFilters] = useState(['All']);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [record, setRecord] = useState<FortebetClientRecord>();
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, FortebetClientRecord>>({});
  const [detailLoading, setDetailLoading] = useState<number | null>(null);
  const [ticket, setTicket] = useState<TicketDTO | null>(null);
  const [detailError, setDetailError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setExpanded(null); setDetailError('');
    void loadRecords({data:{path: path === 'bets' ? 'bets/all' : path,filters,from,to,page}})
      .then(result => {if(active) setRecord(result);})
      .catch(() => {if(active) setRecord({ok:false,message:'Unable to load your account records. Please try again.'});})
      .finally(() => {if(active) setLoading(false);});
    return () => {active = false;};
  }, [path,filters,from,to,page,version,loadRecords]);
  const allRows = recordRows(record);
  const rows = allRows.slice(0,30).filter(row=>!messages || !Array.isArray(row['behavior']) || row['behavior'].includes('MESSAGE'));
  const options = messages ? [] : tickets ? ['All','Win','Cashout','Placed','Lost','Void','Canceled'] : points ? ['All','VIP PTS winnings','VIP PTS losses','Transfers'] : ['All','Deposits','Withdrawals','Money winnings','Money losses'];
  async function openMessage(id: number) {
    if (expanded === id) {setExpanded(null); return;}
    setExpanded(id);
    if (details[id]?.ok) return;
    setDetailLoading(id);
    try {const result = await loadMessage({data:{messageId:id}}); setDetails(current=>({...current,[id]:result}));}
    catch {setDetails(current=>({...current,[id]:{ok:false,message:'Unable to read this message. Please try again.'}}));}
    finally {setDetailLoading(null);}
  }
  async function openTicket(number: string, index: number, type: string) {
    setDetailError(''); setDetailLoading(index);
    try {const category = type.startsWith('VSOCCER') ? 'VSOCCER' : type.startsWith('KENO') ? 'KENO' : ''; const result = await loadTicket({data:{number,...(category ? {type:category} : {})}}); if(result.ok) setTicket(result.ticket); else setDetailError(result.error === 'NOT_FOUND' ? 'Fortebet could not return details for this ticket.' : 'Unable to load this ticket. Please try again.');}
    catch {setDetailError('Unable to load this ticket. Please try again.');}
    finally {setDetailLoading(null);}
  }
  return <>
    <h2 className="fb-account-heading">{messages ? 'MY MESSAGES' : accountPageTitle(path).toUpperCase()}</h2>
    <div className="fb-record-filters">
      {options.map(option=><label key={option}><input type="checkbox" checked={filters.includes(option)} onChange={()=>{setPage(0);setFilters(current=>{const next = option === 'All' ? ['All'] : current.includes(option) ? current.filter(f=>f!==option) : [...current.filter(f=>f!=='All'),option];return next.length ? next : ['All'];});}}/>{option}</label>)}
      {!messages && <><input aria-label="From" type="date" value={from} onChange={e=>{setPage(0);setFrom(e.target.value);}}/><input aria-label="To" type="date" value={to} min={from || undefined} onChange={e=>{setPage(0);setTo(e.target.value);}}/></>}
      <Button className="fb-account-action" onClick={()=>setVersion(n=>n+1)} disabled={loading}>REFRESH</Button>
    </div>
    {loading && <p role="status" className="fb-record-error">Loading…</p>}
    {record && !record.ok && <p role="alert" className="fb-record-error">{record.message}</p>}
    {detailError && <p role="alert" className="fb-record-error">{detailError}</p>}
    {!loading && record?.ok && rows.length === 0 && <p role="status" className="fb-record-error">No records found.</p>}
    {messages ? <div className="fb-messages"><div className="fb-message-header"><span>Date</span><span>Subject</span></div>{rows.map((row,i)=>{
      const id = Number(row['messageId']); const detail = details[id];
      return <section key={id || i}><Button variant="ghost" className="fb-message-title" aria-expanded={expanded===id} onClick={()=>void openMessage(id)}><span>{stamp(row['timestamp'])}</span><strong>{text(row['title'])}</strong></Button>{expanded===id && <div className="fb-message-content">{detailLoading===id ? <p role="status">Loading message…</p> : detail?.ok ? <MessageBody html={text(recordObject(detail.data)['html'])}/> : detail && <p role="alert">{detail.message}</p>}</div>}</section>;
    })}</div> : tickets ? <div className="fb-ticket-list">{rows.map((row,i)=><section key={text(row['number']) || i}><Button variant="ghost" className="fb-ticket-row" disabled={detailLoading===i} onClick={()=>void openTicket(text(row['number']),i,text(row['type']))}><span><Ticket/>{text(row['shortNumber']??row['number'])}</span><span>{stamp(row['timestampIn'])} | {text(row['type'])}<br/>{text(row['itemsCount'])} selections</span><span>Stake<strong>{money(row['amountIn'])}</strong></span><span>Real Win<strong>{money(row['amountOut'])}</strong></span><span>Total Odds<strong>{text(row['totalOdds'])}</strong></span><span>{detailLoading===i ? '…' : text(row['status'])}</span></Button></section>)}</div> : <div className="fb-table-scroll"><table className="fb-transactions"><thead><tr>{['Date','Type','Value','Balance','Detail','Description'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}><td>{stamp(row['timestamp']??row['date'])}</td><td>{text(row['type'])}</td><td>{points ? text(row['amount']??row['value']) : money(row['amount']??row['value'])}</td><td>{points ? text(row['balance']) : money(row['balance'])}</td><td>{text(row['detail'])}</td><td>{text(row['description'])}</td></tr>)}</tbody></table></div>}
    <div className="fb-record-filters fb-record-paging"><Button variant="ghost" size="icon" aria-label="Previous page" title="Previous page" disabled={loading || page===0} onClick={()=>setPage(n=>n-1)}><ChevronLeft/></Button><span>Page {page+1}</span><Button variant="ghost" size="icon" aria-label="Next page" title="Next page" disabled={loading || !record?.ok || allRows.length<=30} onClick={()=>setPage(n=>n+1)}><ChevronRight/></Button></div>
    {ticket && <TicketDetailModal ticket={ticket} onClose={()=>setTicket(null)}/>}
  </>;
}

function MessageBody({html}: {html: string}) {
  const [content, setContent] = useState('');
  useEffect(()=>{
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,form').forEach(node=>node.remove());
    setContent(doc.body.textContent ?? '');
  },[html]);
  return <p className="fb-message-text">{content || 'No message content.'}</p>;
}