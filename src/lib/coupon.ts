import Shopify from 'shopify-api-node';
import { couponParameters } from '../const';

/**
 * Generate nbCoupons code
 * @param shop
 * @param nbCoupons
 * @Param couponCode
 */
export const generateCouponCode = async (
  shop: Shopify,
  nbCoupons: number,
  couponCode: string,
  limitToOne: boolean = true
): Promise<string[]> => {
  const response: string[] = [];
  if (nbCoupons === 0) {
    return response;
  }
  try {
    const params = { limit: 250 };
    const rules = await shop.priceRule.list(params);
    let ruleId;
    // Try to find the rule
    for (const rule of rules) {
      if (rule.title === couponCode) {
        ruleId = rule.id;
        break;
      }
    }

    const { value_type, value } = couponParameters;
    // Create the rule since we couldn't find it
    if (!ruleId) {
      // Both invitee and referral have the same coupon properties as of right now!
      const res = await shop.priceRule.create({
        title: couponCode,
        target_type: 'line_item',
        target_selection: 'all',
        allocation_method: 'across',
        value_type,
        value,
        ...(limitToOne && { usage_limit: 1 }),
        customer_selection: 'all',
        starts_at: '2020-10-19T17:59:10Z'
      });
      ruleId = res.id;
    }

    for (let i = 0; i < nbCoupons; i++) {
      // Generate random coupon code name
      const code = `${couponCode}_${[...Array(6)].map(i => (~~(Math.random() * 36)).toString(36)).join('')}`;
      const res = await shop.discountCode.create(ruleId, { code });
      // Return the coupon code created
      response.push(code);
    }
  } catch (error) {
    console.log(error);
  }
  return response;
};
