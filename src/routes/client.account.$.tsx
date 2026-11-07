import { createFileRoute } from '@tanstack/react-router';
import { AccountPages } from '@/components/account-pages';
import { accountPageTitle } from '@/lib/account-pages';
export const Route = createFileRoute('/client/account/$')({
  head: ({params}) => { const title = accountPageTitle(params._splat ?? 'profile') + ' | Fortebet Uganda'; const description = 'Your signed-in Fortebet Uganda ' + accountPageTitle(params._splat ?? 'profile').toLowerCase() + '.'; return {meta:[{title},{name:'description',content:description},{property:'og:title',content:title},{property:'og:description',content:description},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}; },
  component: AccountRoute,
});
function AccountRoute() { const {_splat} = Route.useParams(); return <AccountPages path={_splat ?? 'profile'}/>; }
