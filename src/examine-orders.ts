import Shopify from 'shopify-api-node';
import fs from 'fs';
import { Klaviyo } from './lib/klaviyo';
import {
  twelveHourTimeOut,
  listInvites,
  priceRuleReferree,
  klaviyoEvent,
  priceRuleInvitee,
  listReferees,
  priceRuleReferreeLink
} from './const';
import { generateCouponCode } from './lib/coupon';

interface INotify {
  email: string;
  nameInvites: string;
  emailInvites: string;
}

const ordersFile = 'orders.txt';

export class ExamineOrders {
  constructor(private shop: Shopify, private klaviyo: Klaviyo) {
    this.examine();
  }

  /**
   * Get the orders from Shopify
   * @param lastOrder
   * @param couponCode, coupon code pattern to match
   */
  async getOrders(lastOrder: number): Promise<Shopify.IOrder[]> {
    const ordersFinal: Shopify.IOrder[] = [];
    let params = { limit: 50 };
    let biggestOrder: number = 0;

    try {
      do {
        const orders: any = await this.shop.order.list(params);
        for (const order of orders) {
          if (order.id > biggestOrder) {
            biggestOrder = order.id;
          }
          if (order.id <= lastOrder) {
            continue;
          }
          ordersFinal.push(order);
        }
        params = orders.nextPageParameters;
      } while (params !== undefined);

      writeLastOrder(biggestOrder);
    } catch (error) {
      console.log('An error happened getOrders(1): ' + error);
    }
    return ordersFinal;
  }

  /**
   * Parse the orders and skip the one before lastOrders
   * @param lastOrder
   * @param couponCode, coupon code pattern to match
   */
  parseOrders(orders: Shopify.IOrder[], couponCode: string): Shopify.IOrder[] {
    const ordersWithInvitee: Shopify.IOrder[] = [];

    for (const order of orders) {
      if (order.discount_codes.length > 0) {
        for (const discount of order.discount_codes) {
          if (discount.code.toLowerCase().includes(couponCode.toLowerCase())) {
            ordersWithInvitee.push(order);
          }
        }
      }
    }
    return ordersWithInvitee;
  }

  /**
   * Timer that update the pictures
   */
  examine = async (): Promise<void> => {
    console.log(`Checking for new Orders...`);

    let lastOrderExamined = await readLastOrder();
    console.log(`Last order examined was: ${lastOrderExamined}`);

    const shopifyOrders = await this.getOrders(lastOrderExamined);

    const orders = await this.parseOrders(shopifyOrders, priceRuleInvitee);
    console.log(`Order found with referral codes: ${orders.length} ${orders.map(v => v.order_number)} / ${orders.map(v => v.email)}`);

    const ordersWithReferralLink = await this.parseOrders(shopifyOrders, priceRuleReferreeLink);
    console.log(
      `Order found with referral link codes (partner with link ): ${ordersWithReferralLink.length} ${ordersWithReferralLink.map(
        v => v.order_number
      )} / ${ordersWithReferralLink.map(v => v.email)}`
    );

    if (orders.length > 0) {
      const notified = await this.findReferrees(orders);
      console.log(`Customer #1 to notify: ${JSON.stringify(notified)}`);

      await this.sendNofications(notified);
    }

    if (ordersWithReferralLink.length > 0) {
      const notified = await this.findReferreesWithLink(ordersWithReferralLink);
      console.log(`Customer #1 to notify: ${JSON.stringify(notified)}`);

      await this.sendNofications(notified);
    }

    console.log(`Examined: ${shopifyOrders.length} orders.`);
    console.log(`Done!`);

    setTimeout(this.examine, twelveHourTimeOut);
  };

