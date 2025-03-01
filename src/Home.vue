<script>
import SidebarRoot from "./components/sidebar/SidebarRoot.vue";
import Editor from "./components/Editor.vue";
import Chat from "./components/Chat.vue";
import MenuBar from "./components/MenuBar.vue";

import { getVersion } from "@tauri-apps/api/app";

import ollama from 'ollama/browser';

export default {
  components: { MenuBar, SidebarRoot, Editor, Chat },
  data() {
    return {
      appVersion: "Loading...",
      ollamaStatus: "checking",
      currentFile: null,
      sidebarWidth: 0,
    };
  },
  async mounted() {
    try {
      const version = await getVersion();
      this.appVersion = version;
      localStorage.setItem("kodamaVersion", version);
    } catch (error) {
      console.error("Error fetching app version:", error);
      this.appVersion = "Unknown";
    }

    this.checkOllamaStatus();
    this.ollamaStatusInterval = setInterval(() => {
      this.checkOllamaStatus();
    }, 30000);
  },
  beforeUnmount() {
    if (this.ollamaStatusInterval) {
      clearInterval(this.ollamaStatusInterval);
    }
  },
  computed: {
    sidebarExpanded() {
      return this.$refs.sidebar?.expanded ?? false;
    },
    selectedModel() {
      return localStorage.getItem("selectedModel") || "defaultModel";
    },
    editorMargin() {
      return this.sidebarExpanded ? `${this.sidebarWidth + 16}px` : '16px';
    }
  },
  methods: {
    handleOpenProject(projectPath) {
      this.$refs.sidebar.handleProjectOpened(projectPath);
    },
    handleProjectOpened(project) {
      console.log(`Project opened: ${project.name}`);
    },
    handleOpenFile(file) {
      console.log(`Opening file: ${file.name}`)
      console.log(`file.path in Home.vue: ${file.path}`)
      this.currentFile = file;
      this.$refs.editor.openFile(file);
    },
    async checkOllamaStatus() {
      try {
        this.ollamaStatus = "checking";
        const response = await ollama.list();
        this.ollamaStatus = response ? "online" : "offline";
      } catch (error) {
        console.error("Ollama status check failed:", error);
        this.ollamaStatus = "offline";
      }
    },
    handleNewFile() {
      this.$refs.editor.addTab();
    },
    handleOpenSettings() {
      this.$refs.editor.openTab("Settings", "settings");
    },
    async handleApplyCode(data) {
      try {
        const success = await this.$refs.editor.replaceSelectedText(data.code);
        if (success) {
          // Might reuse this later.
          //this.$refs.chat.scrollToBottom();
        }
      } catch (error) {
        console.error('Code application failed:', error);
        alert('Failed to apply code: ' + error.message);
      }
    },
    handleSidebarWidthChange(width) {
      this.sidebarWidth = width;
    }
  }
};
</script>

<template>
  <div class="flex flex-col h-screen bg-neutral-800 text-white">
    <MenuBar @newFile="handleNewFile" @openSettings="handleOpenSettings" @openProject="handleOpenProject" />
    <div class="flex flex-1 overflow-hidden relative">
      <SidebarRoot 
        ref="sidebar" 
        @openFile="handleOpenFile" 
        @widthChanged="handleSidebarWidthChange" 
      />
      <Editor 
        ref="editor" 
        :style="{ marginLeft: editorMargin }" 
        class="flex-grow transition-all duration-100" 
      />
      <Chat ref="chat" @applyCode="handleApplyCode" />
    </div>
    <!-- Status bar, will probably become a component later on -->
    <div class="border-t border-neutral-900 my-2"></div>
    <div class="bg-neutral-800 text-gray-400 p-1 text-xs flex items-center justify-between select-none relative mx-4 bottom-1">
      <div class="flex items-center space-x-2">
        <span>Kōdama v{{appVersion}}</span>
      </div>
      <div class="flex items-center space-x-4">
        <div class="flex items-center">
          <div 
            :class="{
              'w-2 h-2 rounded-full mr-2': true,
              'bg-green-500': ollamaStatus === 'online',
              'bg-red-500': ollamaStatus === 'offline',
              'bg-yellow-500 animate-pulse': ollamaStatus === 'checking'
            }"
          ></div>
          <span>Ollama - {{ ollamaStatus }}</span>
        </div>
        <span>Model: {{selectedModel}}</span>
      </div>
    </div>
  </div>
</template>

<style>
@import "tailwindcss";
</style>