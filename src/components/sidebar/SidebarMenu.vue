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
  <aside class="w-16 bg-secondary flex flex-col items-center py-4 space-y-4 rounded-4xl mx-4">
    <div v-for="(menu, key) in menus" :key="key" class="relative group">
      <button
        class="p-2 hover:bg-primary rounded-lg w-full"
        @click="$emit('toggleMenu', key)"
        :aria-label="menu.label"
        :aria-expanded="activeMenu === key && expanded"
      >
        <i :class="'fas ' + menu.icon" aria-hidden="true"></i>
      </button>
      <span class="pointer-events-none absolute left-14 top-1/2 transform -translate-y-1/2 bg-primary text-text-primary text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
        {{ menu.label }}
      </span>
    </div>
  </aside>
</template>