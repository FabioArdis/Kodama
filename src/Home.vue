<script>
import Sidebar from "./components/Sidebar.vue";
import Editor from "./components/Editor.vue";
import Chat from "./components/Chat.vue";
import MenuBar from "./components/MenuBar.vue";
import { getVersion } from "@tauri-apps/api/app";

export default {
  components: { MenuBar, Sidebar, Editor, Chat },
  data() {
    return {
      appVersion: "Loading...",
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
  },
  computed: {
    sidebarExpanded() {
      return this.$refs.sidebar?.expanded ?? false;
    },
    selectedModel() {
      return localStorage.getItem("selectedModel") || "defaultModel";
    },
  },
  methods: {
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
    }
  }
};
</script>

<template>
  <div class="flex flex-col h-screen bg-neutral-800 text-white">
    <MenuBar @newFile="handleNewFile" @openSettings="handleOpenSettings" />
    <div class="flex flex-1 overflow-hidden relative">
      <Sidebar ref="sidebar" />
      <Editor 
        ref="editor" 
        :class="{ 'ml-80': sidebarExpanded, 'ml-4': !sidebarExpanded }" 
        class="flex-grow" 
      />
      <Chat ref="chat" @applyCode="handleApplyCode" />
    </div>
    <!-- Status bar, will probably become a component later on -->
    <div class="border-t border-neutral-900 my-2"></div>
    <div class="bg-neutral-800 text-gray-400 p-1 text-xs flex items-center justify-between select-none relative mx-4 bottom-1">
      <span>Kōdama v{{appVersion}}</span>
      <span>Model: {{selectedModel}}</span>
    </div>
  </div>
</template>

<style>
@import "tailwindcss";
</style>