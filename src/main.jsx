import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// StrictMode не используем: в разработке он монтирует дерево дважды,
// и два параллельных ReceiveNotification разбирают одну очередь GREEN-API.
createRoot(document.getElementById("root")).render(<App />);
