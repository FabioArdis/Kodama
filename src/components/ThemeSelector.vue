<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useThemeService } from '../services/themeService';

const { availableThemes, currentThemeName, loadThemes, setTheme } = useThemeService();
const selectedTheme = ref<string | null>(null);

onMounted(async () => {
  await loadThemes();
  selectedTheme.value = currentThemeName.value;
});

function onThemeChange() {
  if (selectedTheme.value) {
    setTheme(selectedTheme.value);
    console.info("Changing theme into", selectedTheme.value);
  }
}
</script>

<template>
  <div class="bg-primary p-4 rounded-lg shadow-lg">
    <label for="theme-select" class="block text-sm font-medium text-text-primary mb-2">
      Theme Selection
    </label>
    <div class="relative">
      <select 
        id="theme-select"
        v-model="selectedTheme" 
        @change="onThemeChange"
        class="block w-full px-3 py-2 bg-accent hover:bg-accent-hover border-accent rounded-md shadow-sm 
               focus:outline-none 
               transition duration-200 ease-in-out"
      >
        <option 
          v-for="theme in availableThemes" 
          :key="theme.name" 
          :value="theme.name"
        >
          {{ theme.name }}
        </option>
      </select>
    </div>
  </div>
</template>

<style>
@import "tailwindcss";
</style>