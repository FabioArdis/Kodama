<script>
import { exit } from "@tauri-apps/plugin-process";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

export default {
  emits: ["newFile", "openFileDialog", "openSettings", "openProject", "saveFile", "openAbout"],
  methods: {
    newFile() {
      this.$emit("newFile");
    },
    openSettings() {
      this.$emit("openSettings");
    },
    openAbout() {
      this.$emit("openAbout");
    },
    openFile() {
      this.$emit("openFileDialog");
    },
    saveFile() {
      this.$emit("saveFile");
    },
    async exitApp() {
      try {
        await exit(0);
      } catch (error) {
        console.error("Error closing Kōdama:", error);
      }
    },
    async openProject() {
      try {
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Select Project Folder'
        });

        if (selected) {
          this.$emit("openProject", selected);
        }
      } catch (error) {
        console.error("Error opening project:", error);
      }
    },
    async minimize() {
      appWindow.minimize();
    },
    async toggleMaximize() {
      appWindow.toggleMaximize();
    }
  }
};
</script>

<template>
  <header data-tauri-drag-region class="titlebar bg-primary text-text-primary p-2 flex items-center select-none relative justify-between">
    <div class="flex items-center">
      <div class="px-2 font-semibold text-lg">コーダマ</div>

      <nav class="px-4 flex space-x-4">
        <div class="relative group">
          <button class="px-3 py-1 bg-secondary hover:bg-accent transition-colors rounded-xl shadow-lg border border-border-accent">File</button>
          <div
              class="absolute left-0 min-w-[150px] hidden text-xs group-hover:block outline-2 outline-accent bg-secondary shadow-lg rounded-md z-50"
          >
            <ul class="p-1">
              <li @click="newFile" class="px-3 py-1 hover:bg-primary cursor-pointer rounded">New File</li>
              <li @click="openFile" class="px-3 py-1 hover:bg-primary cursor-pointer rounded">Open File...</li>
              <li class="border-t border-border-accent my-1"></li>
              <li @click="openProject" class="px-3 py-1 hover:bg-primary cursor-pointer rounded">Open Project...</li>
              <li class="border-t border-border-accent my-1"></li>
              <li @click="openSettings" class="px-3 py-1 hover:bg-primary cursor-pointer rounded">Settings</li>
              <li class="border-t border-border-accent my-1"></li>
              <li @click="saveFile" class="px-3 py-1 hover:bg-primary cursor-pointer rounded">Save</li>
              <li class="border-t border-border-accent my-1"></li>
              <li @click="exitApp" class="px-3 py-1 hover:bg-primary cursor-pointer rounded">Exit</li>
            </ul>
          </div>
        </div>

        <!-- We will come back to this later. Shortcuts work anyways.
        <div class="relative group">
          <button class="px-3 py-1 bg-secondary hover:hover:bg-accent transition-colors rounded-2xl shadow-lg border border-border-accent">Edit</button>
          <div
              class="absolute left-0 min-w-[150px] hidden group-hover:block outline-2 outline-accent bg-secondary shadow-lg rounded-md z-50"
          >
            <ul class="p-2">
              <li class="px-3 py-2 hover:bg-primary cursor-pointer rounded">Undo</li>
              <li class="px-3 py-2 hover:bg-primary cursor-pointer rounded">Redo</li>
              <li class="border-t border-border-secondary my-1"></li>
              <li class="px-3 py-2 hover:bg-primary cursor-pointer rounded">Cut</li>
              <li class="px-3 py-2 hover:bg-primary cursor-pointer rounded">Copy</li>
              <li class="px-3 py-2 hover:bg-primary cursor-pointer rounded">Paste</li>
            </ul>
          </div>
        </div> -->

        <div class="relative group">
          <button class="px-3 py-1 bg-secondary hover:bg-accent transition-colors rounded-xl shadow-lg border border-border-accent">Help</button>
          <div
              class="absolute left-0 min-w-[150px] hidden text-xs group-hover:block outline-2 outline-accent bg-secondary shadow-lg rounded-md z-50"
          >
            <ul class="p-1">
              <li @click="openAbout" class="px-3 py-1 hover:bg-primary cursor-pointer rounded">About</li>
            </ul>
          </div>
        </div>
      </nav>
    </div>

    <div class=" rounded-4xl bg-secondary px-1 py-1 shadow-lg border border-border-accent">
      <div @click="minimize()" class="titlebar-button hover:bg-accent transition-colors rounded-4xl" id="titlebar-minimize">
        <i class="fas fa-minus"></i>
      </div>
      <div @click="toggleMaximize()" class="titlebar-button hover:bg-accent transition-colors rounded-4xl" id="titlebar-maximize">
        <i class="fas fa-square"></i>
      </div>
      <div @click="exitApp()" class="titlebar-button hover:bg-accent transition-colors rounded-4xl" id="titlebar-close">
        <i class="fas fa-times"></i>
      </div>
    </div>
  </header>
</template>

<style scoped>
@import "tailwindcss";

.titlebar-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 30px;
  height: 30px;
  user-select: none;
  -webkit-user-select: none;
}
</style>