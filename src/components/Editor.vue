<script>
import { markRaw } from 'vue';
import Settings from "../Settings.vue";
import About from '../About.vue';
import { VueMonacoEditor } from "@guolao/vue-monaco-editor";
import { readTextFile, writeTextFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { save, confirm, message } from '@tauri-apps/plugin-dialog';
import { useThemeService } from '../services/themeService';
import { appConfigDir } from '@tauri-apps/api/path';

export default {
  emits: ["openFileDialog"],
  components: { Settings, VueMonacoEditor, About },
  props: {
    chatRef: {
      type: Object,
      default: null
    }
  },
  setup() {
    const themeService = useThemeService();
    return { themeService };
  },
  data() {
    return {
      tabs: [],
      activeTab: 0,
      nextTabId: 1,
      editorOptions: {
        theme: this.themeService.isCurrentThemeDark.value ? 'vs-dark' : 'vs-light',
        automaticLayout: true,
        fontSize: 14,
        tabSize: 2,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fixedOverflowWidgets: true,
      },
      aiContextMenu: {
        show: false,
        x: 0,
        y: 0,
        selectedText: "",
        actions: [
          { id: 'explain', label: 'Explain' },
          { id: 'comment', label: 'Comment' },
          { id: 'refactor', label: 'Refactor' },
          { id: 'optimize', label: 'Optimize' },
          { id: 'debug', label: 'Debug' }
        ]
      },
      selectionActive: false,
      showWelcomeScreen: true,
      keyboardShortcuts: {
        'Control+s': this.saveCurrentTab,
        'Meta+s': this.saveCurrentTab
      },
      recentFiles: [],
      maxRecentFiles: 10,
    };
  },
  async created() {
    window.addEventListener("keydown", this.handleKeydown);

    await this.loadRecentFiles();
  },
  beforeUnmount() {
    window.removeEventListener("keydown", this.handleKeydown);
  },
  computed: {
    editorOptions() {
      return {
        ...this.editorOptions,
        theme: this.themeService.isCurrentThemeDark.value ? 'vs-dark' : 'vs-light'
      };
    },
    activeTabData() {
      return this.tabs.find(tab => tab.id === this.activeTab) || null;
    },
    activeTabContent: {
      get() {
        return this.activeTabData?.content || "";
      },
      set(value) {
        const activeTabIndex = this.tabs.findIndex(tab => tab.id === this.activeTab);
        if (activeTabIndex !== -1) {
          this.tabs[activeTabIndex].content = value;
        }
      }
    },
    activeTabLanguage() {
      return this.activeTabData?.language || 'javascript';
    }
  },
  methods: {
    async loadRecentFiles() {
      try {
        const configDir = await appConfigDir();
        try {
          const content = await readTextFile(`${configDir}/recent_files.json`);
          this.recentFiles = JSON.parse(content);
        } catch (e) {
          this.recentFiles = [];
          await mkdir(configDir, { recursive: true });
        }
      } catch (error) {
        console.error("Error loading recent files:", error);
        this.recentFiles = [];
      }
    },

    async saveRecentFiles() {
      try {
        const configDir = await appConfigDir();
        await writeTextFile(
          `${configDir}/recent_files.json`,
          JSON.stringify(this.recentFiles),
        );
      } catch (error) {
        console.error("Error saving recent files:", error);
      }
    },

    addToRecentFiles(filePath, fileName) {
      this.recentFiles = this.recentFiles.filter(file => file.path !== filePath);
      
      this.recentFiles.unshift({
        path: filePath,
        name: fileName,
        lastOpened: new Date().toISOString()
      });
      
      if (this.recentFiles.length > this.maxRecentFiles) {
        this.recentFiles = this.recentFiles.slice(0, this.maxRecentFiles);
      }
      
      this.saveRecentFiles();
    },

    async openRecentFile(filePath) {
      try {
        const pathParts = filePath.split(/[/\\]/);
        const fileName = pathParts[pathParts.length - 1];
        
        const success = await this.openFile({ path: filePath, name: fileName });
        if (success) {
          this.addToRecentFiles(filePath, fileName);
        }
        return success;
      } catch (error) {
        console.error("Error opening recent file:", error);
        return false;
      }
    },

    clearRecentFiles() {
      this.recentFiles = [];
      this.saveRecentFiles();
    },

    removeRecentFile(file) {
      this.recentFiles = this.recentFiles.filter(f => f.path !== file.path);
      
      this.saveRecentFiles();
    },

    handleKeydown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        this.saveCurrentTab();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        this.addTab();
      }
    },
    showToast(message, type) {
      const toast = document.createElement("div");
      
      let toastClass = "absolute left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-4xl border shadow-lg flex items-center justify-between opacity-0 transition-opacity duration-300";
      
      if (type === 'error') {
        toastClass += " bg-red-100 text-red-800 border-red-300";
      } else {
        toastClass += " bg-secondary text-text-primary border-border-accent";
      }
      
      toast.className = toastClass;
      
      const messageSpan = document.createElement("span");
      messageSpan.innerText = message;
      
      const closeDiv = document.createElement("div");
      closeDiv.className = "ml-2 font-medium hover:bg-primary rounded-4xl cursor-pointer";
      closeDiv.innerHTML = "×";
      closeDiv.onclick = () => closeToast();
      
      toast.appendChild(messageSpan);
      toast.appendChild(closeDiv);
      
      const container = document.querySelector(".relative");
      container?.appendChild(toast);
      
      setTimeout(() => {
        toast.classList.add("opacity-100");
      }, 10);
      
      const closeToast = () => {
        toast.classList.remove("opacity-100");
        toast.classList.add("opacity-0");
        setTimeout(() => container?.removeChild(toast), 300);
      };
      
      const autoCloseTimeout = setTimeout(() => closeToast(), 3000);
      
      closeDiv.addEventListener("click", () => {
        clearTimeout(autoCloseTimeout);
      });
    },

    handleTabMouseDown(event, tabId) {
      // If the use is pressing the middle mouse button
      if (event.button === 1) {
        // Prevent default behavior (like auto-scroll)
        event.preventDefault();
        // Close the tab
        this.closeTab(tabId);
      }
    },

    async openFile(file) {
      try{
        console.info("file.path", file.path);
        const content = await readTextFile(file.path);

        const language = this.detectLanguage(file.name);

        const existingTab = this.tabs.find(tab => tab.name === file.name);

        if (existingTab) {
          const tabIndex = this.tabs.findIndex(tab => tab.id === existingTab.id);
          this.tabs[tabIndex].content = content;
          this.activeTab = existingTab.id;
        } else {
          this.tabs.push({
            id: this.nextTabId,
            name: file.name,
            content: content,
            type: "editor",
            language: language,
            path: file.path,
            unsaved: false
          });

          this.activeTab = this.nextTabId;
          this.nextTabId++;
        }
        this.addToRecentFiles(file.path, file.name);

        this.showWelcomeScreen = false;
        return true;
      } catch (error) {
        console.error("Error opening file:", error);
        return false;
      }
    },

    addTab(name = "untitled", language = "javascript") {
      const tabName = `${name}-${this.nextTabId}`;
      
      if (name.includes('.')) {
        language = this.detectLanguage(name);
      }
      
      this.tabs.push({ 
        id: this.nextTabId, 
        name: tabName, 
        content: "", 
        type: "editor",
        language,
        unsaved: true
      });

      this.activeTab = this.nextTabId;
      this.nextTabId++;
      this.showWelcomeScreen = false;
    },
    
    openTab(name, type = "editor", language = "javascript") {
      const existingTab = this.tabs.find(tab => tab.name === name);
      if (existingTab) {
        this.activeTab = existingTab.id;
        this.showWelcomeScreen = false;
        return;
      }
      
      if (language === "javascript" && name.includes('.')) {
        language = this.detectLanguage(name);
      }
      
      this.tabs.push({ 
        id: this.nextTabId, 
        name, 
        content: "", 
        type,
        language,
        unsaved: false
      });

      this.activeTab = this.nextTabId;
      this.nextTabId++;
      this.showWelcomeScreen = false;
    },
    
    async closeTab(id) {
      const tab = this.tabs.find(tab => tab.id === id);
      
      if (tab && tab.unsaved) {
        const confirmed = await confirm(
          `Save changes to ${tab.name}?`,
          { title: "Unsaved Changes", type: "warning" }
        );

        if (confirmed) {
          await this.saveCurrentTab();
        }
      }

      this.tabs = this.tabs.filter(tab => tab.id !== id);
      if (this.tabs.length === 0) {
        this.showWelcomeScreen = true;
        this.activeTab = null;
      } else if (this.activeTab === id) {
        this.activeTab = this.tabs[this.tabs.length - 1].id;
      }
    },
    
    handleEditorChange(value) {
      const activeTabIndex = this.tabs.findIndex(tab => tab.id === this.activeTab);
      if (activeTabIndex !== -1) {
        this.tabs[activeTabIndex].content = value;
        this.tabs[activeTabIndex].unsaved = true;
      }
    },
    
    detectLanguage(filename) {
      const extension = filename.split('.').pop().toLowerCase();
      const languageMap = {
        'js': 'javascript',
        'ts': 'typescript',
        'py': 'python',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'md': 'markdown',
        'vue': 'html',
        'jsx': 'javascript',
        'tsx': 'typescript',
        'cpp': 'cpp',
        'c': 'c',
        'java': 'java',
        'go': 'go',
        'rs': 'rust',
      };
      
      return languageMap[extension] || 'plaintext';
    },
    
    handleEditorMount(editor) {
      console.log("Editor mounted:", editor);
      this.editor = markRaw(editor);

      this.$watch(
        () => this.themeService.isCurrentThemeDark.value,
        (isDark) => {
          if (this.editor) {
            this.editor.updateOptions({ theme: isDark ? 'vs-dark' : 'vs-light' });
          }
        }
      );
      
      editor.onDidChangeCursorSelection((e) => {
        const selection = editor.getSelection();
        const model = editor.getModel();
        
        if (selection && !selection.isEmpty()) {
          const selectedText = model.getValueInRange(selection);
          
          if (selectedText.trim()) {
            this.aiContextMenu.selectedText = selectedText;
            this.selectionActive = true;
            
            // Fixed position will do for now. TODO: find a better solution for the floating context menu.
            this.aiContextMenu.show = false;
          }
        } else {
          this.selectionActive = false;
          this.aiContextMenu.show = false;
        }
      });
      
      // Hide menu when clicking elsewhere
      editor.onMouseDown((e) => {
        const targetElement = e.target.element;
        if (!targetElement.closest('.ai-context-menu')) {
          this.aiContextMenu.show = false;
        }
      });
    },
    
    handleAiAction(actionId) {
      this.aiContextMenu.show = false;
      
      if (!this.aiContextMenu.selectedText) return;
      
      const language = this.activeTabLanguage;
      
      // Create prompt based on action. The prompt will be exposed for now.
      let prompt = "";
      switch (actionId) {
        case 'explain':
          prompt = `Explain this ${language} code:\n\`\`\`${language}\n${this.aiContextMenu.selectedText}\n\`\`\``;
          break;
        case 'comment':
          prompt = `Add detailed comments to this ${language} code and return the commented version:\n\`\`\`${language}\n${this.aiContextMenu.selectedText}\n\`\`\``;
          break;
        case 'refactor':
          prompt = `Refactor this ${language} code to improve readability and maintainability. Return the refactored code with an explanation of changes:\n\`\`\`${language}\n${this.aiContextMenu.selectedText}\n\`\`\``;
          break;
        case 'optimize':
          prompt = `Optimize this ${language} code for better performance. Return the optimized code with an explanation of improvements:\n\`\`\`${language}\n${this.aiContextMenu.selectedText}\n\`\`\``;
          break;
        case 'debug':
          prompt = `Review this ${language} code for potential bugs or issues:\n\`\`\`${language}\n${this.aiContextMenu.selectedText}\n\`\`\``;
          break;
      }
      
      if (this.$parent.$refs.chat) {
        this.$parent.$refs.chat.openWithPrompt(prompt, this.activeTab, this.selectedText);
      } else {
        console.error("Chat component reference not found");
      }
    },
    
    async replaceSelectedText(newCode) {
      // Wait for editor to be available. I have yet to find out why this is needed for Tauri.
      let attempts = 0;
      while (!this.editor && attempts < 10) {
        console.log("Waiting for editor to initialize...");
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!this.editor) {
        this.showToast("ERROR: Editor instance not available.", "error");
        console.error("Editor instance not available after waiting");
        return false;
      }

      const model = this.editor.getModel();
      if (!model) {
        console.error("Editor model not available");
        return false;
      }

      const currentValue = model.getValue();
      const selection = this.editor.getSelection();
      let newValue, insertOffset;

      // Wrap the code.
      const codeToInsert = "\n" + newCode + "\n";

      if (!selection || selection.isEmpty()) {
        const position = this.editor.getPosition() || { lineNumber: 1, column: 1 };
        insertOffset = model.getOffsetAt(position);
        newValue =
          currentValue.slice(0, insertOffset) +
          codeToInsert +
          currentValue.slice(insertOffset);
      } else {
        const startOffset = model.getOffsetAt(selection.getStartPosition());
        const endOffset = model.getOffsetAt(selection.getEndPosition());
        insertOffset = startOffset;
        newValue =
          currentValue.slice(0, startOffset) +
          codeToInsert +
          currentValue.slice(endOffset);
      }

      model.setValue(newValue);

      const newPosition = model.getPositionAt(insertOffset + codeToInsert.length);
      this.editor.setPosition(newPosition);
      this.editor.focus();

      return true;
    },

    async saveCurrentTab() {
      const tab = this.tabs.find(tab => tab.id === this.activeTab);

      if (!tab) return;

      try {
        if (!tab.path) {
          await this.saveTabAs(tab);
        } else {
          await this.saveTabToPath(tab, tab.path);
        }
      } catch (error) {
        console.error("Error saving file:", error);
        this.showToast("Error saving file: " + error.message, "error");
      }
    },

    async saveTabAs(tab) {
      try {
        const filePath = await save({
          filters: [{
            name: "All Files",
            extensions: ["*"]
          }]
        });

        if (filePath) {
          await this.saveTabToPath(tab, filePath);
        }
      } catch (error) {
        console.error("Save dialog error:", error);
        throw error;
      }
    },

    async saveTabToPath(tab, path) {
      try {
        await writeTextFile(path, tab.content);

        const tabIndex = this.tabs.findIndex(t => t.id === tab.id);
        if (tabIndex !== -1) {
          const pathParts = path.split(/[/\\]/);
          const fileName = pathParts[pathParts.length - 1];
          
          if (!tab.path) {
            this.tabs[tabIndex].name = fileName;
          }
          
          this.tabs[tabIndex].path = path;
          
          this.tabs[tabIndex].language = this.detectLanguage(fileName);
          
          this.tabs[tabIndex].unsaved = false;
        }
        
        this.showToast("File saved successfully", "success");
      } catch (error) {
        console.error("Error writing file:", error);
        throw error;
      }
    }
  }
};
</script>

