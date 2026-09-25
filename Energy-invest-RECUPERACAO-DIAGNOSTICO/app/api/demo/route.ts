import { NextResponse } from "next/server";
import { isDemo } from "@/lib/demo";
export async function POST(request: Request) {
  if (!isDemo()) return new Response(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host"))
    return new Response(null, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("energy_demo", crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: new URL(request.url).protocol === "https:",
    maxAge: 86400,
  });
  return response;
}
