import { useEffect } from 'react';
import { connectTelemetryWebSocket } from '../store/useTelemetryStore';
import { useRadioController, type UseRadioControllerReturn } from './useRadioController';
import { useProactiveRadioCalls } from './useProactiveRadioCalls';
import { useTrafficCallPrefetch } from './useTrafficCallPrefetch';

/**
 * The live feed and the race engineer, for a page that shows them: the Live page and the engineer
 * window's. It keeps the telemetry feed open while the page is, and runs the radio where it may
 * speak (`useRadioHere`).
 */
export function useLiveRadio(): UseRadioControllerReturn {
  useEffect(() => {
    const disconnect = connectTelemetryWebSocket();
    return () => {
      disconnect();
    };
  }, []);

  const radio = useRadioController();
  // The pit wall's calls, in the persona's words or worded afresh by the AI
  useProactiveRadioCalls(radio);
  // Its qualifying traffic warnings, synthesized ahead so they start at once
  useTrafficCallPrefetch(radio);
  return radio;
}
