import React, { useEffect, useRef, useState } from 'react';
import { Wallet, ArrowLeft, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { recordGameTransaction, updateTokenBalance } from '../lib/tokens';

interface GameProps {
  onBack: () => void;
  tokenBalance: number;
  onBalanceChange: (newBalance: number) => void;
}

interface GameState {
  multiplier: number;
  isFlying: boolean;
  crashed: boolean;
  betAmount: number;
  hasBet: boolean;
  targetMultiplier: number;
  autoCashoutAt: number;
  lastWin: number | null;
  cashedOut: boolean;
  gamesPlayed: number;
  winsInSession: number;
}

interface RecentGame {
  multiplier: number;
  amount?: number;
  crashed: boolean;
  timestamp: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
}

// Constants for game mechanics
const HOUSE_EDGE = 0.99; // 1% house edge
const BASE_MULTIPLIER = 1.0024; // Base multiplier for exponential growth
const TICK_RATE = 50; // Update every 50ms
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;

// Calculate crash point using crypto-fair formula
const calculateCrashPoint = (): number => {
  const e = 2 ** 32;
  const h = Math.floor(Math.random() * e);
  if (h === 0) return 1.00;
  return Math.max(1.00, (100 * e - h) / (e - h)) * HOUSE_EDGE;
};

export default function Game({ onBack, tokenBalance, onBalanceChange }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const crashPointRef = useRef<number>(1);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    multiplier: 1,
    isFlying: false,
    crashed: false,
    betAmount: 20,
    hasBet: false,
    targetMultiplier: 2,
    autoCashoutAt: 0,
    lastWin: null,
    cashedOut: false,
    gamesPlayed: 0,
    winsInSession: 0
  });

  const drawPlane = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    
    // Draw plane body
    ctx.fillStyle = gameState.crashed ? '#ff4444' : '#00e701';
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.lineTo(10, -5);
    ctx.lineTo(-10, -5);
    ctx.closePath();
    ctx.fill();

    // Draw wings
    ctx.fillStyle = gameState.crashed ? '#ff3333' : '#00c701';
    ctx.beginPath();
    ctx.moveTo(-5, -2);
    ctx.lineTo(-15, -10);
    ctx.lineTo(0, -2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(5, -2);
    ctx.lineTo(15, -10);
    ctx.lineTo(0, -2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  const createParticle = (x: number, y: number): Particle => ({
    x,
    y,
    vx: (Math.random() - 0.5) * 2,
    vy: Math.random() * 2 + 2,
    alpha: 1
  });

  const updateParticles = () => {
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const particle = particlesRef.current[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.alpha -= 0.02;

      if (particle.alpha <= 0) {
        particlesRef.current.splice(i, 1);
      }
    }
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    for (const particle of particlesRef.current) {
      ctx.fillStyle = `rgba(255, 68, 68, ${particle.alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let planeX = 100;
    let planeY = canvas.height - 100;

    const animate = () => {
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background grid
      ctx.strokeStyle = '#2c3b47';
      ctx.lineWidth = 1;
      
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      // Draw flight path
      ctx.strokeStyle = '#2c3b47';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(100, canvas.height - 100);
      ctx.lineTo(canvas.width - 100, 100);
      ctx.stroke();
      ctx.setLineDash([]);

      if (gameState.isFlying) {
        // Update plane position based on multiplier
        const progress = Math.min((gameState.multiplier - 1) / (crashPointRef.current - 1), 1);
        planeX = 100 + progress * (canvas.width - 200);
        planeY = canvas.height - 100 - progress * (canvas.height - 200);

        // Add particles
        if (!gameState.crashed && Math.random() < 0.3) {
          particlesRef.current.push(createParticle(planeX - 10, planeY));
        }
      }

      if (gameState.crashed) {
        // Add explosion particles
        for (let i = 0; i < 5; i++) {
          particlesRef.current.push(createParticle(planeX, planeY));
        }
      }

      updateParticles();
      drawParticles(ctx);
      drawPlane(ctx, planeX, planeY);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState.isFlying, gameState.crashed, gameState.multiplier]);

  useEffect(() => {
    if (gameState.isFlying && !gameState.crashed) {
      const interval = setInterval(() => {
        setGameState(prev => {
          const newMultiplier = prev.multiplier * BASE_MULTIPLIER;
          
          // Check if we've hit the crash point
          if (newMultiplier >= crashPointRef.current) {
            clearInterval(interval);
            return { ...prev, crashed: true };
          }
          
          // Check for auto cashout
          if (prev.autoCashoutAt > 0 && newMultiplier >= prev.autoCashoutAt && !prev.cashedOut) {
            cashout();
          }
          
          return { ...prev, multiplier: newMultiplier };
        });
      }, TICK_RATE);

      return () => clearInterval(interval);
    }
  }, [gameState.isFlying, gameState.crashed]);

  const startGame = async () => {
    if (gameState.betAmount <= 0 || gameState.betAmount > tokenBalance || gameState.isFlying) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to play');
        return;
      }

      // Record game spend
      await recordGameTransaction(user.id, 'crash', gameState.betAmount, false);

      // Update token balance
      const newBalance = Number((tokenBalance - gameState.betAmount).toFixed(2));
      onBalanceChange(newBalance);

      // Calculate crash point for this round
      crashPointRef.current = calculateCrashPoint();
      
      setGameState(prev => ({
        ...prev,
        isFlying: true,
        crashed: false,
        hasBet: true,
        multiplier: 1,
        lastWin: null,
        cashedOut: false,
        gamesPlayed: prev.gamesPlayed + 1
      }));
    } catch (error) {
      console.error('Error starting game:', error);
      toast.error('Failed to start game');
      setGameState(prev => ({ ...prev, isFlying: false }));
    }
  };

  const cashout = async () => {
    if (!gameState.hasBet || gameState.crashed || gameState.cashedOut) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Calculate winnings with proper rounding
      const winnings = Number((gameState.betAmount * gameState.multiplier).toFixed(2));
      const profit = Number((winnings - gameState.betAmount).toFixed(2));
      
      // Update token balance
      const newBalance = Number((tokenBalance + winnings).toFixed(2));
      onBalanceChange(newBalance);
      
      // Record win transaction
      await recordGameTransaction(user.id, 'crash', profit, true);
      
      // Update database balance
      await updateTokenBalance(user.id, newBalance);
      
      setGameState(prev => ({
        ...prev,
        hasBet: false,
        lastWin: profit,
        cashedOut: true,
        winsInSession: prev.winsInSession + 1
      }));

      setRecentGames(prev => [{
        multiplier: gameState.multiplier,
        amount: profit,
        crashed: false,
        timestamp: Date.now()
      }, ...prev.slice(0, 9)]);

      toast.success(`You won ${profit.toFixed(2)} tokens!`);
    } catch (error) {
      console.error('Error processing cashout:', error);
      toast.error('Failed to process cashout');
    }
  };

  useEffect(() => {
    if (gameState.crashed && gameState.hasBet) {
      setRecentGames(prev => [{
        multiplier: gameState.multiplier,
        amount: -gameState.betAmount,
        crashed: true,
        timestamp: Date.now()
      }, ...prev.slice(0, 9)]);

      setGameState(prev => ({
        ...prev,
        hasBet: false,
        isFlying: false
      }));

      toast.error(`You lost ${gameState.betAmount.toFixed(2)} tokens!`);
    }
  }, [gameState.crashed]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-[#8b9caa] hover:text-white transition-colors"
          disabled={gameState.isFlying && gameState.hasBet}
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Games</span>
        </button>
      </div>

      <div className="bg-[#1b2733] rounded-lg overflow-hidden shadow-lg border border-[#2c3b47]">
        <div className="p-6 border-b border-[#2c3b47]">
          <div className="flex justify-between items-center">
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
        </div>

        <div className="relative">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full h-[400px]"
          />

          <div className="absolute top-4 left-8 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="text-6xl font-bold text-white bg-[#0f1923]/80 backdrop-blur-sm px-6 py-2 rounded-lg border border-[#2c3b47]">
                {gameState.multiplier.toFixed(2)}x
              </div>
            </div>
            {gameState.hasBet && (
              <div className="flex flex-col gap-2 bg-[#0f1923]/80 backdrop-blur-sm p-4 rounded-lg border border-[#2c3b47]">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#8b9caa]">Your Bet:</span>
                  <span className="text-white font-bold">{gameState.betAmount.toFixed(2)} tokens</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#8b9caa]">Potential Return:</span>
                  <span className="text-[#00e701] font-bold">
                    {(gameState.betAmount * gameState.multiplier).toFixed(2)} tokens
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {gameState.lastWin !== null && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="animate-bounce bg-[#00e701] text-[#0f1923] font-bold text-4xl px-8 py-4 rounded-lg shadow-lg">
                +{gameState.lastWin.toFixed(2)} tokens
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[#2c3b47]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#8b9caa] text-sm mb-2">Bet Amount</label>
              <input
                type="number"
                value={gameState.betAmount}
                onChange={(e) => setGameState(prev => ({
                  ...prev,
                  betAmount: Math.max(0, Number(e.target.value))
                }))}
                className="w-full bg-[#0f1923] text-white p-4 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
                disabled={gameState.isFlying}
              />
            </div>
            <div>
              <label className="block text-[#8b9caa] text-sm mb-2">Auto Cashout At</label>
              <input
                type="number"
                step="0.01"
                min="1.1"
                value={gameState.autoCashoutAt || ''}
                onChange={(e) => setGameState(prev => ({
                  ...prev,
                  autoCashoutAt: Math.max(0, Number(e.target.value))
                }))}
                placeholder="Disabled"
                className="w-full bg-[#0f1923] text-white p-4 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
                disabled={gameState.isFlying}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {!gameState.isFlying ? (
              <button
                onClick={startGame}
                disabled={gameState.betAmount <= 0 || gameState.betAmount > tokenBalance}
                className="w-full bg-[#00e701] hover:bg-[#00c701] text-[#0f1923] font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gameState.betAmount > tokenBalance 
                  ? 'Insufficient Tokens' 
                  : `Bet ${gameState.betAmount.toFixed(2)} Tokens`}
              </button>
            ) : (
              gameState.hasBet && (
                <button
                  onClick={cashout}
                  disabled={gameState.crashed || gameState.cashedOut}
                  className="w-full bg-[#ff4444] hover:bg-[#ff3333] text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50"
                >
                  Cash Out ({(gameState.betAmount * gameState.multiplier).toFixed(2)} tokens)
                </button>
              )
            )}
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
                game.crashed 
                  ? 'bg-[#ff4444]/10 border border-[#ff4444]/20' 
                  : 'bg-[#00e701]/10 border border-[#00e701]/20'
              }`}
            >
              <div className={game.crashed ? 'text-[#ff4444]' : 'text-[#00e701]'}>
                {game.multiplier.toFixed(2)}x
              </div>
              {game.amount && (
                <div className={game.crashed ? 'text-[#ff4444]' : 'text-[#00e701]'}>
                  {game.crashed ? '-' : '+'}
                  {Math.abs(game.amount).toFixed(2)} tokens
                </div>
              )}
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