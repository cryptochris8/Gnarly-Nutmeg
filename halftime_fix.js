// HALFTIME SCREEN FIXES - Paste this in browser console to test
// This fixes button visibility and makes the header customizable

// Function to fix halftime overlay positioning
function fixHalftimeOverlay() {
  const overlay = document.getElementById('halftime-stats-overlay');
  if (overlay) {
    console.log('🔧 Applying halftime fixes...');
    
    // Fix main overlay positioning
    overlay.style.justifyContent = 'flex-start';
    overlay.style.overflowY = 'auto';
    overlay.style.padding = '20px';
    overlay.style.boxSizing = 'border-box';
    
    // Find and fix the stats content
    const statsContent = overlay.querySelector('div');
    if (statsContent) {
      statsContent.style.maxWidth = '900px';
      statsContent.style.width = '100%';
      statsContent.style.margin = 'auto';
      statsContent.style.maxHeight = 'calc(100vh - 40px)';
      statsContent.style.overflowY = 'auto';
    }
    
    // Fix button visibility
    const button = document.getElementById('start-second-half-btn');
    if (button) {
      button.style.display = 'block';
      button.style.margin = '0 auto';
      button.style.minWidth = '220px';
      button.style.padding = '18px 35px';
      button.style.fontSize = '18px';
      
      // Scroll to button to ensure it's visible
      button.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      console.log('✅ Button made visible and scrolled into view');
    }
    
    // Add responsive CSS for mobile
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        #halftime-stats-overlay > div > div:nth-child(2) {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    console.log('✅ Halftime overlay fixes applied!');
    return true;
  }
  console.log('❌ No halftime overlay found');
  return false;
}

// Function to customize header text
function customizeHalftimeHeader(newText) {
  const overlay = document.getElementById('halftime-stats-overlay');
  if (overlay) {
    const header = overlay.querySelector('h1');
    if (header) {
      header.innerHTML = `🏟️ ${newText}`;
      console.log(`✅ Header changed to: ${newText}`);
    }
  }
}

// Auto-fix when halftime overlay appears
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.id === 'halftime-stats-overlay') {
          setTimeout(() => {
            fixHalftimeOverlay();
          }, 100);
        }
      });
    }
  });
});

observer.observe(document.body, { childList: true });

console.log('🏟️ Halftime fixes loaded! Functions available:');
console.log('- fixHalftimeOverlay() - Fix positioning and button visibility');
console.log('- customizeHalftimeHeader("YOUR TEXT") - Change header text');
console.log('Auto-fix is enabled for future halftime screens.');

// Make functions globally available
window.fixHalftimeOverlay = fixHalftimeOverlay;
window.customizeHalftimeHeader = customizeHalftimeHeader; 