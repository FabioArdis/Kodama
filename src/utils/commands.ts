export interface Command {
  id: string;
  title: string;
  description?: string;
  category?: string;
  shortcut?: string;
  icon?: string;
  execute: () => void | Promise<void>;
}

class CommandRegistry {
  private commands: Map<string, Command> = new Map();

  register(command: Command): void {
    if (this.commands.has(command.id)) {
      console.warn(`Command with ID '${command.id}' already exists. Overwriting.`);
    }
    this.commands.set(command.id, command);
  }

  registerAll(commands: Command[]): void {
    commands.forEach(command => this.register(command));
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  async execute(id: string): Promise<void> {
    const command = this.commands.get(id);
    if (!command) {
      console.error(`Command with ID '${id}' not found.`);
      return;
    }

    try {
      await command.execute();
    } catch (error) {
      console.error(`Error executing command '${id}':`, error);
    }
  }
}

export const commandRegistry = new CommandRegistry();

export function registerDefaultCommands(callbacks: {
  newFile?: () => void;
  openFile?: () => void;
  openProject?: () => void;
  openSettings?: () => void;
  openThemeSelector?: () => void;
  [key: string]: any;
}): void {
  const defaultCommands: Command[] = [
    {
      id: 'file.new',
      title: 'New File',
      category: 'File',
      shortcut: 'Ctrl+N',
      execute: () => callbacks.newFile?.()
    },
    {
      id: 'file.open',
      title: 'Open File',
      category: 'File',
      shortcut: 'Ctrl+O',
      execute: () => callbacks.openFile?.()
    },
    {
      id: 'project.open',
      title: 'Open Project',
      category: 'Project',
      shortcut: 'Ctrl+Shift+O',
      execute: () => callbacks.openProject?.()
    },
    {
      id: 'view.settings',
      title: 'Open Settings',
      category: 'View',
      shortcut: 'Ctrl+,',
      execute: () => callbacks.openSettings?.()
    },
    {
      id: 'view.commandPalette',
      title: 'Show Command Palette',
      category: 'View',
      shortcut: 'Ctrl+Shift+P',
      execute: () => {} // No need to handle this
    },
    {
      id: 'view.immersiveMode',
      title: 'Toggle Immersive Mode',
      category: 'View',
      shortcut: 'Ctrl+Alt+Enter',
      execute: () => callbacks.toggleImmersiveMode?.()
    },
    {
      id: 'view.setTheme',
      title: 'Set Theme',
      category: 'View',
      shortcut: 'Ctrl+T',
      execute: () => callbacks.openThemeSelector?.()
    }
  ];

  commandRegistry.registerAll(defaultCommands);
}