<template>

  <!-- Tabs -->
  <main class="flex-1 relative w-full h-full overflow-hidden flex flex-col rounded-4xl select-none">
    <div class="bg-secondary p-2 flex items-center h-12">
      <div v-for="tab in tabs" :key="tab.id" class="mx-1 text-xs px-4 py-2 cursor-pointer" 
        :class="{ 'bg-accent-hover rounded-xl outline outline-accent shadow-md': activeTab === tab.id }"
        @mousedown="handleTabMouseDown($event, tab.id)"
        @click="activeTab = tab.id">
        <span v-if="tab.unsaved" class="mr-1">●</span>
        <span>{{ tab.name }}</span>
        <span class="ml-2 cursor-pointer" @click.stop="closeTab(tab.id)">&times;</span>
      </div>
      <button @click="addTab()" class="ml-2 text-xs px-2 py-1 rounded-4xl bg-primary hover:bg-accent transition-colors border border-border-accent">
        <span>+</span>
      </button>
    </div>
    <div class="border-t border-border-accent"></div>

    <!-- Welcome Screen -->
    <div v-if="showWelcomeScreen" class="w-full h-full flex flex-col items-center justify-center bg-secondary text-text-accent p-4">
      <div class="text-2xl md:text-4xl font-light mb-6 text-center">
        Welcome to コーダマ - <i>Kōdama</i>
      </div>
      <div class="flex flex-col gap-4 w-full max-w-xs mx-auto">
        <button 
          @click="addTab()" 
          class="flex items-center justify-center gap-3 py-3 px-4 bg-primary hover:bg-accent rounded-xl transition-colors w-full border border-border-accent shadow-md"
        >
          <i class="fas fa-plus text-xl"></i>
          <span>New File</span>
        </button>
        <button 
          @click="$emit('openFileDialog')" 
          class="flex items-center justify-center gap-3 py-3 px-4 bg-primary hover:bg-accent rounded-xl transition-colors w-full border border-border-accent shadow-md"
        >
          <i class="fas fa-file text-xl"></i>
          <span>Open File</span>
        </button>
      </div>

      <div class="mt-8 px-6 py-5 bg-primary rounded-2xl w-full max-w-md border border-border-accent shadow-lg">
        <div class="flex-col text-xl font-bold mb-4 text-text-accent text-center flex items-center justify-center">
          Recent Files
          <button v-if="recentFiles.length > 0"
          @click="clearRecentFiles"
          class="my-2 text-xs bg-primary border text-text-accent hover:text-red-500 px-2 py-1 rounded-4xl transition-all"
          title="Clear all recent projects"
          >
            Clear History
          </button>
        </div>        
        
        <div v-if="recentFiles.length > 0" class="justify-center max-h-64 overflow-y-auto space-y-2">
          <ul>
            <li v-for="file in recentFiles" :key="file.path" 
                class="py-3 px-4 hover:bg-secondary rounded-lg transition-all duration-200 cursor-pointer group">
              <div class="flex items-center">
                <div @click="openRecentFile(file.path)" class="ml-3 flex-1">
                  <p class="text-sm font-medium text-text-accent">{{ file.name }}</p>
                  <p class="text-xs text-text-primary truncate max-w-xs">{{ file.path }}</p>
                </div>
                <button 
              @click="removeRecentFile(file)"
              class="text-text-secondary opacity-0 hover:text-red-500 group-hover:opacity-100 p-1 transition-opacity"
              title="Remove from recent projects"
            >
              <i class="fas fa-times text-xs"></i>
            </button>
              </div>
            </li>
          </ul>
        </div>
        
        <div v-else class="py-8 text-sm text-text-accent text-center flex flex-col items-center">
          No recent files
          <button @click="$emit('openFileDialog')" class="shadow-md mt-3 px-4 py-2 bg-accent hover:bg-secondary rounded-lg text-xs font-medium transition-colors duration-200 border border-border-accent">
            Open File
          </button>
        </div>
      </div>
    </div>

    <!-- Editor -->
    <div v-else class="w-full h-full overflow-auto">
      <div v-for="tab in tabs" v-show="activeTab === tab.id" :key="tab.id" class="h-full">
        <vue-monaco-editor
          v-if="tab.type === 'editor'"
          v-model:value="activeTabContent"
          :language="activeTabLanguage"
          :options="editorOptions"
          @change="handleEditorChange"
          @mount="handleEditorMount"
          class="w-full h-full"
        />
        <Settings v-else-if="tab.type === 'settings'" />
        <About v-else-if="tab.type === 'about'" />
      </div>
    </div>
    
    <!-- Fixed AI Contextual Menu -->
    <transition name="fade">
      <div v-if="selectionActive" 
          class="fixed bottom-12 left-1/2 transform -translate-x-1/2 bg-secondary rounded-full shadow-lg border border-border-accent px-2 py-1 flex space-x-1 z-50">
        <button 
          v-for="action in aiContextMenu.actions"
          :key="action.id"
          @click="handleAiAction(action.id)"
          class="px-3 py-1 rounded-full hover:bg-accent text-xs font-medium transition-colors"
        >
          {{ action.label }}
        </button>
      </div>
    </transition>
  </main>
</template>

<style scoped>
@import "tailwindcss";

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

:deep(.monaco-editor) {
  outline: none !important;
}
:deep(.monaco-editor:focus) {
  outline: none !important;
}

.ai-context-menu {
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

</style>