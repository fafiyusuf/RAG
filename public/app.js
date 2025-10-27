document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // --- Navigation ---
  const navChat = $('navChat');
  const navEmbed = $('navEmbed');
  const chatPage = $('chatPage');
  const embedPage = $('embedPage');

  // Updated navigation styling
  const activeClasses = ['border-indigo-500', 'text-indigo-700'];
  const inactiveClasses = ['border-transparent', 'text-gray-700'];

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
      el.classList.add('text-red-600');
      el.classList.remove('text-gray-500');
    } else {
      el.classList.add('text-gray-500');
      el.classList.remove('text-red-600');
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
  let chatHistory = [];

  if (!chatForm || !queryBtn || !queryText || !chatWindow) {
    console.error('Chat elements not found. Check IDs in HTML.');
    return;
  }
  
  // Auto-resize textarea
  if (queryText) {
    queryText.addEventListener('input', () => {
      queryText.style.height = 'auto'; // Reset height
      queryText.style.height = `${queryText.scrollHeight}px`; // Set to scroll height
    });
  }

  function renderChat() {
    chatWindow.innerHTML = '';
    for (const msg of chatHistory) {
      const div = document.createElement('div');
      div.className =
        msg.role === 'user'
          ? 'self-end bg-indigo-100 text-indigo-900 rounded-lg px-4 py-2 max-w-xs ml-auto break-words'
          : 'self-start bg-gray-100 text-gray-900 rounded-lg px-4 py-2 max-w-xs mr-auto break-words';
      div.textContent = msg.text;
      chatWindow.appendChild(div);
    }
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  // Handle form submission
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
      renderChat();
      queryText.value = '';
      queryText.style.height = 'auto'; // Reset textarea height

      try {
        const data = await postJSON('/api/embeddings/query', { query: q });
        const answer = (data && data.answer) ? data.answer : 'No answer returned.';
        chatHistory.push({ role: 'bot', text: answer });
      } catch (err) {
        console.error('Query error:', err);
        chatHistory.push({ role: 'bot', text: `Error: ${err.message}` });
        setStatus(queryStatus, `Error: ${err.message}`, 'error');
      } finally {
        // Clear loading status only if no error was set
        if (!queryStatus.textContent.startsWith('Error:')) {
          setStatus(queryStatus, '');
        }
        queryBtn.disabled = false;
        renderChat(); // Render final bot message or error
      }
    });
  }

  // Start on chatbot page
  showPage('chat');
});