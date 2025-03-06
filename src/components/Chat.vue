<script>
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";
import { LLMClient, PROVIDERS } from "../lib/llm-client";

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
      chatWidth: parseInt(localStorage.getItem("chatWidth") || "320"),
      isResizing: false,
      processingResponse: false,
      editorMode: {
        active: true,
        sourceTabId: null,
        selection: null,
      },
      llmClient: null,
      // Model settings
      selectedModel: localStorage.getItem("selectedModel") || "",
      selectedProvider: localStorage.getItem("selectedProvider") || PROVIDERS.OLLAMA, // Defaults to ollama, for now.
      baseUrl: localStorage.getItem("baseUrl") || "http://localhost:11434",
      // Model Parameters
      modelParameters: {
        temperature: parseFloat(localStorage.getItem("temperature") || "0.7"),
        top_p: parseFloat(localStorage.getItem("top_p") || "0.9"),
        top_k: parseInt(localStorage.getItem("top_k") || "40"),
        presence_penalty: parseFloat(localStorage.getItem("presence_penalty") || "0"),
        frequency_penalty: parseFloat(localStorage.getItem("frequency_penalty") || "0"),
        max_tokens: parseInt(localStorage.getItem("max_tokens") || "2048"),
        repeat_penalty: parseFloat(localStorage.getItem("repeat_penalty") || "1.1"),
        stop: JSON.parse(localStorage.getItem("stopSequences") || "[]"),
      },
      // Chat Interface Settings
      chatSettings: {
        showTimestamps: localStorage.getItem("showTimestamps") === "true" || false,
        showMessageInfo: localStorage.getItem("showMessageInfo") === "true" || false,
        autoScroll: localStorage.getItem("autoScroll") === "true" || true,
        quickPrompts: JSON.parse(localStorage.getItem("quickPrompts") || "[]"),
        editorHeight: parseInt(localStorage.getItem("editorHeight") || "150"),
      },
      // UI Settings
      uiSettings: {
        fontSize: localStorage.getItem("fontSize") || "medium",
        codeBlockTheme: localStorage.getItem("codeBlockTheme") || "default",
        markdownRenderer: localStorage.getItem("markdownRenderer") || "default",
        compactView: localStorage.getItem("compactView") === "true" || false,
        sidebarPosition: localStorage.getItem("sidebarPosition") || "left",
      },
      // Data Management Settings
      dataSettings: {
        enableHistory: localStorage.getItem("enableHistory") === "true" || true,
        autoSaveChats: localStorage.getItem("autoSaveChats") === "true" || true,
        saveFormat: localStorage.getItem("saveFormat") || "json",
        maxStoredChats: parseInt(localStorage.getItem("maxStoredChats") || "50"),
        exportIncludeMetadata: localStorage.getItem("exportIncludeMetadata") === "true" || true,
      },
    };
  },
  computed: {
    quickPromptsList() {
      return this.chatSettings.quickPrompts || [];
    },
    fontSizeClass() {
      const sizes = {
        small: "text-sm",
        medium: "text-base",
        large: "text-lg"
      };
      return sizes[this.uiSettings.fontSize] || "text-base";
    },
    codeThemeClass() {
      return `theme-${this.uiSettings.codeBlockTheme}`;
    },
    compactViewClass() {
      return this.uiSettings.compactView ? "compact-view" : "";
    },
    chatSizeStyle() {
      return {
        width: `${this.chatWidth}px`,
        height: this.uiSettings.compactView ? 'calc(70% - 2rem)' : 'calc(100% - 2rem)'
      };
    },
    editorHeightStyle() {
      return {
        height: `${this.chatSettings.editorHeight}px`
      };
    }
  },
  watch: {
    messages: {
      deep: true,
      handler(newMessages) {
        this.$nextTick(() => {
          this.extractCodeBlocks(newMessages);
          if (this.chatSettings.autoScroll) {
            this.scrollToBottom();
          }
        });
        
        if (this.dataSettings.autoSaveChats) {
          this.saveChatHistory();
        }
      },
    },
    'uiSettings.codeBlockTheme': function() {
      this.$nextTick(() => {
        this.applyHighlighting();
      });
    }
  },
  created() {
    if (this.dataSettings.enableHistory) {
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
      this.llmClient = new LLMClient(this.selectedProvider);
      this.llmClient.setBaseUrl(this.baseUrl);
    },

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
              language: codeBlock.className.replace("language-", "").trim() || "plaintext"
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

    applyQuickPrompt(promptContent) {
      this.userInput = promptContent;
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
          content: `${this.selectedModel} is thinking...`,
          timestamp: new Date().toISOString(),
          timeTaken: null,
          tokenCount: null
        };
        this.messages.push(aiMessage);
        
        if (this.dataSettings.autoSaveChats) {
          this.saveChatHistory();
        }
        
        await this.getStreamingResponse(userMessage.content);
        this.processingResponse = false;
      }
    },

    async getStreamingResponse(input) {
      let messages = [];
      
      if (this.messages.length > 2) {
        const previousMessages = this.messages.slice(-10, -1);
        previousMessages.forEach(msg => {
          messages.push({
            role: msg.sender === "User" ? "user" : "assistant",
            content: msg.sender === "AI" ? this.stripHtml(msg.content) : msg.content
          });
        });
      }
      
      messages.push({ role: "user", content: input });
      
      const options = {
        model: this.selectedModel,
        messages: messages,
        stream: true,
        parameters: this.modelParameters
      };

      try {
        const startTime = Date.now();
        let messageContent = "";
        let tokenCount = 0;
        
        if (!this.llmClient) {
          this.initLLMClient();
        }
        
        const response = await this.llmClient.chat(options);

        for await (const part of response) {
          messageContent += part.message.content;
          tokenCount += 1; // TODO: This is just an approximation. Might implement a better heuristic later.
          this.updateMessage(this.renderMarkdown(messageContent));
        }

        const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
        let finalContent = this.renderMarkdown(messageContent);
        
        let metaInfo = "";
        
        if (this.chatSettings.showTimestamps) {
          metaInfo += `<span class="text-chat-text-accent">took ${timeTaken}s</span>`;
        }
        
        if (this.chatSettings.showMessageInfo) {
          metaInfo += metaInfo ? " · " : "";
          metaInfo += `<span class="text-chat-text-accent">~${tokenCount} tokens</span>`;
        }
        
        // This created a bug where the meta info was sent to the ai...
        /*
        if (metaInfo) {
          finalContent += `<div class="meta-info text-xs mt-2">${metaInfo}</div>`;
        }
          */
        
        this.updateMessage(finalContent, {
          timeTaken: parseFloat(timeTaken),
          tokenCount: tokenCount
        });
        
        this.applyHighlighting();

        setTimeout(() => {
          this.addCodeBlockActions();
        }, 500);

        if (this.dataSettings.autoSaveChats) {
          this.saveChatHistory();
        }
      } catch (error) {
        console.error("LLM request failed:", error);
        this.messages.push({
          id: Date.now(),
          sender: "Error",
          content: `Error: Unable to get a response from ${this.selectedProvider || "the LLM provider"}.`,
          timestamp: new Date().toISOString(),
        });
        
        if (this.dataSettings.autoSaveChats) {
          this.saveChatHistory();
        }
      }
    },
    
    stripHtml(html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || "";
    },

    updateMessage(content, metadata = {}) {
      const lastMessageIndex = this.messages.length - 1;
      this.messages[lastMessageIndex].content = content;
      
      if (metadata.timeTaken !== undefined) {
        this.messages[lastMessageIndex].timeTaken = metadata.timeTaken;
      }
      
      if (metadata.tokenCount !== undefined) {
        this.messages[lastMessageIndex].tokenCount = metadata.tokenCount;
      }
    },

    renderMarkdown(text) {
      if (this.uiSettings.markdownRenderer === "default") {
        return marked(text);
      } else {
        // TODO: implement alternative renderers.
        return marked(text);
      }
    },

    addCodeBlockActions() {
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
          applyButton.className = "apply-button px-2 py-1 text-xs bg-chat-code-apply hover:bg-chat-code-apply-hover rounded transition-colors";
          applyButton.textContent = "Apply to Editor";
          applyButton.onclick = () => this.applyCodeToEditor(codeBlock.textContent);
          
          const copyButton = document.createElement("button");
          copyButton.className = "copy-button px-2 py-1 text-xs bg-chat-code-copy hover:bg-chat-code-copy-hover rounded transition-colors";
          copyButton.textContent = "Copy";
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
      if (!this.dataSettings.enableHistory) return;
      
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
      
      if (chats.length > this.dataSettings.maxStoredChats) {
        chats = chats.slice(0, this.dataSettings.maxStoredChats);
      }
      
      localStorage.setItem("chatHistory", JSON.stringify(chats));
    },

    loadChatHistory() {
      if (!this.dataSettings.enableHistory) return;
      
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

    clearChatHistory() {
      this.messages = [];
      
      if (this.dataSettings.enableHistory) {
        let chats = [];
        try {
          chats = JSON.parse(localStorage.getItem("chatHistory") || "[]");
          chats = chats.filter(chat => chat.id !== "current");
          localStorage.setItem("chatHistory", JSON.stringify(chats));
        } catch (error) {
          console.error("Error clearing chat history:", error);
        }
      }
    },

    formatTime(timestamp) {
      if (!timestamp || !this.chatSettings.showTimestamps) return "";
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    },
    
    exportChat() {
      if (this.messages.length === 0) return;
      
      let content;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      let filename = `chat-export-${timestamp}`;
      let type;
      
      if (this.dataSettings.saveFormat === "json") {
        let exportData = this.messages.map(msg => {
          const base = {
            role: msg.sender === "User" ? "user" : "assistant",
            content: msg.sender === "AI" ? this.stripHtml(msg.content) : msg.content
          };
          
          if (this.dataSettings.exportIncludeMetadata) {
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
      } else if (this.dataSettings.saveFormat === "markdown") {
        content = this.messages.map(msg => {
          let header = `## ${msg.sender === "User" ? "User" : "Assistant"}`;
          if (this.dataSettings.exportIncludeMetadata && msg.timestamp) {
            header += ` (${new Date(msg.timestamp).toLocaleString()})`;
          }
          
          let body = msg.sender === "AI" ? this.stripHtml(msg.content) : msg.content;
          
          let meta = "";
          if (this.dataSettings.exportIncludeMetadata) {
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
      class="fixed right-8 bg-chat-accent p-3 rounded-xl"
      :style="{ bottom: `calc(4rem + 1rem)` }"
    >
      <i class="fas fa-comments"></i>
    </button>
    
    <transition name="slide">
      <div
        v-if="chatOpen"
        class="fixed top-0 right-0 bg-chat-accent rounded-l-lg shadow-lg overflow-hidden flex flex-col z-10"
        :style="chatSizeStyle"
        :class="compactViewClass"
      >
        <div
          class="absolute top-0 left-0 w-1 h-full cursor-ew-resize hover:bg-blue-500"
          @mousedown="startResize"
          :class="{ 'bg-blue-500': isResizing, 'bg-chat-resize-bar': !isResizing }"
        ></div>
        
        <div class="flex justify-between items-center p-4">
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
          class="quick-prompts-container px-4 py-2 mb-1 whitespace-nowrap text-xs font-semibold"
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
                    :class="{ 'mb-2': uiSettings.compactView }"
                  >
                    <div 
                      v-if="message.sender === 'Error'" 
                      class="ai-message text-white bg-red-800 p-3 rounded-lg shadow-lg"
                      :class="{ 'p-2': uiSettings.compactView }"
                    >
                      <p v-html="message.content"></p>
                      <small v-if="message.timestamp && chatSettings.showTimestamps" class="text-white block mt-1">
                        {{ formatTime(message.timestamp) }}
                      </small>
                    </div>
                    
                    <div 
                      v-else-if="message.sender === 'AI'" 
                      class="ai-message bg-chat-secondary p-3 rounded-lg shadow-lg"
                      :class="{ 'p-2': uiSettings.compactView }"
                    >
                      <div 
                        class="prose prose-invert max-w-none" 
                        :class="[codeThemeClass, {'prose-sm': uiSettings.fontSize === 'small' || uiSettings.compactView}]" 
                        v-html="message.content"
                      ></div>
                      
                      <div
                        v-for="block in codeBlocks.filter(b => b.messageIndex === message.id)"
                        :key="block.id"
                        class="mt-2"
                      >
                        <div class="code-actions flex gap-2 mt-2">
                          <button
                            @click="applyCode(block.content)"
                            class="px-2 py-1 text-xs bg-chat-code-apply hover:bg-chat-code-apply-hover rounded transition-colors"
                          >
                            Apply to Editor
                          </button>
                          <button
                            @click="copyCode(block.content)"
                            class="px-2 py-1 text-xs bg-chat-code-copy hover:bg-chat-code-copy-hover rounded transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <small v-if="chatSettings.showMessageInfo && message.timeTaken && message.tokenCount" class="text-chat-text-accent block mt-1">
                        took {{ message.timeTaken }}s · ~{{ message.tokenCount }} tokens
                      </small>
                      <small v-if="message.timestamp && chatSettings.showTimestamps" class="text-chat-text-accent block mt-1">
                        {{ formatTime(message.timestamp) }}
                      </small>
                    </div>
                    
                    <div 
                      v-else 
                      class="user-message bg-chat-accent p-3 rounded-lg text-text-primary shadow-lg"
                      :class="{ 'p-2': uiSettings.compactView }"
                    >
                      <p>{{ message.content }}</p>
                      <small v-if="message.timestamp && chatSettings.showTimestamps" class="text-chat-text-accent block mt-1 text-right">
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
              class="p-2 bg-chat-accent text-text-primary rounded-md w-full mb-2 resize-none"
              :style="editorHeightStyle"
              @keydown.enter.prevent="sendMessage"
              :disabled="processingResponse"
            ></textarea>
            
            <button
              @click="sendMessage"
              class="p-2 bg-chat-secondary text-text-primary rounded-md w-full hover:bg-chat-primary transition shadow-lg"
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
