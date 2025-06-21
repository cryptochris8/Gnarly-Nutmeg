import type { EventPayloads as HytopiaEventPayloads } from "hytopia";

// Define the payload structure for your custom event
interface CustomEventPayloads {
  goal: {
    team: "red" | "blue"; // The team that scored
  };
  // Add other custom event payloads here if needed
}

// Use module augmentation to merge custom payloads with Hytopia's
declare module "hytopia" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface EventPayloads extends HytopiaEventPayloads, CustomEventPayloads {}
} 