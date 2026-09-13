import * as Location from 'expo-location';
import type { AreaCoordinates } from '../context/types.ts';

export type CoarseAreaLocationResult =
  | { coordinates: AreaCoordinates; needsSettings: false }
  | { error: string; needsSettings: boolean };

export async function captureCoarseAreaLocation(): Promise<CoarseAreaLocationResult> {
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (!permission.granted) {
    return {
      error: permission.canAskAgain
        ? 'Location permission is needed to set your area for distance matching.'
        : 'Enable location access in device settings to use distance matching.',
      needsSettings: !permission.canAskAgain,
    };
  }
  const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return {
    // Public marketplace coordinates are intentionally rounded to roughly a
    // one-kilometer grid. Exact device coordinates are never stored.
    coordinates: {
      latE2: Math.round(current.coords.latitude * 100),
      lngE2: Math.round(current.coords.longitude * 100),
    },
    needsSettings: false,
  };
}