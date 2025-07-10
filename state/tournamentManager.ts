/**
 * Tournament Manager for Hytopia Soccer
 * Handles tournament brackets, match scheduling, player coordination, and data persistence
 * Follows Hytopia SDK standards and uses PersistenceManager for data storage
 */

import { World, PlayerManager, PersistenceManager, type PlayerEntity } from 'hytopia';
import { GameMode } from './gameModes';

// Tournament types and interfaces
export enum TournamentType {
  SINGLE_ELIMINATION = "single-elimination",
  DOUBLE_ELIMINATION = "double-elimination", 
  ROUND_ROBIN = "round-robin"
}

export enum TournamentStatus {
  REGISTRATION = "registration",
  READY_CHECK = "ready-check",
  IN_PROGRESS = "in-progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled"
}

export enum MatchStatus {
  SCHEDULED = "scheduled",
  READY_CHECK = "ready-check",
  IN_PROGRESS = "in-progress",
  COMPLETED = "completed",
  FORFEITED = "forfeited"
}

export interface TournamentPlayer {
  username: string;
  displayName: string;
  isOnline: boolean;
  isReady: boolean;
  readyCheckExpires?: number;
  joinedAt: number;
  stats: {
    wins: number;
    losses: number;
    goals: number;
    matchesPlayed: number;
  };
}

export interface TournamentMatch {
  id: string;
  roundNumber: number;
  matchNumber: number;
  player1: string;
  player2: string;
  winner?: string;
  score?: { player1: number; player2: number };
  status: MatchStatus;
  scheduledTime?: number;
  readyCheckStarted?: number;
  readyCheckExpires?: number;
  player1Ready: boolean;
  player2Ready: boolean;
  gameMode: GameMode;
}

export interface Tournament {
  id: string;
  name: string;
  type: TournamentType;
  gameMode: GameMode;
  status: TournamentStatus;
  createdBy: string;
  createdAt: number;
  maxPlayers: number;
  registrationDeadline: number;
  players: { [username: string]: TournamentPlayer };
  bracket: TournamentMatch[];
  currentRound: number;
  winner?: string;
  prizePool?: string;
  rules: string[];
}

export class TournamentManager {
  private world: World;
  private activeTournaments: Map<string, Tournament> = new Map();
  private playerReadyCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private matchSchedulingTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(world: World) {
    this.world = world;
    this.loadTournamentsFromPersistence();
    this.startPlayerStatusMonitoring();
  }

  // ===== TOURNAMENT CREATION & MANAGEMENT =====

  public createTournament(
    name: string,
    type: TournamentType,
    gameMode: GameMode,
    maxPlayers: number = 8,
    registrationTimeMinutes: number = 10,
    createdBy: string = "system"
  ): Tournament {
    // Validate tournament size
    if (![4, 8, 16, 32].includes(maxPlayers)) {
      throw new Error("Tournament size must be 4, 8, 16, or 32 players");
    }

    const tournamentId = `tournament_${Date.now()}`;
    const tournament: Tournament = {
      id: tournamentId,
      name,
      type,
      gameMode,
      status: TournamentStatus.REGISTRATION,
      createdBy,
      createdAt: Date.now(),
      maxPlayers,
      registrationDeadline: Date.now() + (registrationTimeMinutes * 60 * 1000),
      players: {},
      bracket: [],
      currentRound: 1,
      rules: this.getDefaultRules(type, gameMode)
    };

    this.activeTournaments.set(tournamentId, tournament);
    this.saveTournamentToPersistence(tournament);

    console.log(`🏆 Tournament created: ${name} (${type}, ${gameMode} mode, ${maxPlayers} players)`);
    
    // Schedule registration deadline
    setTimeout(() => {
      this.handleRegistrationDeadline(tournamentId);
    }, registrationTimeMinutes * 60 * 1000);

    return tournament;
  }

  public registerPlayer(tournamentId: string, username: string, displayName?: string): boolean {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) {
      console.error(`Tournament ${tournamentId} not found`);
      return false;
    }

