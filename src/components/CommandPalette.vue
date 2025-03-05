<script>
export default {
  emits: ["execute", "close"],
  props: {
    isVisible: {
      type: Boolean,
      required: true
    },
    commands: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      searchQuery: '',
      selectedIndex: 0
    };
  },
  computed: {
    filteredCommands() {
      if (!this.searchQuery) return this.commands;
      
      const query = this.searchQuery.toLowerCase();
      return this.commands.filter(command => 
        command.title.toLowerCase().includes(query)
      );
    }
  },
  watch: {
    filteredCommands() {
      this.selectedIndex = 0;
    },
    isVisible(newVal) {
      if (newVal) {
        this.$nextTick(() => {
          this.$refs.searchInput?.focus();
        });
      } else {
        this.searchQuery = '';
      }
    }
  },
  methods: {
    handleKeyDown(event) {
      switch(event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.selectedIndex = this.selectedIndex - 1 < 0 
            ? this.filteredCommands.length - 1 
            : this.selectedIndex - 1;
          break;
        case 'Enter':
          if (this.filteredCommands.length > 0) {
            this.executeCommand(this.filteredCommands[this.selectedIndex]);
          }
          break;
        case 'Escape':
          this.$emit('close');
          break;
      }
    },

    executeCommand(command) {
      this.$emit('execute', command);
      this.$emit('close');
    },

    handleClickOutside(event) {
      if (this.$refs.palette && !this.$refs.palette.contains(event.target)) {
        this.$emit('close');
      }
    }
  },
  mounted() {
    document.addEventListener('mousedown', this.handleClickOutside);
  },
  beforeUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside);
  }
};
</script>

<template>
  <div v-if="isVisible" class="command-palette-backdrop fixed top-0 left-0 w-full h-full bg-black/50 flex justify-center items-start pt-[54px] z-[1000]">
    <div 
      ref="palette" 
      class="command-palette w-[600px] max-w-full bg-command-primary rounded-2xl shadow-lg overflow-hidden flex flex-col"
      @keydown="handleKeyDown"
    >
      <div class="command-input-container flex items-center p-3 border-b border-command-border">
        <div class="command-input-ico mr-2 text-command-text-secondary">
          <i class="fas fa-search"></i>
        </div>
        <input
          ref="searchInput"
          type="text"
          v-model="searchQuery"
          placeholder="Type a command or search..."
          class="command-input bg-transparent border-none text-text-primary text-base w-full outline-none py-2"
          autofocus
        />
      </div>
      <div class="command-list max-h-[400px] overflow-y-auto">
        <div
          v-for="(command, index) in filteredCommands"
          :key="command.id"
          :class="['command-item flex items-center p-2.5 cursor-pointer hover:bg-command-hover', { 'bg-command-selected': index === selectedIndex }]"
          @click="executeCommand(command)"
        >
          <div class="command-item-icon mr-3 flex items-center justify-center w-5 h-5 text-command-text-secondary" v-if="command.icon">
            <component :is="command.icon" />
          </div>
          <div class="command-item-content flex-grow">
            <div class="command-title text-sm text-command-text-primary">{{ command.title }}</div>
            <div class="command-description text-xs text-command-text-secondary mt-0.5" v-if="command.description">
              {{ command.description }}
            </div>
          </div>
          <div class="command-item-shortcut text-xs text-command-text-secondary ml-3" v-if="command.shortcut">
            {{ command.shortcut }}
          </div>
        </div>
        <div v-if="filteredCommands.length === 0" class="no-results p-4 text-center text-command-text-secondary">
          No commands found
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import "tailwindcss";

::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: #1e1e1e;
}

::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: #666;
}
</style>