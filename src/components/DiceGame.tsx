import React, { useState, useRef, useEffect } from 'react';
import { Wallet, ArrowLeft, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { recordGameTransaction, updateTokenBalance } from '../lib/tokens';

interface DiceGameProps {
  onBack: () => void;
  tokenBalance: number;
  onBalanceChange: (newBalance: number) => void;
}

interface GameState {
  betAmount: number;
  targetNumber: number;
  multiplier: number;
  isRolling: boolean;
  lastResult: number | null;
  lastWin: number | null;
}

interface RecentGame {
  result: number;
  target: number;
  amount: number;
  win: boolean;
  timestamp: number;
}

export default function DiceGame({ onBack, tokenBalance, onBalanceChange }: DiceGameProps) {
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    betAmount: 20,
    targetNumber: 50,
    multiplier: 2,
    isRolling: false,
    lastResult: null,
    lastWin: null
  });

  const sliderRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [showResult, setShowResult] = useState(false);
  const [resultNumber, setResultNumber] = useState<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !sliderRef.current || gameState.isRolling) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      const newTarget = Math.max(1, Math.min(98, percentage));
      
      setGameState(prev => ({
        ...prev,
        targetNumber: newTarget,
        multiplier: calculateMultiplier(newTarget)
      }));
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameState.isRolling]);

  const calculateMultiplier = (target: number) => {
    return parseFloat((99 / target).toFixed(4));
  };

  const calculateWinChance = (target: number) => {
    return parseFloat(target.toFixed(2));
  };

  const rollDice = async () => {
    if (gameState.betAmount <= 0 || gameState.betAmount > tokenBalance || gameState.isRolling) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to play');
        return;
      }

      // Record game spend
      await recordGameTransaction(user.id, 'dice', gameState.betAmount, false);

      // Update token balance
      onBalanceChange(tokenBalance - gameState.betAmount);

      setGameState(prev => ({
        ...prev,
        isRolling: true
      }));

      setShowResult(false);
      setResultNumber(null);

      // Simulate dice roll animation
      let rolls = 0;
      const maxRolls = 20;
      const rollInterval = setInterval(async () => {
        const tempResult = Math.random() * 100;
        setResultNumber(tempResult);

        rolls++;
        if (rolls >= maxRolls) {
          clearInterval(rollInterval);
          const finalResult = Math.random() * 100;
          const won = finalResult <= gameState.targetNumber;
          const winnings = won ? Number((gameState.betAmount * gameState.multiplier).toFixed(2)) : 0;

          setResultNumber(finalResult);
          setShowResult(true);

          if (won) {
            // Update token balance with winnings
            const newBalance = Number((tokenBalance + winnings).toFixed(2));
            onBalanceChange(newBalance);
            
            // Record win transaction
            await recordGameTransaction(user.id, 'dice', winnings - gameState.betAmount, true);
            
            // Update database balance
            await updateTokenBalance(user.id, newBalance);
            
            toast.success(`You won ${(winnings - gameState.betAmount).toFixed(2)} tokens!`);
          } else {
            toast.error(`You lost ${gameState.betAmount.toFixed(2)} tokens!`);
            
            // Update database balance
            await updateTokenBalance(user.id, tokenBalance - gameState.betAmount);
          }

          setGameState(prev => ({
            ...prev,
            isRolling: false,
            lastResult: finalResult,
            lastWin: won ? winnings - gameState.betAmount : null
          }));

          setRecentGames(prev => [{
            result: finalResult,
            target: gameState.targetNumber,
            amount: won ? winnings - gameState.betAmount : -gameState.betAmount,
            win: won,
            timestamp: Date.now()
          }, ...prev.slice(0, 9)]);
        }
      }, 50);
    } catch (error) {
      console.error('Error processing game:', error);
      toast.error('Failed to process game');
      setGameState(prev => ({ ...prev, isRolling: false }));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-[#8b9caa] hover:text-white transition-colors"
          disabled={gameState.isRolling}
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Games</span>
        </button>
      </div>

      <div className="bg-[#1b2733] rounded-lg overflow-hidden shadow-lg border border-[#2c3b47] p-8">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="flex justify-between items-center mb-4">
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

            <div className="mb-4">
              <label className="block text-[#8b9caa] text-sm mb-2">Bet Amount</label>
              <input
                type="number"
                value={gameState.betAmount}
                onChange={(e) => setGameState(prev => ({
                  ...prev,
                  betAmount: Math.max(0, Number(e.target.value))
                }))}
                className="w-full bg-[#0f1923] text-white p-4 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
                disabled={gameState.isRolling}
              />
            </div>

            <button
              onClick={rollDice}
              disabled={gameState.isRolling || gameState.betAmount <= 0 || gameState.betAmount > tokenBalance}
              className="w-full bg-[#ff4444] hover:bg-[#ff3333] text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {gameState.betAmount > tokenBalance 
                ? 'Insufficient Tokens' 
                : gameState.isRolling 
                  ? 'Rolling...' 
                  : `Bet ${gameState.betAmount.toFixed(2)} Tokens`}
            </button>
          </div>

          <div className="relative">
            <div 
              ref={sliderRef}
              className="relative w-full h-12 bg-[#0f1923] rounded-lg overflow-hidden mb-8 cursor-pointer"
              onMouseDown={(e) => {
                if (!gameState.isRolling) {
                  isDraggingRef.current = true;
                  const rect = sliderRef.current?.getBoundingClientRect();
                  if (rect) {
                    const x = e.clientX - rect.left;
                    const percentage = (x / rect.width) * 100;
                    const newTarget = Math.max(1, Math.min(98, percentage));
                    setGameState(prev => ({
                      ...prev,
                      targetNumber: newTarget,
                      multiplier: calculateMultiplier(newTarget)
                    }));
                  }
                }
              }}
            >
              {/* Progress bar */}
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#ff4444] via-[#ff8f00] to-[#00e701]"
                style={{ width: `${gameState.targetNumber}%` }}
              />
              
              {/* Slider handle */}
              <div 
                className="absolute top-0 bottom-0 w-1 bg-white"
                style={{ 
                  left: `${gameState.targetNumber}%`,
                  transform: 'translateX(-50%)',
                  boxShadow: '0 0 10px rgba(255, 255, 255, 0.5)'
                }}
              />

              {/* Numbers */}
              <div className="absolute inset-0 flex justify-between items-center px-4 pointer-events-none">
                <span className="text-sm font-medium text-white">0</span>
                <span className="text-sm font-medium text-white">25</span>
                <span className="text-sm font-medium text-white">50</span>
                <span className="text-sm font-medium text-white">75</span>
                <span className="text-sm font-medium text-white">100</span>
              </div>
            </div>

            {showResult && resultNumber !== null && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className={`text-6xl font-bold ${
                  resultNumber <= gameState.targetNumber ? 'text-[#00e701]' : 'text-[#ff4444]'
                }`}>
                  {resultNumber.toFixed(2)}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 mt-auto">
              <div className="bg-[#0f1923] p-4 rounded-lg">
                <div className="text-[#8b9caa] text-sm mb-1">Multiplier</div>
                <div className="text-white font-bold">{gameState.multiplier.toFixed(4)}x</div>
              </div>
              <div className="bg-[#0f1923] p-4 rounded-lg">
                <div className="text-[#8b9caa] text-sm mb-1">Roll Under</div>
                <div className="text-white font-bold">{gameState.targetNumber.toFixed(2)}</div>
              </div>
              <div className="bg-[#0f1923] p-4 rounded-lg">
                <div className="text-[#8b9caa] text-sm mb-1">Win Chance</div>
                <div className="text-white font-bold">{calculateWinChance(gameState.targetNumber)}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#1b2733] p-6 rounded-lg border border-[#2c3b47]">
        <div className="text-lg font-semibold mb-4 text-white">Recent Games</div>
        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
          {recentGames.map((game, index) => (
            <div
              key={index}
              className={`flex justify-between items-center p-3 rounded-lg ${
                game.win
                  ? 'bg-[#00e701]/10 border border-[#00e701]/20'
                  : 'bg-[#ff4444]/10 border border-[#ff4444]/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={game.win ? 'text-[#00e701]' : 'text-[#ff4444]'}>
                  {game.result.toFixed(2)}
                </span>
                <span className="text-[#8b9caa]">/ {game.target.toFixed(2)}</span>
              </div>
              <div className={game.win ? 'text-[#00e701]' : 'text-[#ff4444]'}>
                {game.win ? '+' : ''}{game.amount.toFixed(2)} tokens
              </div>
              <div className="text-[#8b9caa] text-sm">
                {new Date(game.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}