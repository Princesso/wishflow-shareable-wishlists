window.App = window.App || {};

$(function() {
  // Initialize Storage module inline for simplicity
  window.App.Storage = {
    saveList: function(list) {
      let lists = this.getAllLists();
      const idx = lists.findIndex(l => l.id === list.id);
      if (idx >= 0) lists[idx] = list;
      else lists.push(list);
      localStorage.setItem('wishflow_lists', JSON.stringify(lists));
    },
    getList: function(id) {
      return this.getAllLists().find(l => l.id === id);
    },
    getAllLists: function() {
      return JSON.parse(localStorage.getItem('wishflow_lists') || '[]');
    },
    deleteList: function(id) {
      let lists = this.getAllLists().filter(l => l.id !== id);
      localStorage.setItem('wishflow_lists', JSON.stringify(lists));
    }
  };

  // Check if all modules are loaded
  if (!window.App.UI || !window.App.Helpers) {
    console.error('Modules failed to load.');
    return;
  }

  // Check for shared list in URL
  const shareData = window.App.Helpers.getURLParam('share');
  
  window.App.UI.init();

  if (shareData) {
    const list = window.App.Helpers.decodeData(shareData);
    if (list) {
      window.App.UI.loadGuestView(list);
    } else {
      window.App.UI.showToast('Invalid share link.');
      window.App.UI.renderDashboard();
    }
  } else {
    window.App.UI.renderDashboard();
  }
});