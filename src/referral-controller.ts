import { Request, Response } from 'express';
import { get, controller } from './decorators';
import { generateCouponCode } from './lib/coupon';
import { shopifyStore, listReferees, klaviyo, listInvites, priceRuleInvitee, priceRuleReferreeLink } from './const';
import { ExamineOrders } from './examine-orders';

/**
 * Launch our order examinator
 */
const examinator = new ExamineOrders(shopifyStore, klaviyo);

/**
 * Controller
 */
@controller('/ref')
class ReferralController {

  /**
   * Get a coupon code link for partners with 20% discount
   * @param req
   * @param res
   */
  @get('/generatelink')
  async generateCouponCode(req: Request, res: Response): Promise<void> {
    if (req.query.referreename && req.query.referreemail) {
      try {
        const coupons = await generateCouponCode(shopifyStore, 1, priceRuleReferreeLink, false);
        await klaviyo.subscribeToReferree(listReferees, req.query.referreemail, req.query.referreename, true, coupons[0]);
        res.status(200);
        res.json(coupons[0]);
      } catch (error) {
        res.status(402);
        res.json('error');
      }
    } else {
      res.status(403);
      res.send('Not permitted');
    }
  }

  /**
   * Get Products
   * @param req
   * @param res
   */
  @get('/addemail')
  async subscribeProgram(req: Request, res: Response): Promise<void> {
    if (req.query.referreename && req.query.referreemail && req.query.emails && req.query.emails.split(',').length > 0) {
      const emails: string[] = req.query.emails.split(',');
      try {
        const coupons = await generateCouponCode(shopifyStore, emails.length, priceRuleInvitee);
        await klaviyo.subscribeToReferree(listReferees, req.query.referreemail, req.query.referreename);
        emails.forEach(async (value, index) => {
          const response = await klaviyo.subscribeToInvites(
            listInvites,
            value,
            req.query.referreename,
            req.query.referreemail,
            coupons[index]
          );
          console.log(response);
        });
        res.status(200);
        res.json('ok');
      } catch (error) {
        res.status(402);
        res.json('error');
      }
    } else {
      res.status(403);
      res.send('Not permitted');
    }
  }
}
