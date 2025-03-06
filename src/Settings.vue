<script lang="ts">
import { LLMClient, PROVIDERS } from './lib/llm-client';
import type { ModelParameters } from './lib/llm-client';
import ThemeSelector from './components/ThemeSelector.vue';

type LLMStatus = {
  status: string;
  message: string;
  lastChecked: string;
};

type QuickPrompt = {
  title: string;
  content: string;
};

interface ChatSettings {
  showTimestamps: boolean;
  showMessageInfo: boolean;
  autoScroll: boolean;
  quickPrompts: QuickPrompt[];
  editorHeight: number;
}

interface UISettings {
  fontSize: string;
  codeBlockTheme: string;
  markdownRenderer: string;
  compactView: boolean;
  sidebarPosition: string;
}

interface DataSettings {
  enableHistory: boolean;
  autoSaveChats: boolean;
  saveFormat: string;
  maxStoredChats: number;
  exportIncludeMetadata: boolean;
}

export default {
  components: { ThemeSelector },
  data() {
    return {
      llmClient: null as LLMClient | null,
      llmStatus: {
        status: "checking",
        message: "Checking LLM connection..."
      } as LLMStatus,
      availableModels: [] as string[],
      selectedModel: localStorage.getItem("selectedModel") || "",
      selectedProvider: localStorage.getItem("selectedProvider") || PROVIDERS.OLLAMA,
      baseUrl: localStorage.getItem("baseUrl") || "http://localhost:11434",
      isRefreshing: false,
      providers: Object.values(PROVIDERS),
      activeCategory: 'llm-connection',  // Default active category
      
      // Model Parameters
      modelParameters: {
        temperature: parseFloat(localStorage.getItem("temperature") || "0.7"),
        top_p: parseFloat(localStorage.getItem("top_p") || "0.9"),
        top_k: parseInt(localStorage.getItem("top_k") || "40"),
        presence_penalty: parseFloat(localStorage.getItem("presence_penalty") || "0"),
        frequency_penalty: parseFloat(localStorage.getItem("frequency_penalty") || "0"),
        max_tokens: parseInt(localStorage.getItem("max_tokens") || "2048"),
        repeat_penalty: parseFloat(localStorage.getItem("repeat_penalty") || "1.1"),
      } as ModelParameters,
      
      // Chat Interface Settings
      chatSettings: {
        showTimestamps: localStorage.getItem("showTimestamps") === "true" || true,
        showMessageInfo: localStorage.getItem("showMessageInfo") === "true" || true,
        autoScroll: localStorage.getItem("autoScroll") === "true" || true,
        quickPrompts: JSON.parse(localStorage.getItem("quickPrompts") || "[]"),
        editorHeight: parseInt(localStorage.getItem("editorHeight")|| "150"),
      } as ChatSettings,
      
      // UI Settings
      uiSettings: {
        fontSize: localStorage.getItem("fontSize") || "medium",
        codeBlockTheme: localStorage.getItem("codeBlockTheme") || "default",
        markdownRenderer: localStorage.getItem("markdownRenderer") || "default",
        compactView: localStorage.getItem("compactView") === "true" || false,
        sidebarPosition: localStorage.getItem("sidebarPosition") || "left",
      } as UISettings,

      // Data Management Settings
      dataSettings: {
        enableHistory: localStorage.getItem("enableHistory") === "true" || true,
        autoSaveChats: localStorage.getItem("autoSaveChats") === "true" || true,
        saveFormat: localStorage.getItem("saveFormat") || "json",
        maxStoredChats: parseInt(localStorage.getItem("maxStoredChats") || "50"),
        exportIncludeMetadata: localStorage.getItem("exportIncludeMetadata") === "true" || true,
      } as DataSettings,
      
      // New quick prompt input
      newQuickPromptTitle: "",
      newQuickPromptContent: "",
      
      // Custom stop sequences
      stopSequences: JSON.parse(localStorage.getItem("stopSequences") || "[]"),
      newStopSequence: "",
    };
  },
  created() {
    this.initClient();
    this.checkLLMStatus();
  },
  methods: {
    eraseHistory(): void {
      localStorage.removeItem("chatHistory");
    },
    setActiveCategory(category: string) {
      this.activeCategory = category;
    },
    initClient(): void {
      try {
        this.llmClient = new LLMClient(this.selectedProvider);
        if (this.llmClient) {
          this.llmClient.setBaseUrl(this.baseUrl);
        }
      } catch (error: unknown) {
        console.error("Error initializing LLM client:", error);
        this.llmStatus = { 
          status: "error", 
          message: "Error initializing client: " + (error instanceof Error ? error.message : String(error)),
          lastChecked: "Never"
        };
      }
    },
    
    async checkLLMStatus(): Promise<void> {
      this.llmStatus = { status: "checking", message: "Checking LLM connection...", lastChecked: new Date().toLocaleString() };

      try {
        const timeoutPromise = new Promise<boolean>((_, reject) => {
          setTimeout(() => reject(new Error("Connection timed out")), 5000);
        });

        if (!this.llmClient) {
          throw new Error("LLM client not initialized");
        }

        const isRunning = await Promise.race([
          this.llmClient.isRunning(),
          timeoutPromise
        ]);

        if (isRunning) {
          this.llmStatus = { 
            status: "online", 
            message: `${this.selectedProvider} is running`,
            lastChecked: this.llmStatus.lastChecked
          };
          this.fetchAvailableModels();
        } else {
          this.llmStatus = { 
            status: "offline", 
            message: `${this.selectedProvider} is not running`,
            lastChecked: this.llmStatus.lastChecked
          };
        }
      } catch (error: unknown) {
        console.error("LLM connection error:", error);
        this.llmStatus = { 
          status: "offline", 
          message: error instanceof Error && error.message === "Connection timed out"
            ? "Connection timed out"
            : `${this.selectedProvider} is not running`,
          lastChecked: this.llmStatus.lastChecked
        };
      }
    },

    async fetchAvailableModels(): Promise<void> {
      this.isRefreshing = true;

      try {
        if (!this.llmClient) {
          throw new Error("LLM client not initialized");
        }
        
        const models = await this.llmClient.listModels();
        this.availableModels = models.map((model: any) => model.name);

        if (!this.selectedModel && this.availableModels.length > 0) {
          this.selectedModel = this.availableModels[0];
        }
      } catch (error: unknown) {
        console.error("Error fetching models:", error);
        this.availableModels = [];
      } finally {
        this.isRefreshing = false;
      }
    },

    async refreshModels(): Promise<void> {
      if (this.isRefreshing) return;

      await this.checkLLMStatus();
      if (this.llmStatus.status === "online") {
        await this.fetchAvailableModels();
      }
    },
    
    updateProvider(): void {
      this.initClient();
      this.checkLLMStatus();
    },
    
    updateBaseUrl(): void {
      if (this.baseUrl && this.llmClient) {
        this.llmClient.setBaseUrl(this.baseUrl);
        this.checkLLMStatus();
      }
    },
    
    addQuickPrompt(): void {
      if (this.newQuickPromptTitle && this.newQuickPromptContent) {
        this.chatSettings.quickPrompts.push({
          title: this.newQuickPromptTitle,
          content: this.newQuickPromptContent
        });
        this.newQuickPromptTitle = "";
        this.newQuickPromptContent = "";
      }
    },
    
    removeQuickPrompt(index: number): void {
      this.chatSettings.quickPrompts.splice(index, 1);
    },
    
    addStopSequence(): void {
      if (this.newStopSequence && !this.stopSequences.includes(this.newStopSequence)) {
        this.stopSequences.push(this.newStopSequence);
        this.newStopSequence = "";
      }
    },
    
    removeStopSequence(index: number) {
      this.stopSequences.splice(index, 1);
    },
    
    resetToDefaults(): void {
      this.modelParameters = {
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        presence_penalty: 0,
        frequency_penalty: 0,
        max_tokens: 2048,
        repeat_penalty: 1.1,
      };
      
      this.chatSettings = {
        showTimestamps: true,
        showMessageInfo: true,
        autoScroll: true,
        quickPrompts: [],
        editorHeight: 150,
      };
      
      this.uiSettings = {
        fontSize: "medium",
        codeBlockTheme: "default",
        markdownRenderer: "default",
        compactView: false,
        sidebarPosition: "left",
      };
      
      this.dataSettings = {
        enableHistory: true,
        autoSaveChats: true,
        saveFormat: "json",
        maxStoredChats: 50,
        exportIncludeMetadata: true,
      };
      
      this.stopSequences = [];
      
      this.showToast("Settings reset to defaults");
    },
    
    saveSettings(): void {
      // LLM Connection Settings
      localStorage.setItem("selectedModel", this.selectedModel);
      localStorage.setItem("selectedProvider", this.selectedProvider);
      localStorage.setItem("baseUrl", this.baseUrl);
      
      // Model Parameters
      for (const [key, value] of Object.entries(this.modelParameters)) {
        localStorage.setItem(key, value.toString());
      }
      
      // Chat Interface Settings
      for (const [key, value] of Object.entries(this.chatSettings)) {
        if (key === "quickPrompts") {
          localStorage.setItem(key, JSON.stringify(value));
        } else {
          localStorage.setItem(key, value.toString());
        }
      }
      
      // UI Settings
      for (const [key, value] of Object.entries(this.uiSettings)) {
        localStorage.setItem(key, value.toString());
      }
      
      // Data Management Settings
      for (const [key, value] of Object.entries(this.dataSettings)) {
        localStorage.setItem(key, value.toString());
      }
      
      // Stop Sequences
      localStorage.setItem("stopSequences", JSON.stringify(this.stopSequences));
      
      console.log("Settings saved successfully");
      this.showToast("Settings saved successfully");
    },
    
    showToast(message: string) {
      const toast = document.createElement("div");
      toast.className = "absolute left-1/2 transform -translate-x-1/2 bg-secondary text-text-primary px-4 py-2 rounded-4xl shadow-lg";
      toast.innerText = message;
      const container = document.querySelector(".relative");
      container?.appendChild(toast);

      setTimeout(() => {
        toast.classList.add("opacity-0", "transition-opacity", "duration-500");
        setTimeout(() => container?.removeChild(toast), 500);
      }, 3000);
    }
  }
};
</script>

