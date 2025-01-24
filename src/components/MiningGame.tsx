import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Coins, Pickaxe, Gem } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { recordGameTransaction, updateTokenBalance } from '../lib/tokens';

interface MiningGameProps {
  onBack: () => void;
  tokenBalance: number;
  onBalanceChange: (newBalance: number) => void;
}

interface GameState {
  betAmount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  isMining: boolean;
  lastWin: number | null;
  energy: number;
  maxEnergy: number;
  energyRegenInterval: number;
}

interface RecentMine {
  amount: number;
  difficulty: string;
  timestamp: number;
}

const DIFFICULTY_SETTINGS = {
  easy: {
    minReward: 0.5,
    maxReward: 2,
    energyCost: 10,
    successRate: 0.8,
    color: '#00e701'
  },
  medium: {
    minReward: 1,
    maxReward: 4,
    energyCost: 20,
    successRate: 0.6,
    color: '#ffaa00'
  },
  hard: {
    minReward: 2,
    maxReward: 8,
    energyCost: 30,
    successRate: 0.4,
    color: '#ff4444'
  }
};

export default function MiningGame({ onBack, tokenBalance, onBalanceChange }: MiningGameProps) {
  const [recentMines, setRecentMines] = useState<RecentMine[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    betAmount: 20,
    difficulty: 'medium',
    isMining: false,
    lastWin: null,
    energy: 100,
    maxEnergy: 100,
    energyRegenInterval: 5000 // 5 seconds
  });

  const energyRegenTimerRef = useRef<number>();
  const miningAnimationRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Start energy regeneration
    energyRegenTimerRef.current = window.setInterval(() => {
      setGameState(prev => ({
        ...prev,
        energy: Math.min(prev.energy + 5, prev.maxEnergy)
      }));
    }, gameState.energyRegenInterval);

    return () => {
      if (energyRegenTimerRef.current) {
        clearInterval(energyRegenTimerRef.current);
      }
      if (miningAnimationRef.current) {
        cancelAnimationFrame(miningAnimationRef.current);
      }
    };
  }, []);

  const startMining = async () => {
    if (gameState.betAmount <= 0 || gameState.betAmount > tokenBalance) {
      return;
    }

    const difficultySettings = DIFFICULTY_SETTINGS[gameState.difficulty];
    if (gameState.energy < difficultySettings.energyCost) {
      toast.error('Not enough energy!');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to play');
        return;
      }

      // Record game spend
      await recordGameTransaction(user.id, 'mining', gameState.betAmount, false);

      // Update token balance
      const newBalance = Number((tokenBalance - gameState.betAmount).toFixed(2));
      onBalanceChange(newBalance);

      // Reduce energy
      setGameState(prev => ({
        ...prev,
        energy: prev.energy - difficultySettings.energyCost,
        isMining: true,
        lastWin: null
      }));

      // Simulate mining process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Calculate result
      const success = Math.random() < difficultySettings.successRate;
      if (success) {
        const reward = Number((
          gameState.betAmount * 
          (difficultySettings.minReward + 
            Math.random() * (difficultySettings.maxReward - difficultySettings.minReward))
        ).toFixed(2));

        const profit = Number((reward - gameState.betAmount).toFixed(2));
        
        // Update token balance with winnings
        const finalBalance = Number((tokenBalance + reward).toFixed(2));
        onBalanceChange(finalBalance);
        
        // Record win transaction
        await recordGameTransaction(user.id, 'mining', profit, true);
        
        // Update database balance
        await updateTokenBalance(user.id, finalBalance);
        
        setGameState(prev => ({
          ...prev,
          isMining: false,
          lastWin: profit
        }));

        setRecentMines(prev => [{
          amount: profit,
          difficulty: gameState.difficulty,
          timestamp: Date.now()
        }, ...prev.slice(0, 9)]);

        toast.success(`You found gems worth ${profit.toFixed(2)} tokens!`);
      } else {
        setGameState(prev => ({
          ...prev,
          isMining: false,
          lastWin: null
        }));

        setRecentMines(prev => [{
          amount: -gameState.betAmount,
          difficulty: gameState.difficulty,
          timestamp: Date.now()
        }, ...prev.slice(0, 9)]);

        toast.error(`Mining failed! Lost ${gameState.betAmount.toFixed(2)} tokens`);
      }
    } catch (error: any) {
      console.error('Error processing game:', error);
      toast.error('Failed to process game');
      setGameState(prev => ({ ...prev, isMining: false }));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-[#8b9caa] hover:text-white transition-colors"
          disabled={gameState.isMining}
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Games</span>
        </button>
      </div>

      <div className="bg-[#1b2733] rounded-lg overflow-hidden shadow-lg border border-[#2c3b47] p-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-[#8b9caa]" />
            <span className="text-[#8b9caa]">Your Tokens</span>
          </div>
          <span className="text-white font-bold text-xl">
            {tokenBalance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block text-[#8b9caa] text-sm mb-2">
                Bet Amount
              </label>
              <input
                type="number"
                value={gameState.betAmount}
                onChange={(e) => setGameState(prev => ({
                  ...prev,
                  betAmount: Math.max(0, Number(e.target.value))
                }))}
                className="w-full bg-[#0f1923] text-white p-4 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
                disabled={gameState.isMining}
              />
            </div>

            <div>
              <label className="block text-[#8b9caa] text-sm mb-2">
                Mining Difficulty
              </label>
              <select
                value={gameState.difficulty}
                onChange={(e) => setGameState(prev => ({
                  ...prev,
                  difficulty: e.target.value as GameState['difficulty']
                }))}
                className="w-full bg-[#0f1923] text-white p-4 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
                disabled={gameState.isMining}
              >
                <option value="easy">Easy (80% Success Rate)</option>
                <option value="medium">Medium (60% Success Rate)</option>
                <option value="hard">Hard (40% Success Rate)</option>
              </select>
            </div>

            <div className="bg-[#0f1923] p-4 rounded-lg border border-[#2c3b47]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[#8b9caa]">Success Rate:</span>
                <span className="text-white font-bold">
                  {DIFFICULTY_SETTINGS[gameState.difficulty].successRate * 100}%
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[#8b9caa]">Potential Reward:</span>
                <span className="text-white font-bold">
                  {DIFFICULTY_SETTINGS[gameState.difficulty].minReward}x - {DIFFICULTY_SETTINGS[gameState.difficulty].maxReward}x
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8b9caa]">Energy Cost:</span>
                <span className="text-white font-bold">
                  {DIFFICULTY_SETTINGS[gameState.difficulty].energyCost}
                </span>
              </div>
            </div>

            <button
              onClick={startMining}
              disabled={
                gameState.isMining || 
                gameState.betAmount <= 0 || 
                gameState.betAmount > tokenBalance ||
                gameState.energy < DIFFICULTY_SETTINGS[gameState.difficulty].energyCost
              }
              className="w-full bg-[#9333ea] hover:bg-[#7c28d4] text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {gameState.isMining ? (
                <>
                  <Pickaxe className="w-5 h-5 animate-bounce" />
                  Mining...
                </>
              ) : gameState.betAmount <= 0 ? (
                'Enter bet amount'
              ) : gameState.betAmount > tokenBalance ? (
                'Insufficient Tokens'
              ) : gameState.energy < DIFFICULTY_SETTINGS[gameState.difficulty].energyCost ? (
                'Not enough energy'
              ) : (
                <>
                  <Pickaxe className="w-5 h-5" />
                  Start Mining
                </>
              )}
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-[#0f1923] p-6 rounded-lg border border-[#2c3b47]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Gem className="w-5 h-5 text-[#9333ea]" />
                  <span className="text-[#8b9caa]">Mining Energy</span>
                </div>
                <span className="text-white font-bold">
                  {gameState.energy} / {gameState.maxEnergy}
                </span>
              </div>
              <div className="w-full h-4 bg-[#1b2733] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#9333ea] to-[#7c28d4] transition-all duration-300"
                  style={{ width: `${(gameState.energy / gameState.maxEnergy) * 100}%` }}
                />
              </div>
              <div className="mt-2 text-[#8b9caa] text-sm text-center">
                Energy regenerates over time
              </div>
            </div>

            {gameState.lastWin !== null && (
              <div className={`p-6 rounded-lg border ${
                gameState.lastWin > 0 
                  ? 'bg-[#00e701]/10 border-[#00e701]/20' 
                  : 'bg-[#ff4444]/10 border-[#ff4444]/20'
              }`}>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${
                    gameState.lastWin > 0 ? 'text-[#00e701]' : 'text-[#ff4444]'
                  }`}>
                    {gameState.lastWin > 0 ? '+' : ''}{gameState.lastWin.toFixed(2)} tokens
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#1b2733] p-6 rounded-lg border border-[#2c3b47]">
        <div className="text-lg font-semibold mb-4 text-white">Recent Mines</div>
        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
          {recentMines.map((mine, index) => (
            <div
              key={index}
              className={`flex justify-between items-center p-3 rounded-lg ${
                mine.amount >= 0
                  ? 'bg-[#00e701]/10 border border-[#00e701]/20'
                  : 'bg-[#ff4444]/10 border border-[#ff4444]/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <Pickaxe className={`w-4 h-4 ${
                  mine.amount >= 0 ? 'text-[#00e701]' : 'text-[#ff4444]'
                }`} />
                <span className="text-[#8b9caa] capitalize">{mine.difficulty}</span>
              </div>
              <div className={mine.amount >= 0 ? 'text-[#00e701]' : 'text-[#ff4444]'}>
                {mine.amount >= 0 ? '+' : ''}{mine.amount.toFixed(2)} tokens
              </div>
              <div className="text-[#8b9caa] text-sm">
                {new Date(mine.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}