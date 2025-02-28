<script>
import { readDir, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { appConfigDir } from '@tauri-apps/api/path';
import FileTree from './FileTree.vue';

export default {
  components: {
    FileTree
  },
  emits: ["projectOpened", "openFile"],
  data() {
    return {
      expanded: false,
      activeMenu: null,
      searchInput: "",
      recentProjects: [],
      currentProject: null,
      projectFiles: [],
      menus: {
        files: { icon: "fa-file-alt", label: "Files" },
        search: { icon: "fa-search", label: "Search" },
        vcs: { icon: "fa-code-branch", label: "Version Control" },
        run: { icon: "fa-play", label: "Run" },
      },
    };
  },
  async mounted() {
    await this.loadRecentProjects();
  },
  methods: {
    toggleSidebar(menu) {
      if (this.activeMenu === menu) {
        this.expanded = !this.expanded;
        if (!this.expanded) this.activeMenu = null;
      } else {
        this.activeMenu = menu;
        this.expanded = true;
      }
    },
    search() {
      console.log(`Searching for: ${this.searchInput} in project ${this.currentProject.name}`);
    },
    async handleProjectOpened(projectPath) {
      if(!projectPath) return;

      const pathParts = projectPath.split(/[/\\]/);
      const projectName = pathParts[pathParts.length - 1];

      const newProject = {
        name: projectName,
        path: projectPath,
        lastOpened: new Date().toISOString()
      };

      this.currentProject = newProject;

      const existingIndex = this.recentProjects.findIndex(p => p.path === projectPath);

      if (existingIndex >= 0) {
        this.recentProjects[existingIndex].lastOpened = newProject.lastOpened;
      } else {
        this.recentProjects.unshift(newProject);
        if (this.recentProjects.length > 10) {
          this.recentProjects.pop();
        }
      }

      await this.saveRecentProjects();
      await this.loadProjectFiles();

      this.activeMenu = 'files';
      this.expanded = true;

      this.$emit("projectOpened", this.currentProject);
    },

    async loadProjectFiles() {
      if (!this.currentProject) return;

      try {
        const entries = await readDir(this.currentProject.path);
        this.projectFiles = this.processEntries(entries);
      } catch (error) {
        console.error("Error loading project files:", error);
        this.projectFiles = [];
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

    async openRecentProject(project) {
      this.currentProject = project;

      project.lastOpened = new Date().toISOString();
      await this.saveRecentProjects();
      await this.loadProjectFiles();

      this.activeMenu = "files";
      this.expanded = true;

      this.$emit("projectOpened", this.currentProject);
    },

    async loadRecentProjects() {
      try {
        const configDir = await appConfigDir();

        try {
          const content = await readTextFile(`${configDir}/recent_projects.json`);
          this.recentProjects = JSON.parse(content);
        } catch (e) {
          this.recentProjects = [];
          await mkdir(configDir, { recursive: true });
        }
      } catch (error) {
        console.error("Error loading recent projects:", error);
        this.recentProjects = [];
      }
    },

    async saveRecentProjects() {
      try {
        const configDir = await appConfigDir();
        await writeTextFile(
          `${configDir}/recent_projects.json`,
          JSON.stringify(this.recentProjects)
        );
      } catch (error) {
        console.error("Error saving recent projects:", error);
      }
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
            const fullPath = `${this.currentProject.path}/${file.path}`;
            const entries = await readDir(fullPath);
            file.children = this.processEntries(entries, file.path);
          } catch (error) {
            console.error(`Error loading directory ${file.path}:`, error);
            file.children = [];
          }
        }
      } else {
        this.$emit("openFile", {
          path: `${this.currentProject.path}/${file.path}`,
          name: file.name
        });
      }
    }
  },
};
</script>

