export const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
export const LOCATIONS = ["PHX", "Dallas"];
export const SOURCES = ["Manheim Phoenix", "ADESA Dallas", "Copart", "IAAI", "OVE", "ACV Auctions", "Private Seller", "Trade-In", "CRM"];
export const ARB_SOURCES = ["Manheim","ACV","Openlane","Copart","ADESA","OVE","IAAI"];
export const COLORS = ["White", "Black", "Silver", "Gray", "Red", "Blue", "Green", "Brown", "Gold", "Orange", "Beige"];
export const FUEL_TYPES = ["gas", "diesel", "electric", "hybrid", "ethanol", "hydrogen", "petrol", "other"];
export const TRANSMISSION_TYPES = ["Automatic", "Manual", "CVT", "DCT", "Semi-Automatic", "Other"];

// Standard drive values matching the Auction app's expected long-form labels.
export const DRIVE_TYPES = [
  "Front Wheel Drive",
  "Four Wheel Drive",
  "All Wheel Drive",
  "Rear Wheel Drive",
];

// Converts any drive string (long-form or short code) to the Auction app's standard long-form value.
export function driveToLongForm(drive: string): string {
  const d = (drive || '').trim().toLowerCase();
  if (!d) return '';
  if (/\b(4x4|4wd|four.?wheel)\b/.test(d) || /\b4[- ]?wheel\b/.test(d)) return 'Four Wheel Drive';
  if (/\b(awd|all.?wheel)\b/.test(d)) return 'All Wheel Drive';
  if (/\b(fwd|front.?wheel)\b/.test(d)) return 'Front Wheel Drive';
  if (/\b(rwd|rear.?wheel)\b/.test(d)) return 'Rear Wheel Drive';
  return '';
}

// Converts any drive string to the standard short-code driveline (always uppercase).
export function driveToDriveline(drive: string): string {
  const d = (drive || '').trim().toLowerCase();
  if (!d) return '';
  if (/\b(4x4|4wd|four.?wheel)\b/.test(d) || /\b4[- ]?wheel\b/.test(d)) return '4WD';
  if (/\b(awd|all.?wheel)\b/.test(d)) return 'AWD';
  if (/\b(fwd|front.?wheel)\b/.test(d)) return 'FWD';
  if (/\b(rwd|rear.?wheel)\b/.test(d)) return 'RWD';
  if (/\b(2x4|2wd|two.?wheel)\b/.test(d)) return '2WD';
  return '';
}
export function fuelNormalize(fuel: string): string {
  const f = (fuel || '').trim().toLowerCase();
  if (!f) return '';
  if (/gasoline|gas\b/.test(f)) return 'gas';
  if (/diesel/.test(f)) return 'diesel';
  if (/electric/.test(f)) return 'electric';
  if (/hybrid/.test(f)) return 'hybrid';
  if (/ethanol|flex/.test(f)) return 'ethanol';
  if (/hydrogen/.test(f)) return 'hydrogen';
  if (/petrol/.test(f)) return 'petrol';
  return FUEL_TYPES.includes(f) ? f : '';
}
export const VCAT = [
  { key: "detail", label: "Detail", icon: "🧽" }, { key: "touchup", label: "Touch Up", icon: "🖌️" },
  { key: "bodyshop", label: "Body Shop", icon: "🔧" }, { key: "pdr", label: "PDR", icon: "🔨" },
  { key: "tires", label: "Tires", icon: "🛞" }, { key: "wheels", label: "Wheels", icon: "⚙️" },
  { key: "interior", label: "Interior", icon: "💺" }, { key: "mechanical", label: "Mechanical", icon: "🏎️" },
  { key: "windshield", label: "Windshield", icon: "🪟" }, { key: "electronics", label: "Radio/Screens/Moonroofs", icon: "📻" },
  { key: "oemdealer", label: "OEM Dealer", icon: "🏭" }, { key: "blackwidow", label: "Black Widow Pics", icon: "📸" },
  { key: "cr", label: "Condition Report", icon: "📋" }, { key: "auction", label: "Send to External Auction", icon: "🔨" },
  { key: "parts", label: "Parts", icon: "📦" },
];
