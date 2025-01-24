import React, { useEffect, useState, useCallback } from 'react';
import { Coins } from 'lucide-react';
import { getTokenBalance } from '../lib/tokens';
import TokenDisplay from './TokenDisplay';
import toast from 'react-hot-toast';

interface TokenBalanceProps {
  onBalanceChange?: (balance: number) => void;
}

export default function TokenBalance({ onBalanceChange }: TokenBalanceProps) {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const loadBalance = useCallback(async () => {
    try {
      const tokenBalance = await getTokenBalance();
      setBalance(Number(tokenBalance.toFixed(2)));
      onBalanceChange?.(tokenBalance);
      setLoading(false);
    } catch (error: any) {
      console.error('Error loading token balance:', error);
      if (!loading) {
        toast.error('Failed to load token balance');
      }
    }
  }, [onBalanceChange, loading]);

  useEffect(() => {
    loadBalance();
    const interval = setInterval(loadBalance, 5000);
    return () => clearInterval(interval);
  }, [loadBalance]);

  return (
    <div className="flex items-center gap-2 bg-[#0f1923] px-4 py-2 rounded-lg border border-[#2c3b47]">
      <Coins className="w-5 h-5 text-[#00e701]" />
      {loading ? (
        <div className="animate-pulse bg-[#2c3b47] h-5 w-16 rounded"></div>
      ) : (
        <TokenDisplay amount={balance} className="font-bold text-white" />
      )}
    </div>
  );
}