<template>
  <div class="flex h-full">

    <!-- Sidebar Navigation -->
    <div class="w-64 bg-secondary border-r border-border-accent h-full overflow-y-auto">
      <h1 class="text-xl font-bold p-4 border-b border-border-accent">Settings</h1>
      
      <nav class="py-2">
        <button 
          @click="setActiveCategory('llm-connection')" 
          class="w-full px-4 py-3 text-left transition-colors flex items-center space-x-2"
          :class="activeCategory === 'llm-connection' ? 'bg-primary text-text-primary font-medium' : 'text-text-secondary hover:bg-accent'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>LLM Connection</span>
        </button>
        
        <button 
          @click="setActiveCategory('model-parameters')" 
          class="w-full px-4 py-3 text-left transition-colors flex items-center space-x-2"
          :class="activeCategory === 'model-parameters' ? 'bg-primary text-text-primary font-medium' : 'text-text-secondary hover:bg-accent'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Model Parameters</span>
        </button>
        
        <button 
          @click="setActiveCategory('chat-interface')" 
          class="w-full px-4 py-3 text-left transition-colors flex items-center space-x-2"
          :class="activeCategory === 'chat-interface' ? 'bg-primary text-text-primary font-medium' : 'text-text-secondary hover:bg-accent'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span>Chat Interface</span>
        </button>
        
        <button 
          @click="setActiveCategory('ui-settings')" 
          class="w-full px-4 py-3 text-left transition-colors flex items-center space-x-2"
          :class="activeCategory === 'ui-settings' ? 'bg-primary text-text-primary font-medium' : 'text-text-secondary hover:bg-accent'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <span>UI Settings</span>
        </button>
        
        <button 
          @click="setActiveCategory('data-management')" 
          class="w-full px-4 py-3 text-left transition-colors flex items-center space-x-2"
          :class="activeCategory === 'data-management' ? 'bg-primary text-text-primary font-medium' : 'text-text-secondary hover:bg-accent'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <span>Data Management</span>
        </button>
      </nav>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto p-4">

      <!-- LLM Connection Settings -->
      <div v-if="activeCategory === 'llm-connection'" class="space-y-8">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-xl font-bold">LLM Connection</h2>
          <button 
            @click="checkLLMStatus" 
            class="px-3 py-1 bg-primary hover:bg-accent-hover rounded-md shadow-xl border border-border-accent transition-colors text-sm flex items-center space-x-1"
          >
            <div 
              :class="{
                'w-2 h-2 rounded-full': true,
                'bg-green-500': llmStatus.status === 'online',
                'bg-red-500': llmStatus.status === 'offline' || llmStatus.status === 'error',
                'bg-yellow-500 animate-pulse': llmStatus.status === 'checking'
              }"
            ></div>
            <span>{{ llmStatus.status === 'checking' ? 'Checking...' : 'Check Connection' }}</span>
          </button>
        </div>

        <div class="border-t border-border-accent my-4"></div>

        <!-- Provider & Connection -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

          <!-- LLM Provider Selection -->
          <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
            <h3 class="font-semibold mb-3">Provider Settings</h3>
            
            <div class="space-y-3">
              <div>
                <label for="provider" class="block mb-1 text-sm font-medium">Provider:</label>
                <select 
                  id="provider" 
                  v-model="selectedProvider" 
                  @change="updateProvider"
                  class="w-full bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-1 text-sm"
                >
                  <option v-for="provider in providers" :key="provider" :value="provider">{{ provider }}</option>
                </select>
              </div>
              
              <div>
                <label for="baseUrl" class="block mb-1 text-sm font-medium">Base URL:</label>
                <div class="flex gap-2">
                  <input 
                    id="baseUrl" 
                    v-model="baseUrl" 
                    type="text" 
                    placeholder="http://localhost:11434"
                    class="flex-1 bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-1 text-sm"
                  />
                  <button 
                    @click="updateBaseUrl" 
                    class="px-3 bg-accent hover:bg-accent-hover rounded-md transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- LLM Status & Connection -->
          <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
            <h3 class="font-semibold mb-3">Connection Status</h3>
            
            <div class="flex items-center mb-3">
              <div 
                :class="{
                  'w-3 h-3 rounded-full mr-2': true,
                  'bg-green-500': llmStatus.status === 'online',
                  'bg-red-500': llmStatus.status === 'offline' || llmStatus.status === 'error',
                  'bg-yellow-500 animate-pulse': llmStatus.status === 'checking'
                }"
              ></div>
              <span class="text-sm">{{ llmStatus.message }}</span>
            </div>
            
            <div class="text-sm text-text-secondary">
              Last checked: {{ llmStatus.lastChecked || 'Never' }}
            </div>
          </div>
        </div>

        <!-- Model Selection -->
        <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
          <div class="flex justify-between items-center mb-3">
            <h3 class="font-semibold">Model Selection</h3>
            <button 
              @click="refreshModels" 
              class="p-1 bg-accent hover:bg-accent-hover rounded-md transition-colors flex items-center justify-center"
              :disabled="isRefreshing || llmStatus.status !== 'online'"
              :class="{ 'opacity-50 cursor-not-allowed': isRefreshing || llmStatus.status !== 'online' }"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" :class="{ 'animate-spin': isRefreshing }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          
          <div class="flex gap-2">
            <select 
              id="model" 
              v-model="selectedModel" 
              class="flex-1 bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-1 text-sm"
              :disabled="availableModels.length === 0 || llmStatus.status !== 'online'"
            >
              <option v-if="availableModels.length === 0" value="" disabled>No models available</option>
              <option v-for="model in availableModels" :key="model" :value="model">{{ model }}</option>
            </select>
          </div>
          
          <p class="mt-2 text-xs text-text-secondary">
            {{ availableModels.length > 0 ? 
              `${availableModels.length} model(s) available` : 
              (llmStatus.status === 'online' ? 'No models found. Try refreshing the list.' : 'Connect to your LLM provider to view available models') 
            }}
          </p>
        </div>
      </div>
      
      <!-- Model Parameters Settings -->
      <div v-if="activeCategory === 'model-parameters'" class="space-y-8">
        <h2 class="text-xl font-bold mb-2">Model Parameters</h2>

        <div class="border-t border-border-accent my-4"></div>

        <!-- Basic Parameters -->
        <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
          <h3 class="font-semibold mb-3">Basic Parameters</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="temperature" class="block mb-1 text-sm font-medium">Temperature: {{ modelParameters.temperature }}</label>
              <input 
                id="temperature" 
                v-model="modelParameters.temperature" 
                type="range" 
                min="0" 
                max="2" 
                step="0.05"
                class="w-full"
              />
              <div class="flex justify-between text-xs text-text-secondary mt-1">
                <span>Deterministic (0)</span>
                <span>Creative (2.0)</span>
              </div>
            </div>
            
            <div>
              <label for="maxTokens" class="block mb-1 text-sm font-medium">Max Output Tokens:</label>
              <input 
                id="maxTokens" 
                v-model="modelParameters.max_tokens" 
                type="number" 
                min="128" 
                max="8192"
                class="w-full bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-1 text-sm"
              />
              <p class="mt-1 text-xs text-text-secondary">Maximum tokens to generate</p>
            </div>
          </div>
        </div>
        
        <!-- Sampling Parameters -->
        <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold">Sampling Parameters</h3>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="top_p" class="block mb-1 text-sm font-medium">Top-p (Nucleus): {{ modelParameters.top_p }}</label>
              <input 
                id="top_p" 
                v-model="modelParameters.top_p" 
                type="range" 
                min="0.1" 
                max="1" 
                step="0.05"
                class="w-full"
              />
              <p class="mt-1 text-xs text-text-secondary">Only sample from the top tokens whose probabilities add up to top_p</p>
            </div>
            
            <div>
              <label for="top_k" class="block mb-1 text-sm font-medium">Top-k: {{ modelParameters.top_k }}</label>
              <input 
                id="top_k" 
                v-model="modelParameters.top_k" 
                type="range" 
                min="1" 
                max="100" 
                step="1"
                class="w-full"
              />
              <p class="mt-1 text-xs text-text-secondary">Only sample from the top-k tokens</p>
            </div>
          </div>
        </div>
        
        <!-- Penalty Parameters -->
        <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold">Penalty Parameters</h3>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label for="repeat_penalty" class="block mb-1 text-sm font-medium">Repeat Penalty: {{ modelParameters.repeat_penalty }}</label>
              <input 
                id="repeat_penalty" 
                v-model="modelParameters.repeat_penalty" 
                type="range" 
                min="1" 
                max="2" 
                step="0.05"
                class="w-full"
              />
              <p class="mt-1 text-xs text-text-secondary">Penalty for repeating tokens (higher values = less repetition)</p>
            </div>
            
            <div>
              <label for="presence_penalty" class="block mb-1 text-sm font-medium">Presence: {{ modelParameters.presence_penalty }}</label>
              <input 
                id="presence_penalty" 
                v-model="modelParameters.presence_penalty" 
                type="range" 
                min="-2" 
                max="2" 
                step="0.1"
                class="w-full"
              />
              <p class="mt-1 text-xs text-text-secondary">Penalty for token presence (positive = encourage new topics)</p>
            </div>
            
            <div>
              <label for="frequency_penalty" class="block mb-1 text-sm font-medium">Frequency: {{ modelParameters.frequency_penalty }}</label>
              <input 
                id="frequency_penalty" 
                v-model="modelParameters.frequency_penalty" 
                type="range" 
                min="-2" 
                max="2" 
                step="0.1"
                class="w-full"
              />
              <p class="mt-1 text-xs text-text-secondary">Penalty for token frequency (positive = discourage frequent tokens)</p>
            </div>
          </div>
        </div>
        
        <!-- Stop Sequences -->
        <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
          <h3 class="font-semibold mb-3">Stop Sequences</h3>
          
          <div class="flex gap-2 mb-3">
            <input 
              v-model="newStopSequence" 
              type="text" 
              placeholder="Enter stop sequence"
              class="flex-1 bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-1 text-sm"
            />
            <button 
              @click="addStopSequence" 
              class="px-3 bg-accent hover:bg-accent-hover rounded-md transition-colors"
              :disabled="!newStopSequence"
            >
              Add
            </button>
          </div>
          
          <div class="flex flex-wrap gap-2">
            <div v-if="stopSequences.length === 0" class="text-sm text-text-secondary italic">
              No stop sequences defined
            </div>
            
            <div 
              v-for="(sequence, index) in stopSequences" 
              :key="index"
              class="flex items-center bg-accent rounded-md px-2 py-1"
            >
              <code class="text-xs mr-2">{{ sequence }}</code>
              <button 
                @click="removeStopSequence(index)" 
                class="text-red-500 hover:text-red-700"
                title="Remove"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Interface Settings -->
      <div v-if="activeCategory === 'chat-interface'" class="space-y-8">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-xl font-bold">Chat Interface</h2>
        </div>

        <div class="border-t border-border-accent my-4"></div>

        <!-- Input-Display-Theme Settings -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <!-- Input Settings -->
          <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
            <h3 class="font-semibold mb-3">Input Settings</h3>
            
            <div class="space-y-3">
              <div>
                <label for="provider" class="block mb-1 text-sm font-medium">Input Editor Height (px:):</label>
                <input 
                  id="editorHeight" 
                  v-model="chatSettings.editorHeight" 
                  type="number" 
                  min="50" 
                  max="500"
                  class="w-full bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-2"
                />
              </div>
              
              <div>
                <input 
                  id="autoScroll" 
                  v-model="chatSettings.autoScroll" 
                  type="checkbox" 
                  class="w-4 h-4 mr-2 accent-accent"
                />
                <label for="autoScroll" class="font-medium ">Auto-scroll to latest message</label>
              </div>
            </div>
          </div>

          <!-- Display Settings -->
          <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
            <h3 class="font-semibold mb-3">Display Settings</h3>
            
            <div class="flex items-center mb-3">
              <input 
                id="showTimestamps" 
                v-model="chatSettings.showTimestamps" 
                type="checkbox" 
                class="w-4 h-4 mr-2 accent-accent"
              />
              <label for="showTimestamps" class="font-medium">Show message timestamps</label>
            </div>
            
            <div class="flex items-center mb-4">
              <input 
                id="showMessageInfo" 
                v-model="chatSettings.showMessageInfo" 
                type="checkbox" 
                class="w-4 h-4 mr-2 accent-accent"
              />
              <label for="showMessageInfo" class="font-medium">Show additional message info</label>
            </div>
          </div>

          <!-- Theme Selector -->
          <ThemeSelector class="shadow-xl border border-border-accent"></ThemeSelector>
        </div>

        <!-- Quick Prompts -->
        <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
          <h2 class="text-xl font-semibold mb-4">Quick Prompts</h2>
        
          <div class="mb-4">
            <label class="block mb-2 font-medium">Add New Quick Prompt:</label>
            
            <input 
              v-model="newQuickPromptTitle" 
              type="text" 
              placeholder="Title"
              class="w-full bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-2 mb-2"
            />
            
            <textarea 
              v-model="newQuickPromptContent" 
              placeholder="Prompt content..."
              class="w-full bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-2 mb-2"
              rows="3"
            ></textarea>
            
            <button 
              @click="addQuickPrompt" 
              class="px-4 py-2 bg-accent hover:bg-accent-hover rounded-md transition-colors"
              :disabled="!newQuickPromptTitle || !newQuickPromptContent"
            >
              Add Quick Prompt
            </button>
          </div>
          
          <div class="space-y-3 mt-4">
            <div v-if="chatSettings.quickPrompts.length === 0" class="text-sm text-text-secondary italic">
              No quick prompts defined
            </div>
            
            <div 
              v-for="(prompt, index) in chatSettings.quickPrompts" 
              :key="index"
              class="bg-accent rounded-md p-3"
            >
              <div class="flex justify-between items-center mb-2">
                <h3 class="font-medium">{{ prompt.title }}</h3>
                <button 
                  @click="removeQuickPrompt(index)" 
                  class="text-red-500 hover:text-red-700"
                  title="Remove"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p class="text-sm text-text-secondary break-words">{{ prompt.content }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- UI Settings -->
      <div v-if="activeCategory === 'ui-settings'" class="space-y-8">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-xl font-bold">UI Settings</h2>
        </div>

        <div class="border-t border-border-accent my-4"></div>

        <!-- Font-Display-Layout Settings -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <!-- Font Settings -->
          <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
            <h2 class="text-xl font-semibold mb-4">Font Settings</h2>
    
            <div class="mb-4">
              <label for="fontSize" class="block mb-2 font-medium">Font Size:</label>
              <select 
                id="fontSize" 
                v-model="uiSettings.fontSize" 
                class="w-full bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-2"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>

          <!-- Display Formatting -->
          <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
            <h2 class="text-xl font-semibold mb-4">Display Formatting</h2>
            
            <div class="mb-4">
              <label for="codeBlockTheme" class="block mb-2 font-medium">Code Block Theme:</label>
              <select 
                id="codeBlockTheme" 
                v-model="uiSettings.codeBlockTheme" 
                class="w-full bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-2"
              >
                <option value="default">Default</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
            
            <div class="mb-4">
              <label for="markdownRenderer" class="block mb-2 font-medium">Markdown Renderer:</label>
              <select 
                id="markdownRenderer" 
                v-model="uiSettings.markdownRenderer" 
                class="w-full bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-2"
              >
                <option value="default">Default</option>
                <option value="enhanced">Enhanced</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
          </div>

          <!-- Layout Settings -->
          <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
            <h2 class="text-xl font-semibold mb-4">Layout Settings</h2>
            
            <div class="flex items-center mb-4">
              <input 
                id="compactView" 
                v-model="uiSettings.compactView" 
                type="checkbox" 
                class="w-4 h-4 mr-2 accent-accent"
              />
              <label for="compactView" class="font-medium">Compact View</label>
            </div>
            
            <div class="mb-4">
              <label for="sidebarPosition" class="block mb-2 font-medium">Sidebar Position:</label>
              <select 
                id="sidebarPosition" 
                v-model="uiSettings.sidebarPosition" 
                class="w-full bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-2"
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Data Management Settings -->
      <div v-if="activeCategory === 'data-management'" class="space-y-10">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-xl font-bold">Data Management</h2>
        </div>

        <div class="border-t border-border-accent my-4"></div>

        <!-- Chat-Saving-Export-Privacy settings -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Chat History -->
          <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
            <h2 class="text-xl font-semibold mb-4">Chat History</h2>
    
            <div class="flex items-center mb-4">
              <input 
                id="enableHistory" 
                v-model="dataSettings.enableHistory" 
                type="checkbox" 
                class="w-4 h-4 mr-2 accent-accent"
              />
              <label for="enableHistory" class="font-medium">Enable Chat History</label>
            </div>
            
            <div class="mb-4">
              <label for="maxStoredChats" class="block mb-2 font-medium">Maximum Stored Chats:</label>
              <input 
                id="maxStoredChats" 
                v-model="dataSettings.maxStoredChats" 
                type="number" 
                min="1" 
                max="1000"
                class="w-full bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-2"
              />
              <p class="mt-1 text-xs text-text-secondary">Oldest chats will be removed when this limit is reached</p>
            </div>
          </div>

          <!-- Saving & Export -->
          <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
            <h2 class="text-xl font-semibold mb-4">Saving & Export</h2>
            
            <div class="flex items-center mb-4">
              <input 
                id="autoSaveChats" 
                v-model="dataSettings.autoSaveChats" 
                type="checkbox" 
                class="w-4 h-4 mr-2 accent-accent"
              />
              <label for="autoSaveChats" class="font-medium">Auto-save Chats</label>
            </div>
            
            <div class="mb-4">
              <label for="saveFormat" class="block mb-2 font-medium">Save Format:</label>
              <select 
                id="saveFormat" 
                v-model="dataSettings.saveFormat" 
                class="w-full bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-2"
              >
                <option value="json">JSON</option>
                <option value="markdown">Markdown</option>
                <option value="txt">Plain Text</option>
              </select>
            </div>
            
            <div class="flex items-center mb-4">
              <input 
                id="exportIncludeMetadata" 
                v-model="dataSettings.exportIncludeMetadata" 
                type="checkbox" 
                class="w-4 h-4 mr-2 accent-accent"
              />
              <label for="exportIncludeMetadata" class="font-medium">Include Metadata in Exports</label>
            </div>
          </div>

          <!-- Data privacy -->
          <div class="bg-primary rounded-lg p-4 shadow-xl border border-border-accent">
            <h2 class="text-xl font-semibold mb-4">Data privacy</h2>
            
            <button
              @click="eraseHistory"
              class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors mb-2"
            >
              Clear All Chat History
            </button>
            
            <p class="text-xs text-text-secondary">This will permanently delete all locally stored chat history</p>
          </div>
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div class="border-t border-border-accent mt-6 pt-4 flex justify-between">
        <button 
          @click="resetToDefaults" 
          class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors mb-2"
        >
          Reset to Defaults
        </button>
        
        <button 
          @click="saveSettings" 
          class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors mb-2"
        >
          Save Settings
        </button>
      </div>
    </div>
  </div>
</template>

<style></style>