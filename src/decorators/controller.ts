import 'reflect-metadata';
import { AppRouter } from '../app-router';
import { Methods } from './methods';
import { MetadataKeys } from './metadata-keys';
import { RequestHandler, NextFunction, Request, Response } from 'express';

/**
 * Validatate the request first
 * @param keys
 */
function bodyValidators(keys: string[]): RequestHandler {
  return function(req: Request, res: Response, next: NextFunction) {
    if (!req.body) {
      res.status(422).send('Invalid request');
      return;
    }

    for (let key of keys) {
      if (!req.body[key]) {
        res.status(422).send(`Missing property: ${key}`);
        return;
      }
    }

    next();
  };
}

/**
 * Controller inject middle where methodm path
 * @param routePrefix
 */
export function controller(routePrefix: string) {
  // applied to constructor main function typeof call
  return function(target: Function) {
    const router = AppRouter.getInstance();

    for (let key in target.prototype) {
      const routeHandler = target.prototype[key];
      const path = Reflect.getMetadata(MetadataKeys.PATH, target.prototype, key);
      const method: Methods = Reflect.getMetadata(MetadataKeys.METHOD, target.prototype, key);
      const middlewares = Reflect.getMetadata(MetadataKeys.MIDDLEWARE, target.prototype, key) || [];
      const requiredBodyProps = Reflect.getMetadata(MetadataKeys.VALIDATOR, target.prototype, key) || [];

      const validator = bodyValidators(requiredBodyProps);
      if (path) {
        router[method](`${routePrefix}${path}`, ...middlewares, validator, routeHandler);
      }
    }
  };
}
