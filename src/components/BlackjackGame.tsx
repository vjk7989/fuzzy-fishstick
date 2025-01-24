import React, { useState, useEffect } from 'react';
import { ArrowLeft, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { recordGameTransaction, updateTokenBalance } from '../lib/tokens';

interface BlackjackGameProps {
  onBack: () => void;
  tokenBalance: number;
  onBalanceChange: (newBalance: number) => void;
}

interface Card {
  suit: string;
  value: string;
  numericValue: number;
}

interface GameState {
  playerHand: Card[];
  dealerHand: Card[];
  deck: Card[];
  betAmount: number;
  gamePhase: 'betting' | 'playing' | 'dealerTurn' | 'complete';
  playerScore: number;
  dealerScore: number;
  lastWin: number | null;
}

interface RecentGame {
  playerScore: number;
  dealerScore: number;
  amount: number;
  win: boolean;
  timestamp: number;
}

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({
        suit,
        value,
        numericValue: value === 'A' ? 11 : ['K', 'Q', 'J'].includes(value) ? 10 : parseInt(value)
      });
    }
  }
  return shuffle(deck);
};

const shuffle = (deck: Card[]): Card[] => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const calculateScore = (hand: Card[]): number => {
  let score = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.value === 'A') {
      aces++;
    }
    score += card.numericValue;
  }

  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }

  return score;
};

