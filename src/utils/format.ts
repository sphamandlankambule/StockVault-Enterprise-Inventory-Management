export const formatCurrency = (val: number | undefined | null, symbol: string = 'E', decimals: number = 2): string => {
  if (val === undefined || val === null || isNaN(val)) {
    return `${symbol} 0.00`;
  }
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(val);
  return `${symbol} ${formattedNumber}`;
};
