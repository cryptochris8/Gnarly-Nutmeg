import type { PlayerCameraOrientation, QuaternionLike, Vector3Like } from "hytopia";

import { Vector3 } from "hytopia";

import type { PlayerEntity } from "hytopia";

export function directionFromOrientation(
  entity: PlayerEntity,
  cameraOrientation: PlayerCameraOrientation
): Vector3 {
  const direction = Vector3.fromVector3Like(entity.directionFromRotation);
  direction.y = Math.sin(cameraOrientation.pitch);

  const cosP = Math.cos(cameraOrientation.pitch);
  direction.x = direction.x * cosP;
  direction.z = direction.z * cosP;

  return direction.normalize();
}

export function getDirectionFromRotation(
  rotation: QuaternionLike
): Vector3Like {
  const angle = 2 * Math.atan2(rotation.y, rotation.w);

  const direction = {
    x: Math.sin(angle) * 1,
    y: 0,
    z: Math.cos(angle) * 1,
  };
  return direction;
}
