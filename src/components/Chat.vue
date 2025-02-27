<script>
import ollama from "ollama/browser";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";

marked.setOptions({
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  gfm: true,
  breaks: true,
});

export default {
  emits: ["applyCode"],
  data() {
    return {
      chatOpen: false,
      userInput: "",
      messages: [],
      codeBlocks: [],
      selectedModel: localStorage.getItem("selectedModel") || "defaultModel",
      chatWidth: parseInt(localStorage.getItem("chatWidth") || "320"),
      isResizing: false,
      processingResponse: false,
      editorMode: {
        active: true,
        sourceTabId: null,
        selection: null,
      },
    };
  },
  watch: {
    messages: {
      deep: true,
      handler(newMessages) {
        this.$nextTick(() => {
          this.extractCodeBlocks(newMessages);
        });
      },
    },
  },
  created() {
    this.loadChatHistory();
  },
  mounted() {
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
    this.$nextTick(() => {
      this.addCodeBlockActions();
    });
  },
  beforeUnmount() {
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
  },
  methods: {
    applyHighlighting() {
      this.$nextTick(() => {
        document.querySelectorAll('pre code').forEach((block) => {
          hljs.highlightElement(block);
        });
      });
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$el.querySelector(".messages-container");
        if (container) container.scrollTop = container.scrollHeight;
      });
    },
    extractCodeBlocks(messages) {
      this.codeBlocks = [];
      messages.forEach((msg, msgIndex) => {
        if (msg.sender === "AI") {
          const parser = new DOMParser();
          const doc = parser.parseFromString(msg.content, "text/html");
          const preElements = doc.querySelectorAll("pre code");
          preElements.forEach((codeBlock, codeIndex) => {
            this.codeBlocks.push({
              messageIndex: msgIndex,
              codeIndex,
              content: codeBlock.textContent,
              id: `${msg.id}-${codeIndex}`,
            });
          });
        }
      });
    },
    applyCode(code) {
      this.$emit("applyCode", { code });
      const button = event.target;
      button.classList.add("bg-green-500");
      setTimeout(() => {
        button.classList.remove("bg-green-500");
      }, 1000);
    },
    toggleChat() {
      this.chatOpen = !this.chatOpen;
      if (this.chatOpen) {
        this.$nextTick(() => {
          this.addCodeBlockActions();
          this.applyHighlighting();
        });
      }
    },
    openWithPrompt(prompt, tabId = null, selection = null) {
      this.chatOpen = true;
      this.editorMode = {
        active: true,
        sourceTabId: tabId,
        selection: selection,
      };
      this.userInput = prompt;
      this.sendMessage();
    },
    startResize(event) {
      this.isResizing = true;
      event.preventDefault();
    },
    handleMouseMove(event) {
      if (!this.isResizing) return;
      const newWidth = window.innerWidth - event.clientX;
      if (newWidth >= 250 && newWidth <= 600) {
        this.chatWidth = newWidth;
        localStorage.setItem("chatWidth", newWidth.toString());
      }
    },
    handleMouseUp() {
      this.isResizing = false;
    },
    async sendMessage() {
      if (this.userInput.trim() && !this.processingResponse) {
        this.processingResponse = true;
        const messageId = Date.now();
        const userMessage = {
          id: messageId,
          sender: "User",
          content: this.userInput,
          timestamp: new Date().toISOString(),
        };
        this.messages.push(userMessage);
        this.userInput = "";
        const aiMessage = {
          id: messageId + 1,
          sender: "AI",
          content: this.selectedModel + " is thinking...",
          timestamp: new Date().toISOString(),
          timeTaken: null,
        };
        this.messages.push(aiMessage);
        this.saveChatHistory();
        await this.getStreamingResponse(userMessage.content);
        this.processingResponse = false;
      }
    },
    async getStreamingResponse(input) {
      const message = { role: "user", content: input };
      const options = {
        model: this.selectedModel,
        messages: [message],
        stream: true,
      };
      try {
        const startTime = Date.now();
        const response = await ollama.chat(options);
        let messageContent = "";
        for await (const part of response) {
          messageContent += part.message.content;
          this.updateMessage(this.renderMarkdown(messageContent));
        }
        const timeTaken = (((Date.now() - startTime) / 1000).toFixed(2));
        const finalContent = this.renderMarkdown(messageContent);
        this.updateMessage(finalContent + `<br><small class="text-gray-400">took ${timeTaken} seconds</small>`);
        this.applyHighlighting();
        setTimeout(() => {
          this.addCodeBlockActions();
        }, 500);
        this.saveChatHistory();
      } catch (error) {
        this.messages.push({
          id: Date.now(),
          sender: "Error",
          content: "Error: Unable to get a response from Ollama.",
          timestamp: new Date().toISOString(),
        });
        this.saveChatHistory();
      }
    },
    updateMessage(content) {
      const lastMessageIndex = this.messages.length - 1;
      this.messages[lastMessageIndex].content = content;
    },
    renderMarkdown(text) {
      return marked(text);
    },
    addCodeBlockActions() {
      // We're basically dynamically adding the buttons once the streaming is done.
      if (!this.editorMode.active) return;
      setTimeout(() => {
        const messageContainers = document.querySelectorAll(".ai-message");
        if (!messageContainers.length) return;
        
        const lastMessageContainer = messageContainers[messageContainers.length - 1];
        if (!lastMessageContainer) return;
        
        const codeBlocks = lastMessageContainer.querySelectorAll("pre code");
        codeBlocks.forEach((codeBlock) => {
          if (codeBlock.parentElement.querySelector(".code-actions")) return;
          
          const actionsContainer = document.createElement("div");
          actionsContainer.className = "code-actions";
          actionsContainer.style.display = "flex";
          actionsContainer.style.gap = "8px";
          actionsContainer.style.marginTop = "8px";
          
          const applyButton = document.createElement("button");
          applyButton.className = "apply-button";
          applyButton.textContent = "Apply to Editor";
          applyButton.style.backgroundColor = "#2563eb";
          applyButton.style.color = "white";
          applyButton.style.padding = "4px 8px";
          applyButton.style.borderRadius = "4px";
          applyButton.style.fontSize = "12px";
          applyButton.onclick = () => this.applyCodeToEditor(codeBlock.textContent);
          
          const copyButton = document.createElement("button");
          copyButton.className = "copy-button";
          copyButton.textContent = "Copy";
          copyButton.style.backgroundColor = "#525252";
          copyButton.style.color = "white";
          copyButton.style.padding = "4px 8px";
          copyButton.style.borderRadius = "4px";
          copyButton.style.fontSize = "12px";
          copyButton.onclick = () => {
            navigator.clipboard.writeText(codeBlock.textContent);
            copyButton.textContent = "Copied!";
            setTimeout(() => {
              copyButton.textContent = "Copy";
            }, 2000);
          };
          
          actionsContainer.appendChild(applyButton);
          actionsContainer.appendChild(copyButton);
          
          codeBlock.parentElement.appendChild(actionsContainer);
        });
      }, 100);
    },
    applyCodeToEditor(code) {
      this.$emit("applyCode", {
        code: code,
        tabId: this.editorMode.sourceTabId,
        selection: this.editorMode.selection,
      });
    },
    saveChatHistory() {
      localStorage.setItem("chatHistory", JSON.stringify(this.messages));
    },
    loadChatHistory() {
      const savedHistory = localStorage.getItem("chatHistory");
      if (savedHistory) {
        try {
          this.messages = JSON.parse(savedHistory);
          this.$nextTick(() => {
            this.applyHighlighting();
          });
        } catch (error) {
          this.messages = [];
        }
      }
    },
    clearChatHistory() {
      this.messages = [];
      localStorage.removeItem("chatHistory");
    },
    formatTime(timestamp) {
      if (!timestamp) return "";
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    },
  },
};
</script>

