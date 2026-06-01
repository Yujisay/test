export const firebaseConfig = {
  apiKey: "AIzaSyC6piJ_bLMZeOMZZb62PYmanilcA-JW3FM",
  authDomain: "studyhub-f1fbe.firebaseapp.com",
  projectId: "studyhub-f1fbe",
  databaseURL: "https://studyhub-f1fbe-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "studyhub-f1fbe.firebasestorage.app",
  messagingSenderId: "466465286377",
  appId: "1:466465286377:web:972eb3d4c45832933f6878"
};

export const PRICING: Record<string, Record<string, number>> = {
  'Table':   { '1 Hour': 25, '3+1 Hours': 75 },
  'Cubicle': { '1 Hour': 50, '3+1 Hours': 150 }
};

export const HOURLY_RATE: Record<string, number> = {
  'Table': 25,
  'Cubicle': 50
};

export const CLOSING_TIME = "22:00";
export const ADMIN_PASSCODE = "admin123";
export const PAGE_SIZE = 10;
export function getPageSize(): number {
  return window.innerWidth < 768 ? 5 : 10;
}
