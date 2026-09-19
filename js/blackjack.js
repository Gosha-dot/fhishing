// Classic Blackjack (21) casino module for the Island location.
// Handles deck creation, Fisher-Yates shuffle, hand valuation (Soft/Hard Ace),
// dealer AI (hit until 17), and standard casino payouts (2x win, 2.5x blackjack, 1x push).

const SUITS = [
  { symbol: "♠", name: "spades", isRed: false },
  { symbol: "♥", name: "hearts", isRed: true },
  { symbol: "♦", name: "diamonds", isRed: true },
  { symbol: "♣", name: "clubs", isRed: false },
];

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export class BlackjackGame {
  constructor({ playerStore, onNotification }) {
    this.playerStore = playerStore;
    this.onNotification = onNotification ?? (() => {});
    this.deck = [];
    this.playerHand = [];
    this.dealerHand = [];
    this.currentBet = 10;
    this.status = "betting"; // "betting" | "playing" | "dealerTurn" | "ended"
    this.result = null;
  }

  createDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          suit: suit.symbol,
          suitName: suit.name,
          rank,
          isRed: suit.isRed,
          color: suit.isRed ? "#ff4d4d" : "#e0e0e0",
          id: `${rank}-${suit.symbol}-${Math.random().toString(36).slice(2, 6)}`,
        });
      }
    }
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  drawCard(hidden = false) {
    if (this.deck.length < 8) {
      this.deck = this.createDeck();
    }
    const card = this.deck.pop();
    return { ...card, hidden };
  }

  calculateHand(cards, hideHoleCard = false) {
    const visibleCards = hideHoleCard ? cards.filter((c) => !c.hidden) : cards;
    let sum = 0;
    let aces = 0;

    for (const card of visibleCards) {
      if (card.rank === "A") {
        aces += 1;
        sum += 11;
      } else if (["K", "Q", "J"].includes(card.rank)) {
        sum += 10;
      } else {
        sum += Number(card.rank);
      }
    }

    while (sum > 21 && aces > 0) {
      sum -= 10;
      aces -= 1;
    }

    return {
      total: sum,
      isBust: sum > 21,
      isBlackjack: visibleCards.length === 2 && sum === 21 && cards.length === 2,
      isSoft: aces > 0 && sum <= 21,
    };
  }

  placeBet(amount) {
    const bet = Math.max(5, Math.floor(Number(amount) || 10));
    const player = this.playerStore.snapshot();

    if (player.coins < bet) {
      return { ok: false, message: `Не вистачає монет! У вас ${player.coins}, а ставка ${bet}.` };
    }

    // Deduct the bet before dealing cards.
    const spendResult = this.playerStore.spendCoins(bet);
    if (!spendResult.ok) {
      return { ok: false, message: spendResult.message };
    }
    this.currentBet = bet;
    this.status = "playing";
    this.result = null;

    // Fresh deck if low
    if (this.deck.length < 15) {
      this.deck = this.createDeck();
    }

    // Deal 2 cards to player and 2 cards to dealer (1 dealer card hidden)
    this.playerHand = [this.drawCard(false), this.drawCard(false)];
    this.dealerHand = [this.drawCard(false), this.drawCard(true)];

    const playerEval = this.calculateHand(this.playerHand);
    const dealerEval = this.calculateHand(this.dealerHand, false);

    // Natural Blackjack check
    if (playerEval.isBlackjack) {
      // Reveal dealer hole card
      this.dealerHand[1].hidden = false;
      if (dealerEval.isBlackjack) {
        // Both blackjack = Push
        const payout = this.currentBet;
        this.playerStore.cheatGiveCoins(payout);
        this.status = "ended";
        this.result = {
          outcome: "push",
          message: "Обидва мають Блекджек! Нічия (ставка повернена).",
          payout,
        };
      } else {
        // Natural Blackjack payout = 2.5x
        const payout = Math.round(this.currentBet * 2.5);
        this.playerStore.cheatGiveCoins(payout);
        this.status = "ended";
        this.result = {
          outcome: "blackjack",
          message: `🔥 БЛЕКДЖЕК! Виграш 2.5x (+${payout} монет)!`,
          payout,
        };
      }
    }

    return { ok: true, message: `Ставку ${bet} монет прийнято. Гра почалась!` };
  }

  hit() {
    if (this.status !== "playing") {
      return { ok: false, message: "Зараз не можна брати карту." };
    }

    this.playerHand.push(this.drawCard(false));
    const playerEval = this.calculateHand(this.playerHand);

    if (playerEval.isBust) {
      // Reveal dealer hole card
      if (this.dealerHand[1]) this.dealerHand[1].hidden = false;
      this.status = "ended";
      this.result = {
        outcome: "bust",
        message: `Перебір (${playerEval.total})! Ви програли ставку ${this.currentBet} монет.`,
        payout: 0,
      };
      return { ok: true, bust: true };
    }

    if (playerEval.total === 21) {
      // Automatically stand on 21
      return this.stand();
    }

    return { ok: true, bust: false };
  }

  stand() {
    if (this.status !== "playing") {
      return { ok: false, message: "Хід уже завершено." };
    }

    this.status = "dealerTurn";

    // Reveal dealer's hole card
    if (this.dealerHand[1]) {
      this.dealerHand[1].hidden = false;
    }

    // Dealer draws until 17 or higher
    let dealerEval = this.calculateHand(this.dealerHand, false);
    while (dealerEval.total < 17) {
      this.dealerHand.push(this.drawCard(false));
      dealerEval = this.calculateHand(this.dealerHand, false);
    }

    const playerEval = this.calculateHand(this.playerHand);
    this.status = "ended";

    let outcome = "loss";
    let message = "";
    let payout = 0;

    if (dealerEval.isBust) {
      outcome = "dealer_bust";
      payout = this.currentBet * 2;
      message = `Дилер перебрав (${dealerEval.total})! Ви виграли ${payout} монет (2x)!`;
      this.playerStore.cheatGiveCoins(payout);
    } else if (playerEval.total > dealerEval.total) {
      outcome = "win";
      payout = this.currentBet * 2;
      message = `Перемога! ${playerEval.total} проти ${dealerEval.total} дилера. Виграш ${payout} монет!`;
      this.playerStore.cheatGiveCoins(payout);
    } else if (playerEval.total < dealerEval.total) {
      outcome = "dealer_win";
      payout = 0;
      message = `Дилер переміг (${dealerEval.total} проти ${playerEval.total}). Ви втратили ${this.currentBet} монет.`;
    } else {
      outcome = "push";
      payout = this.currentBet;
      message = `Нічия (${playerEval.total} : ${dealerEval.total})! Ставку ${payout} монет повернуто.`;
      this.playerStore.cheatGiveCoins(payout);
    }

    this.result = { outcome, message, payout };
    return { ok: true, result: this.result };
  }

  reset() {
    this.playerHand = [];
    this.dealerHand = [];
    this.status = "betting";
    this.result = null;
  }

  getSnapshot() {
    const isPlaying = this.status === "playing";
    const playerEval = this.calculateHand(this.playerHand);
    const dealerEval = this.calculateHand(this.dealerHand, isPlaying);

    return {
      status: this.status,
      currentBet: this.currentBet,
      playerHand: this.playerHand,
      dealerHand: this.dealerHand,
      playerScore: playerEval.total,
      dealerScore: dealerEval.total,
      playerBust: playerEval.isBust,
      playerBlackjack: playerEval.isBlackjack,
      dealerBust: dealerEval.isBust,
      result: this.result,
    };
  }
}

