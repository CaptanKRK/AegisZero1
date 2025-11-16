// Home page JavaScript
// Wrapped in IIFE to avoid global scope pollution and re-declaration errors
(function() {
  'use strict';
  
  console.log('Home page script initializing...');

  let draggedElement = null;

  // Tool registry - all available tools with their metadata
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
    'ad-blocker': {
      name: 'Ad Blocker & uBlock Helper',
      description: 'Configure ad blocking and get recommended filter lists',
      page: 'cybersecurity'
    },
    'popup-blocker': {
      name: 'Popup Blocker',
      description: 'Block annoying popups and unwanted dialogs',
      page: 'quality_of_life'
    },
    'ebay-checker': {
      name: 'eBay Checker',
      description: 'Analyze eBay listings for potential scams',
      page: 'quality_of_life'
    },
    'tos-scanner': {
      name: 'TOS Scanner',
      description: 'Analyze Terms of Service for problematic clauses',
      page: 'quality_of_life'
    },
    'youtube-checker': {
      name: 'YouTube Checker',
      description: 'Analyze YouTube videos for potential issues',
      page: 'quality_of_life'
    }
  };  // Initialize drag-and-drop (always enabled)
  function initializeDragAndDrop() {
    console.log('Setting up drag-and-drop...');
    
    // Make all tool cards draggable
    document.querySelectorAll('.config-tool').forEach(tool => {
      tool.draggable = true;
      
      tool.addEventListener('dragstart', (e) => {
        draggedElement = tool;
        tool.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      
      tool.addEventListener('dragend', (e) => {
        tool.classList.remove('dragging');
        draggedElement = null;
        
        // Auto-save the new order
        saveToolOrder();
      });
    });

    // Handle drag over for all sections
    document.querySelectorAll('.page-section').forEach(section => {
      section.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedElement) return;
        
        const afterElement = getDragAfterElement(section, e.clientY);
        if (afterElement == null) {
          section.appendChild(draggedElement);
        } else {
          section.insertBefore(draggedElement, afterElement);
        }
      });
    });
    
    console.log('Drag-and-drop initialized');
  }

  // Get the element that should come after the dragged element
  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.config-tool:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // Save the current favorites order to Chrome storage
  function saveToolOrder() {
    console.log('Auto-saving favorites order...');
    const favoritesSection = document.getElementById('favorites-section');
    if (!favoritesSection) return;
    
    const favoritesOrder = [];
    favoritesSection.querySelectorAll('.config-tool').forEach(tool => {
      const toolId = tool.dataset.tool;
      if (toolId) {
        favoritesOrder.push(toolId);
      }
    });
    
    chrome.storage.sync.set({ favoritesOrder: favoritesOrder }, () => {
      console.log('Favorites order saved:', favoritesOrder);
    });
  }

  // Load saved favorites order and reorder the favorites array
  function loadFavoritesOrder() {
    chrome.storage.sync.get(['favoritesOrder', 'favorites'], (result) => {
      if (result.favoritesOrder && result.favorites) {
        console.log('Loading saved favorites order:', result.favoritesOrder);
        
        // Reorder favorites array based on saved order
        const orderedFavorites = [];
        const currentFavorites = result.favorites || [];
        
        // First, add items in the saved order
        result.favoritesOrder.forEach(toolId => {
          if (currentFavorites.includes(toolId)) {
            orderedFavorites.push(toolId);
          }
        });
        
        // Then, add any new favorites that weren't in the saved order
        currentFavorites.forEach(toolId => {
          if (!orderedFavorites.includes(toolId)) {
            orderedFavorites.push(toolId);
          }
        });
        
        // Update favorites section with ordered array
        updateFavoritesSection(orderedFavorites);
      }
    });
  }

  // Initialize favorites functionality
  function initializeFavorites() {
    console.log('Setting up favorites...');
    
    // Load favorites and apply saved order
    chrome.storage.sync.get(['favorites', 'favoritesOrder'], (result) => {
      const favorites = result.favorites || [];
      const savedOrder = result.favoritesOrder || [];
      console.log('Loaded favorites:', favorites);
      console.log('Saved order:', savedOrder);
      
      // Update star icons based on favorites
      document.querySelectorAll('.favorite-star').forEach(star => {
        const toolId = star.dataset.tool;
        if (toolId && favorites.includes(toolId)) {
          star.classList.add('active');
        }
      });
      
      // Reorder favorites based on saved order
      if (savedOrder.length > 0) {
        const orderedFavorites = [];
        
        // Add items in saved order
        savedOrder.forEach(toolId => {
          if (favorites.includes(toolId)) {
            orderedFavorites.push(toolId);
          }
        });
        
        // Add any new favorites not in saved order
        favorites.forEach(toolId => {
          if (!orderedFavorites.includes(toolId)) {
            orderedFavorites.push(toolId);
          }
        });
        
        updateFavoritesSection(orderedFavorites);
      } else {
        // No saved order, use current favorites
        updateFavoritesSection(favorites);
      }
    });
    
    // Add click handlers to favorite stars
    document.querySelectorAll('.favorite-star').forEach(star => {
      star.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Star clicked:', star.dataset.tool);
        toggleFavorite(star);
      });
    });
  }

  // Toggle favorite status for a tool
  function toggleFavorite(star) {
    const toolId = star.dataset.tool;
    if (!toolId) {
      console.log('No tool ID found');
      return;
    }
    
    console.log('Toggling favorite for:', toolId);
    
    chrome.storage.sync.get(['favorites'], (result) => {
      let favorites = result.favorites || [];
      
      if (favorites.includes(toolId)) {
        // Remove from favorites
        favorites = favorites.filter(id => id !== toolId);
        star.classList.remove('active');
        console.log('Removed from favorites:', toolId);
      } else {
        // Add to favorites
        favorites.push(toolId);
        star.classList.add('active');
        console.log('Added to favorites:', toolId);
      }
      
      // Save to storage
      chrome.storage.sync.set({ favorites: favorites }, () => {
        console.log('Favorites updated:', favorites);
        updateFavoritesSection(favorites);
        
        // Update all stars with same toolId
        document.querySelectorAll(`.favorite-star[data-tool="${toolId}"]`).forEach(s => {
          if (favorites.includes(toolId)) {
            s.classList.add('active');
          } else {
            s.classList.remove('active');
          }
        });
      });
    });
  }

  // Update the favorites section on the home page
  function updateFavoritesSection(favorites) {
    const favoritesSection = document.getElementById('favorites-section');
    if (!favoritesSection) {
      console.log('Favorites section not found');
      return;
    }
    
    // Clear all tool cards from favorites section
    favoritesSection.querySelectorAll('.tool-card').forEach(card => card.remove());
    
    // Also remove empty state message if it exists
    const emptyMsg = favoritesSection.querySelector('p');
    if (emptyMsg) emptyMsg.remove();
    
    if (favorites.length === 0) {
      // Show empty state
      const emptyState = document.createElement('p');
      emptyState.style.cssText = 'text-align: center; opacity: 0.6; padding: 20px;';
      emptyState.textContent = 'No favorites yet. Click the star icon on any tool to add it here!';
      favoritesSection.appendChild(emptyState);
      console.log('No favorites to display');
      return;
    }
    
    console.log('Updating favorites section with:', favorites);
    
    // Create tool cards from registry
    favorites.forEach(toolId => {
      const toolData = toolRegistry[toolId];
      if (!toolData) {
        console.log('Tool not found in registry:', toolId);
        return;
      }
      
      // Create tool card
      const toolCard = document.createElement('div');
      toolCard.className = 'tool-card config-tool';
      toolCard.dataset.tool = toolId;
      
      // Create star button
      const star = document.createElement('button');
      star.className = 'favorite-star active';
      star.dataset.tool = toolId;
      star.textContent = '★';
      star.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(star);
      });
      
      // Create drag handle
      const dragHandle = document.createElement('div');
      dragHandle.className = 'drag-handle';
      dragHandle.textContent = '⋮⋮';
      
      // Create title
      const title = document.createElement('h3');
      title.textContent = toolData.name;
      
      // Create description
      const description = document.createElement('p');
      description.textContent = toolData.description;
      
      // Create "Use Tool" button
      const useToolBtn = document.createElement('button');
      useToolBtn.className = 'btn use-tool-btn';
      useToolBtn.dataset.page = toolData.page;
      useToolBtn.textContent = 'Use Tool';
      useToolBtn.addEventListener('click', () => {
        if (window.loadPage) {
          window.loadPage(toolData.page);
        }
      });
      
      // Assemble the card
      toolCard.appendChild(star);
      toolCard.appendChild(dragHandle);
      toolCard.appendChild(title);
      toolCard.appendChild(description);
      toolCard.appendChild(useToolBtn);
      
      // Make the card draggable
      toolCard.draggable = true;
      
      toolCard.addEventListener('dragstart', (e) => {
        draggedElement = toolCard;
        toolCard.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      
      toolCard.addEventListener('dragend', (e) => {
        toolCard.classList.remove('dragging');
        draggedElement = null;
        
        // Auto-save the new order
        saveToolOrder();
      });
      
      favoritesSection.appendChild(toolCard);
      console.log('Added to favorites section:', toolId);
    });
  }

  // Initialize everything when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeDragAndDrop();
      initializeFavorites();
    });
  } else {
    initializeDragAndDrop();
    initializeFavorites();
  }

  console.log('Home page script loaded');
})();
