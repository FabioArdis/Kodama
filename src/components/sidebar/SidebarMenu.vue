<script>
export default {
  props: {
    menus: Object,
    activeMenu: String,
    expanded: Boolean
  },
  emits: ["toggleMenu"]
}
</script>

<template>
  <aside class="border border-border-accent w-16 bg-secondary flex flex-col items-center py-4 space-y-4 rounded-4xl shadow-lg">
    <div v-for="(menu, key) in menus" :key="key" class="relative group">
      <button
        class="border border-border-accent p-2 hover:bg-primary transition-colors rounded-full w-10 h-10 flex items-center justify-center shadow-lg"
        @click="$emit('toggleMenu', key)"
        :aria-label="menu.label"
        :aria-expanded="activeMenu === key && expanded"
      >
        <i :class="'fas ' + menu.icon" aria-hidden="true"></i>
      </button>
      <span class="select-none border border-border-accent shadow-md pointer-events-none absolute left-14 top-1/2 transform -translate-y-1/2 bg-primary text-text-primary text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
        {{ menu.label }}
      </span>
    </div>
  </aside>
</template>