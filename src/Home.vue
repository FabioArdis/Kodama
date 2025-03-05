<script>
/**
 * Main application component that orchestrates the IDE interface.
 * Manages the sidebar, editor, chat components and application state.
 * @component
 */
import SidebarRoot from "./components/sidebar/SidebarRoot.vue";
import Editor from "./components/Editor.vue";
import Chat from "./components/Chat.vue";
import MenuBar from "./components/MenuBar.vue";
import CommandPalette from "./components/CommandPalette.vue";

import { getVersion } from "@tauri-apps/api/app";

import ollama from 'ollama/browser';
import { commandRegistry, registerDefaultCommands } from "./utils/commands";
import ThemeSelector from "./components/ThemeSelector.vue";

import { open } from "@tauri-apps/plugin-dialog";

export default {
  components: { MenuBar, SidebarRoot, Editor, Chat, CommandPalette, ThemeSelector },
  data() {
    return {
      /** Current application version string */
      appVersion: "Loading...",
      /** Status of Ollama API connection: "checking", "online", or "offline" */
      ollamaStatus: "checking",
      /** Currently active file in the editor */
      currentFile: null,
      /** Width of the sidebar in pixels */
      sidebarWidth: 0,
      /** Whether the command palette is visible */
      commandPaletteVisible: false,
      /** Available commands for the command palette */
      commands: []
    };
  },
  /**
   * Lifecycle hook that runs after the component is mounted.
   * Fetches app version and initializes Ollama status checking.
   */
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

    // Set interval to periodically check Ollama connection status
    this.ollamaStatusInterval = setInterval(() => {
      this.checkOllamaStatus();
    }, 30000);

    // Register global keyboard shortcuts
    window.addEventListener('keydown', this.handleKeyDown);
    
    // Register commands
    this.registerCommands();
    
    // Initialize commands list
    this.updateCommandsList();
  },
  /**
   * Lifecycle hook that runs before component is unmounted.
   * Cleans up the Ollama status check interval.
   */
  beforeUnmount() {
    if (this.ollamaStatusInterval) {
      clearInterval(this.ollamaStatusInterval);
    }
    window.removeEventListener('keydown', this.handleKeyDown);
  },
  /**
   * Computed properties for the component
   */
  computed: {
    /**
     * Determines if the sidebar is currently expanded
     * @returns {boolean} True if sidebar is expanded, false otherwise
     */
    sidebarExpanded() {
      return this.$refs.sidebar?.expanded ?? false;
    },
    /**
     * Gets the currently selected Ollama model from localStorage
     * @returns {string} The selected model name or "defaultModel" if not set
     */
    selectedModel() {
      return localStorage.getItem("selectedModel") || "defaultModel";
    },
    /**
     * Calculates the left margin for the editor based on sidebar state
     * @returns {string} CSS margin value
     */
    editorMargin() {
      return this.sidebarExpanded ? `${this.sidebarWidth + 16}px` : '16px';
    }
  },
  methods: {
    /**
     * Register all available commands
     */
    registerCommands() {
      registerDefaultCommands({
        newFile: this.handleNewFile,
        openFile: this.handleOpenFileDialog,
        openProject: this.handleOpenProject,
        openSettings: this.handleOpenSettings,
      });
    },
    
    /**
     * Update the commands list from the command registry
     */
    updateCommandsList() {
      this.commands = commandRegistry.getAll();
    },
    
    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyDown(event) {
      // Command palette shortcut (Ctrl+Shift+P)
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyP') {
        event.preventDefault(); // Prevent default browser behavior
        this.toggleCommandPalette();
        return;
      }
      
      // Other shortcuts can be handled here
    },
    
    /**
     * Toggle the command palette visibility
     */
    toggleCommandPalette() {
      this.commandPaletteVisible = !this.commandPaletteVisible;
    },
    
    /**
     * Execute a command from the command palette
     * @param {Object} command - Command to execute
     */
    executeCommand(command) {
      command.execute();
    },
    
    /**
     * Handles opening a project by delegating to the sidebar component
     * @param {string} projectPath - Path to the project to be opened
     */
    handleOpenProject(projectPath) {
      if (!projectPath) {
        open({
          directory: true,
          multiple: false,
          title: "Open Project Folder"
        }).then((selected) => {
          if (selected) {
            this.$refs.sidebar.handleProjectOpened(selected);
          }
        });
        return;
      }
      this.$refs.sidebar.handleProjectOpened(projectPath);
    },
    
    /**
     * Handles open file dialog
     */
    async handleOpenFileDialog() {
      try {
        const selected = await open({
          directory: false,
          multiple: false,
          title: "Open File"
        });
        
        if (selected) {
          if (!this.currentFile) {
            this.currentFile = {};
          }
          console.log(`Opening file: ${selected}`)
          this.currentFile.name = selected.split(/[/\\]/).pop();;
          this.currentFile.path = selected;
          this.$refs.editor.openFile(this.currentFile);console.log("Selected file:", this.currentFile);
        }
      } catch (error) {
        console.error("Error opening file dialog:", error);
      }
    },
    
    /**
     * Handles project opened event
     * @param {Object} project - The project that was opened
     */
    handleProjectOpened(project) {
      console.log(`Project opened: ${project.name}`);
    },
    
    /**
     * Handles file open requests by passing the file to the editor
     * @param {Object} file - File object to be opened
     */
    handleOpenFile(file) {
      console.log(`Opening file: ${file.name}`)
      console.log(`file.path in Home.vue: ${file.path}`)
      this.currentFile = file;
      this.$refs.editor.openFile(file);
    },
    
    /**
     * Checks the status of the Ollama API connection 
     * Updates ollamaStatus state with the result: "online", "offline", or "checking"
     */
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
    
    /**
     * Creates a new file by delegating to the editor component
     */
    handleNewFile() {
      this.$refs.editor.addTab();
    },
    
    /**
     * Opens the settings tab in the editor
     */
    handleOpenSettings() {
      this.$refs.editor.openTab("Settings", "settings");
    },
    
    /**
     * Applies code from the chat to the editor
     * @param {Object} data - Object containing the code to apply
     * @param {string} data.code - The code to insert into the editor
     */
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
    
    /**
     * Updates the stored sidebar width when it changes
     * @param {number} width - The new width of the sidebar in pixels
     */
    handleSidebarWidthChange(width) {
      this.sidebarWidth = width;
    }
  }
};
</script>

