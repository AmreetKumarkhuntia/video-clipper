export { config, getConfig, getGroupedConfig, setConfigValues, getMaskedConfig } from './env.js';
export { groupConfig } from './groups.js';
export { buildConfigRegistry } from './registry.js';
export { getTokenEncryptionKey } from './tokenEncryptionKey.js';
export { getDatabaseConfig } from './database.js';
export type {
  ConfigRegistryResponse,
  ConfigGroupDescriptor,
  ConfigFieldDescriptor,
  ConfigGroup,
  ConfigGroupPrefix,
  GroupedConfig,
  DatabaseConfig,
} from '@lib/types/config.js';