<template>
  <div class="flex h-full">
    <aside class="w-16 bg-neutral-900 flex flex-col items-center py-4 space-y-4 rounded-4xl mx-4">
      <div v-for="(menu, key) in menus" :key="key" class="relative group">
        <button
            class="p-2 hover:bg-neutral-800 rounded-lg w-full"
            @click="toggleSidebar(key)"
            :aria-label="menu.label"
            :aria-expanded="activeMenu === key && expanded"
        >
          <i :class="'fas ' + menu.icon" aria-hidden="true"></i>
        </button>
        <span class="pointer-events-none absolute left-14 top-1/2 transform -translate-y-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
          {{ menu.label }}
        </span>
      </div>
    </aside>

    <transition name="slide">
      <div
          v-if="expanded"
          class="bg-neutral-900 w-64 p-2 rounded-4xl overflow-auto custom-scrollbar"
      >
        <div v-if="activeMenu === 'files'">
          <div class="p-1 flex items-center justify-between">
            <span class="flex items-center">
              <i class="fas fa-file-alt mr-2"></i>
              <span>Files</span>
            </span>
            <div>
              <button @click="loadProjectFiles" class="p-1 hover:bg-neutral-700 rounded" title="Refresh">
                <i class="fas fa-sync-alt text-sm"></i>
              </button>
            </div>
          </div>
          <div class="border-t border-neutral-800 my-1.5"></div>
          
          <div v-if="!currentProject" class="px-2 py-2 text-neutral-400 text-sm">
            <div class="flex flex-col space-y-2">
              <div class="text-center py-2">
                Open a project from the File menu
              </div>
              
              <div v-if="recentProjects.length > 0" class="mt-4">
                <div class="text-xs text-neutral-500 mb-2 font-semibold">RECENT PROJECTS</div>
                <div
                  v-for="project in recentProjects"
                  :key="project.path"
                  @click="openRecentProject(project)"
                  class="px-2 py-1.5 hover:bg-neutral-800 rounded cursor-pointer flex items-center text-sm"
                >
                  <i class="fas fa-folder mr-2 text-blue-400"></i>
                  <div class="truncate">{{ project.name }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else>
            <div class="px-2 py-1 flex items-center justify-between">
              <div class="font-semibold truncate">{{ currentProject.name }}</div>
            </div>
            
            <template v-if="projectFiles.length">
              <file-tree
                :files="projectFiles"
                :get-file-icon="getFileIcon"
                :open-file="openFile"
              />
            </template>
            <div v-else class="px-2 py-1 text-neutral-400 text-sm">
              No files found
            </div>
          </div>
        </div>

        <div v-if="activeMenu === 'search'">
          <div class="p-1 flex items-center">
            <i class="fas fa-search mr-2"></i>
            <span>Search</span>
          </div>
          <div class="border-t border-neutral-800 my-1.5"></div>
          <div class="flex h-8 my-4 mx-3">
            <input
                v-model="searchInput"
                type="text"
                placeholder="Search in project..."
                class="p-2 bg-neutral-700 text-white rounded-md w-full"
                @keyup.enter="search"
                :disabled="!currentProject"
            />
            <button
                @click="search"
                class="mx-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-md px-2"
                aria-label="Search"
                :disabled="!currentProject"
            >
              <i :class="'fas ' + menus.search.icon"></i>
            </button>
          </div>
          <div v-if="!currentProject" class="px-3 py-2 text-neutral-400 text-sm">
            Please open a project to search
          </div>
        </div>

        <div v-if="activeMenu === 'vcs'">
          <div class="p-1 flex items-center">
            <i class="fas fa-code-branch mr-2"></i>
            <span>Version Control</span>
          </div>
          <div class="border-t border-neutral-800 my-1.5"></div>
          <div v-if="currentProject" class="px-2 py-1">
            <div class="flex justify-between items-center">
              <span>Changes</span>
              <span class="bg-blue-600 px-2 rounded-full text-xs">0</span>
            </div>
          </div>
          <div v-else class="px-3 py-2 text-neutral-400 text-sm">
            Please open a project to see version control
          </div>
        </div>

        <div v-if="activeMenu === 'run'">
          <div class="p-1 flex items-center">
            <i class="fas fa-play mr-2"></i>
            <span>Run configuration</span>
          </div>
          <div class="border-t border-neutral-800 my-1.5"></div>
          <div v-if="currentProject" class="px-2 py-1 hover:bg-neutral-800 rounded cursor-pointer">
            <i class="fas fa-cog mr-2"></i>npm run dev
          </div>
          <div v-else class="px-3 py-2 text-neutral-400 text-sm">
            Please open a project first
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease, opacity 0.2s ease;
}
.slide-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px !important;
  height: 6px !important;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2) !important;
  border-radius: 10px !important;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3) !important;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent !important;
}

.custom-scrollbar {
  scrollbar-width: thin !important;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent !important;
}
</style>