import { ref, reactive, watch } from 'vue';

export interface Theme {
  name: string;
  isDark: boolean;
  variables: Record<string, string>;
}

interface ThemeModule {
  default: Omit<Theme, 'name'>;
}

const THEME_STORAGE_KEY = 'appSelectedTheme';

const availableThemes = ref<Theme[]>([]);
const currentThemeName = ref<string | null>(null);
const isCurrentThemeDark = ref<boolean>(false);
const currentThemeVariables = reactive<Record<string, string>>({});

async function loadThemes() {
  const themeModules = import.meta.glob<ThemeModule>('../themes/*.json');
  const loadedThemes: Theme[] = [];

  for (const path in themeModules) {
    try {
      const themeData = await themeModules[path]();
      const themeName = path.split('/').pop()?.replace('.json', '');
      
      loadedThemes.push({
        name: themeName || '',
        ...themeData.default
      });
    } catch (error) {
      console.error(`Error loading theme from ${path}:`, error);
    }
  }

  availableThemes.value = loadedThemes;
  return loadedThemes;
}

function setTheme(themeName: string) {
  const themeToApply = availableThemes.value.find(theme => theme.name === themeName);
  if (!themeToApply) {
    console.warn(`Theme "${themeName}" not found.`);
    return;
  }

  localStorage.setItem(THEME_STORAGE_KEY, themeName);
  
  currentThemeName.value = themeName;
  isCurrentThemeDark.value = themeToApply.isDark;
  Object.assign(currentThemeVariables, themeToApply.variables);
}

async function initializeTheme() {
  const loadedThemes = await loadThemes();
  
  if (loadedThemes.length === 0) {
    console.error('No themes could be loaded');
    return;
  }

  const storedThemeName = localStorage.getItem(THEME_STORAGE_KEY);
  
  if (storedThemeName) {
    const storedTheme = loadedThemes.find(theme => theme.name === storedThemeName);
    if (storedTheme) {
      setTheme(storedThemeName);
      return;
    }
  }
  
  setTheme(loadedThemes[0].name);
}

watch(currentThemeVariables, (newVariables) => {
  const root = document.documentElement;
  for (const variable in newVariables) {
    root.style.setProperty(variable, newVariables[variable]);
  }
}, { deep: true, immediate: true });

export function useThemeService() {
  return {
    availableThemes,
    currentThemeName,
    currentThemeVariables,
    isCurrentThemeDark,
    loadThemes,
    setTheme,
    initializeTheme,
  };
}