import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { HashRouter, Route, Routes } from "react-router";
import Home from "@/pages/home";

function App() {
  return (
    <TooltipProvider>
      <HashRouter>
        <Routes>
          <Route path="/*" element={<Home />} />
        </Routes>
      </HashRouter>
      <Toaster position="bottom-right" richColors />
    </TooltipProvider>
  );
}

export default App;
