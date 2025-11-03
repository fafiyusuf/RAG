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
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  const showSidebar = document.getElementById("showSidebar");
  const showSidebarDesktop = document.getElementById("showSidebarDesktop");
  const closeSidebar = document.getElementById("closeSidebar");
  const overlay = document.getElementById("overlay");
  const infoBtn = document.getElementById("infoBtn");
  const infoModal = document.getElementById("infoModal");
  const closeInfoModal = document.getElementById("closeInfoModal");

  // Add delete confirmation modal to HTML
  const deleteModal = document.createElement("div");
  deleteModal.id = "deleteModal";
  deleteModal.className =
    "hidden fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4";
  deleteModal.innerHTML = `
    <div class="bg-[#2f2f2f] rounded-lg max-w-sm w-full p-6 relative">
      <h3 class="text-lg font-semibold text-gray-100 mb-4">Delete chat?</h3>
      <p class="text-gray-300 text-sm mb-6">This will permanently delete this chat.</p>
      <div class="flex justify-end gap-3">
        <button id="cancelDelete" class="px-4 py-2 text-gray-300 hover:text-gray-100 transition-colors">Cancel</button>
        <button id="confirmDelete" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(deleteModal);

  // Delete modal elements
  const cancelDeleteBtn = document.getElementById("cancelDelete");
  const confirmDeleteBtn = document.getElementById("confirmDelete");

  // Sidebar state
  let isSidebarOpen = window.innerWidth >= 1024; // Open by default on desktop
  let sessionToDelete = null;

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
    console.error("Info modal elements not found:", {
      infoBtn,
      infoModal,
      closeInfoModal,
    });
  }

  // Delete modal handlers
  if (cancelDeleteBtn && confirmDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", () => {
      deleteModal.classList.add("hidden");
      sessionToDelete = null;
    });

    confirmDeleteBtn.addEventListener("click", () => {
      if (sessionToDelete) {
        deleteSession(sessionToDelete);
        deleteModal.classList.add("hidden");
        sessionToDelete = null;
      }
    });

    deleteModal.addEventListener("click", (e) => {
      if (e.target === deleteModal) {
        deleteModal.classList.add("hidden");
        sessionToDelete = null;
      }
    });
  }

  // Manage multiple chat sessions
  let sessions = JSON.parse(localStorage.getItem("chatSessions")) || [];
  let currentSessionId = localStorage.getItem("currentSessionId");

  // FIXED: Use sessionStorage to detect if this is a fresh browser session
  const isFreshSession = !sessionStorage.getItem("hasBeenLoaded");

  if (sessions.length === 0) {
    // No sessions exist - create first session
    createNewSession();
  } else if (isFreshSession) {
    // Fresh browser/tab session - create new chat but keep history
    sessionStorage.setItem("hasBeenLoaded", "true");
    createNewSession();
  } else {
    // Page reload within same browser session - continue with current session
    if (!currentSessionId || !sessions.find((s) => s.id === currentSessionId)) {
      currentSessionId = sessions[0].id;
      saveSessions();
    }
    renderHistoryList();
    renderChat();
  }

  // Optional: Clean up old sessions to prevent storage bloat
  if (sessions.length > 20) {
    sessions = sessions.slice(0, 15); // Keep only most recent 15 sessions
    saveSessions();
  }

  function createNewSession() {
    const newSession = {
      id: Date.now().toString(),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
    };

    // Add new session to the beginning of the array
    sessions.unshift(newSession);
    currentSessionId = newSession.id;
    saveSessions();
    renderHistoryList();
    renderChat(); // This will show the welcome message for the fresh session
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
      // Always create a new session when deleting current one
      createNewSession();
      return;
    }
    saveSessions();
    renderHistoryList();
    // Don't call renderChat() here since createNewSession() already does it
  }

  function renderHistoryList() {
    historyList.innerHTML = "";
    sessions.forEach((session) => {
      const item = document.createElement("div");
      item.className = `group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        session.id === currentSessionId ? "bg-[#2f2f2f]" : "hover:bg-[#2f2f2f]"
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
        sessionToDelete = session.id;
        deleteModal.classList.remove("hidden");
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
        "Ask me about the Computer Science and Engineering Club!",
      ];
      const randomMessage =
        welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

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
      messageWrapper.className = "w-full py-4"; // Reduced padding

      const messageContainer = document.createElement("div");
      messageContainer.className = "max-w-3xl mx-auto px-4 group relative";

      const messageContent = document.createElement("div");
      // User messages on right, bot messages on left
      messageContent.className = isUser
        ? "flex justify-end"
        : "flex justify-start";

      // Message text container
      const textContainer = document.createElement("div");
      textContainer.className = isUser ? "max-w-2xl" : "max-w-2xl";

      // Chat bubble
      const bubble = document.createElement("div");
      bubble.className = `rounded-2xl px-4 py-3 leading-relaxed ${
        msg.isThinking ? "animate-pulse" : ""
      } ${
        isUser
          ? "bg-[#3f3f3f] text-white" // Gray background for user messages
          : "text-gray-100" // No background for AI messages
      }`;
      bubble.style.whiteSpace = "pre-wrap";

      // Add typing indicator for thinking messages (ChatGPT style)
      if (msg.isThinking) {
        bubble.innerHTML = `
        <div class="flex space-x-1 items-center">
          <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
          <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
          <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
        </div>
      `;
      } else {
        // Render Markdown for bot messages; keep user messages as plain text
        if (!isUser && window.marked && window.DOMPurify) {
          try {
            const html = window.DOMPurify.sanitize(
              window.marked.parse(msg.text || "")
            );
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
        actionsContainer.className = `flex items-center gap-1 mt-2 ${
          isUser ? "justify-end" : "justify-start"
        } opacity-0 group-hover:opacity-100 transition-opacity`;

        // Copy button (for all messages)
        const copyBtn = document.createElement("button");
        copyBtn.className =
          "p-1.5 rounded-lg text-gray-400 hover:bg-[#3f3f3f] hover:text-gray-200 transition-colors";
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
          retryBtn.className =
            "p-1.5 rounded-lg text-gray-400 hover:bg-[#3f3f3f] hover:text-gray-200 transition-colors";
          retryBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        `;
          retryBtn.onclick = async () => {
            const session = getCurrentSession();
            const idx = session.messages.findIndex((m) => m === msg);

            // Find the last user message before the bot message
            let lastUserIdx = -1;
            for (let i = idx - 1; i >= 0; i--) {
              if (session.messages[i].role === "user") {
                lastUserIdx = i;
                break;
              }
            }

            if (lastUserIdx !== -1) {
              const lastUserMsg = session.messages[lastUserIdx].text;

              // Remove the bot message we are retrying
              session.messages = session.messages.slice(0, lastUserIdx + 1);
              saveSessions();
              renderChat();

              // Add "Thinking..." placeholder message
              const thinkingMessageId = Date.now().toString();
              session.messages.push({
                role: "bot",
                text: "Thinking...",
                isThinking: true,
                id: thinkingMessageId,
              });
              renderChat();

              try {
                const res = await fetch("/api/embeddings/query", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ query: lastUserMsg }),
                });

                session.messages = session.messages.filter(
                  (m) => m.id !== thinkingMessageId
                );

                const data = await res.json();
                const answer =
                  data.answer ||
                  "I couldn't generate an answer. Please try asking in a different way.";

                session.messages.push({ role: "bot", text: answer });
                saveSessions();
                renderChat();
              } catch (err) {
                console.error("Retry error:", err);
                session.messages = session.messages.filter(
                  (m) => m.id !== thinkingMessageId
                );
                session.messages.push({
                  role: "bot",
                  text: "Failed to get response. Please try again.",
                });
                saveSessions();
                renderChat();
              }
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
      id: thinkingMessageId,
    });
    renderChat();

    try {
      const res = await fetch("/api/embeddings/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      // Remove thinking message
      session.messages = session.messages.filter(
        (m) => m.id !== thinkingMessageId
      );

      if (!res.ok) {
        let errorMessage =
          "Sorry, I'm having trouble connecting to the server. Please try again.";

        if (res.status === 429) {
          errorMessage =
            "I'm getting too many requests right now. Please wait a moment and try again.";
        } else if (res.status === 500) {
          errorMessage =
            "Oops! Something went wrong on my end. Please try again in a moment.";
        } else if (res.status === 400) {
          errorMessage =
            "I didn't quite understand that request. Could you try rephrasing your question?";
        } else if (res.status >= 500) {
          errorMessage =
            "The server is currently unavailable. Please try again in a few minutes.";
        }

        session.messages.push({ role: "bot", text: errorMessage });
        saveSessions();
        renderChat();
        setStatus("", false);
        return;
      }

      const data = await res.json();
      const answer =
        data.answer ||
        "I couldn't generate an answer. Please try asking in a different way.";

      // Add bot response
      session.messages.push({ role: "bot", text: answer });
      saveSessions();
      renderChat();
      setStatus("");
    } catch (err) {
      console.error("Query error:", err);

      // Remove thinking message if still there
      session.messages = session.messages.filter(
        (m) => m.id !== thinkingMessageId
      );

      // User-friendly error messages
      let userFriendlyError =
        "I'm having trouble connecting right now. Please check your internet connection and try again.";

      if (err.message.includes("Failed to fetch")) {
        userFriendlyError =
          "I can't reach the server right now. Please make sure you're connected to the internet and try again.";
      } else if (err.message.includes("timeout")) {
        userFriendlyError = "The request took too long. Please try again.";
      } else if (err.message.includes("NetworkError")) {
        userFriendlyError =
          "Network error. Please check your connection and try again.";
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

  // Toggle sidebar function
  function toggleSidebarState() {
    // Only allow toggle on mobile
    if (window.innerWidth < 1024) {
      isSidebarOpen = !isSidebarOpen;

      if (isSidebarOpen) {
        sidebar.classList.remove("-translate-x-full");
        overlay.classList.remove("hidden");
      } else {
        sidebar.classList.add("-translate-x-full");
        overlay.classList.add("hidden");
      }
    }
  }

  // Sidebar toggle button inside sidebar (mobile only)
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener("click", () => {
      if (window.innerWidth < 1024) {
        isSidebarOpen = false;
        sidebar.classList.add("-translate-x-full");
        overlay.classList.add("hidden");
      }
    });
  }

  // Sidebar toggle for mobile (hamburger menu)
  showSidebar.addEventListener("click", () => {
    isSidebarOpen = true;
    sidebar.classList.remove("-translate-x-full");
    overlay.classList.remove("hidden");
  });

  closeSidebar.addEventListener("click", () => {
    isSidebarOpen = false;
    sidebar.classList.add("-translate-x-full");
    overlay.classList.add("hidden");
  });

  overlay.addEventListener("click", () => {
    isSidebarOpen = false;
    sidebar.classList.add("-translate-x-full");
    overlay.classList.add("hidden");
  });

  // Show sidebar button (desktop, when collapsed) - removed for desktop
  showSidebarDesktop.addEventListener("click", () => {
    // Not needed for desktop anymore
  });

  // Keep sidebar visible by default on desktop, hidden on mobile
  if (window.innerWidth >= 1024) {
    isSidebarOpen = true;
    sidebar.classList.remove("-translate-x-full", "lg:-translate-x-full");
    showSidebarDesktop.classList.add("hidden");
  } else {
    isSidebarOpen = false;
    sidebar.classList.add("-translate-x-full");
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
