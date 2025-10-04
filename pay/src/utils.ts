export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const failureReasons = [
  '카드 한도 초과',
  '잔액 부족',
  '네트워크 오류',
  '추가 인증 필요',
];

export const pickFailureReason = (): string => {
  const index = Math.floor(Math.random() * failureReasons.length);
  return failureReasons[index];
};
