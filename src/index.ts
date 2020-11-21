import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';

import './referral-controller';
import { AppRouter } from './app-router';

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(AppRouter.getInstance());

const port = 3000;
/**
 * Default port to 3000
 */
app.listen(port, () => {
  console.log(`Listening on ${port} ...`);
});

/**
 * Basic welcome message for our root
 */
app.get('/', (req: Request, res: Response) => {
  res.send(`
      <div>
      <h1>Welcome to the Referral API Program!<h1>
      </div>
      `);
});
