import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { recordGameTransaction, updateTokenBalance } from '../lib/tokens';

interface PlinkoGameProps {
  onBack: () => void;
  tokenBalance: number;
  onBalanceChange: (newBalance: number) => void;
}

interface GameState {
  betAmount: number;
  risk: 'Low' | 'Medium' | 'High';
  rows: number;
  isDropping: boolean;
  lastWin: number | null;
}

interface Ball {
  x: number;
  y: number;
  velocity: { x: number; y: number };
  radius: number;
  active: boolean;
  path: number[];
  pathIndex: number;
}

interface RecentGame {
  multiplier: number;
  amount: number;
  timestamp: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PIN_RADIUS = 3;
const BALL_RADIUS = 5;
const PIN_SPACING = 35;
const GRAVITY = 0.25;
const BOUNCE_DAMPING = 0.6;
const HORIZONTAL_DAMPING = 0.8;

const MULTIPLIERS = {
  Low: [5.6, 2.3, 1.6, 1.4, 1.3, 1.1, 1.0, 0.5, 0.3, 0.5, 1.0, 1.1, 1.3, 1.4, 1.6, 2.3, 5.6],
  Medium: [11.2, 3.4, 2.1, 1.6, 1.3, 1.1, 0.9, 0.4, 0.2, 0.4, 0.9, 1.1, 1.3, 1.6, 2.1, 3.4, 11.2],
  High: [22.4, 4.5, 2.6, 1.8, 1.3, 1.0, 0.7, 0.3, 0.1, 0.3, 0.7, 1.0, 1.3, 1.8, 2.6, 4.5, 22.4]
};

const RISK_DISTRIBUTIONS = {
  Low: [
    { range: [0, 0.05], multiplier: 5.6 },
    { range: [0.05, 0.15], multiplier: 2.3 },
    { range: [0.15, 0.30], multiplier: 1.6 },
    { range: [0.30, 0.45], multiplier: 1.4 },
    { range: [0.45, 0.60], multiplier: 1.3 },
    { range: [0.60, 0.75], multiplier: 1.1 },
    { range: [0.75, 0.90], multiplier: 1.0 },
    { range: [0.90, 1], multiplier: 0.5 }
  ],
  Medium: [
    { range: [0, 0.03], multiplier: 11.2 },
    { range: [0.03, 0.10], multiplier: 3.4 },
    { range: [0.10, 0.25], multiplier: 2.1 },
    { range: [0.25, 0.40], multiplier: 1.6 },
    { range: [0.40, 0.60], multiplier: 1.3 },
    { range: [0.60, 0.80], multiplier: 1.1 },
    { range: [0.80, 0.95], multiplier: 0.9 },
    { range: [0.95, 1], multiplier: 0.4 }
  ],
  High: [
    { range: [0, 0.02], multiplier: 22.4 },
    { range: [0.02, 0.07], multiplier: 4.5 },
    { range: [0.07, 0.20], multiplier: 2.6 },
    { range: [0.20, 0.35], multiplier: 1.8 },
    { range: [0.35, 0.55], multiplier: 1.3 },
    { range: [0.55, 0.75], multiplier: 1.0 },
    { range: [0.75, 0.90], multiplier: 0.7 },
    { range: [0.90, 1], multiplier: 0.3 }
  ]
};

const determineFinalBucket = (risk: 'Low' | 'Medium' | 'High'): number => {
  const random = Math.random();
  const distribution = RISK_DISTRIBUTIONS[risk];
  
  for (const { range, multiplier } of distribution) {
    if (random >= range[0] && random < range[1]) {
      return MULTIPLIERS[risk].indexOf(multiplier);
    }
  }
  
  return Math.floor(MULTIPLIERS[risk].length / 2);
};

const calculatePathToTarget = (targetBucket: number, rows: number): number[] => {
  const path: number[] = [];
  const bucketWidth = CANVAS_WIDTH / MULTIPLIERS.Medium.length;
  const targetX = (targetBucket + 0.5) * bucketWidth;
  let currentX = CANVAS_WIDTH / 2;
  
  for (let row = 0; row < rows; row++) {
    const pinCount = row + 3;
    const startX = (CANVAS_WIDTH - (pinCount - 1) * PIN_SPACING) / 2;
    const progress = row / rows;
    const desiredX = currentX + (targetX - currentX) * progress;
    const pinIndex = Math.round((desiredX - startX) / PIN_SPACING);
    const pinX = startX + pinIndex * PIN_SPACING;
    path.push(pinX < desiredX ? 1 : 0);
    currentX = pinX;
  }
  
  return path;
};

export default function PlinkoGame({ onBack, tokenBalance, onBalanceChange }: PlinkoGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    betAmount: 20,
    risk: 'Medium',
    rows: 16,
    isDropping: false,
    lastWin: null
  });

  const [currentBall, setCurrentBall] = useState<Ball | null>(null);
  const animationFrameRef = useRef<number>();

  const drawBoard = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = '#1b2733';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < CANVAS_WIDTH; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_HEIGHT);
      ctx.stroke();
    }
    
    for (let i = 0; i < CANVAS_HEIGHT; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(CANVAS_WIDTH, i);
      ctx.stroke();
    }

    for (let row = 0; row < gameState.rows; row++) {
      const pinCount = row + 3;
      const startX = (CANVAS_WIDTH - (pinCount - 1) * PIN_SPACING) / 2;

      for (let pin = 0; pin < pinCount; pin++) {
        const x = startX + pin * PIN_SPACING;
        const y = 100 + row * PIN_SPACING;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, PIN_RADIUS * 2);
        gradient.addColorStop(0, '#4c82fb');
        gradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(x, y, PIN_RADIUS * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, PIN_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    }

    const multipliers = MULTIPLIERS[gameState.risk];
    const bucketWidth = CANVAS_WIDTH / multipliers.length;
    const bucketY = 100 + (gameState.rows) * PIN_SPACING;

    multipliers.forEach((multiplier, i) => {
      const x = i * bucketWidth;
      
      ctx.fillStyle = '#0f1923';
      ctx.fillRect(x, bucketY, bucketWidth, 50);
      
      ctx.strokeStyle = '#2c3b47';
      ctx.strokeRect(x, bucketY, bucketWidth, 50);
      
      ctx.fillStyle = getMultiplierColor(multiplier);
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(multiplier + 'x', x + bucketWidth / 2, bucketY + 30);
    });

    if (currentBall && currentBall.active) {
      const gradient = ctx.createRadialGradient(
        currentBall.x, currentBall.y, 0,
        currentBall.x, currentBall.y, BALL_RADIUS * 2
      );
      gradient.addColorStop(0, '#00e701');
      gradient.addColorStop(1, 'transparent');
      
      ctx.beginPath();
      ctx.arc(currentBall.x, currentBall.y, BALL_RADIUS * 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(currentBall.x, currentBall.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  };

  const getMultiplierColor = (multiplier: number): string => {
    if (multiplier >= 10) return '#ff4444';
    if (multiplier >= 3) return '#ff8800';
    if (multiplier >= 1) return '#00e701';
    return '#4c82fb';
  };

  const updateBall = async () => {
    if (!currentBall || !currentBall.active || !canvasRef.current) return;

    try {
      currentBall.velocity.y += GRAVITY;
      
      if (currentBall.pathIndex < currentBall.path.length) {
        const row = currentBall.pathIndex;
        const pinCount = row + 3;
        const startX = (CANVAS_WIDTH - (pinCount - 1) * PIN_SPACING) / 2;
        const pinY = 100 + row * PIN_SPACING;
        
        if (Math.abs(currentBall.y - pinY) < 5) {
          const direction = currentBall.path[currentBall.pathIndex];
          currentBall.velocity.x = (direction ? 1 : -1) * 2;
          currentBall.pathIndex++;
        }
      }
      
      currentBall.velocity.x += (Math.random() - 0.5) * 0.1;
      
      currentBall.x += currentBall.velocity.x;
      currentBall.y += currentBall.velocity.y;

      if (currentBall.x - currentBall.radius < 0) {
        currentBall.x = currentBall.radius;
        currentBall.velocity.x *= -BOUNCE_DAMPING;
      } else if (currentBall.x + currentBall.radius > CANVAS_WIDTH) {
        currentBall.x = CANVAS_WIDTH - currentBall.radius;
        currentBall.velocity.x *= -BOUNCE_DAMPING;
      }

      for (let row = 0; row < gameState.rows; row++) {
        const pinCount = row + 3;
        const startX = (CANVAS_WIDTH - (pinCount - 1) * PIN_SPACING) / 2;

        for (let pin = 0; pin < pinCount; pin++) {
          const pinX = startX + pin * PIN_SPACING;
          const pinY = 100 + row * PIN_SPACING;

          const dx = currentBall.x - pinX;
          const dy = currentBall.y - pinY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < currentBall.radius + PIN_RADIUS) {
            const angle = Math.atan2(dy, dx);
            const bounceAngle = angle + (Math.random() * 0.2 - 0.1);
            const speed = Math.sqrt(
              currentBall.velocity.x * currentBall.velocity.x +
              currentBall.velocity.y * currentBall.velocity.y
            );
            
            currentBall.velocity.x = Math.cos(bounceAngle) * speed * BOUNCE_DAMPING;
            currentBall.velocity.y = Math.abs(Math.sin(bounceAngle) * speed * BOUNCE_DAMPING);
            currentBall.x = pinX + (currentBall.radius + PIN_RADIUS + 1) * Math.cos(angle);
            currentBall.y = pinY + (currentBall.radius + PIN_RADIUS + 1) * Math.sin(angle);
          }
        }
      }

      const bucketY = 100 + (gameState.rows) * PIN_SPACING;
      if (currentBall.y >= bucketY) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            throw new Error('User not authenticated');
          }

          const multipliers = MULTIPLIERS[gameState.risk];
          const bucketWidth = CANVAS_WIDTH / multipliers.length;
          const bucketIndex = Math.floor(currentBall.x / bucketWidth);
          const multiplier = multipliers[Math.min(bucketIndex, multipliers.length - 1)];
          
          const winnings = Number((gameState.betAmount * multiplier).toFixed(2));
          const profit = Number((winnings - gameState.betAmount).toFixed(2));
          
          const newBalance = Number((tokenBalance + winnings).toFixed(2));
          await updateTokenBalance(user.id, newBalance);
          onBalanceChange(newBalance);
          
          if (profit > 0) {
            await recordGameTransaction(user.id, 'plinko', profit, true);
          }
          
          setGameState(prev => ({
            ...prev,
            isDropping: false,
            lastWin: profit
          }));

          setRecentGames(prev => [{
            multiplier,
            amount: profit,
            timestamp: Date.now()
          }, ...prev.slice(0, 9)]);

          if (profit > 0) {
            toast.success(`You won ${profit.toFixed(2)} tokens!`);
          } else {
            toast.error(`You lost ${gameState.betAmount.toFixed(2)} tokens!`);
          }

          setCurrentBall(null);
        } catch (error: any) {
          console.error('Error processing game result:', error.message || error);
          toast.error(error.message || 'Failed to process game result');
          setGameState(prev => ({ ...prev, isDropping: false }));
          setCurrentBall(null);
          
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('token_balance')
                .eq('id', user.id)
                .single();
                
              if (profile) {
                onBalanceChange(Number(profile.token_balance));
              }
            }
          } catch (balanceError) {
            console.error('Error restoring balance:', balanceError);
          }
        }
      }
    } catch (error: any) {
      console.error('Error updating ball:', error.message || error);
      toast.error('An error occurred during gameplay');
      setGameState(prev => ({ ...prev, isDropping: false }));
      setCurrentBall(null);
    }
  };

  const dropBall = async () => {
    if (gameState.betAmount <= 0) {
      toast.error('Please enter a valid bet amount');
      return;
    }

    if (gameState.betAmount > tokenBalance) {
      toast.error('Insufficient token balance');
      return;
    }

    if (gameState.isDropping) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to play');
        return;
      }

      try {
        await recordGameTransaction(user.id, 'plinko', gameState.betAmount, false);
      } catch (error: any) {
        console.error('Error recording transaction:', error.message || error);
        toast.error('Failed to process transaction');
        return;
      }

      try {
        const newBalance = Number((tokenBalance - gameState.betAmount).toFixed(2));
        await updateTokenBalance(user.id, newBalance);
        onBalanceChange(newBalance);
      } catch (error: any) {
        console.error('Error updating balance:', error.message || error);
        toast.error('Failed to update balance');
        return;
      }

      setGameState(prev => ({
        ...prev,
        isDropping: true,
        lastWin: null
      }));

      const targetBucket = determineFinalBucket(gameState.risk);
      const path = calculatePathToTarget(targetBucket, gameState.rows);

      const startX = CANVAS_WIDTH / 2 + (Math.random() * 10 - 5);
      const ball: Ball = {
        x: startX,
        y: 50,
        velocity: { x: 0, y: 0 },
        radius: BALL_RADIUS,
        active: true,
        path: path,
        pathIndex: 0
      };

      setCurrentBall(ball);
    } catch (error: any) {
      console.error('Error starting game:', error.message || error);
      toast.error(error.message || 'Failed to start game');
      setGameState(prev => ({ ...prev, isDropping: false }));
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('token_balance')
            .eq('id', user.id)
            .single();
            
          if (profile) {
            onBalanceChange(Number(profile.token_balance));
          }
        }
      } catch (balanceError) {
        console.error('Error restoring balance:', balanceError);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      if (currentBall && currentBall.active) {
        updateBall();
      }
      drawBoard(ctx);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentBall, gameState.rows, gameState.risk]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-[#8b9caa] hover:text-white transition-colors"
          disabled={gameState.isDropping}
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
            className="w-full"
          />

          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0f1923] to-transparent">
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={gameState.betAmount}
                onChange={(e) => setGameState(prev => ({
                  ...prev,
                  betAmount: Math.max(0, Number(e.target.value))
                }))}
                className="flex-1 bg-[#0f1923] text-white p-4 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
                disabled={gameState.isDropping}
              />

              <select
                value={gameState.risk}
                onChange={(e) => setGameState(prev => ({
                  ...prev,
                  risk: e.target.value as GameState['risk']
                }))}
                className="flex-1 bg-[#0f1923] text-white p-4 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
                disabled={gameState.isDropping}
              >
                <option value="Low">Low Risk</option>
                <option value="Medium">Medium Risk</option>
                <option value="High">High Risk</option>
              </select>

              <select
                value={gameState.rows}
                onChange={(e) => setGameState(prev => ({
                  ...prev,
                  rows: Number(e.target.value)
                }))}
                className="flex-1 bg-[#0f1923] text-white p-4 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
                disabled={gameState.isDropping}
              >
                <option value="8">8 Rows</option>
                <option value="12">12 Rows</option>
                <option value="16">16 Rows</option>
              </select>

              <button
                onClick={dropBall}
                disabled={gameState.isDropping || gameState.betAmount <= 0 || gameState.betAmount > tokenBalance}
                className="w-full bg-[#00e701] hover:bg-[#00c701] text-[#0f1923] font-bold py-4 px-8 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gameState.betAmount <= 0 
                  ? 'Enter bet amount'
                  : gameState.betAmount > tokenBalance 
                    ? 'Insufficient Tokens' 
                    : gameState.isDropping 
                      ? 'Dropping...' 
                      : `Bet ${gameState.betAmount.toFixed(2)} Tokens`}
              </button>
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
                game.amount >= 0
                  ? 'bg-[#00e701]/10 border border-[#00e701]/20'
                  : 'bg-[#ff4444]/10 border border-[#ff4444]/20'
              }`}
            >
              <div className={game.amount >= 0 ? 'text-[#00e701]' : 'text-[#ff4444]'}>
                {game.multiplier.toFixed(2)}x
              </div>
              <div className={game.amount >= 0 ? 'text-[#00e701]' : 'text-[#ff4444]'}>
                {game.amount >= 0 ? '+' : '-'}
                {Math.abs(game.amount).toFixed(2)} tokens
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