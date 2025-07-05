// Abilities Index - Export all ability classes and configurations
// This file provides a central location to import all abilities

export type { Ability } from "./Ability";
export { AbilityHolder } from "./AbilityHolder";
export { ItemThrowAbility } from "./ItemThrowAbility";
export { SpeedBoostAbility } from "./SpeedBoostAbility";
export { StaminaAbility } from "./StaminaAbility";

// Export ability configurations
export { 
  shurikenThrowOptions, 
  speedBoostOptions, 
  staminaBoostOptions,
  type ItemAbilityOptions 
} from "./itemTypes";

// Example usage for stamina power-up:
// 
// import { StaminaAbility, staminaBoostOptions } from "./abilities";
// 
// // Create stamina ability instance
// const staminaAbility = new StaminaAbility(staminaBoostOptions);
// 
// // Add to player's ability holder (only in arcade mode)
// if (isArcadeMode()) {
//   player.abilityHolder.setAbility(staminaAbility);
// } 