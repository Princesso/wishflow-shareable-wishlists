window.App = window.App || {};

(function() {
  const UI = {
    // State
    currentView: 'dashboard',
    currentList: null,
    isGuest: false,

    // DOM Elements
    $app: null,

    init: function() {
      this.$app = $('#app-container');
      this.bindEvents();
    },

    bindEvents: function() {
      // Global event delegation
      $(document).on('click', '[data-action]', (e) => {
        const action = $(e.currentTarget).data('action');
        const id = $(e.currentTarget).data('id');
        if (this.actions[action]) {
          this.actions[action](id, e.currentTarget);
        }
      });
    },

    actions: {
      navigate: (view) => window.App.UI.render(view),
      
      createList: () => {
        const newList = {
          id: window.App.Helpers.generateId(),
          title: 'My New Wishlist',
          description: 'Things I would love to have...',
          theme: 'emerald',
          cashFund: { enabled: false, platform: '', handle: '' },
          items: [],
          createdAt: new Date().toISOString()
        };
        window.App.Storage.saveList(newList);
        window.App.UI.loadListEditor(newList.id);
      },

      editList: (id) => window.App.UI.loadListEditor(id),
      
      deleteList: (id) => {
        if(confirm('Are you sure you want to delete this list?')) {
          window.App.Storage.deleteList(id);
          window.App.UI.render('dashboard');
          window.App.UI.showToast('List deleted');
        }
      },

      addItem: () => {
        const item = {
          id: window.App.Helpers.generateId(),
          name: '',
          price: '',
          url: '',
          note: '',
        };
        window.App.UI.currentList.items.push(item);
        window.App.UI.renderItems(window.App.UI.currentList.items);
      },

      saveList: () => {
        // Gather data from inputs
        const list = window.App.UI.currentList;
        list.title = $('#list-title').val() || 'Untitled List';
        list.description = $('#list-desc').val();
        list.theme = $('input[name="theme"]:checked').val() || 'emerald';
        
        // Cash fund
        list.cashFund.enabled = $('#cash-fund-toggle').is(':checked');
        list.cashFund.platform = $('#cash-platform').val();
        list.cashFund.handle = $('#cash-handle').val();

        // Items are updated live in the array via input events, but let's ensure we clean them
        // (The input handlers update the currentList state directly)
        
        window.App.Storage.saveList(list);
        window.App.UI.showToast('Wishlist saved successfully!');
        window.App.UI.render('dashboard');
      },

      shareList: (id) => {
        let data = window.App.UI.currentList;
        // If called via dashboard button with an ID, fetch that list
        if (id && typeof id === 'string') {
           const found = window.App.Storage.getList(id);
           if(found) data = found;
        }
        if (!data) return;
        // Create a shareable URL
        const encoded = window.App.Helpers.encodeData(data);
        const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
        
        window.App.Helpers.copyToClipboard(url).then(() => {
          window.App.UI.showToast('Link copied to clipboard!');
        }).catch(() => {
          prompt('Copy this link to share:', url);
        });
      },
      
      openAI: () => {
          $('#ai-modal').removeClass('hidden');
          if (!window.AppLLM.ready) {
              // Auto load if not ready
              window.App.UI.initAI();
          }
      },
      
      closeAI: () => $('#ai-modal').addClass('hidden'),
      
      triggerAISuggest: async () => {
          const prompt = $('#ai-prompt').val();
          if(!prompt) return;
          
          $('#ai-results').html('<div class="animate-pulse p-4 bg-gray-50 rounded">AI is thinking... <span id="ai-progress">0%</span></div>');
          $('#btn-ask-ai').prop('disabled', true);
          
          try {
            if (!window.AppLLM.ready) {
                await window.AppLLM.load(null, (p) => $('#ai-progress').text(p + '%'));
            }
            
            $('#ai-results').html('<div class="p-4 bg-gray-50 rounded whitespace-pre-wrap font-mono text-sm"></div>');
            const $out = $('#ai-results').find('div');
            
            let fullText = '';
            await window.AppLLM.generate(prompt, {
                system: 'You are a helpful shopping assistant. Suggest 3-5 specific gift items based on the user request. Format as a bulleted list. Keep it brief.',
                onToken: (t) => {
                    fullText += t;
                    $out.text(fullText);
                }
            });
            
             $('#btn-ask-ai').prop('disabled', false);
             
             // Add "Add to list" buttons for lines that look like items?
             // For now, just let user copy paste or read.
             $out.append('<br><br><span class="text-xs text-gray-500">Tip: Copy items above and paste them into your list!</span>');
             
          } catch (e) {
              $('#ai-results').html(`<div class="text-red-500">Error: ${e.message}</div>`);
              $('#btn-ask-ai').prop('disabled', false);
          }
      }
    },

    render: function(view) {
      if (view === 'dashboard') {
        this.currentView = 'dashboard';
        this.renderDashboard();
      }
    },

    // Renderers
    loadListEditor: function(listId) {
      this.currentView = 'editor';
      this.currentList = window.App.Storage.getList(listId);
      this.renderEditor();
    },

    loadGuestView: function(listData) {
      this.currentView = 'guest';
      this.currentList = listData;
      this.isGuest = true;
      this.renderGuestView();
    },

    renderDashboard: function() {
      const lists = window.App.Storage.getAllLists();
      const emptyState = `
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div class="bg-emerald-100 p-6 rounded-full mb-6">
            <i class="fas fa-gift text-4xl text-emerald-600"></i>
          </div>
          <h2 class="text-2xl font-bold text-gray-800 mb-2">No wishlists yet</h2>
          <p class="text-gray-500 mb-8 max-w-md">Create your first wishlist to start collecting dreams and sharing them with friends.</p>
          <button data-action="createList" class="btn-primary">
            <i class="fas fa-plus mr-2"></i> Create New Wishlist
          </button>
        </div>
      `;

      const listGrid = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${lists.map(list => `
            <div class="group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all relative">
              <div class="absolute top-4 right-4 z-10">
                <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 backdrop-blur rounded-lg shadow-sm border border-gray-100 p-1">
                  <button data-action="shareList" data-id="${list.id}" class="text-gray-400 hover:text-blue-500 p-1.5 rounded hover:bg-blue-50" title="Share"><i class="fas fa-share-alt"></i></button>
                  <button data-action="editList" data-id="${list.id}" class="text-gray-400 hover:text-emerald-600 p-1.5 rounded hover:bg-emerald-50" title="Edit"><i class="fas fa-pen"></i></button>
                  <button data-action="deleteList" data-id="${list.id}" class="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
              </div>
              <div class="mb-4 pr-8">
                <h3 class="text-xl font-bold text-gray-800 truncate">${list.title}</h3>
                <p class="text-gray-500 text-sm mt-2 line-clamp-2 h-10">${list.description || 'No description provided.'}</p>
              </div>
              <div class="flex justify-between items-center text-sm border-t border-gray-50 pt-4">
                <span class="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">${list.items.length} Items</span>
                <span class="text-gray-400 text-xs">${new Date(list.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="fixed bottom-8 right-8">
           <button data-action="createList" class="w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 flex items-center justify-center text-xl transition-transform hover:scale-110">
             <i class="fas fa-plus"></i>
           </button>
        </div>
      `;

      this.$app.html(`
        <div class="max-w-6xl mx-auto px-4 py-8">
           <header class="flex justify-between items-center mb-10">
             <div class="flex items-center gap-3">
                <img src="logo.svg" class="w-10 h-10" alt="Logo">
                <h1 class="text-2xl font-bold text-gray-900">My Wishlists</h1>
             </div>
           </header>
           ${lists.length === 0 ? emptyState : listGrid}
        </div>
      `);
    },

    renderEditor: function() {
      const l = this.currentList;
      this.$app.html(`
        <div class="max-w-4xl mx-auto px-4 py-8">
          <div class="flex justify-between items-center mb-6">
              <button data-action="shareList" data-id="${l.id}" class="text-gray-600 font-medium px-4 py-2 hover:bg-gray-100 rounded-lg">
               <i class="fas fa-arrow-left"></i> Back
            </button>
            <div class="flex gap-3">
              <button data-action="openAI" class="text-emerald-600 font-medium px-4 py-2 hover:bg-emerald-50 rounded-lg">
                <i class="fas fa-sparkles mr-1"></i> AI Assistant
              </button>
              <button data-action="shareList" class="text-gray-600 font-medium px-4 py-2 hover:bg-gray-100 rounded-lg">
                <i class="fas fa-share-alt mr-1"></i> Share
              </button>
              <button data-action="saveList" class="btn-primary shadow-lg hover:shadow-emerald-500/30">
                <i class="fas fa-save mr-2"></i> Save Changes
              </button>
            </div>
          </div>

          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
            <div class="grid gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">List Title</label>
                <input type="text" id="list-title" value="${l.title}" class="w-full text-2xl font-bold border-b-2 border-gray-200 focus:border-emerald-500 outline-none py-2 transition-colors placeholder-gray-300" placeholder="Enter title...">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea id="list-desc" class="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" rows="2" placeholder="What is this list for?">${l.description}</textarea>
              </div>
              
              <div class="grid md:grid-cols-2 gap-6">
                 <div>
                   <label class="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                   <div class="flex gap-3">
                     <label class="cursor-pointer">
                       <input type="radio" name="theme" value="emerald" class="peer sr-only" ${l.theme === 'emerald' ? 'checked' : ''}>
                       <div class="px-4 py-2 rounded-lg border border-gray-200 peer-checked:bg-emerald-50 peer-checked:border-emerald-500 peer-checked:text-emerald-700 hover:bg-gray-50 transition-all">Classic</div>
                     </label>
                     <label class="cursor-pointer">
                       <input type="radio" name="theme" value="birthday" class="peer sr-only" ${l.theme === 'birthday' ? 'checked' : ''}>
                       <div class="px-4 py-2 rounded-lg border border-gray-200 peer-checked:bg-pink-50 peer-checked:border-pink-500 peer-checked:text-pink-700 hover:bg-gray-50 transition-all">Birthday</div>
                     </label>
                     <label class="cursor-pointer">
                       <input type="radio" name="theme" value="wedding" class="peer sr-only" ${l.theme === 'wedding' ? 'checked' : ''}>
                       <div class="px-4 py-2 rounded-lg border border-gray-200 peer-checked:bg-blue-50 peer-checked:border-blue-500 peer-checked:text-blue-700 hover:bg-gray-50 transition-all">Wedding</div>
                     </label>
                   </div>
                 </div>
                 
                 <div class="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                    <div class="flex items-center justify-between mb-2">
                       <span class="font-medium text-yellow-800 flex items-center gap-2"><i class="fas fa-coins"></i> Cash Fund</span>
                       <label class="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" id="cash-fund-toggle" class="sr-only peer" ${l.cashFund.enabled ? 'checked' : ''}>
                          <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                        </label>
                    </div>
                    <div class="${l.cashFund.enabled ? '' : 'hidden'}" id="cash-details">
                      <div class="grid grid-cols-2 gap-2">
                        <select id="cash-platform" class="text-sm border rounded p-1">
                           <option value="venmo" ${l.cashFund.platform === 'venmo' ? 'selected' : ''}>Venmo</option>
                           <option value="paypal" ${l.cashFund.platform === 'paypal' ? 'selected' : ''}>PayPal</option>
                           <option value="cashapp" ${l.cashFund.platform === 'cashapp' ? 'selected' : ''}>CashApp</option>
                        </select>
                        <input type="text" id="cash-handle" value="${l.cashFund.handle}" placeholder="@username" class="text-sm border rounded p-1">
                      </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>

          <div class="flex justify-between items-end mb-4">
            <h2 class="text-xl font-bold text-gray-800">Items</h2>
            <button data-action="addItem" class="text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
              <i class="fas fa-plus mr-1"></i> Add Item
            </button>
          </div>
          
          <div id="items-container" class="space-y-4 mb-20">
             <!-- Items injected here -->
          </div>
        </div>

        <!-- AI Modal -->
        <div id="ai-modal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 hidden">
           <div class="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl transform transition-all m-4">
              <div class="flex justify-between items-center mb-4">
                 <h3 class="text-lg font-bold flex items-center gap-2"><i class="fas fa-sparkles text-emerald-500"></i> AI Gift Ideas</h3>
                 <button data-action="closeAI" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
              </div>
              <p class="text-sm text-gray-600 mb-4">Describe who this list is for (e.g., "A 30-year-old who loves camping and coffee") and the AI will suggest items.</p>
              <textarea id="ai-prompt" class="w-full border border-gray-200 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-emerald-500/20 outline-none" rows="3" placeholder="Describe interests..."></textarea>
              <div id="ai-results" class="mb-4 max-h-40 overflow-y-auto"></div>
              <div class="flex justify-end gap-3">
                 <button data-action="closeAI" class="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                 <button id="btn-ask-ai" data-action="triggerAISuggest" class="btn-primary">Get Suggestions</button>
              </div>
           </div>
        </div>
      `);
      
      // Setup logic for dynamic UI
      this.renderItems(l.items);
      
      $('#cash-fund-toggle').on('change', function() {
         if(this.checked) $('#cash-details').removeClass('hidden');
         else $('#cash-details').addClass('hidden');
      });
    },

    renderItems: function(items) {
      const $container = $('#items-container');
      if(items.length === 0) {
        $container.html(`
           <div class="text-center py-10 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
             <p class="text-gray-400 mb-2">No items yet.</p>
             <button data-action="addItem" class="text-emerald-600 font-medium hover:underline">Add your first item</button>
           </div>
        `);
        return;
      }
      
      $container.html(items.map((item, index) => `
         <div class="group bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <input type="text" class="w-full font-bold text-gray-800 border-none p-0 focus:ring-0 placeholder-gray-300" placeholder="Item Name" value="${item.name}" onchange="window.App.UI.updateItem(${index}, 'name', this.value)">
                  <input type="text" class="w-full text-sm text-gray-500 border-none p-0 focus:ring-0 mt-1 placeholder-gray-300" placeholder="http://link-to-item.com" value="${item.url}" onchange="window.App.UI.updateItem(${index}, 'url', this.value)">
               </div>
               <div>
                  <div class="relative">
                     <span class="absolute left-0 top-0 text-gray-400">$</span>
                     <input type="number" class="w-full pl-4 border-none p-0 focus:ring-0 text-gray-700 placeholder-gray-300" placeholder="0.00" value="${item.price}" onchange="window.App.UI.updateItem(${index}, 'price', this.value)">
                  </div>
                  <input type="text" class="w-full text-sm text-gray-500 border-none p-0 focus:ring-0 mt-1 placeholder-gray-300" placeholder="Note (e.g. Size M, Blue)" value="${item.note}" onchange="window.App.UI.updateItem(${index}, 'note', this.value)">
               </div>
            </div>
            <button onclick="window.App.UI.deleteItem(${index})" class="text-gray-300 hover:text-red-500 self-center p-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <i class="fas fa-times"></i>
            </button>
         </div>
      `).join(''));
    },

    updateItem: function(index, field, value) {
      this.currentList.items[index][field] = value;
    },

    deleteItem: function(index) {
      this.currentList.items.splice(index, 1);
      this.renderItems(this.currentList.items);
    },

    renderGuestView: function() {
      const l = this.currentList;
      const themeColors = l.theme === 'birthday' ? 'bg-pink-600' : l.theme === 'wedding' ? 'bg-blue-600' : 'bg-emerald-600';
      const themeLight = l.theme === 'birthday' ? 'bg-pink-50' : l.theme === 'wedding' ? 'bg-blue-50' : 'bg-emerald-50';
      
      this.$app.html(`
        <div class="min-h-screen ${themeLight}">
           <div class="${themeColors} h-40 w-full relative overflow-hidden">
              <div class="absolute inset-0 bg-black/10"></div>
              <div class="max-w-4xl mx-auto px-4 h-full flex items-center relative z-10">
                 <a href="index.html" class="text-white/80 hover:text-white flex items-center gap-2 text-sm font-medium absolute top-4 left-4">
                    <i class="fas fa-arrow-left"></i> Wishflow
                 </a>
                 <div class="text-white">
                    <h1 class="text-3xl md:text-4xl font-bold mb-2">${l.title}</h1>
                    <p class="text-white/90 max-w-2xl">${l.description || ''}</p>
                 </div>
              </div>
           </div>
           
           <div class="max-w-4xl mx-auto px-4 -mt-10 relative z-20 pb-20">
              ${l.cashFund && l.cashFund.enabled ? `
                 <div class="bg-white rounded-xl shadow-lg p-6 mb-6 border-l-4 border-yellow-400 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                       <h3 class="font-bold text-gray-800 text-lg"><i class="fas fa-gift text-yellow-500 mr-2"></i> Cash Fund</h3>
                       <p class="text-gray-600 text-sm">The owner also accepts cash gifts via <strong>${l.cashFund.platform}</strong>.</p>
                    </div>
                    <div class="bg-gray-100 px-4 py-2 rounded-lg font-mono text-gray-800 select-all">
                       ${l.cashFund.handle}
                    </div>
                 </div>
              ` : ''}
           
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                 ${l.items.map((item, idx) => {
                   const isClaimed = window.localStorage.getItem(`claim_${l.id}_${idx}`);
                   return `
                   <div class="bg-white rounded-xl shadow-sm p-5 border border-white hover:border-gray-200 transition-all">
                      <div class="flex justify-between items-start mb-2">
                         <h3 class="font-bold text-lg text-gray-800">${item.name}</h3>
                         ${item.price ? `<span class="font-medium text-gray-500">$${item.price}</span>` : ''}
                      </div>
                      ${item.note ? `<p class="text-gray-500 text-sm mb-3 bg-gray-50 p-2 rounded">${item.note}</p>` : ''}
                      <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                         ${item.url ? `<a href="${item.url}" target="_blank" class="text-sm text-blue-600 hover:underline flex items-center gap-1"><i class="fas fa-external-link-alt"></i> View Item</a>` : '<span></span>'}
                         <button onclick="window.App.UI.toggleClaim('${l.id}', ${idx}, this)" 
                            class="px-4 py-2 rounded-lg text-sm font-medium transition-all ${isClaimed ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700'}">
                            ${isClaimed ? '<i class="fas fa-check mr-1"></i> Purchased' : 'Mark as Purchased'}
                         </button>
                      </div>
                   </div>
                 `}).join('')}
              </div>
              
              ${l.items.length === 0 ? '<div class="text-center py-10 text-gray-400">This list is empty.</div>' : ''}
           </div>
        </div>
      `);
    },

    toggleClaim: function(listId, itemIdx, btn) {
       const key = `claim_${listId}_${itemIdx}`;
       const isClaimed = window.localStorage.getItem(key);
       
       if(isClaimed) {
          window.localStorage.removeItem(key);
          $(btn).removeClass('bg-gray-800 text-white').addClass('bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700').html('Mark as Purchased');
       } else {
          window.localStorage.setItem(key, 'true');
          $(btn).removeClass('bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700').addClass('bg-gray-800 text-white').html('<i class="fas fa-check mr-1"></i> Purchased');
          window.App.UI.showToast('Marked as purchased! Only you can see this status.');
       }
    },

    showToast: function(msg) {
       const toast = $(`<div class="fixed bottom-5 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300"><i class="fas fa-info-circle"></i> ${msg}</div>`);
       $('body').append(toast);
       setTimeout(() => {
          toast.addClass('animate-out fade-out slide-out-to-bottom-5 duration-300');
          setTimeout(() => toast.remove(), 300);
       }, 3000);
    },
    
    initAI: function() {
        // Just a placeholder to show we're ready
    }
  };

  window.App.UI = UI;
})();