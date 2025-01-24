import React, { useState } from 'react';
import Game from './components/Game';
import DiceGame from './components/DiceGame';
import PlinkoGame from './components/PlinkoGame';
import BlackjackGame from './components/BlackjackGame';
import MinesGame from './components/MinesGame';
import GameSelection from './components/GameSelection';
import LoginForm from './components/Auth/LoginForm';
import SignupForm from './components/Auth/SignupForm';
import TokenPurchaseModal from './components/TokenPurchaseModal';
import TokenBalance from './components/TokenBalance';
import { AuthProvider, useAuth } from './components/Auth/AuthContext';
import { Search, Bell, LogOut, Wallet as WalletIcon, X, ShieldCheck, Plus } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

function AppContent() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(true);
  const [showWallet, setShowWallet] = useState(false);
  const [showTokenPurchase, setShowTokenPurchase] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const { user, signOut, loading } = useAuth();

  const handleTokenPurchase = (amount: number) => {
    setTokenBalance(prev => prev + amount);
    setShowTokenPurchase(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1923] text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f1923] text-white flex items-center justify-center p-4">
        {showLogin ? (
          <LoginForm onToggleForm={() => setShowLogin(false)} />
        ) : (
          <SignupForm onToggleForm={() => setShowLogin(true)} />
        )}
      </div>
    );
  }

  const getGameComponent = () => {
    switch (selectedGame) {
      case 'crash':
        return <Game onBack={() => setSelectedGame(null)} tokenBalance={tokenBalance} onBalanceChange={setTokenBalance} />;
      case 'dice':
        return <DiceGame onBack={() => setSelectedGame(null)} tokenBalance={tokenBalance} onBalanceChange={setTokenBalance} />;
      case 'plinko':
        return <PlinkoGame onBack={() => setSelectedGame(null)} tokenBalance={tokenBalance} onBalanceChange={setTokenBalance} />;
      case 'blackjack':
        return <BlackjackGame onBack={() => setSelectedGame(null)} tokenBalance={tokenBalance} onBalanceChange={setTokenBalance} />;
      case 'mines':
        return <MinesGame onBack={() => setSelectedGame(null)} tokenBalance={tokenBalance} onBalanceChange={setTokenBalance} />;
      default:
        return <GameSelection onSelectGame={setSelectedGame} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1923] text-white">
      <header className="bg-[#1b2733] border-b border-[#2c3b47]">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4 sm:gap-8">
              <div className="text-xl sm:text-2xl font-bold truncate">
                {selectedGame ? (
                  selectedGame === 'crash' ? 'Aviator' :
                  selectedGame === 'dice' ? 'Dice' :
                  selectedGame === 'plinko' ? 'Plinko' :
                  selectedGame === 'blackjack' ? 'Blackjack' :
                  selectedGame === 'mines' ? 'Mines' : 'Casino'
                ) : 'Casino'}
              </div>
              <div className="hidden sm:flex items-center gap-8">
                <button className="text-white font-medium hover:text-[#00e701] transition-colors">
                  Casino
                </button>
                <button className="text-[#8b9caa] font-medium hover:text-white transition-colors">
                  Sports
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <TokenBalance onBalanceChange={setTokenBalance} />
              <button className="p-2 text-[#8b9caa] hover:text-white transition-colors">
                <Search className="w-5 h-5" />
              </button>
              <button className="p-2 text-[#8b9caa] hover:text-white transition-colors">
                <Bell className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowTokenPurchase(true)}
                className="bg-[#00e701] hover:bg-[#00c701] text-[#0f1923] px-3 sm:px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Funds</span>
              </button>
              <button 
                onClick={() => setShowWallet(true)}
                className="bg-[#1b2733] hover:bg-[#2c3b47] text-white px-3 sm:px-4 py-2 rounded-lg transition-colors border border-[#2c3b47]"
              >
                <span className="hidden sm:inline">Wallet</span>
                <WalletIcon className="w-5 h-5 sm:hidden" />
              </button>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 text-[#8b9caa] hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-6">
        {getGameComponent()}
      </main>

      {/* Wallet Modal */}
      {showWallet && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1b2733] rounded-lg border border-[#2c3b47] w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#2c3b47]">
              <div className="flex items-center gap-2">
                <WalletIcon className="w-5 h-5" />
                <span className="text-lg font-bold">Wallet</span>
              </div>
              <button 
                onClick={() => setShowWallet(false)}
                className="text-[#8b9caa] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 sm:p-8">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
                  <WalletIcon className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-center">Your Stake wallet is currently empty.</h3>
                <p className="text-[#8b9caa] text-center text-sm sm:text-base max-w-md">
                  Make a deposit via crypto or local currency if it's available in your region.
                  Alternatively, you can buy crypto via Moonpay.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full sm:w-auto">
                  <button 
                    onClick={() => {
                      setShowWallet(false);
                      setShowTokenPurchase(true);
                    }}
                    className="w-full sm:w-auto bg-[#4c82fb] hover:bg-[#3b71ea] text-white font-bold py-3 px-8 rounded-lg transition-colors"
                  >
                    Add Funds
                  </button>
                  <button className="w-full sm:w-auto bg-[#2c3b47] hover:bg-[#3d4e5c] text-white font-bold py-3 px-8 rounded-lg transition-colors">
                    Buy Crypto
                  </button>
                </div>

                <div className="w-full mt-8">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-[#0f1923] rounded-lg gap-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-[#8b9caa]" />
                      <span className="text-[#8b9caa] text-sm">Improve your account security with Two-Factor Authentication</span>
                    </div>
                    <button className="text-[#4c82fb] hover:text-[#3b71ea] font-medium transition-colors whitespace-nowrap">
                      Enable 2FA
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Token Purchase Modal */}
      {showTokenPurchase && (
        <TokenPurchaseModal
          onClose={() => setShowTokenPurchase(false)}
          onSuccess={handleTokenPurchase}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster position="top-right" />
    </AuthProvider>
  );
}