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

// Check if current time is within market hours (8:45 AM - 4:00 PM IST)
const isWithinMarketHours = (): boolean => {
  const now = new Date();
  // Convert to IST (UTC + 5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  
  // Market hours: 8:45 AM (525 min) to 4:00 PM (960 min)
  const marketOpen = 8 * 60 + 45; // 8:45 AM = 525 minutes
  const marketClose = 16 * 60;    // 4:00 PM = 960 minutes
  
  return totalMinutes >= marketOpen && totalMinutes <= marketClose;
};

// Check if it's time for scheduled logout (after 5:00 PM IST)
const isAfterLogoutTime = (): boolean => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  
  const hours = istTime.getUTCHours();
  return hours >= 17; // 5:00 PM or later
};

// Check if it's time for scheduled login (8:30 AM IST)
const isLoginTime = (): boolean => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  
  // Login window: 8:30 AM - 8:45 AM
  return hours === 8 && minutes >= 30 && minutes < 45;
};

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
  const [isMarketHours, setIsMarketHours] = useState(isWithinMarketHours());
  const logoutPerformedToday = useRef(false);
  const loginPerformedToday = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkSession = useCallback(async (brokerId: string) => {
    const userName = brokerUserNames[brokerId];
    if (!userName) return;

    setSessionStatuses(prev => ({
      ...prev,
      [brokerId]: { ...prev[brokerId], isChecking: true }
    }));

    try {
      let functionName: string;
      let bodyParam: Record<string, string>;
      
      if (brokerId === 'angelone') {
        functionName = 'angelone-check-session';
        bodyParam = { userName };
      } else if (brokerId === 'shoonya') {
        functionName = 'shoonya-check-session';
        bodyParam = { userName };
      } else if (brokerId === 'upstox') {
        functionName = 'upstox-check-session';
        bodyParam = { userId: userName };
      } else {
        functionName = 'samco-check-session';
        bodyParam = { userName };
      }
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: bodyParam
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
          const brokerDisplayName = brokerId === 'angelone' ? 'Angel One' : 
                                    brokerId === 'shoonya' ? 'Shoonya' : 
                                    brokerId === 'upstox' ? 'Upstox' : 'Samco';
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

        const brokerDisplayName = brokerId === 'angelone' ? 'Angel One' : 
                                  brokerId === 'shoonya' ? 'Shoonya' : 
                                  brokerId === 'upstox' ? 'Upstox' : 'Samco';
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

  // Perform scheduled logout for all brokers
  const performScheduledLogout = useCallback(async () => {
    console.log('Performing scheduled logout for all brokers...');
    toast.info('Market closed - Logging out from all brokers...');
    
    try {
      const { data, error } = await supabase.functions.invoke('scheduled-logout');
      
      if (error) {
        console.error('Scheduled logout error:', error);
        toast.error('Failed to logout from brokers');
        return;
      }
      
      console.log('Scheduled logout result:', data);
      toast.success('Logged out from all brokers (Market closed)');
      
      // Update local session statuses
      setSessionStatuses(prev => {
        const updated: Record<string, SessionStatus> = {};
        for (const brokerId of Object.keys(prev)) {
          updated[brokerId] = {
            ...prev[brokerId],
            sessionActive: false,
            lastCheckTime: new Date()
          };
        }
        return updated;
      });
    } catch (e) {
      console.error('Error during scheduled logout:', e);
    }
  }, []);

  // Perform scheduled login for all brokers
  const performScheduledLogin = useCallback(async () => {
    console.log('Performing scheduled login for all brokers...');
    toast.info('Market opening - Logging in to all brokers...');
    
    try {
      const { data, error } = await supabase.functions.invoke('scheduled-login');
      
      if (error) {
        console.error('Scheduled login error:', error);
        toast.error('Failed to login to brokers');
        return;
      }
      
      console.log('Scheduled login result:', data);
      
      // Check results and notify
      const successCount = data.results?.filter((r: any) => r.loginSuccess).length || 0;
      const failCount = data.results?.filter((r: any) => !r.loginSuccess).length || 0;
      
      if (successCount > 0) {
        toast.success(`Logged in to ${successCount} broker(s)`);
      }
      if (failCount > 0) {
        toast.warning(`Failed to login to ${failCount} broker(s) - manual login required`);
      }
    } catch (e) {
      console.error('Error during scheduled login:', e);
    }
  }, []);

  const checkAllSessions = useCallback(async () => {
    // Update market hours status
    const currentlyMarketHours = isWithinMarketHours();
    setIsMarketHours(currentlyMarketHours);
    
    // Check for scheduled logout (after 5 PM IST)
    if (isAfterLogoutTime() && !logoutPerformedToday.current) {
      logoutPerformedToday.current = true;
      await performScheduledLogout();
      return;
    }
    
    // Check for scheduled login (8:30 AM IST)
    if (isLoginTime() && !loginPerformedToday.current) {
      loginPerformedToday.current = true;
      await performScheduledLogin();
      return;
    }
    
    // Reset flags at midnight
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    if (istTime.getUTCHours() === 0 && istTime.getUTCMinutes() < 5) {
      logoutPerformedToday.current = false;
      loginPerformedToday.current = false;
    }
    
    // Only check sessions during market hours (8:45 AM - 4:00 PM IST)
    if (!currentlyMarketHours) {
      console.log('Outside market hours - skipping session checks');
      return;
    }
    
    console.log('Checking all broker sessions (within market hours)...');
    for (const brokerId of connectedBrokers) {
      await checkSession(brokerId);
    }
  }, [connectedBrokers, checkSession, performScheduledLogout, performScheduledLogin]);

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
    isMarketHours,
    manualCheck,
    checkAllSessions,
    performScheduledLogout,
    performScheduledLogin
  };
};
