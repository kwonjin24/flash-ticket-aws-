export class CompletePaymentDto {
  orderId: string;
  paymentId: string;
  userId: string;
  status: 'OK' | 'FAIL';
}
