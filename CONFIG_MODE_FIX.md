# Configuration Mode Fix - Variable Re-declaration Error

## Problem
When entering Configuration Mode, the console showed:
```
Uncaught SyntaxError: Identifier 'configurationMode' has already been declared (at home.js:1:1)
```

And the configuration mode UI didn't appear (no drag handles, no Save/Cancel buttons).

## Root Cause
The `home.js` script was being loaded multiple times without properly cleaning up the previous instance. When you navigate from Home → Settings → Home (via config mode), the script was loaded again, causing:
1. `let configurationMode` declared twice → SyntaxError
2. Event listeners attached multiple times
3. Configuration mode logic failing to execute

## Solutions Applied

### 1. Changed Variables to Window Properties
**Before:**
```javascript
let configurationMode = false;
let draggedElement = null;
```

**After:**
```javascript
// Use window properties to avoid re-declaration errors
if (typeof window.configurationMode === 'undefined') {
  window.configurationMode = false;
}
if (typeof window.draggedElement === 'undefined') {
  window.draggedElement = null;
}
```

**Why:** Window properties can be reassigned without throwing errors. The check prevents overwriting an existing value.

### 2. Updated All References
Changed all references from `configurationMode` to `window.configurationMode` and `draggedElement` to `window.draggedElement` throughout the file.

### 3. Improved Script Loading in popup.js
Added better cleanup and cache-busting:

```javascript
// Remove existing script with delay
const existing = document.getElementById('page-script');
if (existing) {
  existing.remove();
  console.log('Removed existing page script');
  await new Promise(resolve => setTimeout(resolve, 10));
}

// Load new script with timestamp to prevent caching
const script = document.createElement('script');
script.src = scriptUrl + '?t=' + Date.now();
```

**Why:** 
- The 10ms delay ensures the old script is fully unloaded
- The timestamp prevents browser caching of the old script
- This ensures a clean slate for each page load

## Files Modified
- ✅ `pages/js/home.js` - Changed variables to window properties
- ✅ `popup.js` - Improved script loading/unloading

## Testing Configuration Mode

### How to Enter Configuration Mode
1. Open the extension popup
2. Click hamburger menu (☰)
3. Click "Settings"
4. Click "Enter Configuration Mode"
5. Should redirect to Home page in configuration mode

### What You Should See
- ✅ **"Configuration Mode" header** at the top with instructions
- ✅ **Drag handles (⋮⋮)** appear on the left side of each tool when you hover
- ✅ **Gray overlay** on tools when hovering
- ✅ **Save** and **Cancel** buttons at the bottom

### How to Use
1. **Hover** over any tool card - you'll see:
   - Gray background overlay
   - Drag handle (⋮⋮) on the left
   - Cursor changes to "move"

2. **Drag** a tool card:
   - Click and hold on a tool
   - Drag it up or down
   - Drop it in a new position
   - Works within the same section or between sections

3. **Save Changes**:
   - Click **"Save"** button at the bottom
   - Green notification: "Configuration Saved!"
   - Page reloads with new order

4. **Cancel Changes**:
   - Click **"Cancel"** button
   - Returns to normal mode without saving
   - Original order is preserved

### Console Output (Expected)
When entering configuration mode:
```
Loading page: settings
Page settings HTML loaded, loading script from pages/js/settings.js
Page settings script loaded successfully
Settings page script loaded
Entering configuration mode
Loading page: home
Removed existing page script
Page home HTML loaded, loading script from pages/js/home.js
Page home script loaded successfully
Home page script loaded
```

**No red errors!** ✅

## Troubleshooting

### If you don't see the Configuration Mode header:
- Check console for errors
- Make sure `configurationMode: true` is set in storage
- Try reloading the extension

### If drag handles don't appear:
- Make sure you're hovering over the tool cards
- Check that CSS is loaded properly
- Look for JavaScript errors in console

### If dragging doesn't work:
- Make sure tools have the `config-tool` class
- Check that drag event listeners are attached
- Look for errors when hovering

All issues should now be resolved! 🎉
