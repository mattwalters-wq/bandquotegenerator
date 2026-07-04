import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { POLICY, TRAVEL_DAY_RULE_TEXT } from "@/lib/policy";

// Rates AND the travel-day rule are injected from lib/policy.js (the single
// source of truth) - nothing is duplicated or hand-edited here.
const SYSTEM_PROMPT = `You are an AI assistant that helps create band rate cards for Emma Donovan's shows. You work for Matt, Emma's artist manager. These rate cards price the BAND Emma hires. Emma's own performance fee of $${POLICY.emmaFee} per show is handled separately in the P&L and is never part of a band rate card.

KEY RATES (single source of truth - do not invent or alter):
- Local engagements (Melbourne metro / VIC): $${POLICY.showFee.vic} per show per band member
- Interstate and regional engagements: $${POLICY.showFee.interstate} per show per band member
- Per diem (living allowance): $${POLICY.perDiem} per band member, paid for overnight stays only
- Music Director fee: $${POLICY.mdFee.halfDay} (half day) or $${POLICY.mdFee.fullDay} (full day) or custom
- Rehearsal fee: $${POLICY.rehearsal.halfDay} (half day) or $${POLICY.rehearsal.fullDay} (full day)
- Superannuation: ${Math.round(POLICY.superRate * 100)}% applied to performance and rehearsal fees only
- Transport reimbursement: up to $${POLICY.transportCap} per band member for fuel/Ubers/parking (receipts, pre-agreed)
- GST: applied per band member only if that member is GST registered (default off)

TRAVEL DAYS (calculated per player from their own home base, never per band):
${TRAVEL_DAY_RULE_TEXT}

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

UPLOADED RATE CARDS: the user may attach an existing rate card (usually a PDF, sometimes an image or text). Read it carefully, extract EVERY detail (shows, dates, locations, slots, formats, fees, MD fees, rehearsal, travel days, per diems, transport, recipient) into rate_card_data, then apply whatever tweaks they ask for (extra hours, changed fees, added or removed shows). If a rate on the old card differs from the current policy rates above, use the requested/old value but point out the difference in your message. Always return the full rate_card_data block so the form is completely pre-filled.

Remember: never use em dashes. Use hyphens or restructure sentences instead.`;

// Map a stored chat message (which may carry an attachment) to Anthropic
// content blocks. PDFs go through as native document blocks, images as image
// blocks, text files inline as text.
function toContent(m) {
  const a = m.attachment;
  if (!a) return m.content;
  const blocks = [];
  if (a.kind === "pdf" && a.data) {
    blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data } });
  } else if (a.kind === "image" && a.data) {
    blocks.push({ type: "image", source: { type: "base64", media_type: a.media_type || "image/png", data: a.data } });
  } else if (a.kind === "text" && a.text) {
    blocks.push({ type: "text", text: "Uploaded file " + (a.name || "attachment") + ":\n\n" + a.text });
  }
  blocks.push({ type: "text", text: m.content || "Here is an existing rate card - please read it and set up the form." });
  return blocks;
}

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const { messages } = await request.json();

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role,
        content: toContent(m),
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
