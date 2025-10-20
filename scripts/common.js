// Common utilities shared across the extension
const API_BASE_URL = 'http://localhost:5000';

// Helper function to make API calls to the local server
async function callClassifier(type, payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, payload })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    return { error: error.message };
  }
}

// Helper function to show loading state
function showLoading(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = '<div class="loading">Analyzing...</div>';
  }
}

// Helper function to show error state
function showError(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = `<div class="error">Error: ${message}</div>`;
  }
}

// Helper function to show success state
function showSuccess(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = `<div class="status">${message}</div>`;
  }
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { callClassifier, showLoading, showError, showSuccess };
}
