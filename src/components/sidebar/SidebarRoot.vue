<script>
import { readDir, mkdir, readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { appConfigDir, join } from '@tauri-apps/api/path';
import SidebarMenu from './SidebarMenu.vue';
import ExplorerPanel from './panels/ExplorerPanel.vue';
import SearchPanel from './panels/SearchPanel.vue';
import VcsPanel from './panels/VcsPanel.vue';
import RunPanel from './panels/RunPanel.vue';

export default {
  components: {
    SidebarMenu,
    ExplorerPanel,
    SearchPanel,
    VcsPanel,
    RunPanel
  },
  emits: ["projectOpened", "openFile", "widthChanged", "launchSettings"],
  data() {
    return {
      expanded: false,
      activeMenu: null,
      searchInput: "",
      recentProjects: [],
      currentProject: null,
      projectFiles: [],
      startX: 0,
      initialWidth: 0,
      minWidth: 450,
      sidebarWidth: 256,
      isResizing: false,
      menus: {
        explorer: { icon: "fa-file-alt", label: "Explorer" },
        search: { icon: "fa-search", label: "Search" },
        vcs: { icon: "fa-code-branch", label: "Version Control" },
        run: { icon: "fa-play", label: "Run" },
      },
      launchables: {
        settings: { icon: "fa-cog", label: "Settings"},
      }
    };
  },
  async mounted() {
    await this.loadRecentProjects();
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
      this.sidebarWidth = parseInt(savedWidth);
    }
  },
  beforeUnmount() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  },
  methods: {
    launch(launchable) {
      console.log(launchable);
      switch (launchable) {
        case "settings" : {
          this.$emit("launchSettings");
        };
      }
    },
    toggleSidebar(menu) {
      if (this.activeMenu === menu) {
        this.expanded = !this.expanded;
        if (!this.expanded) this.activeMenu = null;
      } else {
        this.activeMenu = menu;
        this.expanded = true;
      }
      
      this.$emit("widthChanged", this.expanded ? this.sidebarWidth : 0);
    },
    startResize(event) {
      this.isResizing = true;
      this.startX = event.clientX;
      this.initialWidth = this.sidebarWidth;
      event.preventDefault(); 
    },

    handleMouseMove(event) {
      if (!this.isResizing) return;
      
      const deltaX = event.clientX - this.startX;
      const newWidth = Math.max(this.minWidth, this.initialWidth + deltaX);
      
      if (newWidth <= 500) {
        this.sidebarWidth = newWidth;
        localStorage.setItem('sidebarWidth', newWidth);
        this.$emit("widthChanged", this.sidebarWidth);
      }
    },
    handleMouseUp() {
      this.isResizing = false;
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
      
      // Create .kodama folder and settings.json in the project
      await this.initializeProjectSettings();
      
      await this.loadProjectFiles();

      this.activeMenu = 'explorer';
      this.expanded = true;
      
      this.$emit("widthChanged", this.sidebarWidth);
      this.$emit("projectOpened", this.currentProject);
    },

    async initializeProjectSettings() {
      if (!this.currentProject) return;
      
      try {
        // Create the path for the .kodama folder
        const kodamaFolderPath = await join(this.currentProject.path, '.kodama');
        
        // Check if the .kodama folder already exists
        const folderExists = await exists(kodamaFolderPath);
        
        if (!folderExists) {
          // Create the .kodama folder
          await mkdir(kodamaFolderPath, { recursive: true });
          console.log("Created .kodama folder:", kodamaFolderPath);
        }
        
        // Path for settings.json
        const settingsFilePath = await join(kodamaFolderPath, 'settings.json');
        
        // Check if settings.json already exists
        const fileExists = await exists(settingsFilePath);
        
        if (!fileExists) {
          // Create default settings.json with some initial configuration
          const defaultSettings = {
            projectName: this.currentProject.name,
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            editor: {
              // These don't do anything just yet
              theme: "dark",
              fontSize: 14,
              tabSize: 2,
              wordWrap: true
            },
            build: {
              commands: []
            },
            plugins: []
          };
          
          // Write the settings file
          await writeTextFile(
            settingsFilePath,
            JSON.stringify(defaultSettings, null, 2)
          );
          
          console.log("Created settings.json:", settingsFilePath);
        }
      } catch (error) {
        console.error("Error initializing project settings:", error);
      }
    },

    async loadProjectFiles() {
      if (!this.currentProject) return;

      try {
        console.log("this.currentProject.path:", this.currentProject.path);
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
      
      // Initialize project settings when opening a recent project too
      await this.initializeProjectSettings();
      
      await this.loadProjectFiles();

      this.activeMenu = "explorer";
      this.expanded = true;
      
      this.$emit("widthChanged", this.sidebarWidth);
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
        // Expansion logic is handled by the FileTree component
      } else {
        this.$emit("openFile", {
          path: `${file.path}`,
          name: file.name
        });
      }
    },

    search() {
      console.log(`Searching for: ${this.searchInput} in project ${this.currentProject.name}`);
    },
    
    updateSearchInput(value) {
      this.searchInput = value;
    },

    clearRecentProjects() {
      this.recentProjects = [];
      this.saveRecentProjects();
    },

    removeRecentProject(project) {
      this.recentProjects = this.recentProjects.filter(p => p.path !== project.path);
      
      this.saveRecentProjects();
    },
  },
};
</script>

<template>
  <div class="flex h-full">
    <!-- Sidebar Menu (Icons Bar) -->
    <SidebarMenu 
      :menus="menus" 
      :launchables="launchables"
      :activeMenu="activeMenu" 
      :expanded="expanded" 
      @toggleMenu="toggleSidebar"
      @launch="launch"
    />

    <!-- Panel Content -->
    <transition name="slide">
      <div
        v-if="expanded"
        class="left-2 border border-border-accent bg-secondary rounded-4xl overflow-auto custom-scrollbar relative shadow-lg select-none"
        :style="{ width: `${sidebarWidth}px` }"
      >
        <div class="p-2 rounded-4xl h-full">
          <!-- Explorer Panel -->
          <ExplorerPanel
            v-if="activeMenu === 'explorer'"
            :currentProject="currentProject"
            :projectFiles="projectFiles"
            :recentProjects="recentProjects"
            :getFileIcon="getFileIcon"
            @refreshFiles="loadProjectFiles"
            @openRecentProject="openRecentProject"
            @openFile="openFile"
            @clearRecentProjects="clearRecentProjects"
            @removeRecentProject="removeRecentProject"
          />

          <!-- Search Panel -->
          <SearchPanel
            v-if="activeMenu === 'search'"
            :searchInput="searchInput"
            :currentProject="currentProject"
            @updateInput="updateSearchInput"
            @search="search"
          />

          <!-- Version Control Panel -->
          <VcsPanel
            v-if="activeMenu === 'vcs'"
            :currentProject="currentProject"
          />

          <!-- Run Panel -->
          <RunPanel
            v-if="activeMenu === 'run'"
            :currentProject="currentProject"
          />
        </div>
        
        <!-- Resize handle -->
        <div 
          class="absolute top-0 right-0 h-full w-1 cursor-ew-resize hover:bg-blue-500 hover:w-1"
          @mousedown="startResize"
          :class="{ 'bg-blue-500': isResizing, 'bg-transparent': !isResizing }"
        ></div>
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
  scrollbar-color: var(--ide-theme-accent) transparent !important;
}
</style>