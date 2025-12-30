import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  brokerId: string;
  brokerName: string;
  brokerLogo: string;
  onLoginSuccess: (userName?: string, accountName?: string) => void;
}

const LoginModal = ({ isOpen, onClose, brokerId, brokerName, brokerLogo, onLoginSuccess }: LoginModalProps) => {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [vendorCode, setVendorCode] = useState("");
  const [imei, setImei] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const isAngelOne = brokerId === "angelone";
  const isShoonya = brokerId === "shoonya";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!loginId.trim()) {
      setError(isAngelOne ? "Please enter your Client Code" : isShoonya ? "Please enter your User ID" : "Please enter your Login ID");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your Password");
      return;
    }
    if ((isAngelOne || isShoonya) && !totpToken.trim()) {
      setError("Please enter your TOTP Token");
      return;
    }
    if ((isAngelOne || isShoonya) && !apiKey.trim()) {
      setError("Please enter your API Key");
      return;
    }
    if (isShoonya && !vendorCode.trim()) {
      setError("Please enter your Vendor Code");
      return;
    }

    setIsLoading(true);

    try {
      let data, error;

      if (isAngelOne) {
        // Call Angel One login edge function
        const response = await supabase.functions.invoke('angelone-login', {
          body: { clientCode: loginId, password: password, totpToken: totpToken, apiKey: apiKey }
        });
        data = response.data;
        error = response.error;
      } else if (isShoonya) {
        // Call Shoonya login edge function
        const response = await supabase.functions.invoke('shoonya-login', {
          body: { userId: loginId, password: password, totpToken: totpToken, vendorCode: vendorCode, apiKey: apiKey, imei: imei || 'abcd1234' }
        });
        data = response.data;
        error = response.error;
      } else {
        // Call Samco login edge function
        const response = await supabase.functions.invoke('samco-login', {
          body: { userId: loginId, password: password }
        });
        data = response.data;
        error = response.error;
      }

      if (error) {
        console.error('Edge function error:', error);
        setError("Connection error. Please try again.");
        setIsLoading(false);
        return;
      }

      if (data.success) {
        toast({
          title: "Login Successful!",
          description: `Connected to ${brokerName} as ${data.accountName || loginId}.`,
        });
        onLoginSuccess(loginId, data.accountName || loginId); // Pass username and accountName
        handleClose();
      } else {
        setError(data.error || "Invalid credentials. Please try again.");
      }
    } catch (err) {
      console.error('Login error:', err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setLoginId("");
    setPassword("");
    setTotpToken("");
    setApiKey("");
    setVendorCode("");
    setImei("");
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="loginId" className="text-foreground font-medium">
              {isAngelOne ? "Client Code" : isShoonya ? "User ID" : "Login ID"}
            </Label>
            <Input
              id="loginId"
              type="text"
              placeholder={isAngelOne ? "Enter your Client Code" : isShoonya ? "Enter your User ID" : "Enter your Login ID"}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              disabled={isLoading}
              className="h-11"
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
                className="h-11 pr-12"
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

          {(isAngelOne || isShoonya) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="totpToken" className="text-foreground font-medium">
                  TOTP Token
                </Label>
                <Input
                  id="totpToken"
                  type="text"
                  placeholder="Enter your TOTP secret key"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value)}
                  disabled={isLoading}
                  className="h-11"
                />
              </div>

              {isShoonya && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="vendorCode" className="text-foreground font-medium">
                      Vendor Code
                    </Label>
                    <Input
                      id="vendorCode"
                      type="text"
                      placeholder="Enter your Vendor Code"
                      value={vendorCode}
                      onChange={(e) => setVendorCode(e.target.value)}
                      disabled={isLoading}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="imei" className="text-foreground font-medium">
                      IMEI Code <span className="text-muted-foreground font-normal">(Optional)</span>
                    </Label>
                    <Input
                      id="imei"
                      type="text"
                      placeholder="Enter your IMEI Code (default: abcd1234)"
                      value={imei}
                      onChange={(e) => setImei(e.target.value)}
                      disabled={isLoading}
                      className="h-11"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-foreground font-medium">
                  API Key
                </Label>
                <Input
                  id="apiKey"
                  type="text"
                  placeholder={isAngelOne ? "Enter your Angel One API Key" : "Enter your Shoonya API Key"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isLoading}
                  className="h-11"
                />
              </div>
            </>
          )}

          <Button
            type="submit"
            variant="glow"
            size="lg"
            className="w-full mt-2"
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
