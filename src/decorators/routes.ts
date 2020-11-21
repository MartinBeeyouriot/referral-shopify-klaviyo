import 'reflect-metadata';
import { Methods } from './methods';
import { MetadataKeys } from './metadata-keys';
import { RequestHandler } from 'express';

interface RouteHandlerDescription extends PropertyDescriptor {
  value?: RequestHandler;
}
/*
  routeBinder
*/
function routeBinder(method: string) {
  return function(path: string) {
    return function(target: any, key: string, desc: RouteHandlerDescription) {
      Reflect.defineMetadata(MetadataKeys.PATH, path, target, key);
      Reflect.defineMetadata(MetadataKeys.METHOD, method, target, key);
    };
  };
}

/**
 * Define Http method
 */
export const get = routeBinder(Methods.GET);
export const post = routeBinder(Methods.POST);
export const del = routeBinder(Methods.DEL);
export const put = routeBinder(Methods.PUT);
