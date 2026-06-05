import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { validateTravelEstimate } from "@/lib/itinerary";

// Door-to-door estimate fallback for destinations the static table in
// lib/travelData.js cannot resolve. Returns STRICT, validated JSON only - free
// text never reaches the calculation. Results are cached in Supabase keyed by
// origin + destination + show time.

const SYSTEM = `You estimate domestic Australian band travel logistics. Given an origin city, a destination and a show time, reply with ONLY a JSON object, no prose, no markdown, in exactly this shape:
{"canTravelSameDayIn": boolean, "canTravelSameDayOut": boolean, "estimatedDoorToDoorHours": number, "assumptions": string[]}
Rules:
- estimatedDoorToDoorHours is the realistic total home-to-venue time including airport overhead (about 2.5h total for a flight) and any drive at the far end.
- canTravelSameDayIn is true only if a morning departure arrives at least 2 hours before a mid-afternoon soundcheck.
- canTravelSameDayOut is true only if the show ends by ~10:30pm and the return trip is under 3 hours.
- assumptions: short strings describing what you assumed. Keep to 4 or fewer.
Reply with the JSON object and nothing else.`;

export async function POST(request) {
  try {
    const { origin, destination, showTime } = await request.json();
    if (!origin || !destination) {
      return NextResponse.json({ error: "origin and destination are required" }, { status: 400 });
    }
    const cacheKey = [origin, destination, showTime || ""].join("|").toLowerCase();

    // Cache hit?
    if (supabase) {
      try {
        const { data } = await supabase.from("travel_estimates").select("estimate").eq("cache_key", cacheKey).single();
        if (data?.estimate) {
          const v = validateTravelEstimate(data.estimate);
          if (v.valid) return NextResponse.json({ estimate: v.value, cached: true });
        }
      } catch (e) { /* miss - fall through */ }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `Origin: ${origin}\nDestination: ${destination}\nShow time: ${showTime || "evening (soundcheck ~3:00pm)"}`,
      }],
    });

    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    // Pull the first JSON object out, then validate strictly.
    const match = text.match(/\{[\s\S]*\}/);
    const validated = validateTravelEstimate(match ? match[0] : text);
    if (!validated.valid) {
      return NextResponse.json({ error: "Could not produce a valid estimate", details: validated.errors }, { status: 422 });
    }

    if (supabase) {
      try {
        await supabase.from("travel_estimates").upsert({
          cache_key: cacheKey, origin, destination, show_time: showTime || null, estimate: validated.value,
        });
      } catch (e) { /* non-fatal */ }
    }

    return NextResponse.json({ estimate: validated.value, cached: false });
  } catch (error) {
    console.error("travel-estimate error:", error);
    return NextResponse.json({ error: "Estimate failed: " + error.message }, { status: 500 });
  }
}