<template>
  <div class="flex flex-col h-screen bg-primary text-text-primary">
    <!-- Top menu bar component -->
    <MenuBar @newFile="handleNewFile" @openFileDialog="handleOpenFileDialog" @openSettings="handleOpenSettings" @openProject="handleOpenProject" />
    
    <!-- Components in the middle -->
    <div class="flex flex-1 overflow-hidden relative">
      
      <!-- Sidebar  -->
      <SidebarRoot 
        ref="sidebar" 
        @openFile="handleOpenFile" 
        @widthChanged="handleSidebarWidthChange" 
      />

      <!-- Code Editor -->
      <Editor 
        ref="editor" 
        :style="{ marginLeft: editorMargin }" 
        class="flex-grow transition-all duration-100" 
      />

      <!-- Chat interface -->
      <Chat ref="chat" @applyCode="handleApplyCode" />

    </div>

    <!-- Status bar, will probably become a component later on -->
    <div class="border-t border-border-primary my-2"></div>
    
    <div class="bg-primary text-statusbar-text-primary p-1 text-xs flex items-center justify-between select-none relative mx-4 bottom-1">
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
    
    <!-- Command Palette -->
    <CommandPalette 
      :is-visible="commandPaletteVisible" 
      :commands="commands"
      @close="commandPaletteVisible = false"
      @execute="executeCommand"
    />
  </div>
</template>

<style>
@import "tailwindcss";
</style>