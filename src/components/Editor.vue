<script>
import { markRaw } from 'vue';
import Settings from "../Settings.vue";
import { VueMonacoEditor } from "@guolao/vue-monaco-editor";
import { readTextFile } from '@tauri-apps/plugin-fs';

export default {
  components: { Settings, VueMonacoEditor },
  props: {
    chatRef: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      tabs: [],
      activeTab: 0,
      nextTabId: 1,
      editorOptions: {
        theme: 'vs-dark',
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
          { id: 'explain', label: 'Explain Code' },
          { id: 'comment', label: 'Add Comments' },
          { id: 'refactor', label: 'Refactor' },
          { id: 'optimize', label: 'Optimize' },
          { id: 'debug', label: 'Debug Issues' }
        ]
      },
      selectionActive: false,
      showWelcomeScreen: true
    };
  },
  computed: {
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
            path: file.path
          });

          this.activeTab = this.nextTabId;
          this.nextTabId++;
        }
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
        language
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
        language 
      });

      this.activeTab = this.nextTabId;
      this.nextTabId++;
      this.showWelcomeScreen = false;
    },
    
    closeTab(id) {
      this.tabs = this.tabs.filter(tab => tab.id !== id);
      if (this.tabs.length === 0) {
        this.showWelcomeScreen = true;
        this.activeTab = null;
      } else if (this.activeTab === id) {
        this.activeTab = this.tabs[this.tabs.length - 1].id;
      }
    },
    
    handleEditorChange(value) {
      this.activeTabContent = value;
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
      
      editor.onDidChangeCursorSelection((e) => {
        const selection = editor.getSelection();
        const model = editor.getModel();
        
        if (selection && !selection.isEmpty()) {
          const selectedText = model.getValueInRange(selection);
          
          if (selectedText.trim()) {
            this.aiContextMenu.selectedText = selectedText;
            this.selectionActive = true;
            
            const endPosition = selection.getEndPosition();
            const endCoordinates = editor.getScrolledVisiblePosition(endPosition);
            
            if (endCoordinates) {
              const editorDomNode = editor.getDomNode();

              if (editorDomNode) {
                const rect = editorDomNode.getBoundingClientRect();

                this.aiContextMenu.x = rect.left + endCoordinates.left;
                this.aiContextMenu.y = rect.top + endCoordinates.top + 20; // Add some space below
                this.aiContextMenu.show = true;
              }
            }
          }
        } else {
          this.selectionActive = false;
          this.aiContextMenu.show = false;
        }
      });
      
      // Hide menu when clicking elsewhere (except on the menu itself)
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
    }
  }
};
</script>

<template>

  <!-- Tabs -->
  <main class="flex-1 relative w-full h-full overflow-hidden flex flex-col rounded-4xl">
    <div class="bg-secondary p-2 flex items-center h-12">
      <div v-for="tab in tabs" :key="tab.id" class="mx-1 text-xs px-4 py-2 cursor-pointer" 
           :class="{ 'rounded-xl outline outline-accent': activeTab === tab.id }"
           @mousedown="handleTabMouseDown($event, tab.id)">
        <span @click="activeTab = tab.id">{{ tab.name }}</span>
        <span class="ml-2 cursor-pointer" @click.stop="closeTab(tab.id)">&times;</span>
      </div>
      <button @click="addTab()" class="ml-2 text-xs px-3 py-1 rounded-lg bg-primary hover:bg-accent">
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
          class="flex items-center justify-center gap-3 py-3 px-4 bg-primary hover:bg-accent rounded-xl transition-colors w-full"
        >
          <i class="fas fa-plus text-xl"></i>
          <span>New File</span>
        </button>
        <button 
          @click="$emit('open-file-dialog')" 
          class="flex items-center justify-center gap-3 py-3 px-4 bg-primary hover:bg-accent rounded-xl transition-colors w-full"
        >
          <i class="fas fa-file text-xl"></i>
          <span>Open File</span>
        </button>
      </div>
      <div class="mt-8 px-4 py-4 bg-primary rounded-xl w-full max-w-md">
        <div class="text-lg font-medium mb-2 text-center">Recent Files</div>
        <div class="text-sm text-text-secondary text-center">No recent files</div>
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
      </div>
    </div>
    
    <!-- AI Contextual Menu -->
    <div v-if="aiContextMenu.show" 
         class="ai-context-menu absolute z-50 bg-primary rounded-lg shadow-lg border border-border-accent"
         :style="{ left: `${aiContextMenu.x}px`, top: `${aiContextMenu.y}px` }">
      <div class="p-2 border-b border-border-accent text-xs font-medium">AI Actions</div>
      <div class="max-h-60 overflow-y-auto">
        <div v-for="action in aiContextMenu.actions" 
             :key="action.id" 
             @click="handleAiAction(action.id)"
             class="px-4 py-2 hover:bg-accent cursor-pointer text-sm">
          {{ action.label }}
        </div>
      </div>
    </div>
    
    <!-- Alternative, fixed AI Contextual Menu -->
    <div v-if="selectionActive && !aiContextMenu.show" 
         class="fixed bottom-12 left-1/2 transform -translate-x-1/2 bg-primary rounded-full shadow-lg border border-border-accent px-4 py-2 flex space-x-2 z-50">
      <button 
        v-for="action in aiContextMenu.actions"
        :key="action.id"
        @click="handleAiAction(action.id)"
        class="px-3 py-1 rounded-full hover:bg-accent text-xs font-medium"
      >
        {{ action.label }}
      </button>
    </div>
  </main>
</template>

<style scoped>
@import "tailwindcss";

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