<template>
  <div class="relative z-10">
    <button
      @click="toggleChat"
      class="fixed right-8 bg-neutral-700 p-3 rounded-xl"
      :style="{ bottom: `calc(4rem + 1rem)` }"
    >
      <i class="fas fa-comments"></i>
    </button>
    <transition name="slide">
      <div
        v-if="chatOpen"
        class="fixed top-0 right-0 h-full bg-neutral-700 rounded-l-lg shadow-lg overflow-hidden flex flex-col z-10"
        :style="{ width: `${chatWidth}px` }"
      >
        <div
          class="absolute top-0 left-0 w-1 h-full cursor-ew-resize hover:bg-blue-500"
          @mousedown="startResize"
          :class="{ 'bg-blue-500': isResizing, 'bg-neutral-600': !isResizing }"
        ></div>
        <div class="flex justify-between items-center p-4">
          <span class="text-lg font-semibold">Chat</span>
          <div>
            <!-- Just for debugging
            <button @click="addCodeBlockActions(true)" class="text-neutral-300 mr-3 text-sm hover:text-white">
              <i class="fas fa-sync"></i> Fix Buttons
            </button>
            -->
            <button @click="clearChatHistory" class="text-neutral-300 mr-3 text-sm hover:text-white">
              <i class="fas fa-trash"></i> Clear
            </button>
            <button @click="toggleChat" class="text-neutral-300 hover:text-white">&times;</button>
          </div>
        </div>
        <div class="chat-container bg-neutral-800 rounded-xl p-4 mx-4 mb-4 flex-grow overflow-hidden flex flex-col">
          <div class="messages-container flex-grow overflow-y-auto">
            <transition name="fade">
              <template v-if="messages.length > 0">
                <transition-group name="message-fade" tag="div">
                  <div v-for="message in messages" :key="message.id" class="message-container mb-4">
                    <div v-if="message.sender === 'Error'" class="ai-message bg-red-800 p-3 rounded-lg shadow-lg">
                      <p v-html="message.content"></p>
                      <small v-if="message.timestamp" class="text-gray-400 block mt-1">
                        {{ formatTime(message.timestamp) }}
                      </small>
                    </div>
                    <div v-else-if="message.sender === 'AI'" class="ai-message bg-neutral-900 p-3 rounded-lg shadow-lg">
                      <div class="prose prose-invert prose-sm max-w-none" v-html="message.content"></div>
                      <div
                        v-for="block in codeBlocks.filter(b => b.messageIndex === message.id)"
                        :key="block.id"
                        class="mt-2"
                      >
                        <div class="code-actions flex gap-2 mt-2">
                          <button
                            @click="applyCode(block.content)"
                            class="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                          >
                            Apply to Editor
                          </button>
                          <button
                            @click="copyCode(block.content)"
                            class="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <small v-if="message.timestamp" class="text-gray-400 block mt-1">
                        {{ formatTime(message.timestamp) }}
                      </small>
                    </div>
                    <div v-else class="user-message bg-neutral-700 p-3 rounded-lg text-white">
                      <p>{{ message.content }}</p>
                      <small v-if="message.timestamp" class="text-gray-400 block mt-1 text-right">
                        {{ formatTime(message.timestamp) }}
                      </small>
                    </div>
                  </div>
                </transition-group>
              </template>
              <template v-else>
                <div class="empty-chat flex flex-col items-center text-center p-6 text-neutral-200">
                  <h2 class="text-xl font-bold text-neutral-100">Don't be shy and start chatting!</h2>
                  <p class="mt-2 text-base">Here are some examples to get you started:</p>

                  <ul class="mt-4 space-y-2 text-sm text-neutral-300">
                    <li class="flex items-center gap-2">
                      <span class="text-neutral-700">➤</span> "How do I implement a sorting algorithm in JavaScript?"
                    </li>
                    <li class="flex items-center gap-2">
                      <span class="text-neutral-700">➤</span> "Can you show me how to use Vue.js computed properties?"
                    </li>
                    <li class="flex items-center gap-2">
                      <span class="text-neutral-700">➤</span> "What are some good practices for responsive design?"
                    </li>
                  </ul>

                  <p class="mt-6 text-sm text-neutral-300">
                    Select text or code in your editor and use the 
                    <span class="font-medium text-blue-500">"Apply to Editor"</span> button to immediately see them in action.
                  </p>
                </div>
              </template>
            </transition>
          </div>
          <div class="input-container mt-4">
            <textarea
              v-model="userInput"
              placeholder="Ask a question..."
              class="p-2 bg-neutral-700 text-white rounded-md w-full mb-2 resize-none"
              rows="2"
              @keydown.enter.prevent="sendMessage"
              :disabled="processingResponse"
            ></textarea>
            <button
              @click="sendMessage"
              class="p-2 bg-neutral-900 text-white rounded-md w-full hover:bg-neutral-800 transition"
              :disabled="processingResponse || !userInput.trim()"
              :class="{ 'opacity-50 cursor-not-allowed': processingResponse || !userInput.trim() }"
            >
              {{ processingResponse ? "Processing..." : "Send" }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease-in-out;
}
.slide-enter-from {
  transform: translateX(100%);
}
.slide-leave-to {
  transform: translateX(100%);
}

