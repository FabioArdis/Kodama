<script>
import { markRaw } from 'vue';
import Settings from "../Settings.vue";
import { VueMonacoEditor } from "@guolao/vue-monaco-editor";

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
      tabs: [
        { id: 1, name: "untitled", content: "", type: "editor", language: "javascript" }
      ],
      activeTab: 1,
      nextTabId: 2,
      editorOptions: {
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        tabSize: 2,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
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
      selectionActive: false
    };
  },
  computed: {
    activeTabData() {
      return this.tabs.find(tab => tab.id === this.activeTab) || this.tabs[0];
    },
    activeTabContent: {
      get() {
        return this.activeTabData.content;
      },
      set(value) {
        const activeTabIndex = this.tabs.findIndex(tab => tab.id === this.activeTab);
        if (activeTabIndex !== -1) {
          this.tabs[activeTabIndex].content = value;
        }
      }
    },
    activeTabLanguage() {
      return this.activeTabData.language || 'javascript';
    }
  },
  methods: {
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
    },
    
    openTab(name, type = "editor", language = "javascript") {
      const existingTab = this.tabs.find(tab => tab.name === name);
      if (existingTab) {
        this.activeTab = existingTab.id;
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
    },
    
    closeTab(id) {
      this.tabs = this.tabs.filter(tab => tab.id !== id);
      if (this.tabs.length === 0) {
        this.addTab();
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
      if (!this.editor) {
        console.error("Editor instance not available");
        return false;
      }

      await new Promise(resolve => setTimeout(resolve, 0));

      const model = this.editor.getModel();
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
    <div class="bg-neutral-900 p-2 flex items-center h-12">
      <div v-for="tab in tabs" :key="tab.id" class="mx-1 text-xs px-4 py-2 cursor-pointer" 
           :class="{ 'rounded-xl outline outline-neutral-700': activeTab === tab.id }">
        <span @click="activeTab = tab.id">{{ tab.name }}</span>
        <span class="ml-2 cursor-pointer" @click.stop="closeTab(tab.id)">&times;</span>
      </div>
      <button @click="addTab" class="ml-2 text-xs px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700">
        <span>+</span>
      </button>
    </div>
    <div class="border-t border-neutral-800"></div>

    <!-- Editor -->
    <div class="w-full h-full overflow-hidden">
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
         class="ai-context-menu absolute z-50 bg-neutral-800 rounded-lg shadow-lg border border-neutral-700"
         :style="{ left: `${aiContextMenu.x}px`, top: `${aiContextMenu.y}px` }">
      <div class="p-2 border-b border-neutral-700 text-xs font-medium">AI Actions</div>
      <div class="max-h-60 overflow-y-auto">
        <div v-for="action in aiContextMenu.actions" 
             :key="action.id" 
             @click="handleAiAction(action.id)"
             class="px-4 py-2 hover:bg-neutral-700 cursor-pointer text-sm">
          {{ action.label }}
        </div>
      </div>
    </div>
    
    <!-- Alternative, fixed AI Contextual Menu -->
    <div v-if="selectionActive && !aiContextMenu.show" 
         class="fixed bottom-12 left-1/2 transform -translate-x-1/2 bg-neutral-800 rounded-full shadow-lg border border-neutral-700 px-4 py-2 flex space-x-2 z-50">
      <button 
        v-for="action in aiContextMenu.actions"
        :key="action.id"
        @click="handleAiAction(action.id)"
        class="px-3 py-1 rounded-full hover:bg-neutral-700 text-xs font-medium"
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