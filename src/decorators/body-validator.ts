import 'reflect-metadata';
import { MetadataKeys } from './metadata-keys';

/**
 * BodyBalidator for Rest Request
 * @param keys
 */
export function bodyValidator(...keys: string[]) {
  return function(target: any, key: string, desc: PropertyDescriptor) {
    Reflect.defineMetadata(MetadataKeys.VALIDATOR, keys, target, key);
  };
}
