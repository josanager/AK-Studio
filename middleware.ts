import {NextRequest,NextResponse} from "next/server";

export function middleware(request:NextRequest){
  if(request.nextUrl.hostname==="www.akstudiovocal.com"){
    const url=request.nextUrl.clone();
    url.hostname="akstudiovocal.com";
    url.protocol="https:";
    url.port="";
    return NextResponse.redirect(url,308);
  }
  return NextResponse.next();
}

export const config={matcher:"/:path*"};
