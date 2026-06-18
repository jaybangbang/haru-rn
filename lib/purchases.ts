import Purchases, { LOG_LEVEL, CustomerInfo } from 'react-native-purchases';

export const PRODUCT_IDS = {
  monthly: 'com.sigcrew.haru.monthly',
  yearly: 'com.sigcrew.haru.yearly',
};

const ENTITLEMENT_ID = 'premium';

export function initPurchases(): void {
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
  if (!apiKey) return;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
}

export async function getOfferings() {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchasePackage(pkg: import('react-native-purchases').PurchasesPackage): Promise<boolean> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return isActiveSubscriber(customerInfo);
}

export async function restorePurchases(): Promise<boolean> {
  const customerInfo = await Purchases.restorePurchases();
  return isActiveSubscriber(customerInfo);
}

export async function getActiveSubscription(): Promise<boolean> {
  const customerInfo = await Purchases.getCustomerInfo();
  return isActiveSubscriber(customerInfo);
}

function isActiveSubscriber(info: CustomerInfo): boolean {
  return ENTITLEMENT_ID in info.entitlements.active;
}
