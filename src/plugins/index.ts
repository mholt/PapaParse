/**
 * Plugin System for PapaParse
 * Tree-shakable plugin architecture for modern builds
 */

export {
  default as jqueryPlugin,
  registerJQueryPlugin,
  autoRegisterJQueryPlugin,
} from "./jquery";

// Plugin registry for extensibility
type PluginInitializer = (Papa: any) => void;

const registeredPlugins = new Set<string>();
const pluginInitializers = new Map<string, PluginInitializer>();

/**
 * Register a plugin with the Papa object
 * Allows for dynamic plugin loading and initialization
 */
export function registerPlugin(name: string, initializer: PluginInitializer): void {
  if (registeredPlugins.has(name)) {
    console.warn(`Plugin '${name}' is already registered`);
    return;
  }

  pluginInitializers.set(name, initializer);
  registeredPlugins.add(name);
}

/**
 * Initialize all registered plugins with a Papa instance
 * Called during Papa object construction
 */
export function initializePlugins(Papa: any): void {
  for (const [name, initializer] of pluginInitializers) {
    try {
      initializer(Papa);
    } catch (error) {
      console.error(`Failed to initialize plugin '${name}':`, error);
    }
  }
}

/**
 * Check if a plugin is registered
 */
export function isPluginRegistered(name: string): boolean {
  return registeredPlugins.has(name);
}

/**
 * Get list of all registered plugin names
 */
export function getRegisteredPlugins(): string[] {
  return Array.from(registeredPlugins);
}

/**
 * Unregister a plugin (for testing or dynamic plugin management)
 */
export function unregisterPlugin(name: string): boolean {
  const removed = registeredPlugins.delete(name);
  pluginInitializers.delete(name);
  return removed;
}

export default {
  registerPlugin,
  initializePlugins,
  isPluginRegistered,
  getRegisteredPlugins,
  unregisterPlugin,
};