export default function BlackjackGame({ onBack, tokenBalance, onBalanceChange }: BlackjackGameProps) {
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    playerHand: [],
    dealerHand: [],
    deck: createDeck(),
    betAmount: 20,
    gamePhase: 'betting',
    playerScore: 0,
    dealerScore: 0,
    lastWin: null
  });

  const dealCard = (deck: Card[]): [Card, Card[]] => {
    const newDeck = [...deck];
    const card = newDeck.pop();
    if (!card) throw new Error('Deck is empty');
    return [card, newDeck];
  };

  const startGame = async () => {
    if (gameState.betAmount <= 0 || gameState.betAmount > tokenBalance) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to play');
        return;
      }

      // Record game spend
      await recordGameTransaction(user.id, 'blackjack', gameState.betAmount, false);

      // Update token balance
      const newBalance = Number((tokenBalance - gameState.betAmount).toFixed(2));
      onBalanceChange(newBalance);

      let deck = [...gameState.deck];
      let playerHand: Card[] = [];
      let dealerHand: Card[] = [];

      // Deal initial cards
      let card: Card;
      [card, deck] = dealCard(deck);
      playerHand.push(card);
      [card, deck] = dealCard(deck);
      dealerHand.push(card);
      [card, deck] = dealCard(deck);
      playerHand.push(card);
      [card, deck] = dealCard(deck);
      dealerHand.push(card);

      const playerScore = calculateScore(playerHand);
      const dealerScore = calculateScore(dealerHand);

      setGameState(prev => ({
        ...prev,
        playerHand,
        dealerHand,
        deck,
        gamePhase: 'playing',
        playerScore,
        dealerScore,
        lastWin: null
      }));

      // Check for natural blackjack
      if (playerScore === 21) {
        handleDealerTurn();
      }
    } catch (error) {
      console.error('Error starting game:', error);
      toast.error('Failed to start game');
    }
  };

  const hit = () => {
    if (gameState.gamePhase !== 'playing') return;

    const [card, newDeck] = dealCard(gameState.deck);
    const newHand = [...gameState.playerHand, card];
    const newScore = calculateScore(newHand);

    setGameState(prev => ({
      ...prev,
      playerHand: newHand,
      deck: newDeck,
      playerScore: newScore,
      gamePhase: newScore > 21 ? 'complete' : 'playing'
    }));

    if (newScore > 21) {
      handleGameEnd(false);
    }
  };

  const stand = () => {
    if (gameState.gamePhase !== 'playing') return;
    handleDealerTurn();
  };

  const handleDealerTurn = async () => {
    let currentDealerHand = [...gameState.dealerHand];
    let currentDeck = [...gameState.deck];
    let dealerScore = calculateScore(currentDealerHand);

    while (dealerScore < 17) {
      const [card, newDeck] = dealCard(currentDeck);
      currentDealerHand.push(card);
      currentDeck = newDeck;
      dealerScore = calculateScore(currentDealerHand);
    }

    setGameState(prev => ({
      ...prev,
      dealerHand: currentDealerHand,
      deck: currentDeck,
      dealerScore,
      gamePhase: 'complete'
    }));

    const playerScore = calculateScore(gameState.playerHand);
    const playerBusted = playerScore > 21;
    const dealerBusted = dealerScore > 21;
    const playerBlackjack = playerScore === 21 && gameState.playerHand.length === 2;
    const dealerBlackjack = dealerScore === 21 && currentDealerHand.length === 2;

    let playerWins = false;

    if (playerBusted) {
      playerWins = false;
    } else if (dealerBusted) {
      playerWins = true;
    } else if (playerBlackjack && !dealerBlackjack) {
      playerWins = true;
    } else if (!playerBlackjack && dealerBlackjack) {
      playerWins = false;
    } else {
      playerWins = playerScore > dealerScore;
    }

    handleGameEnd(playerWins, playerBlackjack);
  };

  const handleGameEnd = async (playerWins: boolean, isBlackjack: boolean = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      let winnings = 0;
      if (playerWins) {
        // Blackjack pays 3:2
        winnings = isBlackjack 
          ? Number((gameState.betAmount * 2.5).toFixed(2))
          : Number((gameState.betAmount * 2).toFixed(2));
        
        const profit = Number((winnings - gameState.betAmount).toFixed(2));
        
        // Update token balance
        const newBalance = Number((tokenBalance + winnings).toFixed(2));
        onBalanceChange(newBalance);
        
        // Record win transaction
        await recordGameTransaction(user.id, 'blackjack', profit, true);
        
        // Update database balance
        await updateTokenBalance(user.id, newBalance);
        
        toast.success(`You won ${profit.toFixed(2)} tokens!`);
      } else {
        toast.error(`You lost ${gameState.betAmount.toFixed(2)} tokens!`);
      }

      setGameState(prev => ({
        ...prev,
        lastWin: playerWins ? winnings - gameState.betAmount : null
      }));

      setRecentGames(prev => [{
        playerScore: gameState.playerScore,
        dealerScore: gameState.dealerScore,
        amount: playerWins ? winnings - gameState.betAmount : -gameState.betAmount,
        win: playerWins,
        timestamp: Date.now()
      }, ...prev.slice(0, 9)]);
    } catch (error) {
      console.error('Error processing game end:', error);
      toast.error('Failed to process game result');
    }
  };

  const resetGame = () => {
    setGameState(prev => ({
      ...prev,
      playerHand: [],
      dealerHand: [],
      deck: createDeck(),
      gamePhase: 'betting',
      playerScore: 0,
      dealerScore: 0,
      lastWin: null
    }));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-[#8b9caa] hover:text-white transition-colors"
          disabled={gameState.gamePhase === 'playing'}
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

        <div className="space-y-8">
          {/* Dealer's Hand */}
          <div className="text-center">
            <div className="text-[#8b9caa] mb-2">Dealer's Hand</div>
            <div className="flex justify-center gap-4 mb-2">
              {gameState.dealerHand.map((card, index) => (
                <div
                  key={index}
                  className={`w-16 h-24 flex items-center justify-center text-2xl font-bold rounded-lg ${
                    ['♥', '♦'].includes(card.suit) ? 'text-red-500' : 'text-white'
                  } ${
                    gameState.gamePhase === 'playing' && index === 1
                      ? 'bg-[#2c3b47]'
                      : 'bg-[#0f1923]'
                  } border border-[#2c3b47]`}
                >
                  {gameState.gamePhase === 'playing' && index === 1 ? '?' : (
                    <>
                      {card.value}
                      <span className="text-sm ml-1">{card.suit}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            {gameState.gamePhase === 'complete' && (
              <div className="text-white font-bold">Score: {gameState.dealerScore}</div>
            )}
          </div>

          {/* Player's Hand */}
          <div className="text-center">
            <div className="text-[#8b9caa] mb-2">Your Hand</div>
            <div className="flex justify-center gap-4 mb-2">
              {gameState.playerHand.map((card, index) => (
                <div
                  key={index}
                  className={`w-16 h-24 flex items-center justify-center text-2xl font-bold rounded-lg ${
                    ['♥', '♦'].includes(card.suit) ? 'text-red-500' : 'text-white'
                  } bg-[#0f1923] border border-[#2c3b47]`}
                >
                  {card.value}
                  <span className="text-sm ml-1">{card.suit}</span>
                </div>
              ))}
            </div>
            {gameState.playerHand.length > 0 && (
              <div className="text-white font-bold">Score: {gameState.playerScore}</div>
            )}
          </div>

          {/* Game Controls */}
          <div className="flex flex-col items-center gap-4">
            {gameState.gamePhase === 'betting' ? (
              <>
                <div className="w-full max-w-xs">
                  <label className="block text-[#8b9caa] text-sm mb-2">Bet Amount</label>
                  <input
                    type="number"
                    value={gameState.betAmount}
                    onChange={(e) => setGameState(prev => ({
                      ...prev,
                      betAmount: Math.max(0, Number(e.target.value))
                    }))}
                    className="w-full bg-[#0f1923] text-white p-4 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
                  />
                </div>
                <button
                  onClick={startGame}
                  disabled={gameState.betAmount <= 0 || gameState.betAmount > tokenBalance}
                  className="w-full max-w-xs bg-[#00e701] hover:bg-[#00c701] text-[#0f1923] font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {gameState.betAmount > tokenBalance 
                    ? 'Insufficient Tokens' 
                    : `Bet ${gameState.betAmount.toFixed(2)} Tokens`}
                </button>
              </>
            ) : gameState.gamePhase === 'playing' ? (
              <div className="flex gap-4">
                <button
                  onClick={hit}
                  className="bg-[#4c82fb] hover:bg-[#3b71ea] text-white font-bold py-3 px-8 rounded-lg transition-colors"
                >
                  Hit
                </button>
                <button
                  onClick={stand}
                  className="bg-[#ff4444] hover:bg-[#ff3333] text-white font-bold py-3 px-8 rounded-lg transition-colors"
                >
                  Stand
                </button>
              </div>
            ) : (
              <button
                onClick={resetGame}
                className="bg-[#00e701] hover:bg-[#00c701] text-[#0f1923] font-bold py-3 px-8 rounded-lg transition-colors"
              >
                Play Again
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recent Games */}
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
                  {game.playerScore}
                </span>
                <span className="text-[#8b9caa]">vs {game.dealerScore}</span>
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