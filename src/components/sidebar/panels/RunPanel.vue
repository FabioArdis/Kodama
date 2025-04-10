<script>
import { readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { confirm as dialogConfirm } from '@tauri-apps/plugin-dialog';

export default {
  props: {
    currentProject: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      configurations: [],
      selectedConfig: null,
      isLoading: true,
      isEditing: false,
      isCreating: false,
      newConfig: {
        name: '',
        type: 'shell',
        command: '',
        args: [],
        cwd: '${workspaceFolder}',
        env: {}
      },
      configTypes: [
        { value: 'shell', label: 'Shell Command' },
        { value: 'node', label: 'Node.js' },
        { value: 'python', label: 'Python' },
        { value: 'custom', label: 'Custom' }
      ],
      runOutput: '',
      isRunning: false,
      currentPid: null,
      error: null,
      eventUnlisten: null
    };
  },
  computed: {
    hasConfigurations() {
      return this.configurations && this.configurations.length > 0;
    },
    projectReady() {
      return this.currentProject && this.currentProject.path;
    }
  },
  watch: {
    currentProject: {
      immediate: true,
      handler(newProject) {
        if (newProject) {
          this.loadConfigurations();
        } else {
          this.configurations = [];
          this.selectedConfig = null;
        }
      }
    }
  },
  async mounted() {
    this.eventUnlisten = await listen('command-output', event => {
      console.info("Ricevuto command-output");
      console.info("Ricevuto payload:", event.payload);
      const outputData = event.payload;
      
      if (outputData.is_error) {
        this.runOutput += `${outputData.output}\n`; // I'll add red text for errors later
      } else {
        this.runOutput += outputData.output + '\n';
      }

      if (outputData.is_final) {
        this.isRunning = false;
      }
      
      this.$nextTick(() => {
        const terminal = this.$refs.terminal;
        if (terminal) {
          terminal.scrollTop = terminal.scrollHeight;
        }
      });
    });
  },
  beforeUnmount() {
    if (this.eventUnlisten) {
      this.eventUnlisten();
    }
    
    this.terminateCommand();
  },
  methods: {
    async loadConfigurations() {
      if (!this.projectReady) return;
      
      this.isLoading = true;
      this.error = null;
      
      try {
        const kodamaFolder = await join(this.currentProject.path, '.kodama');
        const launchJsonPath = await join(kodamaFolder, 'launch.json');
        
        const fileExists = await exists(launchJsonPath);
        
        if (fileExists) {
          const content = await readTextFile(launchJsonPath);
          const data = JSON.parse(content);
          this.configurations = data.configurations || [];
          
          if (this.configurations.length > 0) {
            this.selectedConfig = this.configurations[0];
          }
        } else {
          // Create default launch.json if it doesn't exist
          await this.createDefaultLaunchFile();
        }
      } catch (error) {
        console.error("Error loading run configurations:", error);
        this.error = "Failed to load run configurations. Please try again.";
      } finally {
        this.isLoading = false;
      }
    },
    
    async createDefaultLaunchFile() {
      if (!this.projectReady) return;
      
      try {
        const kodamaFolder = await join(this.currentProject.path, '.kodama');
        const launchJsonPath = await join(kodamaFolder, 'launch.json');
        
        // Default empty configurations
        const defaultContent = {
          version: "1.0.0",
          configurations: []
        };
        
        await writeTextFile(
          launchJsonPath, 
          JSON.stringify(defaultContent, null, 2)
        );
        
        this.configurations = [];
        console.log("Created default launch.json");
      } catch (error) {
        console.error("Error creating default launch.json:", error);
        this.error = "Failed to create launch configuration file.";
      }
    },
    
    async saveConfigurations() {
      if (!this.projectReady) return;
      
      try {
        const kodamaFolder = await join(this.currentProject.path, '.kodama');
        const launchJsonPath = await join(kodamaFolder, 'launch.json');
        
        const content = {
          version: "1.0.0",
          configurations: this.configurations
        };
        
        await writeTextFile(
          launchJsonPath,
          JSON.stringify(content, null, 2)
        );
        
        console.log("Saved launch configurations");
      } catch (error) {
        console.error("Error saving launch configurations:", error);
        this.error = "Failed to save configurations.";
      }
    },
    
    createConfiguration() {
      this.isCreating = true;
      this.newConfig = {
        name: '',
        type: 'shell',
        command: '',
        args: [],
        cwd: '${workspaceFolder}',
        env: {}
      };
    },
    
    cancelCreate() {
      this.isCreating = false;
    },
    
    async addConfiguration() {
      if (!this.newConfig.name || !this.newConfig.command) {
        this.error = "Name and command are required";
        return;
      }
      
      const configToAdd = { ...this.newConfig };
      
      if (typeof configToAdd.args === 'string') {
        configToAdd.args = configToAdd.args.split(' ').filter(arg => arg);
      }
      
      this.configurations.push(configToAdd);
      
      this.selectedConfig = configToAdd;
      
      await this.saveConfigurations();
      
      this.isCreating = false;
      this.error = null;
    },
    
    editConfiguration(config) {
      this.isEditing = true;
      this.newConfig = { ...config };
      
      if (Array.isArray(this.newConfig.args)) {
        this.newConfig.argsString = this.newConfig.args.join(' ');
      } else {
        this.newConfig.argsString = '';
      }
    },
    
    cancelEdit() {
      this.isEditing = false;
    },
    
    async updateConfiguration() {
      if (!this.newConfig.name || !this.newConfig.command) {
        this.error = "Name and command are required";
        return;
      }
      
      const index = this.configurations.findIndex(c => c.name === this.selectedConfig.name);
      
      if (index !== -1) {
        const updatedConfig = { ...this.newConfig };
        
        if (typeof updatedConfig.argsString === 'string') {
          updatedConfig.args = updatedConfig.argsString.split(' ').filter(arg => arg);
          delete updatedConfig.argsString;
        }
        
        this.configurations[index] = updatedConfig;
        this.selectedConfig = updatedConfig;
        
        await this.saveConfigurations();
      }
      
      this.isEditing = false;
      this.error = null;
    },
    
    async deleteConfiguration() {
      if (!this.selectedConfig) return;

      const confirmed = await dialogConfirm(
        `Are you sure you want to delete "${this.selectedConfig.name}" configuration?`,
        {
          title: "Confirm Deletion",
          kind: "warning"
        }
      );
      
      if (confirmed) {
        const index = this.configurations.findIndex(c => c.name === this.selectedConfig.name);
        
        if (index !== -1) {
          this.configurations.splice(index, 1);
          
          this.selectedConfig = this.configurations.length > 0 ? this.configurations[0] : null;
          
          await this.saveConfigurations();
        }
      }
    },
    
    selectConfiguration(config) {
      this.selectedConfig = config;
    },
    
    prepareConfigForExecution(config) {
      const preparedConfig = { ...config };
      
      switch (config.type) {
        case 'node':
          // If it's a Node.js script, ensure 'node' is the command
          if (!preparedConfig.command.startsWith('node ')) {
            preparedConfig.command = `node ${preparedConfig.command}`;
          }
          break;
        case 'python':
          // If it's a Python script, ensure 'python' is the command
          if (!preparedConfig.command.startsWith('python ') && 
              !preparedConfig.command.startsWith('python3 ')) {
            preparedConfig.command = `python ${preparedConfig.command}`;
          }
          break;
        // Will probably add other specific handlers or let the user create custom ones
      }
      
      return preparedConfig;
    },

    async runConfiguration() {
      if (!this.selectedConfig || !this.projectReady) return;
      
      // If a command is already running, don't start another
      if (this.isRunning) return;
      
      this.isRunning = true;
      this.error = null;
      this.runOutput = '';
      
      try {
        // Prepare the configuration based on its type
        const configToRun = this.prepareConfigForExecution(this.selectedConfig);
        
        if (!Array.isArray(configToRun.args)) {
          configToRun.args = [];
        }
        
        await invoke('execute_command', {
          config: {
            name: configToRun.name,
            command: configToRun.command,
            args: configToRun.args,
            cwd: configToRun.cwd,
            env: configToRun.env
          },
          projectPath: this.currentProject.path
        });
      } catch (error) {
        console.error("Error running configuration:", error);
        this.error = "Failed to run command. Check the configuration and try again.";
        this.runOutput += `Error: ${error.toString()}\n`;
        this.isRunning = false;
      }
    },
    
    async terminateCommand() {
      if (!this.isRunning || !this.currentPid) return;
      
      try {
        await invoke('terminate_command', {
          pid: this.currentPid
        });
        
        this.runOutput += "\nCommand terminated by user\n";
        this.isRunning = false;
        this.currentPid = null;
      } catch (error) {
        console.error("Error terminating command:", error);
        this.error = "Failed to terminate command.";
      }
    },
    
    formatArgs(args) {
      if (!args) return '';
      if (Array.isArray(args)) return args.join(' ');
      return args;
    },
  }
};
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between h-8 max-h-8 min-h-8">
      <span class="flex items-center ml-5 text-xs font-semibold">
        <span>RUN CONFIGURATIONS</span>
      </span>
    </div>
    
    <div class="border-t border-border-accent"></div>
    
    <div class="px-3 py-2">
      <!-- No project warning -->
      <div v-if="!projectReady" class="text-center p-4 text-runpanel-text-primary">
        <i class="fas fa-folder-open text-2xl mb-2"></i>
        <p>Open a project to manage run configurations</p>
      </div>
      
      <!-- Loading state -->
      <div v-else-if="isLoading" class="flex-1 flex items-center justify-center">
        <i class="fas fa-spinner fa-spin text-blue-400 text-2xl"></i>
      </div>
      
      <!-- Error message -->
      <div v-else-if="error" class="bg-red-900/50 text-red-200 p-2 rounded mb-2">
        <i class="fas fa-exclamation-circle mr-1"></i> {{ error }}
      </div>
      
      <!-- Main content when loaded -->
      <div v-else class="flex-1 flex flex-col h-full">
        <!-- Configuration list and actions -->
        <div class="flex justify-between items-center mb-2">
          <div class="text-sm text-runpanel-text-primary">
            <span v-if="hasConfigurations">{{ configurations.length }} configuration(s)</span>
            <span v-else>No configurations</span>
          </div>
          <button 
            @click="createConfiguration" 
            class="px-2 py-1 bg-primary hover:bg-accent-hover text-text-primary rounded text-sm"
            v-if="!isCreating && !isEditing"
          >
            <i class="fas fa-plus mr-1"></i> New
          </button>
        </div>
        
        <!-- Configuration creation form -->
        <div v-if="isCreating" class="bg-primary p-3 rounded mb-3">
          <h3 class="text-text-primary font-medium mb-2">New Configuration</h3>
          
          <div class="mb-2">
            <label class="block text-sm text-runpanel-text-primary mb-1">Name</label>
            <input 
              v-model="newConfig.name"
              type="text"
              class="w-full bg-accent text-text-primary px-2 py-1 rounded text-sm"
              placeholder="Configuration name"
              autocomplete="off"
            />
          </div>
          
          <div class="mb-2">
            <label class="block text-sm text-runpanel-text-primary mb-1">Type</label>
            <select
              v-model="newConfig.type"
              class="w-full bg-accent text-text-primaryrimary px-2 py-1 rounded text-sm"
            >
              <option 
                v-for="type in configTypes" 
                :key="type.value" 
                :value="type.value"
              >
                {{ type.label }}
              </option>
            </select>
          </div>
          
          <div class="mb-2">
            <label class="block text-sm text-runpanel-text-primary mb-1">Command</label>
            <input 
              v-model="newConfig.command"
              type="text"
              class="w-full bg-accent text-text-primaryrimary px-2 py-1 rounded text-sm"
              placeholder="Command to execute"
              autocomplete="off"
            />
          </div>
          
          <div class="mb-2">
            <label class="block text-sm text-runpanel-text-primary mb-1">Arguments</label>
            <input 
              v-model="newConfig.args"
              type="text"
              class="w-full bg-accent text-text-primaryrimary px-2 py-1 rounded text-sm"
              placeholder="Space-separated arguments"
              autocomplete="off"
            />
          </div>
          
          <div class="mb-3">
            <label class="block text-sm text-runpanel-text-primary mb-1">Working Directory</label>
            <input 
              v-model="newConfig.cwd"
              type="text"
              class="w-full bg-accent text-text-primaryrimary px-2 py-1 rounded text-sm"
              placeholder="Working directory"
              autocomplete="off"
            />
            <div class="text-xs text-runpanel-text-secondary mt-1">
              Use ${workspaceFolder} for project root
            </div>
          </div>
          
          <div class="flex justify-end space-x-2">
            <button 
              @click="cancelCreate" 
              class="px-2 py-1 bg-secondary hover:bg-accent-hover text-text-primary rounded text-sm"
            >
              Cancel
            </button>
            <button 
              @click="addConfiguration" 
              class="px-2 py-1 bg-accent hover:bg-accent-hover text-text-primary rounded text-sm"
            >
              Create
            </button>
          </div>
        </div>
        
        <!-- Configuration edit form -->
        <div v-else-if="isEditing" class="bg-primary p-3 rounded mb-3">
          <h3 class="text-text-primaryrimary font-medium mb-2">Edit Configuration</h3>
          
          <div class="mb-2">
            <label class="block text-sm text-runpanel-text-primary mb-1">Name</label>
            <input 
              v-model="newConfig.name"
              type="text"
              class="w-full bg-accent text-text-primaryrimary px-2 py-1 rounded text-sm"
              autocomplete="off"
            />
          </div>
          
          <div class="mb-2">
            <label class="block text-sm text-runpanel-text-primary mb-1">Type</label>
            <select
              v-model="newConfig.type"
              class="w-full bg-accent text-text-primaryrimary px-2 py-1 rounded text-sm"
            >
              <option 
                v-for="type in configTypes" 
                :key="type.value" 
                :value="type.value"
              >
                {{ type.label }}
              </option>
            </select>
          </div>
          
          <div class="mb-2">
            <label class="block text-sm text-runpanel-text-primary mb-1">Command</label>
            <input 
              v-model="newConfig.command"
              type="text"
              class="w-full bg-accent text-text-primaryrimary px-2 py-1 rounded text-sm"
              autocomplete="off"
            />
          </div>
          
          <div class="mb-2">
            <label class="block text-sm text-runpanel-text-primary mb-1">Arguments</label>
            <input 
              v-model="newConfig.argsString"
              type="text"
              class="w-full bg-accent text-text-primaryrimary px-2 py-1 rounded text-sm"
              autocomplete="off"
            />
          </div>
          
          <div class="mb-3">
            <label class="block text-sm text-runpanel-text-primary mb-1">Working Directory</label>
            <input 
              v-model="newConfig.cwd"
              type="text"
              class="w-full bg-accent text-text-primaryrimary px-2 py-1 rounded text-sm"
              autocomplete="off"
            />
            <div class="text-xs text-runpanel-text-secondary mt-1">
              Use ${workspaceFolder} for project root
            </div>
          </div>
          
          <div class="flex justify-end space-x-2">
            <button 
              @click="cancelEdit" 
              class="px-2 py-1 bg-secondary hover:bg-accent-hover text-text-primary rounded text-sm"
            >
              Cancel
            </button>
            <button 
              @click="updateConfiguration" 
              class="px-2 py-1 bg-accent hover:bg-accent-hover text-text-primary rounded text-sm"
            >
              Update
            </button>
          </div>
        </div>
        
        <!-- Configuration list -->
        <div v-else-if="hasConfigurations" class="mb-2 overflow-y-auto max-h-40 bg-accent rounded">
          <div 
            v-for="config in configurations" 
            :key="config.name"
            @click="selectConfiguration(config)"
            class="p-2 cursor-pointer border-b border-border-secondary last:border-b-0"
            :class="{ 'bg-primary': selectedConfig && selectedConfig.name === config.name }"
          >
            <div class="flex items-center">
              <div class="flex-1">
                <div class="text-text-primaryrimary font-medium text-sm">{{ config.name }}</div>
                <div class="text-xs text-runpanel-text-primary truncate">
                  {{ config.command }} {{ formatArgs(config.args) }}
                </div>
              </div>
              <div class="text-xs text-runpanel-text-secondary">{{ config.type }}</div>
            </div>
          </div>
        </div>
        
        <!-- No configurations message -->
        <div 
          v-else-if="!isCreating && !isEditing && !hasConfigurations" 
          class="mb-4 p-4 bg-primary rounded text-center"
        >
          <p class="text-runpanel-text-primary mb-2">No run configurations found</p>
          <button 
            @click="createConfiguration" 
            class="px-2 py-1 bg-accent hover:bg-accent-hover text-text-primaryrimary rounded text-sm"
          >
            <i class="fas fa-plus mr-1"></i> Create your first configuration
          </button>
        </div>
        
        <!-- Configuration details and run controls -->
        <div 
          v-if="selectedConfig && !isCreating && !isEditing" 
          class="bg-primary p-3 rounded mb-2"
        >
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-text-primary font-medium text-sm">{{ selectedConfig.name }}</h3>
            <div class="flex space-x-1">
              <button 
                @click="editConfiguration(selectedConfig)" 
                class="text-runpanel-text-primary hover:text-text-primary"
                title="Edit configuration"
                :disabled="isRunning"
                :class="{ 'opacity-50 cursor-not-allowed': isRunning }"
              >
                <i class="fas fa-edit"></i>
              </button>
              <button 
                @click="deleteConfiguration" 
                class="text-runpanel-text-primary hover:text-red-400"
                title="Delete configuration"
                :disabled="isRunning"
                :class="{ 'opacity-50 cursor-not-allowed': isRunning }"
              >
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          
          <div class="text-xs text-text-secondary mb-3">
            <div class="mb-1"><span class="text-runpanel-text-secondary">Type:</span> {{ selectedConfig.type }}</div>
            <div class="mb-1">
              <span class="text-runpanel-text-secondary">Command:</span> 
              {{ selectedConfig.command }} {{ formatArgs(selectedConfig.args) }}
            </div>
            <div><span class="text-runpanel-text-secondary">Working dir:</span> {{ selectedConfig.cwd }}</div>
          </div>
          
          <button 
            @click="runConfiguration" 
            class="w-full py-1 bg-green-700 hover:bg-green-600 text-white rounded text-sm flex items-center justify-center"
            :disabled="isRunning"
            :class="{ 'opacity-50 cursor-not-allowed': isRunning }"
          >
            <i class="fas fa-play mr-1"></i> 
            {{ isRunning ? 'Running...' : 'Run' }}
          </button>
        </div>
        
        <!-- Terminal -->
        <div class="bg-terminal-primary rounded overflow-hidden flex flex-col h-64 mb-1">
          <div class="bg-primary px-2 py-1 text-xs text-runpanel-text-primary flex items-center justify-between">
            <span>Output</span>
            <div v-if="runOutput">
              <button 
                class="text-runpanel-text-primary hover:text-text-primary"
                title="Clear output"
                @click="runOutput = ''"
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
          <div class="overflow-auto font-mono text-xs text-terminal-text-primary whitespace-pre-line p-2 h-full">
            {{ runOutput || 'Run a configuration to see output here' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>