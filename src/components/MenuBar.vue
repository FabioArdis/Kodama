<script>
import { exit } from "@tauri-apps/plugin-process"

export default {
  emits: ["newFile", "openSettings"],
  methods: {
    newFile() {
      this.$emit("newFile");
    },
    openSettings() {
      this.$emit("openSettings");
    },
    async exitApp() {
      try {
        await exit(0);
      } catch (error) {
        console.error("Error closing Kōdama:", error);
      }
    }
  }
};
</script>

<template>
  <header class="bg-neutral-800 text-white p-2 flex items-center select-none relative z-50">

    <div class="px-4 font-semibold text-lg">コーダマ</div>

    <nav class="flex space-x-4">
      <div class="relative group">
        <button class="px-3 py-1 hover:bg-neutral-700 rounded">File</button>
        <div
            class="absolute left-0 min-w-[150px] hidden group-hover:block outline-2 outline-neutral-600 bg-neutral-900 shadow-lg rounded-md z-50"
        >
          <ul class="p-2">
            <li @click="newFile" class="px-3 py-2 hover:bg-neutral-800 cursor-pointer rounded">New File</li>
            <li class="px-3 py-2 hover:bg-neutral-800 cursor-pointer rounded">Open File...</li>
            <li class="border-t border-neutral-800 my-1"></li>
            <li @click="openSettings" class="px-3 py-2 hover:bg-neutral-800 cursor-pointer rounded">Settings</li>
            <li class="border-t border-neutral-800 my-1"></li>
            <li class="px-3 py-2 hover:bg-neutral-800 cursor-pointer rounded">Save</li>
            <li class="border-t border-neutral-800 my-1"></li>
            <li @click="exitApp" class="px-3 py-2 hover:bg-neutral-800 cursor-pointer rounded">Exit</li>
          </ul>
        </div>
      </div>

      <div class="relative group">
        <button class="px-3 py-1 hover:hover:bg-neutral-700 rounded">Edit</button>
        <div
            class="absolute left-0 min-w-[150px] hidden group-hover:block outline-2 outline-neutral-600 bg-neutral-900 shadow-lg rounded-md z-50"
        >
          <ul class="p-2">
            <li class="px-3 py-2 hover:bg-neutral-800 cursor-pointer rounded">Undo</li>
            <li class="px-3 py-2 hover:bg-neutral-800 cursor-pointer rounded">Redo</li>
            <li class="border-t border-neutral-800 my-1"></li>
            <li class="px-3 py-2 hover:bg-neutral-800 cursor-pointer rounded">Cut</li>
            <li class="px-3 py-2 hover:bg-neutral-800 cursor-pointer rounded">Copy</li>
            <li class="px-3 py-2 hover:bg-neutral-800 cursor-pointer rounded">Paste</li>
          </ul>
        </div>
      </div>
    </nav>
  </header>
</template>

<style scoped>
@import "tailwindcss";
</style>