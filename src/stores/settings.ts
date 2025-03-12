import { defineStore } from 'pinia';
import { PROVIDERS } from '../lib/llm-client';
import { LLMStatus } from '../Settings.vue';

interface QuickPrompt {
  id: number,
  title: string;
  content: string;
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    // LLM Connection
    llmConnection: {
      selectedModel: localStorage.getItem("selectedModel") || "",
      selectedProvider: localStorage.getItem("selectedProvider") || PROVIDERS.OLLAMA,
      baseUrl: localStorage.getItem("baseUrl") || "http://localhost:11434",
      apiKey: localStorage.getItem("apiKey") || "",
      llmStatus: JSON.parse(localStorage.getItem("llmStatus") || JSON.stringify({
        status: "offline",
        message: "Offline",
        lastChecked: "never"
      })) as LLMStatus
    },
    
    // Model Parameters
    modelParameters: {
      temperature: parseFloat(localStorage.getItem("temperature") || "0.7"),
      top_p: parseFloat(localStorage.getItem("top_p") || "0.9"),
      top_k: parseInt(localStorage.getItem("top_k") || "40"),
      presence_penalty: parseFloat(localStorage.getItem("presence_penalty") || "0"),
      frequency_penalty: parseFloat(localStorage.getItem("frequency_penalty") || "0"),
      max_tokens: parseInt(localStorage.getItem("max_tokens") || "2048"),
      repeat_penalty: parseFloat(localStorage.getItem("repeat_penalty") || "1.1"),
    },
    
    // Chat Interface Settings
    chatSettings: {
      showTimestamps: localStorage.getItem("showTimestamps") === "true" || true,
      showMessageInfo: localStorage.getItem("showMessageInfo") === "true" || true,
      autoScroll: localStorage.getItem("autoScroll") === "true" || true,
      quickPrompts: JSON.parse(localStorage.getItem("quickPrompts") || "[]") as QuickPrompt[],
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
    
    // Stop Sequences
    stopSequences: JSON.parse(localStorage.getItem("stopSequences") || "[]") as string[],
  }),
  
  actions: {
    // LLM Connection actions
    updateLLMConnection(data: Partial<typeof this.llmConnection>) {
      this.llmConnection = { ...this.llmConnection, ...data };
      this.saveToLocalStorage('llmConnection');
    },
    
    // Model Parameters actions
    updateModelParameters(data: Partial<typeof this.modelParameters>) {
      this.modelParameters = { ...this.modelParameters, ...data };
      this.saveToLocalStorage('modelParameters');
    },
    
    // Chat Settings actions
    updateChatSettings(data: Partial<typeof this.chatSettings>) {
      this.chatSettings = { ...this.chatSettings, ...data };
      this.saveToLocalStorage('chatSettings');
    },
    
    addQuickPrompt(prompt: QuickPrompt) {
      this.chatSettings.quickPrompts.push(prompt);
      this.saveToLocalStorage('chatSettings');
    },
    
    removeQuickPrompt(index: number) {
      this.chatSettings.quickPrompts.splice(index, 1);
      this.saveToLocalStorage('chatSettings');
    },
    
    // UI Settings actions
    updateUISettings(data: Partial<typeof this.uiSettings>) {
      this.uiSettings = { ...this.uiSettings, ...data };
      this.saveToLocalStorage('uiSettings');
    },
    
    // Data Settings actions
    updateDataSettings(data: Partial<typeof this.dataSettings>) {
      this.dataSettings = { ...this.dataSettings, ...data };
      this.saveToLocalStorage('dataSettings');
    },
    
    // Stop Sequences actions
    addStopSequence(sequence: string) {
      if (!this.stopSequences.includes(sequence)) {
        this.stopSequences.push(sequence);
        this.saveToLocalStorage('stopSequences');
      }
    },
    
    removeStopSequence(index: number) {
      this.stopSequences.splice(index, 1);
      this.saveToLocalStorage('stopSequences');
    },
    
    // General actions
    resetToDefaults() {
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
      
      this.saveAllToLocalStorage();
    },
    
    saveToLocalStorage(section: string) {
      switch(section) {
        case 'llmConnection':
          localStorage.setItem('selectedModel', this.llmConnection.selectedModel);
          localStorage.setItem('selectedProvider', this.llmConnection.selectedProvider);
          localStorage.setItem('baseUrl', this.llmConnection.baseUrl);
          localStorage.setItem('apiKey', this.llmConnection.apiKey);
          localStorage.setItem('llmStatus', JSON.stringify(this.llmConnection.llmStatus));
          break;
        case 'modelParameters':
          Object.entries(this.modelParameters).forEach(([key, value]) => {
            localStorage.setItem(key, value.toString());
          });
          break;
        case 'chatSettings':
          Object.entries(this.chatSettings).forEach(([key, value]) => {
            if (key === 'quickPrompts') {
              localStorage.setItem(key, JSON.stringify(value));
            } else {
              localStorage.setItem(key, value.toString());
            }
          });
          break;
        case 'uiSettings':
          Object.entries(this.uiSettings).forEach(([key, value]) => {
            localStorage.setItem(key, value.toString());
          });
          break;
        case 'dataSettings':
          Object.entries(this.dataSettings).forEach(([key, value]) => {
            localStorage.setItem(key, value.toString());
          });
          break;
        case 'stopSequences':
          localStorage.setItem('stopSequences', JSON.stringify(this.stopSequences));
          break;
      }
    },
    
    saveAllToLocalStorage() {
      console.info("PINIA: Saving all to local storage.");
      this.saveToLocalStorage('llmConnection');
      this.saveToLocalStorage('modelParameters');
      this.saveToLocalStorage('chatSettings');
      this.saveToLocalStorage('uiSettings');
      this.saveToLocalStorage('dataSettings');
      this.saveToLocalStorage('stopSequences');
    }
  }
});