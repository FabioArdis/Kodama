<script>
import { readTextFile, readDir } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';

export default {
  props: {
    searchInput: {
      type: String,
      default: ""
    },
    currentProject: {
      type: Object,
      default: null
    }
  },
  emits: ["updateInput", "search", "openFile"],
  data() {
    return {
      localSearchInput: "",
      results: [],
      isSearching: false,
      searchOptions: {
        caseSensitive: false,
        wholeWord: false,
        regex: false,
        includeIgnored: false
      },
      excludePatterns: [
        "node_modules", 
        ".git", 
        "dist", 
        "build",
        ".kodama"
      ],
      searchInProgress: false,
      searchStats: {
        filesSearched: 0,
        matchesFound: 0,
        searchTime: 0
      }
    };
  },
  computed: {
    canSearch() {
      return this.currentProject && this.localSearchInput.trim().length > 0;
    },
    excludePatternsString() {
      return this.excludePatterns.join(", ");
    }
  },
  watch: {
    searchInput: {
      immediate: true,
      handler(newValue) {
        this.localSearchInput = newValue;
      }
    }
  },
  methods: {
    updateInput(e) {
      this.localSearchInput = e.target.value;
      this.$emit("updateInput", e.target.value);
    },
    
    addExcludePattern(pattern) {
      if (pattern && !this.excludePatterns.includes(pattern)) {
        this.excludePatterns.push(pattern);
      }
    },
    
    removeExcludePattern(pattern) {
      this.excludePatterns = this.excludePatterns.filter(p => p !== pattern);
    },
    
    async search() {
      if (!this.canSearch || this.searchInProgress) return;
      
      this.searchInProgress = true;
      this.results = [];
      this.searchStats = {
        filesSearched: 0,
        matchesFound: 0,
        searchTime: 0
      };
      
      const startTime = performance.now();
      
      try {
        const searchResults = await invoke('search_in_project', {
          projectPath: this.currentProject.path,
          searchTerm: this.localSearchInput,
          options: {
            case_sensitive: this.searchOptions.caseSensitive,
            whole_word: this.searchOptions.wholeWord,
            use_regex: this.searchOptions.regex,
            exclude_patterns: this.excludePatterns,
            include_ignored: this.searchOptions.includeIgnored
          }
        });
        
        this.results = searchResults.matches;
        this.searchStats.filesSearched = searchResults.files_searched;
        this.searchStats.matchesFound = searchResults.total_matches;
      } catch (error) {
        console.error("Search failed:", error);
        // Fallback to JS-based search if the Rust command isn't available
        await this.fallbackJsSearch();
      } finally {
        const endTime = performance.now();
        this.searchStats.searchTime = ((endTime - startTime) / 1000).toFixed(2);
        this.searchInProgress = false;
      }
      
      this.$emit("search");
    },
    
    /**
     * Fallback JavaScript-based search function
     * Only used if the Rust search is not available
     * Haven't really tested it yet.
     */
    async fallbackJsSearch() {
      console.info("Falled back to JS");
      if (!this.currentProject) return;
      
      try {
        const projectPath = this.currentProject.path;
        await this.searchDirectory(projectPath);
      } catch (error) {
        console.error("JS search error:", error);
      }
    },
    
    async searchDirectory(dirPath, relativePath = '') {
      try {
        const entries = await readDir(dirPath);
        
        for (const entry of entries) {
          const fullPath = await join(dirPath, entry.name);
          const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          
          if (entry.isDirectory) {
            if (!this.excludePatterns.includes(entry.name)) {
              await this.searchDirectory(fullPath, entryRelativePath);
            }
            continue;
          }
          
          this.searchStats.filesSearched++;
          
          try {
            const content = await readTextFile(fullPath);
            const matches = this.findMatchesInContent(content, entryRelativePath);
            
            if (matches.length > 0) {
              this.results.push({
                filePath: entryRelativePath,
                matches: matches
              });
              this.searchStats.matchesFound += matches.length;
            }
          } catch (err) {
            console.log(`Skipping file: ${entry.name}`);
          }
        }
      } catch (error) {
        console.error(`Error searching directory ${dirPath}:`, error);
      }
    },
    
    findMatchesInContent(content, filePath) {
      const lines = content.split('\n');
      const matches = [];
      
      if (this.searchOptions.regex) {
        try {
          const regex = new RegExp(this.localSearchInput, this.searchOptions.caseSensitive ? 'g' : 'gi');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            regex.lastIndex = 0;
            
            const match = regex.exec(line);
            if (match) {
              matches.push({
                lineNumber: i + 1,
                lineContent: line,
                matchIndex: match.index,
                matchLength: match[0].length
              });
            }
          }
        } catch (e) {
          console.error("Invalid regex:", e);
        }
      } else if (this.searchOptions.wholeWord) {
        const pattern = this.searchOptions.caseSensitive
          ? new RegExp(`\\b${this.escapeRegExp(this.localSearchInput)}\\b`, 'g')
          : new RegExp(`\\b${this.escapeRegExp(this.localSearchInput)}\\b`, 'gi');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          pattern.lastIndex = 0;
          
          const match = pattern.exec(line);
          if (match) {
            matches.push({
              lineNumber: i + 1,
              lineContent: line,
              matchIndex: match.index,
              matchLength: match[0].length
            });
          }
        }
      } else {
        const searchTerm = this.searchOptions.caseSensitive 
          ? this.localSearchInput 
          : this.localSearchInput.toLowerCase();
        
        for (let i = 0; i < lines.length; i++) {
          const originalLine = lines[i];
          const line = this.searchOptions.caseSensitive 
            ? originalLine 
            : originalLine.toLowerCase();
            
          let matchIndex = line.indexOf(searchTerm);
          
          if (matchIndex !== -1) {
            matches.push({
              lineNumber: i + 1,
              lineContent: originalLine,
              matchIndex: matchIndex,
              matchLength: this.localSearchInput.length
            });
          }
        }
      }
      
      return matches;
    },
    
    escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },
    
    handleOpenFile(result) {
      this.$emit("openFile", {
        path: `${this.currentProject.path}/${result.filePath}`,
        name: result.file_path.split('/').pop(),
        lineNumber: result.matches[0].lineNumber
      });
    },
    
    highlightMatch(line, matchIndex, searchTerm, matchLength) {
      if (line === undefined || matchIndex === undefined) {
        return line || '';
      }

      matchLength = matchLength || this.localSearchInput.length;
      
      const beforeMatch = line.substring(0, matchIndex);
      const match = line.substring(matchIndex, matchIndex + matchLength);
      const afterMatch = line.substring(matchIndex + matchLength);
      
      return `${beforeMatch}<span class="bg-yellow-800 text-white font-medium">${match}</span>${afterMatch}`;
    }
  }
};
</script>

