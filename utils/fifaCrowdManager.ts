import { Audio, World } from "hytopia";
import { isFIFAMode } from "../state/gameModes";

// Node.js Timer type
type Timer = ReturnType<typeof setTimeout>;

/**
 * FIFA Crowd Manager - Creates realistic stadium atmosphere for FIFA mode
 * Handles ambient crowd noise, event-triggered reactions, random chants, and announcer commentary
 */
export class FIFACrowdManager {
  private world: World;
  private ambientAudio: Audio | null = null;
  private chantInterval: Timer | null = null;
  private isActive: boolean = false;
  
  // Voice management system to prevent overlapping announcer audio
  private currentAnnouncerAudio: Audio | null = null;
  private isAnnouncerSpeaking: boolean = false;
  private announcerQueue: Array<{
    type: string;
    audioUri: string;
    priority: number;
    volume: number;
  }> = [];
  private queueProcessorInterval: Timer | null = null;
  
  // Audio collections based on available files
  private crowdSounds = {
    ambient: [
      "audio/sfx/crowd/ambient/Echoto Sound - English Sports Crowd - Liverpool Football Stadium Ambience Cheering Clapping Chanting.wav",
      "audio/sfx/crowd/ambient/Sonic Bat - Soccer Stadium - Crowd Chanting Clapping Rhythmically.wav"
    ],
    chants: [
      "audio/sfx/crowd/chants/Stringer Sound - Ultras - Crowd Chanting Ecstatic.wav",
      "audio/sfx/crowd/chants/Sonic Bat - Soccer Stadium - Announcer Speaking Crowd Reacting Shouting.wav",
      "audio/sfx/crowd/chants/EVG Sound FX - Loyal Fans - Soccer Fans Melodic Chanting.wav"
    ],
    reactions: {
      goalCheer: "audio/sfx/crowd/reactions/Stringer Sound - Ultras - Crowd Cheers Clapping Goal Reaction.wav",
      applause: "audio/sfx/crowd/reactions/Airborne Sound - Reaction - Soccer - Cheer and Applause - Medium Distant.wav",
      foulReaction: "audio/sfx/crowd/reactions/Stringer Sound - Soccer Game - Football Crowd Ambience Crowd Foul Reaction Angry Upset.wav",
      mixedReaction: "audio/sfx/crowd/reactions/Sonic Bat - Soccer Stadium - Crowd Cheering Short Whistles Light Booing .wav"
    },
    announcer: {
      gameStart: [
        "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - Game Start.wav"
      ],
      goals: [
        "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - What a Goal Excited.wav",
        "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - What a Beauty.wav",
        "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - Crowd Goes Wild.wav",
        "audio/sfx/crowd/announcer/Apple Hill Studios - Sports Announcer - Play By Play What A Shot .wav"
      ],
      saves: [
        "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - Reaction Beautiful Save.wav"
      ],
      nearMiss: [
        "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - So Close Frustrated .wav",
        "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - Reaction Near Miss.wav"
      ],
      momentum: [
        "audio/sfx/crowd/announcer/Apple Hill Studios - Sports Announcer - Play By Play Hes On Fire Now.wav",
        "audio/sfx/crowd/announcer/Apple Hill Studios - Sports Announcer - Play By Play Hes On A Roll .wav"
      ],
      gameEnd: [
        "audio/sfx/crowd/announcer/Apple Hill Studios - Sports Announcer - Play By Play Its All Over .wav"
      ],
      redCard: [
        "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - Red Card.wav"
      ]
    }
  };

  constructor(world: World) {
    this.world = world;
    console.log("FIFA Crowd Manager initialized");
    
    // Start the announcer queue processor
    this.startQueueProcessor();
  }

  /**
   * Start the FIFA crowd atmosphere system
   * Only activates if currently in FIFA mode
   */
  public start(): void {
    if (!isFIFAMode()) {
      console.log("FIFA Crowd Manager: Not in FIFA mode, skipping activation");
      return;
    }

    if (this.isActive) {
      console.log("FIFA Crowd Manager: Already active");
      return;
    }

    this.isActive = true;
    console.log("🏟️ Starting FIFA stadium crowd atmosphere");

    // Start ambient crowd noise
    this.startAmbientCrowd();
    
    // Start random chants system
    this.startRandomChants();
  }

  /**
   * Stop the FIFA crowd atmosphere system
   */
  public stop(): void {
    if (!this.isActive) return;

    console.log("🔇 Stopping FIFA stadium crowd atmosphere");
    this.isActive = false;

    // Stop ambient audio
    if (this.ambientAudio) {
      this.ambientAudio.pause();
      this.ambientAudio = null;
    }

    // Stop chant timer
    if (this.chantInterval) {
      clearTimeout(this.chantInterval);
      this.chantInterval = null;
    }
    
    // Stop current announcer audio and clear queue
    if (this.currentAnnouncerAudio) {
      this.currentAnnouncerAudio.pause();
      this.currentAnnouncerAudio = null;
    }
    this.isAnnouncerSpeaking = false;
    this.announcerQueue = [];
    
    // Note: Don't stop queue processor as it should run continuously
  }

