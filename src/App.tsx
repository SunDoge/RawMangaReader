import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/home";

function App() {
  return (
    <TooltipProvider>
      <Home />
      <Toaster position="bottom-right" richColors />
    </TooltipProvider>
  );
}

export default App;
