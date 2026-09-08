export { config, getConfig, getGroupedConfig, setConfigValues, getMaskedConfig } from './env.js';
export { groupConfig } from './groups.js';
export { buildConfigRegistry } from './registry.js';
export type {
  ConfigRegistryResponse,
  ConfigGroupDescriptor,
  ConfigFieldDescriptor,
  ConfigGroup,
  ConfigGroupPrefix,
  GroupedConfig,
} from '@lib/types/config.js';
