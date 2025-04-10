<script>
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from '@tauri-apps/plugin-opener';

export default {
  data() {
    return {
      appVersion: "Loading...",
      vueVersion: "Loading...",
    }
  },
  async mounted() {
    try {
      const version = await getVersion();
      this.appVersion = version;
      localStorage.setItem("kodamaVersion", version);
    } catch (error) {
      console.error("Error fetching app version:", error);
      this.appVersion = "Unknown";
    }
  },
  methods: {
    openExternal(url) {
      openUrl(url);
    }
  }
}
</script>

<template>
  <div class="w-full h-full overflow-auto bg-secondary p-6">
    <div class="max-w-2xl mx-auto">

      
      <div class="text-center mb-8">
        <div class="text-xl font-light mb-2 text-text-accent flex items-center justify-center gap-10">
          <div class="relative mb-5">
            <div class="absolute -inset-1 rounded-lg bg-gradient-to-r from-[#3B6567] via-green-950 to-neutral-900 opacity-75 blur"></div>
            <div class="relative">
              <img src="/images/kodama-logo.svg" alt="Kōdama Logo" class="rounded-xl h-48 w-48" />
            </div>
          </div>

          <div class="bg-primary rounded-xl p-5 mb-6 border border-border-accent shadow-md">
            <h1 class="p-3 text-3xl">コーダマ - <span class="italic font-light text-text-primary">Kōdama</span></h1>
            <h2 class="text-lg font-medium mb-6 text-text-accent">Application Info</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-text-primary">Version:</span>
                  <span class="text-text-accent font-medium">{{appVersion}}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-text-primary">License:</span>
                  <span class="text-text-accent">MIT</span>
                </div>
              </div>
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-text-primary">Monaco-Editor:</span>
                  <span class="text-text-accent">0.43.0</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-text-primary">Vue:</span>
                  <span class="text-text-accent">3.5.13</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="bg-primary rounded-xl p-5 mb-6 border border-border-accent shadow-md">
        <h2 class="text-lg font-medium mb-4 text-text-accent">Resources</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a href="#" @click.prevent="openExternal('https://github.com/FabioArdis/kodama')" class="flex items-center gap-3 p-3 bg-secondary rounded-lg hover:bg-accent transition-colors cursor-pointer">
            <i class="fab fa-github text-xl"></i>
            <div>
              <div class="font-medium text-text-accent">GitHub Repository</div>
              <div class="text-xs text-text-primary">View source code and contribute</div>
            </div>
          </a>
          <a href="#" @click.prevent="openExternal('https://github.com/FabioArdis/kodama/issues')" class="flex items-center gap-3 p-3 bg-secondary rounded-lg hover:bg-accent transition-colors cursor-pointer">
            <i class="fas fa-bug text-xl"></i>
            <div>
              <div class="font-medium text-text-accent">Report Issues</div>
              <div class="text-xs text-text-primary">Submit bugs and feature requests</div>
            </div>
          </a>
        </div>
      </div>

      <div class="bg-primary rounded-xl p-5 mb-6 border border-border-accent shadow-md">
        <h2 class="text-lg font-medium mb-4 text-text-accent">Credits</h2>
        <div class="text-sm text-text-primary">
          <p class="mb-3">コーダマ - Kōdama was built with the following technologies:</p>
          <div class="flex flex-wrap gap-2 mb-4">
            <span class="px-3 py-1 bg-secondary rounded-full text-xs">Tauri</span>
            <span class="px-3 py-1 bg-secondary rounded-full text-xs">Vue.js</span>
            <span class="px-3 py-1 bg-secondary rounded-full text-xs">Monaco Editor</span>
            <span class="px-3 py-1 bg-secondary rounded-full text-xs">vue-monaco-editor</span>
            <span class="px-3 py-1 bg-secondary rounded-full text-xs">Tailwind CSS</span>
            <span class="px-3 py-1 bg-secondary rounded-full text-xs">Font Awesome</span>
            <span class="px-3 py-1 bg-secondary rounded-full text-xs">DOMPurify</span>
            <span class="px-3 py-1 bg-secondary rounded-full text-xs">highlight.js</span>
            <span class="px-3 py-1 bg-secondary rounded-full text-xs">Marked</span>
            <span class="px-3 py-1 bg-secondary rounded-full text-xs">Pinia</span>
          </div>
        </div>
      </div>

      <div class="text-center text-text-primary text-xs mt-8 mb-4">
        <p class="mt-1">Made with <i class="fas fa-heart text-text-accent"></i> by developers for developers.</p>
      </div>
    </div>
  </div>
</template>

<style>
</style>