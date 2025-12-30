import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  brokerName: string;
  brokerLogo: string;
  onLoginSuccess: () => void;
}

const LoginModal = ({ isOpen, onClose, brokerName, brokerLogo, onLoginSuccess }: LoginModalProps) => {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!loginId.trim()) {
      setError("Please enter your Login ID");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your Password");
      return;
    }

    setIsLoading(true);

    // Simulate API call for login verification
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock verification - in real app, this would call the broker's API
    if (loginId.toLowerCase() === "demo" && password === "demo123") {
      setIsLoading(false);
      toast({
        title: "Login Successful!",
        description: `Connected to ${brokerName} successfully.`,
      });
      onLoginSuccess();
      handleClose();
    } else {
      setIsLoading(false);
      setError("Invalid Login ID or Password. Please try again.");
    }
  };

  const handleClose = () => {
    setLoginId("");
    setPassword("");
    setError("");
    setShowPassword(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border animate-scale-in">
        <DialogHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4 border border-border">
            <img 
              src={brokerLogo} 
              alt={brokerName} 
              className="w-10 h-10 object-contain"
            />
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Login to {brokerName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your broker credentials to connect
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="loginId" className="text-foreground font-medium">
              Login ID
            </Label>
            <Input
              id="loginId"
              type="text"
              placeholder="Enter your Login ID"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              disabled={isLoading}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground font-medium">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="h-12 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="glow"
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Verify & Connect
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Your credentials are securely transmitted and not stored.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
