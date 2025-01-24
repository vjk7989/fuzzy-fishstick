import React from 'react';

interface TokenDisplayProps {
  amount: number;
  showPlus?: boolean;
  className?: string;
}

export default function TokenDisplay({ amount, showPlus = false, className = '' }: TokenDisplayProps) {
  const formattedAmount = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return (
    <span className={className}>
      {showPlus && amount > 0 ? '+' : ''}
      ₹{formattedAmount}
    </span>
  );
}