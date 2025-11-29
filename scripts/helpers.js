window.App = window.App || {};

(function() {
  const Helpers = {
    generateId: function() {
      return 'id-' + Math.random().toString(36).substr(2, 9);
    },

    formatCurrency: function(amount, currency = 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount);
    },

    // Compress data to URL-safe base64
    encodeData: function(data) {
      try {
        const json = JSON.stringify(data);
        return btoa(encodeURIComponent(json));
      } catch (e) {
        console.error('Encoding failed', e);
        return '';
      }
    },

    // Decompress data from URL-safe base64
    decodeData: function(str) {
      try {
        const json = decodeURIComponent(atob(str));
        return JSON.parse(json);
      } catch (e) {
        console.error('Decoding failed', e);
        return null;
      }
    },

    // Copy text to clipboard with fallback
    copyToClipboard: function(text) {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
      } else {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        return new Promise((resolve, reject) => {
          try {
            document.execCommand('copy');
            textArea.remove();
            resolve();
          } catch (e) {
            textArea.remove();
            reject(e);
          }
        });
      }
    },

    // Parse URL params
    getURLParam: function(param) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(param);
    }
  };

  window.App.Helpers = Helpers;
})();