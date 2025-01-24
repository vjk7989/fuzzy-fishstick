import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Wallet } from 'lucide-react';
import { buyTokens } from '../lib/tokens';
import { connectPhantomWallet, getPhantomProvider } from '../lib/phantom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface TokenPurchaseModalProps {
  onClose: () => void;
  onSuccess: (amount: number) => void;
}

export default function TokenPurchaseModal({ onClose, onSuccess }: TokenPurchaseModalProps) {
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletPublicKey, setWalletPublicKey] = useState<string | null>(null);
  const [isModalClosing, setIsModalClosing] = useState(false);

  useEffect(() => {
    checkWalletConnection();
    
    const handleWalletChange = () => {
      checkWalletConnection();
    };
    
    window.addEventListener('wallet-change', handleWalletChange);
    return () => {
      window.removeEventListener('wallet-change', handleWalletChange);
    };
  }, []);

  const checkWalletConnection = async () => {
    try {
      const provider = await getPhantomProvider();
      const isConnected = provider.isConnected && provider.publicKey;
      setIsWalletConnected(isConnected);
      
      if (isConnected && provider.publicKey) {
        setWalletPublicKey(provider.publicKey.toString());
        setError(null);
      } else {
        setWalletPublicKey(null);
      }
    } catch (error: any) {
      if (!error.message?.includes('Please install Phantom')) {
        console.error('Error checking wallet connection:', error);
      }
      setIsWalletConnected(false);
      setWalletPublicKey(null);
    }
  };

  const handleConnectWallet = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const publicKey = await connectPhantomWallet();
      setWalletPublicKey(publicKey);
      setIsWalletConnected(true);
      
      toast.success('Wallet connected successfully!');
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      setError(error.message);
      toast.error(error.message);
      setIsWalletConnected(false);
      setWalletPublicKey(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!isWalletConnected || !walletPublicKey) {
      setError('Please connect your wallet first');
      return;
    }

    if (amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setError(null);
    setLoading(true);
    
    try {
      const { tokenAmount } = await buyTokens(amount);
      toast.success(`Successfully purchased ${tokenAmount} tokens!`);
      onSuccess(tokenAmount);
    } catch (error: any) {
      console.error('Error purchasing tokens:', error);
      setError(error.message);
      toast.error(error.message);
      
      if (error.message?.includes('Wallet not connected')) {
        setIsWalletConnected(false);
        setWalletPublicKey(null);
        await checkWalletConnection();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    
    setIsModalClosing(true);
    setError(null);
    setAmount(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1b2733] p-6 rounded-lg border border-[#2c3b47] w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Buy Tokens</h3>
          <button
            onClick={handleClose}
            className="text-[#8b9caa] hover:text-white transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          {!isWalletConnected ? (
            <button
              onClick={handleConnectWallet}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#4c82fb] hover:bg-[#3b71ea] text-white font-bold py-3 px-4 rounded-lg transition-colors mb-4"
            >
              <Wallet className="w-5 h-5" />
              {loading ? 'Connecting...' : 'Connect Phantom Wallet'}
            </button>
          ) : (
            <div className="bg-[#0f1923] p-4 rounded-lg border border-[#2c3b47] mb-4">
              <div className="flex items-center justify-between">
                <span className="text-[#8b9caa]">Connected Wallet</span>
                <span className="text-white font-mono text-sm">
                  {walletPublicKey?.slice(0, 4)}...{walletPublicKey?.slice(-4)}
                </span>
              </div>
            </div>
          )}

          <div className="text-[#8b9caa] mb-4">
            Exchange rate: 1 SOL = 10 Tokens
          </div>
          
          <div className="mb-4">
            <label className="block text-[#8b9caa] text-sm mb-2">
              Amount (SOL)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(Math.max(0, Number(e.target.value)));
                setError(null);
              }}
              className="w-full bg-[#0f1923] text-white p-4 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
              min="0.1"
              step="0.1"
              disabled={loading || !isWalletConnected}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-[#0f1923] p-4 rounded-lg border border-[#2c3b47]">
            <div className="flex justify-between mb-2">
              <span className="text-[#8b9caa]">You'll receive:</span>
              <span className="text-white font-bold">{amount * 10} Tokens</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8b9caa]">Network fee:</span>
              <span className="text-white">~0.000005 SOL</span>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handlePurchase}
            disabled={loading || !isWalletConnected || amount <= 0}
            className="flex-1 bg-[#00e701] hover:bg-[#00c701] text-[#0f1923] font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Buy Tokens'}
          </button>
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 bg-[#2c3b47] hover:bg-[#3d4e5c] text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}