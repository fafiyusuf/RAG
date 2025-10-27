document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // --- Navigation ---
  const navChat = $('navChat');
  const navEmbed = $('navEmbed');
  const chatPage = $('chatPage');
  const embedPage = $('embedPage');

  // MODIFIED: Classes for dark theme nav
  const activeClasses = ['border-indigo-400', 'text-indigo-400'];
  const inactiveClasses = ['border-transparent', 'text-gray-400'];

  function showPage(page) {
    if (page === 'chat') {
      chatPage.classList.remove('hidden');
      embedPage.classList.add('hidden');
      navChat.classList.add(...activeClasses);
      navChat.classList.remove(...inactiveClasses);
      navEmbed.classList.add(...inactiveClasses);
      navEmbed.classList.remove(...activeClasses);
    } else {
      chatPage.classList.add('hidden');
      embedPage.classList.remove('hidden');
      navEmbed.classList.add(...activeClasses);
      navEmbed.classList.remove(...inactiveClasses);
      navChat.classList.add(...inactiveClasses);
      navChat.classList.remove(...activeClasses);
    }
  }

  navChat.addEventListener('click', () => showPage('chat'));
  navEmbed.addEventListener('click', () => showPage('embed'));

  // --- Helpers ---
  function setStatus(el, text, type = 'loading') {
    if (!el) return;
    el.textContent = text || '';
    if (type === 'error') {
      el.classList.add('text-red-500'); // Made error a bit brighter
      el.classList.remove('text-gray-500');
    } else {
      el.classList.add('text-gray-500');
      el.classList.remove('text-red-500');
    }
  }
  function show(el) {
    if (!el) return;
    el.classList.remove('hidden');
  }
  function hide(el) {
    if (!el) return;
    el.classList.add('hidden');
  }
  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed: ${res.status}`);
    }
    return res.json();
  }

  // --- Embed page logic ---
  const addBtn = $('addBtn');
  const addStatus = $('addStatus');
  const addResult = $('addResult');
  const docText = $('docText');

  if (addBtn) {
    addBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const textVal = (docText && docText.value ? docText.value : '').trim();
      if (!textVal) {
        setStatus(addStatus, 'Please enter some text.', 'error');
        return;
      }
      setStatus(addStatus, 'Embedding…', 'loading');
      hide(addResult);
      addBtn.disabled = true;

      try {
        await postJSON('/api/embeddings/add', { text: textVal });
        setStatus(addStatus, '');
        show(addResult);
        docText.value = '';
      } catch (err) {
        console.error(err);
        setStatus(addStatus, `Error: ${err.message}`, 'error');
      } finally {
        addBtn.disabled = false;
      }
    });
  }

  // --- Chatbot logic ---
  const chatWindow = $('chatWindow');
  const chatForm = $('chatForm');
  const queryText = $('queryText');
  const queryBtn = $('queryBtn');
  const queryStatus = $('queryStatus');
  const newChatBtn = $('newChatBtn'); 

  let chatHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];

  if (!chatForm || !queryBtn || !queryText || !chatWindow) {
    console.error('Chat elements not found. Check IDs in HTML.');
    return;
  }
  
  if (queryText) {
    queryText.addEventListener('input', () => {
      queryText.style.height = 'auto';
      queryText.style.height = `${queryText.scrollHeight}px`;
    });
  }

  function saveChatHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  }

  function renderChat() {
    chatWindow.innerHTML = '';
    for (const msg of chatHistory) {
      const div = document.createElement('div');
      
      // *** THIS IS THE ONLY FUNCTIONAL LINE THAT CHANGED ***
      div.className =
        msg.role === 'user'
          ? 'self-end bg-indigo-600 text-white rounded-lg px-4 py-2 max-w-xs ml-auto break-words' // User bubble
          : 'self-start bg-gray-700 text-gray-100 rounded-lg px-4 py-2 max-w-xs mr-auto break-words'; // Bot bubble
          
      div.textContent = msg.text;
      chatWindow.appendChild(div);
    }
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const q = queryText.value.trim();
      if (!q) {
        setStatus(queryStatus, 'Please enter a question.', 'error');
        return;
      }
      setStatus(queryStatus, 'Thinking…', 'loading');
      queryBtn.disabled = true;

      chatHistory.push({ role: 'user', text: q });
      saveChatHistory(); 
      renderChat();
      queryText.value = '';
      queryText.style.height = 'auto';

      try {
        const data = await postJSON('/api/embeddings/query', { query: q });
        const answer = (data && data.answer) ? data.answer : 'No answer returned.';
        chatHistory.push({ role: 'bot', text: answer });
      } catch (err) {
        console.error('Query error:', err);
        chatHistory.push({ role: 'bot', text: `Error: ${err.message}` });
        setStatus(queryStatus, `Error: ${err.message}`, 'error');
      } finally {
        saveChatHistory(); 
        
        if (!queryStatus.textContent.startsWith('Error:')) {
          setStatus(queryStatus, '');
        }
        queryBtn.disabled = false;
        renderChat(); 
      }
    });
  }

  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      chatHistory = [];
      saveChatHistory();
      renderChat();
      setStatus(queryStatus, '');
    });
  }

  // Start on chatbot page
  showPage('chat');
  renderChat(); 
});