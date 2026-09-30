import { NextRequest, NextResponse } from "next/server";

/**
 * Password gate for the private waitlist signups view (/waitlist/list).
 *
 * The password lives in WAITLIST_LIST_PASSWORD (set in Vercel env + locally
 * in .env.local). It is never linked from the public site.
 *
 * Flow: visit /waitlist/list?key=<password> once; a scoped httpOnly cookie is
 * set and you are redirected to the clean URL. Wrong or missing password gets
 * a branded prompt.
 */

const COOKIE_NAME = "obiren_list_access";

function promptHtml(hasAttempt: boolean, configured: boolean) {
  const message = !configured
    ? "This view is not configured. Set WAITLIST_LIST_PASSWORD to enable access."
    : hasAttempt
      ? "That password is not right. Try again."
      : "Private view. Enter the access password to continue.";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Obiren | Private view</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0E0A16;color:#F5F3FA;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
  .card{width:min(380px,90vw);text-align:center;padding:40px 32px;border-radius:24px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1)}
  .heart{font-size:34px;line-height:1;margin-bottom:18px}
  h1{font-size:18px;font-weight:800;margin:0 0 6px;letter-spacing:-.01em}
  p{font-size:13px;color:rgba(245,243,250,.55);margin:0 0 24px}
  form{display:flex;gap:8px}
  input{flex:1;min-width:0;padding:11px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#F5F3FA;font-size:14px;outline:none}
  input:focus{border-color:#9B6BFF}
  button{padding:11px 20px;border-radius:999px;border:none;background:linear-gradient(135deg,#6D4AFF,#9B6BFF);color:#fff;font-weight:700;font-size:14px;cursor:pointer}
  .err{color:#FF8FA3}
</style>
</head>
<body>
  <div class="card">
    <div class="heart" aria-hidden="true">&#129294;</div>
    <h1>Obiren</h1>
    <p class="${hasAttempt ? "err" : ""}">${message}</p>
    <form method="get" action="/waitlist/list">
      <input type="password" name="key" placeholder="Access password" autofocus autocomplete="off" required>
      <button type="submit">Enter</button>
    </form>
  </div>
</body>
</html>`;
}

export function middleware(req: NextRequest) {
  const configured = !!process.env.WAITLIST_LIST_PASSWORD;

  // Correct key in the URL: set the cookie and bounce to the clean URL.
  const key = req.nextUrl.searchParams.get("key");
  if (configured && key && key === process.env.WAITLIST_LIST_PASSWORD) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("key");
    const res = NextResponse.redirect(url);
    res.cookies.set(COOKIE_NAME, key, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  }

  // Already unlocked via cookie.
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (configured && cookie && cookie === process.env.WAITLIST_LIST_PASSWORD) {
    return NextResponse.next();
  }

  return new NextResponse(promptHtml(!!key, configured), {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export const config = {
  matcher: ["/waitlist/list"],
};
