export type PaymentRequestMessage = {
  requestId: string;
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  method: string;
  metadata?: Record<string, unknown>;
};

export type PaymentResultMessage = {
  requestId: string;
  paymentId: string;
  orderId: string;
  userId: string;
  status: 'OK' | 'FAIL';
  processedAt: string;
  message?: string;
};
