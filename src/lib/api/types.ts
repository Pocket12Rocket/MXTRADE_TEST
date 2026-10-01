import type { components } from './schema';

type Schemas = components['schemas'];

export type Me = Schemas['Me'];
export type Role = Schemas['Role'];
export type Permission = Schemas['Permission'];
export type RegisterBody = Schemas['RegisterBody'];
export type LoginBody = Schemas['LoginBody'];
export type TokenBody = Schemas['TokenBody'];
export type EmailOnlyBody = Schemas['EmailOnlyBody'];
export type ResetPasswordBody = Schemas['ResetPasswordBody'];
export type AcceptTermsBody = Schemas['AcceptTermsBody'];
export type UpdateMeBody = Schemas['UpdateMeBody'];

export type CatalogConfig = Schemas['CatalogConfig'];
export type Category = Schemas['Category'];
export type Condition = Schemas['Condition'];
export type ProductSummary = Schemas['ProductSummary'];
export type ProductList = Schemas['ProductList'];
export type ProductDetail = Schemas['ProductDetail'];
export type Image = Schemas['Image'];
export type Special = Schemas['Special'];
export type AboutContent = Schemas['AboutContent'];
export type FaqList = Schemas['FaqList'];
export type Faq = Schemas['Faq'];
export type ContactBody = Schemas['ContactBody'];
export type PublicHolidayList = Schemas['PublicHolidayList'];
export type NotificationSummary = Schemas['NotificationSummary'];
export type DeliveryFee = Schemas['DeliveryFee'];

export type Checkout = Schemas['Checkout'];
export type CheckoutStatus = Schemas['CheckoutStatus'];
export type CheckoutQuote = Schemas['CheckoutQuote'];
export type CheckoutQuoteItem = Schemas['CheckoutQuoteItem'];
export type CheckoutQuoteSeller = Schemas['CheckoutQuoteSeller'];
export type CheckoutQuoteRequest = Schemas['CheckoutQuoteRequest'];
export type CreateCheckoutRequest = Schemas['CreateCheckoutRequest'];
export type CreateCheckoutResponse = Schemas['CreateCheckoutResponse'];
export type PayFastCheckout = Schemas['PayFastCheckout'];
export type ShippingAddress = Schemas['ShippingAddress'];

export type Order = Schemas['Order'];
export type OrderStatus = Schemas['OrderStatus'];
export type OrderItem = Schemas['OrderItem'];
export type OrderPage = Schemas['OrderPage'];
export type OrderSummary = Schemas['OrderSummary'];
export type OrderRefund = Schemas['OrderRefund'];
export type RefundStatus = Schemas['RefundStatus'];
export type RefundType = Schemas['RefundType'];
export type RefundImage = Schemas['RefundImage'];
export type RefundRequestInput = Schemas['RefundRequestInput'];
export type RefundBankAccountInput = Schemas['RefundBankAccountInput'];
export type BankAccountType = Schemas['BankAccountType'];
export type MaskedRefundBankAccount = Schemas['MaskedRefundBankAccount'];

export type Submission = Schemas['Submission'];
export type SubmissionInput = Schemas['SubmissionInput'];
export type SubmissionStatus = Schemas['SubmissionStatus'];
export type SubmissionPage = Schemas['SubmissionPage'];
export type ImageRef = Schemas['ImageRef'];
export type SellerProduct = Schemas['SellerProduct'];
export type SellerProductPage = Schemas['SellerProductPage'];
export type SellerProductDetail = Schemas['SellerProductDetail'];
export type SellerProfile = Schemas['SellerProfile'];
export type SellerStatus = Schemas['SellerStatus'];
export type UpsertSellerProfileBody = Schemas['UpsertSellerProfileBody'];
export type ServiceFeeQuote = Schemas['ServiceFeeQuote'];
export type MyPayouts = Schemas['MyPayouts'];
export type Payout = Schemas['Payout'];

export type MessageResponse = Schemas['MessageResponse'];
export type FieldError = Schemas['FieldError'];
export type ProblemDetails = Schemas['ProblemDetails'];
export type ErrorCode = Schemas['ErrorCode'];
