<script>
import ollama from 'ollama/browser';
import ThemeSelector from './components/ThemeSelector.vue';

export default {
  components: { ThemeSelector },
  data() {
    return {
      ollamaStatus: {
        status: "checking",
        message: "Checking Ollama connection..."
      },
      availableModels: [],
      selectedModel: localStorage.getItem("selectedModel") || "",
      isRefreshing: false
    };
  },
  created() {
    this.checkOllamaStatus();
  },
  methods: {
    async checkOllamaStatus() {
      this.ollamaStatus = { status: "checking", message: "Checking Ollama connection..." };

      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Connection timed out")), 5000);
        });

        const response = await Promise.race([
          ollama.list(),
          timeoutPromise
        ]);

        if (response) {
          this.ollamaStatus = { 
            status: "online", 
            message: "Ollama is running"
          };
          this.fetchAvailableModels();
        } else {
          this.ollamaStatus = { 
            status: "offline", 
            message: "Ollama is not running" 
          };
        }
      } catch (error) {
        console.error("Ollama connection error:", error);
        this.ollamaStatus = { 
          status: "offline", 
          message: error.message === "Connection timed out"
            ? "Connection to Ollama timed out"
            : "Ollama is not running"
        };
      }
    },

    async fetchAvailableModels() {
      this.isRefreshing = true;

      try {
        const response = await ollama.list();
        if (response && response.models) {
          this.availableModels = response.models.map(model => model.name);

          if (!this.selectedModel && this.availableModels.length > 0) {
            this.selectedModel = this.availableModels[0];
          }
        }
      } catch (error) {
        console.error("Error fetching models:", error);
        this.availableModels = [];
      } finally {
        this.isRefreshing = false;
      }
    },

    async refreshModels() {
      if (this.isRefreshing) return;

      await this.checkOllamaStatus();
      if (this.ollamaStatus.status == "online") {
        await this.fetchAvailableModels();
      }
    },
    saveSettings() {
      localStorage.setItem("selectedModel", this.selectedModel);
      console.log("Settings saved:", {
        selectedModel: this.selectedModel,
      });

      this.showToast("Settings saved successfully");
    },
    showToast(message) {
      const toast = document.createElement("div");
      toast.className = "fixed bottom-4 right-4 bg-green-500 text-text-primary px-4 py-2 rounded-md shadow-lg";
      toast.innerText = message;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.classList.add("opacity-0", "transition-opacity", "duration-500");
        setTimeout(() => document.body.removeChild(toast), 500);
      }, 3000);
    }
  }
};
</script>

<template>
  <div class="flex flex-col h-screen bg-secondary text-text-primary p-6">
    <h1 class="text-2xl font-bold mb-6">Settings</h1>
    
    <!-- Ollama Status -->
    <div class="bg-primary rounded-xl p-6 mb-6 shadow-lg">
      <h2 class="text-xl font-semibold mb-4">Ollama Connection</h2>
      
      <div class="flex items-center mb-4">
        <div 
          :class="{
            'w-3 h-3 rounded-full mr-3': true,
            'bg-green-500': ollamaStatus.status === 'online',
            'bg-red-500': ollamaStatus.status === 'offline',
            'bg-yellow-500 animate-pulse': ollamaStatus.status === 'checking'
          }"
        ></div>
        <span class="font-medium">{{ ollamaStatus.message }}</span>
      </div>
      
      <button 
        @click="checkOllamaStatus" 
        class="px-4 py-2 bg-accent hover:bg-accent-hover rounded-md transition-colors"
        :disabled="ollamaStatus.status === 'checking'"
      >
        <span v-if="ollamaStatus.status === 'checking'">Checking...</span>
        <span v-else>Check Connection</span>
      </button>
    </div>
    
    <!-- Model Selection -->
    <div class="bg-primary rounded-xl p-6 mb-6 shadow-lg">
      <h2 class="text-xl font-semibold mb-4">Model Selection</h2>
      
      <div class="mb-4">
        <label for="model" class="block mb-2 font-medium">Select Model:</label>
        <div class="flex gap-2">
          <select 
            id="model" 
            v-model="selectedModel" 
            class="w-full bg-accent border border-border-accent text-text-primary p-2 rounded-md focus:outline-none focus:ring-2"
            :disabled="availableModels.length === 0 || ollamaStatus.status !== 'online'"
          >
            <option v-if="availableModels.length === 0" value="" disabled>No models available</option>
            <option v-for="model in availableModels" :key="model" :value="model">{{ model }}</option>
          </select>
          
          <button 
            @click="refreshModels" 
            class="px-3 bg-accent hover:bg-accent-hover rounded-md transition-colors flex items-center justify-center"
            :disabled="isRefreshing || ollamaStatus.status !== 'online'"
            :class="{ 'opacity-50 cursor-not-allowed': isRefreshing || ollamaStatus.status !== 'online' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" :class="{ 'animate-spin': isRefreshing }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <p class="mt-2 text-sm text-text-secondary" v-if="availableModels.length > 0">
          {{ availableModels.length }} model(s) available
        </p>
        <p class="mt-2 text-sm text-text-secondary" v-else-if="ollamaStatus.status === 'online'">
          No models found. Try refreshing the list.
        </p>
        <p class="mt-2 text-sm text-text-secondary" v-else>
          Connect to Ollama to view available models
        </p>
      </div>
    </div>

    <ThemeSelector></ThemeSelector>
    
    <!-- Save Button -->
    <div class="mt-auto">
      <button 
        @click="saveSettings" 
        class="px-6 py-3 bg-settings-button-primary hover:bg-settings-button-primary-hover text-text-primary rounded-md transition-colors font-medium"
        :disabled="!selectedModel && ollamaStatus.status === 'online'"
      >
        Save Settings
      </button>
    </div>
  </div>
</template>

<style>
@import "tailwindcss";
</style>