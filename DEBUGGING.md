# Debugging Guide - Button Click Issues

## Current Status
Fixed CSP violations, but buttons still not responding. Added debug logging to trace the issue.

## How to Debug

### 1. Open Chrome DevTools
1. Go to `chrome://extensions/`
2. Find AEGIS extension
3. Click "Reload" button
4. Click on the extension icon in Chrome toolbar
5. **Right-click on the popup** and select "Inspect"
6. Open the **Console** tab

### 2. Check Console Output
When the popup opens, you should see:
```
Loading page: home
Found X script(s) to execute for page home
Executing script 1 for page home
Page home loaded successfully
```

### 3. Navigate to Settings
1. Click the hamburger menu (☰)
2. Click "Settings"
3. Watch console for:
```
Loading page: settings
Found X script(s) to execute for page settings
Executing script 1 for page settings
Page settings loaded successfully
```

### 4. Test Color Scheme Button
1. Click on a color scheme radio button (Blue, Green, or Red)
2. Watch the console for any errors
3. The colors should change immediately

### 5. Common Issues & Solutions

#### Issue: "Cannot read property 'addEventListener' of null"
**Cause:** Element not found (ID mismatch or element doesn't exist)
**Solution:** Check that element IDs match between HTML and JavaScript

#### Issue: "loadPage is not defined"
**Cause:** Function not in global scope
**Solution:** Already fixed - `window.loadPage = loadPage` is set

#### Issue: Scripts not executing
**Cause:** Script execution might be blocked or erroring
**Solution:** Check console for specific error messages

### 6. Manual Test Checklist

Test each feature and check the box:
- [ ] Home page loads on startup
- [ ] Hamburger menu opens/closes sidebar
- [ ] Navigating to Cybersecurity page works
- [ ] Navigating to Quality of Life page works
- [ ] Navigating to Settings page works
- [ ] Color scheme radio buttons are clickable
- [ ] Color scheme changes when selected
- [ ] "Enter Configuration Mode" button is clickable
- [ ] "Reset All Settings" button is clickable
- [ ] Star icons (★) are clickable
- [ ] Stars turn yellow when clicked
- [ ] Favorites appear on home page
- [ ] Remove favorite buttons work

## What to Share
If buttons still don't work, please share:
1. **Console output** when you open the extension
2. **Any error messages** in red
3. **Which specific button** doesn't work
4. **Console output** when you click that button

This will help identify the exact issue!
