import React from 'react';
import { Plane, Dice1 as Dice, CircleDotDashed, Car as Cards, Grid } from 'lucide-react';

interface GameSelectionProps {
  onSelectGame: (game: string) => void;
}

interface GameOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

export default function GameSelection({ onSelectGame }: GameSelectionProps) {
  const games: GameOption[] = [
    {
      id: 'crash',
      name: 'Aviator',
      description: 'Place your bet and cash out before the plane crashes!',
      icon: <Plane className="w-8 h-8 text-[#00e701 ]" />
    },
    {
      id: 'dice',
      name: 'Dice',
      description: 'Roll the dice and test your luck!',
      icon: <Dice className="w-8 h-8 text-[#ff4444]" />
    },
    {
      id: 'plinko',
      name: 'Plinko',
      description: 'Watch the ball bounce and win big!',
      icon: <CircleDotDashed className="w-8 h-8 text-[#4c82fb]" />
    },
    {
      id: 'blackjack',
      name: 'Blackjack',
      description: 'Classic card game against the dealer.',
      icon: <Cards className="w-8 h-8 text-[#ffaa00]" />
    },
    {
      id: 'mines',
      name: 'Mines',
      description: 'Avoid the mines and collect gems!',
      icon: <Grid className="w-8 h-8 text-[#00e701]" />
    }
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl font-bold">Popular Games</h2>
          <div className="flex gap-4">
            <button className="px-4 sm:px-6 py-2 rounded-lg bg-[#1b2733] text-[#8b9caa] hover:text-white transition-colors">
              All Games
            </button>
            <button className="px-4 sm:px-6 py-2 rounded-lg bg-[#1b2733] text-[#8b9caa] hover:text-white transition-colors">
              Favorites
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {games.map((game) => (
            <div
              key={game.id}
              className="relative bg-[#1b2733] rounded-lg border border-[#2c3b47] overflow-hidden transition-transform duration-200 hover:scale-[1.02] cursor-pointer group"
              onClick={() => onSelectGame(game.id)}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0f1923]/80 pointer-events-none" />
              
              <div className="relative p-4 sm:p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-[#0f1923] p-3 rounded-lg">
                    {game.icon}
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">{game.name}</h3>
                <p className="text-[#8b9caa] text-sm sm:text-base">{game.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-4">
          <div className="bg-[#1b2733] rounded-lg border border-[#2c3b47] p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold mb-4">Latest Winners</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#00e701]/20 flex items-center justify-center">
                    <Cards className="w-4 h-4 text-[#00e701]" />
                  </div>
                  <span className="text-[#8b9caa] text-sm sm:text-base">Blackjack</span>
                </div>
                <span className="text-[#00e701] font-medium text-sm sm:text-base">+$1,245.50</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#00e701]/20 flex items-center justify-center">
                    <Cards className="w-4 h-4 text-[#00e701]" />
                  </div>
                  <span className="text-[#8b9caa] text-sm sm:text-base">Blackjack</span>
                </div>
                <span className="text-[#00e701] font-medium text-sm sm:text-base">+$867.20</span>
              </div>
            </div>
          </div>

          <div className="bg-[#1b2733] rounded-lg border border-[#2c3b47] p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold mb-4">Top Players</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#ffaa00]/20 flex items-center justify-center text-[#ffaa00] font-bold">
                    1
                  </div>
                  <span className="text-[#8b9caa] text-sm sm:text-base">Player123</span>
                </div>
                <span className="text-white font-medium text-sm sm:text-base">$24,567.80</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#c0c0c0]/20 flex items-center justify-center text-[#c0c0c0] font-bold">
                    2
                  </div>
                  <span className="text-[#8b9caa] text-sm sm:text-base">Winner456</span>
                </div>
                <span className="text-white font-medium text-sm sm:text-base">$18,932.40</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}