  /**
   * Send Nofications and generates coupon codes
   */
  async sendNofications(notifyList: INotify[]): Promise<void> {
    try {
      const coupons = await generateCouponCode(this.shop, notifyList.length, priceRuleReferree);
      console.log(`Coupons generated: ${coupons}`);
      notifyList.forEach((notify, index) => {
        this.klaviyo.track(klaviyoEvent, {
          $email: notify.email,
          referreeCode: coupons[index],
          invitesEmail: notify.emailInvites,
          invitesName: notify.nameInvites
        });
      });
    } catch (error) {
      console.log('An error happened sendNofications(3): ' + error);
    }
  }

  /**
   * Find order Referres or owners
   * @param orders
   */
  async findReferreesWithLink(orders: Shopify.IOrder[]): Promise<INotify[]> {
    const notifyList: INotify[] = [];
    try {
      const emailsMap = new Map<String, boolean>();
      console.log(`Querying klaviyo referree list members ...`);
      // We are querying the list of refereers to find the proper coupon code
      const persons: any = await this.klaviyo.getListMembers(listReferees);

      for (const person of persons.records) {
        const profile: any = await this.klaviyo.getProfile(person.id);
        if (!profile.hasShareableLink) {
          continue;
        }
        console.log(profile);
        for (const order of orders) {
          for (const discount of order.discount_codes) {
            if (discount.code.toLowerCase().trim() === profile.linkReferral.toLowerCase().trim()) {
              // Make sure the referrer is only once in the list
              if (!emailsMap.get(profile.referrerEmail)) {
                notifyList.push({ email: profile.email, nameInvites: profile.name, emailInvites: order.email });
                emailsMap.set(profile.referrerEmail, true);
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`Error happened in findReferreesWithLink: ${error}`);
    }
    return notifyList;
  }

  /**
   * Find order Referres or owners
   * @param orders
   */
  async findReferrees(orders: Shopify.IOrder[]): Promise<INotify[]> {
    const notifyList: INotify[] = [];
    try {
      const ordersDone = new Map<Number, boolean>();
      const emailsMap = new Map<String, boolean>();
      console.log(`Querying klaviyo invitees list members ...`);
      const persons: any = await this.klaviyo.getListMembers(listInvites);

      for (const order of orders) {
        for (const person of persons.records) {
          if (person.email.toLowerCase().trim() === order.email.toLowerCase().trim()) {
            const profile: any = await this.klaviyo.getProfile(person.id);
            // Make sure the referrer is only once in the list
            if (!emailsMap.get(profile.referrerEmail)) {
              notifyList.push({ email: profile.referrerEmail, nameInvites: profile.referrerName, emailInvites: order.email });
              emailsMap.set(profile.referrerEmail, true);
            }
            ordersDone.set(order.id, true);
            break;
          }
        }
      }

      // Try to find the left over orders by using the coupon code
      if (orders.length !== ordersDone.size) {
        console.log(`Some people didn't have the same email when purchase ...`);
        for (const person of persons.records) {
          const profile: any = await this.klaviyo.getProfile(person.id);
          for (const order of orders) {
            if (ordersDone.get(order.id)) {
              continue;
            }
            for (const discount of order.discount_codes) {
              if (discount.code.toLowerCase().trim() === profile.discountCode.toLowerCase().trim()) {
                // Make sure the referrer is only once in the list
                if (!emailsMap.get(profile.referrerEmail)) {
                  notifyList.push({ email: profile.referrerEmail, nameInvites: profile.referrerName, emailInvites: order.email });
                  emailsMap.set(profile.referrerEmail, true);
                }
                ordersDone.set(order.id, true);
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`Error happened findReferrees(2): ${error}`);
    }
    return notifyList;
  }
}

/**
 * Read last Order
 */
const readLastOrder = (): Promise<number> => {
  return new Promise((resolve, reject) => {
    fs.readFile(ordersFile, (err, data) => {
      if (err) {
        return resolve(0);
      }
      return resolve(Number(data));
    });
  });
};

/**
 * Write last Order
 * @param orderId
 */
const writeLastOrder = (orderId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.writeFile(ordersFile, orderId, function(err) {
      if (err) {
        return reject();
      }
    });
    resolve();
  });
};
