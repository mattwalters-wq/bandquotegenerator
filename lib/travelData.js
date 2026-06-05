// Static door-to-door travel estimates used to infer a sensible itinerary per
// player. "Door to door" means home -> venue including airport overhead
// (~2.5h total across both ends of a flight) and any drive at the far end.
//
// Anything this table cannot resolve falls back to: (1) a user-supplied
// "drive hours from nearest airport" for regional towns, or (2) the Anthropic
// estimate route (see app/api/travel-estimate). Free text never enters the
// calculation - only validated numbers do.

// Canonical home/destination cities (capitals + Gold Coast).
export const CAPITALS = [
  "Melbourne", "Sydney", "Brisbane", "Adelaide", "Perth", "Canberra", "Hobart", "Darwin", "Gold Coast",
];

const ALIASES = {
  mel: "Melbourne", melbourne: "Melbourne", vic: "Melbourne",
  syd: "Sydney", sydney: "Sydney",
  bne: "Brisbane", brisbane: "Brisbane", bris: "Brisbane",
  adl: "Adelaide", adelaide: "Adelaide",
  per: "Perth", perth: "Perth",
  cbr: "Canberra", canberra: "Canberra",
  hba: "Hobart", hobart: "Hobart",
  drw: "Darwin", darwin: "Darwin",
  ool: "Gold Coast", "gold coast": "Gold Coast", goldcoast: "Gold Coast", "surfers paradise": "Gold Coast",
};

export function normalizeCity(name) {
  if (!name) return "";
  const key = String(name).trim().toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  const hit = CAPITALS.find((c) => c.toLowerCase() === key);
  return hit || "";
}

// Symmetric capital-to-capital door-to-door hours (flight + overhead + ground).
// Stored sparsely; missing pairs default to 5.0h.
const CAP_HOURS = {
  "Melbourne|Sydney": 4.5,
  "Melbourne|Brisbane": 5.0,
  "Melbourne|Adelaide": 4.5,
  "Melbourne|Perth": 7.5,
  "Melbourne|Canberra": 4.0,
  "Melbourne|Hobart": 4.0,
  "Melbourne|Darwin": 8.0,
  "Melbourne|Gold Coast": 5.5,
  "Sydney|Brisbane": 4.5,
  "Sydney|Adelaide": 5.0,
  "Sydney|Perth": 8.0,
  "Sydney|Canberra": 3.5,
  "Sydney|Hobart": 5.0,
  "Sydney|Darwin": 8.5,
  "Sydney|Gold Coast": 4.5,
  "Brisbane|Adelaide": 5.5,
  "Brisbane|Perth": 8.5,
  "Brisbane|Canberra": 5.0,
  "Brisbane|Gold Coast": 1.5, // short drive
  "Adelaide|Perth": 6.0,
  "Adelaide|Canberra": 5.0,
};

export function capitalHours(a, b) {
  const A = normalizeCity(a), B = normalizeCity(b);
  if (!A || !B) return null;
  if (A === B) return 0;
  return CAP_HOURS[A + "|" + B] ?? CAP_HOURS[B + "|" + A] ?? 5.0;
}

// Known regional destinations: reached via a gateway capital + a drive.
export const REGIONAL_DESTINATIONS = {
  bowraville: { label: "Bowraville", gateway: "Sydney", driveHoursFromGateway: 6.5 },
  "coffs harbour": { label: "Coffs Harbour", gateway: "Sydney", driveHoursFromGateway: 6.0 },
  "byron bay": { label: "Byron Bay", gateway: "Gold Coast", driveHoursFromGateway: 1.0 },
  bendigo: { label: "Bendigo", gateway: "Melbourne", driveHoursFromGateway: 2.0 },
  geelong: { label: "Geelong", gateway: "Melbourne", driveHoursFromGateway: 1.0 },
};

export function lookupRegional(name) {
  if (!name) return null;
  return REGIONAL_DESTINATIONS[String(name).trim().toLowerCase()] || null;
}

// Estimate door-to-door for a player from `origin` to `destination`.
//   regional: optional { gateway, driveHoursFromGateway } for an unknown
//             regional town (gateway capital + user-supplied drive hours).
// Returns { hours, mode, destLabel, resolved, gateway } or { resolved:false }.
export function estimateDoorToDoor({ origin, destination, regional }) {
  const o = normalizeCity(origin);
  const destCap = normalizeCity(destination);

  // Capital (or Gold Coast) destination.
  if (destCap) {
    if (!o) return { resolved: false };
    if (o === destCap) {
      return { hours: 0, mode: "local", destLabel: destCap, resolved: true, gateway: destCap };
    }
    return { hours: capitalHours(o, destCap), mode: "flight", destLabel: destCap, resolved: true, gateway: destCap };
  }

  // Regional destination: known table, else user-supplied gateway + drive hours.
  const known = lookupRegional(destination);
  const reg = known || (regional && regional.gateway
    ? { label: destination || "regional town", gateway: regional.gateway, driveHoursFromGateway: Number(regional.driveHoursFromGateway) || 0 }
    : null);
  if (!reg) return { resolved: false };

  const gateway = normalizeCity(reg.gateway);
  if (!o || !gateway) return { resolved: false };

  const flightPart = o === gateway ? 0 : capitalHours(o, gateway);
  const drive = Number(reg.driveHoursFromGateway) || 0;
  const hours = flightPart + drive;
  const mode = flightPart > 0 ? "flight" : (drive > 0 ? "drive" : "local");
  return { hours, mode, destLabel: reg.label, resolved: true, gateway };
}
