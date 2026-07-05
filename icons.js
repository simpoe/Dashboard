const EMOJI_TO_LUCIDE = {
  '⚙️': 'settings',
  '⚙': 'settings',
  '📧': 'mail',
  '🔑': 'key',
  '❌': 'x-circle',
  '📊': 'layout-dashboard',
  '🧮': 'calculator',
  '🧠': 'brain',
  '🔔': 'bell',
  '📋': 'clipboard-list',
  '🔧': 'wrench',
  '📄': 'file-text',
  '⚠️': 'alert-triangle',
  '🗂️': 'folder-open',
  '🗂': 'folder-open',
  '👥': 'users',
  '🏢': 'building-2',
  '🗑': 'trash-2',
  '📥': 'download',
  '❤️': 'heart',
  '⏱️': 'clock',
  '⏱': 'clock',
  '🌡️': 'thermometer',
  '🌡': 'thermometer',
  '🏗️': 'truck',
  '🏗': 'truck',
  '🔍': 'search',
  '👑': 'crown',
  '🌐': 'globe',
  '🌤': 'sun',
  '💨': 'wind',
  '💧': 'droplet',
  '⚗️': 'flask-conical',
  '⚗': 'flask-conical',
  '📅': 'calendar',
  '🎛': 'sliders',
  '📱': 'smartphone',
  '📈': 'line-chart',
  '🔐': 'lock',
  '💾': 'save',
  '⏻': 'power',
  '🚨': 'alert-circle',
  '⚡': 'zap',
  '💸': 'dollar-sign',
  '📉': 'trending-down',
  '🛑': 'stop-circle',
  '🔄': 'refresh-cw',
  '🎯': 'target',
  '🧪': 'flask-conical',
  '📳': 'smartphone-vibration',
  '🔩': 'nut',
  '🚌': 'truck',
  '✅': 'check-circle',
  '🔴': 'circle',
  '🟡': 'circle',
  '🟢': 'circle',
  '🔵': 'circle',
  '🛠️': 'tool',
  '🛠': 'tool',
  '🛢️': 'container',
  '🛢': 'container',
  '🖨': 'printer',
  '📐': 'triangle',
  '▶': 'play',
  '✔': 'check',
  '⭕': 'circle-dot',
  '🔒': 'lock',
  '🖥️': 'monitor',
  '🖥': 'monitor',
  'ℹ️': 'info',
  'ℹ': 'info',
  '📎': 'paperclip',
  '📷': 'camera',
  '↻': 'refresh-cw'
};

const sortedEmojis = Object.keys(EMOJI_TO_LUCIDE).sort((a, b) => b.length - a.length);

function replaceNodeEmojis(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    let text = node.textContent;
    let hasEmoji = false;
    for (const emoji of sortedEmojis) {
      if (text.includes(emoji)) {
        hasEmoji = true;
        break;
      }
    }
    if (!hasEmoji) return;

    const parent = node.parentNode;
    if (!parent) return;
    if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SVG', 'PATH', 'I'].includes(parent.tagName)) return;
    if (parent.closest('.lucide') || parent.closest('.simpoe-icon')) return;

    const docFrag = document.createDocumentFragment();
    let remainingText = text;
    let found = true;

    while (found) {
      found = false;
      let earliestIndex = Infinity;
      let matchingEmoji = '';

      for (const emoji of sortedEmojis) {
        const idx = remainingText.indexOf(emoji);
        if (idx !== -1 && idx < earliestIndex) {
          earliestIndex = idx;
          matchingEmoji = emoji;
          found = true;
        }
      }

      if (found) {
        if (earliestIndex > 0) {
          docFrag.appendChild(document.createTextNode(remainingText.substring(0, earliestIndex)));
        }
        
        const iconName = EMOJI_TO_LUCIDE[matchingEmoji];
        const iconSpan = document.createElement('i');
        iconSpan.setAttribute('data-lucide', iconName);
        iconSpan.className = 'simpoe-icon';
        
        // Add specific coloring classes
        if (matchingEmoji === '🔴') iconSpan.classList.add('icon-circle-red');
        else if (matchingEmoji === '🟢') iconSpan.classList.add('icon-circle-green');
        else if (matchingEmoji === '🟡') iconSpan.classList.add('icon-circle-yellow');
        else if (matchingEmoji === '🔵') iconSpan.classList.add('icon-circle-blue');
        else if (matchingEmoji === '✅') iconSpan.classList.add('icon-success');
        else if (matchingEmoji === '❌') iconSpan.classList.add('icon-error');
        else if (matchingEmoji === '⚠️') iconSpan.classList.add('icon-warning');
        
        docFrag.appendChild(iconSpan);
        remainingText = remainingText.substring(earliestIndex + matchingEmoji.length);
      }
    }

    if (remainingText.length > 0) {
      docFrag.appendChild(document.createTextNode(remainingText));
    }

    parent.replaceChild(docFrag, node);
  } else {
    if (node.tagName && ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SVG', 'PATH', 'I'].includes(node.tagName)) return;
    if (node.classList && (node.classList.contains('lucide') || node.classList.contains('simpoe-icon'))) return;
    
    const children = Array.from(node.childNodes);
    for (const child of children) {
      replaceNodeEmojis(child);
    }
  }
}

let scanTimeout = null;
function scanAndConvertIcons(container = document.body) {
  if (scanTimeout) clearTimeout(scanTimeout);
  scanTimeout = setTimeout(() => {
    if (window.observer) window.observer.disconnect();
    
    replaceNodeEmojis(container);
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
    
    if (window.observer) {
      window.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }, 10);
}

// Initial run and setting up MutationObserver
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIcons);
} else {
  initIcons();
}

function initIcons() {
  scanAndConvertIcons();
  
  window.observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (!['SVG', 'PATH', 'I'].includes(node.tagName) && !node.classList.contains('lucide')) {
              shouldScan = true;
              break;
            }
          } else if (node.nodeType === Node.TEXT_NODE) {
            shouldScan = true;
            break;
          }
        }
      } else if (mutation.type === 'characterData') {
        shouldScan = true;
      }
      if (shouldScan) break;
    }
    
    if (shouldScan) {
      scanAndConvertIcons();
    }
  });
  
  window.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
