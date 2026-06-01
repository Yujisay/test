# Firebase Migration & Setup Guide

This project has been migrated from Google Sheets to **Firebase Realtime Database**. Follow the steps below to configure your Firebase project correctly.

## 1. Firebase Realtime Database Security Rules
Copy and paste the following rules into your Firebase Console (**Realtime Database > Rules**):

```json
{
  "rules": {
    "sessions": {
      ".read": true,
      ".write": true,
      ".indexOn": ["fullName", "status", "timestamp"],
      "$session_id": {
        ".validate": "newData.hasChildren(['referenceNumber', 'fullName', 'status'])"
      }
    }
  }
}
```
*Note: For production, consider restricting write access to authenticated users only if using Firebase Auth.*

## 2. Data Migration Plan
To migrate your existing data from Google Sheets to Firebase:

1.  **Export Google Sheet**: Download your current Google Sheet as a **CSV** or **JSON** file.
2.  **Format Data**: Ensure the JSON structure matches the new Firebase schema:
    ```json
    {
      "REFERENCE_CODE": {
        "referenceNumber": "...",
        "fullName": "...",
        "seatType": "...",
        "duration": "...",
        "amount": 0,
        "status": "PENDING SESSION",
        "timestamp": "ISO_8601_TIMESTAMP",
        "startTime": "...",
        "endTime": "..."
      }
    }
    ```
3.  **Import to Firebase**: In the Firebase Console, go to **Realtime Database > Data**, click the three dots (⋮), and select **Import JSON**.

## 3. Environment Configuration
The Firebase configuration is currently hardcoded in `firebase-init.js`. If you move to a production environment, ensure you update these values:
- `apiKey`
- `authDomain`
- `databaseURL`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

## 4. Maintenance
- **Admin Passcode**: The admin dashboard access code is set to `admin123` in `admin.js`.
- **Database Cleanup**: Old or expired sessions are not automatically deleted. You can implement a Cloud Function to prune records older than 30 days if needed.
