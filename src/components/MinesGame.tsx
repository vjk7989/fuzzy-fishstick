import React, { useState, useEffect } from 'react';
import { ArrowLeft, Coins, Bomb, Diamond, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { recordGameTransaction, updateTokenBalance } from '../lib/tokens';

interface MinesGameProps {
  onBack: () => void;
  tokenBalance: number;
  onBalanceChange: (newBalance: number) => void;
}

interface GameState {
  betAmount: number;
  mineCount: number;
  gemCount: number;
  grid: ('hidden' | 'revealed')[][];
  minePositions: Set<string>;
  gemPositions: Set<string>;
  isPlaying: boolean;
  revealedCount: number;
  currentMultiplier: number;
  lastWin: number | null;
  autoMode: boolean;
  autoStopAt: number;
}

interface RecentGame {
  amount: number;
  multiplier: number;
  mines: number;
  gems: number;
  timestamp: number;
}

const GRID_SIZE = 5;
const MIN_MINES = 1;
const MAX_MINES = 24;
const MIN_GEMS = 1;
const MAX_GEMS = 25;
const AUTO_REVEAL_THRESHOLD = 2; // Auto reveal all gems when mines <= this number

const calculateMultiplier = (revealed: number, mines: number, gems: number): number => {
  const probability = gems / (GRID_SIZE * GRID_SIZE - revealed);
  return Number((0.99 / probability).toFixed(2)); // 1% house edge
};

export default function MinesGame({ onBack, tokenBalance, onBalanceChange }: MinesGameProps) {
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    betAmount: 20,
    mineCount: 10,
    gemCount: 15,
    grid: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('hidden')),
    minePositions: new Set(),
    gemPositions: new Set(),
    isPlaying: false,
    revealedCount: 0,
    currentMultiplier: 1,
    lastWin: null,
    autoMode: false,
    autoStopAt: 2
  });

  // Effect to handle auto-reveal when mine count is low
  useEffect(() => {
    if (gameState.isPlaying && gameState.mineCount <= AUTO_REVEAL_THRESHOLD) {
      revealAllGems();
    }
  }, [gameState.isPlaying, gameState.mineCount]);

  const initializeGame = () => {
    const newGrid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('hidden'));
    const minePositions = new Set<string>();
    const gemPositions = new Set<string>();
    const totalCells = GRID_SIZE * GRID_SIZE;

    // Place mines first
    while (minePositions.size < gameState.mineCount) {
      const x = Math.floor(Math.random() * GRID_SIZE);
      const y = Math.floor(Math.random() * GRID_SIZE);
      const pos = `${x},${y}`;
      if (!minePositions.has(pos)) {
        minePositions.add(pos);
      }
    }

    // Place gems in remaining spaces
    let gemsToPlace = gameState.gemCount;
    while (gemsToPlace > 0 && gemPositions.size < gameState.gemCount) {
      const x = Math.floor(Math.random() * GRID_SIZE);
      const y = Math.floor(Math.random() * GRID_SIZE);
      const pos = `${x},${y}`;
      if (!minePositions.has(pos) && !gemPositions.has(pos)) {
        gemPositions.add(pos);
        gemsToPlace--;
      }
    }

    return { grid: newGrid, minePositions, gemPositions };
  };

  const revealAllGems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const newGrid = [...gameState.grid.map(row => [...row])];
      let revealedGems = 0;

      // Reveal all gems
      gameState.gemPositions.forEach(pos => {
        const [x, y] = pos.split(',').map(Number);
        if (newGrid[x][y] === 'hidden') {
          newGrid[x][y] = 'revealed';
          revealedGems++;
        }
      });

      const newMultiplier = calculateMultiplier(revealedGems, gameState.mineCount, gameState.gemCount);
      const winnings = Number((gameState.betAmount * newMultiplier).toFixed(2));
      const profit = Number((winnings - gameState.betAmount).toFixed(2));

      if (gameState.betAmount > 0) {
        // Update token balance
        const finalBalance = Number((tokenBalance + winnings).toFixed(2));
        onBalanceChange(finalBalance);
        
        // Record win transaction
        await recordGameTransaction(user.id, 'mines', profit, true);
        
        // Update database balance
        await updateTokenBalance(user.id, finalBalance);
      }

      // Reveal mines too since game is over
      gameState.minePositions.forEach(pos => {
        const [x, y] = pos.split(',').map(Number);
        newGrid[x][y] = 'revealed';
      });

      setGameState(prev => ({
        ...prev,
        grid: newGrid,
        isPlaying: false,
        revealedCount: revealedGems,
        currentMultiplier: newMultiplier,
        lastWin: profit
      }));

      setRecentGames(prev => [{
        amount: profit,
        multiplier: newMultiplier,
        mines: gameState.mineCount,
        gems: gameState.gemCount,
        timestamp: Date.now()
      }, ...prev.slice(0, 9)]);

      if (gameState.betAmount > 0) {
        toast.success(`Auto-revealed all gems! Won ${profit.toFixed(2)} tokens`);
      } else {
        toast.success(`Auto-revealed all gems! (Practice mode)`);
      }
    } catch (error: any) {
      console.error('Error revealing gems:', error);
      toast.error('Failed to reveal gems');
    }
  };

  const startGame = async () => {
    if (gameState.betAmount < 0 || gameState.betAmount > tokenBalance) {
      return;
    }

    // Validate mine and gem counts
    const totalCells = GRID_SIZE * GRID_SIZE;
    if (gameState.mineCount + gameState.gemCount > totalCells) {
      toast.error('Total mines and gems cannot exceed grid size');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to play');
        return;
      }

      // Only record transaction and update balance if bet amount > 0
      if (gameState.betAmount > 0) {
        // Record game spend
        await recordGameTransaction(user.id, 'mines', gameState.betAmount, false);

        // Update token balance
        const newBalance = Number((tokenBalance - gameState.betAmount).toFixed(2));
        onBalanceChange(newBalance);
      }

      const { grid, minePositions, gemPositions } = initializeGame();
      setGameState(prev => ({
        ...prev,
        grid,
        minePositions,
        gemPositions,
        isPlaying: true,
        revealedCount: 0,
        currentMultiplier: 1,
        lastWin: null
      }));

      // Auto-reveal will be handled by the useEffect
    } catch (error: any) {
      console.error('Error starting game:', error);
      toast.error('Failed to start game');
    }
  };

  const revealTile = async (row: number, col: number) => {
    if (!gameState.isPlaying || gameState.grid[row][col] !== 'hidden') {
      return;
    }

    const pos = `${row},${col}`;
    const isMine = gameState.minePositions.has(pos);
    const isGem = gameState.gemPositions.has(pos);
    const newGrid = [...gameState.grid.map(row => [...row])];
    newGrid[row][col] = 'revealed';
    
    if (isMine) {
      // Game over - reveal all mines and gems
      gameState.minePositions.forEach(pos => {
        const [x, y] = pos.split(',').map(Number);
        newGrid[x][y] = 'revealed';
      });
      gameState.gemPositions.forEach(pos => {
        const [x, y] = pos.split(',').map(Number);
        newGrid[x][y] = 'revealed';
      });

      setGameState(prev => ({
        ...prev,
        grid: newGrid,
        isPlaying: false,
        lastWin: null
      }));

      setRecentGames(prev => [{
        amount: -gameState.betAmount,
        multiplier: 0,
        mines: gameState.mineCount,
        gems: gameState.gemCount,
        timestamp: Date.now()
      }, ...prev.slice(0, 9)]);

      if (gameState.betAmount > 0) {
        toast.error(`You hit a mine! Lost ${gameState.betAmount.toFixed(2)} tokens`);
      } else {
        toast.error('You hit a mine! Game over');
      }
      return;
    }

    if (!isGem) {
      // Hit empty space, continue game
      setGameState(prev => ({
        ...prev,
        grid: newGrid
      }));
      return;
    }

    const newRevealedCount = gameState.revealedCount + 1;
    const newMultiplier = calculateMultiplier(newRevealedCount, gameState.mineCount, gameState.gemCount);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (gameState.autoMode && newMultiplier >= gameState.autoStopAt) {
        // Auto cashout
        const winnings = Number((gameState.betAmount * newMultiplier).toFixed(2));
        const profit = Number((winnings - gameState.betAmount).toFixed(2));
        
        if (gameState.betAmount > 0) {
          // Update token balance
          const finalBalance = Number((tokenBalance + winnings).toFixed(2));
          onBalanceChange(finalBalance);
          
          // Record win transaction
          await recordGameTransaction(user.id, 'mines', profit, true);
          
          // Update database balance
          await updateTokenBalance(user.id, finalBalance);
        }

        setGameState(prev => ({
          ...prev,
          grid: newGrid,
          isPlaying: false,
          revealedCount: newRevealedCount,
          currentMultiplier: newMultiplier,
          lastWin: profit
        }));

        setRecentGames(prev => [{
          amount: profit,
          multiplier: newMultiplier,
          mines: gameState.mineCount,
          gems: gameState.gemCount,
          timestamp: Date.now()
        }, ...prev.slice(0, 9)]);

        if (gameState.betAmount > 0) {
          toast.success(`Auto cashout at ${newMultiplier}x! Won ${profit.toFixed(2)} tokens`);
        } else {
          toast.success(`Auto cashout at ${newMultiplier}x! (Practice mode)`);
        }
        return;
      }

      setGameState(prev => ({
        ...prev,
        grid: newGrid,
        revealedCount: newRevealedCount,
        currentMultiplier: newMultiplier
      }));
    } catch (error: any) {
      console.error('Error processing move:', error);
      toast.error('Failed to process move');
    }
  };

  const cashout = async () => {
    if (!gameState.isPlaying || gameState.revealedCount === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const winnings = Number((gameState.betAmount * gameState.currentMultiplier).toFixed(2));
      const profit = Number((winnings - gameState.betAmount).toFixed(2));
      
      // Only process transaction if there was an actual bet
      if (gameState.betAmount > 0) {
        // Update token balance
        const finalBalance = Number((tokenBalance + winnings).toFixed(2));
        onBalanceChange(finalBalance);
        
        // Record win transaction
        await recordGameTransaction(user.id, 'mines', profit, true);
        
        // Update database balance
        await updateTokenBalance(user.id, finalBalance);
      }

      // Reveal all tiles
      const newGrid = [...gameState.grid.map(row => [...row])];
      gameState.minePositions.forEach(pos => {
        const [x, y] = pos.split(',').map(Number);
        newGrid[x][y] = 'revealed';
      });
      gameState.gemPositions.forEach(pos => {
        const [x, y] = pos.split(',').map(Number);
        newGrid[x][y] = 'revealed';
      });

      setGameState(prev => ({
        ...prev,
        grid: newGrid,
        isPlaying: false,
        lastWin: profit
      }));

      setRecentGames(prev => [{
        amount: profit,
        multiplier: gameState.currentMultiplier,
        mines: gameState.mineCount,
        gems: gameState.gemCount,
        timestamp: Date.now()
      }, ...prev.slice(0, 9)]);

      if (gameState.betAmount > 0) {
        toast.success(`Cashed out at ${gameState.currentMultiplier}x! Won ${profit.toFixed(2)} tokens`);
      } else {
        toast.success(`Cashed out at ${gameState.currentMultiplier}x! (Practice mode)`);
      }
    } catch (error: any) {
      console.error('Error processing cashout:', error);
      toast.error('Failed to process cashout');
    }
  };

  const isMine = (row: number, col: number) => {
    return gameState.minePositions.has(`${row},${col}`);
  };

  const isGem = (row: number, col: number) => {
    return gameState.gemPositions.has(`${row},${col}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-[#8b9caa] hover:text-white transition-colors"
          disabled={gameState.isPlaying}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="grid grid-cols-5 gap-2 mb-6">
              {gameState.grid.map((row, rowIndex) => (
                row.map((cell, colIndex) => (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() => revealTile(rowIndex, colIndex)}
                    disabled={!gameState.isPlaying || cell !== 'hidden'}
                    className={`aspect-square rounded-lg flex items-center justify-center transition-all duration-200 ${
                      cell === 'hidden'
                        ? 'bg-[#0f1923] hover:bg-[#2c3b47] border border-[#2c3b47]'
                        : isMine(rowIndex, colIndex)
                          ? 'bg-[#ff4444] border-[#ff4444]'
                          : isGem(rowIndex, colIndex)
                            ? 'bg-[#00e701] border-[#00e701]'
                            : 'bg-[#2c3b47] border-[#2c3b47]'
                    }`}
                  >
                    {cell === 'revealed' && (
                      isMine(rowIndex, colIndex) ? (
                        <Bomb className="w-6 h-6 text-white" />
                      ) : isGem(rowIndex, colIndex) ? (
                        <Diamond className="w-6 h-6 text-white" />
                      ) : null
                    )}
                  </button>
                ))
              ))}
            </div>

            {gameState.isPlaying && (
              <div className="flex justify-between items-center p-4 bg-[#0f1923] rounded-lg border border-[#2c3b47] mb-6">
                <div className="text-[#8b9caa]">Current Multiplier</div>
                <div className="text-white font-bold text-xl">
                  {gameState.currentMultiplier.toFixed(2)}x
                </div>
              </div>
            )}

            {gameState.lastWin !== null && (
              <div className={`p-4 rounded-lg border ${
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
                disabled={gameState.isPlaying}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[#8b9caa] text-sm mb-2">
                  Number of Mines
                </label>
                <select
                  value={gameState.mineCount}
                  onChange={(e) => {
                    const mines = Number(e.target.value);
                    const maxGems = GRID_SIZE * GRID_SIZE - mines;
                    setGameState(prev => ({
                      ...prev,
                      mineCount: mines,
                      gemCount: Math.min(prev.gemCount, maxGems)
                    }));
                  }}
                  className="w-full bg-[#0f1923] text-white p-4 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
                  disabled={gameState.isPlaying}
                >
                  {Array.from({ length: MAX_MINES - MIN_MINES + 1 }, (_, i) => i + MIN_MINES).map(num => (
                    <option key={num} value={num}>{num} {num === 1 ? 'Mine' : 'Mines'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#8b9caa] text-sm mb-2">
                  Number of Gems
                </label>
                <select
                  value={gameState.gemCount}
                  onChange={(e) => setGameState(prev => ({
                    ...prev,
                    gemCount: Number(e.target.value)
                  }))}
                  className="w-full bg-[#0f1923] text-white p-4 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
                  disabled={gameState.isPlaying}
                >
                  {Array.from(
                    { length: Math.min(MAX_GEMS, GRID_SIZE * GRID_SIZE - gameState.mineCount) - MIN_GEMS + 1 },
                    (_, i) => i + MIN_GEMS
                  ).map(num => (
                    <option key={num} value={num}>{num} {num === 1 ? 'Gem' : 'Gems'}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-[#0f1923] rounded-lg border border-[#2c3b47]">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-[#8b9caa]" />
                <span className="text-[#8b9caa]">Auto Mode</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-auto">
                <input
                  type="checkbox"
                  checked={gameState.autoMode}
                  onChange={(e) => setGameState(prev => ({
                    ...prev,
                    autoMode: e.target.checked
                  }))}
                  className="sr-only peer"
                  disabled={gameState.isPlaying}
                />
                <div className="w-11 h-6 bg-[#2c3b47] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00e701]"></div>
              </label>
            </div>

            {gameState.autoMode && (
              <div>
                <label className="block text-[#8b9caa] text-sm mb-2">
                  Auto Stop at Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.1"
                  value={gameState.autoStopAt}
                  onChange={(e) => setGameState(prev => ({
                    ...prev,
                    autoStopAt: Math.max(1.1, Number(e.target.value))
                  }))}
                  className="w-full bg-[#0f1923] text-white p-4 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
                  disabled={gameState.isPlaying}
                />
              </div>
            )}

            {!gameState.isPlaying ? (
              <button
                onClick={startGame}
                disabled={
                  gameState.betAmount < 0 || 
                  gameState.betAmount > tokenBalance ||
                  gameState.mineCount + gameState.gemCount > GRID_SIZE * GRID_SIZE
                }
                className="w-full bg-[#00e701] hover:bg-[#00c701] text-[#0f1923] font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gameState.betAmount < 0 
                  ? 'Invalid bet amount'
                  : gameState.betAmount > tokenBalance 
                    ? 'Insufficient Tokens'
                    : gameState.mineCount + gameState.gemCount > GRID_SIZE * GRID_SIZE
                      ? 'Too many mines and gems'
                      : gameState.betAmount === 0
                        ? 'Start Practice Game'
                        : `Bet ${gameState.betAmount.toFixed(2)} Tokens`}
              </button>
            ) : (
              <button
                onClick={cashout}
                disabled={gameState.revealedCount === 0}
                className="w-full bg-[#ff4444] hover:bg-[#ff3333] text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50"
              >
                Cashout ({(gameState.betAmount * gameState.currentMultiplier).toFixed(2)} tokens)
              </button>
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
                game.amount >= 0
                  ? 'bg-[#00e701]/10 border border-[#00e701]/20'
                  : 'bg-[#ff4444]/10 border border-[#ff4444]/20'
              }`}
            >
              <div className="flex items-center gap-2">
                {game.amount >= 0 ? (
                  <Diamond className="w-4 h-4 text-[#00e701]" />
                ) : (
                  <Bomb className="w-4 h-4 text-[#ff4444]" />
                )}
                <span className="text-[#8b9caa]">
                  {game.mines} mines, {game.gems} gems
                </span>
              </div>
              <div className={game.amount >= 0 ? 'text-[#00e701]' : 'text-[#ff4444]'}>
                {game.amount >= 0 ? '+' : ''}{game.amount.toFixed(2)} tokens
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