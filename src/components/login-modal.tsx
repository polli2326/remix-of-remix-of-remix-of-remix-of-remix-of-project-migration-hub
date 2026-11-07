import { useEffect, useMemo, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Eye, EyeOff, LogIn, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closeLogin, openLogin, openRegister, openForgot, useLoginOpen, validateLogin, type AccountWindow } from "@/lib/login-modal";
import {
  getRegistrationCountries,
  getRegistrationGuide,
  loginWithFortebet,
  registerWithFortebet,
  type RegistrationCountry,
} from "@/lib/account.functions";
import { setAccountSession } from "@/lib/account-state";

const field = "box-border h-9 w-full min-w-0 rounded border border-account-line bg-account-field px-2 text-sm text-account-ink outline-none placeholder:text-site-import-muted-foreground focus:border-brand-500";
const action = "account-action h-9 w-full rounded bg-brand-500 text-account-ink font-bold hover:bg-brand-700";
const subtle = "account-secondary border border-account-line bg-account-surface text-account-ink hover:bg-account-field";

export function LoginModal() {
  const mode = useLoginOpen();
  return <Dialog.Root open={mode !== null} onOpenChange={(value) => { if (!value) closeLogin(); }}>
    {mode && <AccountForm key={mode} mode={mode} />}
  </Dialog.Root>;
}

