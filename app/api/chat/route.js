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
      "mdFee": 225,
      "hasRehearsal": false,
      "rehearsalHours": "",
      "rehearsalFee": 0
    }
  ],
  "recipientName": "Ben",
  "pdDays": 1,
  "transportType": "interstate_provided",
  "reimbursementItems": "Ubers or parking",
  "hasAccommodation": true
}
</rate_card_data>

ITINERARY LINE ITEMS: every day is its own entry in "shows". Travel days are entries with "activity": "Travel Day" and "performanceFee": ${POLICY.travelDay}; off days are "activity": "Off Day" with "performanceFee": 0. NEVER use hasTravelDay/travelDays fields or any rolled-up travel line - each travel day is itemised individually. A rehearsal on a show day goes on that show's entry via "hasRehearsal": true, "rehearsalHours" (display only, e.g. "2") and "rehearsalFee" (flat dollars, set per booking, not from policy). Superannuation applies to performance and rehearsal fees only - never to Travel Day or Off Day fees.

CRITICAL - THE BLOCK IS THE ONLY THING THAT UPDATES THE FORM. Your words do nothing on their own: the app parses ONLY the <rate_card_data> block. Any time you are setting up, changing, confirming or "fixing" the card in ANY way - even a one-field tweak - you MUST include the complete <rate_card_data> block in that same message. Never say you have made, applied or fixed a change without the block in the SAME message. The block must always be the ENTIRE card (all shows and all fields), not just the changed parts, because it fully replaces the form. Only skip the block when you are purely answering a question or asking a clarifying question and deliberately changing nothing.

Always include a friendly conversational message before or after the JSON explaining what you've set up and asking if anything needs adjusting. If the user's message is ambiguous, ask clarifying questions rather than guessing.

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

// Pull the rate card JSON out of the model's reply, tolerating the common
// slip-ups: proper <rate_card_data> tags, a ```json code fence, or a bare JSON
// object containing "shows". Whichever form matched is stripped from the
// display text so raw JSON never shows in the chat.
function extractRateCard(text) {
  // 1. The requested format.
  const tagged = text.match(/<rate_card_data>([\s\S]*?)<\/rate_card_data>/);
  if (tagged) {
    try {
      return {
        rateCardData: JSON.parse(tagged[1].trim()),
        displayText: text.replace(/<rate_card_data>[\s\S]*?<\/rate_card_data>/g, "").trim(),
      };
    } catch (e) { console.error("Failed to parse tagged rate card data:", e); }
  }

  // 2. A fenced code block that looks like the card.
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenced && fenced[1].includes('"shows"')) {
    try {
      return {
        rateCardData: JSON.parse(fenced[1]),
        displayText: text.replace(fenced[0], "").trim(),
      };
    } catch (e) { console.error("Failed to parse fenced rate card data:", e); }
  }

  // 3. A bare JSON object containing "shows" - find it by brace balancing.
  const start = text.indexOf("{");
  if (start !== -1 && text.includes('"shows"')) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          if (candidate.includes('"shows"')) {
            try {
              return {
                rateCardData: JSON.parse(candidate),
                displayText: (text.slice(0, start) + text.slice(i + 1)).trim(),
              };
            } catch (e) { /* not valid JSON - give up on this path */ }
          }
          break;
        }
      }
    }
  }

  // Nothing parseable - remove any dangling opening tag (truncation) for display.
  return { rateCardData: null, displayText: text.replace(/<rate_card_data>[\s\S]*$/, "").trim() };
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
      max_tokens: 4096,
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

    const { rateCardData, displayText } = extractRateCard(text);

    // If the reply was cut off before the JSON completed, the form was NOT
    // updated - say so instead of failing silently.
    let finalText = displayText;
    if (!rateCardData && response.stop_reason === "max_tokens") {
      finalText = (displayText + "\n\n(That reply was cut short, so the form was NOT updated. Please ask me to send the card again.)").trim();
    }

    return NextResponse.json({ text: finalText, rateCardData });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Chat failed: " + error.message }, { status: 500 });
  }
}
