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
      // Adjusted hover state for dark theme consistency
      item.className = `group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer hover:bg-gray-700 ${
        session.id === currentSessionId
          ? "bg-gray-700 border border-gray-600"
          : ""
      }`;

      const titleSpan = document.createElement("span");
      titleSpan.className = "text-sm text-gray-100 truncate flex-1";
      titleSpan.textContent = session.title;
      titleSpan.onclick = () => {
        currentSessionId = session.id;
        saveSessions();
        renderHistoryList();
        renderChat();
      };

      const deleteBtn = document.createElement("button");
      // Adjusted button colors for dark theme consistency
      deleteBtn.className =
        "ml-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-600 rounded";
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
      const welcomeDiv = document.createElement("div");
      welcomeDiv.className = "text-center text-gray-400 mt-20";
      welcomeDiv.innerHTML = `
        <h2 class="text-2xl font-semibold mb-2">Ask about CSEC-ASTU</h2>
        <p class="text-sm">Ask any question about the Computer Science and Engineering Club</p>
      `;
      chatWindow.appendChild(welcomeDiv);
      return;
    }

    session.messages.forEach((msg) => {
      const isUser = msg.role === "user";

      // The outer container for the message bubble and copy button
      // Use 'group' and 'relative' for positioning the copy button
      const messageContainer = document.createElement("div");
      messageContainer.className = `flex ${
        isUser ? "justify-end" : "justify-start"
      } group relative`;

      const messageContent = document.createElement("div");
      // Use 'max-w-prose' for readability and 'relative' for positioning the copy button
      messageContent.className = "max-w-prose relative";

      const bubble = document.createElement("div");
      // Use gray-700 for better contrast on gray-900 background
      bubble.className = `px-4 py-2 pr-10 rounded-lg ${
        // Added pr-10 for padding on the right to make room for the button area
        isUser ? "bg-gray-700 text-white" : "bg-gray-700 text-gray-100"
      }`;
      bubble.style.whiteSpace = "pre-wrap";
      bubble.textContent = msg.text;

      // Copy Button
      const copyBtn = document.createElement("button");

      // Styling for the copy button, positioned absolutely at the bottom right
      let copyBtnClasses =
        "absolute -bottom-6 text-xs right-0 p-1 rounded-md text-gray-400 hover:bg-gray-600 flex items-center space-x-1";

      if (isUser) {
        // USER message: hover-only visibility
        copyBtnClasses += ` opacity-0 transition-opacity duration-200 group-hover:opacity-100`;
      } else {
        // BOT message: always visible
        copyBtnClasses += ` opacity-100`;
      }

      copyBtn.className = copyBtnClasses;

      // Updated Icon to Document Duplicate (more visible) and added 'Copy' text
      copyBtn.innerHTML = `
        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v-4.5m-1.5 4.5h3m-3 0l-1.5 1.5m1.5-1.5H9m-3 0l-1.5 1.5m1.5-1.5H6v-6A2.25 2.25 0 018.25 7.5h7.5A2.25 2.25 0 0118 9.75v6m-4.5 0v1.5m-3-1.5v1.5m0-6V7.5M12 9h.008v.008H12V9zM6 12h.008v.008H6V12z" />
        </svg>
        <span>Copy</span>
      `;

      // Attach copy handler
      copyBtn.onclick = () => handleCopy(msg.text);

      // Assemble the structure: Bubble and then the Button, both inside messageContent
      messageContent.appendChild(bubble);
      messageContent.appendChild(copyBtn);

      messageContainer.appendChild(messageContent);
      chatWindow.appendChild(messageContainer);
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

    setStatus("Thinking...");
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

    try {
      const res = await fetch("/api/embeddings/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data = await res.json();
      const answer = data.answer || "No answer returned.";

      // Add bot response
      session.messages.push({ role: "bot", text: answer });
      saveSessions();
      renderChat();
      setStatus("");
    } catch (err) {
      console.error("Query error:", err);
      session.messages.push({ role: "bot", text: `Error: ${err.message}` });
      saveSessions();
      renderChat();
      setStatus(`Error: ${err.message}`, true);
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

  // Sidebar toggle
  toggleSidebar.addEventListener("click", () => {
    sidebar.classList.add("hidden");
    showSidebar.classList.remove("hidden");
  });

  showSidebar.addEventListener("click", () => {
    sidebar.classList.remove("hidden");
    showSidebar.classList.add("hidden");
  });

  // Initial render
  renderHistoryList();
  renderChat();
});
