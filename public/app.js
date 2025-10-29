document.addEventListener('DOMContentLoaded', () => {
  const chatWindow = document.getElementById('chatWindow');
  const chatForm = document.getElementById('chatForm');
  const queryText = document.getElementById('queryText');
  const queryBtn = document.getElementById('queryBtn');
  const queryStatus = document.getElementById('queryStatus');
  const newChatBtn = document.getElementById('newChatBtn');

  let chatHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];

  function setStatus(text, isError = false) {
    queryStatus.textContent = text;
    queryStatus.className = `text-xs mt-2 h-4 ${isError ? 'text-red-600' : 'text-gray-500'}`;
  }

  function saveChatHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  }

  function renderChat() {
    chatWindow.innerHTML = '';
    
    if (chatHistory.length === 0) {
      const welcomeDiv = document.createElement('div');
      welcomeDiv.className = 'text-center text-gray-400 mt-20';
      welcomeDiv.innerHTML = `
        <h2 class="text-2xl font-semibold mb-2">Ask about CSEC-ASTU</h2>
        <p class="text-sm">Ask any question about the Computer Science and Engineering Club</p>
      `;
      chatWindow.appendChild(welcomeDiv);
      return;
    }

    chatHistory.forEach((msg) => {
      const messageDiv = document.createElement('div');
      messageDiv.className = `flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`;
      
      const bubble = document.createElement('div');
      bubble.className = `max-w-[80%] px-4 py-2 rounded-lg ${
        msg.role === 'user'
          ? 'bg-gray-900 text-white'
          : 'bg-gray-100 text-gray-900'
      }`;
      bubble.style.whiteSpace = 'pre-wrap';
      bubble.textContent = msg.text;
      
      messageDiv.appendChild(bubble);
      chatWindow.appendChild(messageDiv);
    });

    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const query = queryText.value.trim();
    if (!query) {
      setStatus('Please enter a question.', true);
      return;
    }

    setStatus('Thinking...');
    queryBtn.disabled = true;
    queryText.disabled = true;

    // Add user message
    chatHistory.push({ role: 'user', text: query });
    saveChatHistory();
    renderChat();
    queryText.value = '';

    try {
      const res = await fetch('/api/embeddings/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data = await res.json();
      const answer = data.answer || 'No answer returned.';

      // Add bot response
      chatHistory.push({ role: 'bot', text: answer });
      saveChatHistory();
      renderChat();
      setStatus('');
    } catch (err) {
      console.error('Query error:', err);
      chatHistory.push({ role: 'bot', text: `Error: ${err.message}` });
      saveChatHistory();
      renderChat();
      setStatus(`Error: ${err.message}`, true);
    } finally {
      queryBtn.disabled = false;
      queryText.disabled = false;
      queryText.focus();
    }
  });

  newChatBtn.addEventListener('click', () => {
    if (chatHistory.length === 0) return;
    
    if (confirm('Start a new chat? Current conversation will be cleared.')) {
      chatHistory = [];
      saveChatHistory();
      renderChat();
      setStatus('');
      queryText.focus();
    }
  });

  // Initial render
  renderChat();
  queryText.focus();
});