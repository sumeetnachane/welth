import { NextResponse } from "next/server";
import aj from "@/lib/arcjet";

export async function POST(req) {
  try {
    await aj.protect(req); // Rate limiting protection
    const data = await req.json();

    // Dummy response (replace with your DB logic)
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error.name === "ArcjetError") {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
