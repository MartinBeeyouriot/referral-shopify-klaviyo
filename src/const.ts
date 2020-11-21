import { Klaviyo } from './lib/klaviyo';
import Shopify from 'shopify-api-node';

// Declare Klaviyo API keys
export const klaviyo = new Klaviyo('KLAVIYO-ID', 'KLAVIYO-PK', undefined);

// Declare our Shopify Store
export const shopifyStore = new Shopify({
  shopName: 'SHOP-NAME',
  apiKey: 'API-KEY',
  password: 'API-PASSWORD',
  apiVersion: '2020-01'
});
// Add listener on limits
shopifyStore.on('callLimits', limits => console.log(limits));

// list in klaviyo to setup
export const listInvites = 'xx';
export const listReferees = 'yy';
// coupon code string
export const priceRuleInvitee = 'REFERRAL_INVITEE';
export const priceRuleReferree = 'REFERRAL_OW';
export const priceRuleReferreeLink = 'REFERRAL_LK';
// klaviyo event
export const klaviyoEvent = 'Referral bought a product';

// Check orders every x hours
export const twelveHourTimeOut = 12 * 60 * 60 * 1000; // Every 12 hours

// Coupon code parameters, value_type: 'percentage' or 'fixed_amout' defined by shopify
export const couponParameters = {
  value_type: 'fixed_amount',
  value: '-20.0'
}
