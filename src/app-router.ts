import express from 'express';

export class AppRouter {
  private static instance: express.Router;

  /**
   * Single instance of it
   */
  static getInstance(): express.Router {
    if (!AppRouter.instance) {
      AppRouter.instance = express.Router();
    }
    return AppRouter.instance;
  }
}