    if (tournament.status !== TournamentStatus.REGISTRATION) {
      console.error(`Tournament ${tournamentId} is not accepting registrations`);
      return false;
    }

    if (Object.keys(tournament.players).length >= tournament.maxPlayers) {
      console.error(`Tournament ${tournamentId} is full`);
      return false;
    }

    if (tournament.players[username]) {
      console.error(`Player ${username} already registered for tournament ${tournamentId}`);
      return false;
    }

    // Get player's tournament history
    const playerHistory = this.getPlayerTournamentHistory(username);
    
    tournament.players[username] = {
      username,
      displayName: displayName || username,
      isOnline: this.isPlayerOnline(username),
      isReady: false,
      joinedAt: Date.now(),
      stats: {
        wins: playerHistory.wins || 0,
        losses: playerHistory.losses || 0,
        goals: playerHistory.goals || 0,
        matchesPlayed: playerHistory.matchesPlayed || 0
      }
    };

    this.saveTournamentToPersistence(tournament);
    console.log(`✅ Player ${username} registered for tournament ${tournament.name}`);

    // Check if tournament is full
    if (Object.keys(tournament.players).length === tournament.maxPlayers) {
      this.startTournament(tournamentId);
    }

    return true;
  }

  public unregisterPlayer(tournamentId: string, username: string): boolean {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return false;

    if (tournament.status !== TournamentStatus.REGISTRATION) {
      console.error(`Cannot unregister from tournament ${tournamentId} - not in registration phase`);
      return false;
    }

    if (!tournament.players[username]) {
      console.error(`Player ${username} not registered for tournament ${tournamentId}`);
      return false;
    }

    delete tournament.players[username];
    this.saveTournamentToPersistence(tournament);
    console.log(`❌ Player ${username} unregistered from tournament ${tournament.name}`);

    return true;
  }

  // ===== TOURNAMENT BRACKET MANAGEMENT =====

  private generateBracket(tournament: Tournament): TournamentMatch[] {
    const players = Object.keys(tournament.players);
    const bracket: TournamentMatch[] = [];

    if (tournament.type === TournamentType.SINGLE_ELIMINATION) {
      return this.generateSingleEliminationBracket(players, tournament.gameMode);
    } else if (tournament.type === TournamentType.DOUBLE_ELIMINATION) {
      return this.generateDoubleEliminationBracket(players, tournament.gameMode);
    } else if (tournament.type === TournamentType.ROUND_ROBIN) {
      return this.generateRoundRobinBracket(players, tournament.gameMode);
    }

    return bracket;
  }

  private generateSingleEliminationBracket(players: string[], gameMode: GameMode): TournamentMatch[] {
    const bracket: TournamentMatch[] = [];
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    
    let matchId = 1;
    let roundNumber = 1;
    
    // First round matches
    for (let i = 0; i < shuffledPlayers.length; i += 2) {
      bracket.push({
        id: `match_${matchId}`,
        roundNumber,
        matchNumber: matchId,
        player1: shuffledPlayers[i],
        player2: shuffledPlayers[i + 1],
        status: MatchStatus.SCHEDULED,
        player1Ready: false,
        player2Ready: false,
        gameMode
      });
      matchId++;
    }

    // Generate subsequent rounds
    let currentRoundMatches = Math.floor(shuffledPlayers.length / 2);
    roundNumber++;
    
    while (currentRoundMatches > 1) {
      for (let i = 0; i < Math.floor(currentRoundMatches / 2); i++) {
        bracket.push({
          id: `match_${matchId}`,
          roundNumber,
          matchNumber: matchId,
          player1: "TBD",
          player2: "TBD",
          status: MatchStatus.SCHEDULED,
          player1Ready: false,
          player2Ready: false,
          gameMode
        });
        matchId++;
      }
      currentRoundMatches = Math.floor(currentRoundMatches / 2);
      roundNumber++;
    }

    return bracket;
  }

  private generateDoubleEliminationBracket(players: string[], gameMode: GameMode): TournamentMatch[] {
    // Double elimination implementation (simplified)
    const bracket = this.generateSingleEliminationBracket(players, gameMode);
    // TODO: Add losers bracket generation
    return bracket;
  }

  private generateRoundRobinBracket(players: string[], gameMode: GameMode): TournamentMatch[] {
    const bracket: TournamentMatch[] = [];
    let matchId = 1;
    
    // Generate all possible pairings
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        bracket.push({
          id: `match_${matchId}`,
          roundNumber: 1,
          matchNumber: matchId,
          player1: players[i],
          player2: players[j],
          status: MatchStatus.SCHEDULED,
          player1Ready: false,
          player2Ready: false,
          gameMode
        });
        matchId++;
      }
    }

    return bracket;
  }

  // ===== MATCH COORDINATION & SCHEDULING =====

  public scheduleMatch(tournamentId: string, matchId: string, delayMinutes: number = 2): boolean {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return false;

    const match = tournament.bracket.find(m => m.id === matchId);
    if (!match) return false;

    const scheduledTime = Date.now() + (delayMinutes * 60 * 1000);
    match.scheduledTime = scheduledTime;
    match.status = MatchStatus.SCHEDULED;

    this.saveTournamentToPersistence(tournament);
    console.log(`📅 Match ${matchId} scheduled for ${new Date(scheduledTime).toLocaleTimeString()}`);

    // Schedule ready check
    const readyCheckTimer = setTimeout(() => {
      this.startReadyCheck(tournamentId, matchId);
    }, (delayMinutes - 1) * 60 * 1000); // Start ready check 1 minute before

    this.matchSchedulingTimers.set(matchId, readyCheckTimer);

    // Notify players
    this.notifyPlayersOfScheduledMatch(tournament, match);

    return true;
  }

  public startReadyCheck(tournamentId: string, matchId: string): boolean {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return false;

    const match = tournament.bracket.find(m => m.id === matchId);
    if (!match) return false;

    // Check if both players are online
    const player1Online = this.isPlayerOnline(match.player1);
    const player2Online = this.isPlayerOnline(match.player2);

    if (!player1Online || !player2Online) {
      console.log(`⚠️ Cannot start ready check - players offline: ${match.player1}=${player1Online}, ${match.player2}=${player2Online}`);
      // Handle forfeit or reschedule
      this.handlePlayerUnavailable(tournamentId, matchId);
      return false;
    }

    match.status = MatchStatus.READY_CHECK;
    match.readyCheckStarted = Date.now();
    match.readyCheckExpires = Date.now() + (5 * 60 * 1000); // 5 minutes to ready up
    match.player1Ready = false;
    match.player2Ready = false;

    this.saveTournamentToPersistence(tournament);
    console.log(`🔔 Ready check started for match ${matchId}`);

    // Send ready check notifications
    this.sendReadyCheckNotifications(tournament, match);

    // Set timer for ready check timeout
    const readyCheckTimer = setTimeout(() => {
      this.handleReadyCheckTimeout(tournamentId, matchId);
    }, 5 * 60 * 1000);

    this.playerReadyCheckTimers.set(matchId, readyCheckTimer);

    return true;
  }

  public setPlayerReady(tournamentId: string, matchId: string, username: string, isReady: boolean): boolean {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return false;

    const match = tournament.bracket.find(m => m.id === matchId);
    if (!match) return false;

    if (match.status !== MatchStatus.READY_CHECK) {
      console.error(`Match ${matchId} is not in ready check phase`);
      return false;
    }

    if (match.player1 === username) {
      match.player1Ready = isReady;
    } else if (match.player2 === username) {
      match.player2Ready = isReady;
    } else {
      console.error(`Player ${username} not part of match ${matchId}`);
      return false;
    }

    this.saveTournamentToPersistence(tournament);
    console.log(`${isReady ? '✅' : '❌'} Player ${username} marked as ${isReady ? 'ready' : 'not ready'} for match ${matchId}`);

    // Check if both players are ready
    if (match.player1Ready && match.player2Ready) {
      this.startMatch(tournamentId, matchId);
    }

    return true;
  }

  private startMatch(tournamentId: string, matchId: string): boolean {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return false;

    const match = tournament.bracket.find(m => m.id === matchId);
    if (!match) return false;

    match.status = MatchStatus.IN_PROGRESS;
    this.saveTournamentToPersistence(tournament);

    // Clear ready check timer
    const timer = this.playerReadyCheckTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      this.playerReadyCheckTimers.delete(matchId);
    }

    console.log(`🏁 Match ${matchId} started: ${match.player1} vs ${match.player2}`);

    // Notify players and start the actual game
    this.notifyMatchStart(tournament, match);

    return true;
  }

  public completeMatch(tournamentId: string, matchId: string, winner: string, score: { player1: number; player2: number }): boolean {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return false;

    const match = tournament.bracket.find(m => m.id === matchId);
    if (!match) return false;

    match.status = MatchStatus.COMPLETED;
    match.winner = winner;
    match.score = score;

    // Update player stats
    const loser = winner === match.player1 ? match.player2 : match.player1;
    this.updatePlayerStats(winner, true, score.player1 + score.player2);
    this.updatePlayerStats(loser, false, score.player1 + score.player2);

    this.saveTournamentToPersistence(tournament);
    console.log(`✅ Match ${matchId} completed: ${winner} defeats ${loser} ${score.player1}-${score.player2}`);

    // Notify all tournament players of bracket update
    this.notifyBracketUpdate(tournament);

    // Advance tournament
    this.advanceTournament(tournamentId, match);

    return true;
  }

  // ===== TOURNAMENT PROGRESSION =====

  private startTournament(tournamentId: string): void {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return;

    tournament.status = TournamentStatus.IN_PROGRESS;
    tournament.bracket = this.generateBracket(tournament);
    tournament.currentRound = 1;

    this.saveTournamentToPersistence(tournament);
    console.log(`🏆 Tournament ${tournament.name} started with ${Object.keys(tournament.players).length} players`);

    // Schedule first round matches
    this.scheduleFirstRoundMatches(tournament);

    // Notify all players
    this.notifyTournamentStart(tournament);
  }

  private scheduleFirstRoundMatches(tournament: Tournament): void {
    const firstRoundMatches = tournament.bracket.filter(m => m.roundNumber === 1);
    
    firstRoundMatches.forEach((match, index) => {
      // Stagger matches by 2 minutes each
      const delayMinutes = 2 + (index * 2);
      this.scheduleMatch(tournament.id, match.id, delayMinutes);
    });
  }

  private advanceTournament(tournamentId: string, completedMatch: TournamentMatch): void {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return;

    if (tournament.type === TournamentType.SINGLE_ELIMINATION) {
      this.advanceSingleElimination(tournament, completedMatch);
    } else if (tournament.type === TournamentType.ROUND_ROBIN) {
      this.advanceRoundRobin(tournament);
    }
  }

  private advanceSingleElimination(tournament: Tournament, completedMatch: TournamentMatch): void {
    const nextRound = completedMatch.roundNumber + 1;
    const nextMatch = tournament.bracket.find(m => 
      m.roundNumber === nextRound && 
      (m.player1 === "TBD" || m.player2 === "TBD")
    );

    if (nextMatch) {
      if (nextMatch.player1 === "TBD") {
        nextMatch.player1 = completedMatch.winner!;
      } else if (nextMatch.player2 === "TBD") {
        nextMatch.player2 = completedMatch.winner!;
      }

      // Check if next match is ready to schedule
      if (nextMatch.player1 !== "TBD" && nextMatch.player2 !== "TBD") {
        this.scheduleMatch(tournament.id, nextMatch.id, 5); // 5 minute break
      }
    } else {
      // Check if tournament is complete
      const remainingMatches = tournament.bracket.filter(m => m.status !== MatchStatus.COMPLETED);
      if (remainingMatches.length === 0) {
        this.completeTournament(tournament.id, completedMatch.winner!);
      }
    }
  }

  private advanceRoundRobin(tournament: Tournament): void {
    const remainingMatches = tournament.bracket.filter(m => m.status !== MatchStatus.COMPLETED);
    
    if (remainingMatches.length === 0) {
      // Calculate winner based on wins/points
      const winner = this.calculateRoundRobinWinner(tournament);
      this.completeTournament(tournament.id, winner);
    } else {
      // Schedule next available match
      const nextMatch = remainingMatches.find(m => m.status === MatchStatus.SCHEDULED);
      if (nextMatch) {
        this.scheduleMatch(tournament.id, nextMatch.id, 2);
      }
    }
  }

  private calculateRoundRobinWinner(tournament: Tournament): string {
    const playerStats: { [username: string]: { wins: number; goalDiff: number } } = {};
    
    Object.keys(tournament.players).forEach(username => {
      playerStats[username] = { wins: 0, goalDiff: 0 };
    });

    tournament.bracket.forEach(match => {
      if (match.status === MatchStatus.COMPLETED && match.winner && match.score) {
        const loser = match.winner === match.player1 ? match.player2 : match.player1;
        playerStats[match.winner].wins++;
        playerStats[match.winner].goalDiff += match.score.player1 - match.score.player2;
        playerStats[loser].goalDiff += match.score.player2 - match.score.player1;
      }
    });

    // Find winner by wins, then by goal difference
    let winner = Object.keys(playerStats)[0];
    Object.keys(playerStats).forEach(username => {
      if (playerStats[username].wins > playerStats[winner].wins ||
          (playerStats[username].wins === playerStats[winner].wins && 
           playerStats[username].goalDiff > playerStats[winner].goalDiff)) {
        winner = username;
      }
    });

    return winner;
  }

  private completeTournament(tournamentId: string, winner: string): void {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return;

    tournament.status = TournamentStatus.COMPLETED;
    tournament.winner = winner;

    this.saveTournamentToPersistence(tournament);
    console.log(`🏆 Tournament ${tournament.name} completed! Winner: ${winner}`);

    // Update player tournament history
    this.updatePlayerTournamentHistory(winner, true);
    Object.keys(tournament.players).forEach(username => {
      if (username !== winner) {
        this.updatePlayerTournamentHistory(username, false);
      }
    });

    // Notify all players
    this.notifyTournamentComplete(tournament);
  }

  // ===== PLAYER MANAGEMENT & MONITORING =====

  private startPlayerStatusMonitoring(): void {
    setInterval(() => {
      this.updatePlayerOnlineStatus();
    }, 30000); // Check every 30 seconds
  }

  private updatePlayerOnlineStatus(): void {
    this.activeTournaments.forEach(tournament => {
      Object.keys(tournament.players).forEach(username => {
        const isOnline = this.isPlayerOnline(username);
        if (tournament.players[username].isOnline !== isOnline) {
          tournament.players[username].isOnline = isOnline;
          console.log(`📱 Player ${username} status changed: ${isOnline ? 'online' : 'offline'}`);
        }
      });
    });
  }

  private isPlayerOnline(username: string): boolean {
    return PlayerManager.instance.getConnectedPlayerByUsername(username) !== undefined;
  }

  // ===== NOTIFICATION SYSTEM =====

  private notifyPlayersOfScheduledMatch(tournament: Tournament, match: TournamentMatch): void {
    const player1 = PlayerManager.instance.getConnectedPlayerByUsername(match.player1);
    const player2 = PlayerManager.instance.getConnectedPlayerByUsername(match.player2);

    const notificationData = {
      type: "tournament-match-scheduled",
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      matchId: match.id,
      opponent: "",
      scheduledTime: match.scheduledTime,
      gameMode: match.gameMode
    };

    if (player1) {
      notificationData.opponent = match.player2;
      player1.ui.sendData(notificationData);
    }

    if (player2) {
      notificationData.opponent = match.player1;
      player2.ui.sendData(notificationData);
    }
  }

  private sendReadyCheckNotifications(tournament: Tournament, match: TournamentMatch): void {
    const player1 = PlayerManager.instance.getConnectedPlayerByUsername(match.player1);
    const player2 = PlayerManager.instance.getConnectedPlayerByUsername(match.player2);

    const notificationData = {
      type: "tournament-ready-check",
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      matchId: match.id,
      opponent: "",
      expiresAt: match.readyCheckExpires,
      timeLimit: 5 * 60 * 1000 // 5 minutes
    };

    if (player1) {
      notificationData.opponent = match.player2;
      player1.ui.sendData(notificationData);
    }

    if (player2) {
      notificationData.opponent = match.player1;
      player2.ui.sendData(notificationData);
    }
  }

  private notifyMatchStart(tournament: Tournament, match: TournamentMatch): void {
    const player1 = PlayerManager.instance.getConnectedPlayerByUsername(match.player1);
    const player2 = PlayerManager.instance.getConnectedPlayerByUsername(match.player2);

    const notificationData = {
      type: "tournament-match-start",
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      matchId: match.id,
      opponent: "",
      gameMode: match.gameMode
    };

    if (player1) {
      notificationData.opponent = match.player2;
      player1.ui.sendData(notificationData);
    }

    if (player2) {
      notificationData.opponent = match.player1;
      player2.ui.sendData(notificationData);
    }
  }

  private notifyTournamentStart(tournament: Tournament): void {
    Object.keys(tournament.players).forEach(username => {
      const player = PlayerManager.instance.getConnectedPlayerByUsername(username);
      if (player) {
        player.ui.sendData({
          type: "tournament-started",
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          playerCount: Object.keys(tournament.players).length,
          bracket: tournament.bracket.map(m => ({
            id: m.id,
            roundNumber: m.roundNumber,
            matchNumber: m.matchNumber,
            player1: m.player1,
            player2: m.player2,
            winner: m.winner,
            score: m.score,
            status: m.status
          }))
        });
      }
    });
  }

  private notifyBracketUpdate(tournament: Tournament): void {
    Object.keys(tournament.players).forEach(username => {
      const player = PlayerManager.instance.getConnectedPlayerByUsername(username);
      if (player) {
        player.ui.sendData({
          type: "tournament-bracket-updated",
          tournamentId: tournament.id,
          bracket: tournament.bracket.map(m => ({
            id: m.id,
            roundNumber: m.roundNumber,
            matchNumber: m.matchNumber,
            player1: m.player1,
            player2: m.player2,
            winner: m.winner,
            score: m.score,
            status: m.status
          }))
        });
      }
    });
  }

  private notifyTournamentComplete(tournament: Tournament): void {
    Object.keys(tournament.players).forEach(username => {
      const player = PlayerManager.instance.getConnectedPlayerByUsername(username);
      if (player) {
        player.ui.sendData({
          type: "tournament-completed",
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          winner: tournament.winner,
          isWinner: username === tournament.winner,
          finalBracket: tournament.bracket
        });
      }
    });
  }

  // ===== EVENT HANDLERS =====

  private handleRegistrationDeadline(tournamentId: string): void {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return;

    if (tournament.status === TournamentStatus.REGISTRATION) {
      const playerCount = Object.keys(tournament.players).length;
      const minPlayers = tournament.type === TournamentType.ROUND_ROBIN ? 3 : 4;

      if (playerCount < minPlayers) {
        console.log(`❌ Tournament ${tournament.name} cancelled - insufficient players (${playerCount}/${minPlayers})`);
        tournament.status = TournamentStatus.CANCELLED;
        this.notifyTournamentCancelled(tournament);
      } else {
        console.log(`⏰ Registration deadline reached for tournament ${tournament.name} - starting with ${playerCount} players`);
        this.startTournament(tournamentId);
      }
    }
  }

  private handleReadyCheckTimeout(tournamentId: string, matchId: string): void {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return;

    const match = tournament.bracket.find(m => m.id === matchId);
    if (!match) return;

    console.log(`⏰ Ready check timeout for match ${matchId}`);

    // Determine forfeit
    if (!match.player1Ready && !match.player2Ready) {
      // Both players didn't ready up - double forfeit or reschedule
      this.handleDoubleNoShow(tournamentId, matchId);
    } else if (!match.player1Ready) {
      // Player 1 forfeits
      this.forfeitMatch(tournamentId, matchId, match.player2);
    } else if (!match.player2Ready) {
      // Player 2 forfeits
      this.forfeitMatch(tournamentId, matchId, match.player1);
    }
  }

  private handlePlayerUnavailable(tournamentId: string, matchId: string): void {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return;

    const match = tournament.bracket.find(m => m.id === matchId);
    if (!match) return;

    const player1Online = this.isPlayerOnline(match.player1);
    const player2Online = this.isPlayerOnline(match.player2);

    if (!player1Online && !player2Online) {
      // Both offline - reschedule
      this.rescheduleMatch(tournamentId, matchId, 10); // 10 minute delay
    } else if (!player1Online) {
      // Player 1 offline - forfeit
      this.forfeitMatch(tournamentId, matchId, match.player2);
    } else if (!player2Online) {
      // Player 2 offline - forfeit
      this.forfeitMatch(tournamentId, matchId, match.player1);
    }
  }

  private handleDoubleNoShow(tournamentId: string, matchId: string): void {
    // For now, reschedule the match
    this.rescheduleMatch(tournamentId, matchId, 15); // 15 minute delay
  }

  private forfeitMatch(tournamentId: string, matchId: string, winner: string): void {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return;

    const match = tournament.bracket.find(m => m.id === matchId);
    if (!match) return;

    match.status = MatchStatus.FORFEITED;
    match.winner = winner;
    match.score = { player1: 0, player2: 0 };

    this.saveTournamentToPersistence(tournament);
    console.log(`⚠️ Match ${matchId} forfeited - winner: ${winner}`);

    // Advance tournament
    this.advanceTournament(tournamentId, match);
  }

  private rescheduleMatch(tournamentId: string, matchId: string, delayMinutes: number): void {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return;

    const match = tournament.bracket.find(m => m.id === matchId);
    if (!match) return;

    match.status = MatchStatus.SCHEDULED;
    match.scheduledTime = Date.now() + (delayMinutes * 60 * 1000);
    match.readyCheckStarted = undefined;
    match.readyCheckExpires = undefined;
    match.player1Ready = false;
    match.player2Ready = false;

    this.saveTournamentToPersistence(tournament);
    console.log(`📅 Match ${matchId} rescheduled for ${delayMinutes} minutes`);

    // Clear existing timers
    const timer = this.playerReadyCheckTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      this.playerReadyCheckTimers.delete(matchId);
    }

    // Schedule new ready check
    const readyCheckTimer = setTimeout(() => {
      this.startReadyCheck(tournamentId, matchId);
    }, (delayMinutes - 1) * 60 * 1000);

    this.matchSchedulingTimers.set(matchId, readyCheckTimer);
  }

  private notifyTournamentCancelled(tournament: Tournament): void {
    Object.keys(tournament.players).forEach(username => {
      const player = PlayerManager.instance.getConnectedPlayerByUsername(username);
      if (player) {
        player.ui.sendData({
          type: "tournament-cancelled",
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          reason: "Insufficient players"
        });
      }
    });
  }

  // ===== DATA PERSISTENCE =====

  private loadTournamentsFromPersistence(): void {
    try {
      const savedTournaments = PersistenceManager.instance.getGlobalData<{ [id: string]: Tournament }>("tournaments");
      if (savedTournaments) {
        Object.values(savedTournaments).forEach(tournament => {
          if (tournament.status === TournamentStatus.IN_PROGRESS || tournament.status === TournamentStatus.READY_CHECK) {
            this.activeTournaments.set(tournament.id, tournament);
            console.log(`🔄 Restored tournament: ${tournament.name}`);
          }
        });
      }
    } catch (error) {
      console.error("Error loading tournaments from persistence:", error);
    }
  }

  private saveTournamentToPersistence(tournament: Tournament): void {
    try {
      const savedTournaments = PersistenceManager.instance.getGlobalData<{ [id: string]: Tournament }>("tournaments") || {};
      savedTournaments[tournament.id] = tournament;
      PersistenceManager.instance.setGlobalData("tournaments", savedTournaments);
    } catch (error) {
      console.error("Error saving tournament to persistence:", error);
    }
  }

  private updatePlayerStats(username: string, won: boolean, totalGoals: number): void {
    try {
      const player = PlayerManager.instance.getConnectedPlayerByUsername(username);
      if (player) {
        const stats = player.getPersistedData<any>("tournamentStats") || { wins: 0, losses: 0, matchesPlayed: 0, goals: 0 };
        
        if (won) {
          stats.wins++;
        } else {
          stats.losses++;
        }
        stats.matchesPlayed++;
        stats.goals += totalGoals;

        player.setPersistedData("tournamentStats", stats);
      }
    } catch (error) {
      console.error("Error updating player stats:", error);
    }
  }

  private updatePlayerTournamentHistory(username: string, won: boolean): void {
    try {
      const player = PlayerManager.instance.getConnectedPlayerByUsername(username);
      if (player) {
        const history = player.getPersistedData<any>("tournamentHistory") || { tournamentsWon: 0, tournamentsPlayed: 0 };
        
        if (won) {
          history.tournamentsWon++;
        }
        history.tournamentsPlayed++;

        player.setPersistedData("tournamentHistory", history);
      }
    } catch (error) {
      console.error("Error updating player tournament history:", error);
    }
  }

  private getPlayerTournamentHistory(username: string): any {
    try {
      const player = PlayerManager.instance.getConnectedPlayerByUsername(username);
      if (player) {
        return player.getPersistedData<any>("tournamentStats") || { wins: 0, losses: 0, matchesPlayed: 0, goals: 0 };
      }
    } catch (error) {
      console.error("Error getting player tournament history:", error);
    }
    return { wins: 0, losses: 0, matchesPlayed: 0, goals: 0 };
  }

  // ===== UTILITY METHODS =====

  private getDefaultRules(type: TournamentType, gameMode: GameMode): string[] {
    const rules = [
      "All matches must be played to completion",
      "No artificial enhancements or cheating allowed",
      "Players must be ready within 5 minutes of ready check",
      "Forfeits will be awarded for no-shows",
      "Disputes will be handled by tournament administrator"
    ];

    if (gameMode === GameMode.ARCADE) {
      rules.push("Arcade mode abilities are enabled");
    } else if (gameMode === GameMode.FIFA) {
      rules.push("FIFA mode - realistic soccer simulation");
    }

    if (type === TournamentType.ROUND_ROBIN) {
      rules.push("Round robin format - all players play each other");
    } else if (type === TournamentType.SINGLE_ELIMINATION) {
      rules.push("Single elimination - one loss eliminates player");
    }

    return rules;
  }

  // ===== PUBLIC GETTERS =====

  public getCurrentTournament(): Tournament | null {
    const activeTournament = Array.from(this.activeTournaments.values()).find(t => 
      t.status === TournamentStatus.IN_PROGRESS || t.status === TournamentStatus.READY_CHECK
    );
    return activeTournament || null;
  }

  public getTournament(tournamentId: string): Tournament | undefined {
    return this.activeTournaments.get(tournamentId);
  }

  public getAllTournaments(): Tournament[] {
    return Array.from(this.activeTournaments.values());
  }

  public getActiveTournaments(): Tournament[] {
    return Array.from(this.activeTournaments.values()).filter(t => 
      t.status === TournamentStatus.REGISTRATION || 
      t.status === TournamentStatus.IN_PROGRESS || 
      t.status === TournamentStatus.READY_CHECK
    );
  }

  public getPlayerActiveTournaments(username: string): Tournament[] {
    return Array.from(this.activeTournaments.values()).filter(t => t.players[username]);
  }

  public getMatchForPlayer(username: string): TournamentMatch | null {
    for (const tournament of this.activeTournaments.values()) {
      const match = tournament.bracket.find(m => 
        (m.player1 === username || m.player2 === username) && 
        (m.status === MatchStatus.READY_CHECK || m.status === MatchStatus.SCHEDULED)
      );
      if (match) return match;
    }
    return null;
  }

  // ===== CLEANUP =====

  public cleanup(): void {
    this.playerReadyCheckTimers.forEach(timer => clearTimeout(timer));
    this.matchSchedulingTimers.forEach(timer => clearTimeout(timer));
    this.playerReadyCheckTimers.clear();
    this.matchSchedulingTimers.clear();
  }
} 