  /**
   * Start continuous ambient crowd noise
   */
  private startAmbientCrowd(): void {
    // Rotate through ambient tracks for variety
    const randomAmbient = this.getRandomSound(this.crowdSounds.ambient);
    
    this.ambientAudio = new Audio({
      uri: randomAmbient,
      loop: true,
      volume: 0.15, // Low volume for ambient background
    });
    
    this.ambientAudio.play(this.world);
    console.log(`🎵 Playing ambient crowd: ${randomAmbient.split('/').pop()}`);
  }

  /**
   * Start system for random crowd chants
   */
  private startRandomChants(): void {
    const playRandomChant = () => {
      if (!this.isActive || !isFIFAMode()) return;

      const randomChant = this.getRandomSound(this.crowdSounds.chants);
      
      const chantAudio = new Audio({
        uri: randomChant,
        loop: false,
        volume: 0.25,
      });
      
      chantAudio.play(this.world);
      console.log(`📢 Playing crowd chant: ${randomChant.split('/').pop()}`);
    };

    // Play chants every 45-90 seconds for realistic intervals
    const scheduleNextChant = () => {
      if (!this.isActive) return;
      
      const nextInterval = 45000 + Math.random() * 45000; // 45-90 seconds
      this.chantInterval = setTimeout(() => {
        playRandomChant();
        scheduleNextChant();
      }, nextInterval);
    };

    // Start the chant cycle
    scheduleNextChant();
  }

  /**
   * Play crowd reaction to a goal
   */
  public playGoalReaction(): void {
    if (!this.isActive || !isFIFAMode()) return;

    console.log("🥅 Playing FIFA crowd goal reaction");
    
    // Play crowd cheer (immediate, no queue needed for crowd sounds)
    const goalCheer = new Audio({
      uri: this.crowdSounds.reactions.goalCheer,
      loop: false,
      volume: 0.4,
    });
    goalCheer.play(this.world);

    // Queue announcer commentary with high priority
    const randomAnnouncer = this.getRandomSound(this.crowdSounds.announcer.goals);
    this.queueAnnouncement("goal", randomAnnouncer, 100, 0.6); // Priority 100 = highest
  }

  /**
   * Play crowd reaction to a near miss or save
   */
  public playNearMissReaction(): void {
    if (!this.isActive || !isFIFAMode()) return;

    console.log("😲 Playing FIFA crowd near miss reaction");
    
    // Play mixed reaction (gasps, applause)
    const reactionAudio = new Audio({
      uri: this.crowdSounds.reactions.mixedReaction,
      loop: false,
      volume: 0.3,
    });
    reactionAudio.play(this.world);

    // Sometimes add announcer commentary with medium priority
    if (Math.random() < 0.6) { // 60% chance
      const randomAnnouncer = this.getRandomSound(this.crowdSounds.announcer.nearMiss);
      this.queueAnnouncement("near-miss", randomAnnouncer, 60, 0.5); // Priority 60 = medium
    }
  }

  /**
   * Play save reaction with announcer commentary
   */
  public playSaveReaction(): void {
    if (!this.isActive || !isFIFAMode()) return;

    console.log("🥅 Playing FIFA save reaction");
    
    // Play applause for good save
    const applauseAudio = new Audio({
      uri: this.crowdSounds.reactions.applause,
      loop: false,
      volume: 0.3,
    });
    applauseAudio.play(this.world);

    // Queue save commentary with medium-high priority
    const randomAnnouncer = this.getRandomSound(this.crowdSounds.announcer.saves);
    this.queueAnnouncement("save", randomAnnouncer, 70, 0.5); // Priority 70 = medium-high
  }

  /**
   * Play momentum building commentary (for streaks, great plays, etc.)
   */
  public playMomentumAnnouncement(): void {
    if (!this.isActive || !isFIFAMode()) return;

    console.log("🔥 Playing FIFA momentum announcement");
    
    // Queue momentum commentary with high priority (but lower than goals)
    const randomAnnouncer = this.getRandomSound(this.crowdSounds.announcer.momentum);
    this.queueAnnouncement("momentum", randomAnnouncer, 90, 0.6); // Priority 90 = high
  }

  /**
   * Play red card announcement
   */
  public playRedCardAnnouncement(): void {
    if (!this.isActive || !isFIFAMode()) return;

    console.log("🔴 Playing FIFA red card announcement");
    
    // Play foul reaction first
    const foulAudio = new Audio({
      uri: this.crowdSounds.reactions.foulReaction,
      loop: false,
      volume: 0.4,
    });
    foulAudio.play(this.world);

    // Queue red card announcement with very high priority
    const randomAnnouncer = this.getRandomSound(this.crowdSounds.announcer.redCard);
    this.queueAnnouncement("red-card", randomAnnouncer, 95, 0.7); // Priority 95 = very high
  }

  /**
   * Play game end announcement
   */
  public playGameEndAnnouncement(): void {
    if (!this.isActive || !isFIFAMode()) return;

    console.log("🏁 Playing FIFA game end announcement");
    
    // Queue game end announcement with highest priority
    const randomAnnouncer = this.getRandomSound(this.crowdSounds.announcer.gameEnd);
    this.queueAnnouncement("game-end", randomAnnouncer, 110, 0.7); // Priority 110 = maximum
  }

