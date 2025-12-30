import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BrokerSession {
  brokerId: string;
  userName: string;
  lastCheckTime: Date | null;
  sessionActive: boolean;
}

interface UseSessionMonitorProps {
  connectedBrokers: string[];
  brokerUserNames: Record<string, string>;
  onSessionExpired?: (brokerId: string) => void;
  onSessionRestored?: (brokerId: string) => void;
  checkIntervalMs?: number;
}

interface SessionStatus {
  lastCheckTime: Date | null;
  sessionActive: boolean;
  isChecking: boolean;
}

// Alert sound for session issues
const playAlertSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    // Play second beep
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 600;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.5);
    }, 200);
  } catch (e) {
    console.error('Could not play alert sound:', e);
  }
};

export const useSessionMonitor = ({
  connectedBrokers,
  brokerUserNames,
  onSessionExpired,
  onSessionRestored,
  checkIntervalMs = 60000 // 1 minute default
}: UseSessionMonitorProps) => {
  const [sessionStatuses, setSessionStatuses] = useState<Record<string, SessionStatus>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkSession = useCallback(async (brokerId: string) => {
    const userName = brokerUserNames[brokerId];
    if (!userName) return;

    setSessionStatuses(prev => ({
      ...prev,
      [brokerId]: { ...prev[brokerId], isChecking: true }
    }));

    try {
      let functionName: string;
      if (brokerId === 'angelone') {
        functionName = 'angelone-check-session';
      } else if (brokerId === 'shoonya') {
        functionName = 'shoonya-check-session';
      } else {
        functionName = 'samco-check-session';
      }
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { userName }
      });

      if (error) {
        console.error(`Error checking ${brokerId} session:`, error);
        return;
      }

      const now = new Date();

      if (data.sessionActive) {
        setSessionStatuses(prev => ({
          ...prev,
          [brokerId]: {
            lastCheckTime: now,
            sessionActive: true,
            isChecking: false
          }
        }));

        if (data.reloggedIn || data.reLoginPerformed) {
          const brokerDisplayName = brokerId === 'angelone' ? 'Angel One' : brokerId === 'shoonya' ? 'Shoonya' : 'Samco';
          toast.success(`${brokerDisplayName} session auto-restored!`);
          onSessionRestored?.(brokerId);
        }
      } else {
        // Session expired
        playAlertSound();
        
        setSessionStatuses(prev => ({
          ...prev,
          [brokerId]: {
            lastCheckTime: now,
            sessionActive: false,
            isChecking: false
          }
        }));

        const brokerDisplayName = brokerId === 'angelone' ? 'Angel One' : brokerId === 'shoonya' ? 'Shoonya' : 'Samco';
        toast.error(`${brokerDisplayName} session expired! Please re-login.`);
        onSessionExpired?.(brokerId);
      }
    } catch (error) {
      console.error(`Error checking ${brokerId} session:`, error);
      setSessionStatuses(prev => ({
        ...prev,
        [brokerId]: { ...prev[brokerId], isChecking: false }
      }));
    }
  }, [brokerUserNames, onSessionExpired, onSessionRestored]);

  const checkAllSessions = useCallback(async () => {
    console.log('Checking all broker sessions...');
    for (const brokerId of connectedBrokers) {
      await checkSession(brokerId);
    }
  }, [connectedBrokers, checkSession]);

  // Start monitoring when connected brokers change
  useEffect(() => {
    if (connectedBrokers.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Check immediately on mount
    checkAllSessions();

    // Set up interval
    intervalRef.current = setInterval(checkAllSessions, checkIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [connectedBrokers, checkIntervalMs, checkAllSessions]);

  // Manual trigger to check a specific broker
  const manualCheck = useCallback((brokerId: string) => {
    checkSession(brokerId);
  }, [checkSession]);

  return {
    sessionStatuses,
    manualCheck,
    checkAllSessions
  };
};
