# Quick Test Guide - Favorites System

## How to Test

1. **Reload the Chrome Extension**
   - Go to `chrome://extensions/`
   - Click the reload button on your extension

2. **Open the Extension**
   - Click the extension icon in Chrome toolbar

3. **Test Stars on Cybersecurity Page**
   - Click hamburger menu → Cybersecurity
   - Open browser console (F12)
   - Click the ★ next to "Email Checker"
   - **Expected**:
     - Star turns yellow
     - Console shows: `"Star clicked: email-checker"`
     - Console shows: `"Added to favorites: email-checker"`
     - No border around the star

4. **Check Home Page**
   - Click hamburger menu → Home
   - **Expected**:
     - See "⭐ Favorites" section
     - Email Checker tool card appears
     - Star on the card is yellow
     - Console shows favorites were loaded

5. **Test Removing Favorite**
   - Click the yellow ★ on Email Checker (in favorites section)
   - **Expected**:
     - Star turns gray
     - Tool disappears from favorites
     - Console shows: `"Removed from favorites: email-checker"`

6. **Test Cross-Page Sync**
   - Go to Quality of Life page
   - Click ★ on "Popup Blocker"
   - Go back to Home
   - **Expected**:
     - Popup Blocker appears in favorites
     - Star is yellow

7. **Test Multiple Favorites**
   - Add 3-4 different tools to favorites
   - **Expected**:
     - All appear on home page
     - All have yellow stars
     - Console logs show all IDs in array

## What You Should See

### Home Page (After Cleanup)
- **Welcome Card**: "AEGIS - Welcome. Use the hamburger..."
- **Favorites Section**: "⭐ Favorites" heading
- **No tool cards** unless you've favorited them
- **No** scan URL input
- **No** cybersecurity/quality tools sections

### Star Appearance
- **Inactive**: Gray ★ (color: #666)
- **Active**: Yellow ★ with glow (color: #ffd700)
- **No box/border** around the star
- **Hover**: Star scales up slightly

### Console Output (Example)
```
Home page script initializing...
Setting up favorites...
Loaded favorites: []
No favorites to display
Home page script loaded
```

After clicking a star:
```
Star clicked: email-checker
Added to favorites: email-checker
Favorites updated: ["email-checker"]
Updating favorites section with: ["email-checker"]
Added to favorites section: email-checker
```

## Common Issues & Solutions

### "Star doesn't turn yellow"
- Check console for errors
- Make sure you're clicking the star itself, not the card
- Verify the star has `data-tool` attribute

### "Console shows nothing when clicking star"
- Hard refresh the extension (remove and re-add it)
- Check if JavaScript is enabled
- Look for CSP errors in console

### "Tool doesn't appear in favorites section"
- Check if favorites section exists on home page
- Verify console shows "Updating favorites section"
- Check Chrome storage: `chrome.storage.sync.get(['favorites'], console.log)`

### "Stars don't sync across pages"
- Check console for storage change listener
- Verify all pages use same tool IDs
- Clear Chrome storage and try again

## Developer Commands (in Console)

```javascript
// Check current favorites
chrome.storage.sync.get(['favorites'], (r) => console.log(r.favorites));

// Clear all favorites
chrome.storage.sync.set({favorites: []});

// Add a favorite manually
chrome.storage.sync.get(['favorites'], (r) => {
  const favs = r.favorites || [];
  favs.push('email-checker');
  chrome.storage.sync.set({favorites: favs});
});

// Check all storage
chrome.storage.sync.get(null, console.log);
```
