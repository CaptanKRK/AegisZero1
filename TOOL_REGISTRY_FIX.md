# Tool Registry - Dynamic Favorites Display Fix

## Problem
When starring a tool on the cybersecurity or quality_of_life page, the star would turn yellow and the "No favorites" text would disappear from the home page, but no tool cards would appear. This was because:

1. The home page no longer has the tool cards (they were removed to simplify the UI)
2. The `updateFavoritesSection()` function was trying to find and clone existing tool cards with `document.querySelector('.tool-card[data-tool="${toolId}"]')`
3. Since the cards didn't exist on the home page, nothing would be found to clone

## Solution
Created a **tool registry** that stores metadata for all tools, then dynamically creates tool cards on the home page when they're favorited.

## Changes Made

### `pages/js/home.js` - Added Tool Registry

```javascript
const toolRegistry = {
  'email-checker': {
    name: 'Email Checker',
    description: 'Check if your email has been compromised in data breaches',
    page: 'cybersecurity'
  },
  'website-checker': {
    name: 'Website Checker',
    description: 'Check if a website is likely phishing or malicious',
    page: 'cybersecurity'
  },
  // ... all 7 tools defined
};
```

### Updated `updateFavoritesSection()` Function

**Before**: Tried to clone existing tool cards
```javascript
const originalTool = document.querySelector(`.tool-card[data-tool="${toolId}"]`);
if (originalTool) {
  const clone = originalTool.cloneNode(true);
  // ...
}
```

**After**: Creates tool cards dynamically from registry
```javascript
const toolData = toolRegistry[toolId];
if (toolData) {
  // Create tool card from scratch
  const toolCard = document.createElement('div');
  toolCard.className = 'tool-card config-tool';
  // Add star, title, description, button, etc.
}
```

## How It Works Now

### 1. User Stars a Tool
- User clicks ★ on "Popup Blocker" in Quality of Life page
- Star turns yellow
- Tool ID added to favorites array: `['popup-blocker']`
- Storage updated

### 2. Home Page Updates
- `updateFavoritesSection(['popup-blocker'])` is called
- Function looks up `'popup-blocker'` in `toolRegistry`
- Finds:
  ```javascript
  {
    name: 'Popup Blocker',
    description: 'Block annoying popups and unwanted dialogs',
    page: 'quality_of_life'
  }
  ```

### 3. Tool Card Created
- Creates a new `<div class="tool-card">`
- Adds yellow ★ (active state)
- Adds drag handle ⋮⋮
- Adds title: "Popup Blocker"
- Adds description
- Adds "Use Tool" button that links to quality_of_life page

### 4. Card Appears on Home
- Card is appended to favorites section
- Fully functional with:
  - Clickable star (can un-favorite)
  - "Use Tool" button (navigates to correct page)
  - Drag handle (for potential reordering)

## Tool Registry Contents

All 7 tools are registered:

| Tool ID | Name | Page |
|---------|------|------|
| `email-checker` | Email Checker | cybersecurity |
| `website-checker` | Website Checker | cybersecurity |
| `ad-blocker` | Ad Blocker & uBlock Helper | cybersecurity |
| `popup-blocker` | Popup Blocker | quality_of_life |
| `ebay-checker` | eBay Checker | quality_of_life |
| `tos-scanner` | TOS Scanner | quality_of_life |
| `youtube-checker` | YouTube Checker | quality_of_life |

## Console Output

### When Updating Favorites Section
```
Updating favorites section with: ["popup-blocker", "ebay-checker"]
Added to favorites section: popup-blocker
Added to favorites section: ebay-checker
```

### If Tool Not in Registry (Error Case)
```
Tool not found in registry: unknown-tool
```

## Benefits

✅ **Works without cloning** - Creates cards from data, not DOM
✅ **Cleaner home page** - No need to keep hidden tool cards
✅ **Maintainable** - All tool data in one place
✅ **Flexible** - Easy to add new tools to registry
✅ **Consistent styling** - All cards created the same way
✅ **Fully functional** - Stars and buttons work perfectly

## Testing

1. **Reload extension**
2. **Go to Cybersecurity or Quality of Life page**
3. **Click a ★ star** - should turn yellow
4. **Navigate to Home**
5. **Expected**:
   - Tool card appears in "⭐ Favorites" section
   - Card has yellow star
   - Card has "Use Tool" button
   - Clicking "Use Tool" navigates to correct page
   - Clicking star un-favorites (card disappears)

## Edge Cases Handled

✅ **Empty favorites** - Shows "No favorites yet..." message
✅ **Unknown tool ID** - Logs error, continues with other tools
✅ **Missing window.loadPage** - Safely checks before calling
✅ **Multiple favorites** - All displayed correctly
✅ **Star toggling** - Works on home page cards

## Future Improvements

If needed, could add to tool registry:
- Icon/emoji for each tool
- Category/tags
- Keywords for search
- Last used timestamp
- Usage statistics

But for now, the simple registry works perfectly! 🎉