<template>
  <div class="h-full flex flex-col p-2">
    <div class="p-1 flex items-center justify-between">
      <span class="flex items-center">
        <i class="fas fa-search mr-2"></i>
        <span>Search</span>
      </span>
    </div>

    <div class="border-t border-neutral-800 my-1.5"></div>
    
    <!-- Search input and button -->
    <div class="flex space-x-2 mb-3">
      <input
        type="text"
        :value="localSearchInput"
        @input="updateInput"
        @keyup.enter="search"
        placeholder="Search in project..."
        class="flex-1 px-3 py-2 bg-neutral-800 rounded border border-neutral-700 text-white"
      />
      <button
        @click="search"
        :disabled="!canSearch || searchInProgress"
        class="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:bg-blue-800 disabled:opacity-50"
      >
        <i class="fas fa-search mr-1"></i>
        {{ searchInProgress ? 'Searching...' : 'Search' }}
      </button>
    </div>
    
    <!-- Search options -->
    <div class="mb-3 flex flex-wrap gap-2">
      <label class="flex items-center text-sm text-neutral-400">
        <input type="checkbox" v-model="searchOptions.caseSensitive" class="mr-1" />
        Case sensitive
      </label>
      <label class="flex items-center text-sm text-neutral-400">
        <input type="checkbox" v-model="searchOptions.wholeWord" class="mr-1" />
        Whole word
      </label>
      <label class="flex items-center text-sm text-neutral-400">
        <input type="checkbox" v-model="searchOptions.regex" class="mr-1" />
        Regex
      </label>
      <label class="flex items-center text-sm text-neutral-400">
        <input type="checkbox" v-model="searchOptions.includeIgnored" class="mr-1" />
        Include ignored
      </label>
    </div>
    
    <!-- Excluded patterns -->
    <div class="mb-3">
      <div class="flex justify-between text-sm text-neutral-400 mb-1">
        <span>Excluded patterns:</span>
        <button 
          @click="addExcludePattern(prompt('Enter pattern to exclude:'))"
          class="text-blue-400 hover:text-blue-300"
        >
          <i class="fas fa-plus"></i> Add
        </button>
      </div>
      <div class="flex flex-wrap gap-1 mb-2">
        <span 
          v-for="pattern in excludePatterns" 
          :key="pattern"
          class="bg-neutral-800 px-2 py-1 rounded text-sm text-neutral-300 flex items-center"
        >
          {{ pattern }}
          <button 
            @click="removeExcludePattern(pattern)" 
            class="ml-1 text-neutral-500 hover:text-neutral-300"
          >
            <i class="fas fa-times"></i>
          </button>
        </span>
      </div>
    </div>
    
    <!-- Search stats -->
    <div v-if="results.length > 0 || searchStats.searchTime > 0" class="mb-3 text-sm text-neutral-400">
      Found {{ searchStats.matchesFound }} matches in {{ searchStats.filesSearched }} files ({{ searchStats.searchTime }}s)
    </div>
    
    <!-- Results -->
    <div v-if="searchInProgress" class="text-center py-4 text-neutral-400">
      <i class="fas fa-spinner fa-spin mr-2"></i> Searching...
    </div>
    
    <div v-else-if="results.length === 0 && searchStats.searchTime > 0" class="text-center py-4 text-neutral-400">
      No results found
    </div>
    
    <div v-else class="flex-1 overflow-y-auto custom-scrollbar">
      <div 
        v-for="result in results" 
        :key="result.file_path" 
        class="mb-4 bg-neutral-800 rounded overflow-hidden"
      >
        <div 
          class="bg-neutral-700 px-3 py-2 flex justify-between items-center cursor-pointer hover:bg-neutral-600"
          @click="handleOpenFile(result)"
        >
          <span class="text-white truncate">{{ result.file_path }}</span>
          <span class="text-neutral-400 text-sm">{{ result.matches.length }} matches</span>
        </div>
        <div class="p-2">
          <div 
            v-for="match in result.matches.slice(0, 5)" 
            :key="`${result.file_path}-${match.line_number}`"
            class="py-1 px-2 text-sm hover:bg-neutral-700 rounded cursor-pointer"
            @click="handleOpenFile(result)"
          >
            <div class="flex">
              <span class="text-neutral-500 inline-block w-8 text-right mr-2">{{ match.line_number }}</span>
              <span class="text-neutral-300 whitespace-pre" v-html="highlightMatch(match.line_content, match.match_index, localSearchInput, match.matchLength)"></span>
            </div>
          </div>
          <div v-if="result.matches.length > 5" class="text-center text-sm text-neutral-500 mt-1">
            + {{ result.matches.length - 5 }} more matches
          </div>
        </div>
      </div>
    </div>
  </div>
</template>