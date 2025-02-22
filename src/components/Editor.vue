<script>
import Settings from "../Settings.vue";

export default {
  components: {Settings},
  data() {
    return {
      tabs: [
        {id: 1, name: "untitled", content: "", type: "editor"}
      ],
      activeTab: 1,
      nextTabId: 2,
    };
  },
  methods: {
    addTab(name = "untitled") {
      this.tabs.push({ id: this.nextTabId, name: `untitled-${this.nextTabId}`, content: "" , type: "editor"});
      this.activeTab = this.nextTabId;
      this.nextTabId++;
    },
    openTab(name, type = "editor") {
      const existingTab = this.tabs.find(tab => tab.name === name);
      if (existingTab) {
        this.activeTab = existingTab.id;
        return;
      }
      this.tabs.push({ id: this.nextTabId, name, content: "", type });
      this.activeTab = this.nextTabId;
      this.nextTabId++;
    },
    closeTab(id) {
      this.tabs = this.tabs.filter(tab => tab.id !== id);
      if (this.activeTab === id && this.tabs.length > 0) {
        this.activeTab = this.tabs[this.tabs.length - 1].id;
      }
    },
  }
};
</script>

<template>
  <main class="flex-1 relative v-full h-full overflow-hidden flex flex-col rounded-4xl">
    <div class="bg-neutral-900 p-2 flex items-center h-12">
      <div v-for="tab in tabs" :key="tab.id" class="mx-1 text-xs px-4 py-2 cursor-pointer" :class="{ 'rounded-xl outline outline-neutral-700': activeTab === tab.id }">
        <span @click="activeTab = tab.id">{{ tab.name }}</span>
        <span class="ml-2 cursor-pointer" @click="closeTab(tab.id)">&times;</span>
      </div>
    </div>
    <div class="border-t border-neutral-800"></div>

    <div class="border-t border-neutral-800"></div>

    <div class="w-full h-full overflow-auto">
      <div v-for="tab in tabs" v-show="activeTab === tab.id" :key="tab.id" class="h-full">
        <textarea v-if="tab.type === 'editor'" v-model="tab.content" class="block w-full h-full bg-neutral-900 text-white p-4 outline-none resize-none"></textarea>
        <Settings v-else-if="tab.type === 'settings'" />
      </div>
    </div>
  </main>
</template>

<style scoped>
@import "tailwindcss";
</style>