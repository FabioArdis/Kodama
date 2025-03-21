<script lang="ts">
import { marked, MarkedOptions } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";
import { CompletionOptions, LLMClient, Message, ModelParameters } from "../lib/llm-client";
import { useSettingsStore } from "../stores/settings";

marked.setOptions({
  highlight: (code: string, lang: string) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  gfm: true,
  breaks: true,
} as MarkedOptions);

interface ChatMessage {
  id: number,
  sender: "User" | "AI" | "Error";
  content: string;
  timestamp: string;
  timeTaken?: number;
  tokenCount?: number;
}

interface CodeBlock {
  messageIndex: number;
  codeIndex: number;
  content: string;
  id: string;
  language: string;
}

export default {
  emits: ["applyCode"],
  data() {
    return {
      chatOpen: false,
      userInput: "",
      messages: [] as ChatMessage[],
      codeBlocks: [] as CodeBlock[],
      chatWidth: parseInt(localStorage.getItem("chatWidth") || "320"),
      isResizing: false,
      processingResponse: false,
      editorMode: {
        active: true,
        sourceTabId: null as number | null,
        selection: null as string | null,
      },
      llmClient: null as LLMClient | null,
      selectedModel: "",
    };
  },
  computed: {
    settingsStore() {
      return useSettingsStore()
    },
    quickPromptsList() {
      return this.settingsStore.chatSettings.quickPrompts || [];
    },
    fontSizeClass() : string {
      const sizes = {
        small: "text-sm",
        medium: "text-base",
        large: "text-lg"
      };
      return sizes[this.settingsStore.uiSettings.fontSize as keyof typeof sizes] || "text-base";
    },
    codeThemeClass(): string {
      return `theme-${this.settingsStore.uiSettings.codeBlockTheme}`;
    },
    compactViewClass(): string {
      return this.settingsStore.uiSettings.compactView ? "compact-view" : "";
    },
    chatSizeStyle(): { width: string; height: string; } {
      return {
        width: `${this.chatWidth}px`,
        height: this.settingsStore.uiSettings.compactView ? 'calc(70% - 2rem)' : ''
      };
    },
    editorHeightStyle(): { height: string } {
      return {
        height: `${this.settingsStore.chatSettings.editorHeight}px`
      };
    }
  },
  watch: {
    messages: {
      deep: true,
      handler(newMessages: ChatMessage[]) {
        this.$nextTick(() => {
          this.extractCodeBlocks(newMessages);
          if (this.settingsStore.chatSettings.autoScroll) {
            this.scrollToBottom();
          }
        });
      },
    },
    'settingsStore.uiSettings.codeBlockTheme'() {
      this.$nextTick(() => {
        this.applyHighlighting();
      });
    }
  },
  created() {
    if (this.settingsStore.dataSettings.enableHistory) {
      this.loadChatHistory();
    }
    this.initLLMClient();
  },
  mounted() {
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
    this.$nextTick(() => {
      this.addCodeBlockActions();
      this.applyHighlighting();
    });
  },
  beforeUnmount() {
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
  },
  methods: {
    initLLMClient() {
      this.selectedModel = this.settingsStore.llmConnection.selectedModel;
      this.llmClient = new LLMClient(this.settingsStore.llmConnection.selectedProvider);
      this.llmClient.setBaseUrl(this.settingsStore.llmConnection.baseUrl);
      this.llmClient.setApiKey(this.settingsStore.llmConnection.apiKey);
      this.llmClient.setHeaders({
        'Authorization': `Bearer ${this.settingsStore.llmConnection.apiKey}`
      });
    },

    applyHighlighting() {
      this.$nextTick(() => {
        document.querySelectorAll('pre code').forEach((block) => {
          hljs.highlightElement(block as HTMLElement);
        });
      });
    },

    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$el.querySelector(".messages-container") as HTMLElement;
        if (container) container.scrollTop = container.scrollHeight;
      });
    },

    extractCodeBlocks(messages: ChatMessage[]) {
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
              content: codeBlock.textContent || "",
              id: `${msg.id}-${codeIndex}`,
              language: codeBlock.className.replace("language-", "").trim() || "plaintext"
            });
          });
        }
      });
    },

    applyCode(code: string, event: Event): void {
      this.$emit("applyCode", { code });
      const button = event.target as HTMLButtonElement | null;
      button?.classList.add("bg-green-500");
      setTimeout(() => {
        button?.classList.remove("bg-green-500");
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

    openWithPrompt(prompt: string, tabId: number | null = null, selection: string | null = null) {
      this.chatOpen = true;
      this.editorMode = {
        active: true,
        sourceTabId: tabId,
        selection: selection,
      };
      this.userInput = prompt;
      this.sendMessage();
    },

    applyQuickPrompt(promptContent: string) {
      this.userInput = promptContent;
      this.sendMessage();
    },

    startResize(event: MouseEvent) {
      this.isResizing = true;
      event.preventDefault();
    },

    handleMouseMove(event: MouseEvent) {
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
      if (this.selectedModel != this.settingsStore.llmConnection.selectedModel) {
        this.initLLMClient();
      }
      if (this.userInput.trim() && !this.processingResponse) {
        this.processingResponse = true;
        const messageId = Date.now();
        
        const userMessage: ChatMessage = {
          id: messageId,
          sender: "User",
          content: this.userInput,
          timestamp: new Date().toISOString(),
        };

        this.messages.push(userMessage);
        this.userInput = "";
        
        const aiMessage: ChatMessage = {
          id: messageId + 1,
          sender: "AI",
          content: `${this.settingsStore.llmConnection.selectedModel} is thinking...`,
          timestamp: new Date().toISOString(),
        };
        this.messages.push(aiMessage);
        
        await this.getStreamingResponse(userMessage.content);
        this.processingResponse = false;
      }
    },

    async getStreamingResponse(input: string) {
      let messages: Message[] = [];

      if (this.messages.length > 2) {
        const previousMessages = this.messages.slice(-10, -1);
        previousMessages.forEach(msg => {
          messages.push({
            role: msg.sender === "User" ? "user" : "assistant",
            content: msg.sender === "AI" ? this.stripHtml(msg.content) : msg.content
          });
        });
      }

      messages.push({ role: "user", content: input});

      try {
        const startTime = Date.now();
        let messageContent = "";
        let tokenCount = 0;

        if (!this.llmClient) {
          this.initLLMClient();
        }

        const options = {
          model: this.settingsStore.llmConnection.selectedModel,
          messages,
          stream: true,
          parameters: this.settingsStore.modelParameters as ModelParameters
        } as CompletionOptions;

        const response = await this.llmClient!.chat(options);

        for await (const part of response) {
          if (part.message.content) {
            messageContent += part.message.content;
            console.info("Received:" + messageContent);
            tokenCount += 1;
            this.updateMessage(await this.renderMarkdown(messageContent));
          }
        }

        const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
        this.updateMessage(await this.renderMarkdown(messageContent), {
          timeTaken: parseFloat(timeTaken),
          tokenCount
        });

        this.applyHighlighting();
        this.addCodeBlockActions();

        if (this.settingsStore.dataSettings.autoSaveChats) {
          console.log("Auto-Saving...");
          this.saveChatHistory();
        }
      } catch (error) {
        console.error("LLM request failed:", error);
        this.messages.push({
          id: Date.now(),
          sender: "Error",
          content: `<details>
                      <summary class="flex cursor-pointer items-center gap-2 justify-around text-primary font-medium my-2">
                      <i class="fas fa-circle-exclamation"></i>
                        Error: Unable to get response from ${this.settingsStore.llmConnection.selectedProvider}.
                      <i class="fas fa-expand"></i>
                      </summary>
                      <p class="rounded-2xl bg-red-900 p-2">${error}</p>
                    </details>`,
          timestamp: new Date().toISOString(),
        });
      }
    },

    copyCode(code: string) {
      navigator.clipboard.writeText(code);
    },
    
    stripHtml(html: string): string {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || "";
    },

    updateMessage(content: string, metadata: {timeTaken?: number, tokenCount?: number} = {}) {
      const lastMessage = this.messages[this.messages.length - 1];
      
      if (lastMessage) {
        lastMessage.content = content;
        if (metadata.timeTaken !== undefined) lastMessage.timeTaken = metadata.timeTaken;
        if (metadata.tokenCount !== undefined) lastMessage.tokenCount = metadata.tokenCount;
      }
    },

    async renderMarkdown(text : string): Promise<string> {
      if (this.settingsStore.uiSettings.markdownRenderer === "default") {
        return marked(text);
      } else {
        // TODO: implement alternative renderers.
        return marked(text);
      }
    },

    addCodeBlockActions() {
      setTimeout(() => {
        const messageContainers = document.querySelectorAll(".ai-message");
        const lastContainer = messageContainers[messageContainers.length - 1];
        
        lastContainer?.querySelectorAll("pre code").forEach((codeBlock) => {
          if (codeBlock.parentElement?.querySelector(".code-actions")) return;

          const actions = document.createElement("div");
          actions.className = "code-actions";
          
          const applyButton = document.createElement("button");
          applyButton.className = "apply-button px-2 py-1 text-xs bg-chat-code-apply hover:bg-chat-code-apply-hover rounded transition-colors select-none";
          applyButton.textContent = "Apply to Editor";
          applyButton.onclick = () => 
            this.applyCodeToEditor(codeBlock.textContent || "");
          
          const copyButton = document.createElement("button");
          copyButton.className = "copy-button px-2 py-1 text-xs bg-chat-code-copy hover:bg-chat-code-copy-hover rounded transition-colors select-none";
          copyButton.textContent = "Copy";
          copyButton.onclick = () => {
            navigator.clipboard.writeText(codeBlock.textContent || "");
            copyButton.textContent = "Copied!";
            setTimeout(() => copyButton.textContent = "Copy", 2000);
          };

          actions.append(applyButton, copyButton);
          codeBlock.parentElement?.append(actions);
        });
      }, 100);
    },

    applyCodeToEditor(code: string): void {
      this.$emit("applyCode", {
        code: code,
        tabId: this.editorMode.sourceTabId,
        selection: this.editorMode.selection,
      });
    },

    saveChatHistory() : void {
      if (!this.settingsStore.dataSettings.enableHistory) return;
      
      let chats = [];
      try {
        chats = JSON.parse(localStorage.getItem("chatHistory") || "[]");
        if (!Array.isArray(chats)) chats = [];
      } catch (error) {
        chats = [];
      }
      
      let currentChat = chats.find(chat => chat.id === "current") || {
        id: "current",
        title: "Current Chat",
        messages: [],
        updatedAt: new Date().toISOString()
      };
      
      currentChat.messages = this.messages;
      currentChat.updatedAt = new Date().toISOString();
      
      chats = chats.filter(chat => chat.id !== "current");
      
      chats.unshift(currentChat);
      
      if (chats.length > this.settingsStore.dataSettings.maxStoredChats) {
        chats = chats.slice(0, this.settingsStore.dataSettings.maxStoredChats);
      }
      
      localStorage.setItem("chatHistory", JSON.stringify(chats));
    },

    loadChatHistory(): void {
      if (!this.settingsStore.dataSettings.enableHistory) return;
      
      try {
        const chats = JSON.parse(localStorage.getItem("chatHistory") || "[]");
        if (Array.isArray(chats) && chats.length > 0) {
          const currentChat = chats.find(chat => chat.id === "current");
          if (currentChat && Array.isArray(currentChat.messages)) {
            this.messages = currentChat.messages;
            this.$nextTick(() => {
              this.applyHighlighting();
            });
          }
        }
      } catch (error) {
        console.error("Error loading chat history:", error);
        this.messages = [];
      }
    },

    clearChatHistory(): void {
      this.messages = [];
    },

    formatTime(timestamp: string): string {
      if (!timestamp || !this.settingsStore.chatSettings.showTimestamps) return "";
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    },
    
    exportChat(): void {
      if (this.messages.length === 0) return;
      
      let content;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      let filename = `chat-export-${timestamp}`;
      let type;
      
      if (this.settingsStore.dataSettings.saveFormat === "json") {
        let exportData = this.messages.map(msg => {
          const base = {
            role: msg.sender === "User" ? "user" : "assistant",
            content: msg.sender === "AI" ? this.stripHtml(msg.content) : msg.content
          };
          
          if (this.settingsStore.dataSettings.exportIncludeMetadata) {
            return {
              ...base,
              timestamp: msg.timestamp,
              timeTaken: msg.timeTaken,
              tokenCount: msg.tokenCount
            };
          }
          
          return base;
        });
        
        content = JSON.stringify(exportData, null, 2);
        filename += ".json";
        type = "application/json";
      } else if (this.settingsStore.dataSettings.saveFormat === "markdown") {
        content = this.messages.map(msg => {
          let header = `## ${msg.sender === "User" ? "User" : "Assistant"}`;
          if (this.settingsStore.dataSettings.exportIncludeMetadata && msg.timestamp) {
            header += ` (${new Date(msg.timestamp).toLocaleString()})`;
          }
          
          let body = msg.sender === "AI" ? this.stripHtml(msg.content) : msg.content;
          
          let meta = "";
          if (this.settingsStore.dataSettings.exportIncludeMetadata) {
            if (msg.timeTaken) meta += `Time: ${msg.timeTaken}s | `;
            if (msg.tokenCount) meta += `Tokens: ~${msg.tokenCount}`;
            if (meta) meta = `\n\n*${meta}*`;
          }
          
          return `${header}\n\n${body}${meta}\n\n---\n`;
        }).join("\n");
        
        filename += ".md";
        type = "text/markdown";
      } else {
        // Plain text fallback
        content = this.messages.map(msg => {
          return `${msg.sender}: ${msg.sender === "AI" ? this.stripHtml(msg.content) : msg.content}`;
        }).join("\n\n");
        
        filename += ".txt";
        type = "text/plain";
      }
      
      // Create download link, will implement a tauri version later.
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  },
};
</script>

<template>
  <div class="relative z-10">
    <button
      @click="toggleChat"
      class="fixed right-12 bg-chat-accent pl-4 pr-4 pt-3.5 pb-3.5 rounded-2xl hover:bg-secondary transition-colors shadow-xl border border-border-accent"
      :style="{ bottom: `calc(4rem + 1rem)` }"
    >
      <i class="fas fa-comments"></i>
    </button>
    
    <transition name="slide">
      <div
        v-if="chatOpen"
        class="fixed top-17 right-0 bottom-10.5 bg-chat-accent rounded-l-4xl overflow-hidden flex flex-col z-10"
        :style="chatSizeStyle"
        :class="compactViewClass"
      >
        <div
          class="absolute top-0 left-0 w-1 h-full cursor-ew-resize hover:bg-blue-500"
          @mousedown="startResize"
          :class="{ 'bg-blue-500': isResizing, 'bg-chat-resize-bar': !isResizing }"
        ></div>
        
        <div class="flex justify-between items-center p-4 select-none">
          <span class="text-lg font-semibold">Chat</span>
          <div class="flex items-center">
            <button 
              @click="exportChat" 
              class="text-text-accent mr-3 text-sm hover:text-text-primary"
              v-if="messages.length > 0"
            >
              <i class="fas fa-download"></i>
            </button>
            <button 
              @click="clearChatHistory" 
              class="text-text-accent mr-3 text-sm hover:text-text-primary"
              v-if="messages.length > 0"
            >
              <i class="fas fa-trash"></i> Clear
            </button>
            <button @click="toggleChat" class="text-text-accent hover:text-text-primary">&times;</button>
          </div>
        </div>
        
        <!-- Quick Prompts Row -->
        <div 
          v-if="quickPromptsList.length > 0" 
          class="quick-prompts-container px-4 py-2 mb-1 whitespace-nowrap text-xs font-semibold select-none"
        >
            <p class="text-xs text-text-accent font-semibold py-2">QUICK PROMPTS</p>
          <button
            v-for="prompt in quickPromptsList"
            :key="prompt.id || prompt.title"
            @click="applyQuickPrompt(prompt.content)"
            class="inline-block px-3 py-1 mr-2 text-xs rounded-full bg-chat-secondary text-text-primary hover:bg-chat-primary transition-colors"
          >
            {{ prompt.title }}
          </button>
        </div>
        
        <div class="chat-container bg-chat-primary rounded-xl p-4 mx-4 mb-4 flex-grow overflow-hidden flex flex-col">
          <div class="messages-container flex-grow overflow-y-auto" :class="fontSizeClass">
            <transition name="fade">
              <template v-if="messages.length > 0">
                <transition-group name="message-fade" tag="div">
                  <div 
                    v-for="message in messages" 
                    :key="message.id" 
                    class="message-container mb-4"
                    :class="{ 'mb-2': settingsStore.uiSettings.compactView }"
                  >
                    <div 
                      v-if="message.sender === 'Error'" 
                      class="ai-message text-white bg-red-800 p-3 rounded-lg shadow-lg"
                      :class="{ 'p-2': settingsStore.uiSettings.compactView }"
                    >
                      <p v-html="message.content"></p>
                      <small v-if="message.timestamp && settingsStore.chatSettings.showTimestamps" class="text-white block mt-1">
                        {{ formatTime(message.timestamp) }}
                      </small>
                    </div>
                    
                    <div 
                      v-else-if="message.sender === 'AI'" 
                      class="ai-message bg-chat-secondary p-3 rounded-lg shadow-lg"
                      :class="{ 'p-2': settingsStore.uiSettings.compactView }"
                    >
                      <div 
                        class="prose prose-invert max-w-none" 
                        :class="[codeThemeClass, {'prose-sm': settingsStore.uiSettings.fontSize === 'small' || settingsStore.uiSettings.compactView}]" 
                        v-html="message.content"
                      ></div>
                      
                      <div
                        v-for="block in codeBlocks.filter(b => b.messageIndex === message.id)"
                        :key="block.id"
                        class="mt-2"
                      >
                        <div class="code-actions flex gap-2 mt-2">
                          <button
                            @click="applyCode(block.content, $event)"
                            class="px-2 py-1 text-xs bg-chat-code-apply hover:bg-chat-code-apply-hover rounded transition-colors select-none"
                          >
                            Apply to Editor
                          </button>
                          <button
                            @click="copyCode(block.content)"
                            class="px-2 py-1 text-xs bg-chat-code-copy hover:bg-chat-code-copy-hover rounded transition-colors select-none"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <small v-if="settingsStore.chatSettings.showMessageInfo && message.timeTaken && message.tokenCount" class="text-chat-text-accent block mt-1">
                        took {{ message.timeTaken }}s · ~{{ message.tokenCount }} tokens
                      </small>
                      <small v-if="message.timestamp && settingsStore.chatSettings.showTimestamps" class="text-chat-text-accent block mt-1">
                        {{ formatTime(message.timestamp) }}
                      </small>
                    </div>
                    
                    <div 
                      v-else 
                      class="user-message bg-chat-accent p-3 rounded-lg text-text-primary shadow-lg"
                      :class="{ 'p-2': settingsStore.uiSettings.compactView }"
                    >
                      <p>{{ message.content }}</p>
                      <small v-if="message.timestamp && settingsStore.chatSettings.showTimestamps" class="text-chat-text-accent block mt-1 text-right">
                        {{ formatTime(message.timestamp) }}
                      </small>
                    </div>
                  </div>
                </transition-group>
              </template>
              
              <template v-else>
                <div class="empty-chat flex flex-col items-center text-center p-6 text-text-secondary">
                  <h2 class="text-xl font-bold text-text-primary">Don't be shy and start chatting!</h2>
                  <p class="mt-2 text-base">Here are some examples to get you started:</p>

                  <ul class="mt-4 space-y-2 text-sm text-text-accent">
                    <li class="flex items-center gap-2 p-2 outline-1 rounded-md">
                      <span class="text-text-accent">➤</span> "How do I implement a sorting algorithm in JavaScript?"
                    </li>
                    <li class="flex items-center gap-2 p-2 outline-1 rounded-md">
                      <span class="text-text-accent">➤</span> "Can you show me how to use Vue.js computed properties?"
                    </li>
                    <li class="flex items-center gap-2 p-2 outline-1 rounded-md">
                      <span class="text-text-accent">➤</span> "What are some good practices for responsive design?"
                    </li>
                  </ul>

                  <p class="mt-6 text-sm text-text-accent">
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
              class="p-2 bg-chat-accent text-text-primary rounded-md w-full mb-2 resize-none select-none"
              :style="editorHeightStyle"
              @keydown.enter.prevent="sendMessage"
              :disabled="processingResponse"
            ></textarea>
            
            <button
              @click="sendMessage"
              class="p-2 bg-chat-secondary text-text-primary rounded-md w-full hover:bg-chat-primary transition shadow-lg select-none"
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
  background: var(--ide-theme-secondary) !important;
  border-radius: 10px !important;
}

.messages-container::-webkit-scrollbar-thumb:hover,
pre::-webkit-scrollbar-thumb:hover,
.hljs::-webkit-scrollbar-thumb:hover,
.ai-message pre::-webkit-scrollbar-thumb:hover,
.ai-message .hljs::-webkit-scrollbar-thumb:hover {
  background: var(--ide-theme-secondary) !important;
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
  scrollbar-color: var(--ide-theme-secondary) transparent !important;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
