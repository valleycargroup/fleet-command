export const WORKER = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
export const LOCATIONS = ["PHX", "Dallas"];
export const SOURCES = ["Manheim Phoenix", "ADESA Dallas", "Copart", "IAAI", "OVE", "ACV Auctions", "Private Seller", "Trade-In"];
export const ARB_SOURCES = ["Manheim","ACV","Openlane","Copart","ADESA","OVE","IAAI"];
export const COLORS = ["White", "Black", "Silver", "Gray", "Red", "Blue", "Green", "Brown", "Gold", "Orange", "Beige"];
export const VCAT = [
  { key: "detail", label: "Detail", icon: "🧽" }, { key: "touchup", label: "Touch Up", icon: "🖌️" },
  { key: "bodyshop", label: "Body Shop", icon: "🔧" }, { key: "pdr", label: "PDR", icon: "🔨" },
  { key: "tires", label: "Tires", icon: "🛞" }, { key: "wheels", label: "Wheels", icon: "⚙️" },
  { key: "interior", label: "Interior", icon: "💺" }, { key: "mechanical", label: "Mechanical", icon: "🏎️" },
  { key: "windshield", label: "Windshield", icon: "🪟" }, { key: "electronics", label: "Radio/Screens/Moonroofs", icon: "📻" },
  { key: "oemdealer", label: "OEM Dealer", icon: "🏭" }, { key: "blackwidow", label: "Black Widow Pics", icon: "📸" },
  { key: "cr", label: "Condition Report", icon: "📋" }, { key: "auction", label: "Send to Auction", icon: "🔨" },
  { key: "parts", label: "Parts", icon: "📦" },
];
