// ==========================================
// backend/src/app.js - Express Server
// ==========================================
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors());
app.use(express.json());

// File upload configuration
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Google Sheets integration
const sheets = google.sheets('v4');
const auth = new google.auth.GoogleAuth({
  credentials: {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Utility function to sync with Google Sheets
async function syncToSheets(document, action = 'create') {
  try {
    const authClient = await auth.getClient();
    
    // Front Side Register (Public info)
    await sheets.spreadsheets.values.append({
      auth: authClient,
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Front Side Register!A:F',
      valueInputOption: 'RAW',
      resource: {
        values: [[
          document.doc_series_id,
          document.title,
          document.doc_type,
          document.creation_date,
          document.status,
          document.registry_origin
        ]]
      }
    });

    // Back Side Register (Administrative info)
    await sheets.spreadsheets.values.append({
      auth: authClient,
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Back Side Register!A:G',
      valueInputOption: 'RAW',
      resource: {
        values: [[
          document.doc_series_id,
          document.sovereign_owner,
          document.doc_hash || 'Pending',
          'Pending Notarization',
          'System Generated',
          'Digital Seal Applied',
          `Auto-registered ${new Date().toISOString()}`
        ]]
      }
    });

    console.log('Successfully synced to Google Sheets');
  } catch (error) {
    console.error('Failed to sync to Google Sheets:', error);
  }
}

// [Rest of your routes here, as in your script]
```
*(copy the rest of your code as needed)*

---

## 2. **Project Structure**

Here's a complete list of files and folders you'll need, as represented in your script:

- `database/schema.sql` *(your previously provided Neon PostgreSQL schema)*
- `database/seed-data.sql` *(optional: for initial data)*
- `frontend/` with React starter files
- `backend/` with the above `src/app.js`
- `docs/` (API.md, DEPLOYMENT.md, USER_GUIDE.md)
- `spreadsheets/` (document-registry.xlsx, templates/)
- `.env.example` and `frontend/.env.example`
- `.gitignore`
- `README.md`
- `package.json`, `frontend/package.json`, `backend/package.json`

---

## 3. **How to Create Everything**

You can copy the shell script you posted and run it locally, **changing `YOUR_USERNAME` to your actual GitHub username**.  
After this, copy your backend code into `backend/src/app.js`.  
Also, copy your database schema into `database/schema.sql`.

---

## 4. **Next Steps**

1. **Create repo on GitHub**: https://github.com/new  
2. **Clone your repo and run your setup script** (or manually create folders).
3. **Paste backend code and schema** as described.
4. **Edit `.env` files** with your actual secrets.
5. **Add, commit, and push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit: Grønli Court Registry structure"
   git push -u origin main
