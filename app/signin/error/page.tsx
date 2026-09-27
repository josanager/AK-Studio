import Image from "next/image";
import {ArrowLeft,RotateCcw} from "lucide-react";

export const dynamic="force-dynamic";

export default async function SignInErrorPage({searchParams}:{searchParams:Promise<{error?:string}>}){
  const {error}=await searchParams;
  const expired=["state_mismatch","state_security_mismatch","state_not_found","state_invalid"].includes(error||"");
  const cancelled=error==="access_denied";
  const title=expired?"Let's try signing in again":cancelled?"Sign-in was cancelled":"We couldn't sign you in";
  const message=expired?"Your sign-in attempt expired or could not be verified. Start a new attempt in this tab.":cancelled?"You can try again whenever you're ready.":"Something interrupted your sign-in. Please try again.";
  return <main className="signin-page"><section className="signin-panel"><a className="signin-brand" href="/" aria-label="AK Studio home"><span><Image src="/logoak.svg" alt="" width={1080} height={1080}/></span><b>Studio</b></a><div className="signin-error-content"><h1>{title}</h1><p>{message}</p><a className="signin-retry" href="/signin"><RotateCcw aria-hidden="true"/>Try again</a><a className="signin-home" href="/"><ArrowLeft aria-hidden="true"/>Back to home</a></div></section></main>;
}
