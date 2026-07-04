import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const base = new URL(req.url).origin;
  const res = NextResponse.redirect(`${base}/`);
  res.cookies.delete("kick_token");
  res.cookies.delete("kick_refresh");
  res.cookies.delete("kick_user");
  return res;
}
