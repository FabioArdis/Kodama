<script>
import FileTree from '../common/FileTree.vue';
import { readDir, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

export default {
  components: {
    FileTree
  },
  props: {
    currentProject: Object,
    projectFiles: Array,
    recentProjects: Array
  },
  emits: ["refreshFiles", "openRecentProject", "openFile", "clearRecentProjects", "removeRecentProject"],
  methods: {
    openRecentProject(project) {
      this.$emit("openRecentProject", project);
    },
    getFileIcon(file) {
      if (file.isDirectory) {
        return file.expanded ? "fa-folder-open" : "fa-folder";
      }

      const extension = file.name.split('.').pop()?.toLowerCase();
        
      switch (extension) {
        case 'js':
          return 'fa-js text-yellow-400';
        case 'ts':
          return 'fa-code text-blue-400';
        case 'vue':
          return 'fa-file-code text-green-400';
        case 'json':
          return 'fa-file-code text-orange-400';
        case 'html':
          return 'fa-html5 text-red-400';
        case 'css':
          return 'fa-css3 text-blue-400';
        case 'md':
          return 'fa-file-alt text-gray-400';
        default:
          return 'fa-file text-gray-400';
      }
    },

    async openFile(file) {
      if (file.isDirectory) {
        file.expanded = !file.expanded;
        
        if (file.expanded && file.children.length === 0) {
          try {
            const fullPath = await join(this.currentProject.path, file.path);
            const entries = await readDir(fullPath);
            file.children = this.processEntries(entries, file.path);
          } catch (error) {
            console.error(`Error loading directory ${file.path}:`, error);
            file.children = [];
          }
        }
      } else {
        // Use normalize to fix path issues
        const filePath = await join(this.currentProject.path, file.path);
        console.info("filePath:",filePath);
        this.$emit("openFile", {
          path: filePath,
          name: file.name
        });
      }
    },
    
    processEntries(entries, parentPath = "") {
      const mappedEntries = entries.map(entry => {
        const item = {
          name: entry.name,
          path: parentPath ? `${parentPath}/${entry.name}` : entry.name,
          isDirectory: entry.isDirectory,
          children: entry.children ? this.processEntries(entry.children, entry.name) : [],
          expanded: false
        };
        
        return item;
      });
      
      return mappedEntries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    },
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between h-8 max-h-8 min-h-8">
      <span class="flex items-center ml-5 text-xs font-semibold">
        <span>EXPLORER</span>
      </span>
      <div>
        <button @click="$emit('refreshFiles')" class="hover:text-text-secondary rounded p-1 mr-4" title="Refresh">
          <i class="fas fa-sync-alt text-sm"></i>
        </button>
      </div>
    </div>
    
    <div class="border-t border-border-accent"></div>

    <div v-if="currentProject" class="bg-accent flex items-center justify-between">
        <div class="px-5 my-1 font-semibold truncate">{{ currentProject.name }}</div>
        <!-- TODO: add project-related buttons, such as create file, folder, et cetera.-->
    </div>

    <div class="px-3 py-2">
      <div v-if="!currentProject" class="px-2 py-2 text-text-secondary text-sm">
        <div class="flex flex-col space-y-2">
          <div class="text-center py-2">
            Open a project from the File menu or from the list below
          </div>
          
          <div v-if="recentProjects.length > 0" class="mt-4">
            <div class="flex items-center justify-between mb-2">
              <div class="text-xs text-text-accent font-semibold">RECENT PROJECTS</div>
              <button 
                @click="$emit('clearRecentProjects')"
                class="text-xs text-red-400 hover:text-red-500 px-2 py-0.5 rounded hover:bg-primary"
                title="Clear all recent projects"
              >
                Clear History
              </button>
            </div>
            <div
              v-for="project in recentProjects"
              :key="project.path"
              class="px-2 py-1.5 hover:bg-primary rounded cursor-pointer flex items-center text-sm group"
            >
              <div class="flex-grow flex items-center" @click="openRecentProject(project)">
                <i class="fas fa-folder mr-2 text-blue-400"></i>
                <div class="truncate">{{ project.name }}</div>
              </div>
              <button 
                @click="$emit('removeRecentProject', project)"
                class="text-text-secondary opacity-0 group-hover:opacity-100 hover:text-text-primary p-1 rounded hover:bg-accent transition-opacity"
                title="Remove from recent projects"
              >
                <i class="fas fa-times text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-else> 
        <template v-if="projectFiles.length">
          <file-tree
            :files="projectFiles"
            :get-file-icon="getFileIcon"
            :open-file="openFile"
          />
        </template>
        <div v-else class="px-2 py-1 text-text-secondary text-sm">
          No files found
        </div>
      </div>
    </div>
  </div>
</template>