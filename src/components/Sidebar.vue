<script>
export default {
  data() {
    return {
      expanded: false,
      activeMenu: null,
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
          class="p-2 hover:bg-neutral-800 rounded-lg relative"
          @click="toggleSidebar(key)"
      >
        <i :class="'fas ' + menu.icon"></i>
        <span class="absolute left-14 top-1/2 transform -translate-y-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
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
            <span class="ml-2">Project</span>
          </div>
          <div class="border-t border-neutral-800 my-1.5"></div>
        </div>
        <div v-if="activeMenu === 'search'">
          <div class="p-1 flex items-center">
            <span class="ml-2">Search</span>
          </div>
          <div class="border-t border-neutral-800 my-1.5"></div>
        </div>
        <div v-if="activeMenu === 'vcs'">
          <div class="p-1 flex items-center">
            <span class="ml-2">Version Control</span>
          </div>
          <div class="border-t border-neutral-800 my-1.5"></div>
        </div>
        <div v-if="activeMenu === 'run'">
          <div class="p-1 flex items-center">
            <span class="ml-2">Run configuration</span>
          </div>
          <div class="border-t border-neutral-800 my-1.5"></div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
@import "tailwindcss";

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