  /**
   * Play crowd reaction to fouls or controversial moments
   */
  public playFoulReaction(): void {
    if (!this.isActive || !isFIFAMode()) return;

    console.log("😠 Playing FIFA crowd foul reaction");
    
    const foulAudio = new Audio({
      uri: this.crowdSounds.reactions.foulReaction,
      loop: false,
      volume: 0.35,
    });
    foulAudio.play(this.world);
  }

  /**
   * Play game start announcement
   */
  public playGameStart(): void {
    if (!this.isActive || !isFIFAMode()) return;

    console.log("🏁 Playing FIFA game start announcement");
    
    // Queue game start announcement with very high priority
    const randomAnnouncer = this.getRandomSound(this.crowdSounds.announcer.gameStart);
    this.queueAnnouncement("game-start", randomAnnouncer, 105, 0.7); // Priority 105 = very high
  }

  /**
   * Play general applause for good plays
   */
  public playApplause(): void {
    if (!this.isActive || !isFIFAMode()) return;

    const applauseAudio = new Audio({
      uri: this.crowdSounds.reactions.applause,
      loop: false,
      volume: 0.25,
    });
    applauseAudio.play(this.world);
  }

  /**
   * Get a random sound from an array of sound paths
   */
  private getRandomSound(soundArray: string[]): string {
    return soundArray[Math.floor(Math.random() * soundArray.length)];
  }

  /**
   * Check if the crowd manager is currently active
   */
  public isActivated(): boolean {
    return this.isActive;
  }

  /**
   * Check if an announcer is currently speaking
   */
  public isAnnouncerBusy(): boolean {
    return this.isAnnouncerSpeaking;
  }

  /**
   * Get the current announcer queue status
   */
  public getQueueStatus(): { queueLength: number; isPlaying: boolean; currentType?: string } {
    return {
      queueLength: this.announcerQueue.length,
      isPlaying: this.isAnnouncerSpeaking,
      currentType: this.isAnnouncerSpeaking ? "announcer-speaking" : undefined
    };
  }

  /**
   * Clear the announcer queue (for testing/debugging)
   */
  public clearAnnouncerQueue(): void {
    console.log(`🎙️ Clearing announcer queue (${this.announcerQueue.length} items)`);
    this.announcerQueue = [];
    
    // Also stop current announcer if playing
    if (this.currentAnnouncerAudio) {
      this.currentAnnouncerAudio.pause();
      this.currentAnnouncerAudio = null;
      this.isAnnouncerSpeaking = false;
      console.log(`🎙️ Stopped current announcer audio`);
    }
  }

  /**
   * Start the announcer queue processor to manage voice overlap
   */
  private startQueueProcessor(): void {
    this.queueProcessorInterval = setInterval(() => {
      this.processAnnouncerQueue();
    }, 500); // Check every 500ms
  }

  /**
   * Process the announcer queue to ensure only one voice plays at a time
   */
  private processAnnouncerQueue(): void {
    // If announcer is currently speaking, wait
    if (this.isAnnouncerSpeaking) {
      return;
    }

    // If queue is empty, nothing to do
    if (this.announcerQueue.length === 0) {
      return;
    }

    // Sort queue by priority (higher number = higher priority)
    this.announcerQueue.sort((a, b) => b.priority - a.priority);

    // Get the highest priority announcement
    const nextAnnouncement = this.announcerQueue.shift();
    if (!nextAnnouncement) return;

    console.log(`🎙️ Playing queued announcer: ${nextAnnouncement.type} - ${nextAnnouncement.audioUri.split('/').pop()}`);

    // Play the announcement
    this.playAnnouncerAudio(nextAnnouncement.audioUri, nextAnnouncement.volume);
  }

  /**
   * Add an announcement to the queue
   */
  private queueAnnouncement(type: string, audioUri: string, priority: number, volume: number = 0.6): void {
    if (!this.isActive || !isFIFAMode()) return;

    // Remove any duplicate announcements of the same type to prevent spam
    this.announcerQueue = this.announcerQueue.filter(item => item.type !== type);

    // Add new announcement
    this.announcerQueue.push({
      type,
      audioUri,
      priority,
      volume
    });

    console.log(`📋 Queued announcer: ${type} (Priority: ${priority}, Queue size: ${this.announcerQueue.length})`);
  }

  /**
   * Play announcer audio and track when it finishes
   */
  private playAnnouncerAudio(audioUri: string, volume: number): void {
    this.isAnnouncerSpeaking = true;

    this.currentAnnouncerAudio = new Audio({
      uri: audioUri,
      loop: false,
      volume: volume,
    });

    this.currentAnnouncerAudio.play(this.world);

    // Estimate audio duration and mark as finished
    // Most announcer clips are 2-4 seconds, so we'll use a safe 5 second timeout
    setTimeout(() => {
      this.isAnnouncerSpeaking = false;
      this.currentAnnouncerAudio = null;
      console.log(`🎙️ Announcer finished speaking`);
    }, 5000); // 5 second timeout
  }
} 