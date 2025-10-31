document.addEventListener("DOMContentLoaded", () => {
  const chatWindow = document.getElementById("chatWindow");
  const chatForm = document.getElementById("chatForm");
  const queryText = document.getElementById("queryText");
  const queryBtn = document.getElementById("queryBtn");
  const queryStatus = document.getElementById("queryStatus");
  const newChatSidebar = document.getElementById("newChatSidebar");
  const historyList = document.getElementById("historyList");
  const sidebar = document.getElementById("sidebar");
  const toggleSidebar = document.getElementById("toggleSidebar");
  const showSidebar = document.getElementById("showSidebar");
  const showSidebarDesktop = document.getElementById("showSidebarDesktop");
  const closeSidebar = document.getElementById("closeSidebar");
  const overlay = document.getElementById("overlay");
  const infoBtn = document.getElementById("infoBtn");
  const infoModal = document.getElementById("infoModal");
  const closeInfoModal = document.getElementById("closeInfoModal");

  // Info modal handlers
  if (infoBtn && infoModal && closeInfoModal) {
    infoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("Info button clicked");
      infoModal.classList.remove("hidden");
    });

    closeInfoModal.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      infoModal.classList.add("hidden");
    });

    infoModal.addEventListener("click", (e) => {
      if (e.target === infoModal) {
        infoModal.classList.add("hidden");
      }
    });
  } else {
    console.error("Info modal elements not found:", { infoBtn, infoModal, closeInfoModal });
  }

  // Manage multiple chat sessions
  let sessions = JSON.parse(localStorage.getItem("chatSessions")) || [];
  let currentSessionId = localStorage.getItem("currentSessionId") || null;

  // If no sessions exist, create a new one
  if (sessions.length === 0) {
    createNewSession();
  } else if (
    !currentSessionId ||
    !sessions.find((s) => s.id === currentSessionId)
  ) {
    currentSessionId = sessions[0].id;
    localStorage.setItem("currentSessionId", currentSessionId);
  }

  function createNewSession() {
    const newSession = {
      id: Date.now().toString(),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
    };
    sessions.unshift(newSession);
    currentSessionId = newSession.id;
    saveSessions();
    renderHistoryList();
    renderChat();
  }

  function saveSessions() {
    localStorage.setItem("chatSessions", JSON.stringify(sessions));
    localStorage.setItem("currentSessionId", currentSessionId);
  }

  function getCurrentSession() {
    return sessions.find((s) => s.id === currentSessionId);
  }

  function updateSessionTitle(sessionId) {
    const session = sessions.find((s) => s.id === sessionId);
    if (session && session.messages.length > 0) {
      const firstUserMsg = session.messages.find((m) => m.role === "user");
      if (firstUserMsg) {
        session.title =
          firstUserMsg.text.slice(0, 30) +
          (firstUserMsg.text.length > 30 ? "..." : "");
      }
    }
  }

  function deleteSession(sessionId) {
    sessions = sessions.filter((s) => s.id !== sessionId);
    if (currentSessionId === sessionId) {
      if (sessions.length > 0) {
        currentSessionId = sessions[0].id;
      } else {
        createNewSession();
        return;
      }
    }
    saveSessions();
    renderHistoryList();
    renderChat();
  }

  function renderHistoryList() {
    historyList.innerHTML = "";
    sessions.forEach((session) => {
      const item = document.createElement("div");
      item.className = `group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        session.id === currentSessionId
          ? "bg-[#2f2f2f]"
          : "hover:bg-[#2f2f2f]"
      }`;

      const titleSpan = document.createElement("span");
      titleSpan.className = "text-sm text-gray-200 truncate flex-1";
      titleSpan.textContent = session.title;
      titleSpan.onclick = () => {
        currentSessionId = session.id;
        saveSessions();
        renderHistoryList();
        renderChat();
      };

      const deleteBtn = document.createElement("button");
      deleteBtn.className =
        "ml-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-[#3f3f3f] rounded transition-opacity";
      deleteBtn.innerHTML = `<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>`;
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm("Delete this chat?")) {
          deleteSession(session.id);
        }
      };

      item.appendChild(titleSpan);
      item.appendChild(deleteBtn);
      historyList.appendChild(item);
    });
  }

  // Function to handle copying text
  function handleCopy(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setStatus("Copied to clipboard!", false);
        // Clear status after a short delay
        setTimeout(() => setStatus(""), 2000);
      })
      .catch((err) => {
        setStatus("Failed to copy text.", true);
        console.error("Copy failed", err);
      });
  }

  function renderChat() {
    chatWindow.innerHTML = "";
    const session = getCurrentSession();

    if (!session || session.messages.length === 0) {
      // Random welcome messages
      const welcomeMessages = [
      
        "Ask me anything about CSEC!",
        "What do you know about CSEC?",
        "Curious about CSEC-ASTU?",
        "Let's talk about CSEC!",
        "What would you like to know about CSEC?",
        "Ready to explore CSEC together?",
        "Ask me about the Computer Science and Engineering Club!"
      ];
      const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
      
      const welcomeDiv = document.createElement("div");
      welcomeDiv.className = "flex flex-col items-center justify-center h-full";
      welcomeDiv.innerHTML = `
        <div class="text-center">
          <h1 class="text-4xl font-semibold text-gray-200 mb-8">${randomMessage}</h1>
        </div>
      `;
      chatWindow.appendChild(welcomeDiv);
      return;
    }

    session.messages.forEach((msg) => {
      const isUser = msg.role === "user";

      // Container for the message
      const messageWrapper = document.createElement("div");
      messageWrapper.className = "w-full bg-[#212121] py-8 border-b border-[#2f2f2f]";

      const messageContainer = document.createElement("div");
      messageContainer.className = "max-w-3xl mx-auto px-4 group relative";

      const messageContent = document.createElement("div");
      // User messages on right, bot messages on left
      messageContent.className = isUser ? "flex justify-end" : "flex justify-start";

      // Message text container
      const textContainer = document.createElement("div");
      textContainer.className = isUser ? "space-y-2 overflow-hidden max-w-2xl" : "space-y-2 overflow-hidden max-w-2xl";

      const bubble = document.createElement("div");
      bubble.className = `text-gray-100 leading-relaxed ${msg.isThinking ? "animate-pulse" : ""}`;
      bubble.style.whiteSpace = "pre-wrap";
      
      // Add typing indicator dots for thinking messages
      if (msg.isThinking) {
        bubble.innerHTML = `
          <span class="flex gap-1 items-center">
            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
          </span>
        `;
      } else {
        // Render Markdown for bot messages; keep user messages as plain text
        if (!isUser && window.marked && window.DOMPurify) {
          try {
            const html = window.DOMPurify.sanitize(window.marked.parse(msg.text || ""));
            bubble.innerHTML = html;
          } catch (_) {
            bubble.textContent = msg.text;
          }
        } else {
          bubble.textContent = msg.text;
        }
      }

      textContainer.appendChild(bubble);

      // Action buttons (for all messages except thinking)
      if (!msg.isThinking) {
        const actionsContainer = document.createElement("div");
        actionsContainer.className = "flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity";

        // Copy button (for all messages)
        const copyBtn = document.createElement("button");
        copyBtn.className = "p-1.5 rounded-lg text-gray-400 hover:bg-[#3f3f3f] hover:text-gray-200 transition-colors";
        copyBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
        `;
        copyBtn.onclick = () => handleCopy(msg.text);

        actionsContainer.appendChild(copyBtn);

        // Retry button (only for bot messages)
        if (!isUser) {
          const retryBtn = document.createElement("button");
          retryBtn.className = "p-1.5 rounded-lg text-gray-400 hover:bg-[#3f3f3f] hover:text-gray-200 transition-colors";
          retryBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          `;
          retryBtn.onclick = () => {
            // Find the last user message before this bot message
            const session = getCurrentSession();
            const idx = session.messages.findIndex(m => m === msg);
            let lastUserMsg = null;
            for (let i = idx - 1; i >= 0; i--) {
              if (session.messages[i].role === "user") {
                lastUserMsg = session.messages[i].text;
                break;
              }
            }
            if (lastUserMsg) {
              // Remove all messages after last user message
              session.messages = session.messages.slice(0, idx);
              saveSessions();
              renderChat();
              // Re-send last user message
              queryText.value = lastUserMsg;
              chatForm.dispatchEvent(new Event("submit"));
            }
          };
          actionsContainer.appendChild(retryBtn);
        }

        textContainer.appendChild(actionsContainer);
      }

      // Add text container directly to message content (no avatar)
      messageContent.appendChild(textContainer);
      
      messageContainer.appendChild(messageContent);
      messageWrapper.appendChild(messageContainer);
      chatWindow.appendChild(messageWrapper);
    });

    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function setStatus(text, isError = false) {
    queryStatus.textContent = text;
    queryStatus.className = `text-xs mt-2 h-4 ${
      isError ? "text-red-400" : "text-gray-400" // Adjusted error color for dark theme
    }`;
  }

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const query = queryText.value.trim();
    if (!query) {
      setStatus("Please enter a question.", true);
      return;
    }

    queryBtn.disabled = true;
    queryText.disabled = true;

    const session = getCurrentSession();

    // Add user message
    session.messages.push({ role: "user", text: query });
    updateSessionTitle(currentSessionId);
    saveSessions();
    renderHistoryList();
    renderChat();
    queryText.value = "";

    // Add "Thinking..." placeholder message
    const thinkingMessageId = Date.now().toString();
    session.messages.push({ 
      role: "bot", 
      text: "Thinking...", 
      isThinking: true,
      id: thinkingMessageId 
    });
    renderChat();

    try {
      const res = await fetch("/api/embeddings/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      // Remove thinking message
      session.messages = session.messages.filter(m => m.id !== thinkingMessageId);

      if (!res.ok) {
        let errorMessage = "Sorry, I'm having trouble connecting to the server. Please try again.";
        
        if (res.status === 429) {
          errorMessage = "I'm getting too many requests right now. Please wait a moment and try again.";
        } else if (res.status === 500) {
          errorMessage = "Oops! Something went wrong on my end. Please try again in a moment.";
        } else if (res.status === 400) {
          errorMessage = "I didn't quite understand that request. Could you try rephrasing your question?";
        } else if (res.status >= 500) {
          errorMessage = "The server is currently unavailable. Please try again in a few minutes.";
        }
        
        session.messages.push({ role: "bot", text: errorMessage });
        saveSessions();
        renderChat();
        setStatus("", false);
        return;
      }

      const data = await res.json();
      const answer = data.answer || "I couldn't generate an answer. Please try asking in a different way.";

      // Add bot response
      session.messages.push({ role: "bot", text: answer });
      saveSessions();
      renderChat();
      setStatus("");
    } catch (err) {
      console.error("Query error:", err);
      
      // Remove thinking message if still there
      session.messages = session.messages.filter(m => m.id !== thinkingMessageId);
      
      // User-friendly error messages
      let userFriendlyError = "I'm having trouble connecting right now. Please check your internet connection and try again.";
      
      if (err.message.includes("Failed to fetch")) {
        userFriendlyError = "I can't reach the server right now. Please make sure you're connected to the internet and try again.";
      } else if (err.message.includes("timeout")) {
        userFriendlyError = "The request took too long. Please try again.";
      } else if (err.message.includes("NetworkError")) {
        userFriendlyError = "Network error. Please check your connection and try again.";
      }
      
      session.messages.push({ role: "bot", text: userFriendlyError });
      saveSessions();
      renderChat();
      setStatus("", false);
    } finally {
      queryBtn.disabled = false;
      queryText.disabled = false;
      queryText.focus();
    }
  });

  newChatSidebar.addEventListener("click", () => {
    createNewSession();
    queryText.focus();
  });

  // Sidebar toggle for mobile (hamburger menu)
  showSidebar.addEventListener("click", () => {
    sidebar.classList.remove("-translate-x-full");
    overlay.classList.remove("hidden");
  });

  closeSidebar.addEventListener("click", () => {
    sidebar.classList.add("-translate-x-full");
    overlay.classList.add("hidden");
  });

  overlay.addEventListener("click", () => {
    sidebar.classList.add("-translate-x-full");
    overlay.classList.add("hidden");
  });

  // Sidebar toggle for desktop (collapse/expand)
  if (toggleSidebar) {
    toggleSidebar.addEventListener("click", () => {
      sidebar.classList.add("-translate-x-full");
      sidebar.classList.add("lg:-translate-x-full");
      showSidebarDesktop.classList.remove("hidden");
    });
  }

  showSidebarDesktop.addEventListener("click", () => {
    sidebar.classList.remove("-translate-x-full");
    sidebar.classList.remove("lg:-translate-x-full");
    showSidebarDesktop.classList.add("hidden");
  });

  // Keep sidebar visible by default on desktop
  if (window.innerWidth >= 1024) {
    sidebar.classList.remove("-translate-x-full");
    sidebar.classList.remove("lg:-translate-x-full");
    showSidebarDesktop.classList.add("hidden");
  }

  // Close mobile sidebar when selecting a chat
  historyList.addEventListener("click", (e) => {
    if (window.innerWidth < 1024) {
      sidebar.classList.add("-translate-x-full");
      overlay.classList.add("hidden");
    }
  });

  // Initial render
  renderHistoryList();
  renderChat();
});
