<script>
import ollama from 'ollama/browser';
export default {
  data() {
    return {
      ollamaStatus: "Checking...",
      availableModels: [],
      selectedModel: localStorage.getItem("selectedModel")
    };
  },
  created() {
    this.checkOllamaStatus();
    this.fetchAvailableModels();
  },
  methods: {
    async checkOllamaStatus() {
      try {
        const response = await ollama.list();
        if (response) {
          this.ollamaStatus = "Ollama is running";
        } else {
          this.ollamaStatus = "Ollama is not running";
        }
      } catch (error) {
        this.ollamaStatus = "Ollama is not running";
      }
    },

    async fetchAvailableModels() {
      try {
        const response = await ollama.list();
        if (response && response.models) {
          this.availableModels = response.models.map(model => model.name);
        }
      } catch (error) {
        console.error("Error fetching models:", error);
        this.availableModels = [];
      }
    },

    saveSettings() {
      localStorage.setItem("ollamaStatus", this.ollamaStatus);
      localStorage.setItem("selectedModel", this.selectedModel);
      console.log("Settings saved:", {
        selectedModel: this.selectedModel,
      });
    }
  }
};
</script>

<template>
  <div class="flex flex-col h-screen bg-neutral-800 text-white">
    <h1 class="text-2xl font-bold mb-4 mx-2 my-2">Settings</h1>

    <!-- Ollama Status -->
    <div class="setting-item bg-neutral-900 mb-4 rounded-xl p-2 mx-2">
      <label class="block mx-2">Ollama Status:</label>
      <p class="mx-2">{{ ollamaStatus }}</p>

      <div class="setting-item mb-4 mx-2">
        <label for="model" class="block">Select Model:</label>
        <select id="model" v-model="selectedModel" class="outline outline-neutral-700 mt-2 p-2 text-black rounded-md">
          <option v-for="model in availableModels" :key="model" :value="model">{{ model }}</option>
        </select>
      </div>
    </div>

    <div class="mt-4 mx-2">
      <button @click="saveSettings" class="p-2 bg-blue-600 text-white rounded-md">Save Settings</button>
    </div>
  </div>
</template>

<style>
@import "tailwindcss";
</style>