function AccountForm({ mode }: { mode: AccountWindow }) {
  const [show, setShow] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [countries, setCountries] = useState<RegistrationCountry[]>([]);
  const [countryError, setCountryError] = useState("");
  const [guideMarkup, setGuideMarkup] = useState("");
  const [guideMessage, setGuideMessage] = useState("");
  const [resourcesLoading, setResourcesLoading] = useState(mode === "register");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const register = mode === "register";
  const title = register ? "New registration" : mode === "forgot" ? "Lost password?" : "Login";
  const safeGuideMarkup = useMemo(() => sanitizeCmsHtml(guideMarkup), [guideMarkup]);

  useEffect(() => {
    if (!register) return;
    let active = true;
    setResourcesLoading(true);
    void Promise.all([getRegistrationCountries(), getRegistrationGuide()])
      .then(([countryResult, guideResult]) => {
        if (!active) return;
        if (countryResult.ok) setCountries(countryResult.countries);
        else setCountryError(countryResult.message);
        if (guideResult.ok) setGuideMarkup(guideResult.html);
        else setGuideMessage(guideResult.message);
      })
      .catch(() => {
        if (active) setCountryError("Registration details could not be loaded. Try again later.");
      })
      .finally(() => {
        if (active) setResourcesLoading(false);
      });
    return () => { active = false; };
  }, [register]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    if (!e.currentTarget.reportValidity()) return;

    if (mode === "login") {
      const found = validateLogin(username, password);
      setErrors(found);
      if (Object.keys(found).length) return;
      setSubmitting(true);
      try {
        const result = await loginWithFortebet({ data: { nickname: username, password } });
        if (!result.ok) {
          setFormError(result.message);
          return;
        }
        if (result.account) setAccountSession(result.account);
        setSuccessMessage(result.message);
        setUsername("");
        setPassword("");
        setShow(false);
      } catch {
        setFormError("Unable to reach the account service. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === "register") {
      if (resourcesLoading || countryError || countries.length === 0) {
        setFormError(countryError || "Wait for the registration details to load.");
        return;
      }
      const values = new FormData(e.currentTarget);
      const read = (key: string) => String(values.get(key) ?? "");
      const birthdate = [
        read("birth-year"),
        read("birth-month").padStart(2, "0"),
        read("birth-day").padStart(2, "0"),
      ].join("-");
      setSubmitting(true);
      try {
        const result = await registerWithFortebet({
          data: {
            firstName: read("first-name"),
            lastName: read("last-name"),
            nickname: read("nickname"),
            phone: read("phone"),
            email: read("email"),
            birthdate,
            nationality: read("nationality"),
            recordNumber: read("record-number"),
            promo: read("promo"),
            termsAccepted: values.get("terms") === "on",
          },
        });
        if (!result.ok) {
          setFormError(result.message);
          return;
        }
        setSuccessMessage(result.message);
      } catch {
        setFormError("Unable to reach the account service. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setFormError("Password recovery is not connected here. Use Fortebet’s official recovery flow.");
  }

  return <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-[1000] bg-account-overlay" />
    <Dialog.Content className={`account-dialog fixed left-1/2 top-1/2 z-[1001] max-h-[92dvh] w-[calc(100%-24px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md bg-account-surface text-account-ink shadow-account outline-none ${register ? "max-w-[1100px]" : "max-w-[340px]"}`}>
      <header className={`relative flex h-12 items-center gap-2 px-4 ${register ? "bg-account-field" : "bg-brand-600"}`}>
        {register && <UserRound size={18} />}
        <Dialog.Title className={`text-sm font-black uppercase ${register ? "" : "w-full text-center"}`}>{title}</Dialog.Title>
        <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close account window" className="absolute right-1 top-1.5 text-account-ink hover:bg-account-field"><X /></Button></Dialog.Close>
      </header>
      <Dialog.Description className="border-b border-account-line px-4 py-2 text-center text-xs text-site-import-muted-foreground">
        {mode === "forgot" ? "Password recovery is not connected." : "Login and registration use Fortebet’s account service."}
      </Dialog.Description>
      {successMessage ? <div className="space-y-4 p-6 text-center">
        <p role="status" className="text-sm">{successMessage}</p>
        {register
          ? <Button className={action} onClick={openLogin}>Login now</Button>
          : <Button className={action} onClick={closeLogin}>Continue</Button>}
      </div> : <form onSubmit={submit} noValidate className={register ? "grid gap-7 p-5 md:grid-cols-2" : "space-y-3 px-8 py-7"}>
        {register ? <>
          <div className="space-y-3">
            <RegistrationField name="first-name" label="Name" placeholder="Enter your FIRST NAME" required />
            <RegistrationField name="last-name" label="Surname" placeholder="Enter your LAST NAME" required />
            <RegistrationField name="nickname" label="Username" placeholder="Enter your USERNAME" required />
            <div className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-2"><label htmlFor="register-phone" className="text-xs">Mobile/GSM</label><div className="flex min-w-0 gap-2"><span className="flex h-9 items-center rounded border border-brand-500 bg-brand-500/10 px-2 text-xs">+256</span><input id="register-phone" name="phone" aria-label="Mobile/GSM" className={field} placeholder="Enter your PHONE NUMBER" inputMode="tel" autoComplete="tel-national" pattern="[0-9]{9}" minLength={9} maxLength={9} required /></div></div>
            <div className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-2"><label htmlFor="register-email" className="text-xs">E-mail</label><input id="register-email" name="email" className={field} type="email" autoComplete="email" placeholder="for example name@gmail.com" /></div>
            <div className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-2"><span className="text-xs">Birth date</span><div className="grid min-w-0 grid-cols-[1fr_1.7fr_1.2fr] gap-2">
              <select name="birth-day" aria-label="Birth day" className={field} required defaultValue=""><option value="">Day</option>{Array.from({length:31},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select>
              <select name="birth-month" aria-label="Birth month" className={field} required defaultValue=""><option value="">Month</option>{["January","February","March","April","May","June","July","August","September","October","November","December"].map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select>
              <select name="birth-year" aria-label="Birth year" className={field} required defaultValue=""><option value="">Year</option>{Array.from({length:93},(_,i)=>new Date().getUTCFullYear()-18-i).map(year=><option key={year} value={year}>{year}</option>)}</select>
            </div></div>
            <div className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-2"><label htmlFor="register-country" className="text-xs">Nationality</label><select id="register-country" name="nationality" className={field} defaultValue="UG" disabled={resourcesLoading || countries.length === 0} required>{countries.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
            <RegistrationField name="record-number" label="NIN number" placeholder="Enter your NIN" required />
            <RegistrationField name="promo" label="Promo" placeholder="Enter your PROMO code" />
            {countryError && <p role="alert" className="text-xs text-destructive md:pl-[90px]">{countryError}</p>}
            <label className="flex items-start gap-2 pl-0 text-xs leading-5 md:pl-[90px]"><input name="terms" type="checkbox" required className="mt-1 accent-brand-500" /> <span>I have read and accepted the general Terms and Conditions and I confirm that I am older than 18 years</span></label>
            {formError && <p role="alert" className="text-xs text-destructive md:pl-[90px]">{formError}</p>}
            <div className="md:pl-[90px]"><Button type="submit" disabled={submitting || resourcesLoading || Boolean(countryError) || countries.length === 0} className={action}>{submitting ? "Submitting…" : resourcesLoading ? "Loading…" : "Confirm registration"}</Button></div>
            <div className="text-center text-xs">Already registered? <Button variant="link" type="button" onClick={openLogin} className="account-link h-auto p-1 text-brand-500">Login</Button></div>
          </div>
          <aside aria-label="How to register" className="space-y-3 border-t border-account-line pt-4 text-xs leading-5 md:border-t-0 md:pt-0">
            <h3 className="font-bold uppercase">How to register</h3>
            {resourcesLoading && <p className="text-site-import-muted-foreground">Loading registration guide…</p>}
            {guideMessage && <p role="status" className="text-site-import-muted-foreground">{guideMessage}</p>}
            {safeGuideMarkup && <div className="registration-guide text-site-import-muted-foreground" dangerouslySetInnerHTML={{ __html: safeGuideMarkup }} />}
          </aside>
        </> : <>
          <input aria-label="Username" className={`${field} text-center`} value={username} onChange={e=>setUsername(e.target.value)} placeholder="USERNAME" autoComplete="off" aria-invalid={Boolean(errors.username)} />
          {errors.username && <p role="alert" className="text-xs text-destructive">{errors.username}</p>}
          {mode === "login" && <><div className="relative"><input aria-label="Password" type={show ? "text" : "password"} className={`${field} pr-10 text-center`} value={password} onChange={e=>setPassword(e.target.value)} placeholder="PASSWORD" autoComplete="current-password" aria-invalid={Boolean(errors.password)} />
            {errors.password && <p role="alert" className="text-xs text-destructive">{errors.password}</p>}
            <Button type="button" variant="ghost" size="icon" title={show ? "Hide password" : "Show password"} aria-label={show ? "Hide password" : "Show password"} onClick={()=>setShow(!show)} className="absolute right-0 top-0 text-site-import-muted-foreground hover:bg-transparent">{show ? <EyeOff /> : <Eye />}</Button></div>
          <div className="flex justify-end"><Button type="button" variant="outline" size="sm" className={subtle} onClick={openForgot}>Lost Password?</Button></div></>}
          {formError && <p role="alert" className="text-xs text-destructive">{formError}</p>}
          <Button type="submit" disabled={submitting} className={action}>{mode === "login" && <LogIn />}{submitting ? "Please wait…" : mode === "login" ? "Login" : "Recover password"}</Button>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs"><span>{mode === "login" ? "Not registered yet?" : "Remember your password?"}</span><Button type="button" variant="outline" size="sm" className={subtle} onClick={mode === "login" ? openRegister : openLogin}>{mode === "login" ? "Register now!" : "Login"}</Button></div>
        </>}
      </form>}
    </Dialog.Content>
  </Dialog.Portal>;
}

function RegistrationField({name, label, placeholder, required = false}: {name?:string; label:string; placeholder:string; required?:boolean}) {
  const id = `register-${label.toLowerCase().replaceAll(" ", "-")}`;
  return <div className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-2"><label htmlFor={id} className="text-xs">{label}</label><input id={id} name={name} className={field} placeholder={placeholder} required={required} autoComplete="off" /></div>;
}

function sanitizeCmsHtml(markup: string): string {
  if (typeof DOMParser === "undefined") return "";
  const document = new DOMParser().parseFromString(markup, "text/html");
  const allowed = new Set([
    "B", "BR", "DIV", "EM", "H3", "H4", "I", "LI", "OL", "P",
    "SPAN", "STRONG", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD",
    "TR", "U", "UL",
  ]);
  const blocked = new Set(["IFRAME", "OBJECT", "SCRIPT", "STYLE", "SVG", "TEMPLATE"]);
  const escapeText = (text: string) =>
    text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  function serialize(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const element = node as Element;
    if (blocked.has(element.tagName)) return "";
    const children = [...element.childNodes].map(serialize).join("");
    if (!allowed.has(element.tagName)) return children;
    const className = element.getAttribute("class");
    const classAttribute = className && /^[\w -]{1,120}$/.test(className)
      ? ` class="${className}"`
      : "";
    if (element.tagName === "BR") return "<br>";
    return `<${element.tagName.toLowerCase()}${classAttribute}>${children}</${element.tagName.toLowerCase()}>`;
  }

  return [...document.body.childNodes].map(serialize).join("");
}
