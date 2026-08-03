
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import "./lib/analytics";
  import "./lib/clarity";

  createRoot(document.getElementById("root")!).render(<App />);
  