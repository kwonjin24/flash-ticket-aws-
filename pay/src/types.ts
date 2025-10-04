export type PaymentRequestJob = {
  requestId: string;
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  method: string;
  metadata?: Record<string, unknown>;
};

export type PaymentResultPayload = {
  requestId: string;
  paymentId: string;
  orderId: string;
  status: 'OK' | 'FAIL';
  processedAt: string;
  message?: string;
};
