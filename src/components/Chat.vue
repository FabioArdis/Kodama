<script>
import ollama from "ollama/browser";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";

marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  gfm: true,
  breaks: true
});

export default {
  data() {
    return {
      chatOpen: false,
      userInput: "",
      messages: [],
      selectedModel: localStorage.getItem("selectedModel") || "defaultModel",
      chatWidth: parseInt(localStorage.getItem("chatWidth") || "320"),
      isResizing: false
    };
  },
  created() {
    this.loadChatHistory();
  },
  mounted() {
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  },
  beforeUnmount() {
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  },
  methods: {
    toggleChat() {
      this.chatOpen = !this.chatOpen;
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
      if (this.userInput.trim()) {
        const messageId = Date.now();
        const userMessage = { id: messageId, sender: 'User', content: this.userInput, timestamp: new Date().toISOString() };
        this.messages.push(userMessage);
        this.userInput = "";

        const aiMessage = {
          id: messageId + 1,
          sender: 'AI',
          content: this.selectedModel + " is thinking...",
          timestamp: new Date().toISOString(),
          timeTaken: null
        };
        this.messages.push(aiMessage);

        this.saveChatHistory();

        await this.getStreamingResponse(userMessage.content);
      }
    },

    async getStreamingResponse(input) {
      const message = { role: 'user', content: input };

      console.log("Message sent to Ollama:", message);

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

        const endTime = Date.now();
        const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

        const finalContent = this.renderMarkdown(messageContent);
        this.updateMessage(finalContent + `<br><small class="text-gray-400">took ${timeTaken} seconds</small>`);

        this.saveChatHistory();
      } catch (error) {
        console.error("Error streaming response:", error);
        this.messages.push({
          id: Date.now(),
          sender: 'Error',
          content: "Error: Unable to get a response from Ollama.",
          timestamp: new Date().toISOString()
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

    saveChatHistory() {
      localStorage.setItem('chatHistory', JSON.stringify(this.messages));
    },

    loadChatHistory() {
      const savedHistory = localStorage.getItem('chatHistory');
      if (savedHistory) {
        try {
          this.messages = JSON.parse(savedHistory);
        } catch (error) {
          console.error("Error loading chat history:", error);
          this.messages = [];
        }
      }
    },

    clearChatHistory() {
      this.messages = [];
      localStorage.removeItem('chatHistory');
    },

    formatTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  },
};
</script>

<template>
  <div class="relative">
    <!-- Chat Button -->
    <button
        @click="toggleChat"
        class="fixed right-8 bg-neutral-700 p-3 rounded-xl"
        :style="{ bottom: `calc(4rem + 1rem)` }"
    >
      <i class="fas fa-comments"></i>
    </button>

    <!-- Chat Panel -->
    <transition name="slide">
      <div
          v-if="chatOpen"
          class="fixed top-0 right-0 h-full bg-neutral-700 rounded-l-lg shadow-lg overflow-hidden flex flex-col z-10"
          :style="{ width: `${chatWidth}px` }"
      >
        <!-- Resize handle -->
        <div
            class="absolute top-0 left-0 w-1 h-full cursor-ew-resize hover:bg-blue-500"
            @mousedown="startResize"
            :class="{ 'bg-blue-500': isResizing, 'bg-neutral-600': !isResizing }"
        ></div>

        <div class="flex justify-between items-center p-4 overflow-auto-y">
          <span class="text-lg font-semibold">AI Chat</span>
          <div>
            <button @click="clearChatHistory" class="text-neutral-300 mr-3 text-sm hover:text-white">
              <i class="fas fa-trash"></i> Clear
            </button>
            <button @click="toggleChat" class="text-neutral-300 hover:text-white">&times;</button>
          </div>
        </div>

        <div class="chat-container bg-neutral-800 rounded-xl p-4 mx-4 mb-4 flex-grow overflow-hidden flex flex-col">
          <div class="messages-container flex-grow overflow-y-auto">
            <transition-group name="message-fade" tag="div">
              <div v-for="message in messages" :key="message.id" class="message-container mb-4">
                <div v-if="message.sender === 'Error'" class="ai-message bg-red-800 p-3 rounded-lg shadow-lg">
                  <p v-html="message.content"></p>
                  <small v-if="message.timestamp" class="text-gray-400 block mt-1">{{ formatTime(message.timestamp) }}</small>
                </div>
                <div v-else-if="message.sender === 'AI'" class="ai-message bg-neutral-900 p-3 rounded-lg shadow-lg">
                  <div class="prose prose-invert prose-sm max-w-none">
                    <div v-html="message.content"></div>
                  </div>
                  <small v-if="message.timestamp" class="text-gray-400 block mt-1">{{ formatTime(message.timestamp) }}</small>
                </div>
                <div v-else class="user-message bg-neutral-700 p-3 rounded-lg text-white">
                  <p>{{ message.content }}</p>
                  <small v-if="message.timestamp" class="text-gray-400 block mt-1 text-right">{{ formatTime(message.timestamp) }}</small>
                </div>
              </div>
            </transition-group>
          </div>

          <div class="input-container mt-4">
            <textarea
                v-model="userInput"
                placeholder="Ask a question..."
                class="p-2 bg-neutral-700 text-white rounded-md w-full mb-2 resize-none"
                rows="2"
                @keydown.enter.prevent="sendMessage"
            ></textarea>

            <button @click="sendMessage" class="p-2 bg-neutral-900 text-white rounded-md w-full hover:bg-neutral-800 transition">
              Send
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
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

.message-fade-enter-from, .message-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.prose-sm {
  font-size: 0.875rem;
}

:deep(pre) {
  border-radius: 0.375rem;
  padding: 0.75rem;
  margin: 0.5rem 0;
  overflow-x: auto;
}

:deep(code) {
  font-family: monospace;
  font-size: 0.85em;
  background-color: rgba(0, 0, 0, 0.2);
  padding: 0.2em 0.4em;
  border-radius: 0.25rem;
}

:deep(pre code) {
  background-color: transparent;
  padding: 0;
}
</style>