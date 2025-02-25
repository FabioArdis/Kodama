<script>
export default {
  data() {
    return {
      expanded: false,
      activeMenu: null,
      searchInput: "",
      menus: {
        files: { icon: "fa-file-alt", label: "Files" },
        search: { icon: "fa-search", label: "Search" },
        vcs: { icon: "fa-code-branch", label: "Version Control" },
        run: { icon: "fa-play", label: "Run" },
      },
    };
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
      // TODO: Implement search logic
      console.log(`Searching for: ${this.searchInput}`);
    }
  }
};
</script>

<template>
  <div class="flex h-full">
    <aside class="w-16 bg-neutral-900 flex flex-col items-center py-4 space-y-4 rounded-4xl mx-4">
      <button
          v-for="(menu, key) in menus"
          :key="key"
          class="p-2 hover:bg-neutral-800 rounded-lg relative group"
          @click="toggleSidebar(key)"
          :aria-label="menu.label"
          :aria-expanded="activeMenu === key && expanded"
      >
        <i :class="'fas ' + menu.icon" aria-hidden="true"></i>
        <span class="absolute left-14 top-1/2 transform -translate-y-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
          {{ menu.label }}
        </span>
      </button>
    </aside>

    <transition name="slide">
      <div
          v-if="expanded"
          class="bg-neutral-900 w-64 p-2 rounded-4xl"
      >
        <div v-if="activeMenu === 'files'">
          <div class="p-1 flex items-center">
            <i class="fas fa-file-alt mr-2"></i>
            <span>Project</span>
          </div>
          <div class="border-t border-neutral-800 my-1.5"></div>
          <!-- Will eventually implement this once I figure out how to proceed with the project management -->
          <div class="px-2 py-1 hover:bg-neutral-800 rounded cursor-pointer">
            <i class="fas fa-folder-open mr-2 text-blue-400"></i>src
          </div>
          <div class="px-2 py-1 hover:bg-neutral-800 rounded cursor-pointer ml-4">
            <i class="fas fa-file-code mr-2 text-green-400"></i>main.js
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
                placeholder="Search..."
                class="p-2 bg-neutral-700 text-white rounded-md w-full"
                @keyup.enter="search"
            />
            <button
                @click="search"
                class="mx-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-md px-2"
                aria-label="Search"
            >
              <i :class="'fas ' + menus.search.icon"></i>
            </button>
          </div>
        </div>

        <div v-if="activeMenu === 'vcs'">
          <div class="p-1 flex items-center">
            <i class="fas fa-code-branch mr-2"></i>
            <span>Version Control</span>
          </div>
          <div class="border-t border-neutral-800 my-1.5"></div>
          <!-- Just a dummy panel until VCS is implemented -->
          <div class="px-2 py-1">
            <div class="flex justify-between items-center">
              <span>Changes</span>
              <span class="bg-blue-600 px-2 rounded-full text-xs">3</span>
            </div>
          </div>
        </div>

        <div v-if="activeMenu === 'run'">
          <div class="p-1 flex items-center">
            <i class="fas fa-play mr-2"></i>
            <span>Run configuration</span>
          </div>
          <div class="border-t border-neutral-800 my-1.5"></div>
          <!-- Same thing for the previous panels -->
          <div class="px-2 py-1 hover:bg-neutral-800 rounded cursor-pointer">
            <i class="fas fa-cog mr-2"></i>npm run dev
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
</style>