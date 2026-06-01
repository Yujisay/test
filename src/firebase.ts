import { firebaseConfig } from './config';

let db: any = null;

export function initFirebase(): any {
  try {
    if ((window as any).firebase) {
      firebase.initializeApp(firebaseConfig);
      db = firebase.database();
      console.log("Firebase Initialized Successfully (Compat Mode)");
    } else {
      console.error("Firebase SDK not found! Ensure CDN scripts are loaded in index.html.");
    }
  } catch (error) {
    console.error("Firebase Initialization Error:", error);
  }
  return db;
}

export function getDb(): any {
  return db;
}
