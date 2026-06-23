# Analytics Viewer - Chrome Extension

A Chrome extension that displays Google Analytics data for Squarespace sites with local SQLite caching. (Can be altered for other websites).

## Features

- OAuth 2.0 Authentication with Google
- Fetch real-time Google Analytics data
- SQLite caching for instant loading
- Auto-refresh (checks for fresh data every hour)
- Clean, simple popup interface
- View Active Users, Sessions, Page Views, Bounce Rate, Avg Session Duration

## Installation

### Option 1: Install from .crx File (Recommended)

1. Download the .crx file from the Releases section
2. Open Chrome and go to chrome://extensions/
3. Turn ON Developer mode (toggle in top right)
4. Drag the .crx file onto the extensions page
5. Click Add extension when prompted

### Option 2: Install from Source

1. Clone this repository or download the ZIP
2. Open Chrome and go to chrome://extensions/
3. Turn ON Developer mode
4. Click Load unpacked
5. Select the analytics-extension folder
6. The extension will appear in your toolbar

## Setup Instructions

### Step 1: Connect to Google

1. Click the extension icon in your toolbar
2. Click Connect to Google
3. Log in with your Google account
4. Grant the requested permissions

### Step 2: Access to the Analytics Property

Note: You need to be added as a Viewer to the Google Analytics property you want to view.

1. Contact the site admin to add your email as a Viewer in Google Analytics
2. Once added, the property will appear in the extension dropdown

### Step 3: Load Data

1. Select your property from the dropdown
2. Click Load Analytics
3. View your data

## Features in Detail

### SQLite Caching

- Data is cached locally after first fetch
- Subsequent loads are instant (0.5 seconds)
- Auto-refreshes after 1 hour
- Works offline

### Data Displayed

- Active Users
- Sessions
- Page Views
- Bounce Rate
- Avg Session Duration

## File Structure

analytics-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (OAuth, API calls)
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
├── sqlite-service.js      # SQLite database operations
├── sql-wasm.js            # SQLite engine (JS glue)
├── sql-wasm.wasm          # SQLite engine (WebAssembly)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png

## Technologies Used

- Chrome Extensions API (Manifest V3)
- OAuth 2.0 (Google Identity API)
- Google Analytics Data API v1beta
- SQLite (sql.js via WebAssembly)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No Google Analytics properties found | Ensure your email is added as a Viewer in GA |
| Not connected | Click Connect to Google and log in |
| Data shows 0 or No data | No traffic yet, or tracking tag isn't installed |
| Extension doesn't load | Turn ON Developer mode in chrome://extensions/ |

## Author


- GitHub: https://github.com/kingsleynahyi
- LinkedIn: https://linkedin.com/in/kingsleynahyi

## License

MIT