.message-fade-enter-active,
.message-fade-leave-active {
  transition: opacity 0.5s ease-in-out, transform 0.5s ease-in-out;
}
.message-fade-enter-from,
.message-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.prose-sm {
  font-size: 0.875rem;
}

pre {
  border-radius: 0.375rem;
  padding: 0.75rem;
  margin: 0.5rem 0;
  overflow-x: auto;
  position: relative;
}
code {
  font-family: monospace;
  font-size: 0.85em;
  background-color: rgba(0, 0, 0, 0.2);
  padding: 0.2em 0.4em;
  border-radius: 0.25rem;
}
pre code {
  background-color: transparent;
  padding: 0;
}

.code-actions {
  margin-top: 0.5rem;
  padding: 0.25rem;
  display: flex;
  gap: 0.5rem;
}
.code-actions button {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border-radius: 0.375rem;
  color: white;
  transition: background-color 0.2s;
}
.code-actions button:first-child {
  background-color: #2563eb;
}
.code-actions button:first-child:hover {
  background-color: #1d4ed8;
}
.code-actions button:last-child {
  background-color: #525252;
}
.code-actions button:last-child:hover {
  background-color: #404040;
}

.messages-container {
  padding-right: 8px;
}

.messages-container::-webkit-scrollbar,
pre::-webkit-scrollbar,
.hljs::-webkit-scrollbar,
.ai-message pre::-webkit-scrollbar,
.ai-message .hljs::-webkit-scrollbar {
  width: 6px !important;
  height: 6px !important;
}

.messages-container::-webkit-scrollbar-thumb,
pre::-webkit-scrollbar-thumb,
.hljs::-webkit-scrollbar-thumb,
.ai-message pre::-webkit-scrollbar-thumb,
.ai-message .hljs::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2) !important;
  border-radius: 10px !important;
}

.messages-container::-webkit-scrollbar-thumb:hover,
pre::-webkit-scrollbar-thumb:hover,
.hljs::-webkit-scrollbar-thumb:hover,
.ai-message pre::-webkit-scrollbar-thumb:hover,
.ai-message .hljs::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3) !important;
}

.messages-container::-webkit-scrollbar-track,
pre::-webkit-scrollbar-track,
.hljs::-webkit-scrollbar-track,
.ai-message pre::-webkit-scrollbar-track,
.ai-message .hljs::-webkit-scrollbar-track {
  background: transparent !important;
}

/* I use Firefox for testing, so it's needed. */
.messages-container,
pre,
.hljs,
.ai-message pre,
.ai-message .hljs {
  scrollbar-width: thin !important;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent !important;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
