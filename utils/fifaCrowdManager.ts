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
  
  // Audio collections based on available files
  private crowdSounds = {
    ambient: [
      "audio/sfx/crowd/ambient/Stringer Sound - Soccer Game - Football Stadium Ambience Crowd Chanting Cheering Applause.wav",
      "audio/sfx/crowd/ambient/Stringer Sound - Ultras - Football Fans Cheering Angry Distant Drums.wav", 
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
      gameStart: "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - Game Start.wav",
      goal: "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - What a Goal Excited.wav",
      save: "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - Reaction Beautiful Save.wav",
      crowdWild: "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - Crowd Goes Wild.wav",
      beauty: "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - What a Beauty.wav",
      close: "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - So Close Frustrated .wav",
      redCard: "audio/sfx/crowd/announcer/Notable Voices - Soccer Commentator - Red Card.wav"
    }
  };

  constructor(world: World) {
    this.world = world;
    console.log("FIFA Crowd Manager initialized");
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
    
    // Play crowd cheer
    const goalCheer = new Audio({
      uri: this.crowdSounds.reactions.goalCheer,
      loop: false,
      volume: 0.4,
    });
    goalCheer.play(this.world);

    // Delay announcer commentary slightly
    setTimeout(() => {
      const announcerClips = [
        this.crowdSounds.announcer.goal,
        this.crowdSounds.announcer.beauty,
        this.crowdSounds.announcer.crowdWild
      ];
      
      const randomAnnouncer = this.getRandomSound(announcerClips);
      const announcerAudio = new Audio({
        uri: randomAnnouncer,
        loop: false,
        volume: 0.6,
      });
      announcerAudio.play(this.world);
      
      console.log(`📻 Playing announcer: ${randomAnnouncer.split('/').pop()}`);
    }, 1500); // 1.5 second delay for realistic timing
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

    // Sometimes add announcer commentary
    if (Math.random() < 0.6) { // 60% chance
      setTimeout(() => {
        const announcerClips = [
          this.crowdSounds.announcer.close,
          this.crowdSounds.announcer.save
        ];
        
        const randomAnnouncer = this.getRandomSound(announcerClips);
        const announcerAudio = new Audio({
          uri: randomAnnouncer,
          loop: false,
          volume: 0.5,
        });
        announcerAudio.play(this.world);
      }, 800);
    }
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
    
    const gameStartAudio = new Audio({
      uri: this.crowdSounds.announcer.gameStart,
      loop: false,
      volume: 0.7,
    });
    gameStartAudio.play(this.world);
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
} 