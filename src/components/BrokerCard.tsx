import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Loader2, AlertTriangle, User, LogOut } from "lucide-react";

interface BrokerCardProps {
  name: string;
  logo: string;
  description: string;
  onClick: () => void;
  isConnected?: boolean;
  lastCheckTime?: Date | null;
  sessionActive?: boolean;
  isChecking?: boolean;
  accountName?: string;
  sessionStatus?: 'active' | 'logged_out' | 'expired' | null;
}

const formatLastCheck = (date: Date | null): string => {
  if (!date) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  
  if (diffSecs < 60) return "Just now";
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  return date.toLocaleDateString();
};

const formatLogoutTime = (date: Date | null): string => {
  if (!date) return "";
  return date.toLocaleTimeString('en-IN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
};

const BrokerCard = ({ 
  name, 
  logo, 
  description, 
  onClick, 
  isConnected,
  lastCheckTime,
  sessionActive = true,
  isChecking = false,
  accountName,
  sessionStatus
}: BrokerCardProps) => {
  const isLoggedOut = sessionStatus === 'logged_out';
  const isExpired = sessionStatus === 'expired' || (!sessionActive && isConnected && !isLoggedOut);
  const isActive = isConnected && sessionActive && !isLoggedOut;

  return (
    <button
      onClick={onClick}
      className={cn(
        "broker-card w-full text-left group cursor-pointer relative",
        isActive && "border-primary/50 ring-2 ring-primary/20",
        isExpired && "border-destructive/50 ring-2 ring-destructive/20",
        isLoggedOut && "border-orange-500/50 ring-2 ring-orange-500/20"
      )}
    >
      {/* Status Badge */}
      {isConnected && (
        <div className={cn(
          "absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
          isActive && "bg-primary text-primary-foreground",
          isExpired && "bg-destructive text-destructive-foreground",
          isLoggedOut && "bg-orange-500 text-white"
        )}>
          {isActive ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Connected
            </>
          ) : isLoggedOut ? (
            <>
              <LogOut className="w-3.5 h-3.5" />
              Logged Off
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5" />
              Expired
            </>
          )}
        </div>
      )}
      
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="relative">
          <div className={cn(
            "w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center overflow-hidden border transition-colors duration-300",
            isActive ? "border-primary/50" : 
            isExpired ? "border-destructive/50" :
            isLoggedOut ? "border-orange-500/50" :
            "border-border group-hover:border-primary/30"
          )}>
            <img 
              src={logo} 
              alt={name} 
              className="w-14 h-14 object-contain"
            />
          </div>
          {isActive && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <svg className="w-3.5 h-3.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {isExpired && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-destructive flex items-center justify-center shadow-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive-foreground" />
            </div>
          )}
          {isLoggedOut && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
              <LogOut className="w-3.5 h-3.5 text-white" />
            </div>
          )}
        </div>
        
        <div className="text-center">
          <h3 className={cn(
            "font-semibold text-lg mb-1 transition-colors duration-200",
            isActive ? "text-primary" : 
            isExpired ? "text-destructive" :
            isLoggedOut ? "text-orange-500" :
            "text-foreground group-hover:text-primary"
          )}>
            {name}
          </h3>
          {isConnected && accountName ? (
            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              <span>{accountName}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
          
          {/* Last Check/Logout Time */}
          {isConnected && lastCheckTime && (
            <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
              {isChecking ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : isLoggedOut ? (
                <>
                  <LogOut className="w-3 h-3" />
                  <span>Logged off at {formatLogoutTime(lastCheckTime)}</span>
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3" />
                  <span>Last check: {formatLastCheck(lastCheckTime)}</span>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className={cn(
          "mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-primary/10 text-primary border border-primary/20" 
            : isExpired
            ? "bg-destructive/10 text-destructive border border-destructive/20"
            : isLoggedOut
            ? "bg-orange-500/10 text-orange-500 border border-orange-500/20"
            : "bg-secondary text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground"
        )}>
          {isActive ? "Manage Connection" : 
           isExpired ? "Re-login Required" :
           isLoggedOut ? "Login Again" :
           "Connect"}
        </div>
      </div>
    </button>
  );
};

export default BrokerCard;
