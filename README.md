# AEGIS Chrome Extension

A comprehensive Chrome extension framework with multiple security and analysis tools, featuring a purple-themed UI and AI-powered classification capabilities.

## Features

- **eBay Checker**: Analyzes eBay listings for scams and pricing anomalies
- **Email Checker**: Checks email addresses against HaveIBeenPwned breach database
- **Popup Blocker**: Toggles automatic popup blocking behavior
- **TOS Scanner**: Analyzes Terms of Service for problematic clauses
- **uBlock Helper**: Provides recommended filter lists for uBlock Origin
- **Website Checker**: AI-powered phishing and malicious website detection
- **YouTube Checker**: Analyzes YouTube videos for misinformation and factuality

## Setup Instructions

### 1. Install the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `aegis-extension` folder
4. The extension should now appear in your extensions list

### 2. Set Up the Python Server

The extension requires a local Python server for AI classification. You have two options:

#### Option A: Quick Start (Flask Server)
1. Navigate to the `server/` directory:
   ```bash
   cd aegis-extension/server
   ```

2. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

3. Your existing files are already copied:
   - `model.pkl` ✅ (already copied)
   - `phishing_site_urls.csv` ✅ (already copied)
   - `cleanup.py` ✅ (already copied)
   - `model_server.py` ✅ (already copied)

4. Start the Flask server:
   ```bash
   python app.py
   ```
   The server will start on `http://localhost:5000`

#### Option B: Advanced Server (FastAPI)
1. Use the interactive startup script:
   ```bash
   python start_server.py
   ```
   Choose option 2 for FastAPI server on `http://localhost:8000`

#### Option C: Manual FastAPI
```bash
python -m uvicorn model_server:app --host 0.0.0.0 --port 8000 --reload
```

**Note**: The extension automatically detects which server is running and uses the appropriate one.

### 3. Configure API Keys (Optional)

#### HaveIBeenPwned API Key
1. Go to [HaveIBeenPwned API](https://haveibeenpwned.com/API/Key)
2. Get your API key
3. Enter it in the Email Checker page of the extension

## Usage

### Basic Usage
1. Click the AEGIS extension icon in your browser toolbar
2. Use the hamburger menu (☰) to navigate between different tools
3. Each tool has its own interface and functionality

### Tool-Specific Instructions

#### eBay Checker
1. Navigate to an eBay listing
2. Open the extension and go to "eBay Checker"
3. Click "Analyze Listing" to get AI-powered scam detection

#### Website Checker
1. Go to "Website Checker" in the extension
2. Enter a URL to check
3. Click "Check Website" for phishing/malicious site analysis

#### YouTube Checker
1. Navigate to a YouTube video
2. Open the extension and go to "YouTube Checker"
3. Click "Analyze Video" for misinformation detection

#### TOS Scanner
1. Go to "TOS Scanner" in the extension
2. Either enter a specific URL or leave blank to scan the current page
3. Click "Scan TOS" to analyze for problematic clauses

#### Popup & Ad Blocker
1. Go to "Popup Blocker" in the extension
2. Toggle "Enable Popup Blocker" to block popups
3. Toggle "Enable Ad Blocker" to block ads
4. Add custom ad blocking rules in the text area
5. View blocking statistics

## File Structure

```
aegis-extension/
├── manifest.json              # Extension manifest
├── popup.html                 # Main extension UI
├── popup.css                  # Purple theme styling
├── popup.js                   # Main UI logic and routing
├── pages/                     # Individual tool pages
│   ├── home.html
│   ├── ebay.html
│   ├── email.html
│   ├── popup_blocker.html
│   ├── tos.html
│   ├── ublock.html
│   ├── website.html
│   └── youtube.html
├── content-scripts/           # Page content extraction
│   ├── ebay_content.js
│   ├── youtube_content.js
│   └── tos_content.js
├── scripts/                   # Background and utilities
│   ├── background.js
│   └── common.js
└── server/                    # Python classification server
    ├── app.py
    ├── requirements.txt
    ├── model.pkl             # Your trained model (copy here)
    └── phishing_site_urls.csv # Your phishing database (copy here)
```

## Integration Points

### Adding Your Existing Website Checker Code

If you have existing website classification code:

1. **Python Code**: Copy your classification functions to `server/website_checker.py` and import them in `app.py`
2. **Model Integration**: The server automatically loads your `model.pkl` file
3. **Feature Extraction**: Modify the `extract_url_features()` function in `app.py` to match your model's expected input format

### Customizing Classification Logic

The server provides several integration points:

- `classify_url_with_model()`: Main URL classification function
- `analyze_text_content()`: Text content analysis
- `extract_url_features()`: URL feature extraction

Modify these functions to match your existing model's requirements.

## Security & Privacy Notes

- **Local Processing**: The Python server runs locally on your machine - no data is sent to external servers
- **Privacy**: The extension only processes data locally unless you explicitly use external APIs (like HaveIBeenPwned)
- **API Keys**: Store sensitive API keys in Chrome's secure storage
- **Permissions**: The extension requests minimal necessary permissions

## Troubleshooting

### Server Won't Start
- Ensure Python 3.7+ is installed
- Check that all dependencies are installed: `pip install -r requirements.txt`
- Verify that `model.pkl` and `phishing_site_urls.csv` are in the `server/` directory

### Extension Not Working
- Check that the Python server is running on `http://localhost:5000`
- Open Chrome DevTools (F12) and check the Console for errors
- Verify that the extension has the necessary permissions

### Classification Not Working
- Check the server logs for model loading errors
- Ensure your `model.pkl` is compatible with the current scikit-learn version
- Verify that your model expects the same feature format as provided by `extract_url_features()`

## Development

### Adding New Tools
1. Create a new HTML page in `pages/`
2. Add navigation link in `popup.html`
3. Implement any necessary content scripts
4. Add classification logic in `server/app.py`

### Customizing the UI
- Modify `popup.css` for styling changes
- The purple theme uses CSS custom properties defined in `:root`
- All modals use the same template and styling

## License

This project is provided as a framework for building security-focused Chrome extensions. Modify and distribute according to your needs.

## Support

For issues or questions:
1. Check the server logs for detailed error messages
2. Verify that all dependencies are correctly installed
3. Ensure your model files are compatible with the current setup
