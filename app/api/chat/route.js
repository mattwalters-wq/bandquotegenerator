import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are an AI assistant that helps create band rate cards for Emma Donovan's shows. You work for Matt, Emma's artist manager.

KEY RATES:
- Local engagements (VIC): $450 per show
- Interstate engagements: $550 per show
- Travel days (non-performance day with travel): 50% of show fee
- Per diems: $89 per day
- Music Director fee: $225 (half day) or $450 (full day) or custom
- Rehearsal fee: $225 (half day) or $550 (full day)
- Superannuation: 12% of show fee
- Transport reimbursement: up to $80 for fuel/Ubers/parking

COMMON BAND MEMBERS: Ben Edgar (guitar, often MD), Dave Symes (bass), Danny Farrugia (drums), Yanya Boston (drums), Mick Meagher (bass), Clio (keys), Georgia (BV), Eilla (BV), Tweedie (guitar), Ruben (bass), Felix Bloxsom (drums), Victor (guitar), Adam V (bass).

FORMATS: Duo, Emma + 3, Full Band, Em Solo, Emma + 2

When the user describes shows or uploads file content, extract the relevant details and respond with a JSON block that the app can use to pre-fill the rate card form. Format your JSON inside <rate_card_data> tags like this:

<rate_card_data>
{
  "shows": [
    {
      "engagement": "Show Name",
      "location": "City, State",
      "performanceDate": "Month Day, Year",
      "slot": "Evening",
      "repertoire": "",
      "format": "Emma + 3",
      "activity": "Performance",
      "feeType": "interstate",
      "performanceFee": 550,
      "hasMdFee": false,
      "mdFee": 225
    }
  ],
  "recipientName": "Ben",
  "hasTravelDay": false,
  "travelDays": 1,
  "pdDays": 1,
  "transportType": "interstate_provided",
  "reimbursementItems": "Ubers or parking",
  "hasAccommodation": true
}
</rate_card_data>

Always include a friendly conversational message before or after the JSON explaining what you've set up and asking if anything needs adjusting. If the user's message is ambiguous, ask clarifying questions rather than guessing. If they're just chatting or asking questions, respond normally without JSON.

Remember: never use em dashes. Use hyphens or restructure sentences instead.`;

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const { messages } = await request.json();

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    // Extract rate card data if present
    let rateCardData = null;
    const match = text.match(/<rate_card_data>([\s\S]*?)<\/rate_card_data>/);
    if (match) {
      try {
        rateCardData = JSON.parse(match[1].trim());
      } catch (e) {
        console.error("Failed to parse rate card data:", e);
      }
    }

    // Clean the display text (remove the JSON tags)
    const displayText = text.replace(/<rate_card_data>[\s\S]*?<\/rate_card_data>/, "").trim();

    return NextResponse.json({ text: displayText, rateCardData });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Chat failed: " + error.message }, { status: 500 });
  }
}
