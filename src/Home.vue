<script>
import Sidebar from "./components/Sidebar.vue";
import Editor from "./components/Editor.vue";
import Chat from "./components/Chat.vue";
import MenuBar from "./components/MenuBar.vue";
import {getVersion} from "@tauri-apps/api/app";

export default {
  components: { MenuBar, Sidebar, Editor, Chat},
  data() {
    return {
      appVersion: "Loading...",
    }
  },
  async mounted() {
    localStorage.setItem("kodamaVersion", getVersion().then());
    try {
      this.appVersion = await getVersion();
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
      return localStorage.getItem("selectedModel") || "defaultModel"; // Default value if no model is selected
    }
  },
  methods: {
    handleNewFile() {
      this.$refs.editor.addTab()
    },
    handleOpenSettings() {
      this.$refs.editor.openTab("Settings", "settings")
    }
  }
};
</script>

<template>
  <div class="flex flex-col h-screen bg-neutral-800 text-white">
    <MenuBar @newFile="handleNewFile" @openSettings="handleOpenSettings" />
    <div class="flex flex-1 overflow-hidden relative">
      <Sidebar ref="sidebar" />
      <Editor ref="editor" :class="{ 'ml-80': sidebarExpanded, 'ml-4': !sidebarExpanded }" class="flex-grow" />
      <Chat />
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