<script>

</script>

<template>
  <main class="flex-1 relative v-full h-full overflow-hidden flex flex-col rounded-4xl">
    <div class="bg-neutral-900 p-2 flex items-center h-12">
      <!-- Current file tab is still work in progress -->
      <span class="ml-2"><i>untitled</i> &times;</span>
    </div>
    <div class="border-t border-neutral-800"></div>
    <div class="w-full h-full overflow-auto">
      <textarea class="block w-full h-full bg-neutral-900 text-white p-4 outline-none resize-none"></textarea>
    </div>
  </main>
</template>

<style scoped>
@import "tailwindcss";
</style>