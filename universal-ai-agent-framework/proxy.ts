import { NextRequest, NextResponse } from "next/server"

// Disabled by default — the whole app (pages + API) is open, which is fine for a demo.
// Set BASIC_AUTH_PASSWORD (in .env.local or your Vercel project's env vars) to require
// a username/password before anything loads. No frontend changes needed either way —
// browsers show a native login prompt, and API callers just add an Authorization header.
export function proxy(req: NextRequest) {
  const password = process.env.BASIC_AUTH_PASSWORD
  if (!password) return NextResponse.next()

  const expected = "Basic " + Buffer.from(`admin:${password}`).toString("base64")
  if (req.headers.get("authorization") === expected) return NextResponse.next()

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Restricted"' },
  })
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
}
